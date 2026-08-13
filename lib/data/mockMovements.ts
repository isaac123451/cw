import {
  CaseMovement,
  MovementRule,
} from "@/lib/models/movement";

/**
 * Destinos de partida, tirados dos times que existem no cadastro
 * (`mockTeams`) mais o próprio cliente. Editáveis em Processos.
 */
export const mockMovementRules: MovementRule[] = [
  {
    id: "mr-adocao",
    destination: "Adoção",
    hours: 24,
    note: "Implantação e configuração do estabelecimento.",
    active: true,
  },
  {
    id: "mr-suporte",
    destination: "Suporte",
    hours: 8,
    note: "Dúvida ou erro de uso que o primeiro nível resolve.",
    active: true,
  },
  {
    id: "mr-tecnologia",
    destination: "Tecnologia",
    hours: 24,
    note: "Erro de sistema que precisa de investigação técnica.",
    active: true,
  },
  {
    id: "mr-fiscal",
    destination: "Fiscal",
    hours: 48,
    note: "Nota fiscal, SPED e obrigações acessórias.",
    active: true,
  },
  {
    id: "mr-cliente",
    destination: "Cliente",
    hours: 72,
    note: "Esperando um dado, um print ou uma confirmação de quem reclamou.",
    active: true,
  },
];

/**
 * Movimentações de exemplo em casos reais da base importada.
 *
 * Cobrem os quatro estados possíveis — no prazo, perto de vencer, fora
 * do prazo e concluída — para a tela não nascer vazia nem mostrar só o
 * caminho feliz.
 */
export const mockMovements: CaseMovement[] = [
  {
    id: "mv-1",
    caseId: "101327119",
    destination: "Adoção",
    reason:
      "Confirmar se a loja estava com o horário de funcionamento configurado no dia da compra.",
    actor: "Carlos Isaac",
    startedAt: "2026-08-05",
    dueHours: 24,
  },
  {
    id: "mv-2",
    caseId: "101112720",
    destination: "Fiscal",
    reason:
      "Verificar a emissão da nota do pedido antes de responder o consumidor.",
    actor: "Juliana Prado",
    startedAt: "2026-08-01",
    dueHours: 120,
  },
  {
    id: "mv-3",
    caseId: "100844852",
    destination: "Cliente",
    reason:
      "Pedimos o print do comprovante para seguir com o estorno.",
    actor: "Marcos Vinícius",
    startedAt: "2026-07-22",
    dueHours: 72,
  },
  {
    id: "mv-4",
    caseId: "101275486",
    destination: "Tecnologia",
    reason:
      "Investigar a duplicidade de cobrança apontada no relato.",
    actor: "Carlos Isaac",
    startedAt: "2026-08-03",
    dueHours: 24,
  },
  {
    id: "mv-5",
    caseId: "100853970",
    destination: "Suporte",
    reason:
      "Checar o histórico de chamados do estabelecimento antes da réplica.",
    actor: "Juliana Prado",
    startedAt: "2026-07-22",
    dueHours: 8,
    returnedAt: "2026-07-23",
    outcome:
      "Dois chamados abertos na semana, ambos sobre integração do cardápio.",
  },
  {
    id: "mv-6",
    caseId: "101177885",
    destination: "Adoção",
    reason:
      "Confirmar a data real da implantação para responder o consumidor.",
    actor: "Marcos Vinícius",
    startedAt: "2026-07-28",
    dueHours: 24,
    returnedAt: "2026-07-30",
    outcome:
      "Implantação concluída em 12/07; o atraso foi na liberação do cardápio.",
  },
];
