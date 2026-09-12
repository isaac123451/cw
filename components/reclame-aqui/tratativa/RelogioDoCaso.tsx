"use client";

import { AlarmClock, CheckCircle2, Clock3, PhoneCall } from "lucide-react";

import type { Case } from "@/lib/models/case";
import { paredeDe } from "@/lib/services/horasUteis";
import { slaStatus, toneOfSla } from "@/lib/services/sla.service";

import { useSla } from "@/lib/context/SlaContext";
import { useAgora } from "@/lib/hooks/useAgora";

import { useTratativa } from "./TratativaProvider";

interface Props {
  item: Case;
  /** Sem regra nenhuma, o chip some — no cartão, "sem prazo" é ruído. */
  esconderSemRegra?: boolean;
  className?: string;
}

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** "qua, 16/09 às 10:00" — o prazo em Brasília. */
export function quandoVence(iso: string) {
  const d = new Date(iso);
  const { dia, min } = paredeDe(d);
  const [, m, dd] = dia.split("-");
  const semana = DIAS[new Date(`${dia}T12:00:00Z`).getUTCDay()];
  return `${semana}, ${dd}/${m} às ${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/**
 * O relógio do caso, no formato de chip.
 *
 * Mostra o relógio que está correndo — o do 1º contato, depois o da
 * solução — em tempo útil. Enquanto o 1º contato não foi registrado, o
 * chip é um botão: clicar abre o registro, que é a ação que faz o
 * relógio parar. É o "Fiz o 1º contato" do roadmap, no lugar exato em
 * que o atraso aparece.
 */
export default function RelogioDoCaso({ item, esconderSemRegra = false, className = "" }: Props) {

  const { rules, expediente } = useSla();
  const { abrirContato } = useTratativa();
  const agora = useAgora();

  if (!agora) return null;

  const status = slaStatus(item, rules, { agora, expediente });

  if (status.situation === "sem-regra" && esconderSemRegra) return null;

  const pedeContato =
    status.fase === "contato" &&
    (status.situation === "dentro" ||
      status.situation === "atencao" ||
      status.situation === "estourado" ||
      status.situation === "sem-registro");

  const Icone =
    status.situation === "concluido"
      ? CheckCircle2
      : status.situation === "estourado"
        ? AlarmClock
        : pedeContato
          ? PhoneCall
          : Clock3;

  const dica = [
    status.prazo ? `Vence ${quandoVence(status.prazo)}.` : null,
    status.rule
      ? `Regra: ${status.rule.priority ?? "qualquer prioridade"}${status.rule.canal ? ` · ${status.rule.canal}` : ""}.`
      : "Nenhuma regra de prazo cobre este caso — cadastre em Processos e SLA.",
    status.horaEstimada
      ? "A reclamação não tem hora gravada: o relógio partiu da abertura do expediente daquele dia."
      : null,
    pedeContato ? "Clique para registrar o contato." : null,
  ]
    .filter(Boolean)
    .join(" ");

  const classes = `inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1 ring-inset ${toneOfSla(status.situation)} ${className}`;

  if (!pedeContato) {
    return (
      <span className={classes} title={dica}>
        <Icone size={11} className="shrink-0" />
        <span className="truncate">{status.label}</span>
      </span>
    );
  }

  return (
    <button
      type="button"
      title={dica}
      onClick={(e) => {
        /* O cartão inteiro é um link: sem isto, o clique abriria o caso. */
        e.preventDefault();
        e.stopPropagation();
        abrirContato(item, "contato");
      }}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      className={`${classes} cursor-pointer transition-shadow hover:shadow-sm`}
    >
      <Icone size={11} className="shrink-0" />
      <span className="truncate">{status.label}</span>
    </button>
  );
}
