import type {
  ActaAPI,
  DataSet,
  RecorderAction,
  Routine,
  Run,
  RunEvent,
  RunItem,
  StartRunInput,
  VaultEntry,
} from "@shared/types";
import { createDemoDataSet } from "./defaults";

const ROUTINES_KEY = "acta-preview-routines";
const RUNS_KEY = "acta-preview-runs";
const VAULT_KEY = "acta-preview-vault";

function read<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function createPreviewApi(): ActaAPI {
  const runListeners = new Set<(event: RunEvent) => void>();
  const recorderListeners = new Set<(action: RecorderAction) => void>();
  let active: {
    run: Run;
    paused: boolean;
    cancelled: boolean;
    resume?: () => void;
  } | null = null;

  const api: ActaAPI = {
    bootstrap: async () => ({
      demoUrl: "https://portal-treinamento.acta.local/colaboradores",
      platform: "win32-preview",
      browserLabel: "Microsoft Edge",
      appVersion: "0.1.0-preview",
    }),
    routines: {
      list: async () =>
        read<Routine[]>(ROUTINES_KEY, []).sort((a, b) =>
          b.updatedAt.localeCompare(a.updatedAt),
        ),
      get: async (id) =>
        read<Routine[]>(ROUTINES_KEY, []).find(
          (routine) => routine.id === id,
        ) ?? null,
      save: async (routine) => {
        const routines = read<Routine[]>(ROUTINES_KEY, []);
        const index = routines.findIndex((item) => item.id === routine.id);
        if (index === -1) routines.push(routine);
        else routines[index] = routine;
        write(ROUTINES_KEY, routines);
        return routine;
      },
      remove: async (id) => {
        write(
          ROUTINES_KEY,
          read<Routine[]>(ROUTINES_KEY, []).filter(
            (routine) => routine.id !== id,
          ),
        );
      },
      importFile: async () => pickJsonFile(),
      exportFile: async (routine) => {
        download(
          `${routine.name}.acta`,
          JSON.stringify(routine, null, 2),
          "application/json",
        );
        return `${routine.name}.acta`;
      },
    },
    runs: {
      list: async () =>
        read<Run[]>(RUNS_KEY, []).sort((a, b) =>
          b.startedAt.localeCompare(a.startedAt),
        ),
      get: async (id) =>
        read<Run[]>(RUNS_KEY, []).find((run) => run.id === id) ?? null,
      exportCsv: async (runId) => {
        const run = read<Run[]>(RUNS_KEY, []).find((item) => item.id === runId);
        if (!run) return null;
        const rows = [
          ["Registro", "Identificação", "Status", "Mensagem"],
          ...run.items.map((item) => [
            item.index + 1,
            item.label,
            item.status,
            item.error?.message ?? "",
          ]),
        ];
        const csv = rows
          .map((row) =>
            row
              .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
              .join(";"),
          )
          .join("\n");
        const name = `${run.routineName}.csv`;
        download(name, `\ufeff${csv}`, "text/csv");
        return name;
      },
      readArtifact: async () => null,
    },
    data: {
      pickSpreadsheet: async () => createDemoDataSet(),
    },
    recorder: {
      start: async ({ url }) => {
        const action: RecorderAction = {
          id: crypto.randomUUID(),
          kind: "open",
          url,
          label: "Abriu a página inicial",
          timestamp: new Date().toISOString(),
        };
        setTimeout(
          () => recorderListeners.forEach((listener) => listener(action)),
          350,
        );
      },
      stop: async () => [],
      onAction: (callback) => {
        recorderListeners.add(callback);
        return () => recorderListeners.delete(callback);
      },
    },
    runner: {
      start: async (request) => {
        if (active) throw new Error("Já existe uma execução em andamento.");
        const routine = read<Routine[]>(ROUTINES_KEY, []).find(
          (item) => item.id === request.routineId,
        );
        if (!routine || routine.version !== request.routineVersion) {
          throw new Error(
            "A automação mudou. Revise a versão atual antes de executar.",
          );
        }
        const input: StartRunInput = {
          routine,
          mode: request.mode,
          rowIndices: request.rowIndices,
        };
        const run = createPreviewRun(input);
        active = { run, paused: false, cancelled: false };
        saveRun(run);
        emit(runListeners, { type: "run-started", run: structuredClone(run) });
        void simulateRun(input, active, runListeners).finally(() => {
          active = null;
        });
        return { runId: run.id };
      },
      pause: async (runId) => {
        if (active?.run.id === runId) active.paused = true;
      },
      resume: async (runId) => {
        if (active?.run.id === runId) {
          active.paused = false;
          active.resume?.();
        }
      },
      cancel: async (runId) => {
        if (active?.run.id === runId) {
          active.cancelled = true;
          active.resume?.();
        }
      },
      continueCheckpoint: async () => undefined,
      onEvent: (callback) => {
        runListeners.add(callback);
        return () => runListeners.delete(callback);
      },
    },
    vault: {
      list: async () => read<VaultEntry[]>(VAULT_KEY, []),
      set: async (name) => {
        const entries = read<VaultEntry[]>(VAULT_KEY, []).filter(
          (entry) => entry.name !== name,
        );
        entries.push({ name, updatedAt: new Date().toISOString() });
        write(VAULT_KEY, entries);
      },
      remove: async (name) => {
        write(
          VAULT_KEY,
          read<VaultEntry[]>(VAULT_KEY, []).filter(
            (entry) => entry.name !== name,
          ),
        );
      },
    },
  };
  return api;
}

