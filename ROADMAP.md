# Roadmap — CW Reputação

Fila do que está combinado, com contexto suficiente para retomar cada
item sem reconstruir a conversa. Complementa o `DEPLOY.md` (como colocar
no ar), o `API.md` (integração) e o `README.md` (como rodar).

Atualizado em 21/08/2026. Aplicação **0.7.0**, extensão **0.7.0**.

> **Versão sobe junto com a mudança.** `package.json` e
> `extensao/manifest.json` andam no mesmo número: sem isso não dá para
> saber, olhando um navegador com a extensão instalada, se ele está
> falando com uma aplicação que já tem a rota que ele chama.

---

## Estado atual

**Banco: Supabase, no ar.** 38 tabelas, RLS ligado em todas, 334
reclamações **com telefone e e-mail completos** (não mais mascarados) e
789 respostas de NPS vindas do Wootric. **Nada da interface vive fora do banco** — o que
se edita sobrevive ao reload e segue a conta, não o dispositivo. Connection string **pooled (6543)** para a
aplicação e **de sessão (5432)** em `DIRECT_URL`, usada por `db:push`,
`db:seed` e pelos scripts.

**Os 12 contextos da interface gravam no Postgres** por server actions
(`lib/actions/`). O que se edita na tela sobrevive ao reload.

**Deploy:** em andamento na Vercel, importando de `isaac123451/cw`.

### Comandos próprios

| Comando | Para quê |
| ------- | -------- |
| `npm run db:check` | Testa a conexão e lista tabelas, contagens e RLS — sem exibir a senha |
| `npm run db:rls` | Liga RLS em todas as tabelas; descobre a lista no próprio banco |
| `npm run db:password -- <e-mail>` | Redefine a senha com hash bcrypt correto |
| `npm run db:seed` | Idempotente: recarrega base e cadastros sem duplicar |
| `npm run check:contato` | Prova o casamento telefone→reclamação contra o banco real |
| `npm run check:nps` | Compara o NPS daqui com o do Wootric na mesma janela |
| `npm run nps:wootric -- --dias=90` | Importa o NPS do Wootric (`--seco` para simular) |
| `npm run ra:importar -- <arquivo.xlsx>` | Grava o export do RA no banco **com contato completo** |
| `npm run check:ia` | Diz qual IA está ligada e faz uma chamada real com saída estruturada |
| `npm run check:busca` | Prova que a busca por candidatos não perdeu nenhum caso, e mede |
| `npm run check:mover` | Prova o que acontece ao mover um caso de etapa |
| `npm run check:ra` | Prova os leitores da página do Reclame Aqui contra o texto de uma reclamação real |
| `npm run check:cadastros` | Prova que Times, Metas e Clientes sobrevivem ao recarregamento |
| `npm run extensao:icones` | Regera os PNGs do ícone da extensão |

---

## A fazer

### 0. Handoff — leia isto primeiro (21/08/2026)

**Produção:** https://cw-rho-eight.vercel.app · repo `isaac123451/cw`,
branch `main` · aplicação e extensão em **0.8.0**, sempre no mesmo
número.

**Antes de dizer que algo está pronto, rode o `check:` correspondente.**
São scripts que rodam a conta contra o banco real; `tsc` e `lint` passam
limpos em cima de defeito de dado.

| Comando | Prova o quê |
| ------- | ----------- |
| `npm run check:ia` | Qual IA está ligada, com uma chamada real |
| `npm run check:busca` | Que a busca por candidatos não perdeu nenhum caso |
| `npm run check:mover` | Que voltar de "Resolvido" apaga a avaliação |
| `npm run check:cadastros` | Que Times, Metas e Clientes sobrevivem ao reload |
| `npm run check:ra` | Os leitores da página do Reclame Aqui (45 conferências) |
| `curl -H "Authorization: Bearer $API_TOKEN" .../api/saude` | O que **um ambiente** tem configurado |

> O `API_TOKEN` da Vercel é **diferente** do local — conferido.

---

### 1. Pausado pelo Isaac

**ManyChat — não mexer até ele avisar.** A planilha compartilhada
(`1-pCxjB4Rrw3drlDFGNRYMFceMVWSJe34PBLVR6Vfz4o`) tem uma aba só,
"Métricas do Reclame Aqui". O canal já está pronto do outro lado:
`Channel` no Prisma tem `MANYCHAT`, `SOCIAL_SOURCES` o inclui, a
extensão cria caso com essa origem e o detector do ManyChat já informa
o canal da página. Falta **só** o importador, e ele depende do arquivo.

---

### 2. Aberto, sem decisão pela frente — é só trabalho

**a) Botão Salvar nas telas restantes.** O Isaac pediu "em tudo que for
adicionar ou alterar". Cinco telas já usam o rascunho
(`lib/hooks/useRascunho.ts` + `components/shared/BarraDeSalvar.tsx`): as
cinco abas de `/reclame-aqui/configuracoes`. **Faltam nove**, e todas
gravam a cada tecla:

- `components/reclame-aqui/detail/CaseDetail.tsx`
- `components/clientes/ClientDetail.tsx`
- `components/estabelecimentos/EstablishmentDetail.tsx`
- `components/impacto/ImpactTypesCard.tsx`
- `components/jornada/JourneyTopics.tsx`
- `components/reclame-aqui/settings/WorkflowSettings.tsx`
- `components/reclame-aqui/toolbar/SavedFilters.tsx`
- `components/agenda/GoogleCalendarCard.tsx`
- `components/nps/RootCauseManager.tsx`

O passo é mecânico e está documentado no commit `2dbea29`: trocar a
lista pelo `rascunho.itens`, `saveX({...item, campo})` por
`rascunho.alterar(item.id, {campo})`, acrescentar `<BarraDeSalvar>` e
proteger a exclusão com a trava do "item que só existe no rascunho".

**b) Tela de análise do NPS.** Os filtros por segmento já existem na
barra do `/nps` e na fila da extensão. Falta a tela dedicada, no
espírito de `/reclame-aqui/analytics`: tendência do NPS, causa raiz e
distribuição da régua de humor. `summarize`, `bySegment` e `byRootCause`
já calculam tudo em `lib/services/nps.service.ts`.

**c) O cron — destrava três coisas de uma vez.** A aplicação não tem job
agendado, e por isso:
- o **encerramento automático dos 30 dias** do NPS só roda quando
  alguém abre a tela;
- **`movimentacao.atrasada`** não existe (atraso é estado que só se
  descobre comparando com o relógio);
- o **reenvio de webhook** que falhou não acontece.

Uma peça só (cron da Vercel) resolve as três.

**d) Importar NPS em lote**, como o Reclame Aqui faz com a planilha do
HugMe. O parser compartilhado (`raImport.service.ts`) é o modelo.

