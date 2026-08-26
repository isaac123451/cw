# CW Reputação

Central de Experiência do Cliente da **Cardápio Web**: reclamações do
Reclame Aqui, pesquisa de NPS, agenda operacional, jornada do cliente e
o impacto disso tudo no negócio — em um lugar só.

Next.js 15 (App Router) · React 19 · TypeScript · TailwindCSS · Prisma ·
PostgreSQL (Supabase).

## Rodar

```bash
npm install
npm run dev
```

Abre em [localhost:3000](http://localhost:3000).

**Sem `DATABASE_URL` a aplicação sobe assim mesmo**, com o dataset do
repositório e **sem exigir login** — é o modo demonstração, útil para
mexer em interface sem infraestrutura. Com a variável definida, o login
passa a valer e tudo grava no Postgres.

Para rodar com banco, copie `.env.example` para `.env` e preencha. O
passo a passo completo (Supabase, RLS, seed, Vercel, Google Agenda) está
no **`DEPLOY.md`**.

## Módulos

| Módulo | O que faz |
| ------ | --------- |
| **Reclame Aqui** | Kanban e lista das reclamações, tratativa, réplicas, movimentações entre áreas, importação da planilha do HugMe |
| **Calculadora** | Simula o efeito de novas avaliações sobre a nota, inclusive no período que ainda vai começar |
| **NPS** | Pesquisa do portal e o ciclo de feedback até o encerramento — segmentos, SLA por segmento, sete tipos de tratativa |
| **Agenda** | Atividades da rotina, com Google Agenda de cada pessoa integrada |
| **Jornada** | Ciclo de vida do cliente, por etapa |
| **Impacto** | Receita preservada e gerada pela operação |
| **Analytics / Gráficos** | Nota, indicadores e tendência |

## Comandos

| Comando | Para quê |
| ------- | -------- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção (**sobrescreve o `.next` e derruba o dev server**) |
| `npm run lint` | ESLint — fecha com 0 erros e 16 avisos conhecidos |
| `npm run db:check` | Testa a conexão e lista tabelas, contagens e RLS |
| `npm run db:push` | Aplica o schema no banco |
| `npm run db:generate` | Regenera o Prisma client (**`db:push` não faz isso**) |
| `npm run db:seed` | Carrega base e cadastros; idempotente |
| `npm run db:rls` | Liga RLS em todas as tabelas |
| `npm run db:password -- <e-mail>` | Redefine senha com hash bcrypt correto |

## Acesso

Só e-mails **@cardapioweb.com** que estejam na tabela `AllowedEmail`.
Todo autocadastro nasce **somente leitura** — promover é ato explícito
de um administrador, em `/conta` → Acessos. O administrador inicial vem
do `db:seed`.

Três níveis: `LEITURA` (lê, e mexe só no que é seu), `AGENTE` (a
rotina), `ADMIN` (configuração e integrações). A regra vive em
`lib/auth/guard.ts` e é aplicada **no servidor** — esconder botão na
tela não protege nada.

## Onde está o quê

```
app/            rotas (App Router)
components/     interface, por módulo
lib/
  actions/      server actions — toda gravação passa por aqui
  auth/         sessão, papéis, controle de acesso
  context/      estado do cliente
  models/       tipos e regras de negócio em dados
  services/     cálculo (nota do RA, NPS, SLA, gráficos)
prisma/         schema e seed
scripts/        utilitários de banco e importação
```

## Documentos

- **`ROADMAP.md`** — a fila, as decisões tomadas e as armadilhas
  conhecidas. **Leia antes de mexer:** economiza redescobrir por que
  algo é do jeito que é.
- **`DEPLOY.md`** — colocar no ar, do banco às variáveis.
- **`API.md`** — a API de dados e o webhook, para o CW Engine consumir.

## Convenções

- TailwindCSS apenas, sem CSS externo. **Cada `className` numa linha
  só**: CRLF dentro de `className` multilinha quebra a hidratação.
- Nunca chamar `new Date()` durante o render — servidor e cliente
  calculariam dias diferentes entre 21h e meia-noite, porque um está em
  UTC e o outro em UTC−3. Use `hojeNaOperacao()` de
  `reputation.service.ts`, que fixa o fuso em `America/Sao_Paulo` nos
  dois lados. **É função, não constante**: guardar o retorno num módulo
  faz um servidor de pé há três dias servir a data de anteontem — foi
  assim que a aplicação inteira ficou presa em 10/08/2026. Parâmetro de
  data se escreve `today = hojeNaOperacao()`, que reavalia a cada
  chamada.
- Módulo `server-only` não pode ser importado por client component:
  derruba a rota em runtime, com `tsc` e `lint` limpos. Constante que a
  tela precisa vai para `lib/models/`.
