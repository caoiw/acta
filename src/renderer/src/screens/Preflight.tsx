import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ExternalLink,
  FileSpreadsheet,
  LockKeyhole,
  Monitor,
  Play,
  ShieldAlert,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Badge, Button } from "@/components/ui";
import { bridge } from "@/lib/bridge";
import { maskValue } from "@/lib/format";
import { flattenRoutineSteps, validateRoutineForRun } from "@shared/flow-utils";
import { useApp } from "@/state/AppContext";

export function Preflight(): React.JSX.Element {
  const { view, routines, bootstrap, navigate, saveRoutine, notify } = useApp();
  if (view.screen !== "preflight") return <></>;
  const routine = routines.find((item) => item.id === view.routineId);
  if (!routine)
    return (
      <AppShell>
        <div className="page">
          <h1>Automação não encontrada</h1>
        </div>
      </AppShell>
    );
  const [busy, setBusy] = useState(false);
  const rows = routine.dataSet?.rows ?? [{}];
  const rowIndices = view.rowIndices?.length
    ? view.rowIndices
    : rows.map((_, index) => index);
  const total =
    view.mode === "test" ? Math.min(1, rowIndices.length) : rowIndices.length;
  const allSteps = useMemo(
    () => flattenRoutineSteps(routine.steps),
    [routine.steps],
  );
  const highRisk = useMemo(
    () =>
      allSteps.filter(
        (step) => step.risk === "high" || step.risk === "critical",
      ),
    [allSteps],
  );
  const validationIssues = useMemo(
    () => validateRoutineForRun(routine),
    [routine],
  );
  const requiresTest = view.mode !== "test" && routine.status !== "ready";
  const blocked = validationIssues.length > 0 || requiresTest;

  const pickData = async (): Promise<void> => {
    try {
      const dataSet = await bridge.data.pickSpreadsheet();
      if (!dataSet) return;
      await saveRoutine({
        ...routine,
        dataSet,
        status: "draft",
        lastTestedAt: undefined,
        updatedAt: new Date().toISOString(),
      });
      notify(
        "success",
        "Planilha atualizada",
        "Como os dados mudaram, execute um novo teste antes do lote.",
      );
    } catch (error) {
      notify(
        "error",
        "Não foi possível ler a planilha",
        error instanceof Error ? error.message : String(error),
      );
    }
  };

  const start = async (): Promise<void> => {
    setBusy(true);
    try {
      const result = await bridge.runner.start({
        routineId: routine.id,
        routineVersion: routine.version,
        mode: view.mode,
        rowIndices,
      });
      navigate({ screen: "runner", runId: result.runId });
    } catch (error) {
      notify(
        "error",
        "Não foi possível iniciar",
        error instanceof Error ? error.message : String(error),
      );
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="page preflight-page">
        <button
          className="back-link"
          onClick={() => navigate({ screen: "editor", routineId: routine.id })}
        >
          <ArrowLeft size={16} /> Voltar ao editor
        </button>
        <header className="page-header preflight-header">
          <div>
            <span className="eyebrow">Revisão antes de executar</span>
            <h1>
              {view.mode === "test"
                ? "Testar uma linha"
                : view.mode === "retry"
                  ? "Reexecutar registros com erro"
                  : `Executar “${routine.name}”`}
            </h1>
            <p>Confira o escopo, os acessos e as alterações esperadas.</p>
          </div>
          <Badge tone="neutral">Versão {routine.version}</Badge>
        </header>

        {validationIssues.length ? (
          <div className="blocking-banner">
            <ShieldAlert size={20} />
            <div>
              <strong>A definição precisa de ajustes</strong>
              <p>{validationIssues[0].message}</p>
            </div>
            <Button
              size="sm"
              onClick={() =>
                navigate({ screen: "editor", routineId: routine.id })
              }
            >
              Corrigir no editor
            </Button>
          </div>
        ) : requiresTest ? (
          <div className="blocking-banner">
            <ShieldAlert size={20} />
            <div>
              <strong>A automação mudou desde o último teste</strong>
              <p>
                Execute uma linha para validar esta versão antes de processar
                todos os registros.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() =>
                navigate({
                  screen: "preflight",
                  routineId: routine.id,
                  mode: "test",
                })
              }
            >
              Testar agora
            </Button>
          </div>
        ) : null}

        <div className="preflight-grid">
          <div className="preflight-main">
            <section className="review-card">
              <div className="review-card-head">
                <span className="review-icon">
                  <FileSpreadsheet size={20} />
                </span>
                <div>
                  <h2>Dados</h2>
                  <p>Arquivo e registros usados nesta execução.</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Upload}
                  onClick={() => void pickData()}
                >
                  Trocar arquivo
                </Button>
              </div>
              {routine.dataSet ? (
                <div className="file-review">
                  <div>
                    <strong>{routine.dataSet.fileName}</strong>
                    <span>
                      Aba {routine.dataSet.sheetName} · {total}{" "}
                      {total === 1 ? "registro" : "registros"} nesta execução
                    </span>
                  </div>
                  <Badge tone="info">
                    {routine.dataSet.columns.length} colunas
                  </Badge>
                </div>
              ) : (
                <div className="file-review">
                  <div>
                    <strong>Sem planilha conectada</strong>
                    <span>
                      Somente valores fixos ou credenciais já configuradas serão
                      usados.
                    </span>
                  </div>
                </div>
              )}
              {routine.dataSet ? (
                <div className="preflight-preview">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        {routine.dataSet.columns.slice(0, 4).map((column) => (
                          <th key={column}>{column}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rowIndices
                        .slice(0, view.mode === "test" ? 1 : 3)
                        .map((rowIndex) => (
                          <tr key={rowIndex}>
                            <td>{rowIndex + 1}</td>
                            {routine.dataSet?.columns
                              .slice(0, 4)
                              .map((column) => (
                                <td key={column}>
                                  {routine.sensitiveColumns.includes(column)
                                    ? maskValue(
                                        routine.dataSet?.rows[rowIndex]?.[
                                          column
                                        ],
                                      )
                                    : String(
                                        routine.dataSet?.rows[rowIndex]?.[
                                          column
                                        ] ?? "",
                                      )}
                                </td>
                              ))}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {total > 3 ? (
                    <span className="more-rows">
                      e mais {total - 3} registros
                    </span>
                  ) : null}
                </div>
              ) : null}
            </section>

            <section className="review-card">
              <div className="review-card-head">
                <span className="review-icon">
                  <LockKeyhole size={20} />
                </span>
                <div>
                  <h2>Acesso e navegador</h2>
                  <p>A execução usa um perfil separado e visível.</p>
                </div>
              </div>
              <div className="access-grid">
                <div>
                  <span>Destino</span>
                  <strong>
                    <ExternalLink size={15} />
                    {routine.domains[0]}
                  </strong>
                </div>
                <div>
                  <span>Navegador</span>
                  <strong>
                    <Monitor size={15} />
                    {bootstrap?.browserLabel ?? "Microsoft Edge"}
                  </strong>
                </div>
                <div>
                  <span>Sessão</span>
                  <strong>
                    <CheckCircle2 size={15} />
                    Login manual quando necessário
                  </strong>
                </div>
                <div>
                  <span>Execução</span>
                  <strong>
                    <ShieldCheck size={15} />
                    Local neste computador
                  </strong>
                </div>
              </div>
              <div className="info-callout">
                <Monitor size={18} />
                <span>
                  O navegador ficará visível. Faça login ou conclua o MFA quando
                  necessário; a Acta não registra sua senha.
                </span>
              </div>
            </section>

            <section className="review-card">
              <div className="review-card-head">
                <span className="review-icon">
                  <ShieldAlert size={20} />
                </span>
                <div>
                  <h2>O que será feito</h2>
                  <p>Ações e permissões declaradas nesta versão.</p>
                </div>
              </div>
              <ul className="action-summary">
                <li>
                  <span>
                    <Check size={14} />
                  </span>
                  Processar {total} {total === 1 ? "registro" : "registros"} de
                  forma sequencial.
                </li>
                <li>
                  <span>
                    <Check size={14} />
                  </span>
                  Preencher dados em {routine.domains[0]}.
                </li>
                <li>
                  <span>
                    <Check size={14} />
                  </span>
                  Executar {allSteps.length} passos e registrar o resultado de
                  cada um.
                </li>
                {highRisk.length ? (
                  <li className="high">
                    <span>
                      <ShieldAlert size={14} />
                    </span>
                    {highRisk.length}{" "}
                    {highRisk.length === 1 ? "ação altera" : "ações alteram"}{" "}
                    dados no sistema.
                  </li>
                ) : null}
              </ul>
            </section>
          </div>

          <aside className="run-summary-card">
            <span className="summary-kicker">Resumo da execução</span>
            <h2>{total}</h2>
            <p>
              {total === 1
                ? "registro será processado"
                : "registros serão processados"}
            </p>
            <div className="summary-divider" />
            <dl>
              <div>
                <dt>Automação</dt>
                <dd>{routine.name}</dd>
              </div>
              <div>
                <dt>Versão</dt>
                <dd>{routine.version}</dd>
              </div>
              <div>
                <dt>Modo</dt>
                <dd>
                  {view.mode === "test"
                    ? "Teste controlado"
                    : view.mode === "retry"
                      ? "Reexecução de falhas"
                      : "Execução completa"}
                </dd>
              </div>
              <div>
                <dt>Alterações</dt>
                <dd>{highRisk.length} ações de escrita</dd>
              </div>
            </dl>
            <div className="local-assurance">
              <ShieldCheck size={18} />
              <div>
                <strong>Dados locais</strong>
                <span>Nada é enviado pela Acta para a nuvem.</span>
              </div>
            </div>
            <Button
              size="lg"
              icon={Play}
              loading={busy}
              disabled={blocked || total === 0}
              onClick={() => void start()}
            >
              {view.mode === "test" ? "Iniciar teste" : "Iniciar execução"}
            </Button>
            <button
              className="quiet-link"
              onClick={() =>
                navigate({ screen: "editor", routineId: routine.id })
              }
            >
              Revisar passos novamente
            </button>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
