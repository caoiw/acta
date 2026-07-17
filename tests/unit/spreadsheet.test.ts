import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { afterEach, describe, expect, it } from "vitest";
import { readSpreadsheet } from "../../src/main/spreadsheet";

const temporaryPaths: string[] = [];

afterEach(async () => {
  for (const path of temporaryPaths.splice(0)) {
    if (path.startsWith(tmpdir()) && path.includes("acta-sheet-test-")) {
      await rm(path, { recursive: true, force: true });
    }
  }
});

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "acta-sheet-test-"));
  temporaryPaths.push(directory);
  return directory;
}

describe("importação segura de planilhas", () => {
  it("lê CSV brasileiro com ponto e vírgula", async () => {
    const directory = await temporaryDirectory();
    const path = join(directory, "colaboradores.csv");
    await writeFile(
      path,
      "\ufeffNome;E-mail;Cargo\r\nAna;ana@empresa.com;Motorista\r\nBruno;bruno@empresa.com;Gestor",
      "utf8",
    );

    const dataSet = await readSpreadsheet(path);
    expect(dataSet.columns).toEqual(["Nome", "E-mail", "Cargo"]);
    expect(dataSet.rows).toHaveLength(2);
    expect(dataSet.rows[1].Cargo).toBe("Gestor");
  });

  it("lê a primeira aba de um XLSX", async () => {
    const directory = await temporaryDirectory();
    const path = join(directory, "fornecedores.xlsx");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Fornecedores");
    sheet.addRow(["Razão social", "CNPJ"]);
    sheet.addRow(["Empresa Exemplo", "00.000.000/0001-00"]);
    await workbook.xlsx.writeFile(path);

    const dataSet = await readSpreadsheet(path);
    expect(dataSet.sheetName).toBe("Fornecedores");
    expect(dataSet.rows[0]["Razão social"]).toBe("Empresa Exemplo");
  });

  it("rejeita cabeçalhos duplicados e o formato XLS legado", async () => {
    const directory = await temporaryDirectory();
    const duplicate = join(directory, "duplicado.csv");
    await writeFile(duplicate, "Nome;nome\r\nAna;Outra", "utf8");
    await expect(readSpreadsheet(duplicate)).rejects.toThrow(/duas colunas/i);

    const legacy = join(directory, "legado.xls");
    await writeFile(legacy, "arquivo legado", "utf8");
    await expect(readSpreadsheet(legacy)).rejects.toThrow(/CSV ou XLSX/i);
  });
});
