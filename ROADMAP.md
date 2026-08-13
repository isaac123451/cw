# Roadmap — CW Reputação

Fila do que está combinado, com contexto suficiente para retomar cada
item sem reconstruir a conversa. Complementa o `DEPLOY.md` (como colocar
no ar) e o `README.md` (como rodar).

---

Os itens 1 a 4 estão concluídos — ver "Entregue". Resta o deploy, que
depende das decisões abaixo.

## A fazer

### 5. Deploy na Vercel

**O que é.** Colocar no ar e manter rodando.

**O caminho mecânico já está escrito** em `DEPLOY.md`: provedor de
Postgres, `DATABASE_URL` e `AUTH_SECRET`, `db:push`, `db:seed`,
`vercel --prod`. O `build` já roda `prisma generate` antes do
`next build`.

**Decidido: Neon.** Postgres serverless feito para a Vercel, funciona com
o `@prisma/adapter-pg` que já está no código sem trocar uma linha. O
passo a passo completo está no `DEPLOY.md`, incluindo o detalhe que morde
em produção: connection string **pooled** para a aplicação, **direta**
para `db:push` e `db:seed`.

**Já resolvido:** o seed agora carrega as 327 reclamações e suas
etiquetas no banco, e a API lê do Prisma quando `DATABASE_URL` existe
(`lib/api/source.ts`).

**O que falta, que é o trabalho de verdade:**

- **Contextos da interface → Prisma.** As telas ainda trabalham em
  memória: editar caso, mover no Kanban ou registrar movimentação vale
  para a sessão e some no reload. É a última distância entre o que sobe e
  a operação de verdade.
- **Dados reais e PII** — os 327 casos entram por seed no banco, nunca no
  repositório.
- Sem `DATABASE_URL` a aplicação sobe aberta, em modo demonstração. Em
  produção a variável é obrigatória, senão o login fica desativado.
- **`API_TOKEN`** passou a ser a terceira variável obrigatória se a API
  for usada — sem ela a API responde 503 e fica desligada. Ver `API.md`.

**A ordem que faz sentido:** persistência primeiro, deploy depois. Subir
antes disso publica uma demonstração honesta (e útil para validar telas
com o time), mas cada reload zera o que foi editado.

---

## Dívida técnica

### `setState` em efeito nos formulários

Treze ocorrências do mesmo padrão: o formulário preenche os campos em um
`useEffect` quando o modal abre. O React Compiler marca isso
(`react-hooks/set-state-in-effect`); a correção certa é remontar o
formulário com `key` e inicializar o estado direto no `useState`, o que
exige mexer em cada formulário **e** no componente que o abre.

A regra está como **aviso** em `eslint.config.mjs` justamente para essa
dívida ficar visível sem esconder erro de verdade — `npm run lint` hoje
fecha com 0 erros e 15 avisos. Ao migrar os formulários, subir a regra de
volta para `error`.

Arquivos: `TaskForm`, `MacroForm`, `ClientForm`, `PlaybookForm`,
`EstablishmentForm`, `ImpactForm`, `StageForm`, `SlaRuleForm`,
`ProjectForm`, `WorkflowModal`, `SocialCaseForm`, `MemberForm`,
`TeamForm`.

Os dois casos restantes (`PreferencesContext` e `SavedFiltersContext`)
são diferentes: leem o `localStorage` na montagem, que é a única forma
de não quebrar a hidratação. Esses ficam como estão, ou migram para
`useSyncExternalStore`.

### Filtros salvos compartilhados

O `SavedFilter` do `prisma/schema.prisma` já prevê `shared` e `ownerId`.
Hoje o `lib/context/SavedFiltersContext.tsx` guarda no `localStorage`, ou
seja, o filtro é do dispositivo. Compartilhar com o time só faz sentido
quando o banco entrar — junto do item 5.

---

## Entregue

### SLA de movimentação (08/08/2026)

Segundo relógio, independente do prazo público do Reclame Aqui: conta a
partir do encaminhamento, não do `createdAt`.

- `lib/models/movement.ts` — `CaseMovement` e `MovementRule`.
- `lib/services/movement.service.ts` — situação, atrasadas e carga por
  destino. Reaproveita `SlaSituation`/`toneOfSla` do SLA público para as
  duas telas de prazo falarem a mesma língua.
