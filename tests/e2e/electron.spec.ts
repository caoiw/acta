import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page,
} from "@playwright/test";

test.describe.serial("Electron real + Edge", () => {
  test.skip(process.platform !== "win32", "O MVP atual é Windows-first.");
  test.setTimeout(120_000);

  let app: ElectronApplication;
  let page: Page;
  let dataDirectory: string;

  const launch = async (): Promise<void> => {
    const projectRoot = process.cwd();
    app = await electron.launch({
      executablePath: join(
        projectRoot,
        "node_modules",
        "electron",
        "dist",
        "electron.exe",
      ),
      args: [join(projectRoot, "out", "main", "index.js")],
      cwd: projectRoot,
      env: {
        ...process.env,
        ACTA_E2E: "1",
        ACTA_E2E_DATA_DIR: dataDirectory,
      },
    });
    page = await app.firstWindow();
    await expect(
      page.getByRole("heading", { name: /Transforme tarefas repetitivas/i }),
    ).toBeVisible();
  };

  test.beforeAll(async () => {
    dataDirectory = await mkdtemp(join(tmpdir(), "acta-e2e-"));
    await launch();
  });

  test.afterAll(async () => {
    await app?.close().catch(() => undefined);
    if (
      dataDirectory?.startsWith(tmpdir()) &&
      dataDirectory.includes("acta-e2e-")
    ) {
      await rm(dataDirectory, { recursive: true, force: true });
    }
  });

  test("mantém o renderer isolado e permissões negadas", async () => {
    const preferences = await app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      return window.webContents.getLastWebPreferences();
    });
    expect(preferences.nodeIntegration).toBe(false);
    expect(preferences.contextIsolation).toBe(true);
    expect(preferences.sandbox).toBe(true);
    expect(preferences.webSecurity).not.toBe(false);
  });

  test("executa o caso vertical de uma linha no portal local", async () => {
    await page.getByRole("button", { name: "Testar uma linha" }).click();
    await expect(
      page.getByRole("heading", { name: "Testar uma linha" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Iniciar teste" }).click();
    await expect(page.getByText(/1 de 1 registros/)).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByRole("button", { name: "Ver relatório" }),
    ).toBeVisible({ timeout: 35_000 });
    await page.getByRole("button", { name: "Ver relatório" }).click();
    await expect(
      page.getByRole("heading", { name: "Tudo concluído" }),
    ).toBeVisible();
    await expect(page.getByText("1", { exact: true }).first()).toBeVisible();

    const encrypted = await readFile(
      join(dataDirectory, "acta-data.secure"),
      "utf8",
    );
    expect(encrypted).not.toContain("Ana Martins");
    expect(encrypted).not.toContain("@empresa.com");
  });

  test("reabre o histórico persistido no mesmo perfil protegido", async () => {
    await app.close();
    await launch();
    await page.getByRole("button", { name: "Execuções" }).click();
    await expect(page.getByText("Cadastro de colaboradores")).toBeVisible();
    await expect(page.getByText("Teste · 1 linha")).toBeVisible();
  });
});
