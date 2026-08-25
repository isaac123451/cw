# Roadmap — CW Reputação

Fila do que está combinado, com contexto suficiente para retomar cada
item sem reconstruir a conversa. Complementa o `DEPLOY.md` (como colocar
no ar), o `API.md` (integração) e o `README.md` (como rodar).

Atualizado em 23/08/2026. Aplicação **0.28.0**, extensão **0.28.0**.

> **Versão sobe junto com a mudança.** `package.json` e
> `extensao/manifest.json` andam no mesmo número: sem isso não dá para
> saber, olhando um navegador com a extensão instalada, se ele está
> falando com uma aplicação que já tem a rota que ele chama.

---

## Estado atual

**Banco: Supabase, no ar.** 43 tabelas, RLS ligado em todas, **340
reclamações** — a base inteira do Reclame Aqui desde 02/2024, com relato
e resposta pública completos, telefone, e-mail e documento —, **239
estabelecimentos**, **296 clientes** e **868** respostas de NPS. **Nada da interface vive fora do
banco** — o que se edita sobrevive ao reload e segue a conta, não o
dispositivo.
Connection string **pooled** para a aplicação e **de sessão** em
`DIRECT_URL`, usada por `db:push`, `db:seed` e pelos scripts.

**Os 12 contextos da interface gravam no Postgres** por server actions
(`lib/actions/`). As etapas e os tipos do NPS entraram na carga do
workspace junto com os outros cadastros.

**Deploy:** Vercel, importando de `isaac123451/cw`.

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
| `npm run check:ia` | Diz qual IA está ligada, mede as duas vias **e prova o decodificador de SSE do assistente**, sem gastar chamada |
| `npm run check:busca` | Prova que a busca por candidatos não perdeu nenhum caso, e mede |
| `npm run check:mover` | Prova o que acontece ao mover um caso de etapa |
| `npm run check:ra` | Prova os leitores da página do Reclame Aqui contra o texto de uma reclamação real |
| `npm run check:cadastros` | Prova que Times, Metas e Clientes sobrevivem ao recarregamento |
| `npm run check:nps-etapas` | Prova as etapas e os tipos do NPS como cadastro, contra o banco |
| `npm run check:nps-planilha` | Prova o leitor de planilha do NPS, com arquivos montados em memória |
| `npm run check:extensao` | Prova o contrato das rotas que a extensão chama (precisa do `npm run dev`) |
| `npm run check:cron` | Prova a rotina agendada, inclusive que rodar duas vezes não repete trabalho |
| `npm run check:vinculo` | Prova o vínculo por CPF ou CNPJ: que a varredura liga, que rodar de novo não muda nada, que a planilha não apaga e que a escolha de uma pessoa vence |
| `npm run db:backup` | Despeja num JSON as reclamações, clientes e estabelecimentos — antes de qualquer carga |
| `npm run ra:completo` | Carga do RA. `--somente-novas` cria só o que falta (o do dia a dia); sem ele, refaz a base do zero. Simula por padrão; `--gravar` executa |
| `npm run check:incremental` | Prova que a carga incremental cria o que falta e **não toca** no que já existe |
| `npm run check:reputacao` | Prova que a nota fecha com a própria memória de cálculo e que o tempo chega ao banco como saiu da planilha — e imprime o retrato atual |
| `npm run check:persistencia` | Percorre os 21 contextos e exige que **todo mutador exposto** chame o servidor. É o que pega "altera na tela e não grava" |
| `npm run check:seguranca` | Toda rota de `/api` e toda server action conferem quem chama? Algum segredo vaza para o navegador? |
| `npm run check:desempenho` | Mede as consultas que as telas fazem, com teto por medição |
| `npm run check:telas` | Abre as 34 telas com sessão e confere que voltam com conteúdo (precisa do `npm run dev`) |
| `npm run check:fiacao` | Nenhum botão da extensão sem tratador, nenhuma rota inventada — estático, roda antes de subir |
| `npm run check:escape` | Nada do consumidor entra no `innerHTML` do painel sem passar por `CW.escapar` |
| `npm run check:dependencias` | Nenhuma vulnerabilidade conhecida em produção sem correção ou sem decisão registrada |
| `npm run check:whatsapp` | Prova o leitor de conversa do WhatsApp contra seis marcações, sem navegador |
| `npm run check:busca-texto` | Prova o campo Buscar da tela: telefone, documento, e-mail e texto, contra a base real |
| `npm run check:calculadora` | Mexe em cada campo do cenário sobre a base real e exige que ele mova a nota, para o lado certo — e que nenhuma combinação saia de 0–10 |
| `npm run check:duas-etapas` | Onze defesas do código por e-mail, cada uma provada recusando o que deve: código errado, vencido, gasto, sem palpites, reenviado |
| `npm run extensao:icones` | Regera os PNGs do ícone da extensão |

---

## A fazer

### 0. Handoff — leia isto primeiro (22/08/2026)

**Produção:** https://cw-rho-eight.vercel.app · repo `isaac123451/cw`,
branch `main` · aplicação e extensão em **0.28.0**, sempre no mesmo
número.

**Antes de dizer que algo está pronto, rode o `check:` correspondente.**
São scripts que rodam a conta contra o banco real; `tsc` e `lint` passam
limpos em cima de defeito de dado.

| Comando | Prova o quê |
| ------- | ----------- |
| `npm run check:ia` | Qual IA está ligada, com uma chamada real — e quanto ela demora |
| `npm run check:busca` | Que a busca por candidatos não perdeu nenhum caso |
| `npm run check:mover` | Que voltar de "Resolvido" apaga a avaliação |
| `npm run check:cadastros` | Que Times, Metas e Clientes sobrevivem ao reload |
| `npm run check:ra` | Os leitores da página do Reclame Aqui, **inclusive que o FAQ do portal não entra no relato** |
| `npm run check:nps-etapas` | Que etapa final carrega o prefixo `[Encerrado]`, que renomear arrasta os ciclos e que etapa em uso é desativada |
| `npm run check:nps-planilha` | Que o leitor de planilha lê os dois formatos e **diz o que deixou de fora** |
| `npm run check:extensao` | Que o número que o painel mostra e a lista que ele abre têm o mesmo tamanho |
| `npm run check:cron` | Que a rotina encerra o que a regra manda — e só uma vez |
| `npm run check:vinculo` | Que o documento (CPF ou CNPJ) liga a reclamação ao estabelecimento — e que reimportar a planilha **não apaga** o vínculo |
| `curl -H "Authorization: Bearer $API_TOKEN" .../api/saude` | O que **um ambiente** tem configurado |

> Os dois últimos precisam da aplicação no ar (`npm run dev` noutra
> janela). O `API_TOKEN` da Vercel é **diferente** do local — conferido.

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

Fila pedida pelo Isaac em 23/08, depois da auditoria. Em ordem de
entrega:

1. ~~**Verificação em duas etapas**, com código por e-mail.~~ Entregue
   em 23/08 — ver abaixo. **Falta você definir `RESEND_API_KEY` na
   Vercel**; até lá o recurso fica indisponível de propósito.
2. **Botão para o portal da Cardápio Web** na extensão.
3. **Buscar a reclamação pelo número do cliente**, usando o nome do
   contato só para conferir — hoje o nome participa do casamento.
4. **Tirar a aba "Meu time"**: ela cadastra pessoas e times sem relação
   com os times de reclamação, NPS e ManyChat. Criar time e responsável
   passa a ser dentro do fluxo de reclamações.
5. **"Atribuir para mim"** com o usuário logado, esteja ele cadastrado
   como responsável ou não.
6. **Aba de status editável.**
7. **Zerar Processos e SLA**, para começar do vazio.
8. **Assistente**: ele recusa perguntas que a base responde — "quantas
   avaliações faltam para a nota 9" é conta, não consulta a sistema
   externo.
9. ~~**Analytics**: gráficos com defeito.~~ Os três defeitos que você
   descreveu foram entregues em 23/08 — ver "Os gráficos, e a
   calculadora que prometia o impossível". O que sobra em Analytics é
   melhoria, não conserto.
10. ~~**Análise do NPS** e **Dashboard**: melhorar.~~ Entregue em
    23/08 — ver abaixo.

**A fila acabou.** O que sobra é o que depende de você: definir
`RESEND_API_KEY` na Vercel para a verificação em duas etapas ligar, e
preencher o link do Crisp e o WhatsApp do NPS no cadastro dos
estabelecimentos para os dois botões aparecerem na extensão.

O `SpeedInsights` saiu daqui em 23/08 — ligado, com sua autorização.

---

### 3. Bloqueado no Isaac — não dá para avançar sem ele

**a) A `ANTHROPIC_API_KEY` nunca foi preenchida** — conferido em
23/08: o valor no `.env` continua o exemplo literal `"sk-ant-..."`, dez
caracteres. Hoje quem responde é o **Gemini**, e `/api/saude` agora diz
isso corretamente (dizia o contrário até hoje).

> Como definir, e o que cada variável quebra sem estar definida: seção
> **Variáveis de ambiente**, mais abaixo.

> **Isto virou o teto da velocidade da IA.** A camada gratuita do Gemini
> entra em fila: medido no mesmo minuto, com o mesmo pedido de 52
> tokens, `gemini-flash-latest` não respondeu em 35 segundos enquanto
> `gemini-3.6-flash` respondeu em 10,4 e `gemini-flash-lite-latest` em
> 0,98.
>
> A velocidade agora se escolhe na tela (**Configurações → Integrações**,
> três perfis com o tempo medido em cada um), e o botão "Conferir na
> prática" mede de verdade: 10,6 s no Equilibrado contra **1,1 s** no
> Rápido, na mesma via. Mas o piso continua sendo o da camada gratuita —
> uma chave paga tira a fila da conta, e é a única coisa que faz o
> perfil Profundo valer a pena.

**b) `GEMINI_API_KEY` na Vercel.** Está no `.env` local e **não foi
possível confirmar em produção** — o `API_TOKEN` de lá é outro. Conferir
com `/api/saude`.

**c) `NEXT_PUBLIC_APP_URL` ausente.** Sem ela o retorno do OAuth do
Google Agenda monta `http://localhost:3000`.

**d) `CRON_SECRET` na Vercel.** A rotina agendada existe
(`app/api/cron/route.ts`, agendada em `vercel.json` para 6h) e roda
localmente. Em produção ela aceita `CRON_SECRET` ou o `API_TOKEN` — sem
nenhum dos dois ela responde 503 e **fica desligada, não aberta**.
Definir a variável na Vercel é o que a liga lá.

**e) Nada mais.** Vínculo, planos e permissões saíram desta seção em
22/08 — estão em *Entregue*, com o `check:` de cada um.

---

### 4. Armadilhas já medidas — não redescobrir

- **O service worker do Manifest V3 morre em segundos.** Cache em `Map`
  não existe na prática; usar `chrome.storage.session`.
- **Dependência dura mata o painel.** Montar primeiro, checar depois —
  senão o sintoma é "a extensão não abre mais, só reinstalando".
  `montar()` liga o botão de abrir **antes** de qualquer outra coisa, e
  `montado()` confere que o shadow ainda tem o gatilho.
- **`inset: 0 0 0 auto` numa raiz com filhos absolutos dá largura zero.**
  Foi o que sumiu com o painel: a gaveta solta se posicionava por `left`
  a partir da borda direita da tela e ia parar fora dela. Medido em
  Chrome: gaveta em 900 → desenhada em 2180 numa janela de 1280.
