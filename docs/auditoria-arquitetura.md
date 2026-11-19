# Auditoria de arquitetura e plano de migração — Rava + Rivoxel

Data: 19/11/2026. Escopo: auditoria do código e planejamento; nenhuma alteração de aplicação, DNS, configuração remota ou banco foi realizada nesta fase.

## 1. Estado e proteção

- Repositório `richardweb23/ravastudio3d`; `main` remota consultada via `git ls-remote` em `d536d4650a65776852c7bd7c3e0862059d105268`. Cópia local estava limpa e alinhada a essa referência antes da criação da branch `feat/cloudflare-migration`.
- `.github/workflows/deploy.yml` define publicação no GitHub Pages ao receber push em `main`, manualmente e a cada hora (minuto 17). O artefato é `dist/`. Um push nessa branch pode publicar; não fazer push direto.
- O último commit efetivamente implantado e as configurações de Pages e proteção de branch **não foram confirmados no GitHub**: CLI `gh` indisponível e API não acessível pela ferramenta de consulta. `main` remota não prova a versão implantada. Antes de criar tag de produção, confirmar o commit da última execução bem-sucedida e o deployment ativo no GitHub. Não há tags locais ou remotas retornadas na consulta; escolher `producao-estavel-AAAA-MM-DD-<sha>` após confirmação, sem sobrescrever referência existente.
- A branch de migração parte da `main` remota conferida; não representa confirmação de que esse commit está efetivamente servido. Recomenda-se exigir pull request, revisão, verificações e restringir pushes em `main`, mas nenhuma configuração remota foi modificada.

## 2. Arquitetura atual

| Área | Implementação observada | Consequência |
| --- | --- | --- |
| Frontend | React 19, TypeScript e Vite 6 (`package.json`, `vite.config.js`); não é Next.js. | Não há middleware Next.js nem servidor de aplicação na hospedagem atual. |
| Entradas | `index.html`, `catalogo/index.html`, `links/index.html` e `gestao/index.html`; base Vite relativa. | Reproduzir as quatro entradas e seus assets no ambiente novo. |
| Rotas | `/`, `/catalogo/`, `/links/`, `/produto/<slug>/` e `/gestao/`; navegação administrativa por hash em `src/lib/adminNavigation.ts`. `public/404.html` redireciona rotas antigas. | Testar barra final, query, hash, recarga e URLs antigas na Cloudflare. Não substituir `/gestao/` por `/admin` sem compatibilidade. |
| Autenticação | Supabase Auth no navegador; sessão persistida, perfil em `profiles` e acesso condicionado a usuário ativo (`src/supabase.ts`, `src/AdminApp.tsx`, migrations). | Homologação requer usuários e URLs de redirecionamento próprios; interface não substitui RLS. |
| Dados | Postgres/Supabase, chamadas diretas e RPCs; migrations versionadas em `supabase/migrations`. | Um deploy de frontend não isola nem migra o banco. Conferir schema remoto antes de assumir migrations aplicadas. |
| Arquivos | Bucket público `catalogo-produtos`; imagens WebP são otimizadas e enviadas pelo navegador (`src/services/catalogo.ts`, `docs/CATALOGO.md`). | Até imagens de rascunhos são públicas se o caminho for conhecido; não tratar o bucket como privado e usar bucket de teste separado. |
| Estado | Estado React por componente e hooks; dados administrativos carregados no `AdminApp` e em serviços específicos. | Evitar duplicar lógica ao criar experiências por marca. |

### Banco e dependências comerciais