**e) Tipos e causa raiz do NPS como cadastro.** Hoje os sete tipos são
fixos em `lib/models/nps.ts`. A causa raiz já virou cadastro
(`NpsRootCause`) — os tipos seguem o mesmo caminho. A ressalva: lista
fechada existe para a análise de tendência não virar texto livre.

---

### 3. Bloqueado no Isaac — não dá para avançar sem ele

**a) A `ANTHROPIC_API_KEY` nunca foi preenchida** (o valor no `.env` é o
exemplo literal, `"sk-ant-..."`). Hoje quem responde é o **Gemini**, e
funciona. Se quiser a Anthropic, é preencher.

**b) `GEMINI_API_KEY` na Vercel.** Está no `.env` local e **não foi
possível confirmar em produção** — o `API_TOKEN` de lá é outro. Conferir
com `/api/saude`.

**c) `NEXT_PUBLIC_APP_URL` ausente.** Sem ela o retorno do OAuth do
Google Agenda monta `http://localhost:3000`.

**d) Onde gravar o vínculo cliente ↔ estabelecimento.** Três quartos do
caminho andaram: o Wootric manda `company_id` (gravado em
`NpsResponse.externalCompanyId`), o enriquecimento persiste
(`ClientProfile.establishmentId`), e o **RA Forms** da reclamação traz
CNPJ de cadastro, e-mail de acesso e nome do proprietário — a extensão
já lê e mostra os três na prévia, sem gravar.

Falta decidir **onde cada campo entra**. `Case` não tem coluna de
estabelecimento e `Case.cnpj` existe mas ninguém preenche. Casar por
CNPJ é o caminho óbvio. Medido e relevante: **nenhum dos 334 casos
importados tem empresa diferente do consumidor** — o export do Reclame
Aqui trata o reclamante como a empresa. Por isso o WhatsApp mostra o
estabelecimento e a base guarda a pessoa, e elas não casam.

**e) Planos nas macros.** Puxar da central de ajuda ou virar cadastro
numa tela. A ressalva registrada: preço e nome de plano envelhecem
calados dentro do sistema.

**f) Permissões por módulo.** Último card "Em breve" de
`app/configuracoes/page.tsx`. Definir o alcance antes de construir:
papel por módulo, ou permissão fina por ação?

---

### 4. Armadilhas já medidas — não redescobrir

- **O service worker do Manifest V3 morre em segundos.** Cache em `Map`
  não existe na prática; usar `chrome.storage.session`.
- **Dependência dura mata o painel.** Montar primeiro, checar depois —
  senão o sintoma é "a extensão não abre mais, só reinstalando".
- **200 com HTML não é sucesso.** Conferir `content-type` antes de
  `resposta.json()`, nos dois lados.
- **O `enum` do Gemini só aceita texto**; nome de modelo envelhece
  (`gemini-2.0-flash` já é 404); 503 é fila, não configuração errada.
- **Voltar um caso de "Resolvido" apaga a avaliação** (`moverPara`).
- **`updateTag` só vale em server action**; em rota é
  `revalidateTag(tag, "max")`.
- **A Área da Empresa do RA é um SPA**: a chave da leitura tem de ser
  endereço **+ id**, e o `<h1>` é o cabeçalho da tela, não o título.
- **Vários arquivos estão em CRLF** e heredoc de bash quebra com
  conteúdo grande — usar a ferramenta Write.

---

## Dívida técnica

### `setState` em efeito nos formulários

Treze ocorrências do mesmo padrão: o formulário preenche os campos em um
`useEffect` quando o modal abre. A correção certa é remontar com `key` e
inicializar no `useState`, mexendo em cada formulário **e** em quem o
abre.

A regra está como **aviso** em `eslint.config.mjs` para a dívida ficar
visível sem esconder erro real — `npm run lint` fecha com 0 erros e 16
avisos. Ao migrar, subir a regra de volta para `error`.

Os formulários novos (`MovementForm`, `MovementRuleForm`,
`CreateCaseModal`) já montam e desmontam com a abertura e **não** entram
nessa conta.

*(A etapa da jornada e os filtros salvos saíram daqui — hoje persistem
no banco. Ver "Tudo persiste" em Entregue.)*

---

## Decisões tomadas (não relitigar)

- **Nota desconsiderada sai do cálculo.** O Isaac primeiro pediu para
  manter contando com aviso, depois corrigiu: não pode influenciar. Hoje
  `contaParaNota` em `reputation.service.ts` a exclui, e o caso segue
  visível com a nota e o aviso.
- **O teto de tempo médio vale sobre o tempo de resposta**, e a média
  segue o período da tela.
- **Destinos de movimentação saem do próprio cadastro**, não do de Times
  — "Cliente" não é time. Uma movimentação em aberto por caso, e o prazo
  fica congelado no registro.
- **Tipos de impacto têm direção** (receita ou custo): sem isso, um tipo
  novo entraria somando e inflaria o resultado.
- **A importação grava PII** (e-mail e telefone reais) porque o destino é
  o banco. O dataset do repositório (`lib/data/mockCases.ts`) continua
  mascarado — ele está no git.
- **A extensão escreve, mas só sob confirmação.** Nasceu somente leitura;
  hoje cria caso a partir do que leu no portal ou de uma conversa,
  sempre depois de a pessoa conferir a prévia. Mensagem ela não envia em
  site nenhum, e isso não muda.
- **Promotor calado não abre ciclo de NPS.** Entra na base (o indicador
  precisa dele) com `[Encerrado] Sem tratativa`. São ~790 respostas por
  mês; abrir tratativa para cada nota 10 enterraria os detratores.

---

## Entregue

### Triagem por IA, e a IA como configuração (21/08/2026)

**"Dá para responder agora, ou precisa de análise?"** é a primeira
pergunta de quem abre uma reclamação, e a que mais custa quando erra nos
dois sentidos: responder o que exigia apuração vira promessa que não se
cumpre; mandar para análise o que já tinha resposta pronta queima o
prazo do índice de resposta, o item de maior peso da nota.

`/api/extensao/triagem` lê o relato **e os textos aprovados**. É o que
separa "sei responder" de "inventei uma resposta": sem macro que cubra o
assunto e com o relato pedindo dado que não está ali, a resposta certa é
analisar. Devolve decisão, gravidade, o que verificar, área sugerida e
um rascunho — e **não grava nem envia nada**.

Provado contra a reclamação real `RA-256949163`: decidiu *analisar*,
gravidade alta, quatro itens concretos para verificar, área "Suporte
Técnico", e um rascunho que acolhe sem prometer prazo.

**O assistente passou a usar a IA que estiver configurada.** Antes olhava
só a `ANTHROPIC_API_KEY` e ficava desligado numa instalação com Gemini —
a chave existia, só não era a que aquele arquivo conhecia. O streaming
foi para `ia.service.ts`, implementado nos dois provedores.

