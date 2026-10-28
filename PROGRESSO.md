# Guedes Hub 5.1 — estado de retomada

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
Publicar o commit validado na branch main do repositório de teste e confirmar o carregamento pelo GitHub Pages. Então orientar Fabio a entrar com o usuário administrador e importar os dados antigos no navegador original.

Detalhes de funcionamento, limitações e verificação em README.md. Não recriar projeto nem pedir novamente os dados já configurados.

Publicação: o código validado está sendo promovido para main por atualização atômica do Git. Nenhum dado operacional é incluído no repositório; somente código, estrutura e testes.
