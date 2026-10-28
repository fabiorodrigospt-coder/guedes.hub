# Guedes Hub 5.1

Aplicação Casa Guedes/Stretto com autenticação Supabase e sincronização por conta. Mantém as telas operacionais do pacote 5.0.

## Uso

1. Entrar com o usuário criado em Supabase Auth e vinculado a `gh_perfis`.
2. Preencher o aplicativo e salvar o formulário. A barra superior distingue pendência de confirmação pelo banco.
3. No primeiro acesso do administrador, usar **Importar dados antigos deste navegador**, no navegador e no endereço onde o aplicativo anterior foi usado. A cópia antiga não é apagada. Também é possível **Importar backup** completo.
4. **Enviar no sistema** bloqueia edição pela unidade. Compartilhar no WhatsApp é uma ação separada e não comprova entrega.
5. Quando outro aparelho gravar novos dados, a lista é atualizada em até 15 segundos com a página visível. Usar **Atualizar dados** para carregar a área de trabalho; formulários abertos não são substituídos automaticamente.

## Dados e acesso

- Pedidos guiados: `gh_pedidos`, com RLS por unidade e histórico em `gh_pedidos_historico`.
- Produção e salgados: `gh_operacao_central`, exclusivos do administrador.
- Catálogos, modelos, preferências, rascunhos, consolidações e gestão operacional: `gh_documentos`, separados por escopo central/unidade. O catálogo central pode ser lido pelas unidades; somente o administrador o altera.
- Auditoria de operação central e documentos: `gh_alteracoes`, sem gravação direta pelos clientes.
- Identificações de equipe na seção Gestão são cadastros operacionais; não concedem permissões de login.

## Recuperação e integridade

- Escritas usam a versão conhecida do registro. Conflitos permanecem pendentes, com exportação antes de descartar.
- Respostas de rede perdidas são reconciliadas antes de repetir uma gravação.
- Sem internet, alterações da sessão aberta ficam numa fila local por usuário e aba. Não limpar o armazenamento antes da confirmação pelo banco ou da exportação do backup. O primeiro acesso e a reabertura autenticada exigem internet.
- Pendências de outra aba podem ser recuperadas pelo botão correspondente; fechar as outras abas antes da recuperação.
- Importações incorporam registros ausentes e preservam registros existentes com conteúdo diferente. Não removem silenciosamente registros do banco nem sobrescrevem configurações já existentes.
- A exclusão definitiva de registros sincronizados não está liberada na interface.
- Backup exportado inclui a fotografia dos dados carregados, pendências e, quando a rede permite, os eventos de auditoria autorizados. Guardar fora do aparelho. A auditoria não substitui backup independente.
- O service worker armazena somente os arquivos estáticos. APIs, tokens e respostas autenticadas não são armazenados no Cache API.

## Desenvolvimento

```sh
npm ci
npx playwright install chromium
npm test
```

O SDK Supabase 2.118.0 e sua licença estão em `vendor/`; o navegador não depende de CDN. A chave publishable é pública e depende de Auth + RLS. Nunca adicionar senhas, chaves secretas ou `service_role` ao projeto.

`db/schema_snapshot.sql` registra o schema existente após a integração, sem dados ou usuários. Destina-se a um **projeto Supabase vazio**, não a execução sobre o banco atual. `db/integracao_online.sql` registra a migração complementar, já aplicada neste projeto. Os testes SQL em `tests/database.sql` usam transação e rollback.

## Validação realizada

- SQL no projeto: administrador, isolamento de documentos por unidade, bloqueio da operação central, versões, auditoria, bloqueio de elevação de perfil e acesso anônimo.
- Navegadores com API simulada: formulário original de produção, salgados, modelos, segundo dispositivo, conflito de versão, envio/bloqueio, importação preservando a origem, reconciliação de resposta perdida, fila offline e logout.
- Worker: atualização do cache anterior, somente arquivos estáticos, API fora do cache e abertura da interface offline.
- Interface responsiva: ausência de transbordamento horizontal em 390 px.
- API real: chave pública aceita pelo Auth; consulta anônima das tabelas bloqueada.

O login real com as senhas dos usuários e o teste em dois aparelhos físicos devem ser feitos por seus titulares. Nenhuma senha foi solicitada ou usada no desenvolvimento.

O Security Advisor também sinalizou proteção contra senhas vazadas desativada; essa configuração de autenticação não foi alterada. Referência: [Password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
