import { expect, test } from "@playwright/test";

for (const width of [1024, 1280, 1440]) {
  test.describe(`layout ${width}px`, () => {
    test.use({ viewport: { width, height: 720 } });

    test.beforeEach(async ({ page }) => {
      await page.goto("http://127.0.0.1:5174");
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await expect(
        page.getByRole("heading", { name: /Transforme tarefas repetitivas/i }),
      ).toBeVisible();
    });

    test("dashboard não cria overflow horizontal", async ({ page }) => {
      const dimensions = await page.evaluate(() => ({
        viewport: window.innerWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
      }));
      expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
      expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport);
      await expect(
        page.getByRole("button", { name: "Nova automação" }),
      ).toBeVisible();
    });

    test("editor mantém timeline e inspector acessíveis", async ({ page }) => {
      await page.getByRole("button", { name: "Editar" }).first().click();
      await expect(
        page.getByText("Para cada linha de Colaboradores"),
      ).toBeVisible();
      await expect(page.getByText("Configurar passo")).toBeVisible();
      const boxes = await page.locator(".editor-grid").evaluate((element) => ({
        client: element.clientWidth,
        scroll: element.scrollWidth,
      }));
      expect(boxes.scroll).toBeLessThanOrEqual(boxes.client);
      await page.getByRole("button", { name: /Preencha “Nome”/ }).focus();
      await expect(
        page.getByRole("button", { name: /Preencha “Nome”/ }),
      ).toBeFocused();
    });
  });
}

test("criação comunica com honestidade o que ainda não está disponível", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:5174");
  await page.getByRole("button", { name: "Nova automação" }).click();
  await expect(
    page.getByRole("button", { name: /Descrever o processo/ }),
  ).toBeDisabled();
  await expect(page.getByText("Em breve")).toBeVisible();
});
