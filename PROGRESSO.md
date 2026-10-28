# Guedes Hub 5.3 — estado de retomada

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
