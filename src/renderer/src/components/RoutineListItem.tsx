import {
  Ellipsis,
  ExternalLink,
  Pencil,
  Play,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import type { Routine, Run } from "@shared/types";
import { formatRelativeDate, routineStatusLabel } from "@/lib/format";
import { useApp } from "@/state/AppContext";
import { Badge, Button, Modal } from "./ui";

export function RoutineListItem({
  routine,
  lastRun,
}: {
  routine: Routine;
  lastRun?: Run;
}): React.JSX.Element {
  const { navigate, removeRoutine } = useApp();
  const [menu, setMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const tone =
    routine.status === "ready"
      ? "success"
      : routine.status === "needs_review"
        ? "danger"
        : "warning";

  return (
    <article className="routine-row">
      <div className="routine-icon">
        <ShieldCheck size={20} />
      </div>
      <div className="routine-copy">
        <div className="routine-title-line">
          <h3>{routine.name}</h3>
          <Badge tone={tone}>{routineStatusLabel[routine.status]}</Badge>
          {routine.isExample ? (
            <Badge tone="purple">Exemplo guiado</Badge>
          ) : null}
        </div>
        <p>{routine.description || "Sem descrição"}</p>
        <div className="routine-meta">
          <span>
            <ExternalLink size={13} />
            {routine.domains[0]}
          </span>
          <span>v{routine.version}</span>
          <span>
            {lastRun
              ? `${formatRelativeDate(lastRun.startedAt)} · ${lastRun.summary.success} de ${lastRun.summary.total} concluídos`
              : "Ainda não executada"}
          </span>
        </div>
      </div>
      <div className="routine-actions">
        <Button
          variant="secondary"
          size="sm"
          icon={Pencil}
          onClick={() => navigate({ screen: "editor", routineId: routine.id })}
        >
          Editar
        </Button>
        <Button
          size="sm"
          icon={Play}
          onClick={() =>
            navigate({
              screen: "preflight",
              routineId: routine.id,
              mode: "all",
            })
          }
        >
          Executar
        </Button>
        <div className="menu-wrap">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMenu((value) => !value)}
            aria-label="Mais opções"
          >
            <Ellipsis size={18} />
          </Button>
          {menu ? (
            <div className="context-menu">
              <button
                onClick={() =>
                  navigate({ screen: "editor", routineId: routine.id })
                }
              >
                Abrir no editor
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="danger-item"
              >
                Excluir automação
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Excluir “${routine.name}”?`}
        description="O histórico de execuções será mantido. Esta ação não pode ser desfeita."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => void removeRoutine(routine.id)}
            >
              Excluir automação
            </Button>
          </>
        }
      />
    </article>
  );
}
