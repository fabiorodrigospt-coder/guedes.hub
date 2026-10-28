# Guedes Hub 5.1 — checkpoint da integração

Checkpoint de desenvolvimento. A aplicação publicada ainda está na versão original.

## Repositório e recuperação
- Original: branch main, commit f6e501f22832f64d46975cb99a13cc5fcee9622c.
- Integração em desenvolvimento: integracao-online-5-1.
- Nunca incluir senhas ou chaves secretas. A chave publishable em cloud.js é pública por definição.

## Escopo autorizado por Fabio
- Todo o aplicativo com dados no banco: pedidos, produção, salgados, históricos, catálogos, modelos, configurações e rascunhos.
- Cada unidade só vê seus pedidos. Fabio é administrador de todas.
- Unidades editam rascunhos; após envio no sistema, somente o administrador corrige.
- Produção e salgados são exclusivos do administrador.
- Preservar as telas, o catálogo e os dados anteriores. Manter conflitos explícitos e fila offline.

## Banco
Projeto: opixtuuscvdwmpkcbhzp, região eu-west-2.
Conexão que funciona: Primary. A conexão nomeada guedes não tem permissão neste projeto.
Tabelas anteriores confirmadas: gh_unidades, gh_perfis, gh_pedidos, gh_pedidos_historico, gh_operacao_central.
Fabio confirmou os testes SQL de RLS, fluxo rascunho/envio, auditoria de pedidos e versão da operação central.
A migração db/integracao_online.sql já foi aplicada via Supabase: gh_documentos, gh_alteracoes, auditoria central e índices.
Ainda verificar os novos objetos com testes reais de RLS e advisors.

## Implementação local
- index.html, online.css: acesso autenticado, status de sincronização e lista de pedidos.
- cloud.js: Supabase SDK, hidratação de dados, adaptador de armazenamento, fila local por usuário, controle otimista por versão, auditoria, importação de dados antigos e backup.
- workspace.html: aplicativo original adaptado para usar o armazenamento fornecido pela sessão.
- frame-bridge.js: armazenamento síncrono em memória e bloqueio de módulos por perfil; a segurança efetiva permanece no RLS.
- vendor/supabase-2.118.0.js: SDK empacotado, versão fixa, licença incluída.
- offline.html: cópia local anterior, ainda NÃO destinada a publicação como alternativa à integração.

## Trabalho pendente — não publicar antes de validar
1. Revisar a fila, idempotência após resposta perdida e conflitos quando há edição durante uma requisição.
2. Corrigir o retry do envio de pedido criado cujo primeiro envio teve resposta perdida.
3. Verificar se o frame-bridge é carregado antes de qualquer script do aplicativo.
4. Bloquear efetivamente a navegação de módulos não autorizados no iframe (dados do banco já protegidos pelo RLS).
5. Tratar todas as chaves de dados usadas pelo aplicativo; a sincronização não deve perder campos ou registros.
6. Worker novo: cache apenas de arquivos estáticos; nunca cache de API, tokens ou dados autenticados. Versão do cache nova e limpeza do cache anterior.
7. Testes Playwright com Supabase mockado (admin/unidade, produção/salgados, reload, fila offline, conflitos e logout).
8. Testes SQL no projeto com rollback, audit/read/write e isolamento.
9. Verificar chave pública e acessibilidade da API: /auth/v1/settings respondeu 200; consulta anônima de gh_unidades respondeu 401 permission denied (esperado).
10. Executar advisors. Documentar a configuração e limitações reais, incluindo importação dos dados antigos.
11. Commit final, publicar no repositório de teste e confirmar carregamento; login real com a senha do usuário será feito por Fabio, nunca pedir sua senha.

Não afirmar que a sincronização já foi entregue. Não reiniciar o projeto ou pedir novamente dados já registrados aqui.
