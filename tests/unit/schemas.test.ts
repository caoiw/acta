import { describe, expect, it } from "vitest";
import {
  AtomicStepSchema,
  RecorderPayloadSchema,
  RoutineSchema,
} from "../../src/shared/schemas";
import { createExampleRoutine } from "../../src/renderer/src/lib/defaults";

describe("schemas declarativos", () => {
  it("aceita a rotina vertical do portal de treinamento", () => {
    const routine = createExampleRoutine(
      "http://127.0.0.1:43111/colaboradores",
    );
    expect(RoutineSchema.parse(routine).steps.length).toBeGreaterThan(5);
  });

  it("rejeita código livre, campos desconhecidos e timeout excessivo", () => {
    const base = {
      id: "step_1",
      label: "Executar script",
      enabled: true,
      risk: "low",
    };
    expect(() =>
      AtomicStepSchema.parse({
        ...base,
        type: "script",
        code: "process.exit()",
      }),
    ).toThrow();
    expect(() =>
      AtomicStepSchema.parse({
        ...base,
        type: "wait",
        durationMs: 1000,
        code: "alert(1)",
      }),
    ).toThrow();
    expect(() =>
      AtomicStepSchema.parse({ ...base, type: "wait", durationMs: 130_000 }),
    ).toThrow();
  });

  it("rejeita travessia de diretório em screenshots", () => {
    expect(() =>
      AtomicStepSchema.parse({
        id: "step_1",
        type: "screenshot",
        label: "Evidência",
        enabled: true,
        risk: "low",
        fileName: "..\\..\\acta-data.secure",
      }),
    ).toThrow();
  });

  it("limita payloads controlados pela página gravada", () => {
    expect(
      RecorderPayloadSchema.safeParse({
        kind: "fill",
        target: { strategy: "label", value: "Nome" },
        value: "x".repeat(10_001),
      }).success,
    ).toBe(false);
  });
});
