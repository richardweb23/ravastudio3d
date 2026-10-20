# Catálogo da RAVA

## Uso

- Público: `/catalogo/`. O acesso a `/catalogo` redireciona para o diretório da página, como `/links`.
- Gestão: `/gestao/#/catalogo`, no menu **Catálogo do site**.
- Compartilhamento: `/catalogo/?produto=<slug>` abre a modal. Endereços antigos continuam apontando para o mesmo produto enquanto seu cadastro de catálogo existir.
- Os produtos da Gestão recebem códigos numéricos sequenciais, exibidos com pelo menos três dígitos. Os UUIDs existentes não mudam. A sequência é global, não reinicia por categoria e pode ter lacunas após exclusões ou transações canceladas.
- Todos os produtos existentes começam sem publicação. Estoque zero ou vendas anteriores não impedem a edição ou publicação.
- O título do catálogo é opcional: quando vazio, usa o nome da Gestão. Descrição é obrigatória para publicar. Preços do catálogo são armazenados em centavos e não alteram vendas, custos, caixa ou estoque.
- Categorias do site são independentes das categorias financeiras. Desativar uma categoria oculta seus produtos no catálogo público.
- Para publicar: editar o catálogo, preencher descrição e preço, marcar **Exibir no site** e salvar. Prévia não publica.
- **Novo produto** utiliza o formulário atual da Gestão. **Duplicar** cria outro produto, com novo código, sem estoque e sem publicação, e copia as imagens quando possível. Uma falha de cópia preserva o novo produto para completar a edição.

## Imagens

Bucket público `catalogo-produtos`, sem Google Drive, OAuth, Edge Functions ou transformações pagas.

- Até oito imagens por produto; JPEG, PNG ou WebP originais de até 10 MiB.
- Conversão no navegador para WebP, qualidade 0,82, lado maior até 1.600 px; miniatura até 480 px. Sem ampliação. Cada versão enviada deve ter até 2 MiB.
- Originais não são enviados nem modificados. O canvas remove metadados da cópia enviada. Imagens acima de 60 megapixels são rejeitadas para reduzir consumo de memória no dispositivo.
- Caminhos: `<produto UUID>/<imagem UUID>/principal.webp` e `miniatura.webp`; sem nomes de arquivos arbitrários. O banco guarda os caminhos, o nome original, a ordem e o texto alternativo.
- Primeira imagem é a principal. Setas reordenam; **Principal** leva a foto ao início.
- Substituição envia um novo par de arquivos antes de retirar a foto anterior, inclusive com oito fotos. Pode haver um par temporário adicional durante a operação.
- O progresso informa a etapa atual e o arquivo sendo processado; não simula porcentagem de transferência.
- Todas as imagens enviadas são públicas, inclusive em produtos não publicados ou arquivados. Não enviar documentos nem imagens privadas.
- Despublicar/arquivar mantém as imagens vinculadas ao produto. **Remover do catálogo e excluir imagens** retira a publicação, limpa os arquivos e remove apenas os dados comerciais do catálogo, preservando o produto da Gestão e o histórico.
- Operações interrompidas ficam registradas como envio/limpeza pendente. **Limpar envio** repete a exclusão via API do Storage; o registro só desaparece depois que os dois arquivos foram removidos. Antes de limpar, confira se o envio não está em andamento em outra aba.
- Objetos usam caminhos imutáveis e cache de um ano. Excluir o arquivo na origem não revoga cópias já armazenadas no navegador/CDN; isso é compatível com o bucket público.

## Banco e autorização

Migração: `supabase/migrations/202610200001_catalogo.sql`.

- `materiais.codigo` e sequência `produto_codigo_seq`; backfill por `created_at,id`, sem mudar a data de atualização.
- Tabelas `catalogo_produtos`, `catalogo_categorias`, `catalogo_imagens`, `catalogo_slugs`.
- RPCs transacionais para salvar, duplicar, excluir metadados e operar imagens. A edição usa versão para evitar sobrescrever outra sessão.
- Usuários autenticados precisam de `usuario_ativo()`. Todos os perfis ativos têm a mesma autorização, conforme o funcionamento atual da Gestão.
- Visitantes só recebem o DTO de `catalogo_publico`: produtos publicados, categorias ativas e fotos prontas. Custos, saldos e categorias financeiras não aparecem nesse retorno.
- O bucket permite apenas `image/webp`, até 2 MiB por objeto. RLS exige um caminho previamente reservado no banco para upload e uma exclusão previamente iniciada para remover.
- Não há escrita direta nas tabelas de produtos/imagens do catálogo pelo navegador. As categorias usam RLS diretamente.
- Nenhuma nova variável de ambiente: reutiliza `VITE_SUPABASE_URL` e a chave pública já configurada. Chaves administrativas nunca são usadas no frontend.

