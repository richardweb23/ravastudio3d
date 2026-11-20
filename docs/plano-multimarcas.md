# Plano técnico: Rava e Rivoxel

Data: 19/11/2026. Situação: proposta para revisão; nenhuma migration ou alteração de aplicação foi executada nesta etapa.

## Base e limites

- Branch `feat/multi-brand`, criada a partir de `origin/main` no commit `3b31d0c6f2c5e47ac9898195729bde45e692e4c7`.
- A Rava foi validada pelo responsável na Cloudflare; o GitHub Pages permanece como alternativa de retorno. Dois domínios utilizam o mesmo Worker. A Rivoxel apresenta a aplicação atual e permanece com `noindex` até o lançamento aprovado.
- Este levantamento se baseia nos arquivos versionados, não em uma inspeção direta dos schemas, políticas ou dados atualmente implantados. Divergências no banco de produção e na homologação ainda precisam ser verificadas por leitura, sem incluir dados pessoais nem segredos no relatório.
- O projeto `rava-homologacao` é o ambiente previsto para escrita e testes. Sua equivalência de migrations, funções, RLS, Auth e Storage precisa ser confirmada antes de qualquer alteração estrutural. O Instagram tem projeto e integrações próprios; não disparar eventos reais nos testes.
- Toda mudança de produção exigirá pull request, plano e autorização específica para migrations; sem merge automático, alteração de DNS ou mudanças no layout da Rava nesta etapa.

## 1. Estrutura e dependências encontradas

| Área | Estrutura versionada | Implicação |
| --- | --- | --- |
| Produto e estoque | `materiais` concentra identidade, código permanente, custo e quantidade; `estoque_por_local` referencia `material_id`. Compras, itens de pedidos, vendas e consignação referenciam materiais. | Preservar IDs e um estoque por item físico; não criar cópias artificiais de material. |
| Catálogo | `catalogo_produtos.material_id` é chave e referência de `materiais`; categorias, imagens e histórico de slugs se relacionam com o catálogo. `catalogo_indicacoes` é uma origem separada para marketplace. | A separação deve incluir produtos, indicações, imagens e aliases, não apenas a listagem. |
| Categorias | `catalogo_categorias` tem slug global único; `catalogo_produtos` referencia uma categoria. A estrutura versionada examinada não demonstra hierarquia de subcategorias: confirmar no banco e nos dados reais antes de desenhar a migração. | Preservar categorias e eventuais dados legados; criar hierarquia se comprovadamente necessária, sem confundir com `materiais.categoria`. |
| Pedidos e vendas | `pedidos`, `pedido_itens`, `pedido_pagamentos`, `vendas` e consignação têm relações e funções de gravação; vendas podem referenciar pedido e item. | Marca da transação precisa ser persistida, inclusive em venda avulsa; manter integridade ao editar, devolver e gerar vendas de pedido. |
| Financeiro | Despesas, parcelas, pagamentos, movimentos, reembolsos e caixas são estruturas distintas; `financeiro_resumo` e outras funções agregam dados. | Não inferir marca dos nomes dos caixas nem duplicar ou ratear lançamentos automaticamente. Rever origem, estorno, transferência e somatórios. |
| Segurança | `catalogo_publico` é RPC `security definer`; tabelas administrativas utilizam permissões e RLS. Storage possui bucket público de catálogo e políticas próprias. | Filtrar no backend, revisar todos os pontos públicos e funções privilegiadas; uma URL pública de imagem não garante confidencialidade. |
| Publicação | Vite/React, Worker com static assets, `scripts/gerar-paginas-catalogo.mjs` e sitemap atualmente voltados à Rava. Worker ativo não tem código de resolução de hostname no repositório. | Precisamos de roteamento por host e assets/SEO por marca sem misturar cache ou quebrar URLs existentes. |
| Valores históricos | `materiais.categoria` e caixas incluem nomes como Rivoxel e Rava, com significados operacionais. | Não usar esses valores para classificar marca comercial nem modificá-los automaticamente. |

Referências principais: `supabase/migrations/202609050001_initial_schema.sql`, `202610200001_catalogo.sql`, `202610310003_catalogo_indicacoes.sql`, `202611060002_pedido_links_cores.sql`, `src/services/catalogo.ts`, `src/services/vendas.ts`, `scripts/gerar-paginas-catalogo.mjs` e `wrangler.jsonc`. Verificar sempre a última definição de cada função em todas as migrations.

## 2. Modelo proposto

