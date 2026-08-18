# Extensão CW Reputação — painel de contexto

Painel lateral que mostra o cliente do CW Reputação **por cima** do
WhatsApp Web, do Hugme/Reclame Aqui e do ManyChat. É a Peça A do
`EXTENSAO.md`.

Somente leitura: mostra caso, prazo, risco, estabelecimento, NPS e o que
fazer a seguir. Não responde reclamação, não manda mensagem, não grava
nada.

## Instalar

Não está na Chrome Web Store — instala como extensão descompactada, o
que é o normal para ferramenta interna.

1. Abra `chrome://extensions` (funciona igual no Edge, em
   `edge://extensions`).
2. Ligue **Modo do desenvolvedor**, no canto superior direito.
3. Clique em **Carregar sem compactação** e escolha esta pasta —
   `cw-reputacao/extensao`.
4. O ícone roxo aparece na barra. Fixe-o (o alfinete no menu de
   extensões) para ele ficar sempre visível.

## Configurar

Um passo, e é obrigatório:

1. Clique no ícone → **Opções** (ou botão direito no ícone →
   Opções).
2. Escreva o endereço onde o CW Reputação está no ar —
   `https://…vercel.app`, ou `http://localhost:3000` em
   desenvolvimento.
3. **Salvar e conectar**. O Chrome vai pedir sua autorização para a
   extensão acessar esse endereço; sem ela nada funciona.
4. Entre no CW Reputação nesse mesmo navegador, com sua conta. A
   extensão usa a **sua** sessão — não tem login próprio.

O botão **Testar conexão** diz em qual dos três estados você está:
conectado como fulano, aplicação no ar mas sem login, ou endereço
inacessível.

## Usar

**WhatsApp Web.** Abra uma conversa. O botão roxo no canto inferior
direito ganha um número quando aquele contato tem caso aberto do nosso
lado. Clique para abrir a gaveta.

**Hugme / Reclame Aqui.** Abra uma reclamação. O painel procura o
protocolo no endereço da página e mostra se ela já existe aqui, com dono
e prazo.

**ManyChat.** Sem integração, então o painel funciona como atalho: se um
telefone estiver visível na tela ele consulta sozinho; se não, use a
busca.

**Qualquer lugar.** O popup do ícone mostra a nota do Reclame Aqui, os
alertas do dia e tem uma busca por telefone, nome ou protocolo — serve
no meio de uma ligação, sem precisar abrir a aplicação.

## O detalhe que decide o casamento por telefone

O telefone gravado na base está **mascarado**: `(27)•••••-4053`. Só DDD e
os quatro últimos dígitos. Comparar o número inteiro que o WhatsApp
entrega nunca casaria.

Então a chave é DDD + quatro finais. Medido nas 334 reclamações do banco
(`npm run check:contato`):

| Resultado | |
| --- | --- |
| Número do WhatsApp reencontra a própria reclamação | 334 de 334 (100%) |
| E aponta para um único cliente | 332 (99,4%) |
| Aponta para mais de um cliente | 2 (0,6%) — uma chave, `27-6862` |

Por isso o painel sempre rotula a confiança: **confirmado**, **provável**
ou **ambíguo**. Ambíguo vem com aviso na tela para conferir o nome antes
de tratar como o mesmo cliente.

Isso melhora sozinho no dia em que a base for importada com
`--pii`: aí o telefone fica inteiro, a comparação passa a ser exata e o
rótulo vira "confirmado" sem mudar uma linha de código.

## O que a extensão lê

- **WhatsApp Web:** o identificador da conversa aberta (`data-id`, que
  carrega o telefone) e o nome no cabeçalho. **Mensagem não é lida.**
- **Hugme / Reclame Aqui:** dígitos do endereço da página; o texto da
  tela só como segunda tentativa.
- **ManyChat:** um telefone visível, quando existe.

Nada sai da máquina além da consulta ao seu próprio CW Reputação — que
recebe um telefone, não uma conversa.

Sobre bloqueio de conta no WhatsApp: o risco está ligado a comportamento
de **envio** (volume, mensagem repetida, lista fria). Esta extensão não
envia nada. É o mesmo padrão que CRMs usam sobre o WhatsApp Web há anos.

## Arquivos

```
extensao/
  manifest.json          o que a extensão pede e onde injeta
  comum/config.js        endereço e preferências, em um lugar só
  fundo/service-worker.js  o único que fala com a rede e lê o cookie
  conteudo/
    nucleo.js            utilidades compartilhadas
    estilo.js            CSS do painel (vai para dentro do Shadow DOM)
    painel.js            a gaveta — igual nas três superfícies
    whatsapp.js          detector do WhatsApp Web
    hugme.js             detector do Hugme / Reclame Aqui
    manychat.js          detector do ManyChat
  popup/                 o que o ícone abre
  opcoes/                endereço, permissão e preferências
  icones/                PNGs + o script que os gera
```

Do lado da aplicação:

```
lib/api/extensao.ts               autenticação pela sessão do navegador
lib/services/contato.service.ts   casamento por telefone, e-mail e nome
app/api/extensao/sessao/          quem sou eu
app/api/extensao/contexto/        o retrato do cliente
app/api/extensao/resumo/          nota, contadores e alertas do dia
scripts/check-contato.ts          a prova do casamento contra o banco
```

## Por que endpoints novos, e não a API que já existia

`/api/reputacao` e `/api/casos` devolvem dado **sem telefone e sem
e-mail**, de propósito — foram feitos para o CW Engine consumir
indicadores, não para uma pessoa procurar um consumidor pelo número
(`API.md`, "O que a API não devolve").

A extensão precisa exatamente do que aquela API esconde. Então ela não
usa o `API_TOKEN`: autentica como você, com a mesma sessão AGENTE/ADMIN
que já vê telefone e e-mail nas telas. O papel continua sendo lido do
banco a cada chamada, não do cookie.

## Depois de mexer no código

`chrome://extensions` → botão de recarregar no cartão da extensão. As
abas que já estavam abertas precisam de F5: o script de conteúdo antigo
fica com o canal morto (o painel avisa isso quando acontece).

Para regerar os ícones: `npm run extensao:icones`.

## Limites conhecidos

- **Estabelecimento quase nunca aparece.** O vínculo cliente →
  estabelecimento não persiste hoje (o enriquecimento vive em memória no
  `ClientsContext`, e `Case` não tem coluna de estabelecimento no
  banco). O painel procura pelo registro de NPS, telefone, e-mail e
  nome — e com três estabelecimentos de exemplo cadastrados, o normal é
  não achar. Inventar o vínculo seria pior.
- **O aviso diário só existe com o navegador aberto.** O resumo que
  chega de manhã sem depender disso é a Peça B do `EXTENSAO.md`, que
  precisa do cron da Vercel.
- **Hugme e ManyChat são melhor-esforço.** O identificador sai do
  endereço da página, que é a parte estável; se a ferramenta mudar, a
  busca manual continua funcionando.
- **Sem `DATABASE_URL` a aplicação roda aberta**, em modo demonstração —
  é o comportamento que o `middleware.ts` já tinha, e as rotas da
  extensão seguem a mesma regra. Nesse modo os dados são os do
  repositório, com contato mascarado.
