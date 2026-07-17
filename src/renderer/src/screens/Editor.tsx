import {
  AlertCircle,
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  CircleStop,
  Clock3,
  FileSpreadsheet,
  GitBranch,
  Keyboard,
  ListPlus,
  MousePointer2,
  PauseCircle,
  Play,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Upload,
  Video,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  RecorderAction,
  Routine,
  RoutineStep,
  StepType,
  ValueBinding,
} from "@shared/types";
import { AppShell } from "@/components/AppShell";
import { StepCard } from "@/components/StepCard";
import { StepInspector } from "@/components/StepInspector";
import { Badge, Button, Modal } from "@/components/ui";
import { bridge } from "@/lib/bridge";
import { starterStep } from "@/lib/defaults";
import { validateRoutineForRun } from "@shared/flow-utils";
import { routineStatusLabel } from "@/lib/format";
import { useApp } from "@/state/AppContext";

const catalog: Array<{ type: StepType; label: string; icon: typeof Play }> = [
  { type: "open", label: "Abrir página", icon: Play },
  { type: "click", label: "Clicar", icon: MousePointer2 },
  { type: "fill", label: "Preencher campo", icon: Keyboard },
  { type: "select", label: "Selecionar opção", icon: ChevronDown },
  { type: "check", label: "Marcar caixa", icon: CheckSquare },
  { type: "verify", label: "Verificar resultado", icon: CheckCircle2 },
  { type: "condition", label: "Condição", icon: GitBranch },
  { type: "wait", label: "Esperar", icon: Clock3 },
  { type: "checkpoint", label: "Pausa para usuário", icon: PauseCircle },
  { type: "screenshot", label: "Tirar screenshot", icon: Camera },
];

export function Editor(): React.JSX.Element {
  const { view, routines, navigate, saveRoutine, notify } = useApp();
  if (view.screen !== "editor") return <></>;
  const source = routines.find((item) => item.id === view.routineId);
  if (!source)
    return (
      <AppShell>
        <div className="page">
          <h1>Automação não encontrada</h1>
        </div>
      </AppShell>
    );
  return (
    <EditorWorkspace
      key={source.id}
      source={source}
      autoRecord={Boolean(view.startRecording)}
      navigate={navigate}
      saveRoutine={saveRoutine}
      notify={notify}
    />
  );
}

