# Extensão do dia a dia — CW Reputação

Proposta de como esticar o CW Reputação para fora da tela: WhatsApp Web,
Hugme/Reclame Aqui, e os momentos em que ninguém está com a aplicação
aberta. Complementa o `ROADMAP.md` — é fila de decisão, não código
pronto.

**Estado (17/08/2026): a Peça A está construída e verificada.** As
Peças B e C continuam como proposta. O que foi feito, e o que a
construção respondeu das perguntas abertas, está no fim deste documento,
em "O que foi construído". A instalação é o `extensao/LEIA-ME.md`.

## Por que três peças, não uma

A pergunta era "extensão de navegador, automação de bastidor ou
assistente fora do app" — e a resposta foi combinar as três. Faz
sentido depois de olhar a rotina real: são dores diferentes do mesmo
dia, não alternativas entre si.

## A rotina, mapeada

O que a checklist já resolve bem dentro do próprio CW Reputação —
Kanban do RA, Processos, Documentação, Analytics, NPS — fica de fora da
tabela. O que interessa aqui é o que ainda depende de alternar de tela
ou de alguém lembrar de abrir o app.

| Tarefa da rotina | Onde vive hoje | O que ajuda |
| --- | --- | --- |
| Revisar a planilha de métricas do RA | Planilha manual, um arquivo por mês | **Peça C** — a maior parte já é calculada por `reputation.service.ts` |
| Verificar andamento e retorno de casos no RA | Alternando entre o Hugme/portal do RA e o CW Reputação | **Peça A** — painel sobre o Hugme/RA |
| Verificar solicitações para outros setores | Módulo de Movimentação — só aparece se alguém abrir `/processos` | **Peça B** — é o `movimentacao.atrasada` que o ROADMAP registra como pendente por falta de cron |
| Contatar cliente para pedir avaliação | Fora do sistema, por telefone/WhatsApp | **Peça A** — painel no WhatsApp Web |
| Ligar após 3 tentativas sem retorno | O NPS já tem essa regra pronta (3 tentativas em 7 dias); fora do NPS é manual | **Peça A**, reaproveitando a lógica de `lib/models/nps.ts` |
| FUP pós-finalização no RA | Fora do sistema | **Peça A** — WhatsApp |
| Revisar casos de retenção | O campo `churnRisk` já existe nos casos | **Peça B** — entra no resumo diário |
| Casos de ManyChat / contato via ManyChat | Fora do sistema, sem integração hoje | **Peça A**, versão mais simples — é a superfície com menos dado pra cruzar |
| Criação de relatório semanal | Manual | **Peça C** — reaproveita o mesmo retrato que o Assistente já monta (`buildOperationSnapshot`) |

(Finalizar casos, criar/revisar processos, documentar iniciativas,
analisar indicadores e colher feedback já têm tela própria — ficam de
fora por já estarem resolvidos.)

## Peça A — Painel de contexto no navegador

Uma extensão pequena (Chrome, Manifest V3) que injeta um painel lateral
em três lugares:

- **WhatsApp Web** — ao abrir uma conversa, lê nome/telefone do contato
  (leitura do DOM, local, nada é enviado) e busca no CW Reputação: casos
  abertos daquele cliente, o estabelecimento vinculado (plano, status,
  MRR — os mesmos campos que `assistant.context.ts` já resume para o
  Assistente), sinal de risco de cancelamento, e o histórico recente.
- **Hugme / Reclame Aqui** — ao abrir uma reclamação, mostra se ela já
  tem registro no CW Reputação, quem é o dono, e o prazo de SLA que
  `sla.service.ts` calcularia.
- **ManyChat** — versão mais enxuta: como hoje não existe nenhuma
  integração, entra só como atalho de busca (telefone → histórico), sem
  tentar casar automaticamente.

