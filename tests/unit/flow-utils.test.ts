import { describe, expect, it } from "vitest";
import {
  assertDomainAllowed,
  evaluateCondition,
  escapeCsvCell,
  isDomainAllowed,
  resolveBindingValue,
  routineDefinitionForExport,
  summarizeItems,
  validateRoutineForRun,
} from "../../src/shared/flow-utils";
import { createExampleRoutine } from "../../src/renderer/src/lib/defaults";
import type { RunItem } from "../../src/shared/types";

describe("política de domínio", () => {
  it("aceita o host declarado e seus subdomínios", () => {
    expect(
      isDomainAllowed("https://portal.empresa.com/cadastro", ["empresa.com"]),
    ).toBe(true);
    expect(isDomainAllowed("https://empresa.com", ["empresa.com"])).toBe(true);
  });

  it("rejeita sufixos maliciosos e protocolos locais", () => {
    expect(
      isDomainAllowed("https://empresa.com.evil.test", ["empresa.com"]),
    ).toBe(false);
    expect(isDomainAllowed("https://evil-empresa.com", ["empresa.com"])).toBe(
      false,
    );
    expect(isDomainAllowed("file:///C:/segredo.txt", ["empresa.com"])).toBe(
      false,
    );
    expect(isDomainAllowed("javascript:alert(1)", ["empresa.com"])).toBe(false);
    expect(() =>
      assertDomainAllowed("https://evil.test", ["empresa.com"]),
    ).toThrow(/bloqueado/i);
  });
});

describe("dados e regras", () => {
  const row = { Nome: "Ana", Cargo: "Motorista", Vazio: "" };

  it("avalia os operadores humanos do MVP", () => {
    expect(
      evaluateCondition(row, {
        column: "Cargo",
        operator: "equals",
        value: "Motorista",
      }),
    ).toBe(true);
    expect(
      evaluateCondition(row, {
        column: "Cargo",
        operator: "not_equals",
        value: "Gestor",
      }),
    ).toBe(true);
    expect(
      evaluateCondition(row, {
        column: "Cargo",
        operator: "contains",
        value: "motor",
      }),
    ).toBe(true);
    expect(evaluateCondition(row, { column: "Vazio", operator: "empty" })).toBe(
      true,
    );
    expect(
      evaluateCondition(row, { column: "Nome", operator: "not_empty" }),
    ).toBe(true);
  });

  it("resolve valores sem vazar segredos ausentes", () => {
    expect(resolveBindingValue({ kind: "column", value: "Nome" }, row)).toBe(
      "Ana",
    );
    expect(resolveBindingValue({ kind: "fixed", value: "Ativo" }, row)).toBe(
      "Ativo",
    );
    expect(
      resolveBindingValue(
        { kind: "secret", value: "Portal" },
        row,
        () => "segredo",
      ),
    ).toBe("segredo");
    expect(() =>
      resolveBindingValue({ kind: "secret", value: "Portal" }, row),
    ).toThrow(/Portal.*cofre/i);
    expect(() =>
      resolveBindingValue({ kind: "column", value: "Vazio" }, row),
    ).toThrow(/coluna.*vazia/i);
  });

  it("neutraliza fórmulas e preserva escaping na exportação CSV", () => {
    expect(escapeCsvCell('=HYPERLINK("https://evil.test")')).toBe(
      '"\'=HYPERLINK(""https://evil.test"")"',
    );
    expect(escapeCsvCell("Texto normal")).toBe('"Texto normal"');
  });
});

describe("validação e resumo", () => {
  it("exige verificação final e colunas existentes", () => {
    const routine = createExampleRoutine("http://127.0.0.1:3000/colaboradores");
    routine.steps = routine.steps.filter((step) => step.type !== "verify");
    const fill = routine.steps.find((step) => step.type === "fill");
    if (fill?.type === "fill")
      fill.value = { kind: "column", value: "Inexistente" };
    const issues = validateRoutineForRun(routine);
    expect(issues.some((issue) => issue.stepId === "__verify")).toBe(true);
    expect(
      issues.some((issue) => issue.message.includes("coluna válida")),
    ).toBe(true);
  });

  it("valida passos aninhados e bloqueia entradas ainda não suportadas", () => {
    const routine = createExampleRoutine("http://127.0.0.1:3000/colaboradores");
    const condition = routine.steps.find((step) => step.type === "condition");
    if (condition?.type === "condition") {
      condition.thenSteps.push({
        id: "nested-prompt",
        type: "fill",
        label: "Preencher valor solicitado",
        enabled: true,
        risk: "medium",
        target: { strategy: "label", value: "Código", exact: true },
        value: { kind: "prompt", value: "Código" },
      });
    }
    const issues = validateRoutineForRun(routine);
    expect(issues.some((issue) => issue.stepId === "nested-prompt")).toBe(true);
    expect(
      issues.some((issue) => issue.message.includes("não faz parte deste MVP")),
    ).toBe(true);
  });

  it("exporta apenas a definição, sem linhas da planilha ou aprovação anterior", () => {
    const routine = createExampleRoutine("http://127.0.0.1:3000/colaboradores");
    routine.status = "ready";
    routine.lastTestedAt = new Date().toISOString();
    const exported = routineDefinitionForExport(routine);
    expect(exported.dataSet?.rows).toEqual([]);
    expect(exported.status).toBe("draft");
    expect(exported.lastTestedAt).toBeUndefined();
    expect(JSON.stringify(exported)).not.toContain("@empresa.com");
  });

  it("não conta itens cancelados como processados", () => {
    const statuses: RunItem["status"][] = [
      "success",
      "error",
      "needs_review",
      "skipped",
      "cancelled",
      "pending",
    ];
    const items = statuses.map((status, index) => ({
      index,
      key: String(index),
      label: String(index),
      status,
      stepRecords: [],
    })) as RunItem[];
    expect(summarizeItems(items)).toEqual({
      total: 6,
      processed: 4,
      success: 1,
      skipped: 1,
      errors: 1,
      needsReview: 1,
    });
  });
});
