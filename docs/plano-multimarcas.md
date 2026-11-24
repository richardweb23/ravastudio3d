# Plano técnico: Rava e Rivoxel

> **Definição funcional confirmada pelo responsável em 24/11/2026:** no **Catálogo do Site**, `Rava` e `Rivoxel` serão categorias principais, cada uma com suas próprias subcategorias. O site da Rava exibirá somente os produtos da categoria principal Rava e oferecerá suas subcategorias no filtro de busca; o site da Rivoxel fará o mesmo com a categoria principal Rivoxel e suas subcategorias. Esta é uma classificação de publicação do site. As propostas anteriores de separar por marca no cadastro operacional ou tratar marca como uma seleção independente da categoria principal estão superadas.
>
> A mudança se limita ao Catálogo do Site e à apresentação pública. Não modificar caixas, valores, categorias operacionais dos produtos, cadastro, estoque, pedidos, vendas ou financeiro para fazer essa separação. As categorias operacionais existentes `Rava`, `Rivoxel` e `Bonecos` permanecem como estão e não devem ser usadas para inferir a categoria do site.
>
> **Escopo confirmado em 24/11/2026:** a separação entre Rava e Rivoxel é somente para apresentação e catálogo dos sites. Caixas, categorias operacionais, estoque, pedidos, vendas, financeiro e demais fluxos do sistema de gestão não devem ser separados nem alterados para identificar marca. As propostas anteriores neste documento que sugerem essa separação estão superadas. Qualquer suporte ao catálogo deve ser restrito à gestão do que aparece nos sites e preservar o comportamento operacional existente.
>
> Antes de publicar, revisar as migrations já preparadas em homologação: as etapas intermediárias `202611230005` e `202611230006` envolveram funções de cadastro ou duplicação de produtos, e a `202611230007` removeu a primeira função. Não aplicar essa sequência automaticamente em produção; preparar e verificar uma solução compatível com o escopo confirmado e com o estado real do banco.

Data: 19/11/2026. Situação: proposta para revisão; nenhuma migration ou alteração de aplicação foi executada nesta etapa.

## Base e limites

- Branch `feat/multi-brand`, criada a partir de `origin/main` no commit `3b31d0c6f2c5e47ac9898195729bde45e692e4c7`.
- A Rava foi validada pelo responsável na Cloudflare; o GitHub Pages permanece como alternativa de retorno. Dois domínios utilizam o mesmo Worker. A Rivoxel apresenta a aplicação atual e permanece com `noindex` até o lançamento aprovado.
- O levantamento original se baseou nos arquivos versionados. Em 20/11/2026 foi feita uma comparação de metadados implantados, com diferenças e limites documentados em `docs/auditoria-ambientes-multimarcas.md`; Auth, acesso efetivo, dados e integrações ainda exigem validação.
- O projeto `rava-homologacao` é o ambiente previsto para escrita e testes. Sua equivalência de migrations, funções, RLS, Auth e Storage precisa ser confirmada antes de qualquer alteração estrutural. O Instagram tem projeto e integrações próprios; não disparar eventos reais nos testes.
- Toda mudança de produção exigirá pull request, plano e autorização específica para migrations; sem merge automático, alteração de DNS ou mudanças no layout da Rava nesta etapa.

## 1. Estrutura e dependências encontradas

