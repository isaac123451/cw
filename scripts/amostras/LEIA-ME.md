# Amostras das páginas públicas do Reclame Aqui

O `npm run check:vigia` e o `npm run check:vigia-volta` leem daqui. Do
Node não dá para buscar o portal ao vivo — o Cloudflare barra qualquer
cliente que não seja navegador —, então as páginas ficam salvas.

| arquivo | o que é |
| --- | --- |
| `ra-portal-lista.html` | a lista da empresa: o `__NEXT_DATA__` com `complaints.LAST` |
| `ra-portal-reclamacao.html` | uma reclamação: a `astro-island` com o `props` da reclamação, e uma ilha de cabeçalho antes, para o leitor provar que escolhe a certa |
| `ra-portal-desafio.html` | a tela antirrobô do Cloudflare ("Just a moment…") |

**A estrutura é exata; o conteúdo é fictício.** Foram montadas em
11/09/2026 a partir das páginas de verdade — os mesmos nomes de campo,
a mesma serialização do Astro (`[0,…]`, `[1,[…]]`, `[3,…]`), o mesmo
escape de atributo (`&quot;`, e `&amp;#8212;` dentro da resposta).
Relato, respostas, cidade e códigos foram trocados: estes arquivos vão
para o repositório, e uma reclamação real carrega o problema de uma
pessoa que não pediu para estar aqui.

## Quando o portal mudar

Se o vigia passar a dizer "a lista do Reclame Aqui mudou de formato",
abra a página no navegador, confira onde os dados foram parar, ajuste
`extensao/comum/portal-ra.js` e **atualize a amostra com a forma
nova** — trocando de novo o que for de consumidor.
