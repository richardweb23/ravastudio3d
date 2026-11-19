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