| Área | Estrutura versionada | Implicação |
| --- | --- | --- |
| Produto e estoque | `materiais` concentra identidade, código permanente, custo e quantidade; `estoque_por_local` referencia `material_id`. Compras, itens de pedidos, vendas e consignação referenciam materiais. | Preservar IDs e um estoque por item físico; não criar cópias artificiais de material. |
| Catálogo | `catalogo_produtos.material_id` é chave e referência de `materiais`; categorias, imagens e histórico de slugs se relacionam com o catálogo. `catalogo_indicacoes` é uma origem separada para marketplace. | A separação deve incluir produtos, indicações, imagens e aliases, não apenas a listagem. |
| Categorias | `catalogo_categorias` tem slug global único; `catalogo_produtos` referencia uma categoria. A estrutura versionada examinada não demonstra hierarquia de subcategorias: confirmar no banco e nos dados reais antes de desenhar a migração. | Preservar categorias e eventuais dados legados; criar hierarquia se comprovadamente necessária, sem confundir com `materiais.categoria`. |
| Pedidos e vendas | `pedidos`, `pedido_itens`, `pedido_pagamentos`, `vendas` e consignação têm relações e funções de gravação; vendas podem referenciar pedido e item. | Preservar os fluxos existentes, sem adicionar separação por marca. |
| Financeiro | Despesas, parcelas, pagamentos, movimentos, reembolsos e caixas são estruturas distintas; `financeiro_resumo` e outras funções agregam dados. | Preservar os caixas e o comportamento financeiro existente, sem separação por marca. |
| Segurança | `catalogo_publico` é RPC `security definer`; tabelas administrativas utilizam permissões e RLS. Storage possui bucket público de catálogo e políticas próprias. | Filtrar no backend, revisar todos os pontos públicos e funções privilegiadas; uma URL pública de imagem não garante confidencialidade. |
| Publicação | Vite/React, Worker com static assets, `scripts/gerar-paginas-catalogo.mjs` e sitemap atualmente voltados à Rava. Worker ativo não tem código de resolução de hostname no repositório. | Precisamos de roteamento por host e assets/SEO por marca sem misturar cache ou quebrar URLs existentes. |
| Valores históricos | `materiais.categoria` e caixas incluem nomes como Rivoxel e Rava, com significados operacionais. | Não usar esses valores para classificar marca comercial nem modificá-los automaticamente. |

Referências principais: `supabase/migrations/202609050001_initial_schema.sql`, `202610200001_catalogo.sql`, `202610310003_catalogo_indicacoes.sql`, `202611060002_pedido_links_cores.sql`, `src/services/catalogo.ts`, `src/services/vendas.ts`, `scripts/gerar-paginas-catalogo.mjs` e `wrangler.jsonc`. Verificar sempre a última definição de cada função em todas as migrations.

## 2. Modelo proposto

1. Criar `marcas` com ID estável, slug único, nome, domínio primário, estado e timestamps. Conteúdo visual/comercial pode ficar em configuração separada validada; não armazenar segredos. A lista de hostnames aceitos será controlada no servidor; não usar um host arbitrário como marca válida.
2. Atribuir inicialmente uma marca a cada material/produto, categoria e indicação existente, por vínculo explícito com Rava; criar Rivoxel sem produtos fictícios em produção. A etapa inicial usa tabelas de associação com uma marca por cadastro e triggers para vincular novos registros legados à Rava, sem mudar a forma das tabelas consultadas pelas RPCs atuais. A consistência entre marcas de produtos e categorias e os filtros públicos ainda serão implementados antes de permitir cadastros Rivoxel. Preservar IDs, códigos e relacionamentos. Tratar registros sem categoria sem inventar categoria.
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

## 9. Desenvolvimento incremental: associações legadas

- Migration `202611230002_marcas_catalogo_base.sql`: tabelas de vínculo para materiais, categorias e indicações; backfill de registros existentes para Rava e atribuição de Rava aos novos cadastros legados. Não permite por si só selecionar a Rivoxel nem separa o catálogo público.
- Aplicada apenas em `rava-homologacao`: um material e uma categoria existentes vinculados à Rava; nenhuma indicação existente. Nenhuma migration em produção. O vínculo a cada categoria ou indicação adicional foi testado em PGlite.
- `npm run check`: 104 testes de aplicação e 60 testes de banco isolado, typecheck, lint e build. Teste de rollback do catálogo demonstra que as novas dependências impedem reversão legada até existir procedimento específico.
- Antes da produção, revisar grants, locks e concorrência durante backfill, contagens por tabela, compatibilidade dos clientes antigos e backup. Reverter vínculos destrói classificações armazenadas: qualquer rollback após permitir outras marcas exige plano de dados e autorização específica.