**Prazo nas chamadas.** Medido: uma triagem chegou a **162 segundos** com
a camada gratuita congestionada, e o botão ficou dois minutos e meio em
"Lendo…". Trinta segundos agora, e estourar conta como falha
transitória — que é o que faz tentar a reserva em vez de desistir.

### O cache que não existia (21/08/2026)

O cache do service worker era um `Map` em memória. No Manifest V3 o
service worker é **encerrado depois de poucos segundos ocioso** e
recriado na próxima mensagem — então quase nenhuma consulta acertava o
cache, e toda abertura do painel pagava a ida completa ao servidor.

Agora vive no `chrome.storage.session`, com dois prazos: **fresco por
dois minutos, servível por trinta**. Dentro do primeiro responde sem
tocar na rede; entre um e outro desenha na hora com o guardado e busca o
atual atrás, sem piscar a tela. `session` e não `local` porque some ao
fechar o navegador — contato de consumidor não fica gravado em disco.

Somado à busca por candidatos (7× mais rápida), é o grosso da lentidão
que se sentia ao abrir a gaveta.

### /api/saude (21/08/2026)

Diz o que **este** ambiente tem configurado — provedor de IA, banco
alcançável, Google, Wootric — sem revelar segredo nenhum. Nasceu de um
problema repetido: variável presente no `.env` e ausente na Vercel
produz recurso que funciona aqui e não lá, e descobrir isso exigia
entrar na aplicação e clicar no botão que falha.

Protegida pelo `API_TOKEN`:

```bash
curl -H "Authorization: Bearer SEU_API_TOKEN" https://cw-rho-eight.vercel.app/api/saude
```


### Filas por canal, anotações e escolha de IA (21/08/2026)

**Os três botões de canal davam o mesmo resultado**, e a culpa era de uma
decisão minha: eles só reescopavam a busca do contato aberto, e como
quase todo cliente tem caso num canal só, os três chegavam na mesma
lista. O botão prometia canal e entregava filtro.

Agora cada um abre a **fila do canal** — "o que está aberto aqui
agora?", ordenada por urgência (`/api/extensao/fila`), sem depender de
haver conversa nenhuma na tela. Um quarto botão, **Painel**, mostra
nota, contadores e alertas do dia. Clicar no que já está aberto volta
para o contato.

**Mover ganhou destino livre.** Além dos dois passos vizinhos, um
seletor leva para qualquer etapa ativa: um caso costuma pular colunas —
quem respondeu e já resolveu não passa por "Em atendimento" só para
chegar em "Resolvido".

**Anotações** (`/api/extensao/anotar`): anotação no caso, que entra na
mesma linha do tempo da gaveta, e tarefa na agenda, que é a que a
extensão já cobra por notificação. Nada disso vai para o consumidor — a
extensão segue sem mandar mensagem em site nenhum.

**"Cadastrar neste canal?"** Quando o telefone já existe em outro canal,
o painel diz onde e oferece registrar a passagem por este. Cada detector
informa em que canal está; a ficha do cliente ganhou o bloco **Canais**,
que lista por onde a pessoa passou, quando, e quantos casos em cada um.

**Responsável no Kanban** e **filtros de segmento no NPS** (Detratores /
Passivos / Promotores, com contagem, na barra de filtros — antes só dava
para filtrar clicando nos indicadores do topo, onde ninguém procura
filtro).

`npm run check:mover` prova contra o banco a regra com consequência
silenciosa: voltar um caso de "Resolvido" **apaga a avaliação**, senão
ela seguiria pesando na reputação de um caso que o próprio quadro diz
que não foi avaliado. Dezenove conferências, num caso descartável que o
script cria e apaga.

### A IA virou configuração (21/08/2026)

Estava presa à Anthropic, e a chave nunca tinha sido preenchida — então
o recurso não existia e ninguém sabia por quê. Agora
`lib/services/ia.service.ts` escolhe o provedor pela chave que estiver
definida: **Anthropic** ou **Gemini**, que tem camada gratuita. A rota
não sabe qual é, e `IA_PROVEDOR` inverte a preferência.

**O aviso que importa está no `.env.example`, onde a decisão é tomada:**
o que passa por ali é conversa real de consumidor, e camada gratuita
costuma permitir que o conteúdo seja usado para treinar o modelo. É
decisão de privacidade, não só de custo.

Detalhe que custaria uma tarde: o `responseSchema` do Gemini é um
subconjunto do JSON Schema e **recusa a requisição inteira** diante de
`additionalProperties`. O serviço poda o esquema, o que permite manter
um só para os dois provedores.


### Responsável no Kanban, e canais na extensão (21/08/2026)

**Não havia como atribuir responsável.** O nome aparecia no cartão e na
gaveta como texto — a gaveta inteira é somente leitura. Agora o cartão
do Kanban tem o seletor, que é onde a operação distribui o trabalho. A
lista virou `lib/hooks/useOwners.ts` (união do cadastro de Times com os
responsáveis que vieram nas 333 reclamações importadas), que a Toolbar
já usava duplicada.

O cartão é um link **e** é arrastável, então o seletor precisou de três
travas: `preventDefault` no clique, `stopPropagation` e
`draggable={false}` — sem a última, abrir a lista arrastava o cartão
para outra coluna.

**O painel ganhou rodapé de canais:** Reclame Aqui · NPS · Redes
Sociais. O motivo é o NPS: a pesquisa fala com o cliente por um
**WhatsApp próprio**, e uma conversa aberta ali não casa com reclamação
nenhuma do portal — o painel dizia "nada encontrado" para um cliente que
estava ali, com ciclo aberto. Na aba de NPS o painel lista **todos** os
ciclos da pessoa, em aberto primeiro; nas outras, só o mais recente.

A aba de NPS **não** filtra as reclamações. Ela filtra o destaque, não o
histórico: quem atende um detrator ganha em ver que a mesma pessoa tem
uma reclamação pública aberta.

**Avançar e voltar etapa, nos três canais.** `/api/extensao/mover` para
caso e `/api/extensao/nps` (`acao: "status"`) para o ciclo de NPS. Duas
decisões:

- **A extensão manda a direção, não a etapa.** A ordem das colunas é
  cadastro e muda na tela de configurações; uma extensão instalada há
  três semanas teria uma cópia velha. Ela só usa a lista para *rotular*
  o botão ("→ Em atendimento").
- **Não circula, e não encerra.** Na ponta vem aviso, não salto. E o
  encerramento do NPS depende do tipo e do checklist do guia — um botão
  que atravessasse isso produziria encerramento sem lastro.

A regra de mover saiu para `moverPara` em `case.service.ts`,
compartilhada com o `CaseContext`: voltar um caso de "Resolvido" apaga a
avaliação, e duas cópias dessa regra deixariam nota fantasma pesando na
reputação. O painel avisa quando isso acontece.

### "Resumir conversa" não era código (21/08/2026)

