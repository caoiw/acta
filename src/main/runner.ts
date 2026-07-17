import { mkdir } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import {
  chromium,
  type BrowserContext,
  type Locator as PlaywrightLocator,
  type Page,
} from "playwright-core";
import type {
  AtomicStep,
  Locator,
  RoutineStep,
  Run,
  RunEvent,
  RunItem,
  StartRunInput,
  StepRecord,
} from "../shared/types";
import {
  assertDomainAllowed,
  evaluateCondition,
  resolveBindingValue,
  summarizeItems,
} from "../shared/flow-utils";
import { LocalStore } from "./store";

interface ActiveRun {
  run: Run;
  input: StartRunInput;
  context: BrowserContext | null;
  page: Page | null;
  pauseRequested: boolean;
  cancelled: boolean;
  pauseResolver?: () => void;
  checkpointResolver?: () => void;
}

export class RunnerManager {
  private active: ActiveRun | null = null;

  constructor(
    private readonly userDataPath: string,
    private readonly store: LocalStore,
    private readonly emit: (event: RunEvent) => void,
    private readonly resolveSecret: (name: string) => string | null,
  ) {}

  async start(input: StartRunInput): Promise<{ runId: string }> {
    if (this.active) throw new Error("Já existe uma execução em andamento.");
    const rows = input.routine.dataSet?.rows ?? [{}];
    const requested = input.rowIndices?.length
      ? input.rowIndices.filter((index) => index >= 0 && index < rows.length)
      : rows.map((_, index) => index);
    const indices = input.mode === "test" ? requested.slice(0, 1) : requested;
    if (!indices.length)
      throw new Error("Não há registros válidos para executar.");

    const now = new Date().toISOString();
    const items: RunItem[] = indices.map((rowIndex) => {
      const row = rows[rowIndex] ?? {};
      const sensitive = new Set(input.routine.sensitiveColumns);
      const identityColumn = [
        "Nome",
        "nome",
        "Name",
        "name",
        "E-mail",
        "Email",
        "email",
      ].find((column) => row[column] !== undefined && !sensitive.has(column));
      const visibleValue = identityColumn
        ? row[identityColumn]
        : `Registro ${rowIndex + 1}`;
      const inputSnapshot = Object.fromEntries(
        Object.entries(row).map(([column, value]) => [
          column,
          sensitive.has(column) ? "[DADO PROTEGIDO]" : value,
        ]),
      );
      return {
        index: rowIndex,
        key: `registro-${rowIndex + 1}`,
        label: String(visibleValue),
        status: "pending",
        stepRecords: [],
        inputSnapshot,
      };
    });
    const run: Run = {
      id: crypto.randomUUID(),
      routineId: input.routine.id,
      routineName: input.routine.name,
      routineVersion: input.routine.version,
      mode: input.mode,
      status: "preparing",
      startedAt: now,
      domains: [...input.routine.domains],
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
    this.active = {
      run,
      input,
      context: null,
      page: null,
      pauseRequested: false,
      cancelled: false,
    };
    await this.store.saveRun(run);
    this.emit({ type: "run-started", run: structuredClone(run) });
    void this.execute().catch((error) => this.failRun(error));
    return { runId: run.id };
  }

  async pause(runId: string): Promise<void> {
    const active = this.requireActive(runId);
    if (active.run.status !== "running") return;
    active.pauseRequested = true;
    active.run.status = "pausing";
    await this.store.saveRun(active.run);
  }

  async resume(runId: string): Promise<void> {
    const active = this.requireActive(runId);
    active.pauseRequested = false;
    active.pauseResolver?.();
    active.pauseResolver = undefined;
  }

  async continueCheckpoint(runId: string): Promise<void> {
    const active = this.requireActive(runId);
    active.checkpointResolver?.();
    active.checkpointResolver = undefined;
  }

  async cancel(runId: string): Promise<void> {
    const active = this.requireActive(runId);
    active.cancelled = true;
    active.pauseRequested = false;
    active.pauseResolver?.();
    active.checkpointResolver?.();
    active.pauseResolver = undefined;
    active.checkpointResolver = undefined;
  }

  async dispose(): Promise<void> {
    if (!this.active) return;
    this.active.cancelled = true;
    await this.active.context?.close().catch(() => undefined);
    this.active = null;
  }

  private async execute(): Promise<void> {
    const active = this.active;
    if (!active) return;
    const profilePath = join(this.userDataPath, "browser-profiles", "runner");
    await mkdir(profilePath, { recursive: true });
    try {
      active.context = await chromium.launchPersistentContext(profilePath, {
        channel: active.input.routine.browserChannel,
        headless: false,
        viewport: null,
        args: ["--start-maximized"],
        locale: "pt-BR",
        acceptDownloads: true,
        serviceWorkers: "block",
      });
    } catch (error) {
      throw new Error(
        `Não foi possível abrir o navegador. Verifique se ${active.input.routine.browserChannel === "msedge" ? "o Microsoft Edge" : "o Google Chrome"} está instalado. ${this.errorText(error)}`,
      );
    }
    active.page = active.context.pages()[0] ?? (await active.context.newPage());
    await this.guardNavigations(active);
    active.run.status = "running";
    await this.store.saveRun(active.run);

    const rows = active.input.routine.dataSet?.rows ?? [{}];
    for (const item of active.run.items) {
      if (active.cancelled) break;
      await this.pauseBarrier(active);
      if (active.cancelled) break;
      const row = rows[item.index] ?? {};
      item.status = "running";
      item.startedAt = new Date().toISOString();
      this.emit({
        type: "item-started",
        runId: active.run.id,
        itemIndex: item.index,
      });

      try {
        for (const step of active.input.routine.steps) {
          if (!step.enabled) continue;
          if (active.cancelled) break;
          await this.pauseBarrier(active);
          await this.executeRoutineStep(active, item, row, step);
        }
        if (active.cancelled) {
          item.status = "cancelled";
        } else if (item.status === "running") {
          item.status = "success";
        }
      } catch (error) {
        item.status = "error";
        item.error = await this.buildError(active, item, error);
      }
      item.endedAt = new Date().toISOString();
      this.recalculate(active.run);
      await this.store.saveRun(active.run);
      this.emit({
        type: "item-completed",
        runId: active.run.id,
        item: structuredClone(item),
      });
    }

    if (active.cancelled) {
      for (const item of active.run.items) {
        if (item.status === "pending") item.status = "cancelled";
      }
      active.run.status = "cancelled";
    } else {
      active.run.status =
        active.run.summary.errors > 0 || active.run.summary.needsReview > 0
          ? "completed_with_errors"
          : "completed";
    }
    active.run.endedAt = new Date().toISOString();
    this.recalculate(active.run);
    await this.store.saveRun(active.run);
    await active.context.close().catch(() => undefined);
    this.emit({ type: "run-completed", run: structuredClone(active.run) });
    this.active = null;
  }

  private async executeRoutineStep(
    active: ActiveRun,
    item: RunItem,
    row: Record<string, string | number | boolean | null>,
    step: RoutineStep,
  ): Promise<void> {
    if (step.type === "condition") {
      const startedAt = new Date().toISOString();
      item.currentStepId = step.id;
      this.emit({
        type: "step-started",
        runId: active.run.id,
        itemIndex: item.index,
        stepId: step.id,
      });
      const matches = evaluateCondition(row, step.condition);
      const record: StepRecord = {
        stepId: step.id,
        label: step.label,
        status: matches ? "success" : "skipped",
        startedAt,
        endedAt: new Date().toISOString(),
        message: matches
          ? "Regra aplicada."
          : "A condição não se aplica a este registro.",
      };
      item.stepRecords.push(record);
      this.emit({
        type: "step-completed",
        runId: active.run.id,
        itemIndex: item.index,
        stepId: step.id,
        record,
      });
      const branch = matches ? step.thenSteps : (step.elseSteps ?? []);
      for (const nested of branch) {
        if (nested.enabled)
          await this.executeAtomicStep(active, item, row, nested);
      }
      return;
    }
    await this.executeAtomicStep(active, item, row, step);
  }

  private async executeAtomicStep(
    active: ActiveRun,
    item: RunItem,
    row: Record<string, string | number | boolean | null>,
    step: AtomicStep,
  ): Promise<void> {
    const page = active.page;
    if (!page) throw new Error("O navegador não está disponível.");
    const startedAt = new Date().toISOString();
    item.currentStepId = step.id;
    this.emit({
      type: "step-started",
      runId: active.run.id,
      itemIndex: item.index,
      stepId: step.id,
    });
    try {
      const timeout = step.timeoutMs ?? 15_000;
      switch (step.type) {
        case "open": {
          const url = resolveBindingValue(step.url, row, this.resolveSecret);
          assertDomainAllowed(url, active.input.routine.domains);
          await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: Math.max(timeout, 30_000),
          });
          break;
        }
        case "click":
          await this.getLocator(page, step.target).click({ timeout });
          break;
        case "fill":
          await this.getLocator(page, step.target).fill(
            resolveBindingValue(step.value, row, this.resolveSecret),
            { timeout },
          );
          break;
        case "select":
          await this.getLocator(page, step.target).selectOption(
            { label: resolveBindingValue(step.value, row, this.resolveSecret) },
            { timeout },
          );
          break;
        case "check":
          await this.getLocator(page, step.target).check({ timeout });
          break;
        case "verify":
          await this.getLocator(page, step.target).waitFor({
            state: "visible",
            timeout,
          });
          break;
        case "wait":
          await page.waitForTimeout(step.durationMs);
          break;
        case "checkpoint":
          await this.checkpointBarrier(active, item, step.id, step.message);
          break;
        case "screenshot": {
          const directory = join(
            this.userDataPath,
            "runs",
            active.run.id,
            "screenshots",
          );
          await mkdir(directory, { recursive: true });
          const target = resolve(
            directory,
            step.fileName ?? `${item.index + 1}-${step.id}.png`,
          );
          const relation = relative(resolve(directory), target);
          if (!relation || relation.startsWith("..") || isAbsolute(relation)) {
            throw new Error("Nome de evidência inválido.");
          }
          await this.captureSafeScreenshot(page, target);
          break;
        }
      }
      assertDomainAllowed(page.url(), active.input.routine.domains);
      const record: StepRecord = {
        stepId: step.id,
        label: step.label,
        status: "success",
        startedAt,
        endedAt: new Date().toISOString(),
      };
      item.stepRecords.push(record);
      this.emit({
        type: "step-completed",
        runId: active.run.id,
        itemIndex: item.index,
        stepId: step.id,
        record,
      });
    } catch (error) {
      const safeMessage = this.safeStepError(active, row, step, error);
      const record: StepRecord = {
        stepId: step.id,
        label: step.label,
        status: "error",
        startedAt,
        endedAt: new Date().toISOString(),
        message: safeMessage,
      };
      item.stepRecords.push(record);
      this.emit({
        type: "step-completed",
        runId: active.run.id,
        itemIndex: item.index,
        stepId: step.id,
        record,
      });
      if (step.continueOnError) {
        item.status = "needs_review";
        return;
      }
      throw Object.assign(new Error(safeMessage), {
        stepId: step.id,
      });
    }
  }

  private getLocator(page: Page, target: Locator): PlaywrightLocator {
    switch (target.strategy) {
      case "role":
        return page.getByRole(target.role as never, {
          name: target.value,
          exact: target.exact,
        });
      case "label":
        return page.getByLabel(target.value, { exact: target.exact });
      case "text":
        return page.getByText(target.value, { exact: target.exact });
      case "placeholder":
        return page.getByPlaceholder(target.value, { exact: target.exact });
      case "testId":
        return page.getByTestId(target.value);
      case "css":
        return page.locator(target.value);
    }
  }

  private async pauseBarrier(active: ActiveRun): Promise<void> {
    if (!active.pauseRequested) return;
    active.run.status = "paused";
    await this.store.saveRun(active.run);
    this.emit({ type: "run-paused", runId: active.run.id });
    await new Promise<void>((resolve) => {
      active.pauseResolver = resolve;
    });
    if (active.cancelled) return;
    active.run.status = "running";
    await this.store.saveRun(active.run);
    this.emit({ type: "run-resumed", runId: active.run.id });
  }

  private async checkpointBarrier(
    active: ActiveRun,
    item: RunItem,
    stepId: string,
    message: string,
  ): Promise<void> {
    active.run.status = "waiting";
    await this.store.saveRun(active.run);
    this.emit({
      type: "checkpoint",
      runId: active.run.id,
      itemIndex: item.index,
      stepId,
      message,
    });
    await new Promise<void>((resolve) => {
      active.checkpointResolver = resolve;
    });
    if (!active.cancelled) active.run.status = "running";
  }

  private async guardNavigations(active: ActiveRun): Promise<void> {
    const context = active.context;
    if (!context) return;
    await context.route("**/*", async (route) => {
      const request = route.request();
      if (/^https?:/i.test(request.url())) {
        try {
          assertDomainAllowed(request.url(), active.input.routine.domains);
        } catch {
          await route.abort("blockedbyclient");
          return;
        }
      }
      await route.continue();
    });
    await context.routeWebSocket("**/*", async (webSocket) => {
      const parsed = new URL(webSocket.url());
      const networkUrl = `${parsed.protocol === "wss:" ? "https:" : "http:"}//${parsed.host}`;
      try {
        assertDomainAllowed(networkUrl, active.input.routine.domains);
        webSocket.connectToServer();
      } catch {
        await webSocket.close({ code: 1008, reason: "Domínio não autorizado" });
      }
    });
    context.on("page", (page) => {
      page.on("framenavigated", (frame) => {
        if (frame !== page.mainFrame()) return;
        try {
          assertDomainAllowed(frame.url(), active.input.routine.domains);
        } catch {
          void page.close();
        }
      });
    });
  }

  private async buildError(
    active: ActiveRun,
    item: RunItem,
    error: unknown,
  ): Promise<NonNullable<RunItem["error"]>> {
    const message = this.errorText(error);
    let kind: NonNullable<RunItem["error"]>["kind"] = "unknown";
    let title = "Não foi possível concluir este registro";
    if (/strict mode violation|resolved to \d+ elements/i.test(message)) {
      kind = "multiple_matches";
      title = "Encontramos mais de um elemento correspondente";
    } else if (/timeout|waiting for|getBy|locator/i.test(message)) {
      kind = "not_found";
      title = "Não encontramos o elemento esperado";
    } else if (/coluna|vazia|valor/i.test(message)) {
      kind = "invalid_data";
      title = "O registro possui um dado inválido ou ausente";
    } else if (/domínio|blockedbyclient|ERR_FAILED/i.test(message)) {
      kind = "domain_blocked";
      title = "A navegação foi bloqueada pela política da automação";
    } else if (/navegador|browser/i.test(message)) {
      kind = "browser_unavailable";
      title = "O navegador não está disponível";
    }

    let screenshotPath: string | undefined;
    if (active.page && !active.page.isClosed()) {
      try {
        const directory = join(
          this.userDataPath,
          "runs",
          active.run.id,
          "screenshots",
        );
        await mkdir(directory, { recursive: true });
        screenshotPath = join(directory, `erro-registro-${item.index + 1}.png`);
        await this.captureSafeScreenshot(active.page, screenshotPath);
      } catch {
        screenshotPath = undefined;
      }
    }
    return {
      kind,
      title,
      message: this.humanizeMessage(message),
      stepId: (error as { stepId?: string })?.stepId ?? item.currentStepId,
      screenshotPath,
    };
  }

  private humanizeMessage(message: string): string {
    if (/timeout|waiting for/i.test(message)) {
      return "A página pode ter mudado ou o elemento demorou mais do que o esperado. Revise o passo e tente novamente.";
    }
    if (/coluna.*vazia/i.test(message)) return message;
    if (/domínio|blockedbyclient/i.test(message)) {
      return "O site tentou abrir um endereço que não está na lista de domínios permitidos.";
    }
    return message.split("\n")[0].slice(0, 320);
  }

  private async captureSafeScreenshot(page: Page, path: string): Promise<void> {
    await page.screenshot({
      path,
      fullPage: false,
      mask: [
        page.locator(
          'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
        ),
      ],
      maskColor: "#1f2937",
    });
  }

  private safeStepError(
    active: ActiveRun,
    row: Record<string, string | number | boolean | null>,
    step: AtomicStep,
    error: unknown,
  ): string {
    const raw = this.errorText(error);
    const binding =
      "value" in step ? step.value : step.type === "open" ? step.url : null;
    if (!binding) return raw;
    const sensitive =
      binding.kind === "secret" ||
      binding.sensitive === true ||
      (binding.kind === "column" &&
        active.input.routine.sensitiveColumns.includes(binding.value));
    if (!sensitive || /não está disponível no cofre/i.test(raw)) return raw;
    if (/timeout|waiting for|getBy|locator/i.test(raw)) {
      return "Timeout ao localizar ou preencher um campo com dado protegido.";
    }
    if (/strict mode violation|resolved to \d+ elements/i.test(raw)) {
      return "Strict mode violation: mais de um campo corresponde ao passo com dado protegido.";
    }
    if (binding.kind === "column" && !row[binding.value]) {
      return `A coluna sensível “${binding.value}” está vazia neste registro.`;
    }
    return "Não foi possível usar o valor protegido neste passo.";
  }

  private recalculate(run: Run): void {
    run.summary = summarizeItems(run.items);
  }

  private requireActive(runId: string): ActiveRun {
    if (!this.active || this.active.run.id !== runId)
      throw new Error("Esta execução não está mais ativa.");
    return this.active;
  }

  private async failRun(error: unknown): Promise<void> {
    const active = this.active;
    if (!active) return;
    active.run.status = "failed";
    active.run.endedAt = new Date().toISOString();
    const firstPending = active.run.items.find(
      (item) => item.status === "pending",
    );
    if (firstPending) {
      firstPending.status = "error";
      firstPending.error = await this.buildError(active, firstPending, error);
      firstPending.endedAt = new Date().toISOString();
    }
    this.recalculate(active.run);
    await this.store.saveRun(active.run);
    await active.context?.close().catch(() => undefined);
    this.emit({ type: "run-completed", run: structuredClone(active.run) });
    this.active = null;
  }

  private errorText(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
