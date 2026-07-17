import { readFile, stat } from "node:fs/promises";
import { basename, extname } from "node:path";
import ExcelJS from "exceljs";
import type { DataSet } from "../shared/types";

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_ROWS = 50_000;
const MAX_COLUMNS = 200;

export async function readSpreadsheet(filePath: string): Promise<DataSet> {
  const metadata = await stat(filePath);
  if (!metadata.isFile() || metadata.size > MAX_FILE_SIZE) {
    throw new Error("Escolha uma planilha de até 25 MB.");
  }
  const extension = extname(filePath).toLowerCase();
  if (![".xlsx", ".csv"].includes(extension)) {
    throw new Error("Use um arquivo CSV ou XLSX.");
  }

  const workbook = new ExcelJS.Workbook();
  let sheet: ExcelJS.Worksheet;
  if (extension === ".csv") {
    const sample = await readFile(filePath, "utf8");
    const firstLine = sample.split(/\r?\n/, 1)[0] ?? "";
    const semicolons = (firstLine.match(/;/g) ?? []).length;
    const commas = (firstLine.match(/,/g) ?? []).length;
    sheet = await workbook.csv.readFile(filePath, {
      parserOptions: { delimiter: semicolons > commas ? ";" : "," },
    });
  } else {
    await workbook.xlsx.readFile(filePath);
    const firstSheet = workbook.worksheets[0];
    if (!firstSheet)
      throw new Error("A planilha não possui nenhuma aba legível.");
    sheet = firstSheet;
  }

  if (!sheet.actualRowCount) throw new Error("A planilha está vazia.");
  if (
    sheet.actualRowCount > MAX_ROWS + 1 ||
    sheet.actualColumnCount > MAX_COLUMNS
  ) {
    throw new Error(
      `O MVP aceita até ${MAX_ROWS.toLocaleString("pt-BR")} registros e ${MAX_COLUMNS} colunas por planilha.`,
    );
  }
  const columnCount = Math.max(
    sheet.getRow(1).cellCount,
    sheet.actualColumnCount,
  );
  const columns = Array.from({ length: columnCount }, (_, index) =>
    sheet
      .getRow(1)
      .getCell(index + 1)
      .text.trim(),
  );
  if (!columns.some(Boolean)) {
    throw new Error("Não encontramos os nomes das colunas na primeira linha.");
  }

  const issues: string[] = [];
  const seen = new Set<string>();
  for (const column of columns) {
    const normalized = column.toLocaleLowerCase("pt-BR");
    if (!column) issues.push("Há uma coluna sem nome.");
    else if (seen.has(normalized))
      issues.push(`Existem duas colunas chamadas “${column}”.`);
    seen.add(normalized);
  }
  if (issues.length) throw new Error(issues.join(" "));

  const rows: DataSet["rows"] = [];
  for (let rowIndex = 2; rowIndex <= sheet.actualRowCount; rowIndex += 1) {
    const values = columns.map((_, index) =>
      sheet
        .getRow(rowIndex)
        .getCell(index + 1)
        .text.trim(),
    );
    if (!values.some(Boolean)) continue;
    rows.push(
      Object.fromEntries(
        columns.map((column, index) => [column, values[index] ?? ""]),
      ),
    );
  }
  if (!rows.length)
    issues.push("A planilha não possui registros abaixo do cabeçalho.");
  return {
    id: crypto.randomUUID(),
    fileName: basename(filePath),
    sheetName: sheet.name || (extension === ".csv" ? "CSV" : "Planilha"),
    columns,
    rows,
    importedAt: new Date().toISOString(),
    issues,
  };
}
