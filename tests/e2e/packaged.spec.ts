import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";

const executablePath = join(
  process.cwd(),
  "release",
  "win-unpacked",
  "Acta.exe",
);

test("o executável Windows empacotado inicia com isolamento", async () => {
  test.skip(process.platform !== "win32", "O MVP atual é Windows-first.");
  test.skip(
    !existsSync(executablePath),
    "Gere o pacote com npm run package:win.",
  );
  test.setTimeout(60_000);

  const dataDirectory = await mkdtemp(join(tmpdir(), "acta-e2e-packaged-"));
  const app = await electron.launch({
    executablePath,
    env: {
      ...process.env,
      ACTA_E2E: "1",
      ACTA_E2E_DATA_DIR: dataDirectory,
    },
  });
  try {
    const page = await app.firstWindow();
    await expect(
      page.getByRole("heading", { name: /Transforme tarefas repetitivas/i }),
    ).toBeVisible();
    const preferences = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences(),
    );
    expect(preferences.nodeIntegration).toBe(false);
    expect(preferences.contextIsolation).toBe(true);
    expect(preferences.sandbox).toBe(true);
  } finally {
    await app.close().catch(() => undefined);
    await rm(dataDirectory, { recursive: true, force: true });
  }
});
