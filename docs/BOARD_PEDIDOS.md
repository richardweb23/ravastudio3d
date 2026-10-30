# Quadro de pedidos: publicação

Aplicar em produção antes de publicar o frontend:

1. `202610300001_etapa_preparacao.sql`: adiciona a etapa ao enum. Confirmar a transação antes de prosseguir.
2. `202610300002_pedido_subtarefas.sql`: situação do pedido e checklist, com permissões e validações.
3. Publicar o frontend somente após ambas as migrações estarem aplicadas. O workflow do GitHub Pages não executa migrações.

Pedidos existentes mantêm suas etapas e prioridades e recebem situação Normal. Nenhuma subtarefa é criada automaticamente.
As subtarefas pertencem ao pedido, sem alterar itens vendidos, estoque ou valores. Pedidos entregues permitem apenas leitura da checklist.

Validação local realizada com `npm run check` (inclui PostgreSQL isolado via PGlite) e uma prévia de interface com dados fictícios: quatro colunas, tooltip via clique/teclado e Escape, checklist no cartão, criação no modal, situação, falha simulada preservando rascunho e largura de 390px.
A prévia de interface usa gravações em memória; persistência e permissões são verificadas pela suíte de banco.
