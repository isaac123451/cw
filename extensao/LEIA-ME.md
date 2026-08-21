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
- **ManyChat:** um telefone visível, quando existe.

Nada sai da máquina a não ser para o seu próprio CW Reputação, e só duas
coisas saem: a **consulta** (um telefone, um nome ou um protocolo — nunca
uma conversa) e, quando você confirma na prévia, a **reclamação do
portal** que vai virar caso.

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
  fundo/service-worker.js  o único que fala com a rede e lê o cookie
  fontes/Geist-Variable.woff2  a fonte da marca, empacotada
  conteudo/
    nucleo.js            utilidades + registro da fonte
    estilo.js            CSS do painel (vai para dentro do Shadow DOM)
    painel.js            a gaveta, o tema, a captura — igual nas três
    whatsapp.js          detector do WhatsApp Web
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
app/api/extensao/nps/             tentativa e pós-contato do NPS
lib/services/nps.repository.ts    a regra do pós-contato, compartilhada
                                  com as server actions da tela
scripts/check-contato.ts          a prova do casamento contra o banco
scripts/check-ra.js               a prova dos leitores da página do RA
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