## 10. Desenvolvimento incremental: consulta pública por marca

- `202611230003_catalogo_por_marca.sql` cria RPC pública para conteúdo publicado filtrado por marca; categorias, materiais e indicações devem pertencer à marca consultada. A RPC anterior preserva assinatura e encaminha à Rava. Não implica sigilo por domínio: uma pessoa pode solicitar diretamente outra marca pública. Dados privados devem continuar protegidos por permissões e RLS.
- A migração foi aplicada somente em `rava-homologacao`. Como usuário anônimo, a RPC legada e a consulta Rava retornaram respostas equivalentes; marca desconhecida e Rivoxel retornaram zero itens no estado atual. Os testes locais criaram dados de ambas as marcas e validaram produtos cruzados, categorias e indicações; não foram criados produtos Rivoxel no ambiente público.
- A função `marcaDoHostname` é uma base isolada com lista explícita de dois domínios; ainda não está integrada à aplicação ou ao Worker. Ela não substitui autorização. Faltam validação segura por host no Worker, implementação da interface, controle de prévias, consistência de marca no cadastro, SEO e testes reais completos de publicação.
- `npm run check` passou, incluindo 105 testes de aplicação e 60 testes de banco. Antes de qualquer produção, revisar compatibilidade com versões antigas, execução da consulta anterior no Instagram, diferenças de grants, proteção de dados não publicados, restauração da definição anterior da RPC e dependências de rollback.

## 11. Worker por hostname em desenvolvimento

- `workers/entrada.ts` consulta a lista central de domínios e encaminha a Rava e a prévia multimarcas explicitamente autorizada aos assets existentes. Hosts desconhecidos recebem 404. O domínio Rivoxel retorna temporariamente 503/noindex em vez de servir o conteúdo ou a gestão da Rava; esse bloqueio é somente uma preparação de desenvolvimento, não uma página aprovada para produção.
- `wrangler.jsonc` configura binding de assets e execução prévia do Worker para todas as requisições. Isso passa a consumir invocações de Worker também para arquivos estáticos: verificar limites, custo e desempenho com tráfego real antes de propor merge. A alteração ainda não está na produção.
- Build da prévia no commit `bda5cf2` passou. Em `feat-multi-brand.rivoxel.com.br`, início, catálogo e gestão retornaram HTTP 200 com `X-Robots-Tag: noindex, nofollow`; o domínio público da Rava retornou HTTP 200. Testes unitários exercitam o bloqueio para Rivoxel e hosts desconhecidos; o hostname Rivoxel não foi testado nesse deployment de prévia. Confirmar login e recursos na prévia após cada mudança, bem como políticas de cache, 404, sitemap e SEO por host.
- Antes de qualquer merge ou aplicação em produção: substituir o bloqueio Rivoxel por implementação e identidade aprovadas, revisar a proteção de gestão, habilitar builds e SEO por marca e definir rollout/rollback. O Worker ainda não realiza a autorização de dados no backend; a RPC pública aceita selecionar qualquer catálogo publicado.

## 12. Categorias por marca em homologação

- Migration `202611230004_categorias_por_marca.sql` aplicada apenas em `rava-homologacao`: cria validação de marca para produtos e indicações e RPC de cadastro/edição de categorias com verificação de usuário ativo. Categorias com itens de outra marca não podem ser transferidas; editores recebem apenas categorias da marca do item.
- A interface da branch apresenta seleção de marca, nome da marca nas categorias e filtro administrativo. Ainda não existe cadastro de produto Rivoxel nem hierarquia de subcategorias; não tratar esta etapa como implementação completa.
- `npm run check`: 106 testes de aplicação, 60 de banco, tipos, lint e build passaram. Na homologação, criação de categoria Rivoxel foi testada com usuário autenticado em transação revertida; a categoria anterior permaneceu. Build da Cloudflare no commit `3f72384` foi concluído com sucesso. Falta validação visual e funcional do usuário na prévia.
- Não houve migration em produção nem merge. Rollback exige reverter a interface antes de remover a RPC e os gatilhos; dados de categorias e suas associações precisam de preservação e revisão, especialmente se já existirem itens Rivoxel.

