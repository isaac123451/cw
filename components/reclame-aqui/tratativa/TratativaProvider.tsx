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
import type { TipoDeContato } from "@/lib/models/tratativa";

import { useCases } from "@/lib/context/CaseContext";

import ContatoModal from "./ContatoModal";
import TriagemModal from "./TriagemModal";

/**
 * Quem abre a triagem e o registro de contato, de qualquer tela.
 *
 * Os dois diálogos moram no layout, como o "Completar": o chip do
 * cartão, a linha da lista e a lateral do caso chamam `abrirTriagem` ou
 * `abrirContato`, e o diálogo aparece por cima, sem sair de onde se está.
 *
 * Depois que o servidor confirma, o caso é atualizado na lista em
 * memória — o quadro muda na hora — e quem abriu recebe o que mudou em
 * `aoSalvar`. A tela do caso usa isso para o rascunho aberto não
 * regravar a prioridade antiga no próximo "Salvar".
 */

interface Opcoes {
  aoSalvar?: (patch: Partial<Case>) => void;
}

interface TratativaContextType {
  abrirTriagem: (item: Case, opcoes?: Opcoes) => void;
  abrirContato: (item: Case, tipo?: TipoDeContato, opcoes?: Opcoes) => void;
}

const TratativaContext = createContext<TratativaContextType | null>(null);

type Aberto =
  | { tipo: "triagem"; item: Case; opcoes?: Opcoes }
  | { tipo: "contato"; item: Case; contato?: TipoDeContato; opcoes?: Opcoes };

export function TratativaProvider({ children }: { children: ReactNode }) {

  const { setCases } = useCases();

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
    }),
    []
  );

  return (
    <TratativaContext.Provider value={valor}>
      {children}

      {aberto?.tipo === "triagem" && (
        <TriagemModal
          key={`t-${aberto.item.protocol}`}
          item={aberto.item}
          onClose={fechar}
          onSalvo={(patch) => aplicar(aberto.item.protocol, patch, aberto.opcoes)}
        />
      )}

      {aberto?.tipo === "contato" && (
        <ContatoModal
          key={`c-${aberto.item.protocol}`}
          item={aberto.item}
          tipoInicial={aberto.contato}
          onClose={fechar}
          onSalvo={(patch) => aplicar(aberto.item.protocol, patch, aberto.opcoes)}
        />
      )}
    </TratativaContext.Provider>
  );
}

/** Fora do provider os botões não fazem nada — somem em vez de quebrar a tela. */
export function useTratativa(): TratativaContextType {
  return (
    useContext(TratativaContext) ?? {
      abrirTriagem: () => {},
      abrirContato: () => {},
    }
  );
}
