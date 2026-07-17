import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const reviewDirectory = resolve("artifacts", "ui-review");

test("registra as telas centrais para revisão visual", async ({ page }) => {
  await mkdir(reviewDirectory, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("http://127.0.0.1:5174");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await expect(
    page.getByRole("heading", { name: /Transforme tarefas repetitivas/i }),
  ).toBeVisible();
  await page.screenshot({
    path: resolve(reviewDirectory, "01-dashboard-1440.png"),
  });

  await page.getByRole("button", { name: "Editar" }).first().click();
  await expect(page.getByText("Configurar passo")).toBeVisible();
  await page.screenshot({
    path: resolve(reviewDirectory, "02-editor-1440.png"),
  });

  await page.getByRole("button", { name: "Testar 1 linha" }).click();
  await expect(
    page.getByRole("heading", { name: "Testar uma linha" }),
  ).toBeVisible();
  await page.screenshot({
    path: resolve(reviewDirectory, "03-preflight-1440.png"),
  });

  await page.getByRole("button", { name: "Iniciar teste" }).click();
  await expect(page.locator(".runner-page")).toBeVisible();
  await page.screenshot({
    path: resolve(reviewDirectory, "04-runner-1440.png"),
  });
  await expect(page.getByRole("button", { name: "Ver relatório" })).toBeVisible(
    { timeout: 10_000 },
  );
  await page.getByRole("button", { name: "Ver relatório" }).click();
  await expect(
    page.getByRole("heading", { name: "Tudo concluído" }),
  ).toBeVisible();
  await page.screenshot({
    path: resolve(reviewDirectory, "05-report-1440.png"),
  });

  await page.getByRole("button", { name: "Configurações" }).click();
  await expect(
    page.getByRole("heading", { name: "Configurações" }),
  ).toBeVisible();
  await page.screenshot({
    path: resolve(reviewDirectory, "06-settings-1440.png"),
  });

  await page.setViewportSize({ width: 1024, height: 720 });
  await page.getByRole("button", { name: "Automações" }).click();
  await page.getByRole("button", { name: "Editar" }).first().click();
  await expect(page.getByText("Configurar passo")).toBeVisible();
  await page.screenshot({
    path: resolve(reviewDirectory, "07-editor-1024.png"),
  });
});
