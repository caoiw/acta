import {
  AlertCircle,
  Ban,
  Check,
  CheckCircle2,
  Circle,
  LoaderCircle,
  Pause,
  Play,
  Square,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AtomicStep, RoutineStep } from "@shared/types";
import { AppShell } from "@/components/AppShell";
import { Badge, Button, Modal, ProgressBar } from "@/components/ui";
import { bridge } from "@/lib/bridge";
import { runStatusLabel } from "@/lib/format";
import { useApp } from "@/state/AppContext";

export function Runner(): React.JSX.Element {
  const { view, runs, routines, navigate, refreshRuns, notify } = useApp();
  if (view.screen !== "runner") return <></>;
  const run = runs.find((item) => item.id === view.runId);
  const routine = run
    ? routines.find((item) => item.id === run.routineId)
    : undefined;
  const [showCancel, setShowCancel] = useState(false);
  const [controlBusy, setControlBusy] = useState(false);

  useEffect(() => {
    if (!run) void refreshRuns();
  }, [run, refreshRuns]);

  if (!run)
    return (
      <AppShell>
        <div className="page loading-inline">
          <LoaderCircle className="spin" />
          Carregando execução…
        </div>
      </AppShell>
    );
  const currentItem =
    run.items.find((item) => item.status === "running") ??
    run.items.find((item) => item.status === "pending") ??
    run.items.at(-1);
  const progress = run.summary.total
    ? (run.summary.processed / run.summary.total) * 100
    : 0;
  const finished = [
    "completed",
    "completed_with_errors",
    "cancelled",
    "failed",
  ].includes(run.status);
  const steps = routine ? flattenSteps(routine.steps) : [];

  const pauseOrResume = async (): Promise<void> => {
    setControlBusy(true);
    try {
      if (run.status === "paused") await bridge.runner.resume(run.id);
      else await bridge.runner.pause(run.id);
    } catch (error) {
      notify(
        "error",
        "Não foi possível alterar a execução",
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setControlBusy(false);
    }
  };

  const cancel = async (): Promise<void> => {
    await bridge.runner.cancel(run.id);
    setShowCancel(false);
  };

  return (
    <AppShell wide>
      <div className="runner-page">
        <header className="runner-header">
          <div>
            <div className="runner-title-row">
              <h1>{run.routineName}</h1>
              <Badge
                tone={
                  run.status === "paused" || run.status === "waiting"
                    ? "warning"
                    : finished
                      ? run.status === "completed"
                        ? "success"
                        : "danger"
                      : "info"
                }
                dot
              >
                {runStatusLabel[run.status]}
              </Badge>
            </div>
            <p>
              {run.mode === "test" ? "Teste controlado" : "Execução completa"} ·
              Versão {run.routineVersion}
            </p>
          </div>
          <div className="runner-controls">
            {!finished ? (
              <>
                <Button
                  variant="secondary"
                  icon={run.status === "paused" ? Play : Pause}
                  loading={controlBusy}
                  onClick={() => void pauseOrResume()}
                >
                  {run.status === "paused" ? "Retomar" : "Pausar"}
                </Button>
                <Button
                  variant="ghost"
                  icon={Square}
                  onClick={() => setShowCancel(true)}
                >
                  Cancelar
                </Button>
              </>
            ) : (
              <Button
                onClick={() => navigate({ screen: "report", runId: run.id })}
              >
                Ver relatório
              </Button>
            )}
          </div>
        </header>
        <div className="runner-progress">
          <div className="progress-copy">
            <strong>{Math.round(progress)}% concluído</strong>
            <span>
              {run.summary.processed} de {run.summary.total} registros
            </span>
          </div>
          <ProgressBar
            value={progress}
            tone={run.status === "completed" ? "success" : "primary"}
          />
          <div className="runner-counters">
            <span>
              <i className="ok" />
              {run.summary.success} concluídos
            </span>
            <span>
              <i className="skip" />
              {run.summary.skipped} ignorados
            </span>
            <span>
              <i className="error" />
              {run.summary.errors} com erro
            </span>
          </div>
        </div>

        {run.status === "paused" ? (
          <div className="paused-banner">
            <Pause size={19} />
            <div>
              <strong>Execução pausada</strong>
              <p>Nenhum novo passo será iniciado até você retomar.</p>
            </div>
            <Button size="sm" icon={Play} onClick={() => void pauseOrResume()}>
              Retomar execução
            </Button>
          </div>
        ) : null}

        <div className="runner-workspace">
          <aside className="records-panel">
            <div className="records-head">
              <strong>Registros</strong>
              <span>{run.summary.total}</span>
            </div>
            <div className="records-list">
              {run.items.map((item) => (
                <div
                  key={item.index}
                  className={`record-row ${item.status === "running" ? "active" : ""}`}
                >
                  <span className={`record-status status-${item.status}`}>
                    {item.status === "success" ? (
                      <Check size={13} />
                    ) : item.status === "running" ? (
                      <LoaderCircle size={13} className="spin" />
                    ) : item.status === "error" ? (
                      <AlertCircle size={13} />
                    ) : item.status === "cancelled" ? (
                      <Ban size={13} />
                    ) : (
                      <Circle size={10} />
                    )}
                  </span>
                  <span className="record-index">{item.index + 1}</span>
                  <div>
                    <strong>{item.label}</strong>
                    <small>
                      {item.status === "success"
                        ? "Concluído"
                        : item.status === "running"
                          ? "Em andamento"
                          : item.status === "error"
                            ? "Com erro"
                            : item.status === "cancelled"
                              ? "Não processado"
                              : "Aguardando"}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          </aside>
          <main className="current-record-panel" aria-live="polite">
            <div className="current-head">
              <div>
                <span>Registro atual</span>
                <h2>{currentItem?.label ?? "Preparando navegador"}</h2>
              </div>
              {currentItem ? (
                <Badge tone="neutral">Linha {currentItem.index + 1}</Badge>
              ) : null}
            </div>
            <div className="execution-steps">
              {steps.map((step, index) => {
                const record = currentItem?.stepRecords.find(
                  (item) => item.stepId === step.id,
                );
                const active =
                  currentItem?.currentStepId === step.id && !record;
                return (
                  <div
                    className={`execution-step ${record?.status ?? (active ? "active" : "pending")}`}
                    key={step.id}
                  >
                    <span className="execution-step-icon">
                      {record?.status === "success" ? (
                        <Check size={14} />
                      ) : record?.status === "error" ? (
                        <AlertCircle size={14} />
                      ) : active ? (
                        <LoaderCircle size={14} className="spin" />
                      ) : (
                        <span>{index + 1}</span>
                      )}
                    </span>
                    <div>
                      <strong>{step.label}</strong>
                      {active ? (
                        <p>Executando agora no navegador…</p>
                      ) : record?.message ? (
                        <p>{record.message}</p>
                      ) : null}
                    </div>
                    {record?.status === "success" ? (
                      <small>Concluído</small>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {currentItem?.error ? (
              <div className="inline-error">
                <AlertCircle size={20} />
                <div>
                  <strong>{currentItem.error.title}</strong>
                  <p>{currentItem.error.message}</p>
                </div>
              </div>
            ) : null}
          </main>
          <aside className="run-evidence-panel">
            <div className="evidence-live">
              <span className="live-dot" />
              <strong>Navegador visível</strong>
              <p>A Acta está executando dentro dos domínios autorizados.</p>
            </div>
            <div className="evidence-section">
              <span>Contexto</span>
              <dl>
                <div>
                  <dt>Domínio</dt>
                  <dd>{run.domains[0]}</dd>
                </div>
                <div>
                  <dt>Arquivo</dt>
                  <dd>{run.dataFileName}</dd>
                </div>
                <div>
                  <dt>Modo</dt>
                  <dd>
                    {run.mode === "test"
                      ? "Teste de 1 linha"
                      : "Lote sequencial"}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="evidence-note">
              <UserRound size={17} />
              <span>
                Você pode assumir o controle quando a rotina pedir intervenção.
              </span>
            </div>
          </aside>
        </div>
      </div>
      <Modal
        open={showCancel}
        onClose={() => setShowCancel(false)}
        title="Cancelar execução?"
        description={`${run.summary.processed} de ${run.summary.total} registros já foram processados. Os resultados concluídos não serão desfeitos.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCancel(false)}>
              Continuar executando
            </Button>
            <Button variant="danger" onClick={() => void cancel()}>
              Cancelar execução
            </Button>
          </>
        }
      />
    </AppShell>
  );
}

function flattenSteps(steps: RoutineStep[]): AtomicStep[] {
  return steps.flatMap((step) =>
    step.type === "condition"
      ? ([step as unknown as AtomicStep, ...step.thenSteps] as AtomicStep[])
      : [step],
  );
}