- **Empurrar a página com `margin-right` no `<html>` não funciona em
  todo site.** No WhatsApp Web o `#app` é `position: absolute` com
  `inset: 0` — o bloco que o contém é a viewport, não o `<html>`.
  Medido: margem de 380px levou o `<html>` a 900 e o `#app` continuou em
  1280. Só largura própria (`calc(100vw - 380px)`) o alcança, e ele é
  **neto** do `<body>`, não filho.
- **200 com HTML não é sucesso.** Conferir `content-type` antes de
  `resposta.json()`, nos dois lados.
- **O apelido do modelo é o congestionado.** `gemini-flash-latest`
  concentra quem não fixou versão. Versão fixa como principal, apelido
  como reserva — e o 404 que o apelido nunca tem é justamente o que ele
  cobre. A escolha está em Configurações → Integrações; o `.env` só vale
  onde não há banco.
- **O `enum` do Gemini só aceita texto**; nome de modelo envelhece
  (`gemini-2.0-flash` já é 404); 503 é fila, não configuração errada.
- **Server action na Vercel tem relógio.** A importação do Wootric
  morria com um erro de rede genérico que parecia integração quebrada —
  era trabalho demais para uma requisição. Rodada curta com continuação
  (`parcial` / `proximoDesde`) e `maxDuration` no layout da rota.
- **Voltar um caso de "Resolvido" apaga a avaliação** (`moverPara`).
- **`updateTag` só vale em server action**; em rota é
  `revalidateTag(tag, "max")`.
- **A Área da Empresa do RA é um SPA**: a chave da leitura tem de ser
  endereço **+ id**, e o `<h1>` é o cabeçalho da tela, não o título.
- **A página do RA continua depois da reclamação.** O leitor do relato
  parava numa lista de seções conhecidas e, não achando nenhuma, seguia
  até o fim do documento — trazendo o FAQ do portal colado no relato do
  consumidor. Duas travas agora: a lista de seções e uma regra de forma
  (título é curto, começa com maiúscula e não termina em ponto).
- **Trocar coluna exige reiniciar o `next dev`.** O Turbopack guarda o
  cliente Prisma compilado, e a primeira requisição depois de um
  `db:push` estoura com "a coluna X não existe" mesmo com o banco já
  correto. Uma ocorrência, no primeiro pedido; as seguintes passam. O
  console do navegador **mantém** o erro antigo no buffer, então conferir
  ali engana — o número que vale é o do log do servidor.
- **Vários arquivos estão em CRLF** e heredoc de bash quebra com
  conteúdo grande — usar a ferramenta Write. Script de patch que casa
  texto literal tem de normalizar `\r\n` antes: `case.mapper.ts` é LF e
  `case.repository.ts` é CRLF, no mesmo diretório. O sintoma é a troca
  falhar **em silêncio** — `String.replace` sem match devolve o original.
- **`lib/auth/guard.ts` é `server-only` e arrasta o Prisma.** Uma tela
  cliente que importou dali só o rótulo do papel derrubou o `build` com
  `module not found: dns` — o driver do Postgres foi parar no bundle do
  navegador. `Role` e `ROLE_LABELS` moram em `lib/auth/modules.ts`, que
  não tem `server-only`; o guard reexporta.
- **Gravação que não conhece o campo apaga o campo.** A planilha do
  Reclame Aqui não traz CNPJ, e o `upsert` da reimportação escrevia
  `null` por ausência — cada reimportação semanal zeraria em silêncio
  todo vínculo que a extensão tivesse construído, com o sintoma
  aparecendo semanas depois como "os vínculos somem sozinhos". O
  `update` do upsert passa por `semApagarVinculo`; o `create` não.

---

## Dívida técnica

### Nenhuma aberta (22/08/2026)

A única que havia — treze formulários preenchendo os campos num efeito
— foi paga, e a regra do `eslint.config.mjs` voltou de `warn` para
`error`. O detalhe está em “A dívida do `setState` em efeito foi paga”,
em Entregue.

`npm run lint` fecha com **0 erros e 1 aviso**: um `exhaustive-deps` no
`CaseContext`, onde incluir as funções na lista recriaria o valor do
contexto a cada render e derrubaria a memoização inteira. É decisão, não
esquecimento — e uma que só compensa mexer junto com a migração daquele
contexto para `useCallback`.

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


## Variáveis de ambiente

Onde cada uma mora, o que quebra sem ela, e como definir.

**Na Vercel:** projeto → *Settings* → *Environment Variables* → *Add
New*. Marque os três ambientes (*Production*, *Preview*, *Development*)
salvo onde este quadro disser o contrário. **Variável nova só vale no
próximo deploy** — depois de salvar, vá em *Deployments*, abra o mais
recente e use *Redeploy*. Isso é a causa mais comum de "coloquei a chave
e continua igual".

**No local:** arquivo `.env` na raiz de `cw-reputacao/`, uma por linha,
sem aspas. O `.env` **não** vai para o Git.

Para conferir o que um ambiente tem, sem revelar nenhum valor:

```bash
curl -H "Authorization: Bearer SEU_API_TOKEN" https://cw-rho-eight.vercel.app/api/saude
```

O `API_TOKEN` da Vercel é **diferente** do local — conferido.

---

### `CRON_SECRET`

**O que é:** a senha da rotina agendada (`app/api/cron/route.ts`,
agendada em `vercel.json` para as 6h). Ela encerra ciclo de NPS
abandonado, avisa movimentação atrasada, reenvia webhook que falhou e
liga reclamação a estabelecimento pelo CNPJ.

**Sem ela:** a rotina responde **503 e fica desligada** — não aberta.
É a escolha certa: ela mexe em indicador e dispara webhook, e sem senha
qualquer pessoa com o endereço mexeria nos números.

**Valor:** qualquer texto longo e aleatório. Gere um assim:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Onde:** Vercel, só em *Production*. A Vercel manda o valor no
cabeçalho `Authorization` quando dispara o cron dela, sozinha. No local
é opcional — sem ela, o `API_TOKEN` serve.

---

### `NEXT_PUBLIC_APP_URL`

**O que é:** o endereço público da aplicação. Vai para o navegador (é o
que o prefixo `NEXT_PUBLIC_` significa), então **não pode guardar
segredo** — e não guarda, é só uma URL.

**Sem ela:** o retorno do OAuth do Google Agenda monta
`http://localhost:3000`, e quem conecta a agenda em produção é jogado
para a própria máquina. O sintoma é "conectei e não voltou".

**Valor:** `https://cw-rho-eight.vercel.app` — sem barra no fim.

**Onde:** Vercel, em *Production* e *Preview*. No local, deixe fora ou
ponha `http://localhost:3000`.

---

### `RESEND_API_KEY` — **falta definir**

**O que é:** a chave de envio de e-mail transacional. Hoje ela serve a
uma coisa só: mandar o código de seis dígitos da verificação em duas
etapas.

**Sem ela:** a verificação em duas etapas **não liga**, nem para uma
pessoa nem para a equipe. Não é limitação de tela — é a trava certa:
exigir um código que não tem como chegar trancaria todo mundo do lado
de fora, e o conserto exigiria abrir o banco na mão. Fora de produção o
código sai no terminal do `npm run dev`, o que deixa desenvolver o
fluxo sem chave nenhuma.

**Onde pegar:** <https://resend.com> → conta gratuita (3.000 e-mails por
mês, 100 por dia) → *API Keys* → *Create API Key*. Começa com `re_`.

**Antes de funcionar, um passo a mais:** em *Domains*, adicionar
`cardapioweb.com` e criar os registros DNS que o Resend mostrar (SPF e
DKIM). Sem o domínio verificado, o envio volta com 403 dizendo qual
domínio falta. Enquanto isso não acontece dá para testar com o
remetente de sandbox do próprio Resend.

**Onde:** Vercel, nos três ambientes, e **refazer o deploy** — variável
nova só vale no próximo. Opcionalmente defina também
`EMAIL_REMETENTE`, no formato `CW Reputação <nao-responda@cardapioweb.com>`;
sem ela vale esse mesmo valor como padrão.

**Trocar de provedor depois é barato:** todo o envio passa por
`lib/email/enviar.ts`, e nada fora desse arquivo sabe qual provedor
está em uso.

---

### `GEMINI_API_KEY`

**O que é:** a chave da IA que responde hoje — triagem, resumo de
conversa, sugestão de resposta, tanto no assistente quanto na extensão.

**Sem ela:** as funções de IA respondem "sem provedor configurado". Nada
mais quebra; o resto do sistema não depende de IA.

**Onde pegar:** <https://aistudio.google.com/apikey> → *Create API key*.
Começa com `AIza`.

**Onde:** Vercel, nos três ambientes. Está no `.env` local e **não foi
possível confirmar em produção** — confira com `/api/saude`.

**A ressalva que importa:** a camada gratuita entra em fila, e é ela o
teto da velocidade. Medido no mesmo minuto, com o mesmo pedido de 52
tokens: `gemini-flash-latest` não respondeu em 35 segundos enquanto
`gemini-3.6-flash` respondeu em 10,4 e `gemini-flash-lite-latest` em
0,98. Uma chave paga tira a fila da conta.

---

### `ANTHROPIC_API_KEY`

**O que é:** a alternativa ao Gemini. **Nunca foi preenchida** — o valor
no `.env` é o exemplo literal, `"sk-ant-..."`.

**Sem ela:** o Gemini responde por tudo. O seletor de provedor em
*Configurações → Integrações* mostra a chave da Anthropic como ausente,
e escolher "Anthropic" ali não muda nada enquanto ela faltar.

**Onde pegar:** <https://console.anthropic.com> → *API Keys* → *Create
Key*. Começa com `sk-ant-`. É paga por uso, com valor pré-carregado.

**Onde:** Vercel, nos três ambientes, e no `.env` local.

**O que ela destrava:** o perfil **Profundo** da tela de IA. Ele existe
hoje, mas sem chave paga não vale a pena — o piso continua sendo a fila
da camada gratuita.

---

### As que já estão definidas

| Variável | Para quê |
| -------- | -------- |
| `DATABASE_URL` | Postgres do Supabase, **pooled** (porta 6543). É a que a aplicação usa. |
| `DIRECT_URL` | O mesmo banco em conexão de sessão (porta 5432). Só para `prisma db push` e os `check:`. |
| `API_TOKEN` | Senha da API pública que alimenta o CW Engine, e da `/api/saude`. |
| `AUTH_SECRET` | Assina o cookie de sessão. Trocar derruba todo mundo. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth da agenda. |


## Entregue


### Dashboard e análise do NPS: dois números para a mesma pergunta (23/08/2026)

Último item da fila.

**No Dashboard, dois números contraditórios lado a lado.** O bloco de
reputação mostrava a janela oficial de 6 meses — 6 reclamações sem
resposta — e o cartão logo abaixo mostrava **13**, que é a base
inteira. Os dois estavam certos e mediam coisas diferentes; nada na
tela dizia isso. Um número que contradiz o de cima é como alguém perde
a confiança na tela toda, inclusive na parte que está certa.

Agora há uma linha entre os dois blocos dizendo qual é qual, e os
quatro cartões declaram "em toda a base". A escolha de manter o escopo
amplo é deliberada: reclamação de 2024 sem resposta continua sem
resposta e continua sendo trabalho, mesmo fora da janela que compõe a
nota.

**A evolução mensal ganhou janela.** Ela desenhava de fevereiro de 2024
a agosto de 2026, logo abaixo de um bloco de 6 meses, sem dizer.
Padrão de 12 meses: seis é curto demais num gráfico mensal — seriam
seis pontos — e "tudo" começa em 2024, quando o volume era outro e a
comparação engana.

