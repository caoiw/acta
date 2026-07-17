import { createServer, type Server } from "node:http";

const demoHtml = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Portal Acme Cursos</title>
  <style>
    :root{font-family:Inter,Segoe UI,sans-serif;color:#17213a;background:#f3f6fa}*{box-sizing:border-box}body{margin:0}.top{height:64px;background:#12213d;color:white;display:flex;align-items:center;padding:0 32px;gap:12px}.mark{width:30px;height:30px;border-radius:8px;background:#5b7cfa;display:grid;place-items:center;font-weight:800}.shell{max-width:1100px;margin:34px auto;padding:0 28px}.heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:22px}h1{font-size:26px;margin:0 0 6px}.muted{color:#667085;font-size:14px}.button{border:0;border-radius:9px;padding:11px 16px;font-weight:650;cursor:pointer;background:#3157d5;color:white}.button.secondary{background:#eef2ff;color:#2949a7}.panel{background:white;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 8px 26px rgba(23,33,58,.06);overflow:hidden}.table{width:100%;border-collapse:collapse}.table th,.table td{text-align:left;padding:15px 18px;border-bottom:1px solid #edf0f5;font-size:14px}.table th{font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#667085;background:#fafbfc}.tag{padding:5px 9px;background:#eaf8ef;color:#217a45;border-radius:999px;font-size:12px;font-weight:650}.empty{padding:48px;text-align:center;color:#667085}.modal-bg{position:fixed;inset:0;background:rgba(13,24,45,.46);display:none;align-items:center;justify-content:center;padding:24px}.modal-bg.open{display:flex}.modal{width:560px;background:white;border-radius:16px;box-shadow:0 24px 70px rgba(0,0,0,.25);overflow:hidden}.modal-head{padding:22px 24px;border-bottom:1px solid #edf0f5;display:flex;justify-content:space-between}.modal h2{margin:0;font-size:20px}.close{background:none;border:0;font-size:24px;color:#667085;cursor:pointer}.form{padding:22px 24px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.field{display:flex;flex-direction:column;gap:7px;margin-bottom:16px}.field.full{grid-column:1/-1}label,legend{font-size:13px;font-weight:650}.field input,.field select{height:42px;border:1px solid #cfd6e2;border-radius:8px;padding:0 12px;font:inherit}.courses{display:grid;grid-template-columns:1fr 1fr;gap:10px;border:0;padding:4px 0;margin:0}.check{display:flex;gap:8px;align-items:center;border:1px solid #e2e8f0;padding:10px;border-radius:8px;font-size:13px}.check input{width:16px;height:16px}.actions{display:flex;justify-content:flex-end;gap:10px;padding:18px 24px;background:#fafbfc;border-top:1px solid #edf0f5}.toast{position:fixed;right:28px;bottom:28px;background:#173d29;color:white;border-radius:10px;padding:14px 18px;box-shadow:0 12px 30px rgba(0,0,0,.2);display:none}.toast.show{display:block}.notice{padding:12px 15px;background:#eef4ff;border:1px solid #cfddff;border-radius:9px;color:#3157a8;margin-bottom:20px;font-size:13px}
  </style>
</head>
<body>
  <header class="top"><span class="mark">A</span><strong>Acme Cursos</strong><span style="opacity:.6">/</span><span style="opacity:.8">Administração</span></header>
  <main class="shell">
    <div class="notice">Ambiente de treinamento do Acta — nenhum dado real será enviado.</div>
    <section class="heading"><div><h1>Colaboradores</h1><div class="muted">Cadastre pessoas e atribua trilhas de aprendizagem.</div></div><button class="button" id="new" type="button">Novo colaborador</button></section>
    <div class="panel"><table class="table" aria-label="Colaboradores cadastrados"><thead><tr><th>Nome</th><th>E-mail</th><th>Cargo</th><th>Status</th></tr></thead><tbody id="rows"></tbody></table><div class="empty" id="empty">Nenhum colaborador cadastrado nesta sessão.</div></div>
  </main>
  <div class="modal-bg" id="modal" role="dialog" aria-modal="true" aria-labelledby="title">
    <div class="modal"><div class="modal-head"><div><h2 id="title">Novo colaborador</h2><div class="muted">Informe os dados e selecione os cursos.</div></div><button class="close" id="close" aria-label="Fechar">×</button></div>
      <form id="form"><div class="form"><div class="grid">
        <div class="field full"><label for="name">Nome</label><input id="name" name="name" required autocomplete="off" /></div>
        <div class="field full"><label for="email">E-mail</label><input id="email" name="email" type="email" required autocomplete="off" /></div>
        <div class="field full"><label for="role">Cargo</label><select id="role" name="role" required><option value="">Selecione</option><option>Motorista</option><option>Gestor</option><option>Analista</option><option>Assistente</option></select></div>
        <div class="field full"><fieldset class="courses"><legend class="field full">Cursos</legend><label class="check"><input type="checkbox" name="course" value="Direção defensiva" />Direção defensiva</label><label class="check"><input type="checkbox" name="course" value="Segurança operacional" />Segurança operacional</label><label class="check"><input type="checkbox" name="course" value="Liderança" />Liderança</label><label class="check"><input type="checkbox" name="course" value="Compliance" />Compliance</label></fieldset></div>
      </div></div><div class="actions"><button class="button secondary" id="cancel" type="button">Cancelar</button><button class="button" type="submit">Salvar</button></div></form>
    </div>
  </div>
  <div class="toast" role="status" id="toast">Colaborador cadastrado</div>
  <script>
    const modal=document.querySelector('#modal'),form=document.querySelector('#form'),rows=document.querySelector('#rows'),empty=document.querySelector('#empty'),toast=document.querySelector('#toast');
    const open=()=>{form.reset();modal.classList.add('open');setTimeout(()=>document.querySelector('#name').focus(),20)};
    const close=()=>modal.classList.remove('open');
    document.querySelector('#new').addEventListener('click',open);document.querySelector('#close').addEventListener('click',close);document.querySelector('#cancel').addEventListener('click',close);
    form.addEventListener('submit',event=>{event.preventDefault();const data=new FormData(form);const tr=document.createElement('tr');[data.get('name'),data.get('email'),data.get('role')].forEach(value=>{const td=document.createElement('td');td.textContent=String(value);tr.appendChild(td)});const status=document.createElement('td');status.innerHTML='<span class="tag">Ativo</span>';tr.appendChild(status);rows.appendChild(tr);empty.style.display='none';close();toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2400)});
  </script>
</body>
</html>`;

export class DemoServer {
  private server: Server | null = null;
  private port = 0;

  async start(): Promise<string> {
    if (this.server) return this.url;
    this.server = createServer((request, response) => {
      if (request.url === "/" || request.url === "/colaboradores") {
        response.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        });
        response.end(demoHtml);
        return;
      }
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Página não encontrada");
    });
    await new Promise<void>((resolve, reject) => {
      this.server?.once("error", reject);
      this.server?.listen(0, "127.0.0.1", () => {
        const address = this.server?.address();
        this.port = typeof address === "object" && address ? address.port : 0;
        resolve();
      });
    });
    return this.url;
  }

  get url(): string {
    return `http://127.0.0.1:${this.port}/colaboradores`;
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    const server = this.server;
    this.server = null;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