## Ambiente local e publicação

Antes de implementar, foi criado backup em `backups/catalogo-local-before-2026-10-20T12-44-40-069Z/database.sql` e aplicadas as migrações locais pendentes de correção de pedidos e custo de filamento, sem reset. Os 46 produtos existentes foram preservados.

O banco local foi previamente restaurado sem registros em `supabase_migrations.schema_migrations`. Por isso, as migrações pendentes foram aplicadas diretamente com `psql`, transacionalmente. Antes de usar `supabase migration up` nesse banco, reconciliar o histórico da CLI com o schema restaurado; não reaplicar a migração inicial nem executar reset sobre os dados existentes.

O schema restaurado do Storage também usa índices de versionamento mais novos que o serviço local 1.72.1. Foi necessário um índice único local de compatibilidade, `catalogo_local_storage_compat` em `storage.objects(bucket_id,name)`, após verificar ausência de duplicatas. Esse reparo é exclusivo da instância local e não faz parte da migração de produção. Ao atualizar o serviço local para uma versão compatível com o schema e com versionamento, revisar/remover esse índice adicional.

Após aprovação para produção:

1. Fazer backup do banco e registrar o estado das migrações.
2. Conferir migrações anteriores e aplicar as aprovadas em ordem; esta alteração depende da migração de custo de filamento.
3. Aplicar a migração do catálogo. Se já houver bucket com esse nome, conferir que ele é público, exclusivo do catálogo, limitado a WebP/2 MiB e sem políticas externas permissivas.
4. Publicar o build normal do projeto. O workflow atual publica ao enviar para `main`; nenhum push/deploy foi feito nesta implementação.
5. Testar a rota direta, autenticação, publicação de um produto e upload. Produtos antigos não são publicados automaticamente.

SEO é geral do catálogo, presente no HTML. Modais não têm página HTML individual nem metadados de compartilhamento exclusivos por produto, conforme o escopo acordado.

## Reversão

O script manual `supabase/rollback/202610200001_catalogo.sql` está fora da pasta de migrações automáticas. Reverter primeiro o frontend; exportar metadados, códigos e imagens; remover imagens pela aplicação/API; remover o bucket vazio via Storage; só então executar o script com autorização.

O script recusa a reversão enquanto houver imagens registradas ou bucket. Remove apenas os objetos novos e a coluna de código. Produtos, vendas, custos e estoque permanecem. Para recuperar códigos e metadados após a reversão, usar o backup, pois refazer o backfill pode atribuir uma numeração diferente.

## Validação

`npm run check`: testes de unidade, PostgreSQL isolado, lint e build.

`tests/catalogo-db.test.mjs` cobre backfill, preservação dos produtos, preços, publicação sem estoque, aliases, edição concorrente, duplicação, limite de fotos, substituição, ordenação, permissões e limpeza.

As suítes anteriores carregam um schema mínimo de Storage para executar todas as migrações em PGlite. Esse schema simula apenas metadados e RLS: não substitui o teste real de upload no Supabase local.

Resultado em 20/10/2026:

- 53 testes de unidade e 47 testes de banco aprovados; lint, build e `git diff --check` aprovados.
- Teste real em Chrome com Supabase local: edição/publicação, upload de oito fotos, WebP e miniaturas, reordenação, substituição no limite, duplicação com cópia real no Storage, acesso anônimo, aliases, WhatsApp, busca e despublicação.
- Falha de upload de miniatura provocada no navegador: a versão principal já enviada foi removida, sem arquivo ou registro órfão.
- Exclusão completa do catálogo preservou custo e estoque do produto. Dados e arquivos fictícios foram removidos.
- Layout e modais verificados em 390 px e 1.440 px, incluindo largura interna e fechamento por Escape.
- Reversão testada em PostgreSQL isolado; os 46 produtos locais foram comparados ao backup, preservando nomes, custos, saldos, categorias, imagens anteriores e datas.
- Prévia local em `http://127.0.0.1:5181/catalogo/` e Gestão em `http://127.0.0.1:5181/gestao/#/catalogo`. O catálogo público começa vazio até publicar produtos.

Principais arquivos: `src/CatalogPage.jsx`, `src/components/catalogo/`, `src/services/catalogo.js`, `src/lib/catalogo.js`, `src/catalogo.css`, `catalogo/index.html`, a migração e o script de reversão. Integrações pontuais em `AdminApp`, navegação, `ProdutoForm`, tabela de produtos, menu público e configuração de entradas do Vite.

Não foi adicionado serviço pago nem dependência. O consumo de armazenamento e tráfego continua sujeito à franquia do Supabase do projeto.
