# Ambiente local de testes

O Supabase local roda PostgreSQL 17, Auth, API e Studio em containers separados da produção. As migrações de `supabase/migrations` constroem o banco, incluindo a mudança Pago/Pendente ainda não aplicada na produção. Nenhum dado real é importado automaticamente.

## Preparação no Windows

1. Instale Node.js 22 (versão indicada em `.nvmrc`).
2. Instale e abra o Docker Desktop com containers Linux. Siga o instalador para habilitar WSL 2/virtualização quando solicitado: https://docs.docker.com/desktop/setup/install/windows-install/
3. Na pasta do projeto, execute `npm install` e `npm run db:local:start`. A primeira execução baixa as imagens e pode demorar. Mantenha o Docker aberto.
4. Execute `npm run db:local:status` para ver os endereços e as chaves locais.
5. Copie `development/.env.example` para `development/.env`. Preencha `VITE_SUPABASE_PUBLISHABLE_KEY` com a chave pública local. Se a CLI fornecer apenas `anon key`, use `VITE_SUPABASE_ANON_KEY`. Nunca use a chave secret/service_role no navegador.
6. Execute `npm run dev:local` e abra http://127.0.0.1:5173/gestao/.

O modo `localtest` lê os arquivos de ambiente somente da pasta `development`. Ele recusa URL de Supabase remoto e chave vazia. Variáveis VITE exportadas no terminal ainda têm prioridade: remova-as se a validação apontar uma URL remota. O `.env` da raiz continua reservado à configuração já existente. Use sempre `dev:local` para testes isolados; `npm run dev` mantém o comportamento anterior e pode acessar produção.

## Usuário e dados fictícios

Abra o Studio LOCAL: http://127.0.0.1:54323. Em Authentication > Users, crie um usuário com e-mail/senha exclusivos para testes e confirme o e-mail. O trigger existente cria seu perfil automaticamente. Para testar como administrador, execute no SQL Editor desse Studio:

```sql
update public.profiles
set perfil = 'administrador', ativo = true
where id = (select id from auth.users where email = 'teste@example.com');
```

Substitua o e-mail pelo usuário de teste criado. Entre no sistema local com essa conta e cadastre produtos, estoque e vendas fictícios. Para verificar o pagamento: crie uma venda de R$ 110 em Bonecos como Pendente, confirme que não soma no caixa, marque Pago e confira os R$ 110; volte a Pendente e confira a retirada do valor. O estoque não deve mudar nessas duas alterações de pagamento.

## Rotina

- `npm run db:local:start`: inicia os serviços locais.
- `npm run dev:local`: abre o frontend configurado para o Supabase local.
- `npm run check`: testes automatizados, testes PostgreSQL isolados, lint e build. Os testes não usam o banco de produção.
- `npm run db:local:stop`: para os serviços mantendo os dados locais.
- `npm run db:local:reset`: APAGA OS DADOS LOCAIS e reaplica todas as migrações. Recrie o usuário de testes em seguida. O comando usa explicitamente `--local`; não acrescente `--linked` ou `--db-url`.

Depois de adicionar uma migração, reaplique-a no ambiente local com reset somente quando puder descartar os dados fictícios. Não publique `development/.env`. O build normal de produção continua usando a configuração da raiz/CI; não publique um build feito com `--mode localtest`.

## Antes de produção

Valide o login, as permissões e os fluxos afetados no ambiente local, além de `npm run check`. Faça backup de produção e aplique as migrações aprovadas antes do frontend que depende delas. O workflow atual publica o frontend ao enviar commits à branch `main`, mas não migra o banco automaticamente. Trabalhe em uma branch de desenvolvimento até concluir os testes.

O PostgreSQL usado anteriormente para validar restauração de backups não substitui o Supabase completo: sozinho ele não oferece a API e o login usados pelo site. Importar dados reais de backup é uma etapa separada; comece com dados fictícios.

Referência: https://supabase.com/docs/guides/local-development/cli/getting-started
