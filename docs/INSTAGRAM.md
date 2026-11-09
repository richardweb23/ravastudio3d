# Instagram — base em desenvolvimento

**Arquitetura de dois projetos:** a migração antiga de projeto único foi movida
para `supabase/instagram-draft/` e não deve ser aplicada. O arquivo
`202611070002_instagram_separado.sql` é o rascunho para o segundo projeto;
nenhuma tabela aceita acesso direto do navegador. O gateway administrativo
valida a sessão no projeto principal e possui operações limitadas, mas ainda
precisa ser validado entre projetos reais antes de aplicar o rascunho.

Esta implementação é parcial e não está pronta para produção. A migração da
base inicia desativada e não deve ser aplicada remotamente
até a integração completa ser revisada e aprovada. O painel contém as quatro
abas, configurações e vínculos em ambiente de teste, além de simulação local.
A sincronização e o worker foram preparados, mas ainda não foram implantados
nem validados com a conta real.

Validação local: as quatro funções foram empacotadas com o runtime Edge oficial
em contêineres temporários com a pasta de funções em modo somente leitura. O
worker foi iniciado isoladamente com credenciais fictícias e sem habilitar
envios; uma solicitação HTTP autenticada recebeu `503 Send gate disabled`.
O webhook também foi iniciado isoladamente: o desafio correto retornou 200 com
o conteúdo esperado e um token incorreto retornou 403.
A sincronização isolada retornou 403 para solicitação sem sessão.
Esse teste não valida integração com a Meta nem deploy em Supabase hospedado.

Já preparados na Meta: aplicativo Rava Studio 3D, login unificado com as
permissões instagram_basic, instagram_manage_comments e
instagram_manage_messages, e conta ravastudio3d adicionada para testes. Isso não
comprova que as permissões ou o tipo de token sejam suficientes para produção.

Há um receptor de webhook que verifica a assinatura HMAC e persiste o evento
antes de confirmar o recebimento; o worker processa os eventos após agendamento.
O corpo bruto contém dados da Meta e ainda não possui limpeza agendada;
portanto não faça deploy nem configure a assinatura do webhook nesta etapa.

Pendências antes de ativar: confirmar as regras vigentes de respostas privadas e
do login unificado, implementar autenticação e rotação de token no backend,
validação do payload de webhook em teste real, agendamento da execução e retenção,
revisão do painel em diferentes telas e testes externos controlados. A fila possui
reservas exclusivas; a orquestração da fila e o núcleo do processador tratam
confirmação e resultados incertos em testes. Existe uma função de execução
protegida por segredo, mas ela ainda não está agendada nem validada na Meta. Não
cadastre credenciais no código, no frontend ou em mensagens de chat.

O contrato de Private Replies para login unificado foi conferido no material
oficial fornecido pelo usuário: `graph.facebook.com`, token de usuário do
sistema, permissões `instagram_basic`, `instagram_manage_comments` e
`instagram_manage_messages`, envio para `/<ig_id>/messages` usando o ID do
comentário. Uma resposta por comentário, até sete dias; Live exige resposta
durante a transmissão. O adaptador local trata respostas incertas sem repetição
e está ligado ao núcleo do worker. A leitura do comentário e a resposta pública
seguem a referência oficial de IG Comment e Replies; ainda falta validar o
evento real e configurar o agendamento da função. Stories e Lives permanecem
desabilitados pela pré-verificação conservadora até validar suas condições.

A identificação do comentário fica separada do log para possibilitar retenção
diferente. A função de limpeza remove atividade e eventos finalizados com mais de
90 dias, mas ainda não está agendada. A deduplicação por comentário não é
removida pela limpeza; seu período definitivo ainda precisa ser definido.

## Configuração futura, após conclusão e aprovação

Os arquivos de `supabase/migrations/` pertencem ao projeto principal. **Não use
`supabase db push` apontando este repositório para o projeto Instagram**: isso
tentaria aplicar as migrações da gestão nesse projeto. Após revisão e aprovação,
aplique somente `supabase/instagram-draft/202611070002_instagram_separado.sql`
no SQL Editor do projeto novo. Não execute o arquivo de projeto único.

