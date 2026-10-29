# Google Analytics 4

O site já está configurado com o ID público `G-1WBT99GLQY`.
Basta publicar o código atualizado para ativar a coleta nas páginas públicas.
A variável abaixo é opcional e permite substituir esse ID no build.

## Configurar a propriedade

1. Abra https://analytics.google.com/ e crie uma conta/propriedade para RAVA Studio 3D.
2. Configure o fuso de São Paulo e a moeda BRL.
3. Adicione um fluxo Web para https://ravastudio3d.com.br.
4. Copie o ID de medição do fluxo, no formato `G-...`.

## Configurar a publicação

No repositório do GitHub, abra Settings → Secrets and variables → Actions → Variables.
Crie a variável `VITE_GA_MEASUREMENT_ID` com o ID do fluxo. O ID é público e não é uma senha.
Publique o código atualizado e execute novamente o workflow “Publicar no GitHub Pages”.
A variável é incorporada durante o build; alterá-la exige nova publicação.

Para builds manuais, configure a mesma variável no arquivo `.env.local` antes de gerar o build.

## Verificar

Abra o site publicado e consulte o relatório Em tempo real na propriedade correspondente.
Verifique também `/catalogo/` e `/links/`. Bloqueadores de anúncios podem impedir o envio.

A integração carrega a tag apenas no build de produção nos domínios
`ravastudio3d.com.br` e `www.ravastudio3d.com.br`, nas três entradas públicas.
O ambiente local e a área `/gestao/` não inicializam o Analytics.
Na ausência da variável, o site usa `G-1WBT99GLQY`.
Para desativar a coleta, defina a variável como `disabled` e publique novamente.

Documentação: https://support.google.com/analytics/answer/9304153?hl=pt-BR