A `ANTHROPIC_API_KEY` **nunca foi preenchida**: o valor no `.env` é o
exemplo literal do `.env.example`, `"sk-ant-..."`, doze caracteres.
`hasAssistant()` rejeita corretamente, e a rota devolve 503 com o
motivo.

O defeito real era outro: o painel jogava a mensagem de erro **dentro do
rótulo do botão** por dois segundos. Num botão de 350 px, "ANTHROPIC_API_KEY
não configurada" é ilegível — e o efeito era o botão parecer que não faz
nada. Agora o motivo vai para um recado no topo do corpo, e o painel
distingue os dois casos que pareciam iguais: **zero mensagens lidas** é a
extensão (o WhatsApp Web mudou a marcação), **uma mensagem** é a
conversa mesmo.

*Pendência de configuração, não de código: preencher a chave no `.env` e
na Vercel. `NEXT_PUBLIC_APP_URL` também está ausente — sem ela o retorno
do OAuth do Google Agenda monta `http://localhost:3000`.*


### Ler a reclamação na Área da Empresa — a segunda rodada (21/08/2026)

A primeira versão não leu nada na página real. Quatro defeitos, todos
descobertos pelo Isaac abrindo uma reclamação de verdade:

- **A chave da leitura era só o endereço.** A Área da Empresa é um SPA:
  o endereço não muda entre a lista e a reclamação aberta, e o conteúdo
  chega **depois** do primeiro ciclo do detector. Ele lia a página ainda
  vazia, guardava "nenhuma reclamação aberta nesta aba" e nunca mais
  tentava. A chave passou a ser endereço **+ número da reclamação**.
- **O título era o `<h1>`**, que nesta tela é "Responder reclamação" —
  o cabeçalho da própria ferramenta. Agora vem da posição: a linha logo
  acima da fileira de etiquetas, abaixo do selo de situação.
- **A UF não existe na página.** Duas deduções, nesta ordem: as 156
  cidades que já têm UF na base (todas inequívocas — conferido), e o
  **DDD do telefone**, que não envelhece porque nenhum código de área
  brasileiro atravessa dois estados. A prévia diz de onde o valor veio.
- **Um `Unexpected token '<'` cru chegava à tela.** O service worker
  chamava `resposta.json()` sem conferir o `content-type`, então uma
  resposta HTML — endereço errado, proxy com login, aplicação de versão
  anterior à rota chamada — virava erro de sintaxe. Agora diz o que
  fazer, e o cabeçalho do painel distingue "endereço não configurado",
  "sem permissão", "aplicação fora do ar" e "sessão expirada" em vez de
  um "não conectado" para tudo.

Mais uma armadilha medida: **o `innerText` decide a quebra de linha
pelo layout**, não pela marcação. As quatro etiquetas do cabeçalho podem
chegar em quatro linhas ou em uma só, e o mesmo vale para o nome com a
etiqueta "Nome social" ao lado. `npm run check:ra` roda os dois layouts
— 45 conferências.

E, para o caso de ainda faltar alguma: a prévia ganhou **"copiar o texto
lido da página"** quando não acha nada. Consertar leitor de página sem
ver o texto que o navegador produziu é adivinhação, e adivinhação já
custou sete defeitos aqui.

### Popup: tendência e NPS (21/08/2026)

Item 2 da fila. `/api/extensao/resumo` passou a devolver a série dos
doze meses fechados (`getReputationTrend`, a mesma do gráfico de
`/reclame-aqui/analytics`) e o NPS dos últimos 30 dias (`summarize`, a
mesma da tela do `/nps`). Nenhuma conta nova: duas contas em paralelo
já divergiram nesta base uma vez, e o sintoma foi um número plausível e
errado.

### Limpeza (21/08/2026)

O caso de teste `IG-58097161` (título "a", cliente "a", sem
comentários, eventos, etiquetas nem avaliação) saiu da base. 334 → 333,
com as contagens que compõem a nota conferidas antes e depois: 333
reclamações do Reclame Aqui e 209 avaliações, iguais nas duas pontas.


### Cadastros que não gravavam (21/08/2026)

O Isaac reportou que **Times** não ficava salvo no módulo Reclame Aqui.
A auditoria dos vinte contextos achou mais dois buracos do mesmo tipo —
mutação que atualiza a tela e não chama `sincronizar`. Nenhum dos três
dava erro: o valor aparecia, e sumia no recarregamento seguinte.

| O que | Por que não gravava | Correção |
| ----- | ------------------- | -------- |
| **Times** (aba do RA) | `SettingsContext.saveTeam` só mexia no estado. O comentário no código dizia que era de propósito, para não ter "dois donos do mesmo registro" que `TeamsContext` já grava | `saveTeamOption` grava **só** nome, nome legado, ordem e ativo — os quatro campos desta aba. Descrição, departamento e líder continuam sendo da outra tela, na mesma linha da tabela `Team` |
| **Metas dos indicadores** | `GoalsContext` vivia num `useState`. A tabela `ReputationGoal` existia no schema desde o começo e **nunca era escrita** | Entra na carga compartilhada. Grava só o que **difere** do RA1000 — sem linha, o indicador segue o critério público, então uma mudança futura do Reclame Aqui chega sozinha |
| **Clientes** | `ClientsContext` guardava enriquecimento e cadastro manual em memória. Não havia tabela | Tabela `ClientProfile` nova (38ª, com RLS). Uma só para as duas coisas: a chave é o `slug` nos dois casos, e a coluna `manual` separa |

`npm run check:cadastros` prova os três contra o banco de verdade —
escreve o que a tela escreveria, lê de volta, confere campo a campo e
limpa o que criou. Vinte e quatro conferências, incluindo as travas que
importam: gravar pela aba Times não apaga a descrição da outra tela, e
um cliente vindo de reclamação resiste ao clique de exclusão.

### Salvar por botão, com confirmação (21/08/2026)

Os cadastros gravavam a cada tecla digitada. Dois problemas: **tudo**
virava alteração — inclusive o nome pela metade enquanto se digita — e
nunca aparecia confirmação de que salvou, porque não existia um momento
em que salvar acontecesse.

Agora a edição vive num rascunho (`lib/hooks/useRascunho.ts`) e o botão
**Salvar** grava. As cinco abas de `/reclame-aqui/configuracoes` já
usam: Status é modal e já tinha salvar próprio; Categorias,
Subcategorias, Times, Etiquetas e Checklist foram convertidas.

- **Grava só o que mudou.** Uma aba com doze categorias em que se
  corrigiu uma letra manda uma gravação, não doze — e é isso que permite
  a confirmação dizer "1 alterado" em vez de um "pronto" genérico.
- **A confirmação é verdadeira.** `sincronizar` passou a devolver o
  resultado (`{ ok, erro? }`), então o aviso só aparece depois da
  resposta do servidor. Confirmação disparada no clique confirmaria o
  clique, não a gravação.