function EditorWorkspace({
  source,
  autoRecord,
  navigate,
  saveRoutine,
  notify,
}: {
  source: Routine;
  autoRecord: boolean;
  navigate: ReturnType<typeof useApp>["navigate"];
  saveRoutine: ReturnType<typeof useApp>["saveRoutine"];
  notify: ReturnType<typeof useApp>["notify"];
}): React.JSX.Element {
  const [routine, setRoutine] = useState(() => structuredClone(source));
  const [selectedId, setSelectedId] = useState(source.steps[0]?.id ?? "");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">(
    "saved",
  );
  const [recording, setRecording] = useState(false);
  const [recordingActions, setRecordingActions] = useState<RecorderAction[]>(
    [],
  );
  const [showValidation, setShowValidation] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const lastSaved = useRef(JSON.stringify(source));
  const autoStarted = useRef(false);
  const columns = routine.dataSet?.columns ?? [];
  const selected = routine.steps.find((step) => step.id === selectedId);
  const issues = useMemo(
    () =>
      new Map(
        validateRoutineForRun(routine).map((issue) => [
          issue.stepId,
          issue.message,
        ]),
      ),
    [routine],
  );

  useEffect(() => {
    if (JSON.stringify(routine) === lastSaved.current) return;
    setSaveState("saving");
    const timer = window.setTimeout(async () => {
      try {
        const saved = await saveRoutine(routine);
        lastSaved.current = JSON.stringify(saved);
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [routine, saveRoutine]);

  useEffect(
    () =>
      bridge.recorder.onAction((action) => {
        setRecordingActions((current) => {
          const previous = current.at(-1);
          if (
            action.kind === "fill" &&
            previous?.kind === "fill" &&
            previous.target?.value === action.target?.value
          )
            return [...current.slice(0, -1), action];
          if (
            action.kind === "open" &&
            previous?.kind === "open" &&
            previous.url === action.url
          )
            return current;
          return [...current, action];
        });
      }),
    [],
  );

  useEffect(() => {
    if (autoRecord && !autoStarted.current) {
      autoStarted.current = true;
      void startRecorder();
    }
  }, [autoRecord]);

  const mutate = (change: (draft: Routine) => void): void => {
    setRoutine((current) => {
      const draft = structuredClone(current);
      change(draft);
      if (current.status === "ready") draft.version += 1;
      draft.status = "draft";
      draft.lastTestedAt = undefined;
      draft.updatedAt = new Date().toISOString();
      return draft;
    });
  };

  const updateStep = (updated: RoutineStep): void => {
    mutate((draft) => {
      const index = draft.steps.findIndex((step) => step.id === updated.id);
      if (index >= 0) draft.steps[index] = updated;
    });
  };

  const addStep = (type: StepType, afterIndex?: number): void => {
    const step = starterStep(type);
    mutate((draft) => {
      const index =
        afterIndex === undefined ? draft.steps.length : afterIndex + 1;
      draft.steps.splice(index, 0, step);
    });
    setSelectedId(step.id);
  };

  const startRecorder = async (): Promise<void> => {
    const openStep = routine.steps.find((step) => step.type === "open");
    const url = openStep?.type === "open" ? openStep.url.value : "";
    if (!url) {
      notify(
        "error",
        "Defina a página inicial",
        "Adicione ou configure um passo “Abrir página” antes de gravar.",
      );
      return;
    }
    setRecordingActions([]);
    try {
      await bridge.recorder.start({
        url,
        domains: routine.domains,
        browserChannel: routine.browserChannel,
      });
      setRecording(true);
    } catch (error) {
      notify(
        "error",
        "Não foi possível abrir o navegador",
        error instanceof Error ? error.message : String(error),
      );
    }
  };

  const stopRecorder = async (): Promise<void> => {
    try {
      const captured = await bridge.recorder.stop();
      const actions = captured.length ? captured : recordingActions;
      const generated = actions
        .map((action) => actionToStep(action, routine))
        .filter(Boolean) as RoutineStep[];
      mutate((draft) => {
        const existingOpen = draft.steps.find((step) => step.type === "open");
        const withoutDuplicateOpen = generated.filter(
          (step) => step.type !== "open" || !existingOpen,
        );
        draft.steps.push(...withoutDuplicateOpen);
      });
      if (generated.length) setSelectedId(generated.at(-1)?.id ?? selectedId);
      setRecording(false);
      setRecordingActions([]);
      notify(
        "success",
        "Demonstração registrada",
        `${generated.length} passos foram adicionados à timeline.`,
      );
    } catch (error) {
      notify(
        "error",
        "Não foi possível encerrar a gravação",
        error instanceof Error ? error.message : String(error),
      );
    }
  };

  const chooseData = async (): Promise<void> => {
    try {
      const dataSet = await bridge.data.pickSpreadsheet();
      if (!dataSet) return;
      mutate((draft) => {
        draft.dataSet = dataSet;
      });
      notify(
        "success",
        "Planilha conectada",
        `${dataSet.rows.length} registros e ${dataSet.columns.length} colunas disponíveis.`,
      );
    } catch (error) {
      notify(
        "error",
        "Não foi possível ler a planilha",
        error instanceof Error ? error.message : String(error),
      );
    }
  };

  const bindColumn = (column: string): void => {
    if (!selected || !("value" in selected)) return;
    updateStep({
      ...selected,
      value: { ...selected.value, kind: "column", value: column },
    } as RoutineStep);
  };

  const retrySave = async (): Promise<void> => {
    setSaveState("saving");
    try {
      const saved = await saveRoutine(routine);
      lastSaved.current = JSON.stringify(saved);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  };

  return (
    <AppShell wide>
      <div className="editor-shell">
        <header className="editor-topbar">
          <div className="editor-title">
            <button
              className="icon-button"
              onClick={() => navigate({ screen: "routines" })}
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <span>Automações /</span>
              <input
                value={routine.name}
                onChange={(event) =>
                  mutate((draft) => {
                    draft.name = event.target.value;
                  })
                }
              />
            </div>
            <Badge tone={routine.status === "ready" ? "success" : "warning"}>
              {routineStatusLabel[routine.status]}
            </Badge>
          </div>
          <button
            className={`save-state save-${saveState}`}
            onClick={saveState === "error" ? () => void retrySave() : undefined}
          >
            {saveState === "saving" ? (
              <>
                <span className="pulse-dot" />
                Salvando…
              </>
            ) : saveState === "error" ? (
              <>
                <AlertCircle size={14} />
                Falha ao salvar · tentar novamente
              </>
            ) : (
              <>
                <Check size={14} />
                Salvo neste computador
              </>
            )}
          </button>
          <div className="editor-actions">
            <Button
              variant="ghost"
              size="sm"
              icon={Video}
              disabled={recording}
              onClick={() => void startRecorder()}
            >
              {recording ? "Gravando…" : "Gravar"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={Play}
              onClick={() =>
                issues.size
                  ? setShowValidation(true)
                  : navigate({
                      screen: "preflight",
                      routineId: routine.id,
                      mode: "test",
                    })
              }
            >
              Testar 1 linha
            </Button>
            <Button
              size="sm"
              icon={Play}
              onClick={() =>
                issues.size
                  ? setShowValidation(true)
                  : navigate({
                      screen: "preflight",
                      routineId: routine.id,
                      mode: "all",
                    })
              }
            >
              Executar
            </Button>
            <button
              className="icon-button"
              onClick={() => setShowExport(true)}
              aria-label="Mais opções"
            >
              •••
            </button>
          </div>
        </header>

        <div className="editor-grid">
          <aside className="builder-panel">
            <section className="builder-section">
              <div className="builder-heading">
                <span>Dados</span>
                {routine.dataSet ? (
                  <button onClick={() => void chooseData()}>Trocar</button>
                ) : null}
              </div>
              {routine.dataSet ? (
                <>
                  <div className="data-file-mini">
                    <FileSpreadsheet size={19} />
                    <div>
                      <strong>{routine.dataSet.fileName}</strong>
                      <span>{routine.dataSet.rows.length} registros</span>
                    </div>
                  </div>
                  <div className="column-list">
                    {columns.map((column) => (
                      <button key={column} onClick={() => bindColumn(column)}>
                        <span>[</span>
                        {column}
                        <span>]</span>
                        {routine.sensitiveColumns.includes(column) ? (
                          <ShieldCheck size={12} />
                        ) : null}
                      </button>
                    ))}
                  </div>
                  <p className="builder-hint">
                    Clique em uma coluna para usá-la no passo selecionado.
                  </p>
                </>
              ) : (
                <button
                  className="connect-data"
                  onClick={() => void chooseData()}
                >
                  <Upload size={18} />
                  <span>
                    <strong>Conectar planilha</strong>
                    <small>Excel ou CSV</small>
                  </span>
                </button>
              )}
            </section>
            <section className="builder-section step-catalog">
              <div className="builder-heading">
                <span>Adicionar passo</span>
              </div>
              {catalog.map((item) => {
                const Icon = item.icon;
                return (
                  <button key={item.type} onClick={() => addStep(item.type)}>
                    <Icon size={16} />
                    <span>{item.label}</span>
                    <Plus size={14} />
                  </button>
                );
              })}
            </section>
            <div className="builder-safe">
              <ShieldCheck size={16} />
              <span>Sem scripts ou código livre</span>
            </div>
          </aside>

          <main className="timeline-panel">
            {issues.size ? (
              <button
                className="validation-banner"
                onClick={() => setShowValidation(true)}
              >
                <AlertCircle size={18} />
                <span>
                  <strong>
                    {issues.size} {issues.size === 1 ? "ajuste" : "ajustes"}{" "}
                    antes de executar
                  </strong>
                  <small>
                    Revise os passos indicados para uma execução segura.
                  </small>
                </span>
                <ArrowRightIcon />
              </button>
            ) : (
              <div className="ready-banner">
                <CheckCircle2 size={17} />
                <span>Estrutura pronta para teste</span>
              </div>
            )}
            <div className="timeline-header">
              <span className="loop-icon">
                <ListPlus size={19} />
              </span>
              <div>
                <strong>
                  {routine.dataSet
                    ? `Para cada linha de ${routine.dataSet.sheetName}`
                    : "Executar uma vez"}
                </strong>
                <p>
                  {routine.dataSet
                    ? `${routine.dataSet.rows.length} registros na planilha atual`
                    : "Os dados serão solicitados quando necessário"}
                </p>
              </div>
              <Badge tone="info">Sequencial</Badge>
            </div>
            <div className="timeline-list">
              {routine.steps.map((step, index) => (
                <StepCard
                  key={step.id}
                  step={step}
                  index={index}
                  selected={selectedId === step.id}
                  issue={issues.get(step.id)}
                  first={index === 0}
                  last={index === routine.steps.length - 1}
                  onSelect={() => setSelectedId(step.id)}
                  onMove={(direction) =>
                    mutate((draft) => {
                      const nextIndex = index + direction;
                      const [moved] = draft.steps.splice(index, 1);
                      draft.steps.splice(nextIndex, 0, moved);
                    })
                  }
                  onDuplicate={() =>
                    mutate((draft) => {
                      const copy = structuredClone(step);
                      copy.id = crypto.randomUUID();
                      copy.label = `${copy.label} (cópia)`;
                      draft.steps.splice(index + 1, 0, copy);
                    })
                  }
                  onRemove={() =>
                    mutate((draft) => {
                      draft.steps = draft.steps.filter(
                        (candidate) => candidate.id !== step.id,
                      );
                      setSelectedId(
                        draft.steps[Math.max(0, index - 1)]?.id ?? "",
                      );
                    })
                  }
                />
              ))}
              <button className="timeline-add" onClick={() => addStep("click")}>
                <MousePointer2 size={15} /> Adicionar clique
              </button>
            </div>
          </main>

          {selected ? (
            <StepInspector
              step={selected}
              columns={columns}
              onChange={updateStep}
            />
          ) : (
            <aside className="inspector-panel inspector-empty">
              <span>
                <Sparkles size={23} />
              </span>
              <h3>Selecione um passo</h3>
              <p>A configuração aparecerá aqui em linguagem simples.</p>
            </aside>
          )}
        </div>

        {recording ? (
          <div className="recording-dock">
            <span className="recording-pulse" />
            <div>
              <strong>Gravando demonstração</strong>
              <p>
                {recordingActions.at(-1)?.label ??
                  "Faça a tarefa no navegador controlado pela Acta."}
              </p>
            </div>
            <span className="recording-count">
              {recordingActions.length} ações
            </span>
            <Button
              variant="secondary"
              size="sm"
              icon={CircleStop}
              onClick={() => void stopRecorder()}
            >
              Encerrar gravação
            </Button>
          </div>
        ) : null}

        <Modal
          open={showValidation}
          onClose={() => setShowValidation(false)}
          title={`${issues.size} ajustes antes de executar`}
          description="Resolva estes pontos para que a rotina seja previsível e verificável."
          footer={
            <Button onClick={() => setShowValidation(false)}>
              Voltar ao editor
            </Button>
          }
        >
          <div className="validation-list">
            {[...issues.entries()].map(([id, message]) => (
              <button
                key={id}
                onClick={() => {
                  if (id === "__verify") addStep("verify");
                  else if (id === "__data") void chooseData();
                  else setSelectedId(id);
                  setShowValidation(false);
                }}
              >
                <AlertCircle size={17} />
                <span>{message}</span>
              </button>
            ))}
          </div>
        </Modal>
        <Modal
          open={showExport}
          onClose={() => setShowExport(false)}
          title="Opções da automação"
          footer={
            <Button variant="ghost" onClick={() => setShowExport(false)}>
              Fechar
            </Button>
          }
        >
          <div className="action-list">
            <button
              onClick={async () => {
                const path = await bridge.routines.exportFile(routine);
                if (path) notify("success", "Automação exportada", path);
              }}
            >
              <Save size={18} />
              <span>
                <strong>Exportar arquivo .acta</strong>
                <small>Compartilhe a definição declarativa para revisão.</small>
              </span>
            </button>
          </div>
        </Modal>
      </div>
    </AppShell>
  );
}

function actionToStep(
  action: RecorderAction,
  routine: Routine,
): RoutineStep | null {
  const common = {
    id: crypto.randomUUID(),
    enabled: true,
    risk: "low" as const,
    label: action.label,
  };
  if (action.kind === "open" && action.url)
    return {
      ...common,
      type: "open",
      url: { kind: "fixed", value: action.url },
    };
  if (!action.target) return null;
  if (action.kind === "click")
    return {
      ...common,
      type: "click",
      target: action.target,
      risk: /salvar|enviar|cadastrar|excluir/i.test(action.target.value)
        ? "high"
        : "low",
    };
  if (action.kind === "check")
    return { ...common, type: "check", target: action.target, risk: "medium" };
  const firstRow = routine.dataSet?.rows[0];
  const matchingColumn = firstRow
    ? Object.entries(firstRow).find(
        ([, value]) => String(value) === String(action.value ?? ""),
      )?.[0]
    : undefined;
  const value: ValueBinding = action.sensitive
    ? { kind: "secret", value: "", sensitive: true }
    : matchingColumn
      ? {
          kind: "column",
          value: matchingColumn,
          sensitive: routine.sensitiveColumns.includes(matchingColumn),
        }
      : { kind: "fixed", value: action.value ?? "" };
  return action.kind === "fill"
    ? { ...common, type: "fill", target: action.target, value, risk: "medium" }
    : {
        ...common,
        type: "select",
        target: action.target,
        value,
        risk: "medium",
      };
}

function ArrowRightIcon(): React.JSX.Element {
  return <span className="banner-arrow">→</span>;
}
