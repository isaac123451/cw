# Deploy — CW Reputação

Passo a passo para colocar no ar na Vercel. Siga na ordem: o seed depende
do banco existir, e o deploy depende das variáveis estarem definidas.

## 1. Banco de dados — Supabase

1. Crie o projeto em [supabase.com](https://supabase.com), região
   **South America (São Paulo)**. Guarde a senha do banco que ele pede
   no cadastro — ela não é exibida de novo.
2. Vá em **Project Settings → Database → Connection string**. O painel
   oferece três modos, e cada um tem um papel:

| Modo | Porta | Onde usar |
| ---- | ----- | --------- |
| **Session pooler** | 5432 | `DIRECT_URL` (migração e seed) e `DATABASE_URL` local |
| **Transaction pooler** | 6543 | `DATABASE_URL` na Vercel |
| Direct connection | 5432 | evitar — é **IPv6**, e falha em rede sem IPv6 |

**Por que duas variáveis.** O pooler em modo transação aguenta o
serverless da Vercel, onde cada requisição pode abrir conexão, mas não
sustenta DDL nem os locks que a migração precisa. Por isso `DIRECT_URL`
aponta sempre para uma conexão de sessão — `prisma.config.ts` e o seed
a preferem quando existe.

**Atenção ao Direct connection:** o Supabase o serve por IPv6. Em rede
sem IPv6 a conexão simplesmente falha. O Session pooler resolve o mesmo
papel por IPv4 — é o que este guia usa.

**Hibernação.** No plano gratuito o projeto é suspenso após cerca de uma
semana sem acesso e precisa ser religado no painel. Acessar a aplicação
com alguma regularidade evita.

## 2. Variáveis de ambiente

No painel da Vercel (Settings → Environment Variables) e no `.env` local:

| Variável | Obrigatória | Para que serve |
| -------- | ----------- | -------------- |
| `DATABASE_URL` | sim, em produção | Conexão que a aplicação usa: Session pooler (5432) local, Transaction pooler (6543) na Vercel. Sem ela o login fica desativado e a aplicação roda em modo demonstração. |
| `DIRECT_URL` | sim, para migrar | Conexão de sessão (5432) usada por `db:push`, `migrate` e `db:seed`. |
| `AUTH_SECRET` | sim | Assina o cookie de sessão. |
| `API_TOKEN` | só se for usar a API | Libera `/api/reputacao` e `/api/casos`. Sem ela a API responde 503 e fica **desligada, nunca aberta**. Ver `API.md`. |
| `ANTHROPIC_API_KEY` | não | Assistente com IA. Sem ela a tela responde em modo local. |

```bash
openssl rand -base64 32   # AUTH_SECRET
openssl rand -hex 32      # API_TOKEN
```

Opcional no seed: `SEED_ADMIN_PASSWORD` (padrão `cw-reputacao-2026`).

## 3. Criar as tabelas

Com `DIRECT_URL` preenchida no `.env` local:

```bash
npm run db:push
```

Para ambientes com histórico de migração:

```bash
npx prisma migrate dev --name init   # local
npm run db:migrate                   # produção
```

## 3.1 Ativar o RLS

Rode o conteúdo de **`prisma/rls.sql`** no SQL Editor do Supabase, logo
depois do `db:push`.

**Por que é preciso.** O Supabase publica o schema `public` por uma API
REST (PostgREST) acessível com a chave anônima do projeto — uma chave
feita para ser pública. Sem RLS, quem tiver essa chave lê e escreve
direto nas tabelas, incluindo as reclamações, que carregam dado de
consumidor real. O painel do Supabase sinaliza isso como
"RLS not enabled".

**Por que não quebra nada.** O Prisma conecta como `postgres`, dono das
tabelas, e o dono não é submetido às políticas de RLS. Sem nenhuma
policy criada, o resultado é: PostgREST bloqueado, aplicação funcionando
igual. Não é preciso escrever policy nenhuma — a autorização deste
sistema é feita na aplicação (`lib/auth/`), não no banco.

Rodar de novo é inofensivo: `ENABLE ROW LEVEL SECURITY` é idempotente.

> Refez o schema com tabela nova? Regenere o arquivo, senão a tabela
> nova nasce desprotegida.

## 4. Popular o banco

```bash
npm run db:seed
```

O seed cria, nesta ordem: e-mails liberados, times, status do fluxo,
categorias e subcategorias, checklist, etiquetas, **as 327 reclamações do
dataset com suas etiquetas** e o usuário administrador.

É idempotente — roda de novo sem duplicar, atualizando o que mudou.
Anote a senha inicial que o comando imprime e troque no primeiro acesso.

**Categorias criadas na importação.** A base real usa nomes que o
cadastro inicial não previa — "Cardápio e pedidos", "Outros" e
"Marketplace e integrações" (42 casos), mais 24 subcategorias. O seed
**cria** essas entradas em vez de descartar o vínculo, senão o banco
ficaria mais pobre que a planilha de origem. Elas nascem com `order: 999`
e a descrição "Criada a partir da importação do Reclame Aqui" — dá para
renomear, fundir ou desativar depois pela tela, e `OrphanCategories` em
`/processos` continua apontando o que precisa de curadoria.

> **PII.** O dataset do repositório já vem com e-mail e telefone
> mascarados e sem CPF. Se um dia for carregar o export cru no banco, use
> `scripts/import-reclame-aqui.js --pii` e **nunca** versione o resultado.

## 5. Deploy

```bash
npx vercel
npx vercel --prod
```

O `build` roda `prisma generate` antes do `next build`, então o client é
gerado no ambiente da Vercel.

## 6. Conferir depois de subir

```bash
curl -H "Authorization: Bearer $API_TOKEN" \
  "https://<host>/api/reputacao?periodo=6m"
```

Com o banco populado, deve responder nota `8.5`, faixa `RA1000` e
`recebidas: 129` — os mesmos números do painel do Hugme na janela de 6
meses fechados. Se vier diferente, o seed não rodou ou rodou em outro
banco.

## Controle de acesso

- Só e-mails **@cardapioweb.com** conseguem se cadastrar.
- Além do domínio, o e-mail precisa estar na tabela `AllowedEmail`. O
  seed libera o administrador inicial; os demais entram por lá.
- O primeiro usuário criado na base recebe o papel `ADMIN`.

## Rodando sem banco

Sem `DATABASE_URL` a aplicação sobe normalmente com o dataset do
repositório e **sem exigir login** — útil para desenvolvimento de
interface. O middleware só protege as rotas quando a variável existe.

## O que ainda não persiste

A API lê do banco quando `DATABASE_URL` existe. **As telas ainda não**:
os contextos da interface trabalham em memória, então editar um caso,
mover no Kanban ou registrar uma movimentação vale para a sessão e se
perde no reload.

Na prática, o que sobe agora é: dados reais em tela, login e controle de
acesso funcionando, API servindo do banco — e edição ainda volátil.
Migrar os contextos para o Prisma é o próximo passo, e está no
`ROADMAP.md`.
