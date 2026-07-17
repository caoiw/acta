import {
  ArrowDown,
  ArrowUp,
  Camera,
  Check,
  CheckSquare,
  ChevronDown,
  CircleDot,
  Clock3,
  Copy,
  ExternalLink,
  GitBranch,
  Keyboard,
  MousePointer2,
  PauseCircle,
  ShieldAlert,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import type { RoutineStep, StepType } from "@shared/types";
import { Badge } from "./ui";

const icons: Record<StepType, LucideIcon> = {
  open: ExternalLink,
  click: MousePointer2,
  fill: Keyboard,
  select: ChevronDown,
  check: CheckSquare,
  verify: Check,
  wait: Clock3,
  checkpoint: PauseCircle,
  screenshot: Camera,
  condition: GitBranch,
};

export function StepCard({
  step,
  index,
  selected,
  issue,
  first,
  last,
  onSelect,
  onMove,
  onDuplicate,
  onRemove,
}: {
  step: RoutineStep;
  index: number;
  selected: boolean;
  issue?: string;
  first: boolean;
  last: boolean;
  onSelect(): void;
  onMove(direction: -1 | 1): void;
  onDuplicate(): void;
  onRemove(): void;
}): React.JSX.Element {
  const [menu, setMenu] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const Icon = icons[step.type];
  return (
    <div className="timeline-node">
      <div className="timeline-rail">
        <span className={issue ? "issue" : selected ? "selected" : ""}>
          {index + 1}
        </span>
      </div>
      <article
        className={`step-card ${selected ? "selected" : ""} ${issue ? "has-issue" : ""} ${!step.enabled ? "disabled" : ""}`}
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect();
          }
        }}
      >
        <span className={`step-type-icon step-${step.type}`}>
          <Icon size={17} />
        </span>
        <div className="step-content">
          <div className="step-title-line">
            <strong>{step.label}</strong>
            {step.risk === "high" || step.risk === "critical" ? (
              <Badge tone={step.risk === "critical" ? "danger" : "warning"}>
                <ShieldAlert size={11} /> Ação de escrita
              </Badge>
            ) : null}
          </div>
          {step.description ? (
            <p>{step.description}</p>
          ) : (
            <StepMeta step={step} />
          )}
          {issue ? (
            <span className="step-issue">
              <CircleDot size={12} />
              {issue}
            </span>
          ) : null}
          {step.type === "condition" && expanded ? (
            <div className="condition-preview">
              <div className="condition-when">
                Se <b>[{step.condition.column || "Coluna"}]</b>{" "}
                {operatorLabel(step.condition.operator)}{" "}
                <b>“{step.condition.value || "valor"}”</b>
              </div>
              <div className="nested-steps">
                {step.thenSteps.length ? (
                  step.thenSteps.map((nested) => (
                    <div key={nested.id}>
                      <span>
                        <Check size={11} />
                      </span>
                      {nested.label}
                    </div>
                  ))
                ) : (
                  <em>Nenhuma ação definida</em>
                )}
              </div>
            </div>
          ) : null}
        </div>
        {step.type === "condition" ? (
          <button
            className="step-collapse"
            onClick={(event) => {
              event.stopPropagation();
              setExpanded((value) => !value);
            }}
            aria-label="Recolher regra"
          >
            <ChevronDown size={16} className={expanded ? "" : "rotate"} />
          </button>
        ) : null}
        <div className="step-menu-wrap">
          <button
            className="step-menu-button"
            onClick={(event) => {
              event.stopPropagation();
              setMenu((value) => !value);
            }}
            aria-label="Opções do passo"
          >
            •••
          </button>
          {menu ? (
            <div
              className="step-context"
              onClick={(event) => event.stopPropagation()}
            >
              <button disabled={first} onClick={() => onMove(-1)}>
                <ArrowUp size={14} />
                Mover para cima
              </button>
              <button disabled={last} onClick={() => onMove(1)}>
                <ArrowDown size={14} />
                Mover para baixo
              </button>
              <button onClick={onDuplicate}>
                <Copy size={14} />
                Duplicar
              </button>
              <button className="danger-item" onClick={onRemove}>
                <Trash2 size={14} />
                Excluir
              </button>
            </div>
          ) : null}
        </div>
      </article>
    </div>
  );
}

function StepMeta({ step }: { step: RoutineStep }): React.JSX.Element | null {
  if (step.type === "open")
    return (
      <p>
        {step.url.kind === "column"
          ? `Coluna ${step.url.value}`
          : step.url.value}
      </p>
    );
  if ("target" in step) {
    const prefix =
      step.target.strategy === "role"
        ? `${roleLabel(step.target.role)} chamado`
        : step.target.strategy === "label"
          ? "Campo"
          : step.target.strategy === "text"
            ? "Texto"
            : "Elemento";
    return (
      <p>
        {prefix} “{step.target.value}”
        {"value" in step ? (
          <>
            {" "}
            ·{" "}
            <b>
              {step.value.kind === "column"
                ? `[${step.value.value}]`
                : step.value.sensitive
                  ? "••••••"
                  : step.value.value || "valor pendente"}
            </b>
          </>
        ) : null}
      </p>
    );
  }
  if (step.type === "checkpoint") return <p>{step.message}</p>;
  if (step.type === "wait") return <p>{step.durationMs / 1000} segundos</p>;
  if (step.type === "screenshot") return <p>Captura segura da página atual</p>;
  return null;
}

function roleLabel(role?: string): string {
  const labels: Record<string, string> = {
    button: "Botão",
    link: "Link",
    checkbox: "Opção",
    textbox: "Campo",
    combobox: "Lista",
  };
  return labels[role ?? ""] ?? "Elemento";
}

function operatorLabel(operator: string): string {
  return (
    {
      equals: "for igual a",
      not_equals: "for diferente de",
      contains: "contiver",
      empty: "estiver vazio",
      not_empty: "não estiver vazio",
    }[operator] ?? operator
  );
}
