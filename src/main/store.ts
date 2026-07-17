import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Routine, Run } from "../shared/types";

interface StoredVaultEntry {
  name: string;
  encryptedValue: string;
  updatedAt: string;
}

interface StoreShape {
  version: 1;
  routines: Routine[];
  runs: Run[];
  vault: StoredVaultEntry[];
}

const EMPTY_STORE: StoreShape = {
  version: 1,
  routines: [],
  runs: [],
  vault: [],
};

export class LocalStore {
  private readonly filePath: string;
  private readonly legacyFilePath: string;
  private data: StoreShape = structuredClone(EMPTY_STORE);
  private writeQueue = Promise.resolve();

  constructor(
    userDataPath: string,
    private readonly encryption: {
      encrypt(value: string): Buffer;
      decrypt(value: Buffer): string;
    },
  ) {
    this.filePath = join(userDataPath, "acta-data.secure");
    this.legacyFilePath = join(userDataPath, "acta-data.json");
  }

  async init(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    try {
      const encrypted = await readFile(this.filePath);
      this.loadSnapshot(this.encryption.decrypt(encrypted));
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw new Error(
          "Não foi possível abrir o armazenamento local protegido. O arquivo pode estar corrompido ou pertencer a outro usuário do Windows.",
          { cause: error },
        );
      }
    }
    try {
      const legacy = await readFile(this.legacyFilePath, "utf8");
      this.loadSnapshot(legacy);
      await this.flush();
      await unlink(this.legacyFilePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await this.flush();
    }
  }

  private loadSnapshot(contents: string): void {
    const parsed = JSON.parse(contents) as Partial<StoreShape>;
    this.data = {
      version: 1,
      routines: Array.isArray(parsed.routines) ? parsed.routines : [],
      runs: Array.isArray(parsed.runs) ? parsed.runs : [],
      vault: Array.isArray(parsed.vault) ? parsed.vault : [],
    };
  }

  listRoutines(): Routine[] {
    return structuredClone(this.data.routines).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
  }

  getRoutine(id: string): Routine | null {
    const routine = this.data.routines.find((item) => item.id === id);
    return routine ? structuredClone(routine) : null;
  }

  async saveRoutine(routine: Routine): Promise<Routine> {
    const next = structuredClone(routine);
    const index = this.data.routines.findIndex((item) => item.id === next.id);
    if (index === -1) this.data.routines.push(next);
    else this.data.routines[index] = next;
    await this.flush();
    return structuredClone(next);
  }

  async removeRoutine(id: string): Promise<void> {
    this.data.routines = this.data.routines.filter((item) => item.id !== id);
    await this.flush();
  }

  listRuns(): Run[] {
    return structuredClone(this.data.runs).sort((a, b) =>
      b.startedAt.localeCompare(a.startedAt),
    );
  }

  getRun(id: string): Run | null {
    const run = this.data.runs.find((item) => item.id === id);
    return run ? structuredClone(run) : null;
  }

  async saveRun(run: Run): Promise<void> {
    const next = structuredClone(run);
    const index = this.data.runs.findIndex((item) => item.id === next.id);
    if (index === -1) this.data.runs.push(next);
    else this.data.runs[index] = next;
    if (this.data.runs.length > 250)
      this.data.runs = this.data.runs.slice(-250);
    await this.flush();
  }

  listVault(): Array<{ name: string; updatedAt: string }> {
    return this.data.vault
      .map(({ name, updatedAt }) => ({ name, updatedAt }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  getVaultValue(name: string): string | null {
    return (
      this.data.vault.find((item) => item.name === name)?.encryptedValue ?? null
    );
  }

  async setVaultValue(name: string, encryptedValue: string): Promise<void> {
    const entry = { name, encryptedValue, updatedAt: new Date().toISOString() };
    const index = this.data.vault.findIndex((item) => item.name === name);
    if (index === -1) this.data.vault.push(entry);
    else this.data.vault[index] = entry;
    await this.flush();
  }

  async removeVaultValue(name: string): Promise<void> {
    this.data.vault = this.data.vault.filter((item) => item.name !== name);
    await this.flush();
  }

  private flush(): Promise<void> {
    const snapshot = this.encryption.encrypt(JSON.stringify(this.data));
    this.writeQueue = this.writeQueue.then(async () => {
      const temporary = `${this.filePath}.tmp`;
      await writeFile(temporary, snapshot);
      await rename(temporary, this.filePath);
    });
    return this.writeQueue;
  }
}