- `lib/context/MovementsContext.tsx` — movimentações e destinos.
- `lib/services/timeline.service.ts` + `CaseTimeline.tsx` — o pré-
  requisito que faltava. A linha do tempo era JSX fixo dentro do
  `CaseDetail`; virou serviço e passou a somar as movimentações.
- `MovementPanel` na aba Atendimento, aviso no cabeçalho do caso, seções
  em `/processos` e alerta no sino.

**Decisões tomadas** (eram as perguntas em aberto):

- **A lista de destinos sai do próprio cadastro de movimentação**, não do
  cadastro de Times — nem todo destino é um time, "Cliente" é o exemplo
  óbvio. Começa com Adoção, Suporte, Tecnologia, Fiscal e Cliente.
- **Uma movimentação em aberto por caso.** Encaminhar de novo sem
  registrar o retorno deixaria dois relógios correndo e nenhum diria quem
  está com a bola.
- **O prazo fica congelado no registro** (`dueHours`), não é lido da
  regra na hora de exibir: editar o destino depois não pode transformar
  em atraso o que estava no prazo quando aconteceu.
- **O estouro vira alerta no sino**, com preferência própria
  (`movimentacao` em `NotificationPrefs`).

**Fica para o banco.** Hoje as movimentações vivem em memória, como o
resto. O `CaseEvent` do `prisma/schema.prisma` cobre a linha do tempo
derivada, mas a movimentação precisa de tabela própria — ela tem prazo,
destino e retorno, que um evento genérico não guarda.

### Teto de tempo médio por categoria (08/08/2026)

O teto virou um campo da própria categoria (`ceilingHours` em
`CategoryOption`), editável em Configurar fluxo → Categorias — que é o
"adicionar pelo fluxo" que foi pedido. `lib/services/ceiling.service.ts`
calcula a média por categoria e o percentual do teto consumido, e
`ResponseCeiling.tsx` mostra isso no Analytics.

**Decisões tomadas** (eram as perguntas em aberto):

- **O teto vale sobre o tempo de resposta**, não o de solução. É o número
  que o Reclame Aqui publica, é o de maior peso na nota, e é o que a base
  importada preenche com consistência. Estender para solução é
  acrescentar um segundo campo no mesmo lugar.
- **A média segue o período da tela**, não uma janela fixa. No Analytics
  o padrão já é a janela de meses fechados da nota; ao filtrar um
  período, o teto acompanha, senão o cartão discordaria do resto da tela.
- Categoria **sem base não aparece** e categoria **sem teto não é
  cobrada** — mesma regra da nota, onde indicador sem base é excluído em
  vez de contar zero.

**Achado ao ligar nos dados reais:** com tetos de 24–48h, Financeiro,
Sistema e Atendimento aparecem entre 900% e 2900% do teto. Não é erro de
cálculo — é a distância entre a operação real (média de ~19 dias, que
confere com o painel do Hugme) e uma meta sadia. Os tetos de partida em
`mockSettings.ts` são um chute editável; o número que importa é o seu.

### Comparativo Hugme × CW Reputação (08/08/2026)

Documento em `COMPARATIVO-HUGME.md`. Separa o que foi verificado contra
dados reais do que depende de informação contratual, e fecha com quatro
perguntas que só a operação responde.

Resumo: **hoje são complementares.** O Hugme é insubstituível para
receber e responder no portal enquanto não houver API oficial do Reclame
Aqui; o CW Reputação é a camada de gestão (projeção da janela futura,
SLA interno, teto por categoria, impacto, integração com os outros
sistemas da casa).

### API de dados (08/08/2026)

`GET /api/reputacao` e `GET /api/casos`, autenticadas por
`Authorization: Bearer <API_TOKEN>`. Documentadas em `API.md`.

**Decisões tomadas** (a leitura do pedido estava em aberto):

- Ficou a leitura **"publicar uma API própria"**, para outros sistemas da
  Cardápio Web lerem indicadores e casos. A outra leitura (API como
  entrada de dados no lugar da planilha) não é possível hoje: não existe
  API pública do Reclame Aqui de onde puxar.
- **Sem `API_TOKEN` a API fica desligada, não aberta.** São reclamações
  de consumidor real; um endpoint público por esquecimento de variável
  seria vazamento.
- **E-mail e telefone não entram no payload.** Um endpoint de gestão não
  precisa de contato do consumidor.
- A fonte fica isolada em `lib/api/source.ts` — quando a persistência
  entrar, o Prisma passa a ser lido ali, em um arquivo, não em cada rota.
