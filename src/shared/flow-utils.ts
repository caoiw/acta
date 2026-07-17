import type { Routine, RoutineStep, RunItem, ValueBinding } from "./types";

export function isDomainAllowed(rawUrl: string, domains: string[]): boolean {
  if (rawUrl === "about:blank") return true;
  try {
    const url = new URL(rawUrl);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    const host = url.hostname.toLowerCase();
    return domains.some((domain) => {
      const normalized = domain.toLowerCase().replace(/^\*\./, "");
      return host === normalized || host.endsWith(`.${normalized}`);
    });
  } catch {
    return false;
  }
}

export function assertDomainAllowed(rawUrl: string, domains: string[]): void {
  if (!isDomainAllowed(rawUrl, domains)) {
    let target = rawUrl;
    try {
      target = new URL(rawUrl).hostname || new URL(rawUrl).protocol;
    } catch {
      // Keep the original value for a useful validation error.
    }
    throw new Error(`Acesso bloqueado ao endereço não autorizado “${target}”.`);
  }
}

export function evaluateCondition(
  row: Record<string, string | number | boolean | null>,
  condition: { column: string; operator: string; value?: string },
): boolean {
  const raw = row[condition.column];
  const left = raw === undefined || raw === null ? "" : String(raw).trim();
  const right = String(condition.value ?? "").trim();
  switch (condition.operator) {
    case "equals":
      return (
        left.localeCompare(right, "pt-BR", { sensitivity: "accent" }) === 0
      );
    case "not_equals":
      return (
        left.localeCompare(right, "pt-BR", { sensitivity: "accent" }) !== 0
      );
    case "contains":
      return left
        .toLocaleLowerCase("pt-BR")
        .includes(right.toLocaleLowerCase("pt-BR"));
    case "empty":
      return left.length === 0;
    case "not_empty":
      return left.length > 0;
    default:
      return false;
  }
}

export function resolveBindingValue(
  binding: ValueBinding,
  row: Record<string, string | number | boolean | null>,
  resolveSecret: (name: string) => string | null = () => null,
): string {
  if (binding.kind === "fixed") return binding.value;
  if (binding.kind === "column") {
    const value = row[binding.value];
    if (value === undefined || value === null || value === "") {
      throw new Error(`A coluna “${binding.value}” está vazia neste registro.`);
    }
    return String(value);
  }
  if (binding.kind === "secret") {
    const value = resolveSecret(binding.value);
    if (!value)
      throw new Error(
        `A credencial “${binding.value}” não está disponível no cofre.`,
      );
    return value;
  }
  throw new Error(
    `O valor “${binding.value}” precisa ser informado antes da execução.`,
  );
}

export function validateRoutineForRun(
  routine: Routine,
): Array<{ stepId: string; message: string }> {
  const issues = new Map<string, string>();
  const columns = new Set(routine.dataSet?.columns ?? []);
  if (routine.dataSet?.issues.length) {
    issues.set(
      "__data",
      `Corrija a planilha antes de executar: ${routine.dataSet.issues[0]}`,
    );
  }
  for (const step of flattenRoutineSteps(routine.steps)) {
    if (!step.label.trim())
      issues.set(step.id, "Dê um nome claro para este passo.");
    if ("target" in step && !step.target.value.trim())
      issues.set(step.id, "Informe qual elemento deve ser encontrado.");
    if (
      "value" in step &&
      step.value.kind === "column" &&
      !columns.has(step.value.value)
    ) {
      issues.set(step.id, `Escolha uma coluna válida para “${step.label}”.`);
    }
    if ("value" in step && !step.value.value.trim())
      issues.set(step.id, `Defina o valor usado em “${step.label}”.`);
    if ("value" in step && step.value.kind === "prompt") {
      issues.set(
        step.id,
        `Troque “Perguntar ao executar” em “${step.label}”; essa entrada ainda não faz parte deste MVP.`,
      );
    }
    if (step.type === "open" && step.url.kind === "prompt") {
      issues.set(
        step.id,
        `Defina um endereço fixo, uma coluna ou um segredo em “${step.label}”.`,
      );
    }
    if (
      step.type === "condition" &&
      (!step.condition.column || !columns.has(step.condition.column))
    ) {
      issues.set(step.id, `Escolha a coluna usada na regra “${step.label}”.`);
    }
  }
  if (!routine.steps.some((step) => step.type === "verify")) {
    issues.set(
      "__verify",
      "Adicione um passo “Verificar resultado” ao final da rotina.",
    );
  }
  return [...issues.entries()].map(([stepId, message]) => ({
    stepId,
    message,
  }));
}

export function routineDefinitionForExport(routine: Routine): Routine {
  return {
    ...structuredClone(routine),
    dataSet: routine.dataSet
      ? {
          ...structuredClone(routine.dataSet),
          rows: [],
          issues: [
            "Conecte a planilha que será usada neste computador antes de executar.",
          ],
        }
      : undefined,
    status: "draft",
    lastTestedAt: undefined,
  };
}

export function escapeCsvCell(value: unknown): string {
  const text = String(value ?? "");
  const safe = /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function flattenRoutineSteps(steps: RoutineStep[]): RoutineStep[] {
  return steps.flatMap((step) =>
    step.type === "condition"
      ? [step, ...step.thenSteps, ...(step.elseSteps ?? [])]
      : [step],
  );
}

export function summarizeItems(items: RunItem[]) {
  return {
    total: items.length,
    processed: items.filter(
      (item) => !["pending", "cancelled"].includes(item.status),
    ).length,
    success: items.filter((item) => item.status === "success").length,
    skipped: items.filter((item) => item.status === "skipped").length,
    errors: items.filter((item) => item.status === "error").length,
    needsReview: items.filter((item) => item.status === "needs_review").length,
  };
}
