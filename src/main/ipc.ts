import { readFile, realpath, stat, writeFile } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve } from "node:path";
import {
  BrowserWindow,
  dialog,
  ipcMain,
  safeStorage,
  type OpenDialogOptions,
  type SaveDialogOptions,
} from "electron";
import type {
  ActaAPI,
  Routine,
  StartRunInput,
  StartRunRequest,
} from "../shared/types";
import {
  RecorderStartSchema,
  RoutineSchema,
  StartRunRequestSchema,
} from "../shared/schemas";
import {
  escapeCsvCell,
  routineDefinitionForExport,
  validateRoutineForRun,
} from "../shared/flow-utils";
import { LocalStore } from "./store";
import { RecorderManager } from "./recorder";
import { RunnerManager } from "./runner";
import { readSpreadsheet } from "./spreadsheet";

interface RegisterIpcOptions {
  getWindow: () => BrowserWindow | null;
  store: LocalStore;
  recorder: RecorderManager;
  runner: RunnerManager;
  demoUrl: string;
  appVersion: string;
  storePath: string;
}

function showOpenDialog(
  options: RegisterIpcOptions,
  settings: OpenDialogOptions,
) {
  const owner = options.getWindow();
  return owner
    ? dialog.showOpenDialog(owner, settings)
    : dialog.showOpenDialog(settings);
}

function showSaveDialog(
  options: RegisterIpcOptions,
  settings: SaveDialogOptions,
) {
  const owner = options.getWindow();
  return owner
    ? dialog.showSaveDialog(owner, settings)
    : dialog.showSaveDialog(settings);
}