- **Falhou alguma? O rascunho fica.** Limpar apagaria da tela justamente
  o que não foi gravado, e a pessoa sairia achando que salvou.
- **Barra de pendências** no rodapé do cartão, com a contagem
  ("2 alterações não salvas — 1 novo · 1 alterado"), Descartar e Salvar,
  mais o aviso do navegador ao fechar a aba com edição pendente.
- **Exclusão continua imediata**, como o Isaac pediu. A trava nova é
  outra: item que só existe no rascunho nunca chegou ao banco, e mandar
  apagar um id inexistente devolveria erro do servidor.

### Extensão: registrar o NPS sem sair da conversa (21/08/2026)

O item 1 da fila. O painel já *mostrava* o ciclo — nota, status,
tentativas e prazo. Faltava a outra metade: quem acabou de ligar estava
no WhatsApp e tinha de abrir a aplicação noutra aba para registrar.
Registro que exige troca de contexto é registro que não acontece.

`app/api/extensao/nps/route.ts` faz **duas** escritas e só estas duas:
a tentativa de contato (liguei, não atenderam) e o pós-contato (a régua
de humor e o "resolveu ou não"). Não encerra o ciclo, não classifica
causa raiz e **não toca na nota do NPS** — a nota é de antes, mede o
estado em que o cliente respondeu a pesquisa, e é ela que compõe o
indicador.

A regra saiu para `lib/services/nps.repository.ts`, compartilhada com as
server actions da tela: o que a extensão grava e o que a gaveta do
`/nps` grava são, literalmente, o mesmo código. A rota autentica pelo
cabeçalho `X-CW-Sessao` e por isso não pode chamar server action — sem
essa camada a regra existiria em duas cópias, que divergem na primeira
correção.

Detalhe que custou uma leitura da fonte do Next: em rota, `updateTag`
lança — só vale dentro de server action. O certo ali é
`revalidateTag(tag, "max")`.

### Extensão: ler a reclamação dentro do Reclame Aqui (21/08/2026)

A primeira versão do detector foi escrita contra o portal **público**,
que esconde quase tudo. A página que a operação realmente usa mostra o
consumidor inteiro — e três leitores estavam errados para ela:

- **O ano vem com dois dígitos.** A página escreve "20/08/26 às 11h21" e
  o leitor exigia quatro. Não casava nada, e a reclamação nascia com a
  data de hoje — movendo a janela da nota.
- **A cidade vem sem UF.** Só "Campo Bom", numa etiqueta entre o ID e a
  data. O leitor procurava "Cidade - UF" e, numa página real, atravessou
  parágrafos e devolveu "Não respondida Cardápio Web ... Fortaleza" como
  nome de cidade.
- **O nome do consumidor existe aqui.** Fica na linha logo acima da
  etiqueta "Nome social"; o de registro vem rotulado.

Mais duas armadilhas medidas, e as duas gravariam dado errado em
silêncio:

- **Há dois e-mails na página, de pessoas diferentes.** O do cadastro do
  consumidor e o que o RA Forms pergunta — "qual o e-mail utilizado para
  acessar o portal?", que é o do estabelecimento. Busca solta pegaria o
  primeiro que aparecesse.
- **O CNPJ do formulário são catorze dígitos seguidos, e um padrão de
  telefone casa dentro dele.** As âncoras `(?<!\d)`/`(?!\d)` fecham
  isso; procurar telefone só dentro do bloco rotulado fecha o resto.

Os leitores viraram funções puras sobre o texto da página
(`extensao/conteudo/ra-campos.js`) exatamente para poderem ser provados:
`npm run check:ra` roda as vinte e quatro conferências contra o texto de
uma reclamação real, sem abrir navegador. **A estrutura do texto de
teste é a da página; os dados pessoais são inventados** — o arquivo está
no git.

**O RA Forms é mostrado e não é gravado.** É o bloco mais valioso da
página: traz o CNPJ de cadastro no portal, o e-mail de acesso e o nome
do proprietário — ou seja, o vínculo cliente ↔ estabelecimento que falta
na base (item 6 da fila). Onde cada campo deve ser gravado é decisão do
Isaac, e escrever antes de decidir criaria dado torto em três tabelas.
A prévia mostra tudo, com botão de copiar.

**Categoria vem do cadastro, não da página.** O Reclame Aqui não
classifica a reclamação, e o que parecia rótulo de categoria era
pergunta de formulário. `/api/extensao/contexto` passou a devolver
`cadastros`, e a prévia oferece as categorias e subcategorias
registradas na ferramenta. Campo aberto ali produziria "Financeiro",
"financeiro" e "Finaceiro" na mesma base, e o ranking por categoria
passaria a contar três problemas onde há um.


### Extensão de navegador — painel de contexto (17/08/2026)

A Peça A do `EXTENSAO.md`. Gaveta lateral sobre **WhatsApp Web**,
**Hugme/Reclame Aqui** e **ManyChat**, mais popup com a nota e os
alertas do dia. Instalação em `extensao/LEIA-ME.md`.

**Somente leitura.** A única ação é abrir link na aplicação e copiar
macro — decisão registrada na proposta: base com consumidor real, painel
que só mostra tem superfície de erro muito menor.

**Endpoints novos, não a API pública.** `/api/reputacao` e `/api/casos`
escondem telefone e e-mail de propósito (`API.md`), que é justamente o
que a extensão precisa. Então `/api/extensao/{sessao,contexto,resumo}`
autenticam **como você**: o service worker lê o cookie `cw_session`
(`httpOnly`, só `chrome.cookies` alcança) e o manda no cabeçalho
`X-CW-Sessao`. Cabeçalho em vez de cookie solto resolve o `SameSite` de
uma origem `chrome-extension://` e fecha CSRF de uma vez. Papel lido do
banco a cada chamada, como em `lib/auth/guard.ts`.

**O telefone da base está mascarado** — `(27)•••••-4053`, seis dígitos
visíveis, 100% dos 334 registros. Não existe número inteiro para
comparar, então a chave é **DDD + quatro finais**, e ela foi medida, não
suposta (`npm run check:contato`): reencontra a própria reclamação em
334/334, apontando para um único cliente em 332. Duas caem numa chave
ambígua (`27-6862`). Por isso o painel rotula a confiança —
**confirmado / provável / ambíguo** — em vez de afirmar que achou.
Reimportar com `--pii` faz virar exato sozinho.

**Contador no ícone a cada 30 min** e um aviso por dia: é a versão
possível do resumo diário enquanto não há cron, e **só funciona com o
navegador aberto** — não substitui a Peça B.

**Pendência que isso expôs:** o vínculo cliente → estabelecimento não
persiste (`ClientsContext` guarda o enriquecimento em memória e `Case`
não tem coluna de estabelecimento no banco), então plano, status e MRR
quase nunca aparecem no painel. Persistir esse vínculo é o que destrava.

### NPS — encerramento do ciclo de feedback (13/08/2026)

