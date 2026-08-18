# Roadmap — CW Reputação

Fila do que está combinado, com contexto suficiente para retomar cada
item sem reconstruir a conversa. Complementa o `DEPLOY.md` (como colocar
no ar), o `API.md` (integração) e o `README.md` (como rodar).

Atualizado em 13/08/2026.

---

## Estado atual

**Banco: Supabase, no ar.** 36 tabelas, RLS ligado em todas, 334
reclamações carregadas. **Nada da interface vive fora do banco** — o que
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
| `npm run extensao:icones` | Regera os PNGs do ícone da extensão |

---

## A fazer

### 1. Webhook: reenvio e evento de atraso

O webhook está no ar e funcionando (ver Entregue). Duas lacunas
conhecidas:

- **Não há reenvio automático** quando a entrega falha. Hoje o histórico
  registra o erro e para por aí. Reenviar pede fila com espera
  progressiva — decidir se vale antes de ter um consumidor real.
- **`movimentacao.atrasada` não existe.** Os dois eventos atuais nascem
  de uma gravação; atraso é estado que só se descobre comparando com o
  relógio, e precisa de job agendado (cron), que a aplicação não tem.

### 2. Planos e macros

Isaac pediu para puxar nomes, valores e módulos dos planos da central de
ajuda (`ajuda.cardapioweb.com`) para usar nas macros.

**Ressalva registrada:** preço e nome de plano mudam, e copiar isso para
dentro do sistema cria dado que envelhece calado. A recomendação foi
cadastrar planos numa tela, como foi feito com os tipos de impacto.
**Aguardando a decisão do Isaac.**

### 3. NPS — o que ficou para a próxima rodada

O módulo está no ar (ver Entregue). Feedback do Isaac ainda não feito:

- **Importar respostas em lote**, como o Reclame Aqui faz com a planilha
  do HugMe. O parser compartilhado (`raImport.service.ts`) é o modelo a
  seguir.
- **Categorias e fluxo configuráveis**: hoje os sete tipos e a lista de
  causa raiz são fixos no código (`lib/models/nps.ts`). Virar cadastro,
  como foi feito com tipos de impacto — a ressalva é a mesma: lista
  fechada existe para a análise de tendência não virar texto livre.
- **Encerramento automático dos 30 dias** roda quando alguém abre a
  tela; sem ninguém logado, não roda. Precisa de job agendado, o mesmo
  que falta para `movimentacao.atrasada` do webhook.

### 4. Permissões por módulo — último card "Em breve"

Dos quatro cards sem link em `app/configuracoes/page.tsx`, só este
restou: "Categorias e assuntos", "Usuários e times" e "Integrações" já
foram ligados (ver Entregue).

**Permissões** não tem tela. Existe o enum de papel
(`ADMIN`/`AGENTE`/`LEITURA`) e a aba de acessos em `/conta`, mas nada de
permissão por módulo. Definir o alcance antes de construir: papel por
módulo, ou permissão fina por ação?

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
  o banco. O dataset do repositório continua mascarado.

---

## Entregue

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
