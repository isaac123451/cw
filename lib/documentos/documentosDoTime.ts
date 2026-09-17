/**
 * Os nove documentos do time de Reputação (responsável: Thais Portela,
 * última atualização: agosto/2026), para importar na Documentação.
 *
 * O texto é o dos documentos, com as linhas que o PDF quebrou religadas e
 * as tabelas refeitas em markdown — sem reescrever regra nenhuma. Depois
 * de importados eles vivem no banco e se editam na própria plataforma;
 * este arquivo é só o ponto de partida da importação.
 */

export const ORIGEM_DOS_DOCUMENTOS = "documentos-agosto-2026";
export const RESPONSAVEL_DOS_DOCUMENTOS = "Thais Portela";
export const VERSAO_DOS_DOCUMENTOS = "Agosto/2026";

export interface DocumentoDoTime {
  slug: string;
  titulo: string;
  escopo: string;
  resumo: string;
  conteudo: string;
}

export const DOCUMENTOS_DO_TIME: DocumentoDoTime[] = [
  {
    slug: "cintcw-entendendo-a-reputacao",
    titulo: "Entendendo a Reputação Cardápio Web",
    escopo: "Reputação",
    resumo: "O que é reputação, por que ela importa e o papel de cada um — os quatro canais que a formam e os valores por trás de cada atendimento.",
    conteudo: `## 🧭 O que é reputação?

Reputação é a forma como nossos clientes e o mercado nos enxergam. Ela é construída pela soma de tudo o que fazemos: a qualidade do nosso atendimento, a forma como resolvemos os problemas e o cuidado presente em cada interação. Não é um número isolado nem uma métrica de um único canal, é a percepção acumulada que orienta se um cliente confia, permanece e nos indica.

Isso não é um tema à parte da nossa estratégia, é parte dela. O nosso Memorando é direto: "nosso crescimento de longo prazo depende de reputação, indicação e autoridade. Queremos clientes que defendam a marca, indiquem espontaneamente e participem do ecossistema." Cada contato que atendemos, um loop de NPS fechado, uma resposta no Reclame Aqui, um comentário nas redes sociais, é onde essa parte da estratégia acontece na prática.

## 💡 Por que a reputação importa

- **Clientes satisfeitos confiam e indicam:** nós tratamos isso como métrica estratégica, não apenas como consequência de um bom atendimento: "buscamos encantar nossos clientes e torná-los nossos promotores, para manter crescimento rápido no longo prazo."
- **Clientes insatisfeitos, quando mal atendidos, tornam-se públicos:** uma crítica não resolvida raramente fica só entre as partes; ela pesa na decisão de novos clientes e, como queremos ser "built to last", protegemos essa confiança como um ativo inegociável.
- **Reputação sólida sustenta a nossa visão de 2040:** ser o e-commerce dos restaurantes do mundo depende de escala, e escala depende de indicação. Não existe "ser o hub do setor" sem sermos, antes, confiáveis para quem já é nosso cliente.

## 📡 Canais que impactam nossa reputação

### 💬 Reclame Aqui (RA)

Canal onde o cliente relata publicamente reclamações e problemas. Aqui, o nosso valor de ownership ("fazemos o que precisa ser feito") se aplica diretamente: se o caso impacta o cliente ou a empresa, agimos, mesmo quando a causa raiz não é da nossa área, o caso continua sob nossa responsabilidade até o fim.

### 📱 Redes sociais

Comentários, mensagens diretas e menções mostram, em tempo real, como a nossa marca está sendo percebida. Manter o cliente informado mesmo sem novidade, em vez de deixá-lo no silêncio, é aplicação direta do nosso valor de comprometimento: "cumprimos o que prometemos."

### 📊 NPS (Net Promoter Score)

Termômetro direto da satisfação do cliente e da probabilidade do cliente nos recomendar. Nosso próprio playbook cita o NPS nominalmente como métrica estratégica de encantamento: cada loop fechado é uma chance concreta de transformar um cliente em promotor, não só de resolver um chamado.

### ⭐ Avaliações do Google

Feedback público e de fácil acesso, que influencia diretamente a decisão de novos clientes antes mesmo do primeiro contato. É aqui que o nosso valor de excelência ("nos importamos com as pequenas coisas") mais se mostra: uma resposta mal escrita ou um comentário sem retorno pesa tanto quanto um erro operacional grande.

## 🤝 Nosso papel na reputação

Cuidar da reputação, na prática, significa:

- Ouvir com atenção real, não só para responder, expressão direta de cuidamos dos nossos;
- Responder com clareza e empatia;
- Resolver o problema sempre que estiver ao nosso alcance, postura de dono, não de quem espera o cenário ideal;
- Registrar cada interação para manter o histórico do cliente atualizado, sustenta o nosso valor de aprendizado: transformamos cada caso encerrado em conhecimento reaproveitável;
- Transformar feedbacks em melhorias contínuas de processo e produto.

### Para quem está começando

Pense na reputação como o nosso cartão de visitas. Cada atendimento, cada resposta, cada solução entregue contribui para a imagem que os clientes constroem de nós, inclusive antes de entrarem em contato conosco.

### Para quem já conhece o processo

Reputação não é só resolver problemas, é como somos percebidos ao longo de toda a jornada do cliente. Cada devolutiva de NPS, cada caso encerrado no RA e cada interação nas redes sociais é uma chance de reforçar confiança e credibilidade, não apenas de "fechar o ticket". É a área onde a nossa missão de "construir um mercado de food melhor para todos" se prova, um cliente de cada vez.

## 📌 Resumo

Cuidar da reputação é responsabilidade de todos nós. Ouvir, responder, solucionar e registrar com atenção e empatia fortalece a nossa imagem, sustenta o nosso crescimento e fideliza clientes, e é, também, um dos pilares declarados da nossa estratégia como empresa.`,
  },
  {
    slug: "cintcw-rotina-do-agente",
    titulo: "Gestão de Rotinas — Acompanhamento do Agente de Reputação",
    escopo: "Rotina",
    resumo: "As atividades diárias, semanais e contínuas do agente de Reputação, com a ordem de prioridade entre as frentes em dias de volume alto.",
    conteudo: `**Objetivo:** Padronizar as atividades diárias, semanais e por ciclo do agente de Reputação, garantindo acompanhamento consistente dos indicadores (Reclame Aqui, NPS, Redes Sociais e Google Avaliações).

## 🗓️ Rotina Diária

### Priorização de Tratativas

Em cenários de alto volume de chamados, adote a seguinte ordem de prioridade para a gestão de casos:

1. **Reclame Aqui:** Prioridade máxima pelo impacto direto nos índices de reputação, selo RA1000 e alta visibilidade pública.
2. **Redes Sociais:** Alta prioridade devido ao risco de exposição de marca, potencial de viralização e velocidade de resposta exigida.
3. **NPS:** Prioridade intermediária, focada na retenção, reversão de detratores e identificação de detratores críticos na base ativa, após isso seguir para neutros e detratores.
4. **Google Avaliações:** Prioridade de acompanhamento contínuo para manter a nota local e a imagem da marca em pesquisas de busca.

| # | Atividade | Categoria |
| --- | --- | --- |
| 1 | Preencher dados da Planilha de Métricas Reputação | Operacional |
| 2 | Verificar atividades e pendências do dia | Organização |
| 3 | Verificar andamento dos casos em aberto e realizar retorno com o cliente de acordo com tratativa documentada (Reclame Aqui/Redes Sociais/NPS/Google Avaliações) | Operacional |
| 4 | Verificar novos casos e iniciar atendimento (Reclame Aqui/Redes Sociais/NPS/Google Avaliações) | Operacional |
| 5 | FUPs com clientes com ausência de retorno (Reclame Aqui/Redes Sociais/NPS/Google Avaliações) | Operacional |
| 6 | Solicitar e acompanhar moderações caso necessário | Operacional |
| 7 | Entrar em contato com clientes para solicitar avaliação de Reclamações já respondidas | Operacional |
| 8 | Ligar para clientes sem retorno de acordo com as tentativas documentadas (Reclame Aqui/Redes Sociais/NPS/Google Avaliações) | Operacional |
| 9 | Registrar e atualizar casos concluídos nas ferramentas documentadas (Reclame Aqui/Redes Sociais/NPS/Google Avaliações) | Operacional |
| 10 | Verificar/Cobrar solicitações em andamento para demais setores | Demandas Internas |
| 11 | Checkpoint diário com a gestão | Gestão |

## 📆 Rotina Semanal

| # | Atividade |
| --- | --- |
| 1 | Analisar indicadores das áreas de reputação, identificar oportunidades e realizar projeções |
| 2 | Criação de relatório semanal: ao final de cada ciclo, o agente envia à gestão o Relatório de Reputação destacando os pontos de atenção da área e as metas do período. O documento consolida o acompanhamento dos indicadores de NPS e Reclame Aqui, apresentando as projeções para alcançar o selo RA1000. |
| 3 | Alterar/Sugerir processos que impactem a experiência do cliente |
| 4 | Atuar com demandas paralelas ligada a Sprint |

## 🔄 Rotina Contínua (conforme demanda)

| # | Atividade |
| --- | --- |
| 1 | Criar e revisitar processos do time |
| 2 | Documentar iniciativas que impactam a experiência do cliente e do time |
| 3 | Elaboração de Dossiês de Atendimento/Jornada |

Esse documento é apenas um guia, conforme a necessidade da marca e da operação essas demandas podem ser alteradas, assim como sua ordem de prioridade, nesses casos sempre seguir orientações da gestão.`,
  },
  {
    slug: "cintcw-reclame-aqui",
    titulo: "Reclame Aqui",
    escopo: "Reclame Aqui",
    resumo: "Comunicação, criticidade e SLA, os oito passos da tratativa, o acionamento das áreas internas, a finalização e os indicadores do Reclame Aqui.",
    conteudo: `## Objetivo

O objetivo central de toda essa documentação é padronizar, orientar e dar segurança ao agente de reputação no atendimento e na gestão de reclamações (especialmente do Reclame Aqui), garantindo que a recuperação de clientes seja feita de forma justa, sustentável e eficiente.

Em suma, a documentação serve para:

- **Manter a Reputação em Alta:** Garantir que o atendimento atinja as métricas necessárias (taxa de resposta, índice de solução e nota do consumidor) para preservar ou conquistar os selos de reputação da marca.
- **Proteger a Saúde Financeira:** Estabelecer regras, limites de autonomia e fórmulas exatas de cálculo (como o estorno proporcional com desconto de 30% e a aprovação formal da gestão/diretoria) para evitar concessões desordenadas.
- **Garantir Consistência Operacional:** Guiar o agente passo a passo sobre como analisar a causa raiz do problema, identificar a criticidade do caso e aplicar a oferta ou negociação correta.

## 1. Diretrizes de Comunicação: Humanização, Rapport e Contato Constante

O Reclame Aqui é muito mais do que um canal de resolução de problemas: é a nossa oportunidade de reatar relacionamentos, demonstrar compromisso e recuperar a confiança do cliente.

### 🚨 Regra de Ouro: Sem Macros Prontas ou Textos Robotizados

- **Atendimento Autêntico e Personalizado:** Esqueça respostas padronizadas, mensagens prontas ou linguagem corporativa fria. Cada cliente vivenciou um problema único e deve ser atendido de forma individual.
- **Construção de Rapport:** Leia com atenção o histórico, o momento do cliente e o motivo do descontentamento. Adapte o tom de voz para demonstrar acolhimento real, chamando-o pelo nome e validando seus sentimentos ("Entendo perfeitamente sua frustração e vou cuidar disso pessoalmente com você").
- **Ligações:** Ligue sempre que quiser criar uma conexão real e fazer o cliente se sentir único, mas solicite a chamada depois de estudar todo o histórico e garantir que estará pronto para todas as perguntas. Na maior parte das vezes o cliente só quer se sentir escutado.
- **Escuta Ativa e Empatia:** O cliente precisa sentir que foi ouvido e levado a sério antes mesmo de qualquer solução técnica ou financeira.
- **Contato Constante e Acompanhamento Ativo:** O agente de reputação é o dono do caso do início ao fim. Mantenha o cliente informado em cada etapa do processo. Não deixe o cliente no "vácuo" enquanto aguarda a tratativa de áreas internas.

## 2. Prazos e Classificação de Criticidade (SLA)

A classificação do caso define a urgência de ação e o ritmo do acompanhamento constante:

| Prioridade | Critérios de Criticidade (Exemplos) | Meta de 1º Contato | SLA de Solução Alvo |
| --- | --- | --- | --- |
| 🔴 Urgente | Risco jurídico/regulatório; grande exposição pública/viralização; operação do cliente totalmente paralisada; cliente estratégico/alto ticket; reincidência de erro; risco concreto de cancelamento. | Até 4h úteis | 24h a 48h |
| 🟠 Alta | Impacto financeiro direto (cobrança indevida, erro de valores); funcionalidade crítica indisponível; prazo previamente combinado não cumprido. | Até 24h úteis | 3 a 5 dias úteis |
| 🟢 Normal | Dúvidas operacionais do sistema; solicitações de informação; reclamações sem impacto operacional imediato. | Até 48h úteis | Até 7 dias úteis |

## FASE 1: DIAGNÓSTICO & INVESTIGAÇÃO CONTEXTUAL

### Passo 1: Recebimento e Notificação

- Assim que a manifestação for publicada no Reclame Aqui, o agente de reputação é notificado no email, e a reclamação aparece no painel principal da empresa.
- Registre a ocorrência nos sistemas de controle interno.

### Passo 2: Imersão no Histórico do Cliente (Antes do 1º Contato)

Antes de enviar qualquer mensagem, investigue a fundo quem é o cliente e o que ele enfrentou:

- **Identificação:** Localize a conta no sistema interno da Cardápio Web.
- **Contexto Operacional:** Em qual fase o cliente está? (Implantação, uso ativo, solicitação de cancelamento, etc.).
- **Jornada de Atendimento:** Verifique se ele já abriu chamados no suporte, se passou por falhas de comunicação ou se teve experiências negativas anteriores.

## FASE 2: CONEXÃO, RAPPORT E RESOLUÇÃO ATIVA

### Passo 3: Primeiro Contato Humanizado (Preferencialmente WhatsApp / Telefone)

- **Objetivo:** Iniciar a tratativa demonstrando acolhimento, apresentando-se como o responsável exclusivo pela resolução do problema.
- **Condução:** Inicie a conversa de forma calorosa e pessoal. Diga quem você é, confirme que compreendeu o ponto trazido e assuma a responsabilidade de ajudá-lo. Evite formulários frios: faça perguntas abertas e demonstre interesse genuíno pela operação do cliente.

### Passo 4: Gestão de Exceções e Persistência no Contato

Caso o cliente não responda ou não possua WhatsApp ativo:

1. **Tentativa Telefônica Exclusiva:** Faça uma ligação direta imediata para criar conexão por voz.
2. **Ciclo de Persistência:** Realize até 5 tentativas de ligação em horários variados todos os dias (distribuídas em 7 dias). Complemente com e-mails personalizados e formais.
3. **Mensagem Pública Transparente:** Caso fique sem retorno, publique no Reclame Aqui uma mensagem cordial, explicando que tentou contato por telefone e canais privados, reforçando a prontidão em ajudá-lo assim que ele puder retornar.
4. **Follow-up Periódico:** Mantenha contato constante de acompanhamento a cada 2 dias enquanto aguarda retorno.

### Passo 5: Resolução Interna com Acompanhamento sem Ruídos

- **Resolução Guiada:** Acione os times internos (Suporte N2, Financeiro, Comercial, Desenvolvimento).
- **Evite Reassinalar o Cliente:** O agente de reputação conduz a tratativa ponta a ponta. Não repasse o cliente para outros setores para evitar atrito e retrabalho.
- **Transparência e Status constante:** Caso a solução demore, envie atualizações periódicas ao cliente ("Oi, [Nome], estou passando para te avisar que o time de tecnologia já está analisando o seu caso e volto a te chamar até às 15h").

## FASE 3: VALIDAÇÃO, AVALIAÇÃO E ENCERRAMENTO

### Passo 6: Validação de Satisfação e Construção do Compromisso

- Após a tratativa, entre em contato para confirmar se tudo voltou a funcionar perfeitamente e se não restaram dúvidas ou pendências.
- Quando o cliente confirmar satisfeito que o problema foi superado, reforce a parceria e explique de forma transparente como a avaliação dele na plataforma é fundamental para o seu trabalho individual e para a evolução da Cardápio Web.

### Passo 7: Resposta Pública

- **Regra Importante:** Só publique a resposta oficial no Reclame Aqui após a confirmação e validação prévia com o cliente.
- **Conteúdo:** Redija um texto exclusivo para o caso, agradecendo pelo diálogo e confirmando a resolução.
- **Sigilo e LGPD:** Nunca inclua dados pessoais (CPF, e-mail, telefone, valores exatos de contratos) na mensagem pública, ou qualquer política interna e resolução repassada.

### Passo 8: Follow-up de Avaliação (Acompanhamento Ativo)

Se o cliente ainda não tiver avaliado a publicação no Reclame Aqui após a solução:

- **Cadência de Contato — 1º Lembrete:** A cada 2 dias após a resposta pública.
- **Gatilhos de Contexto (Uso do Histórico):** Utilize o histórico do cliente e eventuais contatos recentes com o Suporte/Implementação como gancho para chamar a atenção e garantir que ele responda você. Exemplo: O cliente entrou em contato com o time de Suporte para pedir algumas alterações no cardápio; a partir disso, o agente de Reputação utilizou essa informação como gatilho.
- **Acompanhamentos Periódicos:** A cada semana (por até 6 meses).
- **Estilo da Mensagem:** Mantenha um tom gentil e de proximidade, perguntando se o sistema continua rodando bem e relembrando carinhosamente a importância da nota.

## Recebimento, Análise e Tratativa de Outras Áreas

Este processo define as diretrizes e prazos para que as áreas de Suporte, Comercial, Financeiro e Tecnologia forneçam retornos sobre as reclamações recebidas via Reclame Aqui (RA). O cumprimento destes prazos é essencial para manter a reputação da Cardápio Web e garantir a satisfação do cliente.

### Passo 1: Triagem e Contato Inicial (Reputação)

- **Ação:** O agente de reputação recebe a reclamação, analisa o histórico e faz o primeiro contato via WhatsApp.
- **Triagem:** O agente de Reputação realiza a triagem e classifica o caso conforme prioridades: Urgente, Alta e Normal.

### Passo 2: Acionamento de Áreas Internas

Caso necessário direciona internamente ao setor responsável pela solução/problema, garante acompanhamento.

Ao direcionar um caso, o agente de reputação deve fornecer as informações necessárias prioritariamente no canal incidentes-experiencia-do-cliente:

1. Link do RA, Portal, nome do cliente.
2. Resumo claro do problema e o que é necessário para a solução.
3. Prazo limite para resposta conforme prioridade do caso.
4. Acionar lideranças e se possível o consultor de contas.

Modelo:

> @setor-responsável
> [Saudação]! O cliente [nome do cliente] fulano do Reclame Aqui, está enfrentando/com problema [assunto]. Precisa ser realizado um contato para [tratativa].
> É um cliente [nível de prioridade], [prazo para resolução].
> Informações adicionais: [Caso necessário]
> Contato: 99 99999-9999 - Fulano (Dono, Gerente, Funcionário?)
> Conta do cliente: Portal do parceiro.

Para garantir a agilidade, as áreas devem respeitar os seguintes prazos máximos de retorno ao agente de reputação:

| Prioridade | Descrição | Critérios | Risco de Marca |
| --- | --- | --- | --- |
| Urgente (4 horas) | Casos com impacto direto e imediato na operação ou na imagem da empresa. | Sistema indisponível (fora do ar), operação do estabelecimento interrompida e, ou clientes relatando prejuízos financeiros. | Reclamações de grandes contas, influenciadores digitais ou situações com alto potencial de exposição negativa em mídias sociais e imprensa. |
| Alta (1 dia útil) | Situações relevantes, sem impacto imediato, mas que exigem atenção rápida. | Falhas no sistema sem interromper totalmente a operação, dificuldades críticas na configuração, demora excessiva no atendimento ou cliente insatisfeito com risco de cancelamento. | Potencial de detração direta e impacto na retenção. Risco de o cliente expressar descontentamento em canais de atendimento ou mídias sociais. |
| Normal (2 dias úteis) | Situações que não afetam diretamente a operação, mas impactam a experiência do cliente. | Dúvidas recorrentes sobre o uso de funcionalidades, necessidade de ajustes no sistema, erros técnicos pontuais sem recorrência ou solicitações de melhoria no produto. | Baixo impacto público. O risco reside na frustração acumulada do usuário, que pode gerar uma percepção negativa sobre a facilidade de uso do serviço a longo prazo. |

**Nota:** O não cumprimento do prazo deve ser escalonado para o gestor da respectiva área.

### Responsabilidades das Áreas Internas

- **Análise e Solução Técnica:** Analisar o caso conforme prioridade, executar a correção necessária e fornecer ao agente de reputação uma solução definitiva ou um parecer técnico claro.
- **Atendimento Humanizado e Eficiente:** Devido à criticidade das demandas vindas do Reclame Aqui, a área deve garantir um atendimento humanizado de firma empática compreendendo as frustrações do cliente. É fundamental que os atendentes internos analisem o histórico completo para evitar perguntas desnecessárias ao cliente, focando diretamente na resolução do que foi reclamado.
- **Enviar retorno:** Enviar no canal do slack incidentes-experiencia-do-cliente o retorno abaixo:

> @agente-de-reputação
> [Saudação]! O caso do cliente [nome do cliente] do Reclame Aqui, referente ao problema [assunto], foi analisado e tratado. Conforme as diretrizes de análise técnica e solução, foi realizado: [detalhar a solução definitiva ou parecer técnico claro].
> Link do Atendimento: [Incluir Link]
> Informações adicionais: [Caso necessário].

### Finalização

Após o retorno da área interna:

1. O agente de reputação valida a solução com o cliente;
2. Responde no Reclame Aqui;
3. Solicita a avaliação no portal RA.

## 📊 Indicadores

| Indicador | Descrição | Lógica de Cálculo |
| --- | --- | --- |
| Nº de reclamações entrantes (RA) | Total de queixas e chamados que deram entrada na plataforma no período analisado. | Número de novas reclamações recebidas. |
| Nota de Reputação | Nota geral do perfil calculada pelo Reclame Aqui para definir a reputação final da empresa. | Média ponderada que cruza: Índice de Resposta (x2), Índice de Solução (x3), Voltariam a Fazer Negócio (x3) e Nota Média (x2), divididos por 10. |
| Reclamações respondidas | Volume total de reclamações que receberam uma resposta oficial pública da empresa. | Contagem simples do total de reclamações com status "Respondida" ou "Avaliada". |
| Nota média dos consumidores | Nota de 0 a 10 atribuída exclusivamente pelos clientes no final do atendimento. | Soma de todas as notas atribuídas pelos consumidores dividido pelo total de consumidores que avaliaram. |
| Voltariam a fazer negócio | Porcentagem de clientes que responderam "SIM" para a pergunta se voltariam a contratar ou comprar da empresa. | Total de respostas "SIM" dividido pelo total de consumidores que responderam a esta pergunta vezes 100. |
| Reclamações resolvidas (percentual) | Taxa que indica a proporção de problemas solucionados segundo a avaliação final dos clientes. | Total de casos marcados como "Resolvido" pelo cliente dividido pelo total de casos avaliados pelos clientes vezes 100. |
| Tempo médio | Intervalo de tempo entre a publicação da reclamação pelo consumidor e a postagem da primeira resposta da empresa. | Soma das horas (ou dias) de espera de cada caso dividido pelo total de reclamações respondidas. |
| Resolvidas por Ciclo | Volume total de reclamações solucionadas dentro de uma janela específica, no caso 7 dias (1 a 7, 8 a 14, 15 a 21, 22 a 28 e 29 a 30/31). | — |
| Ciclos com o selo ativo | Número acumulado de ciclos que mantemos o selo do RA1000. | — |
| Nº Casos Churn | Quantidade de clientes reclamantes e optaram por cancelar o serviço. | — |
| Nº Casos Retidos | Quantidade de clientes de churn que foram retidos. | — |
| Reclamações não respondidas | Volume de queixas que permanecem abertas aguardando a primeira resposta da empresa. | Nº total de reclamações menos o Nº de reclamações respondidas. |`,
  },
  {
    slug: "cintcw-tratativa-interna",
    titulo: "Processo de Tratativa Interna — Reclame Aqui",
    escopo: "Reclame Aqui",
    resumo: "Os prazos e o modelo de retorno das áreas de Suporte, Comercial, Financeiro e Tecnologia para as reclamações do Reclame Aqui.",
    conteudo: `## 1. Introdução

Este processo define as diretrizes e prazos para que as áreas de Suporte, Comercial, Financeiro e Tecnologia forneçam retornos sobre as reclamações recebidas via Reclame Aqui (RA). O cumprimento destes prazos é essencial para manter a reputação da Cardápio Web e garantir a satisfação do cliente.

## 2. Fluxo de Atendimento

### Passo 1: Triagem e Contato Inicial (Reputação)

- **Ação:** O agente de reputação recebe a reclamação, analisa o histórico e faz o primeiro contato via WhatsApp.
- **Triagem:** O agente de Reputação realiza a triagem e classifica o caso conforme prioridades: Urgente, Alta e Normal.

### Passo 2: Acionamento de Áreas Internas

Caso necessário direciona internamente ao setor responsável pela solução/problema, garante acompanhamento.

Ao direcionar um caso, o agente de reputação deve fornecer:

1. Link do RA, Portal, nome do cliente.
2. Resumo claro do problema e o que é necessário para a solução.
3. Prazo limite para resposta conforme prioridade do caso

Modelo:

> @setor-responsável
> [Saudação]! O cliente [nome do cliente] fulano do Reclame Aqui, está enfrentando/com problema [assunto]. Precisa ser realizado um contato para [tratativa].
> É um cliente [nível de prioridade], [prazo para resolução].
> Informações adicionais:
> Contato: 99 99999-9999 - Fulano (Dono, Gerente, Funcionário?)
> Conta do cliente: Portal do parceiro.

Para garantir a agilidade, as áreas devem respeitar os seguintes prazos máximos de retorno ao agente de reputação:

| Prioridade | Descrição | Critérios | Risco de Marca |
| --- | --- | --- | --- |
| Urgente (4 horas) | Casos com impacto direto e imediato na operação ou na imagem da empresa. | Sistema indisponível (fora do ar), operação do estabelecimento interrompida e, ou clientes relatando prejuízos financeiros. | Reclamações de grandes contas, influenciadores digitais ou situações com alto potencial de exposição negativa em mídias sociais e imprensa. |
| Alta (1 dia útil) | Situações relevantes, sem impacto imediato, mas que exigem atenção rápida. | Falhas no sistema sem interromper totalmente a operação, dificuldades críticas na configuração, demora excessiva no atendimento ou cliente insatisfeito com risco de cancelamento. | Potencial de detração direta e impacto na retenção. Risco de o cliente expressar descontentamento em canais de atendimento ou mídias sociais. |
| Normal (2 dias úteis) | Situações que não afetam diretamente a operação, mas impactam a experiência do cliente. | Dúvidas recorrentes sobre o uso de funcionalidades, necessidade de ajustes no sistema, erros técnicos pontuais sem recorrência ou solicitações de melhoria no produto. | Baixo impacto público. O risco reside na frustração acumulada do usuário, que pode gerar uma percepção negativa sobre a facilidade de uso do serviço a longo prazo. |

**Nota:** O não cumprimento do prazo deve ser escalonado para o gestor da respectiva área.

## 3. Responsabilidades das Áreas Internas

- **Análise e Solução Técnica:** Analisar o caso conforme prioridade, executar a correção necessária e fornecer ao agente de reputação uma solução definitiva ou um parecer técnico claro.
- **Atendimento Humanizado e Eficiente:** Devido à criticidade das demandas vindas do Reclame Aqui, a área deve garantir um atendimento humanizado de firma empática compreendendo as frustrações do cliente. É fundamental que os atendentes internos analisem o histórico completo para evitar perguntas desnecessárias ao cliente, focando diretamente na resolução do que foi reclamado.

## 4. Finalização

Após o retorno da área interna:

1. O agente de reputação valida a solução com o cliente;
2. Responde no Reclame Aqui;
3. Solicita a avaliação no portal RA;
4. Atualiza as informações no ClickUp.`,
  },
  {
    slug: "cintcw-ofertas",
    titulo: "Ofertas, Descontos e Negociações",
    escopo: "Ofertas",
    resumo: "Quando aplicar oferta ou desconto, a autonomia por criticidade, e a renegociação em caráter de exceção máxima, com o cálculo e o checklist.",
    conteudo: `## Objetivo

Ofertas e descontos devem ser utilizados como estratégia de reversão, com foco em recuperar a confiança do cliente e preservar a reputação da empresa. Antes de ofertar, é essencial entender o contexto e identificar a causa raiz, garantindo que houve impacto real na experiência do cliente.

Situações comuns para considerar uma oferta incluem:

- Falhas operacionais
- Ruídos de comunicação
- Demora excessiva na resolução
- Risco de agravamento do caso

## Quando Aplicar Oferta ou Desconto

A oferta deve ser aplicada apenas após a análise completa do caso, garantindo contexto e justificativa clara. Nem todo caso é elegível; é essencial avaliar o histórico de atendimento e o impacto gerado na experiência.

- Exemplo: Cliente teve atraso de 1 mês na sua implementação e a conta cancelada por falta de pagamento. Assim, não houve contato pelo ISM responsável e teve prejuízos na sua operação por não estar conseguindo utilizar sua conta. Nesse cenário, a oferta pode ser considerada para recuperar a confiança do cliente.

Dentro dessa autonomia, é possível conceder benefícios com base na criticidade do caso. A criticidade será baseada no status da reclamação, conforme os critérios de cada status. Cada oferta e desconto baseia-se na complexidade do caso e no seu nível crítico, sendo maleável para a situação:

- 🔴 Caso de nível urgente: 🎁 1 mês gratuito do sistema (podendo ser ajustado conforme a complexidade).
- 🟠 Casos de nível alta: 💸 10% de desconto por 3 meses (podendo ser ajustado conforme o impacto).

### Diretrizes de Concessão

- Essas ofertas devem ser utilizadas para recuperar a experiência do cliente, nunca como primeira abordagem, mas sim após uma condução adequada do caso.
- Qualquer condição fora desse padrão deve ser previamente validada internamente antes de ser apresentada ao cliente.
- Os critérios para as condições ofertadas seguem os status de criticidade disponíveis na documentação interna: Reclame Aqui.

## Renegociação

A renegociação é um acordo feito em caráter de exceção máxima, sempre sob autorização expressa da gestão.

### 👉 Quando usamos?

Apenas em situações extremas e extraordinárias, quando absolutamente necessário.

Se você perceber que precisou aplicar mais de uma vez no mês, reveja o que está sendo feito renegociação nunca deve ser ofertada ao cliente, apenas em caráter excepcional e com autorização superior.

➡ **Importante:** Trate como se essa opção não existisse na rotina normal.

### 📌 Modelo de proposta de renegociação (exemplo)

Período contratado do plano: [Informar o plano contratado e o período de vigência]

Data da solicitação de cancelamento: [Informar data da solicitação durante o período vigente do plano]

### 💰 Cálculos detalhados

- Valor total pago na contratação: R$ [Valor total pago pelo cliente]
- Total de dias do plano contratado: [Dias totais entre o início e o fim da vigência]
- Valor proporcional por dia: R$ [Valor total pago/Total de dias do plano]
- Dias não utilizados: [Dias restantes entre a solicitação e o fim da vigência]
- Valor proporcional dos dias não utilizados: R$ [Valor proporcional por dia X Dias não utilizados]
- Desconto referente a impostos e encargos já pagos pela empresa (30%): R$ [Valor proporcional dos dias não utilizados X 0,30]
- Valor final a ser restituído: R$ [Valor proporcional dos dias não utilizados - Desconto de 30%].

### 📝 Condições da Proposta

- **Forma de Restituição:** O valor acordado será restituído via Pix, mediante o envio dos dados bancários completos por parte do cliente.
- **Cobranças no Cartão de Crédito:** Não é possível realizar estorno parcial ou proporcional no cartão de crédito. As parcelas eventualmente lançadas continuarão sendo cobradas normalmente na fatura, conforme as condições da compra original.
- **Excepcionalidade:** Esta proposta é feita em caráter exclusivo e excepcional, considerando as circunstâncias específicas do atendimento. Ela não gera precedentes e não será aplicada automaticamente em futuras solicitações.
- **Validade:** A oferta terá validade até [inserir data e hora limite]. Após este prazo, a condição será cancelada sem aviso adicional.
- **Condição de Aplicação:** A aplicação da restituição depende da confirmação expressa do cliente dentro do prazo informado.
- **Ajuste Financeiro Interno:** Após a confirmação do cliente, envie a solicitação no Slack para a Gabriela Drebs contendo: Portal; Chave Pix (com dados bancários); Valor final da proposta.

## ✅ Checklist antes e após a proposta de renegociação

- Obteve autorização formal do gestor?
- Revisou o cálculo proporcional corretamente?
- Informou claramente que a proposta é exclusiva e excepcional?
- Após o aceite do cliente, o reembolso foi solicitado ao financeiro (Gabriela Drebs via Slack)?
- Confirmou o recebimento do valor com o cliente após o processamento?`,
  },
  {
    slug: "cintcw-redes-sociais",
    titulo: "Redes Sociais",
    escopo: "Redes Sociais",
    resumo: "Recebimento, análise e tratativa das solicitações das redes sociais e do ManyChat, com o SLA, as exceções e o registro do caso.",
    conteudo: `## 📱 Fluxo de Atendimento: Recebimento, Análise e Tratativa de Solicitações de Clientes (Redes Sociais / ManyChat)

## 🎯 Objetivo

Padronizar o atendimento das solicitações recebidas pelas redes sociais, garantindo tempo de resposta consistente, registro de cada caso e preservação da reputação da marca.

## 🧭 Premissa central

O cliente que recorre à rede social raramente está em primeiro contato. Na maioria dos casos, ele já tentou outro canal e não obteve a solução esperada, ou avaliou que a exposição pública seria mais eficaz do que o caminho convencional.

Toda tratativa deve partir dessa premissa: existe insatisfação acumulada e a manifestação atual é uma escalada. Isso muda a forma de conduzir o atendimento:

- O caso entra com prioridade elevada por padrão, não como demanda comum.
- O tom da abordagem deve reconhecer a tentativa anterior, não tratar o contato como se fosse o começo da história.
- Antes de responder, verificar o histórico do cliente em outros canais: devolvê-lo ao mesmo caminho que já falhou agrava a insatisfação.
- Não pedir que o cliente repita informações que já constam no histórico.
- Há risco simultâneo de churn e de exposição pública; ambos devem ser considerados na condução.

## 🔁 Fluxo de Atendimento

### Passo 1 — Recebimento da Solicitação

Apesar de chegar como uma simples solicitação, é preciso cautela e atenção redobrada: o caso pode se agravar e chegar ao Reclame Aqui, ou evoluir para um posicionamento que afete a reputação da empresa.

**Ação:** o agente recebe uma nova solicitação de atendimento proveniente das redes sociais, por meio de automação no Slack ou através da planilha de acompanhamento.

**Objetivo:** garantir que nenhuma solicitação se perca e que o caso nasça com registro e evidência preservada.

- Identificar a origem da solicitação.
- Validar as informações recebidas.
- Registrar a demanda para acompanhamento.

### Passo 2 — Análise Inicial

Antes de responder, é imprescindível analisar a situação por completo: verificar a conta do cliente na Cardápio Web, o histórico de atendimento e o que pode ser feito diante do que foi descrito, seja na solicitação atual, seja em atendimentos anteriores.

**Ação:** o agente analisa as informações disponíveis para compreender o motivo do contato.

**Objetivo:** compreender o motivo real do contato e dimensionar a criticidade antes de responder.

- Nome do cliente.
- Canal de origem.
- Motivo da solicitação.
- Informações disponíveis na automação ou planilha.
- Necessidade de informações complementares.

### Passo 3 — Primeiro Contato

**Ação:** o agente entra em contato com o cliente pelo canal definido para continuidade do atendimento, atualmente pelo Crisp.

**SLA:** até 4 horas em dia útil para o primeiro contato, já com o histórico de atendimento do cliente verificado. Caso o cliente tenha mais de 10k de seguidores, o contato deve ser feito pelo agente de Reputação no máximo em 1 hora.

**Objetivo:** demonstrar, a quem observa, que a empresa atende, e migrar a tratativa para um canal onde a solução possa ser conduzida com segurança.

- Apresentar-se como responsável pelo atendimento.
- Confirmar a solicitação.
- Obter informações adicionais, quando necessário.
- Iniciar a tratativa.

### Passo 4 — Tratativa

O agente conduz o atendimento, buscando solucionar a solicitação diretamente ou acionando a área responsável quando necessário.

**Objetivo:** resolver a demanda no menor número de interações possível, mantendo o cliente informado ao longo do caminho.

Diretrizes:

- Resolver na primeira interação sempre que a solução estiver ao alcance do agente.
- Ao acionar área interna, registrar o número do chamado no caso e informar o prazo de retorno.
- Manter o cliente informado periodicamente enquanto o caso estiver aberto, mesmo sem novidade: a ausência de retorno é o que motiva a exposição pública.
- O caso permanece sob responsabilidade do agente de reputação mesmo quando depende de outra área.

### Passo 5 — Validação da Solução

**Ação:** após a tratativa, o agente confirma com o cliente que a solicitação foi atendida e registra o encerramento do caso.

## 🚨 Situações de Exceção

### Ausência de contato

**Objetivo:** esgotar as tentativas de retomada antes de encerrar, sem inflar o indicador de resolução.

Quando o cliente não responde após o primeiro contato, aplica-se a seguinte cadência:

| Tentativa | Prazo | Canal |
| --- | --- | --- |
| 1ª | No primeiro contato | WhatsApp e Canal de Origem |
| 2ª | Em até 24h | WhatsApp e Canal de Origem |
| 3ª | Em até 48h | Canal alternativo (e-mail ou telefone), se houver cadastro |

Toda tentativa deve ser registrada com data, hora e canal. O caso é encerrado como "sem contato" e não é contabilizado como resolvido nos indicadores. Se o cliente responder depois, o caso é reaberto com o mesmo registro, preservando o histórico.

### Cliente não identificado

**Objetivo:** permitir a tratativa sem expor dados do cliente em canal aberto.

Solicitar os dados de identificação exclusivamente por canal privado. Persistindo a ausência de identificação, encerrar como "sem identificação" e manter o registro para efeito de menção.

### Risco de exposição ou crise

**Objetivo:** evitar que um caso individual evolua para um problema de marca.

Acionar imediatamente a liderança quando houver crescimento atípico de engajamento negativo, repercussão em perfis de grande alcance, contato de imprensa, menção a ação judicial ou órgão de defesa do consumidor, ou reclamações simultâneas sobre a mesma falha. Nenhuma resposta pública deve ser publicada sem alinhamento prévio.

### Conteúdo ofensivo ou de terceiros

**Objetivo:** proteger a marca sem silenciar cliente legítimo.

Não responder no mérito. Registrar com print, reportar à liderança e seguir a política da plataforma. Não excluir manifestação legítima de cliente, ainda que crítica.

## 🗂️ Registro do Caso

**Objetivo:** tornar o caso rastreável do recebimento ao encerramento e permitir a apuração de causa raiz.

Registrar obrigatoriamente na ferramenta adequada:

- Identificador do caso, mantido inclusive em reaberturas.
- Data e hora de entrada, do primeiro contato e do encerramento.
- Canal de origem e link ou print da interação.
- Histórico das interações, incluindo a conversa anterior no ManyChat e as tentativas de contato.
- Número do chamado aberto nas áreas de apoio.
- Resultado final, solução aplicada e causa raiz.`,
  },
  {
    slug: "cintcw-nps",
    titulo: "Net Promoter Score (NPS)",
    escopo: "NPS",
    resumo: "O guia de encerramento do ciclo de feedback do NPS: segmentação, os sete tipos de tratativa, o checklist para encerrar e os indicadores.",
    conteudo: `## 📊 Guia de Encerramento do Ciclo de Feedback do NPS

## 🎯 Objetivo

O processo pós-NPS existe para transformar a opinião do cliente em retenção financeira e melhoria contínua do produto e do serviço, evitando que a pesquisa vire apenas um número esquecido em relatório. Isso significa responder rapidamente a quem teve problemas e garantir que a empresa saiba, com precisão, quais falhas precisam ser corrigidas.

O processo cumpre três funções centrais:

- **Prevenir cancelamentos (churn):** identificar e socorrer rapidamente clientes insatisfeitos antes que eles abandonem a empresa ou falem mal da marca no mercado.
- **Corrigir falhas estruturais:** mostrar, com dados reais, quais problemas internos (bugs no sistema, atendimento ruim, atrasos de entrega) mais prejudicam a experiência, ajudando a priorizar onde investir tempo e dinheiro.
- **Alavancar promotores para crescimento:** usar a base de clientes satisfeitos para gerar mais receita por meio de depoimentos, avaliações públicas e programas de indicação.

## 🧭 Segmentação inicial

Antes de categorizar o tipo de feedback, todo registro deve ser marcado com o segmento de NPS de origem. É esse segmento que define o SLA de primeiro contato.

| Segmento | Nota | SLA de primeiro contato |
| --- | --- | --- |
| 🔴 Detrator | 0–6 | Até 24h úteis |
| 🟡 Neutro | 7–8 | Até 48h úteis |
| 🟢 Promotor | 9–10 | Até 7 dias úteis |

Todos os casos devem ser registrados na ferramenta.

## 🔁 Tratativa por tipo de feedback

### 1. 🔴 Reclamação

O que fazer:

- Contatar o cliente dentro do SLA do segmento (tabela acima).
- Registrar a causa raiz usando uma lista padronizada de tags (ex.: bug, cobrança, atendimento, expectativa não atendida, logística), necessária para análise de tendência.
- Se não houver resposta após 3 tentativas em até 7 dias, encerrar como [Encerrado] Sem Retorno.

Critérios para encerramento:

- Problema resolvido ou encaminhado.
- Cliente recebeu retorno com solução ou próximos passos.
- Pergunta de reengajamento enviada ("Isso resolveu sua questão?") antes de marcar como [Encerrado] Resolvido. Sem essa confirmação, o loop permanece em [Aguardando Resposta] e não pode ser marcado como [Encerrado] Resolvido.

Status final: [Encerrado] Resolvido · [Aguardando Resposta] · [Encerrado] Sem Retorno

### 2. 🟡 Sugestão

O que fazer:

- Contatar em até 48h úteis.
- Registrar, classificar e vincular ao cliente.
- Enviar link de acompanhamento.

Status final: [Encerrado] Sugestão Registrada

### 3. 🟢 Elogio

O que fazer:

- Registrar e agradecer em até 72h úteis.
- Se o cliente for Promotor (9–10): direcionar ativamente para uma review pública (Google) enquanto o sentimento está positivo.
- Perguntar se aceita ser case/depoimento para marketing.
- Pedir indicação de outros clientes.

Status final: [Encerrado] Elogio

### 4. ⚪ Engano

O que fazer:

- Atualizar registro para controle interno.
- Agradecer, se aplicável.

Status final: [Encerrado] Engano

### 5. 🔵 Erro no Sistema

O que fazer:

- Encaminhar imediatamente ao time técnico, com prioridade proporcional ao segmento (Detrator = urgente).
- Manter o cliente informado sobre o status da correção.

Critérios para encerramento:

- Bug resolvido pela equipe técnica.
- Cliente avisado.
- Pergunta rápida de satisfação reenviada após a correção.

Status final: [Encerrado] Resolvido · [Aguardando Resposta] · [Encerrado] Sem Retorno

### 6. ⚪ Erro Processual

O que fazer:

- Identificar o processo que falhou.
- Comunicar o time responsável para correção na origem.
- Contatar o cliente com retorno e, se possível, reverter a situação.

Toda ocorrência de Erro Processual deve gerar automaticamente um item de revisão de processo interno.

Status final: [Encerrado] Resolvido

### 7. ⚪ Falta de Retorno

O que fazer:

- Mínimo de 5 tentativas de contato em até 7 dias (e-mail, telefone, WhatsApp), registrando cada uma.

Status final: [Encerrado] Sem Retorno

## ✅ Checklist para encerrar um loop

- O segmento de NPS (Promotor/Neutro/Detrator) foi identificado?
- O feedback foi registrado, categorizado e a causa raiz (quando aplicável) foi taggeada?
- O cliente foi contatado dentro do SLA do segmento?
- A solução ou retorno foi registrado no sistema?
- Houve confirmação do cliente de que o problema foi resolvido (quando aplicável)?
- O histórico do cliente está atualizado?
- O status final foi aplicado corretamente?

## 📊 Indicadores

| Indicador | O que mede |
| --- | --- |
| % de detratores contatados | Percepção geral consolidada |
| Número de Indicações | Cobertura do atendimento |
| Número de Avaliações no Google | Cumprimento do SLA de 48h |
| Csat/humor do cliente detrator após resolução | Régua de Satisfação do detrator após resolução |`,
  },
  {
    slug: "cintcw-google",
    titulo: "Google",
    escopo: "Google",
    resumo: "O processo de atendimento às avaliações do Google: monitoramento, classificação, resposta pública, tratativa privada, exceções e indicadores.",
    conteudo: `## ⭐ Processo de Atendimento às Avaliações do Google

## 🎯 Objetivo

Padronizar o monitoramento e a resposta às avaliações públicas deixadas no perfil do Google da Cardápio Web, garantindo que toda nota e todo comentário recebam tratamento consistente, que aprendizados sejam extraídos para melhoria contínua e que a nota média (estrelas) seja tratada como indicador ativo de reputação, e não apenas como número de vitrine.

Diferente do Reclame Aqui e do ManyChat, aqui o cliente muitas vezes não está buscando resolução, está deixando um registro público de uma experiência já concluída. Isso muda a lógica de atendimento: a resposta não é só para quem avaliou, é para todo futuro cliente que lerá aquela avaliação antes de decidir comprar.

## 🧭 Escopo

Aplica-se a todas as avaliações recebidas no perfil do Google Meu Negócio da Cardápio Web. Não substitui o atendimento via Reclame Aqui ou canais diretos: quando a avaliação revela um problema não resolvido em outro canal, o caso deve ser aberto/vinculado também no canal apropriado de tratativa.

### 1. Recebimento e Monitoramento

**Ação:** Acompanhar o painel do Google Meu Negócio (ou ferramenta de alerta configurada) para identificar novas avaliações.

**Objetivo:** garantir que nenhuma avaliação fique sem leitura e sem resposta.

- Configurar alerta automático de novas avaliações (e-mail, Slack ou similar).
- Registrar a avaliação na planilha/ferramenta de acompanhamento, com nota, data e link.

### 2. Classificação da Avaliação

**Ação:** Classificar a avaliação conforme a nota e o conteúdo do comentário.

**Objetivo:** decidir o tipo de resposta e o SLA aplicável antes de responder.

| Classificação | Critério | Nível de criticidade |
| --- | --- | --- |
| 🟢 Positiva | 4 ou 5 estrelas, sem crítica relevante no texto | Normal |
| 🟡 Neutra | 3 estrelas, ou comentário misto (elogio + ressalva) | Normal |
| 🔴 Negativa | 1 ou 2 estrelas, ou comentário relatando problema não resolvido | Alta / Urgente* |

\\* Vira Urgente quando o comentário menciona risco jurídico, cobrança indevida, ou quando há repetição do mesmo problema em múltiplas avaliações recentes (sinal de falha estrutural).

### 3. Resposta Pública

**SLA de resposta:** até 48h úteis para qualquer avaliação, com prioridade para as negativas.

| Classificação | SLA de resposta | Diretriz de conteúdo |
| --- | --- | --- |
| 🟢 Positiva | Até 48h úteis | Agradecer nominalmente, reforçar o que foi elogiado, convidar para conhecer outros diferenciais. |
| 🟡 Neutra | Até 48h úteis | Agradecer, reconhecer a ressalva apontada, indicar o que está sendo feito a respeito. |
| 🔴 Negativa | Até 24h úteis (Alta) / Até 4h úteis (Urgente) | Reconhecer o problema sem se justificar excessivamente, oferecer canal privado para resolução, nunca discutir o mérito publicamente. |

Diretrizes gerais de resposta:

- Nunca usar respostas genéricas ou copiadas sem adaptação, a avaliação é pública e a genericidade transmite descaso.
- Em avaliações negativas, sempre direcionar para um canal privado (WhatsApp, e-mail) para continuar a tratativa, sem prometer solução na resposta pública.
- Evitar linguagem defensiva ou que coloque a culpa no cliente.
- Se o cliente for identificável e tiver histórico na base, verificar esse histórico antes de responder (mesma lógica do Reclame Aqui e do ManyChat).

### 4. Tratativa Privada (quando aplicável)

**Ação:** Para avaliações negativas ou neutras com ressalva relevante, buscar contato direto com o cliente para investigar e propor solução.

**Objetivo:** resolver a causa do problema e, quando possível, reverter a percepção do cliente.

- Se o problema for resolvido, e o cliente concordar, solicitar educadamente a atualização da nota, sem pressionar.
- Se o cliente não puder ser identificado (avaliação anônima ou perfil sem nome real), registrar como "sem identificação" e manter apenas a resposta pública.

### 5. Encerramento e Registro

Registrar obrigatoriamente na ferramenta padrão:

- Nota, data e link da avaliação.
- Classificação (positiva/neutra/negativa) e nível de criticidade.
- Resposta pública publicada (data e conteúdo).
- Se houve tratativa privada: canal, resultado e se a nota foi atualizada.
- Causa raiz, quando aplicável (mesma lista de tags usada no NPS: bug, cobrança, atendimento, expectativa não atendida, logística).

Status final: [Encerrado] Respondida · [Encerrado] Sem Identificação · [Encerrado] Sem Retorno do Cliente

## 🚨 Situações de Exceção

**Avaliação ofensiva, falsa ou de não-cliente:** Não responder no mérito. Registrar com print, sinalizar para a liderança e seguir o fluxo de denúncia do Google para remoção, quando aplicável. Não usar a resposta pública para "provar" que a avaliação é falsa. Consultar Regulamento do Google: Denunciar avaliações impróprias no seu Perfil da Empresa - Ajuda do Perfil da empresa no Google.

**Reincidência do mesmo problema em várias avaliações:** Escalar para a liderança e para a área técnica/produto responsável, mesmo que cada avaliação isolada pareça de baixa criticidade, o padrão entre elas é o sinal de risco.

**Avaliação de Promotor recém-identificado em outro canal (NPS/RA):** Aproveitar o momento: já existe orientação no processo de NPS para direcionar Promotores para review pública, esse fluxo deve alimentar o monitoramento do Google, não competir com ele.

## 📊 Indicadores

| Indicador | O que mede |
| --- | --- |
| Nota média (estrelas) | Percepção geral consolidada |
| % de avaliações respondidas | Cobertura do atendimento |
| Tempo médio de resposta | Cumprimento do SLA de 48h |
| % de avaliações negativas revertidas | Eficácia da tratativa privada |`,
  },
  {
    slug: "cintcw-ferramentas-e-acessos",
    titulo: "Ferramentas e Acessos",
    escopo: "Ferramentas",
    resumo: "As ferramentas do dia a dia, como acessar cada uma com segurança e as planilhas da área.",
    conteudo: `## 🧰 Ferramentas que usamos

| Ferramenta | Uso principal |
| --- | --- |
| WhatsApp Business | Principal canal de contato com o cliente |
| Portal Cardápio Web | Consulta de dados do cliente |
| Central de Ajuda | Artigos e instruções |
| E-mail institucional (Gmail) | Comunicações formais |
| Meetime / Google Meet | Ferramentas de ligação para os clientes |
| Slack | Alinhamento com Suporte, Financeiro e Comercial |
| Wootric | Acompanhamento de respostas de NPS |
| HugMe | Relatórios, métricas e projeções do Reclame Aqui |
| Planilhas internas | Preenchimento e acompanhamento da área (ver seção abaixo). |

## 🔐 Acessos

### WhatsApp Business

1. Retirar o celular do Reclame Aqui com a gestão responsável.
2. Abrir o WhatsApp Web no computador.
3. Ler o QR Code e seguir as instruções na tela.

### Portal Cardápio Web

1. Login em portal.cardapioweb.com/login com e-mail e senha cadastrados.
2. Acesso pessoal e intransferível.

### Central de Ajuda

1. Acessar ajuda.cardapioweb.com.

### E-mail, Google Meet e Slack

1. Logar em cada plataforma com seu login Cardápio Web.

### Reclame Aqui

1. Acesse reclameaqui.com.br → "Entrar" → aba Empresa.
2. Login com seu usuário individual.
3. No painel, vá em Reclamações → a mais recente aparece no topo.
4. Status: Não respondidas (prioridade), Réplicas, Respondidas, Avaliadas, Duplicidades, Todas.
5. Segurança: não salvar senha no navegador; acesso individual, não repassar.

### Wootric

1. Acesse o link com o login fornecido pela gestão.
2. Segurança: não salvar senha no navegador; não repassar o acesso.

### HugMe

1. Acesse o link com o login fornecido pela gestão.
2. Segurança: não salvar senha no navegador; não repassar o acesso.

## 🔐 Planilhas

1. **Métricas do Reclame Aqui:** Atualizada diariamente pelo agente de Reputação com os indicadores solicitados.
2. **[LID][2026] Acompanhamento de KPIs:** Acompanhamento e atualização dos indicadores da planilha acima, só que somente a nível liderança diretoria.
3. **[MKT] Fluxo de Atendimento Suporte.xlsx:** Casos vindo de Marketing que precisam de atenção/suporte ou com risco de Reputação.
4. **Relatório:** Relatório enviado ao fim de cada Ciclo sobre a atuação, desempenho e próximos passos do time de Reputação.`,
  },
];
