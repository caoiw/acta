import {
  Bot,
  CheckCircle2,
  History,
  Home,
  ListTree,
  LockKeyhole,
  Settings,
  XCircle,
} from "lucide-react";
import type { ReactNode } from "react";
import { bridge } from "@/lib/bridge";
import { useApp, type View } from "@/state/AppContext";
import { Button, Modal } from "./ui";

const navigation: Array<{
  label: string;
  icon: typeof Home;
  view: View;
  screens: View["screen"][];
}> = [
  {
    label: "Início",
    icon: Home,
    view: { screen: "dashboard" },
    screens: ["dashboard"],
  },
  {
    label: "Automações",
    icon: ListTree,
    view: { screen: "routines" },
    screens: ["routines", "editor", "create", "preflight"],
  },
  {
    label: "Execuções",
    icon: History,
    view: { screen: "runs" },
    screens: ["runs", "runner", "report"],
  },
  {
    label: "Configurações",
    icon: Settings,
    view: { screen: "settings" },
    screens: ["settings"],
  },
];

export function AppShell({
  children,
  wide = false,
}: {
  children: ReactNode;
  wide?: boolean;
}): React.JSX.Element {
  const { view, navigate, toast, clearToast, checkpoint, clearCheckpoint } =
    useApp();

  const continueCheckpoint = async (): Promise<void> => {
    if (!checkpoint) return;
    await bridge.runner.continueCheckpoint(checkpoint.runId);
    clearCheckpoint();
  };

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <div className="window-drag" />
        <div className="brand">
          <div className="brand-mark">A</div>
          <div>
            <strong>Acta</strong>
            <span>Operations Automation</span>
          </div>
        </div>
        <nav className="side-nav" aria-label="Navegação principal">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = item.screens.includes(view.screen);
            return (
              <button
                key={item.label}
                className={active ? "active" : ""}
                aria-current={active ? "page" : undefined}
                onClick={() => navigate(item.view)}
              >
                <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-spacer" />
        <div className="local-card">
          <div className="local-title">
            <LockKeyhole size={15} />
            <span>Execução local</span>
            <i />
          </div>
          <p>Seus dados e registros ficam neste computador.</p>
        </div>
        <div className="sidebar-version">
          <Bot size={13} /> Acta MVP
        </div>
      </aside>
      <main className={`app-main ${wide ? "app-main-wide" : ""}`}>
        {children}
      </main>

      {toast ? (
        <div
          className={`toast toast-${toast.tone}`}
          role="status"
          onClick={clearToast}
        >
          {toast.tone === "error" ? (
            <XCircle size={20} />
          ) : (
            <CheckCircle2 size={20} />
          )}
          <div>
            <strong>{toast.title}</strong>
            {toast.message ? <span>{toast.message}</span> : null}
          </div>
        </div>
      ) : null}

      <Modal
        open={Boolean(checkpoint)}
        onClose={() => undefined}
        closeable={false}
        title="Precisamos de você"
        description="A execução está pausada em um ponto seguro."
        footer={
          <Button onClick={() => void continueCheckpoint()}>
            Continuar execução
          </Button>
        }
      >
        <div className="checkpoint-callout">
          <span className="checkpoint-icon">
            <LockKeyhole size={20} />
          </span>
          <div>
            <strong>Conclua a ação no navegador</strong>
            <p>{checkpoint?.message}</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