export const bridge: ActaAPI = window.acta ?? createPreviewApi();

function createPreviewRun(input: StartRunInput): Run {
  const rows = input.routine.dataSet?.rows ?? [{}];
  const requested = input.rowIndices?.length
    ? input.rowIndices
    : rows.map((_, index) => index);
  const indices = input.mode === "test" ? requested.slice(0, 1) : requested;
  const items: RunItem[] = indices.map((index) => ({
    index,
    key: `registro-${index + 1}`,
    label: String(rows[index]?.Nome ?? `Registro ${index + 1}`),
    status: "pending",
    stepRecords: [],
    inputSnapshot: Object.fromEntries(
      Object.entries(rows[index] ?? {}).map(([column, value]) => [
        column,
        input.routine.sensitiveColumns.includes(column)
          ? "[DADO PROTEGIDO]"
          : value,
      ]),
    ),
  }));
  return {
    id: crypto.randomUUID(),
    routineId: input.routine.id,
    routineName: input.routine.name,
    routineVersion: input.routine.version,
    mode: input.mode,
    status: "preparing",
    startedAt: new Date().toISOString(),
    domains: input.routine.domains,
    dataFileName: input.routine.dataSet?.fileName ?? "Formulário manual",
    items,
    summary: {
      total: items.length,
      processed: 0,
      success: 0,
      skipped: 0,
      errors: 0,
      needsReview: 0,
    },
  };
}

async function simulateRun(
  input: StartRunInput,
  state: { run: Run; paused: boolean; cancelled: boolean; resume?: () => void },
  listeners: Set<(event: RunEvent) => void>,
): Promise<void> {
  const run = state.run;
  run.status = "running";
  for (const item of run.items) {
    if (state.cancelled) break;
    if (state.paused) {
      run.status = "paused";
      emit(listeners, { type: "run-paused", runId: run.id });
      await new Promise<void>((resolve) => {
        state.resume = resolve;
      });
      if (state.cancelled) break;
      run.status = "running";
      emit(listeners, { type: "run-resumed", runId: run.id });
    }
    item.status = "running";
    item.startedAt = new Date().toISOString();
    emit(listeners, {
      type: "item-started",
      runId: run.id,
      itemIndex: item.index,
    });
    for (const step of input.routine.steps.filter((step) => step.enabled)) {
      item.currentStepId = step.id;
      emit(listeners, {
        type: "step-started",
        runId: run.id,
        itemIndex: item.index,
        stepId: step.id,
      });
      await delay(70);
      const record = {
        stepId: step.id,
        label: step.label,
        status: "success" as const,
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
      };
      item.stepRecords.push(record);
      emit(listeners, {
        type: "step-completed",
        runId: run.id,
        itemIndex: item.index,
        stepId: step.id,
        record,
      });
    }
    item.status = "success";
    item.endedAt = new Date().toISOString();
    run.summary.processed += 1;
    run.summary.success += 1;
    saveRun(run);
    emit(listeners, {
      type: "item-completed",
      runId: run.id,
      item: structuredClone(item),
    });
  }
  if (state.cancelled) {
    run.status = "cancelled";
    run.items
      .filter((item) => item.status === "pending")
      .forEach((item) => (item.status = "cancelled"));
  } else run.status = "completed";
  run.endedAt = new Date().toISOString();
  saveRun(run);
  emit(listeners, { type: "run-completed", run: structuredClone(run) });
}

function saveRun(run: Run): void {
  const runs = read<Run[]>(RUNS_KEY, []);
  const index = runs.findIndex((item) => item.id === run.id);
  if (index === -1) runs.push(structuredClone(run));
  else runs[index] = structuredClone(run);
  write(RUNS_KEY, runs);
}

function emit(
  listeners: Set<(event: RunEvent) => void>,
  event: RunEvent,
): void {
  listeners.forEach((listener) => listener(event));
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function download(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function pickJsonFile(): Promise<Routine | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".acta,.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        const parsed = JSON.parse(await file.text()) as Routine;
        resolve({
          ...parsed,
          id: crypto.randomUUID(),
          name: `${parsed.name} (importada)`,
        });
      } catch {
        resolve(null);
      }
    };
    input.click();
  });
}
