import { isAbsolute, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { app, BrowserWindow, dialog, safeStorage } from "electron";
import { DemoServer } from "./demo-server";
import { decryptVaultValue, registerIpc } from "./ipc";
import { RecorderManager } from "./recorder";
import { RunnerManager } from "./runner";
import { LocalStore } from "./store";

let mainWindow: BrowserWindow | null = null;
let store: LocalStore | null = null;
let recorder: RecorderManager | null = null;
let runner: RunnerManager | null = null;
const demoServer = new DemoServer();

const e2eDataPath = process.env.ACTA_E2E_DATA_DIR;
if (process.env.ACTA_E2E === "1" && e2eDataPath) {
  const temporaryRoot = resolve(tmpdir());
  const requested = resolve(e2eDataPath);
  const relation = relative(temporaryRoot, requested);
  if (
    relation.startsWith("acta-e2e-") &&
    !relation.startsWith("..") &&
    !isAbsolute(relation)
  ) {
    app.setPath("userData", requested);
  }
}

function createWindow(): void {
  const rendererEntry = join(__dirname, "../renderer/index.html");
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 720,
    show: false,
    backgroundColor: "#f4f6f9",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.session.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false),
  );
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const rendererUrl = process.env.ELECTRON_RENDERER_URL;
    let allowed = false;
    try {
      allowed = rendererUrl
        ? new URL(url).origin === new URL(rendererUrl).origin
        : url.split("#", 1)[0] === pathToFileURL(rendererEntry).href;
    } catch {
      allowed = false;
    }
    if (!allowed) event.preventDefault();
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(rendererEntry);
  }
}

void app
  .whenReady()
  .then(async () => {
    app.setAppUserModelId("com.acta.desktop");
    const demoUrl = await demoServer.start();
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error(
        "A proteção de dados do sistema operacional não está disponível.",
      );
    }
    store = new LocalStore(app.getPath("userData"), {
      encrypt: (value) => safeStorage.encryptString(value),
      decrypt: (value) => safeStorage.decryptString(value),
    });
    await store.init();
    recorder = new RecorderManager(app.getPath("userData"), (action) => {
      if (mainWindow && !mainWindow.isDestroyed())
        mainWindow.webContents.send("recorder:action", action);
    });
    runner = new RunnerManager(
      app.getPath("userData"),
      store,
      (event) => {
        if (mainWindow && !mainWindow.isDestroyed())
          mainWindow.webContents.send("runner:event", event);
      },
      (name) => (store ? decryptVaultValue(store, name) : null),
    );
    registerIpc({
      getWindow: () => mainWindow,
      store,
      recorder,
      runner,
      demoUrl,
      appVersion: app.getVersion(),
      storePath: app.getPath("userData"),
    });
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  })
  .catch((error: unknown) => {
    dialog.showErrorBox(
      "Não foi possível iniciar a Acta",
      error instanceof Error ? error.message : String(error),
    );
    app.quit();
  });

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  void recorder?.stop();
  void runner?.dispose();
  void demoServer.stop();
});
