# Implantação do catálogo dos sites: plano para revisão

Este plano não autoriza nem executa mudanças em produção. A classificação é exclusiva do Catálogo do Site; não modifica caixa, preços, estoque, categorias operacionais, vendas ou pedidos.

Consulta somente leitura em 24/11/2026: produção tinha 43 produtos publicados, 5 em outros estados e 1 indicação publicada. A tabela `site_classificacao_produtos` ainda não existia; `catalogo_indicacoes.categoria_id` não aceitava nulo e o gatilho `validar_indicacao_catalogo` existia. Isso confirma apenas essas pré-condições, não toda a compatibilidade do esquema. Repetir a consulta antes de implantar.

Na mesma data, a definição da validação de indicações conferida em produção corresponde à regra legada esperada pela proposta: exige categoria Marketplace, verifica conflito de slug e exige categoria ativa para publicar. A consulta pública legada estava acessível a anônimos e autenticados; `usuario_ativo` estava acessível a autenticados e não a anônimos. Foram também registradas as assinaturas de `catalogo_publico`, `duplicar_catalogo` e das três sobrecargas de `salvar_material`. A proposta não substitui essas funções operacionais nem a consulta pública legada. A comparação integral das demais dependências ainda é necessária.

## Antes da implantação

1. Confirmar o estado atual do banco de produção, os domínios, o último deploy estável e a configuração do build e do hook diário. Conferir a existência e a definição das tabelas, funções, permissões e gatilhos relevantes, e comparar a lista paginada de itens publicados com o resultado esperado. As contagens registradas anteriormente podem ter mudado.
2. A montagem de ensaio em `scripts/preparar-migracao-sites.mjs` combina as propostas em uma única transação, sem conectar a banco. Ela verifica ausência das novas tabelas, assinaturas de funções, o hash da definição de validação de indicações observada em produção, obrigatoriedade da categoria legada e presença e estado do gatilho de indicações. O teste isolado verifica a recusa se a função mudar ou o gatilho estiver desativado, força outra falha para conferir o rollback e verifica a classificação dos publicados e a preservação dos dados. Essas verificações não comparam os corpos das demais funções nem todos os detalhes do schema; a revisão completa continua necessária. As transações independentes dos arquivos de proposta não constituem, por si só, uma implantação atômica. Não executar as migrations antigas de marcas em produção.
3. Registrar backup recuperável e ensaiar o retorno. Salvar a definição de `validar_indicacao_catalogo`, a restrição anterior de `catalogo_indicacoes.categoria_id`, as configurações do Worker e do build e os identificadores da versão estável. Não incluir credenciais nesse registro.
4. Validar o build definitivo em ambiente separado com os mesmos contratos e dados representativos, inclusive indicações, URLs antigas, imagens, gestão, Instagram e atualização diária. A consulta adicional de classificação nas páginas antigas da Rava deve ser testada também com Supabase indisponível.

Ensaio local em 24/11/2026: o build multi-site completo usou o banco de homologação e gerou uma página Rava, sem publicar. No Worker local, início, catálogo e links da Rivoxel responderam 200; gestão nesse domínio respondeu 404; a página publicada da Rava respondeu 200 e um produto inexistente respondeu 404. Os testes automatizados cobrem a resposta 503 quando a consulta de classificação falha. Isso ainda não substitui a validação integrada de indicações, Instagram, atualização diária e configuração do Worker no ambiente definitivo.

O histórico consultado em 24/11 mostrou como deploy mais recente a versão `d25167d1-0d98-420f-a14d-4b8192e5a740` com 100% do tráfego. Esta referência deve ser conferida novamente antes da implantação: o build diário pode gerar outra versão. A ajuda do Wrangler instalado informa que `deploy` sem `--keep-vars` remove variáveis configuradas no painel que não constem da configuração local; portanto, o comando de deploy e a preservação das variáveis existentes devem ser revisados juntos. Segredos têm tratamento separado. Foi feito apenas um `deploy --dry-run` local, sem upload.

## Implantação, após aprovação específica

1. Repetir as verificações imediatamente antes da mudança e interromper se houver divergência. Aplicar somente a transação revisada: ela deve classificar como Rava os itens publicados naquele momento e não atribuir categoria aos rascunhos.
2. Verificar contagens, conteúdo e paginação dos dois catálogos, permissões e preservação dos dados operacionais. Neste ponto o site existente continua usando o contrato anterior.
3. Publicar o build multi-site e habilitar o Worker de forma coordenada. A branch preparada retorna 503 para Rivoxel sem `RIVOXEL_SITE_ENABLED=true`; confirmar previamente como a variável será aplicada à versão correta e como os dois domínios serão roteados. A variável do build `RAVA_MULTISITE_RELEASE_CONFIRMED=production` ativa o novo contrato e deve ser usada somente depois de a estrutura do banco estar pronta.
4. Validar os dois domínios, filtros, produto, link de administração, indicação e integração; conferir o próximo build diário e o sitemap. O usuário decide quais itens publicados devem ser transferidos para Rivoxel no Catálogo do Site.

## Retorno

- Interromper novos deploys e restaurar a versão estável anterior do Worker e suas configurações de domínio e build. Confirmar que os dois domínios e a gestão voltaram ao comportamento anterior.
- Manter inicialmente as novas tabelas sem uso: a aplicação antiga não depende delas. Não excluir classificações feitas após a implantação sem antes registrar e revisar essas alterações.
- A alteração de compatibilidade das indicações permite novos registros com `categoria_id` legada vazia. Se tais registros forem criados, simplesmente restaurar `NOT NULL` ou a função anterior pode falhar ou inviabilizar sua edição. Inventariar e tratar esses registros com o responsável antes de reverter o schema; não apagar nem atribuir categorias operacionais automaticamente.
- Um retorno do aplicativo não desfaz mudanças de conteúdo já feitas pelos usuários. Conferir o comportamento do catálogo legado e preservar os registros; decidir separadamente qualquer reconciliação de dados.