- `materiais` representa produtos operacionais, custos e categoria; `estoque_por_local`, `locais_estoque`, `vendedores`, `compras`, `pedidos`, `pedido_itens`, `pedido_pagamentos` e `vendas` sustentam fluxos existentes. Consignação tem tabelas próprias para itens, movimentos, vendas e repasses. A entrega de pedidos pode gerar vendas e baixa de estoque: alterações de identidade comercial não devem alterar esses vínculos.
- O financeiro usa sócios, despesas, parcelas, pagamentos, caixas, movimentos, reembolsos e RPCs transacionais. `caixa` Rava/Rivoxel/Bonecos/Materiais é conceito financeiro; `materiais.categoria` Rava/Rivoxel/Bonecos é classificação operacional. Nenhum deles é prova automática de marca comercial. `filamento_marcas` são fabricantes de filamento, não marcas comerciais do site.
- O catálogo mantém `catalogo_produtos` ligado por `material_id`, `catalogo_categorias`, `catalogo_slugs`, `catalogo_imagens` e `catalogo_indicacoes` para itens de marketplace. A última definição de `catalogo_publico` encontrada está em `202610310003_catalogo_indicacoes.sql`; combina produtos próprios e indicações e devolve produtos publicados e categorias ativas. Revisar a cadeia inteira de migrations e conferir o estado remoto antes de alterar assinaturas ou políticas.
- Categorias de catálogo são distintas das categorias operacionais e financeiras. A estrutura examinada não demonstra uma hierarquia de subcategorias; verificar necessidade real antes de propor schema. Slugs e aliases atuais têm unicidade global e interagem com indicações; permitir slugs por marca exigirá rever todas as restrições e URLs históricas.
- `catalogo_publico` usa `security definer`; acesso a tabelas e RPCs, RLS e bucket devem ser reavaliados conjuntamente. Parâmetro de marca no navegador não é autorização nem comprova hostname. Se produtos publicados de ambas as marcas forem públicos, um seletor de marca em API pode filtrar respostas, mas não impedir consultas deliberadas a outra marca: para isolamento por domínio efetivo é necessária uma camada confiável no servidor e um contrato que não possa ser contornado pelo endpoint público anterior.

### Integrações

- O frontend usa `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` ou `VITE_SUPABASE_ANON_KEY`; chaves de navegador são públicas e protegidas por permissões/RLS, não por sigilo. `VITE_GA_MEASUREMENT_ID` configura Analytics; verificar host permitido em `src/analytics.ts`.
- Instagram tem URL e chave públicas separadas (`VITE_INSTAGRAM_SUPABASE_URL`, `VITE_INSTAGRAM_SUPABASE_PUBLISHABLE_KEY`), Edge Functions, rascunhos em `supabase/instagram-draft/` e workflow de worker. `docs/INSTAGRAM.md` descreve um estágio parcial e pode estar desatualizado em relação ao workflow; confirmar estado real dos projetos e integrações antes de qualquer ação. Não ativar envios ou usar serviços reais em testes.
- Links comerciais e WhatsApp, imagens externas/marketplaces, Analytics, Auth e configurações de recuperação devem ser inventariados e testados por domínio. Não armazenar segredos nos arquivos `VITE_` nem usar `service_role` no navegador.

## 3. Build, hospedagem e SEO

O workflow instala dependências com Node 22, verifica tipos, executa `npm run build` e depois `node scripts/gerar-paginas-catalogo.mjs`, que consulta o RPC público paginado e gera HTML por produto, `catalogo-paginas.json` e `sitemap.xml`. O script fixa o domínio e textos da Rava. O workflow valida `dist/CNAME` e diretórios antes de publicar. Uma implantação que execute apenas `vite build` perde páginas e sitemap. O catálogo usa também `catalogo-paginas.json`; disponibilidade e atualização dos dados precisam ser verificadas.

A publicação agendada atual atualiza páginas estáticas a cada hora. A substituição precisa manter atualização de catálogo equivalente, com gatilho seguro e falha que preserve o último deploy; testar despublicação e aliases. Não remover nem alterar o agendamento existente antes da virada aprovada. Separar configuração para prévia, incluindo URL canônica, `robots`, `X-Robots-Tag: noindex` e Analytics. Não expor a prévia como destino canônico público.

