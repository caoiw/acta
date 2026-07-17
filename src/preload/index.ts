import { contextBridge, ipcRenderer } from "electron";
import type { ActaAPI, RecorderAction, RunEvent } from "../shared/types";

const api: ActaAPI = {
  bootstrap: () => ipcRenderer.invoke("app:bootstrap"),
  routines: {
    list: () => ipcRenderer.invoke("routines:list"),
    get: (id) => ipcRenderer.invoke("routines:get", id),
    save: (routine) => ipcRenderer.invoke("routines:save", routine),
    remove: (id) => ipcRenderer.invoke("routines:remove", id),
    importFile: () => ipcRenderer.invoke("routines:import"),
    exportFile: (routine) => ipcRenderer.invoke("routines:export", routine),
  },
  runs: {
    list: () => ipcRenderer.invoke("runs:list"),
    get: (id) => ipcRenderer.invoke("runs:get", id),
    exportCsv: (runId) => ipcRenderer.invoke("runs:export-csv", runId),
    readArtifact: (runId, itemIndex) =>
      ipcRenderer.invoke("runs:read-artifact", runId, itemIndex),
  },
  data: {
    pickSpreadsheet: () => ipcRenderer.invoke("data:pick-spreadsheet"),
  },
  recorder: {
    start: (input) => ipcRenderer.invoke("recorder:start", input),
    stop: () => ipcRenderer.invoke("recorder:stop"),
    onAction: (callback) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        action: RecorderAction,
      ): void => callback(action);
      ipcRenderer.on("recorder:action", listener);
      return () => ipcRenderer.removeListener("recorder:action", listener);
    },
  },
  runner: {
    start: (input) => ipcRenderer.invoke("runner:start", input),
    pause: (runId) => ipcRenderer.invoke("runner:pause", runId),
    resume: (runId) => ipcRenderer.invoke("runner:resume", runId),
    cancel: (runId) => ipcRenderer.invoke("runner:cancel", runId),
    continueCheckpoint: (runId) =>
      ipcRenderer.invoke("runner:continue-checkpoint", runId),
    onEvent: (callback) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        runEvent: RunEvent,
      ): void => callback(runEvent);
      ipcRenderer.on("runner:event", listener);
      return () => ipcRenderer.removeListener("runner:event", listener);
    },
  },
  vault: {
    list: () => ipcRenderer.invoke("vault:list"),
    set: (name, value) => ipcRenderer.invoke("vault:set", name, value),
    remove: (name) => ipcRenderer.invoke("vault:remove", name),
  },
};

contextBridge.exposeInMainWorld("acta", api);