As funções a publicar no projeto novo são `instagram-admin`, `instagram-sync`,
`instagram-webhook` e `instagram-worker`. Confira o project ref antes de cada
deploy. O token da Meta já foi cadastrado pelo usuário; não o exponha em logs,
prints ou comandos compartilhados. Mantenha `INSTAGRAM_SEND_ENABLED` ausente ou
com valor `false` até autorização explícita para mensagens reais.

- O receptor espera os secrets de backend `META_APP_SECRET` e
  `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`; o Supabase injeta `SUPABASE_URL` e
  `SUPABASE_SERVICE_ROLE_KEY`. Jamais use prefixo `VITE_` para esses valores.
- O worker requer `INSTAGRAM_WORKER_SECRET`, `INSTAGRAM_ACCESS_TOKEN`,
  `INSTAGRAM_ACCOUNT_ID` e `INSTAGRAM_API_VERSION`, todos no backend; o
  agendador deve apresentar o segredo de worker no cabeçalho Authorization.
- A leitura de produtos usa `MAIN_SUPABASE_URL` e
  `MAIN_SUPABASE_PUBLISHABLE_KEY`, sem a chave administrativa do projeto principal.
- O frontend usa `VITE_INSTAGRAM_SUPABASE_URL` e
  `VITE_INSTAGRAM_SUPABASE_PUBLISHABLE_KEY`, ambas públicas. A sessão do projeto
  principal é validada pelo gateway; a chave administrativa permanece no backend.
- `INSTAGRAM_SEND_ENABLED` só deve ser configurado como `true` após autorização
  explícita para mensagens reais. A ausência desse secret bloqueia a execução
  do worker, mesmo se a automação for marcada como ativa no painel.
- O callback da função, após deploy autorizado, terá a forma
  `https://<project-ref>.supabase.co/functions/v1/instagram-webhook`. O token de
  verificação é criado pela equipe e cadastrado de forma idêntica na Meta e no
  secret do Supabase, sem trânsito pelo chat.
- `verify_jwt` fica desativado no webhook, autenticado por HMAC, no worker,
  autenticado por segredo próprio, e nas funções administrativas, que validam
  internamente a sessão e o perfil ativo no Supabase principal.
- A configuração de login com a Meta também exige uma URL de redirecionamento
  OAuth, que ainda não foi implementada. A URL de callback do webhook não é a
  URL de redirecionamento de login.
- A limpeza `instagram_limpar_registros` precisará ser agendada por backend
  autorizado; nenhum agendamento é criado pela migração atual.
- Depois de configurar Vault com `instagram_worker_url` e
  `instagram_worker_secret`, o agendamento abaixo pode ser revisado e aplicado
  separadamente no projeto aprovado. Ele depende de `pg_cron` e `pg_net`:

  ```sql
  select cron.schedule('instagram-worker', '* * * * *', $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name='instagram_worker_url'),
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' ||
        (select decrypted_secret from vault.decrypted_secrets where name='instagram_worker_secret')),
      body := '{}'::jsonb
    );
  $$);
  ```

  Para a retenção diária, após a mesma configuração de Vault:

  ```sql
  select cron.schedule('instagram-retencao', '15 3 * * *', $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name='instagram_worker_url') || '?maintenance=1',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' ||
        (select decrypted_secret from vault.decrypted_secrets where name='instagram_worker_secret')),
      body := '{}'::jsonb
    );
  $$);
  ```

  O horário é UTC. Antes de usar, confira as permissões de leitura da fila
  `pg_net` e o funcionamento do Vault no projeto. Os nomes devem ser únicos.
- Antes de qualquer implantação, validar o contrato de eventos, o token do
  login unificado, Private Replies, os tipos de mídia e as permissões na
  documentação oficial e em testes controlados com a conta da Rava.
