import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright-core";
import type { RecorderAction } from "../shared/types";
import { assertDomainAllowed } from "../shared/flow-utils";
import { RecorderPayloadSchema } from "../shared/schemas";
import type { z } from "zod";

type RecorderPayload = z.infer<typeof RecorderPayloadSchema>;

const recorderScript = `(() => {
  if (window.__actaRecorderInstalled) return;
  window.__actaRecorderInstalled = true;

  const text = (value) => String(value || '').replace(/\\s+/g, ' ').trim().slice(0, 120);
  const implicitRole = (element) => {
    const explicit = element.getAttribute('role');
    if (explicit) return explicit;
    const tag = element.tagName.toLowerCase();
    if (tag === 'button') return 'button';
    if (tag === 'a' && element.hasAttribute('href')) return 'link';
    if (tag === 'select') return 'combobox';
    if (tag === 'textarea') return 'textbox';
    if (tag === 'input') {
      const type = (element.getAttribute('type') || 'text').toLowerCase();
      if (type === 'checkbox') return 'checkbox';
      if (type === 'radio') return 'radio';
      if (['submit', 'button', 'reset'].includes(type)) return 'button';
      return 'textbox';
    }
    return '';
  };
  const labelFor = (element) => {
    if (element.labels && element.labels[0]) return text(element.labels[0].innerText || element.labels[0].textContent);
    const aria = text(element.getAttribute('aria-label'));
    if (aria) return aria;
    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
      const label = document.getElementById(labelledBy);
      if (label) return text(label.innerText || label.textContent);
    }
    return '';
  };
  const targetFor = (element) => {
    const label = labelFor(element);
    if (label) return { strategy: 'label', value: label, exact: true };
    const placeholder = text(element.getAttribute('placeholder'));
    if (placeholder) return { strategy: 'placeholder', value: placeholder, exact: true };
    const testId = text(element.getAttribute('data-testid'));
    if (testId) return { strategy: 'testId', value: testId };
    const role = implicitRole(element);
    const name = text(element.getAttribute('aria-label') || element.innerText || element.value || element.textContent);
    if (role && name) return { strategy: 'role', role, value: name, exact: true };
    if (name) return { strategy: 'text', value: name, exact: true };
    if (element.id) return { strategy: 'css', value: '#' + CSS.escape(element.id) };
    return { strategy: 'css', value: element.tagName.toLowerCase() };
  };
  const send = (payload) => {
    if (typeof window.__actaRecord === 'function') window.__actaRecord(payload).catch(() => {});
  };

  document.addEventListener('click', (event) => {
    const element = event.target && event.target.closest ? event.target.closest('button,a,[role="button"],[role="link"]') : null;
    if (!element) return;
    send({ kind: 'click', target: targetFor(element) });
  }, true);

  document.addEventListener('change', (event) => {
    const element = event.target;
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) return;
    const target = targetFor(element);
    if (element instanceof HTMLSelectElement) {
      send({ kind: 'select', target, value: element.value });
      return;
    }
    if (element instanceof HTMLInputElement && ['checkbox', 'radio'].includes(element.type)) {
      if (element.checked) send({ kind: 'check', target });
      return;
    }
    const sensitive = element instanceof HTMLInputElement && element.type === 'password';
    send({ kind: 'fill', target, value: sensitive ? '' : element.value, sensitive });
  }, true);
})();`;

export class RecorderManager {
  private context: BrowserContext | null = null;
  private actions: RecorderAction[] = [];

  constructor(
    private readonly userDataPath: string,
    private readonly emit: (action: RecorderAction) => void,
  ) {}

