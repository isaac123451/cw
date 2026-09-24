"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import type { Case } from "@/lib/models/case";
import type { CaseMovement } from "@/lib/models/movement";
import type { TipoDeContato } from "@/lib/models/tratativa";

import { useCases } from "@/lib/context/CaseContext";
import { useMovements } from "@/lib/context/MovementsContext";

import AcionarAreaModal from "./AcionarAreaModal";
import ContatoModal from "./ContatoModal";
import ValidacaoModal from "./ValidacaoModal";
import ImersaoModal from "./ImersaoModal";
import ModeracaoModal from "./ModeracaoModal";
import PedidoAvaliacaoModal from "./PedidoAvaliacaoModal";
import TriagemModal from "./TriagemModal";

/**
 * Quem abre os diálogos da tratativa, de qualquer tela.
 *
 * Os diálogos moram no layout, como o "Completar": o chip do cartão, a
 * linha da lista, a trilha e a lateral do caso chamam `abrirTriagem`,
 * `abrirContato`, `abrirImersao`… e o diálogo aparece por cima, sem sair
 * de onde se está.
 *
 * Depois que o servidor confirma, o caso é atualizado na lista em
 * memória — o quadro muda na hora — e quem abriu recebe o que mudou em
 * `aoSalvar`. A tela do caso usa isso para o rascunho aberto não
 * regravar o valor antigo no próximo "Salvar".
 */

export interface Opcoes {
  aoSalvar?: (patch: Partial<Case>) => void;
  /** O contato já abre neste canal — "tente por e-mail". */
  canal?: string;
}

interface TratativaContextType {
  abrirTriagem: (item: Case, opcoes?: Opcoes) => void;
  abrirContato: (item: Case, tipo?: TipoDeContato, opcoes?: Opcoes) => void;
  abrirImersao: (item: Case, opcoes?: Opcoes) => void;
  /** `area` e `causa`: o acionamento que nasce da causa raiz já vem com a área dona escolhida. */
  abrirArea: (item: Case, daCausa?: { area?: string; causa?: string }) => void;
  abrirPedidoAvaliacao: (item: Case, opcoes?: Opcoes) => void;
  abrirModeracao: (item: Case, opcoes?: Opcoes) => void;
}

const TratativaContext = createContext<TratativaContextType | null>(null);

type Dialogo = "triagem" | "contato" | "imersao" | "area" | "pedido-avaliacao" | "moderacao";

interface Aberto {
  tipo: Dialogo;
  item: Case;
  contato?: TipoDeContato;
  opcoes?: Opcoes;
  daCausa?: { area?: string; causa?: string };
}

export function TratativaProvider({ children }: { children: ReactNode }) {

  const { setCases } = useCases();
  const { aplicarMovimento } = useMovements();

  const [aberto, setAberto] = useState<Aberto | null>(null);

  const fechar = useCallback(() => setAberto(null), []);

  const aplicar = useCallback(
    (protocol: string, patch: Partial<Case>, opcoes?: Opcoes) => {
      setCases((prev) =>
        prev.map((c) => (c.protocol === protocol ? { ...c, ...patch } : c))
      );
      opcoes?.aoSalvar?.(patch);
    },
    [setCases]
  );

  const valor = useMemo<TratativaContextType>(
    () => ({
      abrirTriagem: (item, opcoes) => setAberto({ tipo: "triagem", item, opcoes }),
      abrirContato: (item, contato, opcoes) =>
        setAberto({ tipo: "contato", item, contato, opcoes }),
      abrirImersao: (item, opcoes) => setAberto({ tipo: "imersao", item, opcoes }),
      abrirArea: (item, daCausa) => setAberto({ tipo: "area", item, daCausa }),
      abrirPedidoAvaliacao: (item, opcoes) => setAberto({ tipo: "pedido-avaliacao", item, opcoes }),
      abrirModeracao: (item, opcoes) => setAberto({ tipo: "moderacao", item, opcoes }),
    }),
    []
  );

  const salvo = aberto
    ? (patch: Partial<Case>) => aplicar(aberto.item.protocol, patch, aberto.opcoes)
    : () => {};

  const chave = aberto ? `${aberto.tipo}-${aberto.item.protocol}` : "";

  return (
    <TratativaContext.Provider value={valor}>
      {children}

      {aberto?.tipo === "triagem" && (
        <TriagemModal key={chave} item={aberto.item} onClose={fechar} onSalvo={salvo} />
      )}

      {/* A validação tem o próprio diálogo: pergunta, resposta e compromisso — não o formulário de contato. */}
      {aberto?.tipo === "contato" && aberto.contato === "validacao" && (
        <ValidacaoModal key={chave} item={aberto.item} onClose={fechar} onSalvo={salvo} />
      )}

      {aberto?.tipo === "contato" && aberto.contato !== "validacao" && (
        <ContatoModal
          key={chave}
          item={aberto.item}
          tipoInicial={aberto.contato}
          canalInicial={aberto.opcoes?.canal}
          onClose={fechar}
          onSalvo={salvo}
        />
      )}

      {aberto?.tipo === "imersao" && (
        <ImersaoModal key={chave} item={aberto.item} onClose={fechar} onSalvo={salvo} />
      )}

      {aberto?.tipo === "area" && (
        <AcionarAreaModal
          key={chave}
          item={aberto.item}
          areaInicial={aberto.daCausa?.area}
          causa={aberto.daCausa?.causa}
          onClose={fechar}
          onSalvo={(movimento: CaseMovement) => aplicarMovimento(movimento)}
        />
      )}

      {aberto?.tipo === "pedido-avaliacao" && (
        <PedidoAvaliacaoModal key={chave} item={aberto.item} onClose={fechar} onSalvo={salvo} />
      )}

      {aberto?.tipo === "moderacao" && (
        <ModeracaoModal key={chave} item={aberto.item} onClose={fechar} onSalvo={salvo} />
      )}
    </TratativaContext.Provider>
  );
}

const NADA: TratativaContextType = {
  abrirTriagem: () => {},
  abrirContato: () => {},
  abrirImersao: () => {},
  abrirArea: () => {},
  abrirPedidoAvaliacao: () => {},
  abrirModeracao: () => {},
};

/** Fora do provider os botões não fazem nada — somem em vez de quebrar a tela. */
export function useTratativa(): TratativaContextType {
  return useContext(TratativaContext) ?? NADA;
}
