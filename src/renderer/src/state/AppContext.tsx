import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { BootstrapInfo, Routine, Run, RunEvent } from "@shared/types";
import { bridge } from "@/lib/bridge";
import { createExampleRoutine } from "@/lib/defaults";

export type View =
  | { screen: "dashboard" }
  | { screen: "routines" }
  | { screen: "runs" }
  | { screen: "settings" }
  | { screen: "create" }
  | { screen: "editor"; routineId: string; startRecording?: boolean }
  | {
      screen: "preflight";
      routineId: string;
      mode: "test" | "all" | "retry";
      rowIndices?: number[];
    }
  | { screen: "runner"; runId: string }
  | { screen: "report"; runId: string };

interface ToastState {
  id: number;
  tone: "success" | "error" | "info";
  title: string;
  message?: string;
}

interface CheckpointState {
  runId: string;
  itemIndex: number;
  stepId: string;
  message: string;
}

interface AppContextValue {
  bootstrap: BootstrapInfo | null;
  routines: Routine[];
  runs: Run[];
  loading: boolean;
  view: View;
  toast: ToastState | null;
  checkpoint: CheckpointState | null;
  navigate(view: View): void;
  saveRoutine(routine: Routine): Promise<Routine>;
  removeRoutine(id: string): Promise<void>;
  importRoutine(): Promise<void>;
  refreshRuns(): Promise<void>;
  notify(tone: ToastState["tone"], title: string, message?: string): void;
  clearToast(): void;
  clearCheckpoint(): void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const [bootstrap, setBootstrap] = useState<BootstrapInfo | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>({ screen: "dashboard" });
  const [toast, setToast] = useState<ToastState | null>(null);
  const [checkpoint, setCheckpoint] = useState<CheckpointState | null>(null);
  const routinesRef = useRef<Routine[]>([]);
  const toastTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    routinesRef.current = routines;
  }, [routines]);

  const notify = useCallback(
    (tone: ToastState["tone"], title: string, message?: string) => {
      window.clearTimeout(toastTimer.current);
      setToast({ id: Date.now(), tone, title, message });
      toastTimer.current = window.setTimeout(() => setToast(null), 4200);
    },
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const info = await bridge.bootstrap();
      setBootstrap(info);
      let loadedRoutines = await bridge.routines.list();
      if (!loadedRoutines.length) {
        const example = createExampleRoutine(info.demoUrl);
        await bridge.routines.save(example);
        loadedRoutines = [example];
      } else {
        loadedRoutines = await Promise.all(
          loadedRoutines.map(async (routine) => {
            if (!routine.isExample) return routine;
            const next = structuredClone(routine);
            const open = next.steps.find((step) => step.type === "open");
            if (open?.type === "open")
              open.url = { kind: "fixed", value: info.demoUrl };
            next.domains = [new URL(info.demoUrl).hostname];
            await bridge.routines.save(next);
            return next;
          }),
        );
      }
      setRoutines(loadedRoutines);
      setRuns(await bridge.runs.list());
    } catch (error) {
      notify(
        "error",
        "Não foi possível iniciar a Acta",
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveRoutine = useCallback(async (routine: Routine) => {
    const saved = await bridge.routines.save(routine);
    setRoutines((current) => {
      const index = current.findIndex((item) => item.id === saved.id);
      if (index === -1) return [saved, ...current];
      const next = [...current];
      next[index] = saved;
      return next.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    });
    return saved;
  }, []);

  const removeRoutine = useCallback(
    async (id: string) => {
      await bridge.routines.remove(id);
      setRoutines((current) => current.filter((routine) => routine.id !== id));
      notify(
        "success",
        "Automação excluída",
        "O histórico de execuções foi mantido.",
      );
    },
    [notify],
  );

  const importRoutine = useCallback(async () => {
    try {
      const imported = await bridge.routines.importFile();
      if (!imported) return;
      setRoutines((current) => [imported, ...current]);
      setView({ screen: "editor", routineId: imported.id });
      notify(
        "success",
        "Automação importada",
        "Revise os passos antes de testar.",
      );
    } catch (error) {
      notify(
        "error",
        "Não foi possível importar",
        error instanceof Error ? error.message : String(error),
      );
    }
  }, [notify]);

  const refreshRuns = useCallback(async () => {
    setRuns(await bridge.runs.list());
  }, []);

  useEffect(() => {
    return bridge.runner.onEvent((event: RunEvent) => {
      if (event.type === "checkpoint") {
        setCheckpoint({
          runId: event.runId,
          itemIndex: event.itemIndex,
          stepId: event.stepId,
          message: event.message,
        });
        return;
      }
      if (event.type === "run-started") {
        setRuns((current) => [
          event.run,
          ...current.filter((run) => run.id !== event.run.id),
        ]);
        return;
      }
      if (event.type === "run-completed") {
        setRuns((current) => [
          event.run,
          ...current.filter((run) => run.id !== event.run.id),
        ]);
        if (event.run.mode === "test" && event.run.status === "completed") {
          const routine = routinesRef.current.find(
            (item) => item.id === event.run.routineId,
          );
          if (routine) {
            const approved: Routine = {
              ...routine,
              status: "ready",
              lastTestedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            void saveRoutine(approved);
          }
        }
        return;
      }
      setRuns((current) =>
        current.map((run) => {
          if (run.id !== event.runId) return run;
          const next = structuredClone(run);
          if (event.type === "item-started") {
            const item = next.items.find(
              (candidate) => candidate.index === event.itemIndex,
            );
            if (item) {
              item.status = "running";
              item.startedAt = item.startedAt ?? new Date().toISOString();
            }
            next.status = "running";
          } else if (event.type === "step-started") {
            const item = next.items.find(
              (candidate) => candidate.index === event.itemIndex,
            );
            if (item) item.currentStepId = event.stepId;
          } else if (event.type === "step-completed") {
            const item = next.items.find(
              (candidate) => candidate.index === event.itemIndex,
            );
            if (
              item &&
              !item.stepRecords.some(
                (record) => record.stepId === event.record.stepId,
              )
            ) {
              item.stepRecords.push(event.record);
            }
          } else if (event.type === "item-completed") {
            const index = next.items.findIndex(
              (candidate) => candidate.index === event.item.index,
            );
            if (index >= 0) next.items[index] = event.item;
            next.summary.processed = next.items.filter(
              (item) => !["pending", "cancelled"].includes(item.status),
            ).length;
            next.summary.success = next.items.filter(
              (item) => item.status === "success",
            ).length;
            next.summary.errors = next.items.filter(
              (item) => item.status === "error",
            ).length;
          } else if (event.type === "run-paused") next.status = "paused";
          else if (event.type === "run-resumed") next.status = "running";
          return next;
        }),
      );
    });
  }, [saveRoutine]);

  const value = useMemo<AppContextValue>(
    () => ({
      bootstrap,
      routines,
      runs,
      loading,
      view,
      toast,
      checkpoint,
      navigate: setView,
      saveRoutine,
      removeRoutine,
      importRoutine,
      refreshRuns,
      notify,
      clearToast: () => setToast(null),
      clearCheckpoint: () => setCheckpoint(null),
    }),
    [
      bootstrap,
      routines,
      runs,
      loading,
      view,
      toast,
      checkpoint,
      saveRoutine,
      removeRoutine,
      importRoutine,
      refreshRuns,
      notify,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp deve ser usado dentro de AppProvider");
  return context;
}