**Não é Reclame Aqui:** pesquisa do próprio portal, com o contato do
cliente — é o que permite ligar de volta antes de virar cancelamento ou
reclamação pública. Fica em **Operação**, abaixo de Redes Sociais.

O processo inteiro vive em `lib/models/nps.ts`, em dados. Espalhar pelas
telas faria a regra divergir do guia na primeira mudança.

| Segmento | Nota | SLA do 1º contato |
| -------- | ---- | ----------------- |
| Detrator | 0–6 | 24 h úteis |
| Neutro | 7–8 | 48 h úteis |
| Promotor | 9–10 | 7 dias úteis |

**"Horas úteis" pula sábado e domingo** — feriado não entra, porque
exigiria um calendário mantido à mão que envelheceria calado. Conferido:
sexta 12 h + 24 h úteis cai na segunda.

Os **sete tipos** com seus status finais próprios. Reclamação e Erro no
Sistema **exigem a confirmação do cliente** antes de `[Encerrado]
Resolvido` — sem ela o botão fica travado e o loop segue em
`[Aguardando Resposta]`, como o guia manda. **Prazo do tipo tem
precedência** sobre o do segmento (Sugestão são 48 h mesmo vindo de um
Detrator).

**Falta de retorno** dispara sozinha por duas portas: 3 tentativas em 7
dias, ou 30 dias sem resposta. Cada tentativa fica registrada com canal
e horário — e a primeira **é** o primeiro contato, senão o SLA ficaria
estourado para sempre mesmo com a operação tendo ligado.

**Erro Processual abre revisão automática** em Projetos e Melhorias:
falha de processo tem de virar correção na origem.

**Elogio de Promotor** traz as três ações do guia: review pública,
depoimento e indicação.

Lista em tabela no mesmo formato do Reclame Aqui, com CRUD completo —
excluir é só ADMIN, porque altera o indicador. O prazo é **congelado no
registro**: reclassificar depois não reescreve o compromisso.

**Verificado:** 30 asserções por script contra o guia (segmentos, SLA,
precedência do tipo, os 7 tipos, checklist travando o encerramento, as
duas portas de falta de retorno, e a fórmula do NPS). Depois, na tela: o
ciclo inteiro de um Detrator — registro → tentativa → confirmação →
encerramento —, a trava do botão antes da confirmação, exclusão
recalculando a nota, e o Erro Processual gerando a revisão.

**Um defeito encontrado e corrigido no caminho:** a revisão automática
nascia com estágio `"Descoberta"`, que não é coluna do quadro de
Projetos — o item existia no banco e não aparecia na tela. Mesmo defeito
que "Nova reclamação" já teve no Kanban.

### Segurança e permissões (13/08/2026)

**Falhas corrigidas — todas exploráveis antes:**

| Falha | O que permitia |
| ----- | -------------- |
| `/api/assistente` **sem autenticação** | Qualquer pessoa na internet gastava a cota da Anthropic da empresa. O middleware libera `/api`, e a rota não checava nada. |
| Papel só checado na interface | Conta "somente leitura" chamava qualquer server action direto. Esconder o botão não impede a chamada. |
| Primeiro cadastro virava ADMIN | Quem chegasse primeiro numa base nova ganhava a administração sem ninguém autorizar. Hoje **todo autocadastro nasce `LEITURA`**; o admin inicial vem do `db:seed`. |
| Papel lido do cookie (8 h) | Rebaixar alguém só valia no próximo login — seguia administrando o resto do dia, inclusive podendo se promover de volta. Agora o papel vem do **banco** a cada checagem. |
| Conta desativada seguia ativa | `active: false` só valia no próximo login. Agora derruba na hora. |
| Login sem limite de tentativas | Força bruta livre. Hoje 5 falhas por e-mail travam 15 min. |
| Token da API comparado com `!==` | Ataque de tempo: dava para descobrir o token caractere a caractere. Agora `timingSafeEqual` sobre o hash. |

**Níveis de acesso:**

| Papel | Pode |
| ----- | ---- |
| `LEITURA` | Ler tudo que a tela mostra; mexer só no que é seu (preferências, filtros, sua agenda do Google) |
| `AGENTE` | A rotina: reclamações, movimentações, atividades, impacto, jornada |
| `ADMIN` | Tudo, mais os cadastros que definem como a operação funciona (fluxo, categorias, times, SLA, tipos de impacto) e as **integrações** |

`lib/auth/guard.ts` concentra a regra: `requireRole(minimo)` para gravar,
`can(minimo)` para a tela decidir o que mostrar. **Toda action que grava
passa por lá** — 24 exigem ADMIN, o resto AGENTE.

**Integrações virou ADMIN inclusive para ler**: a tela devolve o segredo
de assinatura em texto puro, e quem o tem forja chamadas que o CW Engine
aceitaria como nossas.

**Erro de permissão agora aparece na tela.** Antes a mudança era
aplicada de forma otimista, a gravação falhava em silêncio e o valor
sumia no reload — parecia bug, não falta de permissão.

**Verificado com o teste que prova as duas coisas juntas:** rebaixei meu
usuário para `LEITURA` **no banco**, mantendo o cookie de ADMIN. A
gravação foi recusada com "Seu acesso é somente leitura" — ou seja, a
regra vale no servidor e o cookie velho não engana mais.

**Auditado e sem achados:** sem `dangerouslySetInnerHTML`; cookie com
`httpOnly`, `sameSite` e `secure` em produção; nenhum segredo no pacote
do cliente; PII fora da API; e-mail com domínio conferido por sufixo
exato (`@cardapioweb.com.evil.com` é recusado).

**Ressalva registrada:** o limite de tentativas é **em memória**, então
vale por instância. Numa frota, o teto efetivo multiplica pelo número de
instâncias — continua reduzindo muito a taxa, mas o passo seguinte é
Redis, quando houver volume que justifique.

### Tudo persiste (13/08/2026)

Pedido do Isaac: "não quero nada que suma quando eu atualizar a página".
Os três pontos que ainda viviam fora do banco foram para lá.

| O que era | Onde vivia | Agora |
| --------- | ---------- | ----- |
| Etapa da jornada | só na sessão | `JourneyPlacement` |
| Filtros salvos | `localStorage` (por dispositivo) | `SavedFilter`, seguem a conta |
| Preferências e avisos | `localStorage` (por dispositivo) | `UserPreference`, seguem a conta |

34 tabelas, RLS ligado em todas.

**Nenhuma action aceita `userId` por parâmetro** — quem manda é o cookie
de sessão. Recebendo id de fora, qualquer pessoa logada leria (ou
apagaria) filtro e preferência de outra. `deleteSavedFilter` usa
`deleteMany` com o dono no filtro: id alheio não apaga nada em vez de
estourar erro.