## 13. Produtos por marca em homologação

**Decisão posterior:** o responsável determinou que marca e categoria do site sejam geridas somente no catálogo e que o cadastro operacional e suas categorias internas permaneçam como na `main`. A seção abaixo registra uma etapa intermediária, já substituída pela seção 14.

- Migrations `202611230005` e `202611230006` aplicadas apenas em `rava-homologacao`: o cadastro de produto, sua marca e estoque inicial são uma transação; duplicação mantém a marca do produto de origem e cria saldo zero e catálogo em rascunho. Cadastro legado continua compatível com a Rava.
- `ProdutoForm` oferece marca para novos produtos na gestão de estoque e no catálogo. Produtos existentes mostram sua marca sem permitir troca por enquanto, pois pedidos, vendas, movimentações e relatórios históricos ainda precisam de regras de consistência. Links públicos de produtos não-Rava permanecem ocultos enquanto seu site não estiver pronto.
- Testes locais: `npm run check`, com 106 testes de aplicação e 60 de banco, tipos, lint e build. Na homologação, cadastro de produto fictício Rivoxel com duas unidades foi testado por perfil ativo numa transação revertida. Falta validação visual do formulário e das regras de estoque em fluxos completos.
- Não houve migration em produção nem merge. Antes de um rollback com produtos de outra marca, preservar seus vínculos e saldos; não reclassificar produtos automaticamente nem remover associações sem plano de dados e autorização.

## 14. Correção: marca somente no site

- `ProdutoForm` foi restaurado ao conteúdo da `main`; as categorias internas Rava, Rivoxel e Bonecos e o estoque permanecem sem alteração. A marca do site é selecionada no editor do catálogo; a associação inicial continua exclusiva por marca e não implementa ainda o mesmo produto em dois sites.
- Migration `202611230007_corrigir_marca_produto.sql` aplicada somente na homologação: remove a RPC intermediária de cadastro com marca e cria uma ação explícita que altera apenas o vínculo no catálogo. A ação exige usuário ativo e versão de marca atual; bloqueia produto publicado ou categoria incompatível, sem alterar histórico comercial ou quantidade.
- A pedido do responsável, o vínculo do produto de teste `Produto Rivoxel` na homologação foi corrigido para Rivoxel; categoria interna Rivoxel e saldo 1 foram preservados. A associação à categoria do site deve ser validada pela interface depois da atualização da prévia.
- `npm run check`: 106 testes de aplicação e 60 de banco, tipos, lint e build. Testes cobrem a preservação de quantidade e pedidos durante a mudança de marca no catálogo. A prévia é atualizada pelo commit `ffa325c`. Nenhuma migration executada em produção.
- Rollback exige restaurar a interface e a função de catálogo de modo compatível com as associações existentes; reverter código não restaura automaticamente classificações alteradas. Nenhuma troca de produção sem autorização e plano de recuperação de dados.

## 15. Categorias e subcategorias do site

- Migrations `202611230008_subcategorias_site.sql` e `202611230009_catalogo_subcategorias.sql` aplicadas somente em `rava-homologacao`. A hierarquia possui dois níveis, com validação de marca e proteção contra ciclos, vinculação cruzada e exclusão de categoria principal com subcategorias. As categorias internas dos produtos não foram alteradas.
- Na gestão, categorias do site permitem selecionar uma categoria principal da mesma marca. Na consulta pública, filtrar uma categoria principal inclui itens das subcategorias; categorias desativadas e seus descendentes não são exibidos. A consulta antiga da Rava permanece compatível com o formato anterior, acrescido do campo opcional `pai_id`.
- `npm run check` passou com 107 testes de aplicação, 60 de banco, tipos, lint e build. Em homologação, uma transação revertida confirmou que o produto fictício é encontrado tanto pela categoria principal quanto pela subcategoria e não aparece na outra marca. A publicação da interface na prévia e sua validação visual ainda precisam ser confirmadas.
- Sem merge ou migration de produção. Rollback exige restaurar primeiro as consultas e interface compatíveis e preservar a relação entre subcategorias e produtos; não remover a coluna de hierarquia com dados sem plano de recuperação e autorização.