`public/404.html` executa redirecionamentos no navegador; não presumir que a Cloudflare trate uma resposta 404 como fallback SPA da mesma forma. Testar códigos HTTP, rotas administrativas antigas, produto inexistente e rotas reais; garantir 404 seguro quando necessário. Cabeçalhos, cache, imagens externas, links de compartilhamento e canonical devem ser verificados por ambiente e, futuramente, por marca.

## 4. Comparação Cloudflare (consultada em 19/11/2026)

| | Pages | Workers Static Assets |
| --- | --- | --- |
| Site estático | Hospeda o build Vite; integração Git e prévias. | Hospeda assets estáticos; a Cloudflare recomenda Workers Static Assets para novos projetos. |
| Código no servidor | Pages Functions quando necessário; consomem cota Workers. | Worker opcional para roteamento e respostas dinâmicas. |
| Domínios | Permite vários domínios por projeto; para domínio raiz exige zona na Cloudflare e nameservers Cloudflare. | Permite domínios personalizados; verificar zona, DNS, certificados e hostnames exatos. |
| Prévia | Deploys de preview recebem `X-Robots-Tag: noindex` por padrão; confirmar cabeçalho efetivo. | Definir e verificar isolamento e `noindex` do ambiente escolhido. |
| Limites/custos | Plano gratuito: documentação informa 500 builds/mês, 20.000 arquivos por site e 25 MiB por arquivo; verificar limites vigentes e consumo real. | Assets estáticos servidos sem cobrança por requisição conforme documentação; execução dinâmica sujeita à cota Workers. Plano Workers pago indicado a partir de US$ 5/mês, além de excessos aplicáveis. |