**A gravação não bloqueia a tela.** Marcar uma caixa ou salvar um
recorte responde na hora; a ida ao banco acontece atrás. No filtro novo
o id provisório é trocado pelo do banco quando a resposta chega — senão
excluir logo após criar mandaria um id que não existe lá.

**`localStorage` continua valendo sem banco**, para o modo demonstração
não perder o que foi criado.

**Verificado com reload, um por um:** cliente arrastado de "Primeiro
contato" para "Em acompanhamento" continuou lá; aviso desligado
continuou desligado; filtro "Financeiro em aberto" reapareceu no
contador e na lista. Os três com o registro conferido no banco antes de
recarregar.

### Google Agenda (13/08/2026) — falta você criar as credenciais

Cada pessoa conecta a **própria** conta pela tela de Agenda. Nenhuma
action aceita `userId` por parâmetro: quem manda é o cookie de sessão —
recebendo id de fora, qualquer pessoa logada leria a agenda de outra.

- **Conectar/desconectar** com OAuth, tokens só no servidor
  (`GoogleAccount`, RLS ligado, 32 tabelas agora).
- **Renovação automática** do access token. O `refresh_token` só vem no
  primeiro consentimento, então a renovação **não** o sobrescreve quando
  vem vazio — fazer isso apagaria a conexão sem aviso.
- **Próximos 14 dias** da agenda aparecem junto das tarefas.
- **Enviar tarefa para o Google**: botão em cada atividade.
- **`state` assinado** (JWT com `AUTH_SECRET`, 10 min) no lugar de
  tabela de nonce. Sem isso, um link montado por terceiro conectaria a
  conta Google do atacante à sessão da vítima.
- **Permissões mínimas:** `calendar.events` (ver e criar) e o e-mail da
  conta, só para a tela mostrar qual foi conectada.

