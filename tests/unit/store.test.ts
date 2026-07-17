import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalStore } from "../../src/main/store";
import { createExampleRoutine } from "../../src/renderer/src/lib/defaults";

const temporaryPaths: string[] = [];
const encryption = {
  encrypt: (value: string) =>
    Buffer.from(`ACTA:${Buffer.from(value).toString("base64")}`),
  decrypt: (value: Buffer) =>
    Buffer.from(value.toString().slice(5), "base64").toString(),
};

afterEach(async () => {
  for (const path of temporaryPaths.splice(0)) {
    if (path.startsWith(tmpdir()) && path.includes("acta-store-test-")) {
      await rm(path, { recursive: true, force: true });
    }
  }
});

describe("armazenamento local protegido", () => {
  it("não persiste dados da planilha em texto claro e reabre o snapshot", async () => {
    const directory = await mkdtemp(join(tmpdir(), "acta-store-test-"));
    temporaryPaths.push(directory);
    const store = new LocalStore(directory, encryption);
    await store.init();
    const routine = createExampleRoutine("http://127.0.0.1:9876/colaboradores");
    await store.saveRoutine(routine);

    const raw = await readFile(join(directory, "acta-data.secure"), "utf8");
    expect(raw).not.toContain("Ana Martins");
    expect(raw).not.toContain("@empresa.com");

    const reopened = new LocalStore(directory, encryption);
    await reopened.init();
    expect(reopened.getRoutine(routine.id)?.dataSet?.rows).toHaveLength(20);
  });

  it("lista apenas metadados do cofre", async () => {
    const directory = await mkdtemp(join(tmpdir(), "acta-store-test-"));
    temporaryPaths.push(directory);
    const store = new LocalStore(directory, encryption);
    await store.init();
    await store.setVaultValue("Portal", "ciphertext-ultrassecreto");
    expect(store.listVault()).toEqual([
      { name: "Portal", updatedAt: expect.any(String) },
    ]);
    expect(JSON.stringify(store.listVault())).not.toContain("ultrassecreto");
  });
});
