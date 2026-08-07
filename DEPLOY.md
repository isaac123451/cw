# Deploy — CW Reputação

## 1. Banco de dados

A aplicação usa PostgreSQL. Qualquer provedor serve; no Vercel os mais
diretos são **Neon**, **Supabase** ou **Vercel Postgres**.

Crie o banco e guarde a connection string. Ela precisa aceitar SSL:

```
postgresql://usuario:senha@host:5432/cw_reputacao?sslmode=require
```

## 2. Variáveis de ambiente

Defina as duas no painel do Vercel (Settings → Environment Variables) e
também no `.env` local:

| Variável       | Para que serve                                            |
| -------------- | --------------------------------------------------------- |
| `DATABASE_URL` | Conexão PostgreSQL. **Sem ela o login fica desativado** e a aplicação roda com dados de demonstração. |
| `AUTH_SECRET`  | Assina o cookie de sessão. Gere com `openssl rand -base64 32`. |

Opcional no seed:

| Variável               | Padrão                |
| ---------------------- | --------------------- |
| `SEED_ADMIN_PASSWORD`  | `cw-reputacao-2026`   |

## 3. Criar as tabelas

Na primeira vez:

```bash
npm run db:push
```

Para ambientes com histórico de migração:

```bash
npx prisma migrate dev --name init   # local
npm run db:migrate                   # produção
```

## 4. Popular os dados base

Cria status do fluxo, categorias, subcategorias, times, tags, checklist,
a lista de e-mails liberados e o usuário administrador:

```bash
npm run db:seed
```

Anote a senha inicial que o comando imprime e troque no primeiro acesso.

## 5. Deploy

```bash
npx vercel
npx vercel --prod
```

O `build` já roda `prisma generate` antes do `next build`, então o client
é gerado no ambiente da Vercel.

## Controle de acesso

- Só e-mails **@cardapioweb.com** conseguem se cadastrar.
- Além do domínio, o e-mail precisa estar na tabela `AllowedEmail`.
  O seed libera o administrador inicial; os demais são adicionados por lá.
- O primeiro usuário criado na base recebe o papel `ADMIN`.

## Rodando sem banco

Sem `DATABASE_URL` a aplicação sobe normalmente com os dados de
demonstração e **sem exigir login** — útil para desenvolvimento de
interface. O middleware só passa a proteger as rotas quando a variável
existe.
