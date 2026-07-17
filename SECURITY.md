# Segurança do piloto Acta

## Escopo

Este MVP foi preparado para pilotos controlados com dados corporativos não críticos. Antes de distribuição ampla, ainda são necessários certificado de assinatura de código, revisão independente, processo de atualização assinado e política corporativa de retenção.

## Fronteiras aplicadas

- A interface não possui acesso direto a Node ou ao sistema de arquivos.
- Apenas canais IPC enumerados no preload ficam disponíveis ao renderer.
- Rotinas são validadas com schemas estritos e não aceitam scripts livres.
- O runner usa a versão persistida da rotina, não uma definição enviada pela interface.
- Requisições HTTP(S), WebSockets, redirects, popups e recursos externos são bloqueados fora da allowlist declarada; Service Workers são desativados.
- O navegador usa perfil próprio da Acta; não reutiliza o perfil pessoal do usuário.
- Dados locais são criptografados com a proteção oferecida pelo Windows ao usuário atual.
- Valores do cofre nunca são listados pela API; somente metadados retornam à interface.
- Campos editáveis são mascarados antes de screenshots automáticos.
- Caminhos de evidência são resolvidos por run e verificados por `realpath` antes da leitura.
- Exportações de rotina preservam estrutura e colunas, mas removem todas as linhas de dados.

## Responsabilidades do piloto

- Autorizar somente os domínios estritamente necessários, incluindo hosts de SSO e CDN quando aplicável.
- Não usar o MVP para pagamento, exclusão irreversível ou cancelamento crítico sem revisão humana.
- Manter Windows, Edge e Acta atualizados.
- Limitar acesso à conta Windows e ao diretório de dados da aplicação.
- Excluir perfis e histórico ao encerrar o piloto, conforme a política de retenção da empresa.
- Tratar arquivos CSV/XLSX importados como conteúdo não confiável e respeitar os limites definidos pelo produto.

## Itens antes de produção corporativa

- Assinar instalador e executável com certificado confiável.
- Implementar atualização assinada, canal LTS e rollback.
- Produzir SBOM e monitoramento contínuo de dependências.
- Adicionar retenção configurável e limpeza assistida de perfis/evidências.
- Integrar SSO, RBAC, aprovação e auditoria centralizada quando houver control plane.
- Executar pentest do IPC, políticas de rede, parser de arquivos e fluxo de atualização.

## Reporte

Durante o piloto, registre versão, rotina, domínio e passos para reproduzir um problema de segurança. Não inclua senha, cookie, token, planilha real ou screenshot com dados pessoais no relato.
