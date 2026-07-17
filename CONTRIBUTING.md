# Contribuindo com a Acta

## Preparação

Use Windows 11, Node.js 22 LTS, npm e Microsoft Edge. Depois:

```powershell
npm ci
npm run electron:install
npm run dev
```

## Fluxo de mudança

1. Abra uma issue com o problema e o resultado esperado.
2. Crie uma branch curta a partir de `main`.
3. Preserve o modelo declarativo; não introduza JavaScript ou shell em rotinas.
4. Inclua testes proporcionais ao risco da mudança.
5. Execute o gate local antes de abrir o pull request.

```powershell
npm run format:check
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e
```

## Segurança e dados

- Nunca versione senha, token, cookie, storage state, planilha real ou screenshot com dados pessoais.
- Use somente o portal local e dados fictícios nos testes.
- Novos tipos de ação precisam declarar risco, schema, comportamento de erro e limites de acesso.
- Alterações em IPC, rede, arquivos, cofre ou updater exigem revisão de segurança.

## Pull requests

Explique o que mudou, por que mudou, impacto para o usuário e como foi validado. Mantenha o escopo pequeno e não misture refatorações não relacionadas.