Fontes: [Pages: domínios](https://developers.cloudflare.com/pages/configuration/custom-domains/), [limites](https://developers.cloudflare.com/pages/platform/limits/), [prévia](https://developers.cloudflare.com/pages/configuration/preview-deployments/), [Workers Static Assets](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/), [preços Workers](https://developers.cloudflare.com/workers/platform/pricing/), [domínios Workers](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/). Preços, limites, disponibilidade e plano da conta devem ser confirmados antes de contratar.

**Recomendação:** homologar a Rava como estática, sem mudar React ou Supabase, e comparar um protótipo Workers Static Assets com Pages antes da escolha final. Roteamento dinâmico por hostname e enforcement de isolamento poderão exigir execução no servidor na fase multimarcas. Dois builds separados são alternativa operacional, mas não garantem isolamento de dados se o backend público continuar expondo ambos os catálogos.

## 5. Migração sem interrupção planejada

1. Confirmar commit implantado, estado do Pages, acessos, execuções e backup; registrar baseline de respostas, certificados, URLs e tempos. Criar referência estável somente após confirmação.
2. Provisionar **ambiente de homologação isolado**, com banco, Auth, usuários fictícios, buckets e integrações de teste próprios. O `npm run dev:local` já bloqueia URLs Supabase não locais; avaliar também projeto hospedado ou branching isolado para testes de Cloudflare. Nunca usar contas de teste com permissões de escrita em produção. Sem dados reais ou segredos em commits.
3. Criar preview paralelo e não indexável sem apontar domínio real. Reproduzir build e atualização do catálogo com dados fictícios; configurar Auth para URLs de preview e bloquear chamadas reais a Meta/financeiro. Testar inclusive recuperação de senha, arquivos, categorias, pagamentos simulados, devoluções, consignação e integrações. Não prosseguir com falhas críticas.
4. Registrar integralmente os DNS atuais, TTL, A/AAAA/CNAME, MX, TXT, SPF/DKIM/DMARC, CAA, DNSSEC, certificados, provedor e nameservers de ambos os domínios; confirmar com o responsável antes de qualquer intervenção. Em Pages com domínio raiz, planejar mudança de nameservers separada e primeiro manter o destino existente, verificando todos os registros e delegação. A inspeção local de DNS não retornou resultados; inventário ainda não foi validado.
5. Antes da troca, validar domínios, certificados, URLs, autenticação e redirects em ambiente adequado; definir janela, responsável, métricas e contatos. Alterar DNS somente com autorização explícita. Manter Pages atual e seu workflow até estabilização e decisão posterior. DNS pode ter propagação e caches: indisponibilidade zero não pode ser garantida.
6. Monitorar disponibilidade, HTTPS, páginas, catálogo, login e logs após a troca. Se houver regressão, restaurar a configuração DNS capturada e/ou deployment estável, respeitando propagação e certificados. Rollback de código não reverte dados. Preservar backups e registrar qualquer alteração de dados; nenhuma migration de produção sem autorização e plano de recuperação específico.

## 6. Multimarcas após estabilização

- Criar `feat/multi-brand` a partir da versão de produção efetivamente validada; desenvolver e testar com Supabase isolado, sem mexer em DNS público.
- Propor entidade de marca e vínculo explícito de catálogo, categorias e indicações, com backfill compatível e sem alterar IDs. A orientação inicial é manter os produtos existentes visíveis na Rava; validar com inventário e proprietário antes de qualquer eventual redistribuição para Rivoxel. Categorias legadas e caixas não determinam marca por si só.
- Definir identidade e recursos Rivoxel com material fornecido; não inventar marca. Mapear produtos, URLs e redirecionamentos antigos somente após acesso e correspondência comprovada.
- Rever `catalogo_publico`, RPCs administrativas, slugs e aliases, imagens, sitemap, regras de cache, pesquisa e chamadas Instagram; incluir testes de acesso direto, consultas entre marcas e versões anteriores do frontend. Identificar quais dados comerciais realmente precisam de vínculo de marca, preservando financeiro consolidado.
- A administração permanece na Rava com `/gestao/` compatível; `/admin` é decisão posterior sujeita a redirects e Auth. Não criar painel ou login separado.

## 7. Arquivos envolvidos e validação

Possíveis pontos de mudança após aprovação: `vite.config.js`, `.github/workflows/deploy.yml` ou novo fluxo paralelo, `scripts/gerar-paginas-catalogo.mjs`, `public/404.html`, entradas HTML, `src/CatalogPage.tsx`, `src/services/catalogo.ts`, `src/AdminApp.tsx`, `src/components/catalogo/`, `src/supabase.ts`, `src/database.types.ts` e novas migrations; a lista é indicativa e não autoriza alterá-los nesta fase.

Critérios por etapa: `npm run check` (tipos, testes de unidade, banco PGlite isolado, lint, build), além de testes reais no ambiente de homologação com dados fictícios. Testar fluxo completo de vendas e pedido, integridade financeira e permissões, falhas de build, acesso direto e cross-brand, SEO e cache. PGlite não substitui Supabase real, Storage nem validação do domínio. Os resultados efetivos desta auditoria devem ser reportados no encerramento; nenhum teste nesta fase comprova disponibilidade do site publicado.

## 8. Pendências e decisões

1. Confirmar o deployment ativo e criar tag no commit correto; verificar proteção de branch e autoridade de acesso ao GitHub.
2. Confirmar conta Cloudflare, controle dos dois domínios, registradores, DNS, plano e orçamento; analisar requisitos de nameserver e DNSSEC antes de escolher a hospedagem final.
3. Confirmar disponibilidade de Supabase separado, autenticação, buckets e integrações fictícias para homologação.
4. Obter identidade, catálogo e mapa de URLs antigos Rivoxel; decidir classificação de produtos e política de exposição pública entre marcas com base em dados reais.
5. Rever estado implantado de Instagram e configurar testes sem envios externos. Confirmar variáveis e agendamento para regenerar SEO.
6. Aprovar a arquitetura, teste de homologação e, separadamente, eventual troca de DNS e migrations de produção.

### Resultado da verificação local — 19/11/2026

`npm run check` passou: verificação de tipos, 97 testes de unidade, 58 testes de banco isolado, lint e build Vite. O build local não executou a geração de páginas de catálogo dependente do Supabase, nem validou deploy, DNS, Auth, Storage ou integrações reais.
