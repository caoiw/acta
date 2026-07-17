import { X, LoaderCircle, type LucideIcon } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

export function Button({
  children,
  variant = "primary",
  size = "md",
  icon: Icon,
  loading,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "quiet";
  size?: "sm" | "md" | "lg" | "icon";
  icon?: LucideIcon;
  loading?: boolean;
}): React.JSX.Element {
  return (
    <button
      className={`button button-${variant} button-${size} ${className}`}
      {...props}
      disabled={props.disabled || loading}
    >
      {loading ? (
        <LoaderCircle size={17} className="spin" />
      ) : Icon ? (
        <Icon size={17} />
      ) : null}
      {size !== "icon" ? (
        children
      ) : Icon ? (
        <span className="sr-only">{children}</span>
      ) : (
        children
      )}
    </button>
  );
}

export function Badge({
  children,
  tone = "neutral",
  dot = false,
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info" | "purple";
  dot?: boolean;
}): React.JSX.Element {
  return (
    <span className={`badge badge-${tone}`}>
      {dot ? <span className="badge-dot" /> : null}
      {children}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = "560px",
  closeable = true,
}: {
  open: boolean;
  onClose(): void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  width?: string;
  closeable?: boolean;
}): React.JSX.Element | null {
  const titleId = useId();
  const descriptionId = useId();
  const cardRef = useRef<HTMLElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    const card = cardRef.current;
    const focusable = card?.querySelector<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape" && closeable) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !card) return;
      const items = [
        ...card.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocus.current?.focus();
    };
  }, [open, closeable, onClose]);

  if (!open) return null;
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={closeable ? onClose : undefined}
    >
      <section
        ref={cardRef}
        className="modal-card"
        style={{ width }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          {closeable ? (
            <button
              className="icon-button"
              onClick={onClose}
              aria-label="Fechar"
            >
              <X size={19} />
            </button>
          ) : null}
        </header>
        {children ? <div className="modal-body">{children}</div> : null}
        {footer ? <footer className="modal-footer">{footer}</footer> : null}
      </section>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}): React.JSX.Element {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={24} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function ProgressBar({
  value,
  tone = "primary",
}: {
  value: number;
  tone?: "primary" | "success";
}): React.JSX.Element {
  return (
    <div
      className="progress-track"
      role="progressbar"
      aria-label="Progresso da execução"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
    >
      <div
        className={`progress-fill progress-${tone}`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <label className={`form-field ${error ? "has-error" : ""}`}>
      <span className="field-label">{label}</span>
      {children}
      {error ? (
        <span className="field-error">{error}</span>
      ) : hint ? (
        <span className="field-hint">{hint}</span>
      ) : null}
    </label>
  );
}

export function LoadingScreen(): React.JSX.Element {
  return (
    <div className="loading-screen">
      <div className="brand-mark brand-mark-large">A</div>
      <LoaderCircle className="spin" size={22} />
      <span>Preparando seu espaço de trabalho…</span>
    </div>
  );
}