**Na análise do NPS, a causa raiz dizia "Outro — 100%".** O percentual
era calculado sobre o que já estava classificado, e havia **uma**
classificação entre 89 respostas com comentário. Cem por cento é uma
afirmação forte numa tela chamada "onde investir para parar de perder
cliente": ela diz que a operação inteira tem uma causa só. Sobre a
população certa — quem escreveu alguma coisa, porque sem comentário não
há o que classificar — o mesmo dado vira **1,1%**, que é verdade e
ainda escancara o buraco de classificação.

**E o separador decimal era ponto.** "10.1%" em português não é "dez
vírgula um": é o começo de "10.100", e num painel cheio de contagem
inteira ao lado a leitura errada é a mais natural. Corrigido na
distribuição por segmento, na régua de humor e no `BarList`, que é
compartilhado e levava o defeito para toda tela que o usa.

---

### Verificação em duas etapas, com código por e-mail (23/08/2026)

Primeiro item da fila. A senha prova o que a pessoa **sabe**; o código
prova que ela tem a caixa de e-mail. É o que sobra de proteção quando
uma senha vaza — e senha vaza por reuso em outro site, não por falha
daqui.

**O projeto não tinha envio de e-mail.** Foi a primeira coisa a existir:
`lib/email/enviar.ts`, uma função, provedor escolhido por variável de
ambiente, **zero dependência nova** — a API do Resend é um POST com
JSON, e o pacote oficial seria 200 kB para embrulhar quinze linhas.
Fora de produção o e-mail sai no terminal, o que deixa desenvolver o
fluxo sem chave nenhuma.

**As decisões que valem a pena não redescobrir:**

- **O código nunca é guardado em claro.** Seis dígitos são um milhão de
  combinações: em texto, um vazamento do banco viraria vazamento de
  sessões. É bcrypt justamente porque o espaço é pequeno — o custo por
  tentativa é a defesa.
- **O estado entre as duas telas é um cookie assinado próprio
  (`cw_2fa`), não a sessão marcada como "pendente".** Um cookie de
  sessão válido é a chave da casa; marcá-lo como incompleto e confiar
  que toda tela lembre de conferir a marca é a forma de, um dia, uma
  tela nova esquecer. `getSession` continua devolvendo `null` até o
  código bater. E `sameSite: strict`, não `lax` como a sessão — esta
  etapa só existe entre duas telas nossas.
- **O usuário é relido do banco depois do código, não reaproveitado do
  cookie.** Entre a senha e o código passam minutos, e neles a conta
  pode ter sido desativada ou mudado de papel. Carregar o papel antigo
  dentro do cookie seria uma escalação de privilégio com dez minutos de
  validade.
- **O palpite é contado antes da comparação.** Contar depois deixaria
  quem derrubasse a conexão tentar de graça, e o limite de cinco
  viraria decorativo.
- **Esgotar os palpites mata o código, não a conta.** O contrário seria
  arma: bastaria errar cinco vezes o código de alguém para trancá-la
  fora.
- **Pedir código novo mata o anterior**, com espera de 60 segundos entre
  pedidos. Sem a primeira regra o e-mail vira um chaveiro de códigos
  vivos; sem a segunda, o botão vira máquina de encher caixa de entrada
  alheia.
- **Sem provedor de e-mail, a exigência global não liga** — recusada no
  servidor, não só desabilitada na tela, porque botão desabilitado se
  contorna. Exigir um código que não chega tranca a equipe inteira e o
  conserto exigiria abrir o banco.
- **`padStart` no código.** Um sorteio de 42.318 viraria "42318", cinco
  dígitos num campo que espera seis. Um em cada dez cairia nessa faixa,
  e o relato seria "às vezes o código não funciona" — o tipo de coisa
  que ninguém reproduz. Medido: em 2.000 amostras, 186 começam com zero.
- **O campo é `text` com `inputMode="numeric"`, não `type="number"`.**
  O campo numérico aceita sinal e expoente e come o zero à esquerda.

`npm run check:duas-etapas` prova as onze defesas contra o banco real,
criando e apagando um usuário de teste. Ele não confere só que o código
certo entra — confere que **cada recusa recusa**. O fluxo completo
também foi percorrido no navegador: senha certa → tela do código →
palpite errado recusado com a contagem → código certo → dashboard.
Nenhum dos dois cookies é legível por JavaScript.

Uma nota de método: `server-only` não é resolvível pelo Node fora do
build do Next, então o script roda com
`tsx --conditions=react-server`. Com isso, qualquer conferência futura
consegue importar módulo de servidor.

---

### Os gráficos, e a calculadora que prometia o impossível (23/08/2026)

O Isaac descreveu três defeitos: **"as datas ficam em cima das outras,
não tem um filtro de período como outras funcionalidades e também
quando passo o mouse em cima não tem nenhuma informações ou
descrição."** Os três eram reais.

**Datas empilhadas.** Cada componente desenhava um rótulo por ponto. O
número de rótulos passa a sair da largura disponível
(`LARGURA_POR_ROTULO`), com o primeiro e o último sempre presentes —
são eles que dizem o período que o gráfico cobre. Um detalhe custou
duas tentativas: forçar o último rótulo faz ele encostar no vizinho do
passo. O critério certo é **distância em pixels**, não fração do passo;
`passo / 2` não dispara quando o passo é 3 e a sobra é 2, mas dois
intervalos de 24 px dão 48 px e o rótulo precisa de 70. Medido no
navegador: o `TrendChart` foi de 30 rótulos sobrepostos para 10 com
folga mínima de 21 px; o do NPS, de 24 para 8 com folga de 96 px.

**Sem informação ao passar o mouse.** O `ReputationTrend` não tinha
nada; o do NPS tinha um `<title>` — o balão nativo do navegador, que
espera um segundo, não tem estilo e não existe no telefone. Os dois
ganharam cartão próprio, com faixa de captura por mês (a área sensível
era o ponto de 3 px) e o número que responde à pergunta da tela: no de
reputação, a variação contra o mês anterior; no de NPS, a divisão entre
promotor, passivo e detrator, porque um NPS de 40 com trinta respostas
e um com três são fatos diferentes.

**Sem filtro de período.** Era a tela de **Analytics**: nove painéis
lendo a base inteira, sem recorte — respondia sempre "desde sempre".
Passou a usar o mesmo `PeriodPicker` das telas de reputação, com o
filtro aplicado uma vez e todos os painéis lendo dele. Medido: 30 dias
→ 17 casos, 3 meses → 56, 6 meses → 129, 12 meses → 212, de 334.

Os oito gráficos de `/reclame-aqui/graficos` foram conferidos e já
estavam certos: zero sobreposição de rótulo e cartão com dados nos
oito. O `MultiLineChart` já tinha afinamento e `onPointerMove`.

---

**A calculadora foi a parte séria.** Você pediu para conferi-la junto, e
ela nunca tinha sido rodada contra a base. Três defeitos, todos achados
pelo `npm run check:calculadora` novo:

1. **Não havia teto de avaliações.** Uma avaliação pertence a uma
   reclamação — não existe avaliação solta no Reclame Aqui. A tela
   aceitava 200 avaliações nota 10 sobre 129 reclamações e respondia
   **nota 9,5**, com cara de número exato, para um plano que não tem
   como acontecer. Só havia 51 reclamações sem avaliação no período.
2. **Os dois caminhos da mesma tela discordavam.** `evaluationsToReach`
   subia até 2000 sem olhar a base; a pessoa lia "faltam N" ali e
   digitava N no cenário, que dá outro número. Agora os dois param no
   mesmo teto, e "não alcançável" diz qual dos dois motivos é.
3. **Contagem negativa passava.** `min={0}` no HTML é validação, não
   trava. Digitar "-20" em nota 3 tirava 20 de `evaluated` e 60 de
   `scoreSum`, levando a média do consumidor a 18,97 e a nota final a
   **12,7** numa escala que vai até 10.

**O primeiro conserto do teto estava errado, e foi a tela que pegou.**
Travar `evaluated` sem travar `scoreSum` prende o denominador e solta o
numerador: 200 notas 10 passaram a dar **12,9**, pior do que o defeito
original. O teste tinha ficado verde porque conferia só a contagem.
Depois faltou ainda um terceiro lugar — os indicadores derivados: 251
notas 10 num teto de 51 ainda rendiam 251 "resolvidas", que o
`Math.min` grudava no total e levava a nota a 9,5 em vez de 9,1. A
lição está escrita no script: **contagem coerente com nota impossível é
exatamente o que uma conferência de calculadora existe para não deixar
passar.** Ele hoje varre 72 combinações exigindo 0–10 em todas.