**A decisão técnica que isso força:** o painel não pode usar o
`API_TOKEN` público (`/api/reputacao`, `/api/casos`) — esse token
devolve dado **sem telefone e sem e-mail** de propósito, porque foi
pensado para outro sistema consumir, não uma pessoa (`API.md`, "O que a
API não devolve"). Para cruzar por telefone, o painel precisa
autenticar como você mesmo — a mesma sessão AGENTE/ADMIN que já vê
telefone e e-mail nas telas — o que significa um endpoint novo e
interno, não o `/api` público. É pouco código (reaproveita
`lib/auth/guard.ts` e os services que já existem), mas é peça nova, não
configuração.

**Sobre o risco no WhatsApp:** pelo que encontrei pesquisando agora, o
bloqueio de conta no WhatsApp está ligado a comportamento de **envio**
— volume, mensagens idênticas em sequência, listas frias sem opt-in —
não a leitura passiva de tela. Não achei uma página oficial da Meta
detalhando isso, só análise de terceiros, mas a direção é clara: o
painel só lê e mostra, nunca manda mensagem sozinho — é o mesmo padrão
que ferramentas de CRM (HubSpot, Kommo e afins) usam há anos sobre o
WhatsApp Web sem problema. Se um dia entrar automação de envio, é outro
risco, e outra conversa.

## Peça B — Rotina agendada (o que resolve o "sem cron")

O ROADMAP já nomeia essa lacuna duas vezes — fechamento automático do
NPS em 30 dias e o evento `movimentacao.atrasada` do webhook — como
coisas que "precisam de job agendado, que a aplicação não tem hoje".

Um cron diário (Vercel Cron, já que o deploy é lá) que roda de manhã e:

- Chama `buildNotifications()` — a função já existe e já calcula
  sem-resposta, réplicas, avaliação negativa, movimentação atrasada e
  agenda do dia. Hoje ela só roda quando alguém abre a tela; rodando
  sozinha, vira um resumo que chega até você, em vez do contrário.
- Fecha o ciclo do NPS depois de 30 dias, como o ROADMAP pede.
- Às sextas, monta o rascunho do relatório semanal a partir do mesmo
  retrato que o Assistente usa (`buildOperationSnapshot` +
  `ASSISTANT_SYSTEM`).

Falta decidir só o canal de entrega — e-mail é o caminho mais direto de
configurar na Vercel; dá para também eu montar isso do lado de cá, com
uma tarefa agendada aqui no Claude que busca o resumo (pelo endpoint
interno da Peça A) e te entrega aqui todo dia, sem mexer no deploy.

## Peça C — Relatório e planilha automáticos

A planilha de métricas mensal (nº de reclamações entrantes, nota,
respondidas, nota do consumidor, voltariam, % resolvidas, tempo médio,
churn, retidos) bate campo a campo com o que `reputation.service.ts` já
calcula — o único que o sistema não tem e não vai ter é "visualizações
do RA", que só existe dentro do próprio portal.

Gerar esse `.xlsx` automaticamente (a lib `xlsx` já é dependência do
projeto, usada na exportação do RA) fecha praticamente sozinho os itens
"revisar planilha" e "relatório semanal" da rotina.

## Por onde começar

1. **Painel de WhatsApp Web** — é a superfície que você acabou de
   pedir, é a mais nova, e a decisão do endpoint interno que ela força
   destrava o resto (Hugme e o próprio Assistente podem reusar o mesmo
   caminho depois).
2. **Resumo diário agendado** — reaproveita `buildNotifications()` como
   está, sem precisar de UI nova.
3. **Extensão no Hugme/RA + relatório automático** — depois que o
   endpoint e o cron já existem, é composição do que já foi construído.

## Decisões que são suas

- Canal do resumo diário: e-mail, aqui no Claude, ou outro (Slack, se o
  time usa)?
- O painel do navegador só **mostra** informação no início, ou já nasce
  podendo **agir** (abrir caso, registrar nota)? Recomendo só mostrar
  primeiro — reduz superfície de erro numa base com dado real de
  consumidor.
- Telefone como chave de busca: vale conferir se o telefone salvo no
  cadastro do cliente está no mesmo formato do que aparece no WhatsApp
  Web (com/sem DDI) — é o tipo de detalhe que quebra silenciosamente se
  não for verificado cedo.

## O que foi construído

A Peça A saiu inteira, nas três superfícies. Instalação e uso em
`extensao/LEIA-ME.md`.

**Do lado da aplicação** — o endpoint interno que a proposta previa como
peça nova obrigatória:

| Arquivo | O que faz |
| --- | --- |
| `lib/api/extensao.ts` | Autenticação pela sessão do navegador |
| `lib/services/contato.service.ts` | Casamento por telefone, e-mail e nome |
| `app/api/extensao/sessao/` | Quem sou eu — usado pelo "testar conexão" |
| `app/api/extensao/contexto/` | O retrato do cliente |
| `app/api/extensao/resumo/` | Nota, contadores e alertas do dia |
| `scripts/check-contato.ts` | A prova do casamento contra o banco real |

**Do lado do navegador**, em `extensao/`: manifesto V3, service worker,
painel em Shadow DOM, três detectores (WhatsApp Web, Hugme/RA,
ManyChat), popup e tela de opções.

### O que a construção descobriu

**O telefone da base está mascarado — e isso muda o desenho.** As 334
reclamações do banco guardam `(27)•••••-4053`: DDD e os quatro últimos
dígitos, seis dígitos visíveis, 100% dos registros. A pergunta que a
proposta deixou em aberto ("vale conferir se o telefone salvo está no
mesmo formato do WhatsApp") tinha uma resposta pior do que "com ou sem
DDI": *não existe* número inteiro para comparar.

A chave possível é DDD + quatro finais, e ela foi medida em vez de
suposta (`npm run check:contato`): o número que o WhatsApp entrega
reencontra a própria reclamação em 334 de 334 casos, apontando para um
único cliente em 332 deles. Duas reclamações caem numa chave ambígua
(`27-6862`, dois clientes diferentes). Por isso o painel **rotula a
confiança** — confirmado, provável ou ambíguo — em vez de afirmar que
achou. Importar com `--pii` faz a comparação virar exata sozinha, sem
mudar código.

**Autenticação:** como previsto, não dá para usar o `API_TOKEN`. A
extensão lê o cookie `cw_session` (via `chrome.cookies`, no service
worker — é `httpOnly`, nenhuma página o lê) e o manda no cabeçalho
`X-CW-Sessao`. Mandar no cabeçalho em vez de deixar o cookie viajar
sozinho resolve dois problemas de uma vez: independe de como o navegador
trata `SameSite` numa requisição vinda de `chrome-extension://`, e fecha
CSRF. O papel continua vindo do banco a cada chamada, como em
`lib/auth/guard.ts`.

**Só mostrar, como recomendado.** A única ação do painel é abrir links
na aplicação e copiar texto de macro.

### Decisões que continuam suas

- **Canal do resumo diário.** A extensão dá uma versão local — contador
  no ícone a cada 30 min e um aviso por dia —, mas só com o navegador
  aberto. O resumo que chega de manhã sem depender disso continua sendo
  a Peça B.
- **Vínculo com estabelecimento.** Ele não persiste: o enriquecimento do
  cliente vive em memória no `ClientsContext`, e `Case` não tem coluna de
  estabelecimento no banco. O painel procura pelo registro de NPS,
  telefone, e-mail e nome — e com três estabelecimentos de exemplo
  cadastrados, o normal é não achar nada. Persistir esse vínculo é o que
  destrava plano, status e MRR no painel.

## Próximo passo

A Peça B é a próxima na fila: o cron da Vercel chamando
`buildNotifications()` de manhã, o fechamento do NPS em 30 dias e o
rascunho de sexta. O endpoint `/api/extensao/resumo` já monta o conteúdo
— falta quem o dispare sem ninguém por perto.
