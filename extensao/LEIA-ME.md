# Extensão CW Reputação — painel de contexto

Painel lateral que mostra o cliente do CW Reputação **por cima** do
WhatsApp Web, do Hugme/Reclame Aqui e do ManyChat. É a Peça A do
`EXTENSAO.md`.

Mostra caso, prazo, risco, estabelecimento, NPS e o que fazer a seguir.
Não responde reclamação e não manda mensagem — **nunca**.

Grava em um caso só: quando você lê uma reclamação no Hugme/Reclame Aqui
e confirma na prévia que quer adicioná-la ao Kanban. É como a reclamação
entra na operação hoje, já que o Reclame Aqui não tem API pública.

## Tema e fonte

O painel usa a **Geist**, a mesma fonte da aplicação, empacotada junto
(69 kB, um arquivo, todos os pesos) — não depende de nada instalado na
máquina nem de rede.

O tema tem três estados: **automático** (segue o sistema), **claro** e
**escuro**. Troque pelo botão &#9681; no cabeçalho do painel, ou em
Opções. A escolha vale para o painel, o popup e a tela de opções.

A largura da gaveta é ajustável: arraste a borda esquerda. Fica gravada.

## Quando o painel abre sozinho

**Só no WhatsApp Web, e só se você deixar.** Trocar de conversa lá é um
gesto seu; no Hugme e no ManyChat o que muda é uma página que se
redesenha sozinha, e tratar isso como "contato novo" fazia a gaveta
reabrir por cima de quem estava lendo.

O interruptor fica no rodapé do próprio painel — **abrir sozinho** —
porque é o ajuste que se quer mudar exatamente no momento em que ele
incomoda. Fechar a gaveta na mão também vale como decisão: ela não
reabre até o contato mudar de verdade.

## Adicionar uma reclamação ao Kanban

1. Abra a reclamação no Hugme ou no Reclame Aqui.
2. Se ela ainda não existe no CW Reputação, o painel oferece
   **Ler e adicionar ao Kanban**.
3. Confira a **prévia**: id, consumidor, telefone, e-mail, título, data,
   cidade, UF, prioridade e o relato — tudo editável. A leitura da
   página é aproximada por natureza (portal muda marcação sem avisar),
   então o que é gravado é o que está nos campos, não o que foi lido.
   **Categoria e subcategoria vêm da lista cadastrada na ferramenta**,
   não da página: o Reclame Aqui não classifica a reclamação, e campo
   aberto ali produziria "Financeiro", "financeiro" e "Finaceiro" na
   mesma base.
4. **Criar no Kanban** grava na coluna *Novo*, com a etiqueta
   "Capturada pela extensão", sem nota e sem avaliação.

Reclamação que já existe **nunca é sobrescrita**: o painel avisa em que
status ela está e com quem, e não toca em nada. Verificado contra o
banco: um caso movido para "Em tratativa" continuou lá depois de uma
segunda captura do mesmo protocolo.

A única exceção é **completar o contato vazio**. O vigia (abaixo) cria a
reclamação com "Não informado", porque o portal não mostra o nome do
consumidor em público. Abrindo a mesma reclamação na área da empresa e
clicando em **Criar no Kanban**, o painel responde que ela já estava lá
e completa nome, e-mail, telefone, documento, cidade e UF — só o que
estava vazio, mascarado ou "Não informado".

## O vigia do Reclame Aqui

**Quando a plataforma é aberta**, a extensão confere a lista pública da
Cardápio Web no Reclame Aqui e põe no quadro, na coluna *Novo*, as
reclamações que ainda não estão lá. Também lê no botão **Ler o Reclame
Aqui**, na barra do quadro, e no **Conferir agora** do popup. Não há
leitura em segundo plano: abrir a plataforma de novo em menos de dez
minutos reaproveita a última leitura.

Quem liga a plataforma à extensão é `conteudo/ponte.js`, que o service
worker registra só no endereço configurado nas Opções (permissão
`scripting`). A página não fala com a extensão sozinha — ela não sabe o
id da extensão, que numa descompactada muda de máquina para máquina.

Na mesma volta ele completa o que o portal sabe e o quadro não: a
resposta pública que ficou sem texto, e a avaliação do consumidor
quando ela chega. Uma vez por dia a lista vai mais fundo (30 páginas),
atrás de avaliação nova em reclamação antiga.

- **Por que na extensão, e não no servidor:** o Cloudflare do portal
  responde "Just a moment…" a qualquer cliente que não seja navegador.
  O Chrome de quem está logado passa.
- **Quem decide o que grava é o servidor**
  (`lib/services/raPortal.service.ts`): reclamação de outra empresa é
  recusada; existente nunca é recriada nem sobrescrita — só recebe o que
  o portal é dono, e texto só onde o banco está vazio; a mesma
  reclamação com outro número (o Hugme numera diferente) é reconhecida.
- **Se o portal pedir a verificação de navegador**, a leitura para, e o
  botão da barra fica âmbar com o motivo. Abrir o portal numa aba
  resolve; a próxima abertura da plataforma lê de novo.
