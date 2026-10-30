# Guedes Hub 5.9

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
- Worker: cache separado por aplicação, preservação dos caches de outros aplicativos, somente arquivos estáticos, API fora do cache e abertura da interface offline.
- Interface responsiva: ausência de transbordamento horizontal em 390 px.
- API real: chave pública aceita pelo Auth; consulta anônima das tabelas bloqueada.

O login real com as senhas dos usuários e o teste em dois aparelhos físicos devem ser feitos por seus titulares. Nenhuma senha foi solicitada ou usada no desenvolvimento.

O Security Advisor também sinalizou proteção contra senhas vazadas desativada; essa configuração de autenticação não foi alterada. Referência: [Password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Correção do leitor — 5.2

- Remove a restrição a Francesinha e Molho de Prego na leitura, consolidação e reabertura do histórico.
- Todas as categorias começam selecionadas; Stretto tem a categoria Produtos.
- Consulta o catálogo por unidade; nomes fora do catálogo ficam visíveis com aviso para conferência. Reconhece variantes explícitas de nomes, sem aproximação por similaridade.
- Preserva campos vazios e zeros, separa CONTAGEM de PEDIDOS e mantém medidas distintas em totais separados. Corrige frações mistas como `1 3/4`.
- Apresentações ambíguas de Gouda permanecem visíveis com aviso, sem conversão em caixas.
- Validação local com o arquivo original de 27/10/2026: 25 produtos positivos, todos os totais conferidos, G1 sem pedidos. O arquivo operacional não foi incluído no repositório.
- Navegador com API simulada: analisar a lista, visualizar 25 totais, salvar no documento sincronizado e reabrir o histórico; testes anteriores de produção, salgados, conflito, isolamento, fila offline e worker também passaram.

Relatórios antigos não são reprocessados automaticamente: para recuperar itens descartados pelo leitor anterior, cole a lista original e use **Analisar listas** novamente. A versão não executa migrações nem altera registros existentes no banco.

Regressões sintéticas: `npm test`. Para conferir um arquivo original local sem versioná-lo: `GH_ORIGINAL_LIST=/caminho/lista.txt npm test` (a conferência opcional espera a lista de 27/10/2026 usada nesta correção).

## Identificação e Ajustes — 5.3

- Cabeçalho, identificação institucional e rodapé usam Casa Guedes.
- Cartão da conta exibe nome e perfil, sem o e-mail; mantém o status de sincronização.
- Engrenagem acessível por teclado e identificada como Ajustes abre um diálogo com atualização, exportação/importação de backup, importação local (administrador) e saída.
- Ajustes operacionais continuam disponíveis ao administrador pelo diálogo. Unidade mantém apenas os controles de conta já permitidos.
- Testes do navegador verificam os dois perfis, abertura/fechamento do diálogo, identificação sem e-mail e preservação de sincronização. Layout visual conferido em 390 px.

## Cadastro de usuários e níveis de acesso — 5.5

Em Gestão Local, somente o administrador tem o formulário Cadastro de usuários. Cria contas reais no Supabase Auth com nome, e-mail e senha, associa uma das casas existentes e libera um ou mais módulos: pedidos, produção e salgados. A senha deve ter 12 a 128 caracteres. Na edição, deixar a senha vazia mantém a atual; o e-mail de login não é alterado pelo formulário. Não cria novos administradores nem modifica contas de administrador.

Cada módulo define consulta, edição e criação separadamente. O padrão é somente registros do próprio autor. Pedidos também admitem mesma casa, casas adicionais selecionadas e todas as casas; produção e salgados admitem próprios registros ou todo o setor. Edição nunca pode ser mais ampla que consulta. Pedidos enviados continuam bloqueados para edição por não administradores. Desativação e mudanças de permissões são verificadas no banco a cada operação; a interface detecta a revisão alterada e exige nova entrada, preservando pendências locais para exportação.

As contas anteriores de unidade sem configuração explícita mantêm o módulo de pedidos, agora restrito ao próprio autor e à casa vinculada. Rascunhos e modelos de novos usuários usam escopo pessoal `usuario:<uuid>`; documentos antigos continuam preservados. Produção de colaboradores recebe um sufixo de operador no número de controle para evitar colisão com o controle existente do administrador.

### Backend e instalação

- `db/usuarios_acessos.sql` contém a migração consolidada, já aplicada neste projeto, incluindo as correções transacionais. Para uma restauração vazia, aplicar após `db/schema_snapshot.sql`; não reaplicar sobre o banco atual.
- `supabase/functions/gh-usuarios/` contém a Edge Function implantada. As variáveis padrão `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` ficam exclusivamente no servidor. Nenhuma chave privilegiada está nos arquivos do cliente.
- O gateway está com `verify_jwt=false` porque a função valida explicitamente o token via Auth `/user` e consulta o perfil ativo do chamador antes de qualquer operação administrativa. Não há modo anônimo de cadastro. As RPCs de provisionamento e listagem aceitam execução somente por `service_role`.
- Perfis, módulos, alterações de acesso e autoria são persistidos no banco. `gh_usuarios_auditoria` registra alterações sem senhas; tem RLS, sem privilégios para clientes e sem políticas de acesso direto, intencionalmente.
- A criação não envia convite por e-mail. O administrador define a senha no formulário e entrega as credenciais à pessoa. Não inserir senhas em mensagens, arquivos de configuração ou código.

### Validação 5.5

- `tests/access.sql`, executado no banco real com rollback: isolamento entre pessoas da mesma casa e de casas diferentes; consulta sem edição; edição de casas selecionadas; produção e salgados por autor; rascunhos pessoais; bloqueio após envio; conta desativada; proibição de autoelevação; revisão concorrente e auditoria dos acessos. Nenhum usuário temporário permaneceu.
- `tests/users-server.test.cjs`: autenticação e autorização do endpoint, criação via API simulada, limpeza de conta recém-criada quando a configuração falha, senha fora da resposta e proteção de administradores.
- `tests/browser.test.cjs`: cadastro e edição pela interface com API simulada, senhas ausentes do armazenamento local, menus de colaborador, gravação pelos formulários reais de produção/salgados e detecção de revogação. Layout conferido em desktop e 390 px.
- Endpoint implantado: chamadas sem token e com token inválido retornaram 401. O primeiro cadastro real e o login com a senha definida devem ser feitos pelo titular no formulário; nenhum usuário operacional foi criado durante o desenvolvimento.

Se houver uma falha de rede durante um cadastro, atualizar a lista antes de tentar novamente. Um e-mail já existente não é sobrescrito pelo fluxo de criação. Se a conta existir no Auth sem perfil (provisionamento interrompido), ela não recebe acesso ao aplicativo e precisa de revisão administrativa.

## Nome de acesso e gerenciamento completo — 5.6

- Login aceita nome de acesso ou o e-mail existente. Cadastro por nome de acesso é o modo principal; nome para exibição e e-mail são opcionais. Nomes de acesso têm 3 a 32 caracteres, começam com uma letra e aceitam letras sem acentos, números, ponto, hífen e sublinhado. A comparação ignora maiúsculas/minúsculas, sem duplicatas.
- A pedido de Fabio, o mínimo da senha no aplicativo passou de 12 para 6 caracteres. Não há senha padrão preenchida ou atribuída automaticamente. A política de autenticação do projeto também é aplicada pelo Supabase Auth. É possível definir uma senha mais longa ou adicionar e-mail real depois em Editar usuário.
- Para contas sem e-mail informado, o serviço cria um endereço técnico único no domínio reservado `login.guedeshub.invalid`. Esse endereço não recebe mensagens nem aparece na lista; não é a senha nem uma forma pública de descobrir a conta.
- `gh-login` resolve o nome apenas no servidor e delega a verificação da senha ao Auth. A resposta entrega somente a sessão ao cliente. Respostas de credenciais incorretas não revelam se o usuário existe; há limite de 10 tentativas por nome em 15 minutos, reiniciado após login válido. Tabelas de limite e resolução de e-mail são inacessíveis por clientes.
- Novo usuário, Editar usuário e Excluir ficam na Gestão Local. Excluir arquiva a conta, bloqueia o acesso e mantém a autoria e os históricos; não remove o usuário do Auth nem registros operacionais. Mostrar usuários excluídos permite restaurar pelo formulário. Nomes de acesso excluídos ficam reservados para restauração. Contas de administrador ficam protegidas.
- E-mail deixado em branco durante edição mantém o endereço atual. Nova senha em branco mantém a atual. Atualização de senha/e-mail pelo Auth e permissões pelo Postgres não é uma transação única; qualquer falha parcial é informada e a lista deve ser atualizada antes de repetir.

`db/login_simples.sql` registra a migração complementar aplicada após `db/usuarios_acessos.sql`. Implantar também `supabase/functions/gh-login/` e atualizar `gh-usuarios`, incluindo `import_map_path=deno.json` quando substituir a função existente.

Validação: `tests/login.sql` no banco real, com rollback, confirmou unicidade, resolução restrita, limite de tentativas, exclusão preservando pedidos, bloqueio da sessão e restauração. Testes do endpoint, cadastro sem e-mail, senha de 6 caracteres, entrada por nome, edição/exclusão/restauração e regressões operacionais passaram com API simulada. Endpoint real de login recusou credenciais inválidas com 401. Nenhuma senha ou conta existente foi alterada automaticamente.


## Versão 5.7 — identificação automática nos relatórios
Relatórios novos de produção e salgados preenchem responsável/líder com o nome do perfil autenticado. Trocar a data de uma produção nova mantém esse preenchimento. Abrir relatórios existentes preserva o nome registrado. Não altera contas, permissões ou dados históricos.


## Versão 5.8 — validação e mensagens curtas
Campos obrigatórios e valores inválidos recebem borda vermelha, aviso curto, aria-invalid/aria-describedby e foco no primeiro erro. Pedidos guiados destacam casa, modo, data e quantidades; relatórios e formulários de cadastro destacam os campos envolvidos. Campos opcionais permanecem opcionais. Avisos somem ao corrigir. Salvamento de pedidos e relatórios mostra fila/offline/erro e só confirma Salvo após a confirmação do banco. Sem alterações nas permissões ou no banco.


## Versão 5.9 — limite Molho Francesinha

No leitor, entrada `30` sem unidade equivale a 30 litros, não 30 bidões. Múltiplos de 30 acima de 10 são lidos como litros com aviso; valores acima de 10 sem unidade e não múltiplos de 30 exigem correção manual. Pedidos acima de 300 litros/dia, somando todas as casas da lista, bloqueiam salvamento, WhatsApp e cópia de histórico. Filtros não reduzem o total. CONTAGEM não entra na soma. Pedido Guiado aceita bidões (1 = 30 L) e confere pedidos visíveis no histórico local sincronizado. O limite entre aparelhos só é garantido se todos os pedidos relevantes estiverem visíveis; ainda falta validação transacional no servidor. Registros antigos não são corrigidos automaticamente. Sem alterações no banco ou nas permissões.

## Auditoria automatizada (5.9)

O workflow `.github/workflows/auditoria-guedes-hub.yml` executa `npm test` em cada atualizacao de `main` e semanalmente (segunda-feira, 07:00 UTC), com acionamento manual em **Actions** > **Auditoria automatica — Guedes Hub** > **Run workflow**. Usa Playwright com API e registros ficticios: **nao cria nem altera pedidos reais**. Relatorios e capturas sao anexados na execucao do GitHub Actions por 14 dias. Executa tambem `tests/version-consistency.test.cjs`, que confere a versao entre interface, iframe, backup e cache.

Na execucao manual ou semanal, `tests/live-smoke.test.cjs` abre o **site publico**, confere desktop e celular, carregamento, versao, campos de login e erros JavaScript **sem enviar credenciais**. Esse teste nao faz login, nao envia WhatsApp e nao altera o banco de producao. O conjunto nao garante ausencia de todos os erros: fluxos autenticados completos entre varias unidades exigem ambiente de homologacao isolado, contas ficticias proprias e simulacoes concorrentes.


## Homologacao isolada — seis unidades

O teste `tests/homologation.test.cjs` utiliza Chromium e a interface real servida em `127.0.0.1:8876`; substitui a API do Supabase por respostas ficticias interceptadas pelo Playwright. O teste nao autentica contas de producao, nao chama o banco real e nao envia WhatsApp. Cobre login, escolha de unidade, preenchimento de pedidos, conferencia, salvamento, historico, RLS simulada, acesso do administrador, alteracao conflitante em dois navegadores, exclusao logica de usuarios mantendo seus historicos e bloqueio local por quantidade acima de 300 L. O relatorio `auditoria/homologacao.json` fica no artefato da execucao do GitHub Actions.

**Limitacao conhecida:** o teste intercepta a API e verifica o controle de permissao modelado, nao substitui testes RLS reais. A soma de 300 L de Molho Francesinha **entre todas as contas e em edicoes concorrentes** ainda exige uma regra transacional no banco real e outra bateria em banco de homologacao separado. Nao foi criado projeto Supabase nem alterada a base de producao.
