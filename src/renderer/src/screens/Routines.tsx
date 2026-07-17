import { FileUp, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RoutineListItem } from "@/components/RoutineListItem";
import { Button, EmptyState } from "@/components/ui";
import { useApp } from "@/state/AppContext";

export function Routines(): React.JSX.Element {
  const { routines, runs, navigate, importRoutine } = useApp();
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () =>
      routines.filter((routine) =>
        `${routine.name} ${routine.description} ${routine.domains.join(" ")}`
          .toLocaleLowerCase("pt-BR")
          .includes(query.toLocaleLowerCase("pt-BR")),
      ),
    [query, routines],
  );
  return (
    <AppShell>
      <div className="page">
        <header className="page-header">
          <div>
            <span className="eyebrow">Biblioteca</span>
            <h1>Automações</h1>
            <p>Ensine, teste e mantenha seus processos web em um só lugar.</p>
          </div>
          <div className="header-actions">
            <Button
              variant="secondary"
              icon={FileUp}
              onClick={() => void importRoutine()}
            >
              Importar
            </Button>
            <Button icon={Plus} onClick={() => navigate({ screen: "create" })}>
              Nova automação
            </Button>
          </div>
        </header>
        <div className="toolbar">
          <div className="search-box">
            <Search size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar automação ou domínio"
            />
          </div>
          <span>
            {filtered.length}{" "}
            {filtered.length === 1 ? "automação" : "automações"}
          </span>
        </div>
        {filtered.length ? (
          <div className="routine-list spacious">
            {filtered.map((routine) => (
              <RoutineListItem
                key={routine.id}
                routine={routine}
                lastRun={runs.find((run) => run.routineId === routine.id)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Search}
            title={
              query
                ? "Nenhuma automação corresponde à busca"
                : "Nenhuma automação criada"
            }
            description={
              query
                ? "Tente outro termo ou limpe a busca para ver toda a biblioteca."
                : "Crie uma rotina para começar a automatizar um processo web."
            }
            action={
              <Button
                variant={query ? "quiet" : "primary"}
                onClick={() =>
                  query ? setQuery("") : navigate({ screen: "create" })
                }
              >
                {query ? "Limpar busca" : "Nova automação"}
              </Button>
            }
          />
        )}
      </div>
    </AppShell>
  );
}
