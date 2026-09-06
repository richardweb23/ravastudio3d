# RAVA Studio 3D

Site institucional e sistema administrativo da RAVA Studio 3D, desenvolvidos
em React com Vite.

## Desenvolvimento

    npm install
    npm run dev

- Site institucional: `https://ravastudio3d.com.br/`
- Área administrativa: `https://ravastudio3d.com.br/gestao/`

Para configurar banco, autenticação e publicação, consulte
[SUPABASE_SETUP.md](./SUPABASE_SETUP.md).

## Verificação

    npm run check

Esse comando executa testes, lint e build das duas entradas.

## Produção

O GitHub Actions publica o frontend no GitHub Pages. O Supabase fornece banco
de dados e autenticação. As contas são administradas diretamente em
Authentication → Users no painel do Supabase.

Em **Settings → Pages → Build and deployment**, a opção **Source** deve estar
configurada como **GitHub Actions**. Não selecione publicação pela branch
`main`: ela publica os arquivos-fonte em vez do conteúdo compilado de `dist`
e concorre com o workflow `Publicar no GitHub Pages`.