1. Criar `marcas` com ID estável, slug único, nome, domínio primário, estado e timestamps. Conteúdo visual/comercial pode ficar em configuração separada validada; não armazenar segredos. A lista de hostnames aceitos será controlada no servidor; não usar um host arbitrário como marca válida.
2. Atribuir inicialmente uma marca a cada material/produto, categoria e indicação existente, por vínculo explícito com Rava; criar Rivoxel sem produtos fictícios em produção. Categorias e produtos de uma marca devem ser coerentes, inclusive indicações e aliases. Preservar IDs, códigos e relacionamentos. Tratar registros sem categoria sem inventar categoria.
3. Subcategorias: inventariar o estado real. Se não houver hierarquia estruturada, propor `parent_id` com chave estrangeira, validações de mesma marca e prevenção de ciclos; preservar os níveis existentes e aprovar regras de profundidade e exclusão antes de aplicá-las.
4. Manter `materiais` e estoque como item físico canônico. No futuro, uma tabela `ofertas_marca` poderá ligar várias marcas ao mesmo `material_id`, com slug, preço, descrição, categoria e publicação próprios; estoque continua por material/local. O modelo inicial não implementa esse compartilhamento: a migração futura terá de transferir metadados, aliases, restrições e histórico sem duplicar saldo.
5. Registrar marca de origem em pedidos e vendas, incluindo vendas avulsas e derivadas de pedido. Definir e validar a regra de itens de marca diferente, preservação histórica e alterações posteriores; não atribuir automaticamente histórico comercial à Rava sem confirmar a origem. Caso não seja possível identificar a origem, manter histórico como não classificado até decisão explícita, em vez de inventar faturamento por marca. A visão consolidada inclui registros não classificados.
6. Vincular despesas e movimentações à marca apenas quando a origem for conhecida; despesa compartilhada precisa de classificação explícita, distinta de histórico ainda não classificado. Parcelas, pagamentos e estornos devem manter coerência com sua origem. Filtros por marca e consolidado não devem contar transferências internas ou valores estornados duas vezes; nenhum rateio automático.
7. Domínio da Rava mantém a gestão centralizada. A configuração sobre acesso à gestão pelo domínio Rivoxel deve ser definida na implementação sem alterar URLs de autenticação ou permissões existentes inadvertidamente. Usuários autorizados têm visão das duas marcas conforme as permissões vigentes; revisar funções privilegiadas antes de ampliar acesso.

## 3. Isolamento, hostname e SEO

- Resolver o host em um único ponto confiável com lista explícita para produção e regras separadas para homologação. O hostname informa qual site servir; não autentica usuário e não é uma credencial. Não confiar em `brand_id`, `Host` ou cabeçalhos encaminhados pelo navegador como prova de autorização perante Supabase.
- Como os dois catálogos publicados podem ser dados públicos, distinguir filtro correto de interface de sigilo real: se o endpoint anônimo permitir escolher outra marca, qualquer pessoa pode consultá-la diretamente. Se for necessário impedir acesso por API a dados não públicos, manter tais dados fora das RPCs públicas e aplicar RLS/autorizações verificadas no backend. Uma camada de Worker pode validar e encaminhar consultas, mas não protege um endpoint Supabase público alternativo que continue expondo os mesmos dados. Definir essa fronteira e remover acessos indevidos com transição compatível.
- Manter a RPC antiga compatível e restrita à Rava durante a transição; preparar contrato versionado para novas consultas por marca e revisar permissões, `security definer`, aliases, indicações, imagens e URLs diretas. Slugs atualmente são globais: preservar unicidade inicialmente reduz risco; só permitir duplicidade entre marcas após revisar referências, redirects e todas as consultas.
- O mesmo Worker precisa servir páginas e metadados diferentes para os dois hosts. Avaliar roteamento dinâmico com `run_worker_first` e assets por prefixo interno, ou outra solução equivalente, sem confiar em fallback SPA para SEO. Validar comportamento de arquivos, 404 e gestão. Cache deve separar host, marca e versão; não retornar conteúdo ou canonical de uma marca na outra.
- Gerar HTML, sitemap, canonical, Open Graph e robots por marca. Rava preserva URLs e indexação; Rivoxel e previews permanecem `noindex` até autorização. Não publicar layout, conteúdo ou identidade provisórios da Rivoxel em produção. A atualização diária existente deve gerar ambas as saídas de forma consistente e preservar o último deploy válido em caso de falha.

## 4. Migrations a preparar — ainda não criadas

Sequência lógica sujeita à auditoria real, sem executar em produção agora:

1. **Inventário e baseline:** comparar lista e hashes de migrations aplicadas, schema, constraints, funções, grants, RLS, buckets e contagens agregadas nos dois ambientes; avaliar drift e backup/recuperação. Não copiar dados reais ou segredos para homologação.
2. **Marcas e vínculos aditivos:** criar marca e colunas inicialmente compatíveis/nuláveis ou defaults controlados; backfill idempotente de produtos/categorias/indicações existentes para Rava; comprovar contagens e IDs. Criar constraints e índices em fases e verificar bloqueios e duração.
3. **Categorias e catálogo:** integridade de marca, eventual hierarquia de subcategorias, slug/alias e indicação; criar funções públicas versionadas, manter contrato antigo restrito à Rava e revisar Storage/RLS. Não retirar acesso legado antes de observar clientes antigos e migração completa.
4. **Pedidos e vendas:** adicionar marca de origem, adaptar funções de inserção/edição, vendas derivadas, avulsas, consignação e devoluções; backfill histórico somente com evidência e aprovação. Criar proteções para compatibilidade entre item, transação e marca sem quebrar versões anteriores.
5. **Financeiro e relatórios:** classificação explícita por marca/compartilhada/não classificada conforme entidade, funções de despesas, parcelas, pagamentos, movimentos, estornos e resumos. Conferir saldos e totais antigos antes e depois. Não derivar marca do caixa.
6. **Endurecimento posterior:** após os clientes migrarem, validar constraints, índices e permissões; remover compatibilidade só em fase separada e aprovada. Nenhum `NOT NULL`, troca de assinatura ou exclusão antecipada que bloqueie a versão em produção.

