# Prévia da Rava na Cloudflare

O painel disponível usa **Workers Builds**, portanto a configuração ativa usa `wrangler.jsonc`, assets em `dist` e `npx wrangler preview`; as instruções de Pages abaixo são referência alternativa. Configure as variáveis como **Build variables** do Worker, não apenas variáveis de runtime. O build inicial da `main` não contém o script de prévia; execute a branch `feat/cloudflare-migration` como preview. A configuração do Worker se chama `ravastudio3d`, sem domínio personalizado. O arquivo `_headers` também é suportado por Workers Static Assets.

Esta preparação é para uma prévia de homologação, sem trocar DNS ou alterar o workflow do GitHub Pages. O projeto Cloudflare ainda precisa ser criado e testado; não anexar domínio público nesta etapa. Os arquivos em `dist/` são locais e não alteram o site em produção.

## Escolha do modo

- `public`: lê catálogo público do Supabase de produção com a chave pública. A entrada `/gestao/` é substituída por uma página informativa, e Instagram fica sem configuração. Não realizar testes de escrita ou login, nem acionar links externos como WhatsApp. A prévia é publicamente acessível para quem tiver o endereço; `noindex` não é controle de acesso. As políticas existentes do Supabase continuam responsáveis pela autorização. Essa medida de interface não revoga acesso direto às APIs nem substitui RLS.
- `staging`: usa projeto Supabase hospedado exclusivo para testes, diferente de produção; permite gestão com usuários e dados fictícios. A comparação entre URLs protege contra erro de configuração simples, mas depende de informar corretamente a URL de produção e não verifica conexões indiretas. Preparar schema, RLS, Auth, Storage e dados de teste separadamente antes de validar escrita. Nunca utilizar `service_role` nem secret key no navegador.

O script valida URLs e chave pública, desativa configuração Instagram, executa Vite e geração de páginas/sitemap, aplica `X-Robots-Tag: noindex, nofollow` ao artefato Pages e remove o CNAME do GitHub Pages da prévia. O SEO gerado ainda usa URLs canônicas de produção, como o código atual; a prévia não deve ser indexada. Os links comerciais ainda podem apontar para serviços reais. A configuração de noindex deve ser conferida por HTTP após o deploy. Builds que incluam Functions exigirão verificar seus próprios cabeçalhos.

## Configurar no Cloudflare Pages

