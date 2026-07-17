import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileSpreadsheet,
  History,
  ListTree,
  Plus,
  Sparkles,
} from "lucide-react";
import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { RoutineListItem } from "@/components/RoutineListItem";
import { Badge, Button } from "@/components/ui";
import { formatRelativeDate, runStatusLabel } from "@/lib/format";
import { useApp } from "@/state/AppContext";

export function Dashboard(): React.JSX.Element {
  const { routines, runs, navigate, importRoutine } = useApp();
  const recentRoutines = routines.slice(0, 3);
  const recentRuns = runs.slice(0, 4);
  const stats = useMemo(() => {
    const processed = runs.reduce((sum, run) => sum + run.summary.processed, 0);
    const success = runs.reduce((sum, run) => sum + run.summary.success, 0);
    return {
      processed,
      successRate: processed ? Math.round((success / processed) * 100) : 0,
      today: runs.filter(
        (run) =>
          new Date(run.startedAt).toDateString() === new Date().toDateString(),
      ).length,
    };
  }, [runs]);

  return (
    <AppShell>
      <div className="page dashboard-page">
        <header className="dashboard-hero">
          <div className="hero-content">
            <Badge tone="info" dot>
              Local-first · navegador visível
            </Badge>
            <h1>Transforme tarefas repetitivas em rotinas confiáveis.</h1>
            <p>
              Ensine o processo uma vez, conecte sua planilha e acompanhe cada
              ação — sem código e sem enviar seus dados para a nuvem.
            </p>
            <div className="hero-actions">
              <Button
                size="lg"
                icon={Plus}
                onClick={() => navigate({ screen: "create" })}
              >
                Nova automação
              </Button>
              <Button
                size="lg"
                variant="secondary"
                icon={FileSpreadsheet}
                onClick={() => void importRoutine()}
              >
                Importar automação
              </Button>
            </div>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="mini-window">
              <div className="mini-window-head">
                <i />
                <i />
                <i />
                <span>Cadastro de colaboradores</span>
              </div>
              <div className="mini-step done">
                <b>
                  <CheckCircle2 size={15} />
                </b>
                <span>Abriu a plataforma</span>
              </div>
              <div className="mini-line" />
              <div className="mini-step done">
                <b>
                  <CheckCircle2 size={15} />
                </b>
                <span>Preencheu os dados</span>
              </div>
              <div className="mini-line" />
              <div className="mini-step active">
                <b>3</b>
                <span>Aplicando regras por cargo</span>
                <em />
              </div>
              <div className="mini-line muted" />
              <div className="mini-step waiting">
                <b>4</b>
                <span>Confirmar cadastro</span>
              </div>
            </div>
            <div className="record-seal">
              <span>ACTA</span>
              <strong>Registro local</strong>
              <small>cada ação, em evidência</small>
            </div>
          </div>
        </header>

        {runs.length ? (
          <section className="stat-grid" aria-label="Resumo operacional">
            <div className="stat-card">
              <span className="stat-icon blue">
                <ListTree size={18} />
              </span>
              <div>
                <strong>{routines.length}</strong>
                <small>Automações</small>
              </div>
            </div>
            <div className="stat-card">
              <span className="stat-icon purple">
                <History size={18} />
              </span>
              <div>
                <strong>{stats.today}</strong>
                <small>Execuções hoje</small>
              </div>
            </div>
            <div className="stat-card">
              <span className="stat-icon green">
                <CheckCircle2 size={18} />
              </span>
              <div>
                <strong>{stats.processed}</strong>
                <small>Registros processados</small>
              </div>
            </div>
            <div className="stat-card">
              <span className="stat-icon amber">
                <Sparkles size={18} />
              </span>
              <div>
                <strong>{stats.successRate}%</strong>
                <small>Taxa de sucesso</small>
              </div>
            </div>
          </section>
        ) : null}

        <section className="section-block">
          <div className="section-heading">
            <div>
              <h2>Automações recentes</h2>
              <p>Rotinas que sua equipe ensinou à Acta.</p>
            </div>
            <button
              className="text-link"
              onClick={() => navigate({ screen: "routines" })}
            >
              Ver todas <ArrowRight size={15} />
            </button>
          </div>
          <div className="routine-list">
            {recentRoutines.map((routine) => (
              <RoutineListItem
                key={routine.id}
                routine={routine}
                lastRun={runs.find((run) => run.routineId === routine.id)}
              />
            ))}
          </div>
        </section>

        {recentRuns.length ? (
          <section className="section-block">
            <div className="section-heading">
              <div>
                <h2>Execuções recentes</h2>
                <p>O que aconteceu nas últimas rotinas.</p>
              </div>
              <button
                className="text-link"
                onClick={() => navigate({ screen: "runs" })}
              >
                Ver histórico <ArrowRight size={15} />
              </button>
            </div>
            <div className="table-card">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Automação</th>
                    <th>Início</th>
                    <th>Resultado</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {recentRuns.map((run) => (
                    <tr key={run.id}>
                      <td>
                        <strong>{run.routineName}</strong>
                        <span>Versão {run.routineVersion}</span>
                      </td>
                      <td>{formatRelativeDate(run.startedAt)}</td>
                      <td>
                        {run.summary.success} concluídos
                        {run.summary.errors
                          ? `, ${run.summary.errors} erros`
                          : ""}
                      </td>
                      <td>
                        <Badge
                          tone={
                            run.status === "completed"
                              ? "success"
                              : run.status === "completed_with_errors"
                                ? "warning"
                                : "info"
                          }
                        >
                          {runStatusLabel[run.status]}
                        </Badge>
                      </td>
                      <td>
                        <button
                          className="table-action"
                          onClick={() =>
                            navigate({ screen: "report", runId: run.id })
                          }
                        >
                          Ver relatório
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          <section className="getting-started">
            <span className="getting-icon">
              <Clock3 size={22} />
            </span>
            <div>
              <strong>Pronto para uma primeira execução real?</strong>
              <p>
                O exemplo guiado usa um portal de treinamento local e 20
                registros fictícios.
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={() =>
                navigate({
                  screen: "preflight",
                  routineId: routines[0]?.id ?? "",
                  mode: "test",
                })
              }
            >
              Testar uma linha
            </Button>
          </section>
        )}
      </div>
    </AppShell>
  );
}
