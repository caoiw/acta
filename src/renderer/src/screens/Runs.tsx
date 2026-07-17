import { Download, History, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Badge, EmptyState } from "@/components/ui";
import {
  formatDuration,
  formatRelativeDate,
  runStatusLabel,
} from "@/lib/format";
import { useApp } from "@/state/AppContext";

export function Runs(): React.JSX.Element {
  const { runs, navigate } = useApp();
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () =>
      runs.filter((run) =>
        run.routineName
          .toLocaleLowerCase("pt-BR")
          .includes(query.toLocaleLowerCase("pt-BR")),
      ),
    [runs, query],
  );
  return (
    <AppShell>
      <div className="page">
        <header className="page-header">
          <div>
            <span className="eyebrow">Evidências</span>
            <h1>Execuções</h1>
            <p>Cada execução vinculada à versão exata que foi utilizada.</p>
          </div>
        </header>
        {runs.length ? (
          <>
            <div className="toolbar">
              <div className="search-box">
                <Search size={17} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por automação"
                />
              </div>
              <span>{filtered.length} registros</span>
            </div>
            {filtered.length ? (
              <div className="table-card">
                <table className="data-table runs-table">
                  <thead>
                    <tr>
                      <th>Automação</th>
                      <th>Início</th>
                      <th>Escopo</th>
                      <th>Resultado</th>
                      <th>Duração</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((run) => (
                      <tr key={run.id}>
                        <td>
                          <strong>{run.routineName}</strong>
                          <span>Versão {run.routineVersion}</span>
                        </td>
                        <td>{formatRelativeDate(run.startedAt)}</td>
                        <td>
                          {run.mode === "test"
                            ? "Teste · 1 linha"
                            : `${run.summary.total} registros`}
                        </td>
                        <td>
                          <span className="result-inline">
                            <i className="ok" />
                            {run.summary.success}
                          </span>
                          {run.summary.errors ? (
                            <span className="result-inline">
                              <i className="error" />
                              {run.summary.errors}
                            </span>
                          ) : null}
                        </td>
                        <td>{formatDuration(run.startedAt, run.endedAt)}</td>
                        <td>
                          <Badge
                            tone={
                              run.status === "completed"
                                ? "success"
                                : run.status === "completed_with_errors"
                                  ? "warning"
                                  : run.status === "failed"
                                    ? "danger"
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
                              navigate(
                                run.status === "running" ||
                                  run.status === "paused"
                                  ? { screen: "runner", runId: run.id }
                                  : { screen: "report", runId: run.id },
                              )
                            }
                          >
                            Abrir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={Search}
                title="Nenhuma execução corresponde à busca"
                description="Tente outro termo ou limpe a busca para ver todo o histórico."
                action={
                  <button className="quiet-link" onClick={() => setQuery("")}>
                    Limpar busca
                  </button>
                }
              />
            )}
          </>
        ) : (
          <EmptyState
            icon={History}
            title="Nenhuma execução ainda"
            description="Quando você testar ou executar uma automação, o registro completo aparecerá aqui."
          />
        )}
        <div className="privacy-footer">
          <Download size={14} /> Relatórios ficam neste computador e podem ser
          exportados quando necessário.
        </div>
      </div>
    </AppShell>
  );
}