export function registerIpc(options: RegisterIpcOptions): void {
  ipcMain.handle("app:bootstrap", () => ({
    demoUrl: options.demoUrl,
    platform: process.platform,
    browserLabel: "Microsoft Edge",
    appVersion: options.appVersion,
  }));

  ipcMain.handle("routines:list", () => options.store.listRoutines());
  ipcMain.handle("routines:get", (_event, id: string) =>
    options.store.getRoutine(id),
  );
  ipcMain.handle("routines:save", async (_event, routine: Routine) => {
    const validated = RoutineSchema.parse(routine) as Routine;
    const existing = options.store.getRoutine(validated.id);
    const executionChanged = existing
      ? executionShape(existing) !== executionShape(validated)
      : true;
    if (executionChanged && existing?.status === "ready") {
      validated.status = "draft";
      validated.version = Math.max(validated.version, existing.version + 1);
      validated.lastTestedAt = undefined;
    }
    if (validated.status === "ready" && existing?.status !== "ready") {
      const successfulTest = options.store
        .listRuns()
        .some(
          (run) =>
            run.routineId === validated.id &&
            run.routineVersion === validated.version &&
            run.mode === "test" &&
            run.status === "completed",
        );
      if (!successfulTest) {
        validated.status = "draft";
        validated.lastTestedAt = undefined;
      }
    }
    return options.store.saveRoutine(validated);
  });
  ipcMain.handle("routines:remove", async (_event, id: string) =>
    options.store.removeRoutine(id),
  );
  ipcMain.handle("routines:import", async () => {
    const result = await showOpenDialog(options, {
      title: "Importar automação Acta",
      properties: ["openFile"],
      filters: [{ name: "Automação Acta", extensions: ["acta", "json"] }],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const metadata = await stat(result.filePaths[0]);
    if (!metadata.isFile() || metadata.size > 2 * 1024 * 1024) {
      throw new Error("Escolha uma definição Acta de até 2 MB.");
    }
    const content = await readFile(result.filePaths[0], "utf8");
    const routine = RoutineSchema.parse(JSON.parse(content)) as Routine;
    const imported: Routine = {
      ...routine,
      id: crypto.randomUUID(),
      name: `${routine.name} (importada)`,
      status: "draft",
      version: 1,
      lastTestedAt: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return options.store.saveRoutine(imported);
  });
  ipcMain.handle("routines:export", async (_event, routine: Routine) => {
    const validated = RoutineSchema.parse(routine);
    const exportable = routineDefinitionForExport(validated as Routine);
    const result = await showSaveDialog(options, {
      title: "Exportar automação Acta",
      defaultPath: `${safeFileName(routine.name)}.acta`,
      filters: [{ name: "Automação Acta", extensions: ["acta"] }],
    });
    if (result.canceled || !result.filePath) return null;
    await writeFile(
      result.filePath,
      JSON.stringify(exportable, null, 2),
      "utf8",
    );
    return result.filePath;
  });

  ipcMain.handle("runs:list", () => options.store.listRuns());
  ipcMain.handle("runs:get", (_event, id: string) => options.store.getRun(id));
  ipcMain.handle("runs:export-csv", async (_event, runId: string) => {
    const run = options.store.getRun(runId);
    if (!run) throw new Error("Execução não encontrada.");
    const result = await showSaveDialog(options, {
      title: "Exportar relatório",
      defaultPath: `${safeFileName(run.routineName)}-${run.startedAt.slice(0, 10)}.csv`,
      filters: [{ name: "Planilha CSV", extensions: ["csv"] }],
    });
    if (result.canceled || !result.filePath) return null;
    const lines = [
      [
        "Registro",
        "Identificação",
        "Status",
        "Passo final",
        "Mensagem",
        "Início",
        "Fim",
      ],
      ...run.items.map((item) => [
        item.index + 1,
        item.label,
        item.status,
        item.stepRecords.at(-1)?.label ?? "",
        item.error?.message ?? "",
        item.startedAt ?? "",
        item.endedAt ?? "",
      ]),
    ];
    const csv = lines
      .map((line) => line.map(escapeCsvCell).join(";"))
      .join("\r\n");
    await writeFile(result.filePath, `\ufeff${csv}`, "utf8");
    return result.filePath;
  });
  ipcMain.handle(
    "runs:read-artifact",
    async (_event, runId: string, itemIndex: number) => {
      const run = options.store.getRun(runId);
      const filePath = run?.items.find((item) => item.index === itemIndex)
        ?.error?.screenshotPath;
      if (!filePath || extname(filePath).toLowerCase() !== ".png") return null;
      const artifactRoot = await realpath(
        resolve(options.storePath, "runs", runId, "screenshots"),
      ).catch(() => null);
      const requested = await realpath(filePath).catch(() => null);
      if (!artifactRoot || !requested) return null;
      const relation = relative(artifactRoot, requested);
      if (!relation || relation.startsWith("..") || isAbsolute(relation))
        return null;
      const metadata = await stat(requested);
      if (!metadata.isFile() || metadata.size > 15 * 1024 * 1024) return null;
      const content = await readFile(requested);
      return `data:image/png;base64,${content.toString("base64")}`;
    },
  );

  ipcMain.handle("data:pick-spreadsheet", async () => {
    const result = await showOpenDialog(options, {
      title: "Escolher planilha",
      properties: ["openFile"],
      filters: [{ name: "Planilhas", extensions: ["xlsx", "csv"] }],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return readSpreadsheet(result.filePaths[0]);
  });

  ipcMain.handle(
    "recorder:start",
    async (_event, raw: Parameters<ActaAPI["recorder"]["start"]>[0]) => {
      const input = RecorderStartSchema.parse(raw);
      return options.recorder.start(input);
    },
  );
  ipcMain.handle("recorder:stop", () => options.recorder.stop());

  ipcMain.handle("runner:start", async (_event, raw: StartRunRequest) => {
    const request = StartRunRequestSchema.parse(raw) as StartRunRequest;
    const routine = options.store.getRoutine(request.routineId);
    if (!routine || routine.version !== request.routineVersion) {
      throw new Error(
        "A automação mudou. Revise a versão atual antes de executar.",
      );
    }
    const issues = validateRoutineForRun(routine);
    if (issues.length) throw new Error(issues[0].message);
    if (request.mode !== "test" && routine.status !== "ready") {
      throw new Error(
        "Teste esta versão com uma linha antes de executar o lote.",
      );
    }
    const input: StartRunInput = {
      routine,
      mode: request.mode,
      rowIndices: request.rowIndices,
    };
    return options.runner.start(input);
  });
  ipcMain.handle("runner:pause", (_event, runId: string) =>
    options.runner.pause(runId),
  );
  ipcMain.handle("runner:resume", (_event, runId: string) =>
    options.runner.resume(runId),
  );
  ipcMain.handle("runner:cancel", (_event, runId: string) =>
    options.runner.cancel(runId),
  );
  ipcMain.handle("runner:continue-checkpoint", (_event, runId: string) =>
    options.runner.continueCheckpoint(runId),
  );

  ipcMain.handle("vault:list", () => options.store.listVault());
  ipcMain.handle("vault:set", async (_event, name: string, value: string) => {
    if (!name.trim() || !value)
      throw new Error("Informe um nome e um valor para a credencial.");
    if (name.trim().length > 160 || value.length > 10_000) {
      throw new Error(
        "Use um nome de até 160 caracteres e um valor de até 10.000 caracteres.",
      );
    }
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error(
        "A proteção de credenciais do Windows não está disponível nesta sessão.",
      );
    }
    const encrypted = safeStorage.encryptString(value).toString("base64");
    await options.store.setVaultValue(name.trim(), encrypted);
  });
  ipcMain.handle("vault:remove", (_event, name: string) =>
    options.store.removeVaultValue(name),
  );
}

export function decryptVaultValue(
  store: LocalStore,
  name: string,
): string | null {
  const encrypted = store.getVaultValue(name);
  if (!encrypted || !safeStorage.isEncryptionAvailable()) return null;
  try {
    return safeStorage.decryptString(Buffer.from(encrypted, "base64"));
  } catch {
    return null;
  }
}

function safeFileName(value: string): string {
  const extension = extname(value);
  const base = extension ? value.slice(0, -extension.length) : value;
  return (
    base
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 80) || "acta"
  );
}

function executionShape(routine: Routine): string {
  return JSON.stringify({
    domains: routine.domains,
    steps: routine.steps,
    columns: routine.dataSet?.columns ?? [],
    sensitiveColumns: routine.sensitiveColumns,
    browserChannel: routine.browserChannel,
  });
}
