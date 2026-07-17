import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  Download,
  FileImage,
  LockKeyhole,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { RunItem, RunItemStatus } from "@shared/types";
import { AppShell } from "@/components/AppShell";
import { Badge, Button } from "@/components/ui";
import { bridge } from "@/lib/bridge";
import {
  formatDuration,
  formatRelativeDate,
  runStatusLabel,
} from "@/lib/format";
import { useApp } from "@/state/AppContext";

type Filter =
  "all" | "success" | "skipped" | "error" | "needs_review" | "cancelled";

export function Report(): React.JSX.Element {
  const { view, runs, routines, navigate, notify, refreshRuns } = useApp();
  if (view.screen !== "report") return <></>;
  const run = runs.find((item) => item.id === view.runId);
  const routine = run
    ? routines.find((item) => item.id === run.routineId)
    : undefined;
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<RunItem | null>(null);
  const [artifact, setArtifact] = useState<string | null>(null);
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!run) void refreshRuns();
  }, [run, refreshRuns]);

  useEffect(() => {
    setArtifact(null);
    const path = selected?.error?.screenshotPath;
    if (path)
      void bridge.runs
        .readArtifact(run?.id ?? "", selected.index)
        .then(setArtifact)
        .catch(() => setArtifact(null));
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const drawer = drawerRef.current;
    const focusableSelector =
      'button:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
    drawer?.querySelector<HTMLElement>(focusableSelector)?.focus();
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        setSelected(null);
        return;
      }
      if (event.key !== "Tab" || !drawer) return;
      const focusable = [
        ...drawer.querySelectorAll<HTMLElement>(focusableSelector),
      ];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [selected?.index]);

  const filtered = useMemo(() => {
    if (!run) return [];
    return run.items.filter((item) => {
      const matchesFilter = filter === "all" || item.status === filter;
      const matchesQuery = `${item.index + 1} ${item.label}`
        .toLocaleLowerCase("pt-BR")
        .includes(query.toLocaleLowerCase("pt-BR"));
      return matchesFilter && matchesQuery;
    });
  }, [run, filter, query]);

  if (!run)
    return (
      <AppShell>
        <div className="page">
          <h1>Relatório não encontrado</h1>
        </div>
      </AppShell>
    );
  const successPercent = run.summary.total
    ? (run.summary.success / run.summary.total) * 100
    : 0;
  const skipPercent = run.summary.total
    ? (run.summary.skipped / run.summary.total) * 100
    : 0;
  const actualErrorPercent = run.summary.total
    ? (run.summary.errors / run.summary.total) * 100
    : 0;
  const reviewPercent = run.summary.total
    ? (run.summary.needsReview / run.summary.total) * 100
    : 0;
  const remainingPercent = Math.max(
    0,
    100 - successPercent - skipPercent - actualErrorPercent - reviewPercent,
  );
  const hasWarnings =
    run.summary.errors > 0 ||
    run.summary.needsReview > 0 ||
    run.status === "cancelled" ||
    run.status === "failed";

  const exportCsv = async (): Promise<void> => {
    const path = await bridge.runs.exportCsv(run.id);
    if (path) notify("success", "Relatório exportado", path);
  };

  const retryErrors = (): void => {
    const rowIndices = run.items
      .filter(
        (item) => item.status === "error" || item.status === "needs_review",
      )
      .map((item) => item.index);
    navigate({
      screen: "preflight",
      routineId: run.routineId,
      mode: "retry",
      rowIndices,
    });
  };

  return (
    <AppShell>
      <div className="page report-page">
        <button
          className="back-link"
          onClick={() => navigate({ screen: "runs" })}
        >
          <ArrowLeft size={16} /> Histórico de execuções
        </button>
        <header className="report-header">
          <div className={`report-seal ${hasWarnings ? "warning" : "success"}`}>
            {hasWarnings ? (
              <AlertCircle size={27} />
            ) : (
              <CheckCircle2 size={27} />
            )}
          </div>
          <div>
            <div className="report-title-line">
              <h1>{reportTitle(run.status)}</h1>
              <Badge tone={hasWarnings ? "warning" : "success"}>
                {runStatusLabel[run.status]}
              </Badge>
            </div>
            <p>
              {run.routineName} · Versão {run.routineVersion}
            </p>
            <span>
              {formatRelativeDate(run.startedAt)} ·{" "}
              {formatDuration(run.startedAt, run.endedAt)}
            </span>
          </div>
          <div className="report-actions">
            <Button
              variant="secondary"
              icon={RefreshCw}
              onClick={() =>
                navigate({
                  screen: "preflight",
                  routineId: run.routineId,
                  mode: "all",
                })
              }
            >
              Executar novamente
            </Button>
            {run.summary.errors || run.summary.needsReview ? (
              <Button
                variant="secondary"
                icon={RefreshCw}
                onClick={retryErrors}
              >
                Reexecutar pendências
              </Button>
            ) : null}
            <Button icon={Download} onClick={() => void exportCsv()}>
              Exportar CSV
            </Button>
          </div>
        </header>

        <section className="report-summary">
          <div className="report-stat">
            <span>Processados</span>
            <strong>{run.summary.processed}</strong>
            <small>de {run.summary.total} registros</small>
          </div>
          <div className="report-stat success">
            <span>Concluídos</span>
            <strong>{run.summary.success}</strong>
            <small>{Math.round(successPercent)}% do total</small>
          </div>
          <div className="report-stat neutral">
            <span>Ignorados</span>
            <strong>{run.summary.skipped}</strong>
            <small>sem alteração</small>
          </div>
          <div className="report-stat error">
            <span>Com atenção</span>
            <strong>{run.summary.errors + run.summary.needsReview}</strong>
            <small>
              {run.summary.errors || run.summary.needsReview
                ? "requerem revisão"
                : "nenhuma pendência"}
            </small>
          </div>
        </section>
        <div
          className="segmented-progress"
          aria-label="Distribuição dos resultados"
        >
          <span className="success" style={{ width: `${successPercent}%` }} />
          <span className="skipped" style={{ width: `${skipPercent}%` }} />
          <span className="review" style={{ width: `${reviewPercent}%` }} />
          <span className="error" style={{ width: `${actualErrorPercent}%` }} />
          <span
            className="remaining"
            style={{ width: `${remainingPercent}%` }}
          />
        </div>

        <section className="report-results">
          <div className="section-heading">
            <div>
              <h2>Resultado por registro</h2>
              <p>Abra um item para consultar seus passos e evidências.</p>
            </div>
            <div className="report-search">
              <Search size={16} />
              <input
                placeholder="Buscar nome ou número"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>
          <div className="filter-tabs">
            <button
              className={filter === "all" ? "active" : ""}
              onClick={() => setFilter("all")}
            >
              Todos <span>{run.summary.total}</span>
            </button>
            <button
              className={filter === "success" ? "active" : ""}
              onClick={() => setFilter("success")}
            >
              Concluídos <span>{run.summary.success}</span>
            </button>
            <button
              className={filter === "skipped" ? "active" : ""}
              onClick={() => setFilter("skipped")}
            >
              Ignorados <span>{run.summary.skipped}</span>
            </button>
            <button
              className={filter === "needs_review" ? "active" : ""}
              onClick={() => setFilter("needs_review")}
            >
              Revisão <span>{run.summary.needsReview}</span>
            </button>
            <button
              className={filter === "error" ? "active" : ""}
              onClick={() => setFilter("error")}
            >
              Com erro <span>{run.summary.errors}</span>
            </button>
            <button
              className={filter === "cancelled" ? "active" : ""}
              onClick={() => setFilter("cancelled")}
            >
              Não processados{" "}
              <span>
                {run.items.filter((item) => item.status === "cancelled").length}
              </span>
            </button>
          </div>
          <div className="table-card">
            <table className="data-table report-table">
              <thead>
                <tr>
                  <th>Registro</th>
                  <th>Identificação</th>
                  <th>Status</th>
                  <th>Último passo</th>
                  <th>Duração</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr
                    key={item.index}
                    tabIndex={0}
                    aria-label={`Abrir detalhes do registro ${item.index + 1}`}
                    onClick={() => setSelected(item)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelected(item);
                      }
                    }}
                  >
                    <td>#{item.index + 1}</td>
                    <td>
                      <strong>{item.label}</strong>
                      <span>
                        {routine?.dataSet && routine.sensitiveColumns.length
                          ? "Dados sensíveis protegidos"
                          : item.key}
                      </span>
                    </td>
                    <td>
                      <ItemBadge status={item.status} />
                    </td>
                    <td>
                      {item.error
                        ? (item.stepRecords.at(-1)?.label ??
                          "Falha na preparação")
                        : "—"}
                    </td>
                    <td>
                      {item.startedAt
                        ? formatDuration(item.startedAt, item.endedAt)
                        : "—"}
                    </td>
                    <td>
                      <ChevronRight size={16} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length ? (
              <div className="table-empty">
                Nenhum registro corresponde a este filtro.
              </div>
            ) : null}
          </div>
        </section>
        <div className="privacy-footer">
          <LockKeyhole size={14} /> Este relatório está armazenado somente neste
          computador.
        </div>
      </div>

      {selected ? (
        <div className="drawer-backdrop" onMouseDown={() => setSelected(null)}>
          <aside
            ref={drawerRef}
            className="result-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={`Detalhes do registro ${selected.index + 1}`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span>Registro {selected.index + 1}</span>
                <h2>{selected.label}</h2>
              </div>
              <button
                className="icon-button"
                aria-label="Fechar detalhes"
                onClick={() => setSelected(null)}
              >
                <X size={19} />
              </button>
            </header>
            <div className="drawer-body">
              <ItemBadge status={selected.status} />
              {selected.error ? (
                <div className="drawer-error">
                  <AlertCircle size={20} />
                  <div>
                    <strong>{selected.error.title}</strong>
                    <p>{selected.error.message}</p>
                  </div>
                </div>
              ) : (
                <div className="drawer-success">
                  <CheckCircle2 size={20} />
                  <div>
                    <strong>Registro concluído</strong>
                    <p>Todos os passos e a validação final foram executados.</p>
                  </div>
                </div>
              )}
              {selected.error?.screenshotPath ? (
                <section className="drawer-section">
                  <h3>Evidência segura</h3>
                  {artifact ? (
                    <img
                      className="error-artifact"
                      src={artifact}
                      alt="Captura da página no momento da falha, com campos mascarados"
                    />
                  ) : (
                    <div className="artifact-placeholder">
                      <FileImage size={28} />
                      <span>Carregando captura mascarada…</span>
                    </div>
                  )}
                  <p className="artifact-note">
                    <ShieldCheck size={14} /> Campos preenchidos foram ocultados
                    antes da captura.
                  </p>
                </section>
              ) : null}
              <section className="drawer-section">
                <h3>Passos executados</h3>
                <div className="drawer-steps">
                  {selected.stepRecords.map((record) => (
                    <div key={`${record.stepId}-${record.startedAt}`}>
                      <span className={record.status}>
                        {record.status === "success" ? (
                          <Check size={12} />
                        ) : (
                          <AlertCircle size={12} />
                        )}
                      </span>
                      <div>
                        <strong>{record.label}</strong>
                        <small>
                          {record.status === "success"
                            ? "Concluído"
                            : record.message}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              {selected.inputSnapshot ? (
                <details className="technical-details">
                  <summary>Dados usados neste registro</summary>
                  <dl>
                    {Object.entries(selected.inputSnapshot).map(
                      ([column, value]) => (
                        <div key={column}>
                          <dt>{column}</dt>
                          <dd>{String(value ?? "—")}</dd>
                        </div>
                      ),
                    )}
                  </dl>
                </details>
              ) : null}
            </div>
            {selected.status === "error" ? (
              <footer>
                <Button
                  variant="secondary"
                  icon={RefreshCw}
                  onClick={() =>
                    navigate({
                      screen: "preflight",
                      routineId: run.routineId,
                      mode: "retry",
                      rowIndices: [selected.index],
                    })
                  }
                >
                  Tentar este registro novamente
                </Button>
                <Button
                  onClick={() =>
                    navigate({ screen: "editor", routineId: run.routineId })
                  }
                >
                  Corrigir o passo
                </Button>
              </footer>
            ) : null}
          </aside>
        </div>
      ) : null}
    </AppShell>
  );
}

function ItemBadge({ status }: { status: RunItemStatus }): React.JSX.Element {
  if (status === "success")
    return (
      <Badge tone="success">
        <Check size={11} />
        Concluído
      </Badge>
    );
  if (status === "error")
    return (
      <Badge tone="danger">
        <AlertCircle size={11} />
        Com erro
      </Badge>
    );
  if (status === "skipped") return <Badge tone="neutral">Ignorado</Badge>;
  if (status === "needs_review")
    return <Badge tone="warning">Revisão necessária</Badge>;
  if (status === "cancelled")
    return <Badge tone="neutral">Não processado</Badge>;
  return (
    <Badge tone="info">
      {status === "running" ? "Em andamento" : "Aguardando"}
    </Badge>
  );
}

function reportTitle(status: string): string {
  if (status === "completed") return "Tudo concluído";
  if (status === "cancelled") return "Execução cancelada";
  if (status === "failed") return "A execução falhou";
  return "Execução concluída com avisos";
}
