import { describe, expect, it } from "vitest";
import {
  createDemoDataSet,
  createExampleRoutine,
} from "../../src/renderer/src/lib/defaults";

describe("exemplo guiado", () => {
  it("entrega 20 registros fictícios e colunas corporativas", () => {
    const data = createDemoDataSet();
    expect(data.rows).toHaveLength(20);
    expect(data.columns).toEqual(["Nome", "E-mail", "Cargo", "Departamento"]);
    expect(new Set(data.rows.map((row) => row["E-mail"])).size).toBe(20);
  });

  it("começa como rascunho e contém regras e validação final", () => {
    const routine = createExampleRoutine("http://127.0.0.1:4567/colaboradores");
    expect(routine.status).toBe("draft");
    expect(routine.domains).toEqual(["127.0.0.1"]);
    expect(
      routine.steps.filter((step) => step.type === "condition"),
    ).toHaveLength(2);
    expect(routine.steps.at(-1)?.type).toBe("verify");
    expect(routine.sensitiveColumns).toContain("E-mail");
  });
});