Cada migration deve ter pré-condições, transação quando aplicável, verificações pós-aplicação, tratamento de concorrência, testes, estimativa de locks e procedimento de recuperação. Schema aditivo não torna reversíveis os dados criados pela versão nova: definir recuperação por backup e reconciliação antes de ativar escrita. Não chamar reversão destrutiva de rollback seguro.

## 5. Etapas e critérios de aceite

| Etapa | Critério de aceite |
| --- | --- |
| 1. Branch e baseline | Branch isolada parte da `main` validada; estado do Git limpo antes das alterações e referência registrada. |
| 2. Auditoria de banco | Schema, funções, grants, RLS, Storage, Auth, migrations e contagens comparados sem dados pessoais; divergências documentadas. |
| 3. Modelo | Marca, estoque único, hierarquia, transações e tratamento de histórico aprovados; evolução para ofertas por marca documentada. |
| 4. Migrations em homologação | Migrations reproduzíveis, backfill preserva IDs, testes de integridade e compatibilidade passam; homologação isolada confirmada antes da escrita. |
| 5. Resolução de marca | Hosts aceitos, hosts desconhecidos, acesso direto e cache testados; Worker e gestão atuais permanecem funcionais. |
| 6. Catálogo e categorias | Rava preservada; Rivoxel isolada em pesquisa, filtros, produtos, aliases, indicações e backend; URLs cruzadas não expõem conteúdo indevido. |
| 7. Administração | Gestão única lista e edita marcas corretamente; permissões e operações antigas continuam válidas. |
| 8. Layouts | Rava sem regressão visual; Rivoxel independente em homologação, com materiais aprovados, sem publicar conteúdo provisório. |
| 9. Vendas e financeiro | Origem persistida, despesas compartilhadas e não classificadas distintas; consolidado, pagamentos, estornos e saldos conferidos. |
| 10. SEO | HTML, sitemap, canonical, robots e compartilhamento corretos por host; prévias e Rivoxel em `noindex` até aprovação. |
| 11. Regressão e isolamento | Typecheck, lint, testes e build, além de Auth, Storage, estoque, pedidos, financeiro, Instagram e URLs reais em homologação; sem chamadas reais indevidas. |
| 12. Produção controlada | Inventário, backup, migrations compatíveis, monitoramento e rollback revisados; autorização explícita para migration, merge e lançamento; Rava validada antes e depois. |

## 6. Rivoxel antiga e materiais

Inventariar origem, acesso, propriedade dos ativos, produtos, imagens e URLs sem importar nem excluir conteúdo. Produzir mapa de correspondências e redirecionar apenas URLs com destino válido. Solicitar logo, paleta, fontes/licenças, banners, textos, redes, WhatsApp e regras comerciais; usar placeholders somente em homologação, sem defini-los como identidade final.

## 7. Riscos e pendências

- Estado real de homologação e produção ainda não verificado nesta etapa; funções SQL, RLS e dados podem divergir do Git. Verificar disponibilidade e autenticação por meios autorizados antes de testar.
- Alterar dados ou contratos sem compatibilidade pode quebrar a Rava em execução ou publicações programadas. Testar versões antiga e nova contra schema expandido; não habilitar Rivoxel prematuramente.
- Slugs globais, aliases e URLs históricas podem colidir. Hierarquia de subcategorias precisa de confirmação real. Imagens públicas não servem como mecanismo de sigilo.
- Pedidos de diferentes marcas, origem histórica desconhecida, vendas avulsas/consignadas e despesas compartilhadas exigem regras explícitas antes de relatórios por marca; consolidado deve continuar íntegro.
- Mudança de roteamento do Worker afeta ambos os domínios; preparar preview isolado e preservar deploy anterior. DNS e CDN podem exigir propagação; disponibilidade contínua não é garantida.
- Instagram e fluxo atual do catálogo podem depender da RPC legada. Validar contrato, agendamento e autenticação sem disparar mensagens reais.
- A auditoria arquitetural anterior e os guias de Cloudflare contêm trechos históricos que já não descrevem a configuração final; atualizar a documentação de operação numa etapa própria após verificação.

## 8. Relatório desta etapa

- Branch: `feat/multi-brand`. Base: `3b31d0c6f2c5e47ac9898195729bde45e692e4c7`.
- Arquivo criado: `docs/plano-multimarcas.md`. Nenhuma migration, alteração de layout, DNS, Cloudflare ou banco realizada.
- Validação: revisão dos arquivos e dependências versionadas; `git diff --check`. Não foram executados testes de aplicação porque a etapa é documental.
- Rollback desta etapa: reverter o commit documental ou descartar a branch após verificar mudanças; não há alteração de dados a reverter.
