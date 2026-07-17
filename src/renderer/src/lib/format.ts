import type { RunStatus, RoutineStatus } from "@shared/types";

export function formatRelativeDate(value?: string): string {
  if (!value) return "Ainda não executada";
  const date = new Date(value);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 60_000) return "Agora";
  if (diff < 3_600_000) return `Há ${Math.floor(diff / 60_000)} min`;
  if (date.toDateString() === now.toDateString()) {
    return `Hoje, ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function formatDuration(startedAt: string, endedAt?: string): string {
  if (!endedAt) return "—";
  const seconds = Math.max(
    1,
    Math.round(
      (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000,
    ),
  );
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min ${seconds % 60 ? `${seconds % 60} s` : ""}`.trim();
}

export const routineStatusLabel: Record<RoutineStatus, string> = {
  draft: "Rascunho",
  ready: "Pronta",
  needs_review: "Precisa de revisão",
};

export const runStatusLabel: Record<RunStatus, string> = {
  preparing: "Preparando",
  running: "Em andamento",
  pausing: "Pausando",
  paused: "Pausada",
  waiting: "Aguardando você",
  completed: "Concluída",
  completed_with_errors: "Concluída com avisos",
  cancelled: "Cancelada",
  failed: "Falhou",
};

export function maskValue(value: unknown): string {
  const text = String(value ?? "");
  if (!text) return "—";
  if (text.includes("@")) {
    const [name, domain] = text.split("@");
    return `${name.slice(0, 2)}•••@${domain}`;
  }
  return `${text.slice(0, 2)}${"•".repeat(Math.min(6, Math.max(3, text.length - 2)))}`;
}
