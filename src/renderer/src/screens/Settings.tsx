import {
  CheckCircle2,
  Database,
  HardDrive,
  KeyRound,
  LockKeyhole,
  Monitor,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { VaultEntry } from "@shared/types";
import { AppShell } from "@/components/AppShell";
import { Badge, Button, Field, Modal } from "@/components/ui";
import { bridge } from "@/lib/bridge";
import { formatRelativeDate } from "@/lib/format";
import { useApp } from "@/state/AppContext";

export function Settings(): React.JSX.Element {
  const { bootstrap, notify } = useApp();
  const [vault, setVault] = useState<VaultEntry[]>([]);
  const [showSecret, setShowSecret] = useState(false);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const refresh = async (): Promise<void> =>
    setVault(await bridge.vault.list());
  useEffect(() => {
    void refresh();
  }, []);

  const saveSecret = async (): Promise<void> => {
    setBusy(true);
    try {
      await bridge.vault.set(name, value);
      await refresh();
      setShowSecret(false);
      setName("");
      setValue("");
      notify(
        "success",
        "Credencial protegida",
        "O valor foi criptografado pelo sistema operacional.",
      );
    } catch (error) {
      notify(
        "error",
        "Não foi possível salvar",
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setBusy(false);
    }
  };

  const removeSecret = async (): Promise<void> => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await bridge.vault.remove(deleteTarget);
      await refresh();
      notify(
        "success",
        "Credencial removida",
        `“${deleteTarget}” não está mais disponível para as automações.`,
      );
      setDeleteTarget(null);
    } catch (error) {
      notify(
        "error",
        "Não foi possível remover",
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="page settings-page">
        <header className="page-header">
          <div>
            <span className="eyebrow">Ambiente local</span>
            <h1>Configurações</h1>
            <p>Navegador, proteção de dados e credenciais deste computador.</p>
          </div>
          <Badge tone="info" dot>
            Proteção local
          </Badge>
        </header>
        <div className="settings-grid">
          <section className="settings-card">
            <header>
              <span>
                <Monitor size={20} />
              </span>
              <div>
                <h2>Navegador de execução</h2>
                <p>Ambiente usado para gravar e executar automações.</p>
              </div>
            </header>
            <div className="browser-setting">
              <div className="edge-logo">e</div>
              <div>
                <strong>{bootstrap?.browserLabel ?? "Microsoft Edge"}</strong>
                <span>Modo visível · perfil dedicado da Acta</span>
              </div>
              <Badge tone="info">
                <CheckCircle2 size={11} />
                Configurado
              </Badge>
            </div>
            <div className="setting-note">
              <ShieldCheck size={16} />
              <span>
                A Acta nunca reutiliza seu perfil pessoal do navegador.
              </span>
            </div>
          </section>
          <section className="settings-card">
            <header>
              <span>
                <HardDrive size={20} />
              </span>
              <div>
                <h2>Armazenamento local</h2>
                <p>Definições, execuções e evidências.</p>
              </div>
            </header>
            <div className="storage-items">
              <div>
                <Database size={17} />
                <span>
                  <strong>Histórico local</strong>
                  <small>Até 250 execuções recentes</small>
                </span>
                <Badge tone="success">Protegido</Badge>
              </div>
              <div>
                <LockKeyhole size={17} />
                <span>
                  <strong>Capturas mascaradas</strong>
                  <small>Campos de formulário são ocultados</small>
                </span>
                <Badge tone="success">Mascarado</Badge>
              </div>
            </div>
          </section>
        </div>
        <section className="settings-card vault-card">
          <header>
            <span>
              <KeyRound size={20} />
            </span>
            <div>
              <h2>Cofre de credenciais</h2>
              <p>
                Segredos criptografados com a proteção do Windows. Os valores
                nunca aparecem nos fluxos ou relatórios.
              </p>
            </div>
            <Button icon={Plus} size="sm" onClick={() => setShowSecret(true)}>
              Nova credencial
            </Button>
          </header>
          {vault.length ? (
            <div className="vault-list">
              {vault.map((entry) => (
                <div key={entry.name}>
                  <span className="vault-key">
                    <KeyRound size={16} />
                  </span>
                  <div>
                    <strong>{entry.name}</strong>
                    <small>
                      Atualizada{" "}
                      {formatRelativeDate(entry.updatedAt).toLocaleLowerCase(
                        "pt-BR",
                      )}
                    </small>
                  </div>
                  <span className="secret-dots">••••••••••••</span>
                  <button
                    className="icon-button danger-icon"
                    aria-label={`Excluir credencial ${entry.name}`}
                    onClick={() => setDeleteTarget(entry.name)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="vault-empty">
              <KeyRound size={22} />
              <div>
                <strong>Nenhuma credencial cadastrada</strong>
                <p>
                  Você pode entrar manualmente no navegador ou proteger valores
                  reutilizáveis no cofre.
                </p>
              </div>
            </div>
          )}
        </section>
        <section className="security-principles">
          <h2>Limites de segurança deste MVP</h2>
          <div>
            <span>
              <ShieldCheck size={19} />
            </span>
            <strong>Domínios explícitos</strong>
            <p>Navegações fora da lista autorizada são bloqueadas.</p>
          </div>
          <div>
            <span>
              <LockKeyhole size={19} />
            </span>
            <strong>Sem código livre</strong>
            <p>
              Rotinas não executam JavaScript, shell ou comandos arbitrários.
            </p>
          </div>
          <div>
            <span>
              <Database size={19} />
            </span>
            <strong>Evidência controlada</strong>
            <p>Logs e capturas ficam locais, com dados sensíveis mascarados.</p>
          </div>
        </section>
        <div className="settings-version">
          Acta {bootstrap?.appVersion ?? "0.1.0"} · MVP local-first
        </div>
      </div>
      <Modal
        open={showSecret}
        onClose={() => setShowSecret(false)}
        title="Proteger uma credencial"
        description="O valor será criptografado pelo sistema operacional e só poderá ser usado neste computador."
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowSecret(false)}>
              Cancelar
            </Button>
            <Button
              loading={busy}
              disabled={!name.trim() || !value}
              onClick={() => void saveSecret()}
            >
              Salvar no cofre
            </Button>
          </>
        }
      >
        <Field label="Nome para usar nas automações">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: Portal de cursos"
          />
        </Field>
        <Field label="Valor protegido">
          <input
            type="password"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="••••••••••••"
          />
        </Field>
        <div className="secure-modal-note">
          <ShieldCheck size={17} /> A Acta não exibirá este valor novamente.
        </div>
      </Modal>
      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        closeable={!deleteBusy}
        title="Excluir esta credencial?"
        description={`A credencial “${deleteTarget ?? ""}” deixará de funcionar em qualquer automação que a utilize. Esta ação não pode ser desfeita.`}
        footer={
          <>
            <Button
              variant="ghost"
              disabled={deleteBusy}
              onClick={() => setDeleteTarget(null)}
            >
              Manter credencial
            </Button>
            <Button
              variant="danger"
              loading={deleteBusy}
              onClick={() => void removeSecret()}
            >
              Excluir credencial
            </Button>
          </>
        }
      />
    </AppShell>
  );
}
