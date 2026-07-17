import {
  AlertTriangle,
  ChevronDown,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import type {
  AtomicStep,
  Locator,
  RoutineStep,
  ValueBinding,
} from "@shared/types";
import { starterStep } from "@/lib/defaults";
import { Badge, Button, Field } from "./ui";

export function StepInspector({
  step,
  columns,
  onChange,
}: {
  step: RoutineStep;
  columns: string[];
  onChange(step: RoutineStep): void;
}): React.JSX.Element {
  const patch = (values: Partial<RoutineStep>): void =>
    onChange({ ...step, ...values } as RoutineStep);
  const patchTarget = (values: Partial<Locator>): void => {
    if (!("target" in step)) return;
    onChange({ ...step, target: { ...step.target, ...values } } as RoutineStep);
  };
  const patchValue = (values: Partial<ValueBinding>): void => {
    if (!("value" in step)) return;
    onChange({ ...step, value: { ...step.value, ...values } } as RoutineStep);
  };

  return (
    <aside className="inspector-panel">
      <div className="inspector-head">
        <div>
          <span>Configurar passo</span>
          <strong>{typeLabel(step.type)}</strong>
        </div>
        <Badge tone={step.enabled ? "success" : "neutral"}>
          {step.enabled ? "Ativo" : "Desativado"}
        </Badge>
      </div>
      <div className="inspector-body">
        <Field label="Como este passo aparece na timeline">
          <input
            value={step.label}
            onChange={(event) => patch({ label: event.target.value })}
          />
        </Field>

        {step.type === "open" ? (
          <Field label="Página">
            <input
              value={step.url.value}
              onChange={(event) =>
                onChange({
                  ...step,
                  url: { ...step.url, value: event.target.value },
                })
              }
              placeholder="https://sistema.empresa.com"
            />
          </Field>
        ) : null}

        {"target" in step ? (
          <TargetFields target={step.target} onChange={patchTarget} />
        ) : null}

        {"value" in step ? (
          <div className="inspector-section">
            <h4>Valor</h4>
            <Field label="De onde vem">
              <select
                value={step.value.kind === "prompt" ? "fixed" : step.value.kind}
                onChange={(event) =>
                  patchValue({
                    kind: event.target.value as ValueBinding["kind"],
                    value: "",
                  })
                }
              >
                <option value="column">Coluna da planilha</option>
                <option value="fixed">Valor fixo</option>
                <option value="secret">Credencial protegida</option>
              </select>
            </Field>
            {step.value.kind === "column" ? (
              <Field label="Coluna">
                <select
                  value={step.value.value}
                  onChange={(event) =>
                    patchValue({ value: event.target.value })
                  }
                >
                  <option value="">Escolha uma coluna</option>
                  {columns.map((column) => (
                    <option key={column}>{column}</option>
                  ))}
                </select>
              </Field>
            ) : (
              <Field
                label={step.value.kind === "secret" ? "Nome no cofre" : "Valor"}
              >
                <input
                  type={step.value.sensitive ? "password" : "text"}
                  value={step.value.value}
                  onChange={(event) =>
                    patchValue({ value: event.target.value })
                  }
                />
              </Field>
            )}
            <label className="switch-row">
              <span>
                <strong>Mascarar este dado</strong>
                <small>Oculta o valor nos registros e evidências.</small>
              </span>
              <input
                type="checkbox"
                checked={Boolean(step.value.sensitive)}
                onChange={(event) =>
                  patchValue({ sensitive: event.target.checked })
                }
              />
            </label>
          </div>
        ) : null}

        {step.type === "condition" ? (
          <ConditionFields step={step} columns={columns} onChange={onChange} />
        ) : null}
        {step.type === "wait" ? (
          <Field label="Tempo de espera (segundos)">
            <input
              type="number"
              min={0.1}
              max={120}
              step={0.5}
              value={step.durationMs / 1000}
              onChange={(event) =>
                onChange({
                  ...step,
                  durationMs: Number(event.target.value) * 1000,
                })
              }
            />
          </Field>
        ) : null}
        {step.type === "checkpoint" ? (
          <Field label="Instrução para a pessoa">
            <textarea
              rows={4}
              value={step.message}
              onChange={(event) =>
                onChange({ ...step, message: event.target.value })
              }
            />
          </Field>
        ) : null}

        {step.risk === "high" || step.risk === "critical" ? (
          <div className="risk-callout">
            <AlertTriangle size={18} />
            <div>
              <strong>
                {step.risk === "critical" ? "Ação crítica" : "Ação de escrita"}
              </strong>
              <p>
                Este passo pode alterar dados no sistema. Em caso de dúvida, a
                Acta não tentará repará-lo sozinha.
              </p>
            </div>
          </div>
        ) : null}

        <details className="advanced-options">
          <summary>
            Opções avançadas <ChevronDown size={15} />
          </summary>
          <div>
            <Field label="Tempo máximo (segundos)">
              <input
                type="number"
                min={1}
                max={120}
                value={(step.timeoutMs ?? 15000) / 1000}
                onChange={(event) =>
                  patch({ timeoutMs: Number(event.target.value) * 1000 })
                }
              />
            </Field>
            <Field label="Classificação de risco">
              <select
                value={step.risk}
                onChange={(event) =>
                  patch({ risk: event.target.value as RoutineStep["risk"] })
                }
              >
                <option value="low">Baixo · leitura</option>
                <option value="medium">Médio · preenchimento</option>
                <option value="high">Alto · gravação</option>
                <option value="critical">Crítico · irreversível</option>
              </select>
            </Field>
            <label className="switch-row">
              <span>
                <strong>Continuar se falhar</strong>
                <small>Registra a falha e tenta o próximo passo.</small>
              </span>
              <input
                type="checkbox"
                checked={Boolean(step.continueOnError)}
                onChange={(event) =>
                  patch({ continueOnError: event.target.checked })
                }
              />
            </label>
          </div>
        </details>

        <div className="inspector-security">
          <ShieldCheck size={16} />
          <span>Este passo usa apenas ações permitidas pela Acta.</span>
        </div>
      </div>
    </aside>
  );
}

function TargetFields({
  target,
  onChange,
}: {
  target: Locator;
  onChange(values: Partial<Locator>): void;
}): React.JSX.Element {
  return (
    <div className="inspector-section">
      <h4>Elemento na página</h4>
      <Field label="Como identificar">
        <select
          value={target.strategy}
          onChange={(event) =>
            onChange({ strategy: event.target.value as Locator["strategy"] })
          }
        >
          <option value="role">Tipo e nome</option>
          <option value="label">Nome do campo</option>
          <option value="text">Texto visível</option>
          <option value="placeholder">Dica do campo</option>
          <option value="testId">Identificador do sistema</option>
          <option value="css">Seletor avançado</option>
        </select>
      </Field>
      {target.strategy === "role" ? (
        <Field label="Tipo">
          <select
            value={target.role ?? "button"}
            onChange={(event) => onChange({ role: event.target.value })}
          >
            <option value="button">Botão</option>
            <option value="link">Link</option>
            <option value="checkbox">Caixa de seleção</option>
            <option value="textbox">Campo de texto</option>
            <option value="combobox">Lista de opções</option>
          </select>
        </Field>
      ) : null}
      <Field
        label={
          target.strategy === "label"
            ? "Nome do campo"
            : target.strategy === "text"
              ? "Texto esperado"
              : "Nome do elemento"
        }
      >
        <input
          value={target.value}
          onChange={(event) => onChange({ value: event.target.value })}
        />
      </Field>
    </div>
  );
}

function ConditionFields({
  step,
  columns,
  onChange,
}: {
  step: Extract<RoutineStep, { type: "condition" }>;
  columns: string[];
  onChange(step: RoutineStep): void;
}): React.JSX.Element {
  const changeCondition = (values: Partial<typeof step.condition>): void =>
    onChange({ ...step, condition: { ...step.condition, ...values } });
  const addNested = (): void => {
    const nested = starterStep("check") as AtomicStep;
    onChange({ ...step, thenSteps: [...step.thenSteps, nested] });
  };
  const updateNested = (index: number, value: string): void => {
    const nested = step.thenSteps[index];
    const next = [...step.thenSteps];
    next[index] = {
      ...nested,
      label: `Marque “${value}”`,
      ...("target" in nested
        ? { target: { ...nested.target, strategy: "label" as const, value } }
        : {}),
    } as AtomicStep;
    onChange({ ...step, thenSteps: next });
  };
  return (
    <div className="inspector-section">
      <h4>Quando</h4>
      <Field label="Coluna">
        <select
          value={step.condition.column}
          onChange={(event) => changeCondition({ column: event.target.value })}
        >
          <option value="">Escolha uma coluna</option>
          {columns.map((column) => (
            <option key={column}>{column}</option>
          ))}
        </select>
      </Field>
      <Field label="Condição">
        <select
          value={step.condition.operator}
          onChange={(event) =>
            changeCondition({
              operator: event.target.value as typeof step.condition.operator,
            })
          }
        >
          <option value="equals">For igual a</option>
          <option value="not_equals">For diferente de</option>
          <option value="contains">Contiver</option>
          <option value="empty">Estiver vazio</option>
          <option value="not_empty">Não estiver vazio</option>
        </select>
      </Field>
      {!["empty", "not_empty"].includes(step.condition.operator) ? (
        <Field label="Valor">
          <input
            value={step.condition.value ?? ""}
            onChange={(event) => changeCondition({ value: event.target.value })}
          />
        </Field>
      ) : null}
      <div className="then-heading">
        <strong>Então faça</strong>
        <Button variant="quiet" size="sm" icon={Plus} onClick={addNested}>
          Adicionar ação
        </Button>
      </div>
      <div className="nested-editor">
        {step.thenSteps.map((nested, index) => (
          <div key={nested.id}>
            <span>{index + 1}</span>
            <input
              value={"target" in nested ? nested.target.value : nested.label}
              onChange={(event) => updateNested(index, event.target.value)}
            />
            <button
              onClick={() =>
                onChange({
                  ...step,
                  thenSteps: step.thenSteps.filter(
                    (_, itemIndex) => itemIndex !== index,
                  ),
                })
              }
              aria-label="Excluir ação"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {!step.thenSteps.length ? (
          <p>Nenhuma ação definida para esta regra.</p>
        ) : null}
      </div>
    </div>
  );
}

function typeLabel(type: RoutineStep["type"]): string {
  return {
    open: "Abrir página",
    click: "Clicar",
    fill: "Preencher campo",
    select: "Selecionar opção",
    check: "Marcar caixa",
    verify: "Verificar resultado",
    wait: "Esperar",
    checkpoint: "Pausa para usuário",
    screenshot: "Tirar screenshot",
    condition: "Condição",
  }[type];
}