## 16. Prévia funcional Rivoxel

- Página provisória em `/rivoxel-preview/`, habilitada exclusivamente no build com `RAVA_PREVIEW_MODE=staging` e acessível nos hostnames de prévia permitidos. Não representa identidade definitiva, não contém links comerciais e não deve ser lançada em produção. O build padrão não inclui a página e o Worker recusa essa rota fora da lista de prévias.
- A página usa a RPC de catálogo da Rivoxel do banco configurado para homologação, com busca, filtro por categoria, paginação e detalhes de produtos publicados. A RPC é pública e aceita escolha de marca; esse seletor não é autenticação. A exposição de dados privados continua sujeita às regras de backend e não deve ser inferida do hostname.
- Em prévia, o produto fictício `Produto Rivoxel` apareceu e seus detalhes carregaram. O cabeçalho HTTP e a página indicaram `noindex`. Testes: `npm run check` (107 testes de aplicação, 60 de banco, tipos, lint e build), builds padrão e staging para verificar exclusão/inclusão da página; após ajuste de carregamento, tipos, lint e build staging passaram.
- Faltam identidade visual aprovada, páginas próprias definitivas, conteúdo e links, URLs e SEO definitivos, roteamento de produção, validação das duas marcas e medidas de acesso/caches. O domínio público Rivoxel não deve ser lançado com esta prévia. Para rollback da prévia, reverter os commits da página e do Worker na branch de desenvolvimento; não altera banco nem produção.

## 17. Preparação dos endereços da Rivoxel

- A navegação pública da implementação atual usa `rivoxelUrls` para definir os caminhos da página inicial, catálogo, links e produto. A prévia mantém o prefixo `/rivoxel-preview/`; o domínio exato `rivoxel.com.br` usa os caminhos sem esse prefixo. Os endereços das mensagens de WhatsApp acompanham a mesma regra.
- Esta etapa prepara os links, sem habilitar o domínio definitivo. O build de produção ainda não inclui as páginas da Rivoxel e o Worker mantém o bloqueio; o roteamento de produção, os metadados e a publicação precisam de implementação e testes próprios.
- Os caminhos não autorizam acesso a dados. A RPC pública filtra por marca e as regras de proteção do banco continuam responsáveis pelos dados privados. Nenhuma migration, DNS ou configuração de produção foi alterada nesta etapa.
- Validação: testes dos caminhos de prévia e produção e do domínio exato, além de `npm run check` e build em modo staging. Reverter a alteração no código restaura os links anteriores, sem afetar o banco.

## 18. Roteamento público preparado para testes

- O Worker serve início, catálogo e links da Rivoxel a partir dos caminhos definitivos exclusivamente no alias de homologação `feat-multi-brand-ravastudio3d.studiorava3d.workers.dev`, preservando parâmetros de produto e mantendo `noindex`. O bloqueio do domínio público Rivoxel permanece ativo no código da branch. A prévia da Rava em `feat-multi-brand.rivoxel.com.br` e seus caminhos existentes não foram alterados.
- Testes automatizados cobrem as páginas, arquivos estáticos, redirecionamento de barras, URLs desconhecidas e preservação da rota da Rava. Um build staging foi verificado localmente com os arquivos reais gerados e endereços simulados. Isso não comprova o funcionamento em um domínio Cloudflare nem faz publicação.
- A publicação da branch e a verificação HTTP e funcional do alias continuam necessárias para confirmar a homologação externa. Antes da produção, revisar o build de release, SEO, catálogo, migrations e reversão conforme o escopo confirmado no início deste documento.
