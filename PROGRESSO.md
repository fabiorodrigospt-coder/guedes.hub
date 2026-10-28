# Guedes Hub 5.6 — estado de retomada

## Escopo autorizado e implementado
- Sincronização dos pedidos, produção, salgados, históricos, catálogos, modelos, preferências, rascunhos e gestão operacional.
- Unidades acessam seus próprios pedidos; administrador acessa todas.
- Unidade edita rascunho. Após envio no sistema, somente administrador corrige.
- Produção e salgados exclusivos do administrador.

## Projeto
- GitHub: fabiorodrigospt-coder/guedeshub-teste.
- Original antes da integração: f6e501f22832f64d46975cb99a13cc5fcee9622c.
- Checkpoint intermediário: branch integracao-online-5-1, commit 3d3aa9e12a1ef0c7ead271885c14d0538820a155.
- Supabase: opixtuuscvdwmpkcbhzp, região eu-west-2. A conexão Primary tem acesso. A conexão nomeada guedes não tem permissão neste projeto.

## Estado técnico
- Migrações complementares aplicadas: documentos/auditoria central, chaves versionadas, número de produção único.
- Snapshot real da estrutura, sem dados, em db/schema_snapshot.sql.
- Testes SQL e navegador passaram. Worker não armazena dados autenticados no Cache API.
- Original preservado no histórico Git. Dados antigos do navegador são importados por ação explícita, sem apagar a origem.
- Senhas nunca foram solicitadas. Login real pelo titular continua necessário para validação final em aparelhos físicos.

## Próximo passo
Código validado publicado na main no commit ff4a090d2bd4150c1de3b30282c732546c63df1f. GitHub Pages iniciou a implantação. Confirmar carregamento e orientar Fabio a entrar com o usuário administrador e importar os dados antigos no navegador original.

Detalhes de funcionamento, limitações e verificação em README.md. Não recriar projeto nem pedir novamente os dados já configurados.

Publicação: o código validado foi promovido para main por atualização atômica do Git. Nenhum dado operacional é incluído no repositório; somente código, estrutura e testes.

## Atualização 5.2 — 28/10/2026
- Causa confirmada: catálogo restrito no leitor, whitelist na consolidação/reabertura e somente Francesinha selecionada inicialmente.
- Corrigidos leitura de todas as categorias, Stretto, aliases explícitos, preservação de produtos desconhecidos/queijo ambíguo e frações mistas.
- Arquivo original enviado por Fabio validado localmente: 25 produtos com todos os totais corretos, sem misturar estoque. Nenhum dado desse arquivo é publicado no GitHub.
- Testes do leitor, navegador com API simulada (incluindo salvar/reabrir a leitura) e worker passaram.
- Versão 5.2 preparada para o mesmo endereço de teste. Nenhuma migração de banco ou escrita em dados operacionais foi feita nesta correção.
- Próximo passo do usuário após implantação: Ctrl+F5, verificar 5.2 e analisar novamente a lista original. Os históricos antigos não são recalculados automaticamente.

## Ajustes visuais 5.3 — 28/10/2026
- Base preservada: e5de30347df125ea15a3b4e0328ac7f654564596, já com menu externo único.
- Solicitação de Fabio: somente Casa Guedes, conta sem e-mail, manutenção dentro de Ajustes por engrenagem discreta.
- Implementado diálogo acessível para os controles existentes, sem mudar permissões ou banco. Ajustes operacionais do administrador preservados.
- Testes do leitor com lista original, navegador (administrador e G1) e worker passaram; visual mobile conferido.
- Publicação autorizada no endereço de teste. Usuário deve verificar versão 5.3 ao atualizar.

## Cadastro e permissões 5.5 — 28/10/2026
- Escopo confirmado por Fabio: cadastrar pessoas das casas, produção e salgados com nome/e-mail/senha; administrador escolhe módulos, consulta/edição e criação. Padrão: somente próprios registros, sem outras casas.
- Base GitHub: 2850b7cb60caadcd78d21b30c29e3dede567b4b8. Layout 5.4 e ocultação de botões das casas preservados.
- Migrações aplicadas: gh55_usuarios_acessos, gh55_configuracao_usuarios_alias e gh55_codigos_operadores; versão consolidada em db/usuarios_acessos.sql.
- Edge Function gh-usuarios ativa. Valida token via Auth e perfil administrador ativo antes de usar a chave privilegiada interna. RPCs somente service_role; sem senhas em tabelas, logs do aplicativo, filas ou backups.
- Novo formulário users.js inserido em Gestão Local apenas para administrador. Cadastro, edição de permissões/senha e desativação. Administradores protegidos.
- SQL real com rollback passou, endpoint nega chamadas anônimas/inválidas; testes do servidor, navegador com API simulada, leitor original 25 produtos e worker passaram. Sem usuários temporários persistidos.
- Ao atualizar para 5.5, Fabio pode criar a primeira conta real pela Gestão Local e validar o login. Não pedir novamente credenciais de infraestrutura nem senhas de usuários no chat.

## Login simples e CRUD de usuários 5.6 — 28/10/2026
- Fabio autorizou nome de acesso sem e-mail obrigatório e senhas de 6 caracteres nesta etapa, mantendo futura edição de e-mail e senha. Pediu adicionar, editar e excluir usuários.
- Perfil ganhou login_nome único sem diferenciar maiúsculas e excluido. Excluir arquiva e desativa, com preservação de histórico; restaurar disponível no formulário. Administradores protegidos.
- Migração gh56_login_simples_e_exclusao aplicada. RPCs de resolução, limitação e gestão somente service_role.
- Edge gh-login ativa: autentica nome+senha no Auth, limites por nome, sem expor e-mail ou senha. Edge gh-usuarios atualizada para cadastros com e-mail técnico, nomes de acesso, senha mínima 6, edição de e-mail/senha e exclusão.
- SQL real com rollback e suíte completa passaram; nome/senha no navegador testados com API simulada. Endpoint real retornou 401 para credenciais inválidas. Nenhuma conta operacional criada nem senha existente alterada automaticamente.
- Publicação 5.6 no endereço de teste; administrador define os nomes de acesso cadastrando ou editando as contas. Seu login atual por e-mail continua válido.


## Versão 5.7 — identificação automática nos relatórios
Relatórios novos de produção e salgados preenchem responsável/líder com o nome do perfil autenticado. Trocar a data de uma produção nova mantém esse preenchimento. Abrir relatórios existentes preserva o nome registrado. Não altera contas, permissões ou dados históricos.
