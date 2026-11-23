# Auditoria de ambientes para multimarcas

Data: 20/11/2026. Consultas SQL de leitura de metadados em produção `nmwiqjhxinjulvhwkedr` e homologação `kxdjadclwpyhyhuxidry`. Nenhuma consulta de escrita, migration, alteração de permissões ou transferência de dados foi realizada. Metadados e resultados de consulta devem ser reavaliados antes da implantação.

## Resultado

- Ambos os projetos aparecem ativos e são distintos. O PostgreSQL informado pelo Supabase é 17.6.1.166 em produção e 17.12.0.000 em homologação; validar comportamentos dependentes de versão.
- A homologação registra 36 migrations, de `202609050001` a `202611090001`, no histórico `supabase_migrations.schema_migrations`. Na produção a tabela de histórico não existe; isso **não** comprova falta das alterações, e não autoriza reparar ou recriar o histórico automaticamente.
- Comparação dos metadados consultados: nomes e definições de colunas, constraints e políticas de `public` coincidem. Coincidem também os resumos dos 89 índices, 78 gatilhos, duas views e estado RLS de 38 tabelas. A verificação é limitada aos campos consultados e não prova equivalência integral nem a segurança efetiva.
- As 87 funções públicas têm mesmo corpo após normalização de CRLF, além dos atributos consultados de `security definer`, volatilidade e configuração. O texto integral de `pg_get_functiondef` apresentou diferenças de final de linha. Permissões de execução explícitas divergem, principalmente `service_role`; `PUBLIC` e herança de permissões precisam ser considerados antes de avaliar acesso efetivo.
- O bucket `catalogo-produtos` existe em ambos, é público e tem limite de 2 MiB e tipo `image/webp`; as três políticas de Storage consultadas coincidem. A produção possui também bucket privado chamado `rava-homologacao`, ausente no projeto de homologação; a necessidade dele para os testes ainda não foi estabelecida. Bucket dentro do projeto de produção não é ambiente separado.
- As permissões de tabela/view diferem: foram encontradas 24 concessões explícitas adicionais a `anon`/`authenticated` em produção sobre `financeiro_despesas_resumo`, `financeiro_pagamentos_parcela`, `pedido_subtarefas`, `pedidos_financeiro`, `profiles` e `tarefas`. Não copiar grants automaticamente. RLS, privilégios herdados, funções e dados acessíveis precisam ser testados em conjunto. As views financeiras consultadas têm `security_invoker=true`, mas isso, isoladamente, não valida todos os caminhos de acesso.
- Há usuário cadastrado em homologação, mas a contagem não prova que seja fictício, ativo, autorizado ou apropriado para testes; não foram lidos nomes ou dados de usuários. As configurações de URL de Auth, fluxo de recuperação, conteúdo de buckets, dados fictícios, integrações externas, credenciais e políticas efetivas ainda não foram validados.

## Consequências e próximos passos

1. Inventariar e classificar as diferenças de grants por finalidade e testar acesso efetivo como anônimo, usuário sem privilégio e usuário administrativo em homologação. Não ampliar acesso ou espelhar o ambiente automaticamente.
2. Verificar as configurações de Auth, buckets necessários e origens de integrações sem imprimir segredos; confirmar com o responsável que o usuário e os dados de teste são fictícios. Testar upload e permissões somente no projeto de homologação.
3. Não registrar migrations antigas em produção como aplicadas sem um plano próprio de reconciliação revisado e aprovado. Preparar futuras migrations a partir do schema real observado, com pré-condições e verificações seguras para instalações sem histórico.
4. Prosseguir para o desenho e testes das migrations de marca na branch `feat/multi-brand` apenas quando o isolamento e os testes de escrita em homologação estiverem comprovados. Cada alteração de banco em produção continua condicionada a autorização explícita e plano de recuperação.

## Complemento de 23/11/2026

- O responsável confirmou que a tela apresentada pertence ao projeto de homologação e que o usuário existente pode ser usado em testes. A tela de Auth mostrava Site URL `http://localhost:3000` e nenhuma Redirect URL; será necessário cadastrar a URL exata da prévia isolada antes de testar recuperação de senha. Não foi alterada a configuração.
- A consulta agregada no projeto de homologação encontrou um perfil ativo, um material, um produto no catálogo, um pedido, nenhuma categoria, venda, despesa ou imagem do bucket. Essas contagens não demonstram por si só que todo o conteúdo é fictício ou que as integrações estão isoladas.
- Para as tabelas consultadas, `has_table_privilege` identificou SELECT anônimo em produção para `tarefas`, `pedido_subtarefas` e a view `financeiro_despesas_resumo`, mas não em homologação. As duas tabelas possuem RLS e a view usa `security_invoker`; privilégios SQL não confirmam acesso efetivo a linhas. Testes completos via API com perfis apropriados continuam pendentes; nenhuma permissão foi alterada.
- Falta comprovar o alvo real do build de prévia, fluxo de login e recuperação, Storage com dados fictícios, perfil sem autorização e bloqueio de integrações externas antes de considerar a homologação pronta para testes de escrita. Não apontar a prévia de teste ao banco de produção.

## Escopo da comparação

Foram comparados hashes de tipos/defaults e nulabilidade de colunas; definição de constraints; políticas de `public`; corpos e atributos selecionados de funções; definições de views e índices; metadados de gatilhos; sinalizadores de RLS; grants de tabela e permissões explícitas de execução; nomes e propriedades selecionadas de buckets e políticas de Storage. Não foram verificadas todas as configurações de roles, default privileges, dependências, extensões, jobs, Auth, segredos, arquivos, dados, backups, contagens de registros de negócio nem acesso efetivo via API.

## Primeira etapa de desenvolvimento

A migration `202611230001_marcas_base.sql` foi aplicada e registrada exclusivamente em `rava-homologacao`, após conferir o histórico. Criou `marcas` com Rava e Rivoxel, RLS e leitura limitada a usuários ativos; não altera produtos, categorias, estoque, vendas ou financeiro. Verificações posteriores identificaram duas marcas, um material e uma categoria de teste; não há permissão anônima de SELECT nem INSERT para authenticated. Testes locais: `npm run check`, incluindo 104 testes de aplicação e 59 testes de banco isolado, typecheck, lint e build. A RLS real com sessão autenticada e o processo de deploy ainda devem ser testados. Não foi executada migration em produção. Rollback em homologação, antes de existir dependência ou uso de dados: remover a tabela em migration corretiva após verificar dependências; em produção, exigir plano específico, backup e autorização, pois exclusão de tabela apaga dados.