**O que falta — cinco minutos seus:** criar o projeto no Google Cloud e
preencher `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e
`NEXT_PUBLIC_APP_URL`. Passo a passo em `DEPLOY.md`, seção "Google
Agenda". **Sem elas a integração fica desligada** e a tela mostra o que
falta, sem afetar o resto.

**Verificado:** os dois estados do cartão (sem credenciais → instruções;
com credenciais → botão conectar), o redirecionamento real ao Google
(que respondeu `invalid_client`, o esperado para um id de teste — provou
que a URL foi montada e aceita) e os quatro caminhos de erro do
callback: retorno incompleto, **`state` forjado recusado antes de trocar
o código**, autorização recusada e limpeza do `?google=` da barra.

**Não verificado:** o handshake completo com credenciais reais, a
renovação do token e a criação do evento — dependem das credenciais.

### Correções de cálculo (13/08/2026)

Três defeitos de conta, todos encontrados com o Isaac apontando a tela.

**"30 dias" mostrava o mês fechado anterior, não 30 dias.**
`periodMonths["30d"] = 1` tratava a faixa como uma janela de um mês
fechado: em 10/08/2026 a tela desenhava 01/07–31/07 (15 reclamações,
nota 8,6) enquanto os 30 dias corridos eram 12/07–10/08 (17
reclamações, **nota 7,4**). Agosto inteiro ficava invisível, e a tela
dizia que estava tudo bem enquanto o mês corrente ia mal. Mês fechado é
a regra de apuração do Reclame Aqui e vale para 6m e 12m; "30 dias" é
leitura operacional interna e agora é janela de dias corridos.

**Gráfico e nota tinham duas contas de período em paralelo.**
`monthsIn` em `charts.service` reimplementava a matemática de janela que
já existia em `getRange` — e as duas divergiram no `30d`. Agora
`monthsIn` deriva de `getRange`, e `getMonthlyIndices` recorta pelo
intervalo além do mês, senão janela que começa no meio do mês ("30 dias"
e o personalizado) somaria dias fora do período. Conferido: em 30d, 3m,
6m, 12m e personalizado a soma do gráfico bate exatamente com a
contagem da nota. 6m segue 129 → 8,5 e 12m segue 212 → 8,4, iguais ao
painel oficial.

**A série diária ignorava o seletor de período.** O cartão era fixo em
30 dias — o próprio comentário no código explicava por quê: passar o
período fazia desenhar 180 dias sob um título que prometia 30, e a
descrição na tela ainda contradizia a dica (uma dizia "não acompanha o
período", a outra "acompanha"). Agora segue os cinco filtros, e o passo
do eixo se ajusta à janela para não virar ruído: **por dia** até 60
dias, **por semana** até 7 meses, **por mês** acima disso. Assim 12
meses viram 12 pontos legíveis em vez de 365 serrilhados. O título
acompanha ("Movimento diário/semanal/mensal") e mostra as datas reais.
Conferido nos cinco períodos: a soma da série bate com a contagem do
período, sem caso perdido nem contado duas vezes.

De quebra, dois textos ficaram desatualizados com a mudança do "30
dias" e foram corrigidos: a dica do seletor ainda dizia "último mês
fechado", e o toggle *vigente/próximo* aparecia no 30 dias — onde não
tem efeito, porque janela de dias corridos sempre termina hoje.

**Remoção só subtraía do total.** Uma reclamação removida leva embora a
resposta, a avaliação, a nota e os dois indicadores — mas
`removeComplaints` era um contador que só mexia em `received`. Remover
uma nota 1 não melhorava a nota do consumidor, que é justamente o motivo
de pedir moderação. Agora a remoção é descrita item a item
(`RemovedComplaint`: respondida, avaliada, nota, resolvida, voltaria).
Conferido: remover nota 1 sobe a nota de 7,82 para 7,91; remover nota 10
derruba para 7,79.

### Calculadora de reputação (13/08/2026)

**Voltou o foco para "adicionar avaliações"**, como o Isaac pediu: o modo
Avançado deixou de ser um formulário longo com os cinco cartões
empilhados e passou a ter um seletor — Avaliações / Reclamações /
Remoção —, uma frente por vez, com Avaliações como padrão.

**Responder as pendentes virou campo próprio.** O campo antigo
"Respondidas" adicionava uma reclamação **nova** já respondida, o que
dilui em vez de zerar a pendência — não havia como simular "responder as
8 que estão paradas". Agora são dois blocos: *Responder as pendentes*
(`answerPending`, limitado ao que existe sem resposta, com botão
"Responder todas") e *Reclamações novas* (respondidas/não respondidas).
Conferido: responder as 8 leva o índice de 93,8% a **100%** e a nota de
8,5 para 8,7.

**A avaliação é uma unidade completa**: nota + resolvida + voltaria a
fazer negócio, os três editáveis. Sem tocar, "resolvidas" e "voltariam"
seguem as notas (≥ 7 = promotor); editar fixa o valor, e um link devolve
ao automático. Antes eram quatro campos soltos, e dois deles
("não resolvidas"/"não voltariam") **nunca entravam no cálculo** —
`simulate()` só lia `resolved` e `wouldReturn`; serviam só para
sustentar um aviso âmbar que não apontava problema real.

**"Detalhamento" agora mostra sempre `atual → simulado`**, não só a seta
quando a diferença passava de 0,05 — com cenário vazio os dois lados
aparecem iguais, em vez de sumir a comparação inteira.

Verificado na tela, logado. De quebra, o cache do Turbopack (`.next`)
estava corrompido — toda rota pública (`/login`, `/cadastro`) devolvia
404 mesmo compilando sem erro; `rm -rf .next` resolveu.

### Webhook para o CW Engine (13/08/2026)

A metade "empurrar" da integração. Tela em `/configuracoes/integracoes`:
URL de destino, quais eventos, chave de assinatura (com botão de gerar
outra), disparo de teste e histórico das últimas entregas.

- **Eventos:** `caso.criado` e `caso.avaliado`, disparados de
  `saveCase` via `after()` do Next — não atrasa a gravação e não corre o
  risco da função encerrar antes do envio. Mover cartão no Kanban não
  dispara nada.
- **Assinatura:** HMAC-SHA256 sobre `{timestamp}.{corpo}`, no cabeçalho
  `x-cw-signature: t=…,v1=…` — mesmo formato de Stripe e GitHub. O
  timestamp entra na assinatura para o destino poder recusar reenvio.
- **Onde mora o segredo:** tabela `WebhookConfig`, não `.env` — cada
  instalação tem um destino diferente. Histórico em `WebhookDelivery`,
  aparado nas últimas 50.

`API.md` documenta o payload e como conferir a assinatura.

**Verificado de ponta a ponta:** com um receptor HTTP local que confere
a assinatura pela receita do `API.md`, o disparo chegou com
`x-cw-event`, corpo JSON e `t=…,v1=…` — e o HMAC recomputado do outro
lado **bateu**. Histórico gravou 200 no sucesso e 405 no destino errado;
excluir o webhook levou o histórico junto (`onDelete: Cascade`). As
tabelas já estão no Supabase, com RLS ligado — 31 no total.

**Duas armadilhas que isso revelou:**

- **`server-only` envenena o bundle do cliente.** A tela é client
  component e importava os nomes dos eventos do serviço, que é
  `server-only` — a rota inteira dava 500 em runtime, com `tsc` e
  `lint` limpos. Os nomes foram para `lib/models/webhook.ts`, sem
  dependência de servidor.
- **Trocar o schema exige reiniciar o dev server**, não só
  `db:generate`: o Node segura o client antigo em memória e
  `prisma.webhookConfig` fica `undefined`.

### Dois cards de `/configuracoes` ligados (13/08/2026)

**"Categorias e assuntos"** aponta para
`/reclame-aqui/configuracoes?tab=categorias` e **"Usuários e times"**
para `/times` — as duas telas já existiam, só faltava o link. A página
de configurações do módulo não lia a aba pela URL antes; agora lê via
`useSearchParams`, isolado num componente dentro de `<Suspense>` (forma
que o Next recomenda) — inicializar o `useState` num `useEffect` batia
no aviso `react-hooks/set-state-in-effect`, a mesma dívida já registrada
abaixo, e eu ia adicionar mais uma ocorrência dela sem necessidade.

Restam só **Permissões** (sem tela) e **Integrações** (é o item 1, o
webhook) como "Em breve".

### Base de dados (11–12/08/2026)

Migração completa de mock em memória para Supabase. Carga única
compartilhada (`loadWorkspace` + `useWorkspaceSlice`) porque doze
contextos consultando ao montar derrubavam o pooler do plano gratuito.

### Importar e exportar (12/08/2026)

O botão "Importar" não tinha ação nenhuma. Hoje lê o export do HugMe e
grava no banco, gravando **só o que mudou** — reimportar a mesma planilha
caiu de 118 s para 0,7 s. Exportação em `.xlsx` com o trabalho da
operação junto. Parser compartilhado em `lib/services/raImport.service.ts`
entre o script de linha de comando e a tela.

### Desempenho (12/08/2026)

Medido antes de mexer: cálculo das telas custa **menos de 3 ms**
(analytics 0,85 ms, gráficos 2,72 ms) e o servidor responde rotas em
6–33 ms. O tempo estava todo na ida e volta ao Supabase — 650 ms morna,
2,2 s fria, a cada abertura.

- `listCases` e `loadWorkspace` passam por `unstable_cache` com etiqueta;
  as 40 gravações chamam `updateTag`, então quem grava lê o próprio valor.
- Dataset fora do pacote do cliente e relato fora da listagem: carga
  inicial de 491 KB para 234 KB, DOM de 11.325 para 3.420 nós.
- Kanban e lista carregam em lotes com "mostrar mais".

**Não verificado ponta a ponta:** o ganho na navegação não foi medido no
navegador, porque as telas exigem login.

### Correções relevantes

- **Janela móvel descartava o primeiro mês** (`m > início` em vez de
  `>=`): contava 197 reclamações onde a nota oficial conta 212.
- **Cartão "últimos 30 dias"** desenhava a janela inteira do período.
- **`parseElapsedText` perdia as horas** em "19 dias e 17 horas",
  encolhendo o tempo de resposta a cada gravação.
- **`isOpen` com lista fixa de status**: etapa nova criada no fluxo sumia
  do indicador "na fila".
- **Hash de senha inválido** era recusado em silêncio. Login e troca
  agora detectam e apontam o `db:password`.
- **"Nova reclamação" oferecia status inexistentes** — o caso nascia sem
  coluna no Kanban.
- **`/api` fora do middleware de sessão**: devolvia HTML de login para
  quem consome por token.
- **`getRange` e `monthsIn` quebravam** com data vazia no período
  personalizado, derrubando a tela de gráficos.

---

## Armadilhas conhecidas

- **`db:push` não regenera o Prisma client.** Rodar `npm run db:generate`
  depois de mexer no schema.
- **Nunca editar `passwordHash` pelo painel do Supabase.** Vira texto
  puro e a conta recusa qualquer senha. Usar `npm run db:password`.
- **`npm run build` sobrescreve o `.next`** e derruba o dev server.
- **Módulo `"use server"` só exporta função assíncrona.** As etiquetas de
  cache vivem em `lib/actions/tags.ts` por isso.
- **Direct connection do Supabase é IPv6** e falha em rede sem IPv6 —
  usar o Session pooler.
- **Plano gratuito do Supabase hiberna** após ~1 semana sem acesso.
- **CRLF em `className` multilinha** quebra a hidratação: manter cada
  `className` numa linha só.
- **`server-only` num módulo importado por tela cliente derruba a rota**
  em runtime, com `tsc` e `lint` limpos. Constante que a tela precisa vai
  para `lib/models/`, não para o serviço.
- **Mexeu no schema? Reinicie o dev server.** `db:generate` sozinho não
  basta: o processo em pé segura o client antigo, e o model novo aparece
  como `undefined`.