O teto aparece na tela ("51 reclamações do período ainda estão sem
avaliação"), porque um campo que trava sem dizer por quê é pior do que
um campo que aceita bobagem.

---

### Dezoito vulnerabilidades em produção, e o XSS que não existia (23/08/2026)

**`npm audit` nunca tinha rodado neste projeto.** Encontrou 18
vulnerabilidades em dependências de produção — nada disso aparece em
`tsc`, `lint` ou nos vinte `check:`, porque é código de terceiro.

| | |
| --- | --- |
| Antes | 18 (3 moderadas, 15 altas) |
| `npm audit fix` | −11 |
| `next@16.3.2` | −3 (postcss, sharp) |
| SheetJS do CDN | −1 |
| **Restam** | **3, aceitas com motivo escrito** |

A que mais importava era o **`xlsx`**. O pacote do npm está congelado na
0.18.5 com *prototype pollution* conhecido e **sem correção publicada
lá** — e não é risco teórico: esta aplicação lê planilha que a operação
envia, e é exatamente esse o caminho. A versão mantida vive no CDN do
próprio SheetJS, e passou a vir de lá. Provado depois: o importador lê
as 340 linhas, os cinco `check:` que tocam planilha passam, e o build
compila.

As três que sobram são artefato do próprio `npm audit`: ele oferece como
correção da cadeia do CLI do Prisma a versão **6.12.0**, anterior à 7
que a aplicação usa com `prisma.config.ts` e adapters. Aceitar isso
quebraria o banco inteiro para resolver um aviso sobre código que **não
roda em produção**. Ficaram declaradas em `check:dependencias`, com data
— o teto é por decisão registrada, não "zero avisos", porque teto
impossível vira check que alguém desliga.

**O XSS que eu procurei e não achei.** O painel monta HTML em texto e o
injeta dentro da página do WhatsApp — cada interpolação é um ponto de
execução, e o texto vem do consumidor. Investiguei campo a campo os
candidatos:

- `c.titulo` e `c.protocolo` montam o **prompt da IA**, não HTML.
- `dados.usuario.nome` vai para `textContent`, que não interpreta HTML.
- `captura.cliente` é argumento de `vazio()`, que escapa.

Nenhum caminho até `innerHTML` passa sem tratamento. Ficou o
`check:escape`, que olha **o sumidouro e não a fonte**: as 18 injeções
de HTML, em vez das 305 interpolações do arquivo. A primeira versão fez
o contrário e devolveu 105 suspeitas — quase todas prompt de IA e
`textContent`. Auditor com 105 falsos positivos é auditor desligado.

O resto da varredura de segurança, conferido e limpo: cookie de sessão
com `httpOnly`, `sameSite` e `secure` em produção; token de API
comparado com `timingSafeEqual`; senha em bcrypt com 10 rodadas; nenhum
`$queryRawUnsafe`; nenhum `dangerouslySetInnerHTML`; e o `.env` nunca
esteve no histórico do Git.


### As telas e a fiação da extensão (23/08/2026)

Faltava o outro lado da auditoria. As varreduras anteriores olhavam o
código; estas abrem a tela e seguem o fio.

**`check:telas` abre as 34 rotas com sessão** e confere que cada uma
volta com conteúdo. Pega três coisas que nenhum `tsc` vê: erro de
servidor na renderização com dado real, rota que virou 404 depois de
renomear uma pasta, e página que responde 200 devolvendo só o esqueleto
— o número que denuncia isso é o tamanho do corpo, e o piso é 4 kB.

As rotas com parâmetro recebem **um id que existe no banco**: testar com
id inventado provaria só a tela de "não encontrado".

Resultado: 34 de 34 com conteúdo. Os dois redirecionamentos que a
primeira versão acusou — `/` para `/dashboard` e `/empresas` para
`/estabelecimentos`, a URL nova do módulo renomeado — são intencionais,
e o script passou a distinguir "redireciona para onde deve" de "cai no
login".

**`check:fiacao` segue os três elos que se rompem em silêncio** no
painel da extensão:

    botão  →  tratador do clique  →  service worker  →  rota da API

O painel é HTML montado em texto e os cliques são despachados por
`data-acao`. Um botão com `data-acao="triar"` e nenhum `case "triar"`
compila, renderiza, fica bonito na tela e **não faz nada** ao ser
clicado. Nada disso passa por `tsc`.

Resultado: 41 botões, todos com tratador; 17 tipos de mensagem, todos
atendidos; 13 rotas chamadas, todas existem; nenhum tratador sobrando.

**O desempenho em dev engana, e vale registrar.** A primeira abertura de
`/estabelecimentos/[id]` levou **41 segundos** — compilação do Turbopack
para aquela rota. Na segunda passada, **211 ms**. Medir a primeira
abertura em desenvolvimento é medir o compilador, não a aplicação; o
número que vale é o da segunda.

Duas varreduras, dois alarmes falsos consertados antes de virarem
relatório — o mesmo padrão das anteriores. `situacao === "estourado"`
casava com o padrão de `acao === "..."` e acusava três valores de SLA
como botões órfãos; e `tipo: "caso"` **dentro** de `anotacao` parecia
uma mensagem sem tratador. Os dois foram investigados à mão antes de eu
acreditar neles.


### Auditoria da plataforma inteira (23/08/2026)

O Isaac pediu para passar por tudo: bugs, segurança, desempenho. Três
varreduras novas ficaram no repositório, porque auditoria que não vira
comando é auditoria que vale uma vez.

**Um buraco de segurança real, e ele era invisível.** O arquivo
`lib/actions/case.actions.ts` era sobra da era dos mocks: cinco server
actions — `getCases`, `getCaseById`, `createCase`, `updateCase`,
`deleteCase` — sem autenticação nenhuma, mexendo em `mockCases` na
memória. **Ninguém importava o arquivo**, e é justamente isso que o
tornava perigoso: `"use server"` faz o Next publicar cada função como
endpoint HTTP, esteja ela em uso ou não. `getCases()` devolvia 334
reclamações com nome, cidade e relato para qualquer um que chamasse. O
arquivo foi removido.

A outra correção: `listIaPerfis` era a única action da plataforma sem
checagem. A lista não é segredo, mas diz quais modelos a operação usa e
quanto cada um demora — e uma exceção sem motivo é a porta que fica
destrancada porque ninguém lembra por quê. Passou a pedir LEITURA, como
o resto do arquivo.

**O que estava certo, e agora está provado:**

| | |
| --- | --- |
| 19 rotas de `/api` | todas conferem quem chama |
| 51 server actions em 10 arquivos | todas conferem o papel |
| 43 tabelas | RLS ligado em todas |
| `NEXT_PUBLIC_` | só `APP_URL` e `VERSAO` — nenhuma chave |
| Componentes de cliente | nenhum lê segredo |
| Extensão | pede a **origem exata** configurada, nunca o curinga |

O callback do OAuth do Google merece nota: ele é a única rota sem dono
no momento da chamada, e resolve isso com um `state` assinado por JWT,
com expiração. Sem essa verificação, um link montado por terceiro
conectaria a conta Google do atacante à sessão da vítima.

**Persistência: 69 mutadores expostos, todos gravam.** É a varredura que
existe por causa do defeito que já apareceu três vezes aqui — Times,
Metas e Clientes alteravam a tela e não gravavam. O contrato é único:
todo mutador de contexto passa por `sincronizar`. Nove exceções estão
declaradas com o motivo escrito, e contexto que o script não entende é
**reportado**, não ignorado: um auditor que passa calado quando não
entende o arquivo é pior do que auditor nenhum.

**Desempenho, com a base três vezes maior:**

```
carga do quadro (fetchCases)      428 ms   teto 1500   340 registros
contagem por etapa                 57 ms   teto  400
cadastro de estabelecimentos       73 ms   teto  600   239 registros
respostas de NPS                  132 ms   teto 1500   868 registros
busca por telefone (extensão)     166 ms   teto  700
reclamação pelo protocolo         125 ms   teto  300
```

Os tetos são de percepção, não de banco, e estão folgados de propósito:
isto existe para pegar regressão de ordem de grandeza, não para
reprovar variação de rede. No navegador, o quadro mantém 4.828 nós no
DOM com 340 reclamações — a lista é janelada, não renderiza tudo.

**Três detectores tiveram de ser consertados no caminho**, e vale
registrar porque o padrão se repete: a primeira versão de cada um dava
falso positivo em massa. Auditor que grita demais é auditor desligado —
o de persistência apontava `setState` interno como se fosse contrato, e
o de segurança seguia só um elo da corrente de auxiliares, o que
acusava as três actions do Google que passam por `comToken` →
`contexto` → `requireRole`.


### O tempo de resposta perdia as horas no caminho (23/08/2026)

A carga tinha um formatador próprio de tempo decorrido, e ele colapsava
tudo acima de 48 h em dias inteiros — "6 dias". Na gravação,
`parseElapsedText` lia isso de volta e multiplicava por 1440. **As horas
eram jogadas fora entre a leitura e o banco.**

Medido na carga de 340, comparando planilha e banco:

| | Antes | Depois |
| --- | --- | --- |
| Mediana da primeira resposta | 144,0 h | **138,0 h** (planilha: 138,1) |
| Média | 281,8 h | **280,9 h** (planilha: 281,4) |
| Máximo | 4104,0 h | **4101,0 h** (planilha: 4101,1) |

Quatro por cento de distorção na mediana de um indicador que é o motivo
de o produto existir. O conserto é usar o `formatElapsed` do serviço de
reputação em vez do formatador local: ele escreve "5 dias e 18 horas", e
o `parseElapsedText` lê os dois pedaços. O par é fiel até a hora — o
formato não carrega o minuto, e isso está escrito na tolerância do teste.

Agora existe `npm run check:reputacao`, e ele faz duas coisas que
faltavam:

- **Prova a ida e volta** em treze valores, um por faixa que o
  formatador trata diferente, incluindo o que quebrava.
- **Prova que a nota fecha com a própria memória de cálculo.** Os quatro
  componentes com seus pesos têm de somar o `raScore` exibido; se não
  somarem, a tela de auditoria conta uma história que não é a do cálculo.

E imprime o retrato, que é a resposta rápida para "como estamos" sem
abrir o navegador:

```
6m   2026-02-01 a 2026-07-31 · 129 reclamações
     nota 8.60 (RA1000) · RA1000: sim
     resposta 95.3% · solução 92.3% · consumidor 7.82 · voltaria 76.9%

12m  2025-08-01 a 2026-07-31 · 212 reclamações
     nota 8.40 (Ótimo) · RA1000: não
     resposta 97.2% · solução 89.9% · consumidor 7.56 · voltaria 76.8%
```

**O número que a base nova revelou:** a primeira resposta pública leva
uma mediana de **5 dias e 18 horas**, e 259 das 327 respondidas passam
de 48 h. Não é defeito de importação — é o que os dois lados dizem. Com
a base antiga de seis meses isso não aparecia com essa clareza.


### O export "Base de dados RA", que é o completo (23/08/2026)

O portal exporta dois relatórios, e até hoje a carga vinha do menor. O
**"Base de dados RA"** tem 340 reclamações contra 127, cobre de
**15/02/2024 a hoje** em vez de seis meses, e traz três colunas que o
outro não tem:

| Coluna | O que muda |
| ------ | ---------- |
| `Resposta da empresa` | O texto público inteiro, em 327 das 340. Antes ficava a frase de reserva "Resposta pública registrada no portal" — que dizia *que* houve resposta e não *qual*. |
| `Problema RA` | A classificação que o **próprio consumidor** escolhe ao abrir a reclamação, em 312 das 340. É dado de origem, não palpite por título. |
| `Avaliações desconsideradas RA` | As notas que o portal invalidou. Sem ler isso, uma nota já descartada por eles continuaria pesando no indicador daqui, e os dois números divergiriam sem explicação. |

A classificação passou a ter três degraus, em ordem de confiança: o CW
Engine (feita por gente da operação), o `Problema RA` (do portal) e, só
então, o classificador por título. O degrau existe em vez de uma escolha
fixa porque o mesmo comando lê os dois exports.

Resultado da carga: **340 reclamações, 283 com estabelecimento** em 239
cadastros, 296 clientes, 233 estabelecimentos com documento. O casamento
com o CW Engine subiu junto — 332 de 340 acharam par, 227 deles pelo id
do Reclame Aqui.

**Um efeito da regra da Carla que vale registrar:** "de janeiro de 2026
para trás" passou a cobrir **196 dos 340** casos, porque a base agora
inclui 2024 e 2025. É literalmente a regra pedida, aplicada a uma base
três vezes maior.

### Etapas e tipos do NPS: a tela não dizia o que era cada campo (23/08/2026)

O cadastro era uma linha de campos sem rótulo nenhum, distinguidos por
largura e por `title`. O que aparecia na tela era uma caixa larga vazia
com uma bolinha colorida no meio — e a bolinha era o campo do **emoji**,
com o campo do **nome** empurrado para fora da vista.

A causa: um `flex` com um campo `w-full` ao lado de três `shrink-0`. A
soma passava da largura do modal, e o que sobrava era barra de rolagem
horizontal. Medido no navegador depois do conserto: **zero elementos com
rolagem horizontal** dentro do modal.

Cada item virou um cartão com:

- **Cabeçalho com a identidade** — emoji, nome e as marcas de "encerra" e
  "inativo". Antes, para saber de que etapa se tratava era preciso clicar
  dentro do campo.
- **Rótulo em cima de cada campo**, numa grade que quebra em vez de
  estourar.
- **As travas com a explicação visível.** Eram três caixas de marcar com
  rótulo de quatro palavras e o motivo escondido num `title` — que
  aparece depois de um segundo com o mouse parado, e nunca em telefone.
  Quem configura isto faz uma vez a cada muitos meses: é exatamente quem
  não lembra o que a opção faz.

A descrição do modal também mudou. Dizia "os dois deixaram de ser lista
fixa no código", que é história de implementação — agora diz para que a
aba aberta serve.


### Carga incremental: criar só o que falta (23/08/2026)

Chegou um export novo do portal com a pergunta certa: "compare com a
base e crie o que não tiver". A resposta daquele arquivo específico foi
**nada** — as 127 linhas já estavam lá, e conferido por três caminhos:
arquivo idêntico ao anterior campo a campo, todos os protocolos
presentes, e **zero divergência** de etapa, nota ou resolvida.

Mas a pergunta se repete a cada export, e até aqui a única resposta que
o sistema tinha era a carga completa — que **apaga** a base para
regravar. Trocar 127 reclamações para inserir 1 levaria junto as
anotações, as etiquetas e as movimentações que a operação fez em cima
delas.

Agora existe `--somente-novas`. Ele tem duas obrigações opostas, e as
duas são provadas por `check:incremental`, que monta uma planilha
descartável com uma linha que já existe e uma inventada:

1. **Cria o que falta** — com contato completo e o CPF virando
   documento.
2. **Não toca no que existe.** A linha da reclamação já cadastrada vai
   para a planilha do teste com a **etapa trocada de propósito**; se a
   carga a regravasse, a etapa mudaria e a conferência pegaria. O portal
   reescreve status e nota; quem move o caso no quadro é gente.

Rodar de novo não duplica, e a trava do backup não se aplica — ela
existe porque a carga completa apaga, e atrito por simetria é o que faz
as pessoas contornarem a trava quando ela importa.

Duas coisas do caminho: cadastro de estabelecimento que já existe é
**reaproveitado** em vez de recriado (a ficha carrega plano, MRR e
responsável preenchidos à mão), e estabelecimento que já tem documento
não é sobrescrito — é exatamente o caso dos três deixados vazios por
divergência.


### SpeedInsights ligado, e a conta do CW Engine visível (23/08/2026)

Duas pontas soltas, fechadas com sua autorização.

**`SpeedInsights`** era dependência do projeto, estava importado sem ser
renderizado, e por isso media exatamente nada. Agora está no layout
raiz. O que ele manda para a Vercel é tempo de carregamento por rota, do
navegador de quem usa — nenhuma reclamação, nenhum telefone, nenhum
conteúdo de tela. Só reporta em produção.

**A conta no CW Engine estava gravada e invisível.** A carga trouxe o
`Company ID` de 105 estabelecimentos e o endereço do portal de 27, e
nada disso aparecia na tela. O id entrou na ficha, e o endereço virou um
botão — "Abrir a conta no portal" —, porque link em lista de texto vira
número para copiar à mão.

O endereço é guardado inteiro, e não montado a partir do id: são **dois
números diferentes** — a conta 27409 abre em `/contas/25681`. Montar a
URL pelo id errado levaria a operação para a ficha de outro restaurante.


### O assistente respondia vazio, e um `\r` era a razão (23/08/2026)

A tela do assistente devolvia **HTTP 200 com zero caracteres**. Sem
erro, sem aviso, sem onde olhar — a mesma classe de defeito do leitor do
WhatsApp, e por isso demorou tanto para aparecer.

O Gemini separa os eventos do SSE com `\r\n\r\n`. O decodificador
dividia por `\n\n`: nenhum evento fechava, o fluxo inteiro era consumido
sem render nada, e o gerador terminava com o pedaço final zerado. A rota
recebia um único evento `done` com `usage: 0/0` e fechava a conexão.

Medido na mesma resposta do Gemini: **4 eventos** dividindo por
`\r\n\r\n`, **1** dividindo por `\n\n`. O SSE permite as duas formas —
a Anthropic manda sem `\r` —, e agora o leitor aceita as duas.

Por que passou tanto tempo: **o resumo e o assistente usam vias
diferentes.** O resumo (`pedirEstruturado`) pede a resposta inteira e
nunca tocou nesse código; o assistente escuta um fluxo. `check:ia`
provava só o primeiro. Agora prova os dois, e a parte do streaming roda
com bytes escritos à mão, sem gastar chamada de modelo — **conferido que
ela falha** quando o `\r?` é removido.

Depois do conserto, contra a base real: primeiro token em **2,9 s**,
resposta completa em 3,9 s, com protocolos e números certos.

A mesma tolerância entrou na tela do assistente. Ali quem escreve o SSE
é a nossa própria rota, que usa `\n\n` — aquele lado nunca esteve
errado. Mas custa um caractere fechar a porta de vez.

### O /api/saude mentia sobre a chave da Anthropic (23/08/2026)

Ele reportava `anthropic: true` porque a chave começava com `sk-ant-` —
e o valor no `.env` é o **exemplo literal**, `sk-ant-...`, dez
caracteres. O endereço que existe justamente para dizer o que está
configurado afirmava que a Anthropic estava ligada enquanto o assistente
respondia pelo Gemini.

Agora ele pergunta ao `provedorDeIA`, que é a mesma régua que o serviço
de IA usa — o retrato e o comportamento real não têm mais como divergir.


### O leitor do WhatsApp culpava a página (23/08/2026)

A extensão dizia "achei 10 linhas por `div[data-id]`, mas nenhuma com
texto" numa conversa cheia. A frase estava errada e mandava procurar no
lugar errado: as dez linhas **tinham** texto. O que acontecia é que o
leitor as descartava antes de olhar.

O filtro era este: linha cujo `data-id` não tem `@` não é mensagem — a
ideia era tirar divisores de data e avisos do sistema, e funcionava
enquanto o id vinha como `true_5511999@c.us_ABC`. Quando o WhatsApp
mudou o formato, **todas** caíram no filtro, e o leitor anunciou como
"sem texto" um descarte que ele mesmo tinha feito.

Três mudanças:

- **O texto é extraído antes de qualquer filtro.** O filtro do id virou
  preferência: se ele deixar tudo de fora, a leitura usa o que sobrou
  sem ele. Continua valendo quando o id está no formato conhecido,
  porque é ele que tira os divisores de data.
- **O motivo diz em que degrau a leitura morreu.** "Nenhuma com texto"
  só é dito quando é verdade.
- **Uma linha pode ter mais de um `selectable-text`** — mensagem citada
  mais a resposta. Antes pegava o primeiro e devolvia a citação,
  perdendo a resposta.

E agora tem prova: `npm run check:whatsapp` roda o leitor contra seis
marcações num DOM mínimo em memória, sem navegador — inclusive a que
falhou. Este leitor já tinha quebrado três vezes sem nada que o
exercitasse; `tsc` não lê DOM alheio.

O resumo em si estava bom — o erro era só a entrada vazia. Medido depois
do conserto, com uma conversa de seis mensagens: **HTTP 200 em 4,0 s**,
com resumo, assunto, humor na régua de 1 a 5, pendência, próximo passo e
rascunho de resposta.

### A busca da tela não procurava por telefone (23/08/2026)

O campo "Buscar" olhava protocolo, título, empresa, cliente, categoria,
responsável e cidade. **Telefone não estava na lista** — nem e-mail, nem
documento. Quem atende chega com o número na mão, porque é o que o
WhatsApp mostra e o que o consumidor dita; procurar por ele não devolvia
nada, e a conclusão natural era que o caso não existia.

O telefone é comparado **em dígitos, dos dois lados**: a base guarda
`51992187321` e a pessoa digita `(51) 99218-7321`. Há um piso de quatro
dígitos, senão "5" devolveria meia base.

A regra saiu do `useMemo` do `CaseContext` para `case.service`, e é aí
que está o ponto: enquanto morava dentro do contexto, **nada podia
exercitá-la** — foi assim que ela passou meses sem procurar por telefone
sem ninguém notar. Agora `check:busca-texto` roda a mesma função que a
tela roda, com termos tirados da própria base a cada execução.

### Os telefones e e-mails estão completos (23/08/2026)

Conferido depois da carga: **127 de 127** com telefone e e-mail, zero
mascarados, zero asteriscos. O mascaramento (`maskEmail`/`maskPhone`)
existe e só age no dataset versionado do repositório, que é público para
quem tem acesso ao Git. O banco recebe o dado inteiro — é o que faz o
casamento por telefone ser exato em vez de por DDD e quatro últimos.


### A carga rodou (23/08/2026)

Números do banco depois de executar, e não da simulação:

| | |
| --- | --- |
| Reclamações | **127** (eram 336, de um export antigo e menos completo) |
| Com estabelecimento | **116** |
| Estabelecimentos | **105** |
| Clientes | **117** |
| Com relato do consumidor | 127 |
| Com telefone e e-mail | 127 |
| Com responsável | 122 |
| Com time | 71 |

**O passo que quase faltou.** O CW Engine diz *qual* restaurante está
por trás de cada reclamação, mas não diz o CPF/CNPJ dele — então os 105
cadastros nasceriam sem documento. E é o documento **do cadastro** que a
extensão consulta para ligar a próxima captura sozinha: sem ele, toda
reclamação futura cairia órfã, e o mecanismo recém-construído nunca mais
dispararia.

A pergunta do RA Forms é "CPF ou CNPJ **de cadastro no portal**" — é o
documento do estabelecimento, não o do consumidor. Então ele sobe das
reclamações para o cadastro, **e só quando elas concordam**: 102 dos 105
ganharam documento assim. Os três em que duas reclamações apontam
documentos diferentes ficam vazios de propósito e saem nomeados no
relatório — pode ser restaurante que migrou de CPF para CNPJ, e escolher
no escuro ligaria as próximas capturas ao cadastro errado, que é pior do
que não ligar nenhuma:

- Pizzaria Veneza (10042530792 / 29017436000175)
- Doce Cesta Presentes (16514223893 / 44628376816)
- Espetinhos Du Marcinho (09999723756 / 08773131725)

Carla Campos e Wesley Costa foram criadas como responsáveis pelo mesmo
caminho da tela de Times — nome, sem e-mail. Aparecem lá para serem
editadas.

Dois backups ficaram na pasta antes de cada execução, com as 336
anteriores inteiras. Estão fora do Git: trazem PII real.


### O documento deixou de ser só CNPJ (22/08/2026)

O campo que liga reclamação a estabelecimento chamava-se `cnpj` e
aceitava catorze dígitos. **A Cardápio Web cadastra restaurante por CPF
do proprietário na maioria das vezes** — 122 das 127 reclamações da base
real respondem "CPF ou CNPJ" com CPF. O vínculo funcionava para cinco
casos em cada cento.

`Case.cnpj` e `Establishment.cnpj` viraram `document`, e o helper aceita
onze ou catorze dígitos. Não foi só renomear: um campo chamado `cnpj`
guardando CPF é a espécie de mentira que custa uma hora a quem lê
depois, e o rótulo da tela ("CPF ou CNPJ") tem de bater com o que o banco
faz.

Junto vieram três coisas que só existem porque os dois formatos convivem:

- **A máscara decide pelo tamanho.** Até onze dígitos desenha CPF, dali
  em diante CNPJ. Forçar máscara de CNPJ em onze dígitos escreveria
  `12.345.678/901`, e quem digitou concluiria que errou o número.
- **A extensão aceita os dois** ao ler o RA Forms, e a pergunta que ela
  procura passou a ser "CPF **ou** CNPJ" — que é como o portal escreve.
- **Fora de onze e catorze, nada.** Campo pela metade, "não informado",
  telefone digitado no lugar errado: guardar isso criaria vínculo falso
  entre reclamações que só têm em comum o mesmo lixo no campo.

### O protocolo virou o ID do Reclame Aqui (22/08/2026)

O relatório do portal passou a trazer a coluna **ID Reclame Aqui**
(`r72QQCpOtF-sFwCZ`). É o mesmo código que aparece no fim da URL pública
e que a extensão já lia da página como **COD**.

Isso resolve um problema que estava armado para aparecer depois: o portal
dá **dois** identificadores para a mesma reclamação — um número
("ID: 256949163") e esse código. A extensão gravava pelo número, o
export traz o código. Quem capturasse pela extensão uma reclamação que a
planilha também trouxesse teria **dois casos**, e nada na tela explicaria
por quê.

Agora os dois lados usam o código. O número continua valendo onde o
código não aparece na página, e a data e hora continuam de reserva para o
relatório antigo, que não tem coluna de id nenhuma.

De quebra, o casamento com o CW Engine ganhou um degrau novo e exato: o
link público do CW Engine termina no mesmo código, depois do último
sublinhado. Ele resolve **87 das 127** sozinho, e os degraus de título e
nome — que são heurística — só recebem o que sobra.

### Responsável se cadastra só com o nome (22/08/2026)

Criar integrante exigia nome **e** e-mail. Quem cuida da operação nem
sempre é quem usa a ferramenta: Carla Campos e Wesley Costa respondem por
20 reclamações da base e não têm conta aqui.

Exigir e-mail obrigava a inventar um, e e-mail inventado é pior do que
e-mail nenhum — no dia em que a pessoa se cadastrasse de verdade, o
endereço que ela usa já estaria ocupado por uma linha que não é dela.

Agora o e-mail é opcional. Sem ele, o servidor gera um endereço
`@sem-acesso.local` — domínio reservado, que não roteia e que o
autocadastro (`@cardapioweb.com`) nunca vai colidir. A pessoa existe para
receber caso e atividade, e não entra. **O endereço interno não aparece
na tela**: o campo fica vazio, que é a verdade.

A carga do Reclame Aqui usa esse mesmo caminho, e não um especial: quem
ela cria aparece em Times para ser editado como qualquer outro.

### Regras da carga que vieram do Isaac (22/08/2026)

- **De janeiro de 2026 para trás, a responsável é a Carla.** A regra
  **vence** o CW Engine: naquele período o registro de responsável lá
  estava incompleto, e quem cuidou da fila foi ela. São 13 reclamações,
  e o relatório da carga diz quantas foram por esta regra e não pelo
  arquivo.
- **O time do caso passou a ser gravado.** `Case.teamId` existia no banco
  e `department` era lido na carga, mas nada o escrevia — nenhum caso
  chegava ao banco com time. Resolve por nome, sem criar: os nomes do CW
  Engine ("Implementacão", "Atendimento") passam por um de→para explícito
  para os desta base ("Implantação", "Suporte"), e o que não estiver no
  de→para fica sem time e sai no relatório.


### A carga completa: duas planilhas, papéis diferentes (22/08/2026)

A base do Reclame Aqui foi refeita a partir do relatório **"Previsão
para o RA1000"** — 127 reclamações, de 06/01/2026 a 30/06/2026, com o
relato inteiro, contato completo, nota, resolvida, tempos e datas.

A segunda planilha, o export do **CW Engine**, não virou base e não
podia virar: tem 563 linhas de 02/2024 a 08/2026, informação errada o
bastante para o Isaac avisar antes, e reclamações que não estão no
portal. Ela entra só para preencher o que a primeira não tem — e o que
ela tem de único é o **estabelecimento**: qual restaurante está por trás
de cada reclamação.

**Casar as duas não é direto**, e foi aí que estava o trabalho. O CW
Engine reescreve o título de parte das reclamações (viram "Acesso via
HugMe") e abrevia o nome do cliente — grava "Alex Diego" onde o portal
tem "ALEX DIEGO DA SILVA DASCANIO". Casamento por título sozinho
resolvia 106 das 127. A escada de quatro degraus, do mais seguro ao mais
tolerante, resolve **126**:

| Degrau | Acertos |
| ------ | ------- |
| Título idêntico | 106 |
| Nome + data de publicação | 8 |
| Nome abreviado, ±2 dias | 10 |
| Nome único no arquivo inteiro | 2 |
| Sem par | 1 |

O degrau do nome abreviado aceita um nome como o outro quando **todos**
os seus pedaços aparecem no outro. É o que faz "Marcos Brum" casar com
"ANTONIO MARCOS BRUM SOARES" e, na mesma data, recusar "Mariana Poças".

Resultado: **116 das 127 reclamações com estabelecimento**, em 103
restaurantes distintos. As 11 sem — 1 sem par e 10 cujo par não tinha
conta preenchida — ficam sem vínculo de propósito, para o cadastro nascer
quando a reclamação delas aparecer.

Três decisões que valem registro:

- **O protocolo sai do ID do Reclame Aqui**, não do id do CW Engine —
  ver a entrada própria, acima. Quando o relatório não traz a coluna, a
  data e hora servem de reserva.
- **Só os 103 estabelecimentos com reclamação são criados**, não os 405
  do arquivo. Plano e situação ficam em "Essencial/Ativo" com nota
  dizendo que não foram conferidos — inventar precisão que não existe
  seria pior do que o campo vazio.
- **CPF e CNPJ entram os dois** em `Case.document` — ver a entrada
  própria, acima. A primeira versão guardava só catorze dígitos e
  deixava de fora 122 das 127.

Duas coisas que estavam quebradas e apareceram no caminho:

- **A tela de importar recusava este relatório.** O leitor exigia a
  coluna "Id HugMe", que só existe no outro export do portal. Agora a
  âncora é "Data Reclamação", que os dois têm, e o id é derivado quando
  falta — pela data e hora, nunca pelo número da linha, senão reexportar
  com uma reclamação a mais deslocaria todas e duplicaria a base inteira.
- **O time do caso nunca era gravado.** `Case.teamId` existia no banco e
  `department` era lido na carga, mas nada o escrevia — nenhum caso
  chegava ao banco com time. Agora `persistCase` e a importação em lote
  resolvem o time por nome, sem criar: os nomes do CW Engine
  ("Implementacão", "Atendimento") passam por um de→para explícito para
  os desta base ("Implantação", "Suporte"), e o que não estiver no
  de→para fica sem time e sai no relatório.

Os responsáveis do CW Engine que não têm conta aqui — Carla Campos (12
casos) e Wesley Costa (6) — viram **conta histórica**: inativa, com
e-mail `@historico.local` que não existe e senha aleatória que ninguém
recebe. Sem isso a carga perderia, em silêncio, quem cuidou de cada
reclamação. Quem quiser transformar em conta de verdade troca o e-mail em
Times e roda `npm run db:password`.

A carga é destrutiva e sabe disso: `--gravar` **recusa** se não houver
um `backup-<data>.json` do dia na pasta. Sem `--gravar`, ela só simula e
imprime o relatório inteiro.


### O vínculo cliente ↔ estabelecimento, por CNPJ (22/08/2026)

A decisão que faltava era **onde gravar**. A resposta é: no caso, e por
CNPJ.

Casar por nome não funciona, e isso é medido — `check:vinculo` confere
na base a cada execução: **nenhuma das 336 reclamações tem empresa
diferente do consumidor**. O export do Reclame Aqui trata o reclamante
como a empresa, então casar por nome ligaria a reclamação ao consumidor,
não ao restaurante. É exatamente por isso que o WhatsApp mostra o
estabelecimento e a base guarda a pessoa.

O CNPJ casa. Ele está nos dois lados: o cadastro de estabelecimentos já
tinha a coluna, e o **RA Forms** — o formulário que o portal coleta antes
de publicar — traz o CNPJ de cadastro. A extensão já lia e só mostrava.

Agora:

- `Case` ganhou `cnpj` e `establishmentId`. O CNPJ é guardado **só com
  os dígitos**: o portal aceita com e sem máscara, e duas grafias do
  mesmo número nunca casariam entre si.
- A extensão grava o CNPJ ao criar o caso. Ele **não é campo editável**
  da prévia, de propósito: é identificador, não descrição — um dígito
  trocado à mão não daria erro, daria vínculo com o restaurante errado.
- `persistCase` procura o cadastro com aquele CNPJ e liga na hora. Não
  cria estabelecimento: o cadastro tem plano, MRR e responsável, e nada
  disso está na página de uma reclamação — nasceriam fichas vazias que
  ninguém pediu.
- Quem for capturado **antes** do cadastro existir fica com o CNPJ e sem
  vínculo. Duas coisas resolvem depois: salvar o estabelecimento com
  CNPJ liga na hora as reclamações que esperavam, e a rotina agendada
  varre o que sobrar. As duas são idempotentes — a segunda passada liga
  zero.
- Nenhuma das duas **desfaz** vínculo, e nenhuma toca no que uma pessoa
  decidiu. Vincular ou desvincular na tela grava `establishmentManual`
  junto, e isso trava o automático nos dois sentidos.

O segundo defeito que quase entrou: "sem vínculo" tem dois significados
que a coluna sozinha não distingue — *ainda não foi ligado* e *foi
desligado de propósito*. Sem a marca, desvincular na tela duraria até a
varredura da madrugada, que religaria pelo CNPJ. O sintoma seria "o botão
de desvincular não funciona", e ele funcionava.

O defeito que quase entrou junto, e que o `check:` pega: a planilha do
Reclame Aqui não tem CNPJ, então a reimportação semanal escrevia `null`
por ausência e apagava o vínculo. O `update` do upsert passa por
`semApagarVinculo`, que remove os dois campos quando vêm vazios; o
`create` não passa, porque ali o nulo é o valor certo.

Catorze conferências contra o banco real, em estabelecimentos
descartáveis criados e apagados pelo próprio script.

### Permissões por módulo (22/08/2026)

O card "Em breve" de `/configuracoes` virou tela. A pergunta em aberto
era papel por módulo ou permissão fina por ação, e a resposta é **por
módulo**, por três motivos concretos:

1. A operação tem três contas, e o recorte real é "quem mexe no NPS"
   contra "quem mexe no Reclame Aqui".
2. Permissão por ação apodrece: cada action nova exige alguém decidir
   onde ela entra na matriz, e quem esquece cria um buraco que só
   aparece quando alguém faz o que não devia.
3. O guard já fala em papéis. `requireRole("AGENTE")` continua igual —
   o que mudou é de onde o papel vem. Nenhuma action aprendeu
   vocabulário novo.

**Só a exceção é gravada.** Quem não tem linha em `UserModuleRole` segue
o papel da conta — mesma escolha das metas de reputação. Guardar o padrão
em toda linha congelaria uma cópia dele, e mudar o papel da pessoa
deixaria de valer onde ninguém mexeu. Escolher na tela o mesmo papel da
conta **apaga** a linha, em vez de gravar a cópia.

Onze módulos, dez arquivos de action declarando a que módulo pertencem.
Uma trava proposital: ninguém reduz o próprio acesso às Configurações —
é a porta por onde se desfaz qualquer engano da tela, e fechá-la exigiria
mexer no banco à mão.

A checagem mora no servidor. Esconder um botão não impede ninguém de
chamar a action direto.

### Planos e módulos viraram cadastro (22/08/2026)

Os valores da central de ajuda entraram — três planos e cinco módulos —
mas como **ponto de partida**, não como constante. A ressalva registrada
no roadmap era exatamente essa: preço e nome de plano envelhecem calados
dentro do sistema. Agora se edita, se cria e se desativa em
`/configuracoes/planos`, e a macro insere a tabela por `{{planos}}` e
`{{modulos}}`.

Preço em **centavos**, nunca em ponto flutuante.

Banco vazio devolve os valores de partida com id derivado da posição —
mesma regra da causa raiz e das etapas do NPS: a tela funciona antes de
qualquer cadastro, sem um caso especial dentro do formulário. Gravar o
primeiro plano materializa os outros oito, senão criar um plano novo
faria os da central de ajuda sumirem de uma vez.

### As macros que faltavam, sem o nome de ninguém (22/08/2026)

Cinco textos do WhatsApp Business entraram, ao lado dos cinco do Reclame
Aqui que já existiam. Macro agora tem **canal**, porque texto de portal
público e texto de conversa privada não se substituem: o primeiro é lido
por quem nunca falou com a gente, o segundo por quem já está falando.

O nome da atendente saiu de dentro do texto. Estava escrito ("Aqui é a
Carla") e virou `{{responsavel}}` — texto pronto com nome de pessoa
dentro só serve para quem tem aquele nome, e a pessoa seguinte manda a
mensagem assinada por outra. Os espaços em branco de nome viraram
`{{cliente}}` e o número de protocolo virou `{{protocolo}}`, pela mesma
razão.


### A dívida do `setState` em efeito foi paga (22/08/2026)

Treze formulários preenchiam os campos num `useEffect` quando o modal
abria. Funcionava, ao custo de uma renderização a mais por abertura — e
de uma janela em que o formulário já estava na tela com os campos do
registro **anterior**.

Os treze migraram: os campos nascem no `useState`, e quem abre passa
`key` e só renderiza o formulário enquanto ele estiver aberto. As duas
coisas juntas, porque a `key` sozinha não basta — com o componente
sempre montado, fechar e reabrir no mesmo registro não trocaria a `key`
e o estado velho ficaria.

Três descobertas do caminho, que não estavam no plano:

- **Alguns valores iniciais dependiam de listas calculadas.** A
  categoria da macro sai das categorias em uso; o status do caso de
  rede social sai da primeira etapa ativa. Os dois `useMemo` subiram
  para antes do estado — antes existiam para o efeito não reexecutar,
  agora existem para serem lidos uma vez.
- **O `ImpactForm` misturava `editing` com dois presets** (o caso e o
  estabelecimento de onde o modal foi aberto). Virou uma cadeia de
  `??` explícita, que é o que aquele efeito de trinta linhas dizia.
- **Sobraram dois efeitos legítimos**, e eles não são o mesmo problema:
  `PreferencesContext` e `SavedFiltersContext` leem o `localStorage` na
  montagem. No servidor ele não existe, então inicializar o estado com
  ele quebraria a hidratação — é o caso que a própria regra descreve
  como sincronizar com sistema externo. Estão marcados um a um, com o
  motivo escrito ao lado.

Com isso a regra voltou de `warn` para **`error`** no
`eslint.config.mjs`, que era o ponto: como aviso ela registrava a
dívida; como erro ela impede a próxima ocorrência de entrar sem alguém
decidir que é a exceção. `npm run lint` fecha com **0 erros e 1 aviso**
— era 20.

### A IA rápida também na extensão (22/08/2026)

A triagem é a chamada mais lenta da extensão: é a que pede julgamento, e
por isso roda no modelo maior — ~10 s contra ~1 s no menor. Nem sempre
valem os dez. Quem já leu a reclamação e só quer uma segunda opinião
prefere a resposta agora; quem vai decidir em cima dela, não.

Agora são dois botões, e **o rótulo diz o tempo**: "Ler com calma
(~10 s)" e "Ler rápido (~1 s)". A palavra "rápido" sozinha não deixa
ninguém escolher — o número, sim.

Duas coisas que fazem a escolha honesta:

- **O resultado diz por qual via veio.** A leitura rápida erra mais no
  julgamento, e quem lê precisa saber qual das duas está lendo antes de
  decidir em cima dela.
- **Depois de ler rápido, a leitura com calma fica a um clique.** O modo
  rápido serve para decidir se vale gastar os dez segundos, e isso só é
  verdade se o caminho de volta estiver ali.

A escolha vem no corpo da requisição, e não de uma configuração global:
é de quem clica, naquela reclamação. A velocidade *padrão* da instalação
continua sendo a da tela de Integrações.

### Ler a conversa do WhatsApp parou de falhar em silêncio (22/08/2026)

"Às vezes falha para ler a conversa." O leitor tinha um caminho só:
`#main` e `div[data-id]`. Quando o WhatsApp Web mexe na marcação — e ele
mexe sem avisar — o resultado era zero mensagens numa conversa cheia, e
o aviso na tela não sabia dizer se o defeito era a leitura ou a conversa.

Agora são camadas, da mais específica para a mais genérica. O container:
`#main`, depois o `data-testid` que eles usam nos testes deles, depois a
função ARIA — que é a que mais sobrevive a reestilização, porque é o que
faz o site funcionar com leitor de tela. As linhas: `data-id`,
`role="row"`, e as classes `message-in`/`message-out`. A direção segue a
mesma ideia: o prefixo `true_` do `data-id`, senão a classe, senão o
lado.

Provado em Chrome real, contra três marcações montadas para isso:

| marcação | lidas | por onde | direções |
| --- | --- | --- | --- |
| a de hoje | 3 | `div[data-id]` | cliente, nós, cliente |
| sem `#main` e sem `data-id` | **3** | `[role="row"]` | cliente, nós, cliente |
| só `data-testid` | 2 | `div[data-id]` | cliente, nós |
| conversa vazia | 0 | — | com o motivo escrito |

O leitor antigo devolvia zero na segunda — que é exatamente a falha
relatada. E o divisor de data (que também tem `data-id`, mas sem `@`)
continua sendo descartado.

Quando ainda assim não achar nada, o aviso **diz o que tentou**: "achei
4 linha(s) por `div[data-id]`, mas nenhuma com texto". Sem isso, "0
mensagens" não distingue conversa vazia de leitor quebrado — e foi essa
confusão que fez a mesma falha ser reportada três vezes.

### A velocidade da IA virou escolha de tela (22/08/2026)

Estava em variável de ambiente, o que tem dois problemas: mudar exige
deploy, e o valor fica invisível para quem usa a ferramenta. "A IA está
demorando" é reclamação da operação, e a resposta estava num arquivo que
a operação não abre.

Agora são **três perfis**, em Configurações → Integrações, cada um com o
tempo medido escrito ao lado:

| perfil | o que faz | medido |
| --- | --- | --- |
| Rápido | modelo pequeno nas duas vias | ~1 s |
| Equilibrado (padrão) | maior para decidir, menor para resumir, um correndo atrás do outro | ~10 s na triagem, ~1 s no resumo |
| Profundo | **sem corrida** — deixa o modelo pensar | até 60 s |

Três decisões que fazem a tela valer alguma coisa:

- **O botão "Conferir na prática" mede de verdade**, com o mesmo pedido
  do `npm run check:ia` para os números serem comparáveis. Escolher
  velocidade sem poder conferir é escolher no escuro — e foi o escuro
  que deixou uma instalação rodando 39 s por chamada sem ninguém saber.
  Provado no navegador: **10,6 s** no Equilibrado, **1,1 s** no Rápido,
  na mesma via.
- **Trocar de perfil reescreve o ajuste fino.** Sem isso, escolher
  "Rápido" com um prazo de 60 s deixado de um ajuste anterior entregaria
  uma tela que promete rápido e uma chamada que não é.
- **Zero na corrida é uma escolha, não um caso degenerado.** É o que o
  perfil Profundo faz: ali a pressa é o que atrapalha, e chamar um
  modelo menor no meio do caminho entregaria justamente a resposta rasa
  que se estava evitando.

A precedência é **banco > ambiente > código**: quem escolheu na tela
escolheu, e o ambiente é o padrão de quem roda sem banco. `/api/saude` e
`check:ia` passaram a reportar o que está **valendo**, e não o que o
`.env` sugere — senão os dois passariam a mentir no dia em que alguém
trocasse o perfil.

A tela também diz, quando é o caso, que a chave da Anthropic não está
preenchida: era a informação que faltava para entender por que escolher
"Anthropic" não mudava nada.

O ajuste fino continua ali para quem precisa fixar um modelo — é a saída
de emergência de quando a família se renova e um nome some do ar, que já
aconteceu uma vez (`gemini-2.0-flash`).

### O painel sumia, e não era da extensão (22/08/2026)

"Do nada a extensão buga e não dá pra abrir." O botão flutuante
continuava lá e continuava respondendo — a gaveta é que abria **fora da
tela**, em qualquer site, para sempre.

A raiz do painel era `inset: 0 0 0 auto`. Com os dois filhos
posicionados de forma absoluta, isso deixa a caixa com **largura zero**,
colada na borda direita. Enquanto tudo é ancorado ninguém percebe:
`.gatilho` e `.gaveta` se posicionam por `right`, e right:0 de uma caixa
de largura zero na borda dá no mesmo lugar. A janela solta usa `left`, e
aí a conta desanda. Medido em Chrome, janela de 1280:

| | antes (`inset: 0 0 0 auto`) | depois (`inset: 0`) |
| --- | --- | --- |
| largura da raiz | 0 | 1280 |
| botão flutuante | 18px da direita | **idêntico** |
| gaveta ancorada | left 900, largura 380 | **idêntica** |
| gaveta solta | left **2180** (fora) | left **900** (dentro) |

E como `.gaveta.solta:not(.aberta)` some por completo, e a posição fica
no `chrome.storage.sync`, bastava **um tremor de mão** no cabeçalho para
o painel desaparecer de todos os sites e não voltar. Reinstalar limpava
o storage, o que escondia a causa.

Três correções, e as duas últimas são sobre o mesmo susto: arrastar
agora exige 5px antes de soltar a gaveta do canto (o comentário sempre
prometeu isso; a implementação soltava no primeiro `pointermove`), e a
posição é reancorada quando a janela encolhe.

### A extensão empurra a página, de verdade (22/08/2026)

A preferência de empurrar existia e não funcionava justamente no site
que mais precisava. Medido em `web.whatsapp.com`: com 380px de
`margin-right` no `<html>`, o `<html>` vai para 900 e o `#app` continua
em 1280 — ele é `position: absolute` com `inset: 0`, então o bloco que o
contém é a **viewport**, não o `<html>`.

Agora o empurrão faz as duas coisas: a margem no raiz, que resolve site
de fluxo normal, e uma varredura que acha quem está preso à viewport
ocupando-a inteira e dá largura própria a cada um. É medição em vez de
lista de sites — um portal que renomeie a `div` amanhã continua sendo
empurrado. A varredura desce a árvore só por dentro de quem ocupa a tela
toda (no WhatsApp o `#app` é **neto** do `<body>`, e uma varredura de um
nível voltava de mãos vazias) e custou 1,72 ms na página real.

### A IA parou de demorar (22/08/2026)

"Demora muito" tinha número: `npm run check:ia` levava **39 segundos**
para um pedido de 40 tokens de entrada e 21 de saída. Não era rede — era
fila.

Medido no mesmo minuto, com o mesmo pedido:

| modelo | tempo | raciocínio |
| --- | --- | --- |
| `gemini-flash-latest` (o que estava em uso) | estourou 35 s, três vezes | — |
| `gemini-3.6-flash` | 10,4 s | 616 tokens |
| `gemini-flash-lite-latest` | 0,98 s | 0 |

O apelido é o congestionado, porque concentra a demanda de todo mundo
que não fixou versão — e ele era o **principal**, com a versão fixa
apenas como reserva depois de 30 segundos de espera. Somava-se prazo
onde dava para sobrepor.

Três mudanças: a ordem se inverteu (versão fixa na frente, apelido como
rede contra o 404 que só ele nunca tem); a reserva agora parte **em
paralelo** depois de 6 segundos, e vale quem chegar bem primeiro; e
quem só precisa de rapidez pede `rapido: true` e cai no modelo pequeno —
é o caso do "Resumir conversa", que roda com o cliente na linha.

O assistente em fluxo ganhou prazo para **começar** a responder.
Streaming esconde lentidão de um jeito perverso: a conexão abre, o
cursor pisca, e o modelo está numa fila do outro lado. Não havia prazo
nenhum ali. Se o primeiro pedaço não chega, a chamada é refeita no
modelo menor — e como nada tinha sido escrito, a troca é invisível.

`check:ia` agora imprime o tempo, e mede as duas vias. Depois: **5,6 s**.

### O FAQ do portal entrava no relato (22/08/2026)

A prévia de importação chegava com as dúvidas frequentes do Reclame
Aqui coladas no fim do que o consumidor escreveu. O leitor do relato
parava numa lista de seções conhecidas — "Reações", "Resposta da
empresa" — e, não achando nenhuma, seguia até o fim do documento. A
página continua depois da reclamação, com ajuda e reclamações parecidas,
e nada disso estava na lista.

Duas travas agora, porque uma lista de nomes envelhece: a lista cresceu,
e ao lado dela entrou uma regra de **forma** — título de bloco é curto,
começa com maiúscula e não termina em ponto, enquanto quem reclama
escreve frases. A segunda só vale depois de o relato ter substância, para
não comer a primeira linha de uma reclamação curta.

`check:ra` ganhou a página com rodapé (uma versão com seção conhecida,
outra com nome inventado) e uma reclamação de uma linha só. As três
conferem.

### A importação do NPS voltou a caber numa requisição (22/08/2026)

"A integração dá erro na hora." O caminho de gravação estava certo — a
prova é que rodá-lo por fora trouxe as **79 respostas** que faltavam, e
a base foi de 789 para 868. O que quebrava era o relógio da plataforma:
a rodada lia da API do Wootric de 50 em 50 e gravava tudo numa server
action só, e a Vercel cortava a requisição no meio. O sintoma não dizia
nada disso — um erro de rede genérico, que parece integração quebrada.

Agora cada rodada processa um punhado e diz de onde continuar
(`parcial` / `proximoDesde`); a tela repete até acabar, mostrando o
progresso. E `app/nps/layout.tsx` existe só para dar `maxDuration = 60`
às server actions daquela rota.

### Etapas e tipos do NPS viraram cadastro (22/08/2026)

As quatro colunas do quadro e os sete tipos do guia eram listas fixas no
código. Agora são `NpsStage` e `NpsKind`, editáveis em **Etapas e
tipos** na tela do NPS — com rascunho e botão Salvar, como o resto dos
cadastros.

Os três cuidados que estavam anotados, e como cada um foi resolvido:

- **Etapa final não é igual às outras.** O que define encerramento é o
  prefixo `[Encerrado]`, lido por `isEncerrado()` — função pura sobre o
  texto do status, usada no cartão do quadro, no filtro da tela, na fila
  da extensão e no indicador de resolução, em lugares que não têm banco
  à mão. Fazer a etapa "dizer se encerra" por uma coluna criaria duas
  verdades. Então o campo `final` é o que a pessoa marca, e a gravação
  **normaliza o nome** para carregar o prefixo. Uma verdade só, e a
  antiga.
- **Etapa final precisa dizer quem chega nela.** `KINDS[].finais` foi
  invertido: quem guarda a relação agora é a etapa, porque é ela que se
  cria numa tela nova — e quem a cria escolhe ali mesmo os tipos. Sem
  isso a etapa nasce inalcançável.
- **A extensão sobe pela mesma escada.** A lista vem do servidor
  (`etapasNps` no contexto e na fila) em vez de uma cópia no arquivo, e
  a rota de mover lê o cadastro. As duas pontas não podem discordar
  sobre qual é o próximo passo.

Dois campos entraram no tipo por causa do mesmo raciocínio: `exige causa
raiz` e `abre revisão de processo` eram nomes escritos dentro do
`checklist()` e do `gerarRevisaoDeProcesso`. Com o tipo virando
cadastro, nome fixo em código volta a ser o defeito que o cadastro
existe para tirar.

`npm run check:nps-etapas` prova 26 conferências contra o banco real,
num cadastro descartável: o prefixo normaliza nos dois sentidos,
renomear a etapa arrasta os ciclos, renomear o tipo arrasta os ciclos
**e** as etapas finais que o listavam, e etapa em uso é desativada em
vez de apagada.

### A aba de Atividades (22/08/2026)

O que está marcado, ligado à agenda da aplicação: o que é de hoje, o que
ficou para trás, o que vem pela frente — e o caso vinculado a um clique.

Separada do Painel porque ali a agenda divide espaço com a nota, os
contadores e os alertas: cabem as de hoje e nada mais. A pergunta que
esta lista responde não é "como estamos", é "o que eu faço agora".

`/api/extensao/agenda` ganhou o recorte (`escopo`) e as contagens dos
três — a contagem de atrasadas é feita **no banco**, e não sobre a lista
devolvida, senão o chip que existe para chamar de volta quem se
distraiu diria que não há nada justamente quando o recorte aberto fosse
"próximas".

**Horário na atividade.** A coluna sempre existiu (`AgendaTask.time`) e
a tela sempre soube mostrá-la; quem marcava pela extensão é que não
tinha onde digitar. "Ligar amanhã" e "ligar amanhã às 9h" são
compromissos diferentes. A hora entra também no `dueDate`, porque a
agenda ordena por ele — e é validada contra `HH:MM` no servidor, já que
o corpo é escrito por um script que roda dentro de página alheia.

### Os contadores do painel abrem a lista (22/08/2026)

"Dá também a possibilidade de verificar as reclamações em aberto." Os
quatro números do painel do dia — abertos, sem resposta, réplicas,
risco — eram leitura morta: a pergunta seguinte de quem lê "4 sem
resposta" é sempre *quais?*, e a resposta exigia abrir a aplicação em
outra aba.

Cada um virou botão e abre o mesmo recorte em `/api/extensao/fila`, com
a **mesma conta dos dois lados**: `check:extensao` confere que o número
clicado e o tamanho da lista batem (19/18/1/0 na última rodada). Um
painel que se contradiz ensina a desconfiar dele.

`risco` passou a exigir o caso estar aberto. Contava também os
encerrados — caso encerrado em risco de churn não é trabalho de
ninguém, era um número que só crescia.

### A rotina agendada (22/08/2026)

Três coisas dependiam de existir alguém rodando sem ninguém com a tela
aberta, e as três estavam quebradas de um jeito que parecia
funcionamento:

1. **O encerramento automático do NPS** só era avaliado quando alguém
   abria o `/nps`. Numa semana sem ninguém abrir, o indicador contava
   como aberto o que já tinha morrido de velho. A primeira rodada real
   encerrou **29 ciclos** parados havia mais de 30 dias.
2. **`movimentacao.atrasada`** não existia porque atraso não é gravação:
   os outros dois webhooks nascem de alguém salvar um caso, este nasce
   do relógio passar.
3. **O reenvio de webhook** não acontecia. Quem recebe estava fora do ar
   por dez minutos perdia o evento para sempre.

`app/api/cron/route.ts`, agendada em `vercel.json` para as 6h,
protegida por `CRON_SECRET` ou `API_TOKEN` — sem nenhum dos dois ela
responde 503 e fica **desligada, não aberta**.

**É idempotente, e isso é a metade que importa.** Cron falha e é
reexecutado. O aviso de atraso carimba `lateNotifiedAt` (mesmo sem
webhook configurado, para ligar a integração amanhã não disparar um lote
sobre atrasos velhos) e o reenvio manda o **mesmo corpo** da tentativa
que falhou, guardado só na falha. `check:cron` roda duas vezes e confere
que a segunda não encerra nada de novo nem reescreve a data de
encerramento — que é o que sustenta o tempo médio de resolução.

### Tela de análise do NPS (22/08/2026)

`/nps/analise`. A tela do `/nps` responde "o que fazer agora"; esta
responde a pergunta da reunião: **está melhorando?** E, se não, por causa
de quê.

Três leituras, na ordem em que a conversa acontece: a tendência (com o
volume ao lado, porque um NPS que sobe com um terço das respostas do mês
anterior não subiu — mudou de amostra), a causa raiz (com o aviso de
quantas respostas têm comentário e nenhuma causa marcada, que são
justamente as que teriam algo a dizer) e a régua de humor, que é o único
indicador que mede se o atendimento moveu a agulha.

A escala do gráfico é fixa de −100 a 100 de propósito: apertada ao redor
dos valores, três pontos de variação parecem um despencar.

### Importar NPS por planilha (22/08/2026)

O Reclame Aqui já entrava assim; o NPS só entrava pela API do Wootric, e
isso deixava de fora a pesquisa que roda fora dele, o histórico anterior
à integração e a correção em massa — exportar, arrumar e devolver.

As colunas são reconhecidas **pelo nome**, com sinônimos, e não pela
posição: planilha de operação sempre chega com uma coluna a mais no
meio. O cabeçalho é procurado, não assumido na primeira linha.

Duas decisões que fazem o recurso valer:

- **Linha ruim não derruba o arquivo.** Uma célula de texto na coluna de
  nota é o erro mais comum de planilha montada à mão, e recusar as 800
  linhas por causa de uma devolve o problema para quem não sabe qual
  corrigir. Cada descarte volta com o número da linha e o motivo.
- **Reimportar não duplica e não desfaz tratativa.** Sem id na planilha,
  a identidade é quem + quando + quanto, com prefixo próprio para não
  colidir com os ids numéricos do Wootric. Status, responsável,
  tentativas e pós-contato ficam intactos.

`check:nps-planilha` monta os arquivos em memória e prova os dois
formatos, a estabilidade da chave e os cinco motivos de descarte.

### Botão Salvar nas telas restantes (22/08/2026)

As nove que faltavam, e elas não eram o mesmo problema:

**Cinco gravavam a cada tecla** e viraram rascunho com `BarraDeSalvar`:
a tela do caso (a pior — escrever a resposta pública virava centenas de
gravações), tipos de impacto, tópicos da jornada, etapas do quadro do
Reclame Aqui (arrastar uma coluna reescrevia a ordem de **todas**) e
causa raiz do NPS.

**Três gravavam por ato fechado e em silêncio** — vincular
estabelecimento, etiquetar cliente, vincular reclamação, salvar filtro.
Ali o que faltava não era o botão, era a confirmação: só a falha
aparecia. Ganharam aviso do que aconteceu, inclusive o desfecho mais
fácil de não perceber, que é sobrescrever um filtro de mesmo nome.

**Uma já estava certa:** `GoogleCalendarCard` sempre teve modal com
Salvar e confirmação em criar, editar, excluir e desconectar. Ficou como
está.

### Anotações são uma lista só (21/08/2026)

A tela do caso chamava de "Comentários internos" e guardava tudo num
`useState([])` — **não gravava nada**. O que se escrevia ali sumia no
recarregamento, e o que a extensão gravava nunca aparecia. Eram dois
históricos paralelos do mesmo atendimento, e nenhum contava a história
inteira. Mesma família de defeito de Times, Metas e Clientes: o valor
aparece na tela e não existe no banco.

Agora as duas pontas leem e escrevem `CaseComment`
(`lib/actions/notes.ts` e `app/api/extensao/anotar/`), e o nome na tela
é **Anotações**. O autor vem da sessão nos dois lados — otimismo local
mostraria "Operação" no lugar de quem realmente anotou.

### Criar responsável (21/08/2026)

Não existia, e a causa era estrutural: `Case.ownerId` é relação com
`User`, então **quem não tinha conta era descartado em silêncio** — e
`assignTeamMember` recusava com "a pessoa precisa se cadastrar antes de
entrar no time". Quem cuida da operação nem sempre é quem usa a
ferramenta.

A pessoa passa a nascer **sem senha**. `passwordHash` vazio não é senha
em branco: o login exige hash bcrypt válido (`isBcryptHash`) e recusa
qualquer outra coisa. Ela existe para receber caso e tarefa e não entra
até se cadastrar — e quando o fizer, o autocadastro **adota a mesma
linha**, preservando tudo que já estava no nome dela.

### A versão exibida saiu do papel (21/08/2026)

Estava escrita à mão como "1.0.0" na barra lateral e em Configurações,
enquanto o `package.json` já ia em 0.7.0. Número de versão que não
acompanha o que está no ar é pior do que nenhum — alguém olha, acredita
e conclui a coisa errada sobre o que a instalação tem. Agora sai do
`package.json` via `NEXT_PUBLIC_VERSAO`, definido no `next.config.ts`.


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