- **Só grava com acesso AGENTE ou ADMIN.** Quem só lê vê o motivo no
  popup.
- Desliga em **Opções → Vigia do Reclame Aqui**.

`npm run check:vigia` prova o leitor contra a estrutura real das
páginas e as travas contra o banco; `npm run check:vigia-volta` roda o
service worker inteiro contra a aplicação no ar.

### Completar o que o vigia trouxe sem o consumidor

O vigia cria com "Não informado", sem contato e sem CPF/CNPJ — o portal
não mostra isso em público. Na plataforma, essas reclamações ganham o
botão **Completar** (cartão, lista, tela do caso e aviso no alto do
quadro), que abre um painel com o atalho para a reclamação na área da
empresa.

Nessa página, a extensão confere o que falta no quadro e, se a página
tem, mostra o que leu (nome, telefone, e-mail, CPF/CNPJ) com o botão
**Completar no quadro**. **Só grava depois do clique**, e só onde o
quadro está vazio. Com o documento, a reclamação se liga ao
estabelecimento sozinha.

Criar caso exige perfil **AGENTE** ou **ADMIN** — quem tem acesso de
leitura vê o painel, mas o botão recusa.

### O que a página da reclamação entrega

Foi medido contra uma reclamação real, e é o que `npm run check:ra`
confere a cada mudança:

| Campo | Onde está | Armadilha |
| ----- | --------- | --------- |
| ID | `ID: 256949163` no corpo | Não está na URL — o sufixo do endereço público é um hash |
| COD | `COD: uPDvBFKmssmEmxVa` | É outro identificador. Vai para a prévia, não é gravado |
| Data | "20/08/26 às 11h21" | **Ano de dois dígitos.** Exigir quatro fazia a reclamação nascer com a data de hoje |
| Cidade | Etiqueta entre o ID e a data | **Vem sem UF.** Procurar "Cidade - UF" atravessava parágrafos e devolvia lixo |
| Nome | Linha acima de "Nome social" | O portal público não mostra; esta página, sim — e mostra dois (exibição e registro) |
| Telefone | Bloco "Telefones do consumidor…" | Fora do bloco, um padrão de telefone casa **dentro do CNPJ** de catorze dígitos do formulário |
| E-mail | Bloco "Contatos do cadastro do consumidor" | Há **dois** e-mails na página, de pessoas diferentes — o outro é o do estabelecimento |
| Relato | Depois do título "A reclamação" | O maior bloco de texto da página é o script do Google Tag Manager |

### Informações adicionais (RA Forms)

O bloco que o Reclame Aqui coleta antes de publicar — relação com a
empresa, CNPJ de cadastro no portal, e-mail de acesso, nome do
proprietário. A prévia **mostra e não grava**, com botão de copiar em
cada resposta.

É de propósito: ali está o vínculo cliente ↔ estabelecimento que falta
na base, e onde cada campo deve ser gravado ainda não foi decidido —
escrever antes de decidir criaria dado torto em três tabelas.

O bloco nasce recolhido na página. Clique em **Exibir** lá e depois em
**Reler a página** na prévia: expandir não muda o endereço, que é o que
dispara a leitura automática.

## Registrar o NPS pela extensão

Quando o cliente tem um ciclo de NPS aberto, o painel mostra a nota, o
status, as tentativas e o prazo — e agora deixa registrar sem abrir a
aplicação:

- **Não atendeu?** Canal + o que aconteceu → *Registrar tentativa*. Cada
  uma conta para a regra das três em 7 dias, que é o que autoriza
  encerrar por falta de retorno.
- **Depois do contato**: a régua de humor (😡 🙁 😐 🙂 🤩) e "a situação
  foi resolvida?". Marcar **Sim** também confirma o item do checklist.

A **nota do NPS não muda** — ela é de antes, mede o estado em que o
cliente respondeu a pesquisa, e é ela que compõe o indicador. A régua
mede outra coisa: se o contato moveu a agulha.

Encerrar o ciclo continua sendo da tela do `/nps`, que tem o checklist.
Encerramento numa gaveta de 380 px vira encerramento sem lastro.

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

## Respostas rápidas ao lado da caixa de mensagem

No WhatsApp Web, ao lado do campo onde se escreve, aparece um botão
**Respostas rápidas** (ou `Ctrl + /` com o cursor no campo). Ele abre a lista
inteira dos textos aprovados da Base de Conhecimento, com busca — e
**escreve o texto escolhido dentro da caixa**.

Isso não substitui o bloco de macros da gaveta; resolve o que ele não
resolvia. A gaveta mostra no máximo três, filtradas pela categoria do
caso, e não mostra nada quando o contato não tem reclamação — e o
botão de lá é "copiar", que deixa a colagem por conta de quem está
com o cliente na linha.