Após a branch estar disponível no GitHub, conectar o repositório existente a um novo projeto Pages reservado para homologação. Não associar domínio personalizado. No controle de branches, restringir previews à branch `feat/cloudflare-migration` e desativar publicação automática da branch de produção no projeto de teste. Conferir essas opções antes de liberar builds; consultar a [documentação de integração Git](https://developers.cloudflare.com/pages/configuration/git-integration/) e [controle de branches](https://developers.cloudflare.com/pages/configuration/branch-build-controls/). Não usar essa configuração para a futura produção sem revisão.

- Versão Node: `22` (`NODE_VERSION=22`).
- Comando de build: `npm ci && npm run build:cloudflare:preview`.
- Diretório de saída: `dist`.
- Diretório raiz: raiz do repositório.
- Configurar as variáveis abaixo apenas no ambiente de preview do projeto de homologação. A URL do Supabase e a chave publishable/anon são públicas no frontend. Nunca copiar tokens administrativos ou senhas para variáveis Vite ou para o chat.

### Primeiro modo: catálogo público sem gestão

| Variável | Valor |
| --- | --- |
| `RAVA_PREVIEW_MODE` | `public` |
| `RAVA_PRODUCTION_SUPABASE_URL` | URL HTTPS do projeto Supabase atual, copiada do painel do Supabase |
| `RAVA_PRODUCTION_SUPABASE_PUBLIC_KEY` | Chave **publishable** ou **anon** do mesmo projeto |

### Segundo modo: testes administrativos isolados

| Variável | Valor |
| --- | --- |
| `RAVA_PREVIEW_MODE` | `staging` |
| `RAVA_PRODUCTION_SUPABASE_URL` | URL HTTPS do projeto atual, usada somente para comparação |
| `RAVA_STAGING_SUPABASE_URL` | URL HTTPS do projeto exclusivo de testes |
| `RAVA_STAGING_SUPABASE_PUBLIC_KEY` | Chave **publishable** ou **anon** do projeto de testes |

Não configurar URLs ou chaves do Instagram real para a prévia. Um build falha se dados obrigatórios faltarem, se projetos de staging e produção forem iguais ou se a chave não parecer pública. Isso não confirma que uma chave corresponde ao projeto: conferir no painel e testar autenticação somente no projeto isolado.

## Validação após publicar

1. Confirmar a URL real da prévia e que nenhuma alteração foi feita no DNS ou domínio personalizado.
2. Conferir `X-Robots-Tag: noindex` em páginas normais, catálogo, produto gerado, `/gestao/` e erros; verificar que o conteúdo funciona com CSS e imagens.
3. Testar busca, filtros, navegação, URLs diretas e atualização da página. Não enviar formulários ou mensagens comerciais reais.
4. No modo público, verificar que `/gestao/` mostra a página informativa e não fazer login ou operações administrativas. No modo staging, confirmar no painel que os dados são fictícios antes de testar escrita, uploads, pedidos, estoque e financeiro.
5. Comparar comportamento de URLs inexistentes, `404.html`, barras finais e redirecionamentos com GitHub Pages. Verificar geração de sitemap e o mecanismo futuro de atualização do catálogo: o build atual da prévia é pontual e não substitui o agendamento horário de produção.

A mudança do domínio da Rava, ativação do novo deploy de produção, configuração de DNS e alterações no banco de produção exigem uma etapa posterior aprovada, com backup, inventário de DNS e rollback.

## Atualização automática futura do catálogo

O workflow `.github/workflows/cloudflare-catalogo.yml` é uma preparação para solicitar um novo build da Cloudflare a cada hora, no minuto 17, preservando a mesma frequência do Pages. Ele fica inativo por padrão: só executa na `main` quando a variável de repositório `CLOUDFLARE_CATALOGO_ATIVO` for exatamente `true`. O agendamento do GitHub só funciona quando o workflow estiver na branch padrão; ter o arquivo na branch de migração **não ativa o agendamento**. A execução manual também respeita o bloqueio. Nada disso substitui nem altera o workflow atual do GitHub Pages.

Após aprovação da migração, configurar na Cloudflare um Deploy Hook vinculado à branch de produção adequada; armazenar sua URL como secret `CLOUDFLARE_CATALOGO_HOOK` no GitHub, nunca no código, logs ou chat. Uma URL de hook funciona como credencial. Configurar e validar separadamente o build de produção contra o Supabase de produção, incluindo Instagram, SEO e ausência de `noindex`; o comando `build:cloudflare:preview` é exclusivamente de testes e **não serve para produção**. Só após revisão, merge autorizado e teste do novo deploy ativar a variável. A resposta do hook apenas confirma que um build foi solicitado: acompanhar o status do build na Cloudflare e validar que o catálogo realmente foi atualizado. Uma falha de build deve preservar o último deploy válido; verificar esse comportamento antes da troca de DNS. Para interromper, definir a variável como `false` ou remover o hook; preservar o workflow original enquanto o rollback estiver disponível.

Referência: [Deploy Hooks da Cloudflare](https://developers.cloudflare.com/workers/ci-cd/builds/deploy-hooks/).

## Observação inicial de DNS — 19/11/2026

Consulta pública ao resolvedor 1.1.1.1 retornou nameservers `a.sec.dns.br` e `b.sec.dns.br`, e para o domínio raiz quatro endereços IPv4 associados ao GitHub Pages: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`. A consulta de CNAME de `www.ravastudio3d.com.br` retornou domínio inexistente e a consulta AAAA não retornou registros; confirmar novamente com respostas autoritativas. A consulta de MX não retornou registros MX, mas isso não demonstra que não há serviços de e-mail ou outros registros de domínio. A ferramenta local não consultou DS/DNSSEC com sucesso. Este levantamento público é incompleto e não substitui exportação da zona, verificação de DNSSEC e conferência dos serviços no painel do responsável antes de mudar qualquer configuração. Nenhum registro foi alterado.

## Build futuro de produção na Cloudflare

O comando `npm run build:cloudflare:release` prepara os assets e as páginas do catálogo sem publicá-los. Ele deve ser configurado **somente na etapa de produção aprovada**, nunca em `Previews Base`. Exige `RAVA_RELEASE_CONFIRMED=production`, `RAVA_PRODUCTION_SUPABASE_URL`, `RAVA_PRODUCTION_SUPABASE_PUBLIC_KEY`, `RAVA_STAGING_SUPABASE_URL` e `RAVA_INSTAGRAM_SUPABASE_URL`/`RAVA_INSTAGRAM_SUPABASE_PUBLIC_KEY`, usando apenas chaves publishable ou anon. A URL de teste é usada para verificar que não foi selecionada como banco de produção; os valores dependem da configuração correta pelo operador. Não forneça credenciais secretas ao build.

O build de produção não adiciona o cabeçalho `noindex` de homologação e preserva a configuração do Instagram via variáveis específicas. Não ativar nem apontar domínio antes de validar build, identidade do banco, Auth, SEO, integração existente e plano de retorno. O script foi exercitado localmente com dados do projeto de homologação e gerou a página do produto fictício; isso não valida integração real do Instagram nem deployment de produção.

## Teste inicial com o domínio Rivoxel

Em 19/11/2026, consulta pública a 1.1.1.1 retornou nameservers `d.sec.dns.br` e `f.sec.dns.br`, quatro endereços IPv4 do GitHub Pages no domínio raiz (`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`) e MX Umbler (`mx364.umbler.com` prioridade 10, `mx128.umbler.in` prioridade 20, `mx783.umbler.com.br` prioridade 30 e `mx240.umbler.co.uk` prioridade 40). `www` retornou domínio inexistente na consulta. É uma observação parcial e não autoritativa: confirmar no Registro.br e inventariar todos os registros, especialmente TXT, CAA, DNSSEC e e-mail. Não presumir que domínio sem site não está em uso. Não alterar DNS, nameservers, DNSSEC ou MX sem revisão e autorização específica.

Usar inicialmente um endereço de teste na Rivoxel, mantendo o banco de homologação, o bloqueio de indexação e identidade de teste. Não apontar esse teste para o banco real nem usar o comando de release para produção como se fosse uma prévia segura. A prévia por domínio próprio e certificados exige zona Cloudflare ativa e configuração apropriada de Preview; verificar antes de qualquer associação. Uma verificação de DNS pode exigir mudança de nameservers para a zona completa, afetando também e-mails: preparar primeiro zona equivalente e rollback, conferindo DNSSEC e registros com o proprietário. Conforme documentação Cloudflare, desativação ou migração coordenada de DNSSEC pode ser necessária antes de trocar nameservers; não executá-la automaticamente.

Após essa validação, preparar em separado uma implantação de Rava fiel à produção, com configuração correta de ambiente e proteção de acesso. A homologação em domínio de teste com dados fictícios não prova integração do banco de produção, Instagram, propagação da Rava ou ausência absoluta de interrupção. Somente após testes, autorização e inventário próprio considerar a troca de DNS da Rava.

Fontes: [Cloudflare Worker Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/), [domínios de Preview](https://developers.cloudflare.com/workers/previews/custom-domains/), [Cloudflare DNSSEC](https://developers.cloudflare.com/dns/dnssec/).
