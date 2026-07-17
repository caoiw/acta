import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileSpreadsheet,
  ListPlus,
  MessageSquareText,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Upload,
  Video,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { DataSet, Routine } from "@shared/types";
import { AppShell } from "@/components/AppShell";
import { Badge, Button, Field } from "@/components/ui";
import { bridge } from "@/lib/bridge";
import { createBlankRoutine, createExampleRoutine } from "@/lib/defaults";
import { useApp } from "@/state/AppContext";

type Method = "record" | "describe" | "manual";
type Stage = "method" | "details" | "data";

export function CreateRoutine(): React.JSX.Element {
  const { bootstrap, navigate, saveRoutine, notify } = useApp();
  const [stage, setStage] = useState<Stage>("method");
  const [method, setMethod] = useState<Method>("record");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [area, setArea] = useState<Routine["area"]>("operacoes");
  const [dataSet, setDataSet] = useState<DataSet | undefined>();
  const [busy, setBusy] = useState(false);
  const urlError = useMemo(() => {
    if (!url) return "";
    try {
      const parsed = new URL(url);
      return ["http:", "https:"].includes(parsed.protocol)
        ? ""
        : "Use uma página http ou https.";
    } catch {
      return "Informe uma página completa, começando com https://.";
    }
  }, [url]);

  const chooseData = async (): Promise<void> => {
    try {
      const picked = await bridge.data.pickSpreadsheet();
      if (picked) setDataSet(picked);
    } catch (error) {
      notify(
        "error",
        "Não foi possível ler a planilha",
        error instanceof Error ? error.message : String(error),
      );
    }
  };

  const create = async (): Promise<void> => {
    if (!name.trim() || !url.trim() || urlError) return;
    setBusy(true);
    try {
      const routine = createBlankRoutine({
        name,
        description,
        area,
        url,
        dataSet,
      });
      await saveRoutine(routine);
      navigate({
        screen: "editor",
        routineId: routine.id,
        startRecording: method === "record",
      });
      notify(
        "success",
        "Automação criada",
        method === "record"
          ? "Abra o navegador e demonstre a tarefa."
          : "Agora revise e complete os passos.",
      );
    } catch (error) {
      notify(
        "error",
        "Não foi possível criar",
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setBusy(false);
    }
  };

  const useExample = async (): Promise<void> => {
    if (!bootstrap) return;
    setBusy(true);
    const routine = createExampleRoutine(
      bootstrap.demoUrl,
      "Minha primeira automação",
    );
    routine.isExample = false;
    routine.status = "draft";
    routine.lastTestedAt = undefined;
    await saveRoutine(routine);
    navigate({ screen: "editor", routineId: routine.id });
    notify(
      "success",
      "Exemplo criado",
      "A rotina está pronta para você explorar e testar.",
    );
  };

  return (
    <AppShell>
      <div className="page create-page">
        <button
          className="back-link"
          onClick={() =>
            stage === "method"
              ? navigate({ screen: "dashboard" })
              : setStage(stage === "data" ? "details" : "method")
          }
        >
          <ArrowLeft size={16} /> Voltar
        </button>
        <div className="create-progress">
          {(["method", "details", "data"] as Stage[]).map((item, index) => (
            <div
              key={item}
              className={
                stage === item
                  ? "active"
                  : ["method", "details", "data"].indexOf(stage) > index
                    ? "done"
                    : ""
              }
            >
              <span>
                {["method", "details", "data"].indexOf(stage) > index ? (
                  <Check size={13} />
                ) : (
                  index + 1
                )}
              </span>
              <label>{["Como começar", "Informações", "Dados"][index]}</label>
            </div>
          ))}
        </div>

        {stage === "method" ? (
          <section className="create-content">
            <span className="eyebrow">Ensinar uma rotina</span>
            <h1>Como você quer começar?</h1>
            <p className="lead">
              Escolha a forma mais natural para explicar como o trabalho é
              feito.
            </p>
            <div className="method-grid">
              <button
                className={`method-card ${method === "record" ? "selected" : ""}`}
                onClick={() => setMethod("record")}
              >
                <span className="method-icon">
                  <Video size={23} />
                </span>
                <Badge tone="info">Recomendado</Badge>
                <h3>Gravar uma demonstração</h3>
                <p>
                  Faça a tarefa uma vez no navegador. A Acta transforma suas
                  ações em passos revisáveis.
                </p>
                <i className="radio-mark">
                  {method === "record" ? <Check size={13} /> : null}
                </i>
              </button>
              <button
                className="method-card coming-soon"
                disabled
                aria-describedby="describe-soon"
              >
                <span className="method-icon purple">
                  <MessageSquareText size={23} />
                </span>
                <Badge tone="neutral">Em breve</Badge>
                <h3>Descrever o processo</h3>
                <p id="describe-soon">
                  A geração de rascunhos em português entrará após a validação
                  do recorder e do executor.
                </p>
                <i className="radio-mark" />
              </button>
              <button
                className={`method-card ${method === "manual" ? "selected" : ""}`}
                onClick={() => setMethod("manual")}
              >
                <span className="method-icon green">
                  <ListPlus size={23} />
                </span>
                <h3>Montar passo a passo</h3>
                <p>
                  Comece com a página inicial e adicione cada ação visualmente
                  na timeline.
                </p>
                <i className="radio-mark">
                  {method === "manual" ? <Check size={13} /> : null}
                </i>
              </button>
            </div>
            <div className="create-actions">
              <Button
                variant="secondary"
                icon={PlayCircle}
                loading={busy}
                onClick={() => void useExample()}
              >
                Explorar um exemplo completo
              </Button>
              <Button icon={ArrowRight} onClick={() => setStage("details")}>
                Continuar
              </Button>
            </div>
          </section>
        ) : null}

        {stage === "details" ? (
          <section className="create-content narrow">
            <span className="eyebrow">Informações básicas</span>
            <h1>Que tarefa vamos automatizar?</h1>
            <p className="lead">
              Use um nome que sua equipe reconheça e indique onde o processo
              começa.
            </p>
            <div className="form-card">
              <Field label="Nome da automação">
                <input
                  autoFocus
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ex.: Cadastro de colaboradores"
                />
              </Field>
              <Field
                label="O que esta automação faz?"
                hint={
                  method === "describe"
                    ? "Essa descrição será usada como contexto para organizar o rascunho."
                    : "Opcional, mas ajuda outras pessoas a entenderem a rotina."
                }
              >
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Para cada pessoa da planilha, cadastrar na plataforma e atribuir cursos conforme o cargo."
                  rows={4}
                />
              </Field>
              <div className="form-grid-two">
                <Field label="Área">
                  <select
                    value={area}
                    onChange={(event) =>
                      setArea(event.target.value as Routine["area"])
                    }
                  >
                    <option value="operacoes">Operações</option>
                    <option value="rh">RH e treinamento</option>
                    <option value="financeiro">Financeiro</option>
                    <option value="compras">Compras</option>
                    <option value="outra">Outra</option>
                  </select>
                </Field>
                <Field label="Página inicial" error={urlError}>
                  <input
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="https://sistema.empresa.com/cadastros"
                  />
                </Field>
              </div>
              {url && !urlError ? (
                <div className="domain-preview">
                  <ShieldCheck size={18} />
                  <div>
                    <strong>Domínio identificado</strong>
                    <span>
                      Esta automação poderá acessar{" "}
                      <b>{new URL(url).hostname}</b>.
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="create-actions">
              <Button variant="ghost" onClick={() => setStage("method")}>
                Voltar
              </Button>
              <Button
                icon={ArrowRight}
                disabled={!name.trim() || !url.trim() || Boolean(urlError)}
                onClick={() => setStage("data")}
              >
                Continuar
              </Button>
            </div>
          </section>
        ) : null}

        {stage === "data" ? (
          <section className="create-content narrow">
            <span className="eyebrow">Fonte de dados</span>
            <h1>Esta tarefa usa uma lista?</h1>
            <p className="lead">
              Conecte um Excel ou CSV agora. Você também poderá trocar o arquivo
              antes de executar.
            </p>
            {dataSet ? (
              <div className="dataset-card">
                <span className="file-icon">
                  <FileSpreadsheet size={24} />
                </span>
                <div>
                  <strong>{dataSet.fileName}</strong>
                  <p>
                    Aba {dataSet.sheetName} · {dataSet.rows.length} registros ·{" "}
                    {dataSet.columns.length} colunas
                  </p>
                  <div className="column-chips">
                    {dataSet.columns.map((column) => (
                      <span key={column}>{column}</span>
                    ))}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void chooseData()}
                >
                  Trocar arquivo
                </Button>
              </div>
            ) : (
              <button className="drop-zone" onClick={() => void chooseData()}>
                <span>
                  <Upload size={24} />
                </span>
                <strong>Escolher Excel ou CSV</strong>
                <p>Formatos aceitos: .xlsx, .xls e .csv</p>
              </button>
            )}
            {dataSet ? (
              <div className="data-preview">
                <div className="preview-head">
                  <strong>Prévia dos dados</strong>
                  <span>
                    Primeiros {Math.min(3, dataSet.rows.length)} registros
                  </span>
                </div>
                <div className="preview-scroll">
                  <table>
                    <thead>
                      <tr>
                        {dataSet.columns.map((column) => (
                          <th key={column}>{column}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dataSet.rows.slice(0, 3).map((row, index) => (
                        <tr key={index}>
                          {dataSet.columns.map((column) => (
                            <td key={column}>{String(row[column] ?? "")}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="no-data-option">
                <Sparkles size={18} />
                <div>
                  <strong>Você pode continuar sem planilha</strong>
                  <p>
                    Use valores fixos ou credenciais protegidas ao configurar os
                    passos.
                  </p>
                </div>
              </div>
            )}
            <div className="create-actions">
              <Button variant="ghost" onClick={() => setStage("details")}>
                Voltar
              </Button>
              <Button loading={busy} onClick={() => void create()}>
                {method === "record"
                  ? "Criar e começar gravação"
                  : "Criar automação"}
              </Button>
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
