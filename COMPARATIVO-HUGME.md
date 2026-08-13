# Hugme × CW Reputação

Comparativo para sustentar a decisão de manter as duas ferramentas ou
substituir uma pela outra.

**Como ler.** O que está em "verificado" foi conferido contra dados
reais durante o desenvolvimento. O que está em "a confirmar" depende de
informação contratual ou de uso que não sai do código — vale checar
antes de levar a decisão adiante.

---

## O ponto de partida

O Hugme é a ferramenta oficial do Reclame Aqui para empresas. É por ela
que a operação hoje enxerga e responde as reclamações. O CW Reputação
nasceu depois, a partir do export do Hugme (`4721_dados-do-reclame-
aqui_*.xlsx`, 327 reclamações de fev/2024 a ago/2026).

A pergunta prática não é "qual é melhor", é **onde cada uma é
insubstituível**.

---

## O que o Hugme faz e o CW Reputação não faz

### Integração oficial com o portal (verificado)

Não existe API pública do Reclame Aqui. O CW Reputação só conhece as
reclamações que alguém exporta e importa
(`scripts/import-reclame-aqui.js`). Consequências diretas:

- **Defasagem.** O dado tem a idade do último export.
- **Passo manual.** Alguém precisa exportar e rodar o importador.
- **PII em trânsito.** O export carrega nome, CPF, e-mail e telefone
  reais; o importador mascara contato e descarta CPF justamente porque
  `lib/data/` é versionado.

### Responder o consumidor (verificado)

O CW Reputação **não publica resposta no portal**. Tem o campo de
resposta pública, usa como base de cálculo do índice de resposta e serve
para preparar o texto — mas a publicação acontece no Hugme. Isso sozinho
já impede a substituição pura e simples.

### Custo de manutenção (a confirmar)

O Hugme é produto de terceiro: sobe sozinho, tem suporte e acompanha
mudanças do portal. O CW Reputação é código da casa — cada mudança de
regra do Reclame Aqui vira trabalho de desenvolvimento aqui dentro.

---

## O que o CW Reputação faz e o Hugme não faz

### Simular a janela futura (verificado)

A calculadora do Hugme só projeta a janela vigente. Aqui,
`getRange(period, mode)` faz as duas: em 05/08/2026 a vigente é
01/02–31/07 e a próxima é 01/03–31/08. Dá para ver **hoje** o que a nota
vira no mês que vem, e quantas avaliações faltam para mudar de faixa
(`evaluationsToReach`). É o diferencial mais concreto.

### A nota, com a memória de cálculo aberta (verificado)

A fórmula oficial está implementada — `AR = ((IR × 2) + (MA × 10 × 3) +
(IS × 3) + (IN × 2)) / 100` — e **bate com o painel real do Hugme nas
duas janelas testadas**: 6 meses → 8,5 com selo RA1000; 12 meses → 8,4
Ótimo, com todos os contadores iguais (129/121/78 e 212/204/138, tempo
médio 19d17h e 14d11h). A diferença é que aqui a composição fica
visível: quanto cada indicador contribuiu e o que falta para a meta.

Um cuidado que vale citar: indicador **sem base é excluído e o peso
redistribuído**, em vez de contar como zero. Indicador faltando não pode
derrubar a nota por falta de dado.

### Gestão, que é o que o Hugme não se propõe a fazer

- **SLA por caso** (categoria × prioridade) e **SLA de movimentação
  interna** — o prazo de retorno de Adoção, Suporte, Fiscal ou do próprio
  cliente, que é onde a tratativa realmente trava.
- **Teto de tempo médio por categoria**, transformando "19 dias e 17
  horas" de dado em meta.
- **Impacto no negócio** — receita preservada e gerada, ligada ao caso.
- **Separação cliente × estabelecimento**, que o export não traz e é
  essencial no modelo da Cardápio Web.
- Kanban, filtros salvos, agenda, jornada, base de conhecimento com
  macros, assistente de IA sobre os dados da operação.
- **API própria** (`/api/reputacao` e `/api/casos`) para outros sistemas
  da casa lerem os indicadores.

---

## Onde os dois se sobrepõem

Listar reclamações, filtrar, ver a nota e os quatro indicadores. Nessa
faixa a escolha é de conveniência, não de capacidade.

---

## Leitura honesta

Hoje **são complementares, não concorrentes**:

- O Hugme é o canal com o portal. Enquanto não houver API oficial do
  Reclame Aqui, ele é insubstituível para **receber e responder**.
- O CW Reputação é a camada de gestão: analisa, projeta, cobra prazo
  interno, mede impacto e conversa com os outros sistemas da Cardápio Web.

**Substituir o Hugme só entra em discussão** se o Reclame Aqui abrir
integração oficial, ou se a operação aceitar responder direto no portal
e usar o CW Reputação como sistema de registro — o que reintroduz o
trabalho manual que o Hugme resolve.

**O risco real do CW Reputação não é funcional, é operacional:** ele
depende de alguém exportar e importar. Automatizar essa ponte (ou trocar
por integração, se surgir) é o que decide se ele vira ferramenta de
rotina ou relatório ocasional.

---

## Para fechar a comparação

Itens que dependem de você, não do código:

1. Custo do Hugme hoje, e o que exatamente está no contrato.
2. Quem responde as reclamações e quanto tempo gasta nisso.
3. Se o Reclame Aqui oferece alguma integração para o plano contratado.
4. Quantas pessoas usam o Hugme além da Reputação.
