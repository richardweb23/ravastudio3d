# Configuração e publicação — RAVA Studio 3D

O site React continua hospedado no GitHub Pages. O Supabase fornece banco de
dados e autenticação. As contas são administradas diretamente pelo painel do
Supabase, sem uma página de usuários dentro do sistema.

## 1. Criar o projeto

1. Acesse [database.new](https://database.new) e crie um projeto.
2. Guarde o Project ID mostrado em Project Settings → General.
3. Em Project Settings → API Keys, copie a URL e a Publishable key
   (`sb_publishable_...`).

A chave secreta nunca deve ir para o frontend.

## 2. Vincular o repositório e criar o banco

No terminal, dentro da raiz deste projeto:

    npx supabase login
    npx supabase link --project-ref SEU_PROJECT_ID
    npx supabase db push

O último comando aplica as migrações da pasta `supabase/migrations`, incluindo
tabelas, índices, políticas RLS, funções transacionais e o local “Estoque
principal”.

## 3. Configurar autenticação

No painel do Supabase:

1. Abra Authentication → URL Configuration.
2. Defina a URL do site como
   `https://ravastudio3d.com.br/`.
3. Adicione às Redirect URLs:
   - `https://SEU-USUARIO.github.io/ravastudio3d/gestao/`
   - `https://ravastudio3d.com.br/gestao/`
   - `http://localhost:5173/ravastudio3d/gestao/`
   - `http://localhost:5173/gestao/`
4. Desative o cadastro público em Authentication → Providers → Email,
   mantendo login por e-mail habilitado.
5. Personalize o modelo de recuperação de senha, se desejar.

Para uso contínuo em produção, configure SMTP próprio em Authentication → SMTP
Settings.

## 4. Administrar contas

Use exclusivamente Authentication → Users no painel do Supabase para:

- adicionar usuários;
- enviar convites;
- redefinir senhas;
- bloquear ou excluir contas.

O trigger do banco cria automaticamente o registro correspondente em
`public.profiles`. Essa tabela serve às políticas RLS da área administrativa e
não armazena senhas.

## 5. Desenvolvimento local

Copie `.env.example` para `.env` e preencha apenas valores públicos:

    VITE_SUPABASE_URL=https://SEU_PROJECT_ID.supabase.co
    VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_SUBSTITUA_AQUI

Projetos antigos também podem usar `VITE_SUPABASE_ANON_KEY` no lugar da chave
publishable. O sistema aceita os dois formatos e prioriza a chave publishable
quando ambas estiverem definidas.

Em seguida:

    npm install
    npm run dev

Abra `http://localhost:5173/ravastudio3d/gestao/` ou a URL exibida pelo Vite.

## 6. Publicar no GitHub Pages

No repositório GitHub:

1. Em Settings → Secrets and variables → Actions, crie:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` (recomendado) ou
     `VITE_SUPABASE_ANON_KEY` (formato legado)
2. Em Settings → Pages, selecione GitHub Actions.
3. Faça push para `main`.
4. Acompanhe o workflow “Publicar no GitHub Pages”.

Ao final, valide o site público em
`https://SEU-USUARIO.github.io/ravastudio3d/` e a gestão em
`https://SEU-USUARIO.github.io/ravastudio3d/gestao/`.

## 7. Atualizações futuras

    npx supabase db push

Nunca edite uma migração já aplicada em produção. Crie outra migração para
cada alteração posterior.

## Tarefas e organização

A migração `supabase/migrations/202609150001_tarefas.sql` cria a tabela de
 tarefas, os índices e as permissões para usuários ativos. Aplique-a com
`npx supabase db push` em um ambiente vinculado ao projeto, ou execute o conteúdo
 desse arquivo no SQL Editor do Supabase depois das migrações anteriores.

Após aplicar, use Organização → Tarefas → Cadastrar tarefas para abrir o modal e informar a pessoa
 encarregada, a descrição e a previsão de entrega. O quadro aparece em
Organização → Tarefas e abaixo de Pedidos em andamento na Visão geral.

A migração `202609150002_titulo_tarefas.sql` adiciona o título obrigatório das
tarefas. Os registros existentes recebem os primeiros 150 caracteres da
descrição como título, que pode ser ajustado em Editar. Aplique as duas
migrações de tarefas em ordem antes de usar o novo formulário.


## Consignação: detalhes de locais e vendedores

Aplique a migração `202609150003_consignacao.sql` após as anteriores, pelo
SQL Editor do Supabase ou por `npx supabase db push` em um ambiente vinculado.
A migração foi preparada no repositório; sua aplicação em produção é separada.

- Acesso: **Locais e vendedores → Detalhes**. As rotas seguem
  `/gestao/#/locais-vendedores/local/:id` e
  `/gestao/#/locais-vendedores/vendedor/:id`.
- Vendedores podem vincular um local existente ou criar um exclusivo. O vínculo
  é único e permanente para preservar o histórico; registros podem ser desativados.
- Adicionar produtos transfere unidades de um estoque de origem. Cadastre o
  saldo na origem antes de enviar. Retiradas devolvem unidades ao destino escolhido.
- Ajustes exigem motivo e registram uma variação positiva ou negativa.
- Preço sugerido e repasse são acordos por produto/local, em centavos. As vendas
  gravam os valores vigentes e também entram na tabela de vendas já utilizada.
- Vendas feitas nas telas existentes e nas entregas de pedidos também capturam
  o acordo do local no momento da venda.
- Cada pagamento quita integralmente as vendas selecionadas, com data, valor e
  vínculo permanente. Não há pagamento parcial de uma mesma venda nesta versão.
- Valores e históricos financeiros não podem ser editados ou apagados pela aplicação.
- Estoques anteriores entram como **saldo inicial**. A coluna Enviada contabiliza
  os novos envios registrados; o saldo inicial aparece separado, sem inventar envios.
- Vendas anteriores ficam marcadas como **Sem acordo registrado**. Não é calculado
  repasse retroativo com base em preços configurados posteriormente.
- A imagem do produto aparece quando `materiais.imagem_url` possui uma URL HTTP(S).

Validação: `npm run check` inclui testes de cálculos e rotas, PostgreSQL isolado
via PGlite, lint e build. O banco de teste existe apenas em memória; simula o
esquema de autenticação e aplica as migrações reais. Não acessa dados de produção.


### Se a migração de consignação apresentar deadlock (40P01)

Use a versão atualizada de `202609150003_consignacao.sql`, sempre completa.
Ela reserva os bloqueios antes das alterações, com `NOWAIT` e até 20 tentativas
curtas. Em cada tentativa malsucedida, libera os bloqueios já obtidos antes de
aguardar. Se o banco continuar ocupado, interrompe sem aplicar a migração.

1. Aguarde operações em andamento e evite executar a migração simultaneamente
   em mais de uma aba. Pause o uso das telas da gestão durante a aplicação.
2. Se o SQL Editor mantiver a transação abortada, execute `ROLLBACK;`.
3. Execute o arquivo atualizado inteiro, de `begin;` até `commit;`.

O erro em uma execução integral impede o commit da migração. Se você executou
apenas trechos, confira o que já foi criado antes de tentar executar tudo novamente.
Não é necessário apagar tabelas ou encerrar conexões de outros usuários.