**O que já vem preenchido.** `{{cliente}}` com o nome do cadastro do
consumidor (o do portal, não o apelido da agenda), `{{responsavel}}`
com **quem está logado** — é você que está falando na conversa, então
não é o dono do caso —, `{{protocolo}}` e `{{estabelecimento}}` com os
do caso mais recente daquele contato.

**O que não vem, e aparece dito.** Variável sem valor **continua
visível** no texto, e o item traz a etiqueta do que falta. Sem caso
não há protocolo; sem plano cadastrado não há tabela de preços.
Trocar por vazio produziria a pior falha possível aqui: uma mensagem
inteira, sem aviso nenhum, saindo com um buraco no meio
("Reclamação: ") na frente do consumidor.

Os trechos entre colchetes — `[NOME]`, `[SEU NOME]`, `[NOTA]` — são
pedidos de escrita que o autor do texto deixou de propósito. O atalho
conta quantos são e avisa depois de colar.

**A ordem melhora sozinha.** Primeiro os textos de WhatsApp, depois os
do NPS — que também são mensagens de WhatsApp, porque a pesquisa fala
com o cliente por um número próprio —, depois Instagram e por fim as
respostas públicas do portal. Dentro de cada grupo, o mais usado na
frente: cada inserção conta um uso no banco.

**Ele não envia.** O texto entra no campo e para ali; quem aperta
enviar é você, sempre. E se a caixa recusar a escrita — o WhatsApp
muda a marcação sem avisar —, o atalho diz que não conseguiu e deixa o
texto na área de transferência, em vez de fingir que colou.

`npm run check:atalho` prova isso tudo contra as macros do banco.

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
  tela só como segunda tentativa. Ao clicar em "Ler e adicionar ao
  Kanban", também o título, a data, o local e o relato — para a prévia.
- **Página pública da Cardápio Web no Reclame Aqui**, pelo vigia: a
  lista de reclamações e a página de cada uma que falta no quadro. É a
  mesma página que qualquer pessoa vê sem login.
- **ManyChat:** um telefone visível, quando existe.

Nada sai da máquina a não ser para o seu próprio CW Reputação, e só três
coisas saem: a **consulta** (um telefone, um nome ou um protocolo — nunca
uma conversa), a **reclamação do portal** que você confirma na prévia,
e o que o **vigia** leu da página pública do Reclame Aqui.

A única coisa que a extensão **escreve** numa página alheia é o texto
de uma resposta pronta, dentro da caixa de mensagem do WhatsApp, e só
quando alguém escolhe uma na lista. Nem isso é escrito no DOM: o
editor deles é avisado pelos mesmos eventos que uma pessoa digitando
geraria — escrever no `innerText` mudaria a tela sem o editor saber, e
a mensagem sumiria no primeiro Enter.

Sobre bloqueio de conta no WhatsApp: o risco está ligado a comportamento
de **envio** — volume, mensagem repetida, lista fria. A extensão não
envia mensagem nenhuma, em site nenhum; a única escrita que existe é no
banco da própria Cardápio Web. É o mesmo padrão que CRMs usam sobre o
WhatsApp Web há anos.

## Arquivos

```
extensao/
  manifest.json          o que a extensão pede e onde injeta
  comum/config.js        endereço e preferências, em um lugar só
  comum/portal-ra.js     leitor das páginas públicas do RA, sem DOM
                         (o vigia usa no service worker)
  conteudo/ponte.js      a ponte com a página da plataforma (ler o
                         portal ao abrir e no botão)
  fundo/service-worker.js  o único que fala com a rede e lê o cookie
  fontes/Geist-Variable.woff2  a fonte da marca, empacotada
  conteudo/
    nucleo.js            utilidades + registro da fonte
    estilo.js            CSS do painel e do atalho (vai para dentro
                         do Shadow DOM)
    painel.js            a gaveta, o tema, a captura — igual nas três
    whatsapp.js          detector do WhatsApp Web
    respostas.js         o botão "Respostas rápidas", no rodapé do WhatsApp
    ra-campos.js         leitores da página do RA, puros e testáveis
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
app/api/extensao/caso/            cria a reclamação capturada
app/api/extensao/ra-novas/        quais da lista são novas ou atrasadas
app/api/extensao/ra-vigia/        o que o vigia deve buscar; e grava
app/api/extensao/completar/       o que falta à reclamação; e completa
lib/services/raPortal.service.ts  as travas do vigia
app/api/extensao/nps/             tentativa e pós-contato do NPS
app/api/extensao/respostas/       os textos prontos, já preenchidos;
                                  e a contagem de uso
lib/services/respostas.service.ts a substituição de variáveis, com a
                                  regra de deixar à vista o que faltou
lib/services/nps.repository.ts    a regra do pós-contato, compartilhada
                                  com as server actions da tela
scripts/check-contato.ts          a prova do casamento contra o banco
scripts/check-ra.js               a prova dos leitores da página do RA
scripts/check-atalho.ts           a prova do atalho de respostas
scripts/check-vigia.ts            a prova do leitor e das travas do vigia
scripts/check-vigia-volta.ts      a volta do vigia, com o service worker
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