  async start(input: {
    url: string;
    domains: string[];
    browserChannel: "msedge" | "chrome";
  }): Promise<void> {
    await this.stop();
    assertDomainAllowed(input.url, input.domains);
    this.actions = [];
    const profilePath = join(this.userDataPath, "browser-profiles", "recorder");
    await mkdir(profilePath, { recursive: true });
    this.context = await chromium.launchPersistentContext(profilePath, {
      channel: input.browserChannel,
      headless: false,
      viewport: null,
      args: ["--start-maximized"],
      locale: "pt-BR",
      serviceWorkers: "block",
    });
    await this.context.route("**/*", async (route) => {
      const request = route.request();
      if (/^https?:/i.test(request.url())) {
        try {
          assertDomainAllowed(request.url(), input.domains);
        } catch {
          await route.abort("blockedbyclient");
          return;
        }
      }
      await route.continue();
    });
    await this.context.routeWebSocket("**/*", async (webSocket) => {
      const parsed = new URL(webSocket.url());
      const networkUrl = `${parsed.protocol === "wss:" ? "https:" : "http:"}//${parsed.host}`;
      try {
        assertDomainAllowed(networkUrl, input.domains);
        webSocket.connectToServer();
      } catch {
        await webSocket.close({ code: 1008, reason: "Domínio não autorizado" });
      }
    });
    await this.context.exposeBinding(
      "__actaRecord",
      (source, payload: unknown) => {
        const validated = RecorderPayloadSchema.safeParse(payload);
        if (!validated.success) return;
        try {
          assertDomainAllowed(source.frame.url(), input.domains);
        } catch {
          return;
        }
        this.capturePayload(validated.data);
      },
    );
    await this.context.addInitScript({ content: recorderScript });
    this.context.on("page", (page) => this.attachPage(page, input.domains));

    const pages = this.context.pages();
    const page = pages[0] ?? (await this.context.newPage());
    this.attachPage(page, input.domains);
    await page.goto(input.url, { waitUntil: "domcontentloaded" });
  }

  async stop(): Promise<RecorderAction[]> {
    const result = structuredClone(this.actions);
    if (this.context) {
      const context = this.context;
      this.context = null;
      await context.close().catch(() => undefined);
    }
    return result;
  }

  private attachPage(page: Page, domains: string[]): void {
    page.on("framenavigated", (frame) => {
      if (frame !== page.mainFrame()) return;
      const url = frame.url();
      if (!url || url === "about:blank") return;
      try {
        assertDomainAllowed(url, domains);
        const parsed = new URL(url);
        this.push({
          id: crypto.randomUUID(),
          kind: "open",
          url,
          label: `Abriu ${parsed.hostname}${parsed.pathname === "/" ? "" : parsed.pathname}`,
          timestamp: new Date().toISOString(),
        });
      } catch {
        void page.close();
      }
    });
  }

  private capturePayload(payload: RecorderPayload): void {
    const targetName = payload.target.value;
    const labels: Record<RecorderPayload["kind"], string> = {
      click: `Clicou em “${targetName}”`,
      fill: payload.sensitive
        ? `Preencheu uma credencial protegida em “${targetName}”`
        : `Preencheu o campo “${targetName}”`,
      select: `Selecionou uma opção em “${targetName}”`,
      check: `Marcou “${targetName}”`,
    };
    const action: RecorderAction = {
      id: crypto.randomUUID(),
      kind: payload.kind,
      target: payload.target,
      value: payload.value,
      sensitive: payload.sensitive,
      label: labels[payload.kind],
      timestamp: new Date().toISOString(),
    };
    const previous = this.actions.at(-1);
    if (
      previous &&
      action.kind === "fill" &&
      previous.kind === "fill" &&
      previous.target?.strategy === action.target?.strategy &&
      previous.target?.value === action.target?.value
    ) {
      this.actions[this.actions.length - 1] = action;
      this.emit(action);
      return;
    }
    this.push(action);
  }

  private push(action: RecorderAction): void {
    const previous = this.actions.at(-1);
    if (
      action.kind === "open" &&
      previous?.kind === "open" &&
      previous.url === action.url
    )
      return;
    this.actions.push(action);
    this.emit(action);
  }
}
