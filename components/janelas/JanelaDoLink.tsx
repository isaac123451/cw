"use client";

import BotaoAbrirEmJanela from "@/components/janelas/BotaoAbrirEmJanela";
import { janelaDoEndereco } from "@/lib/models/janelas";

/**
 * O botão de mini-janela para listas que só têm o link do item.
 *
 * Aparece quando o link é de uma ficha (caso, NPS, avaliação); em link de
 * tela, não desenha nada — a lista continua igual.
 */
export default function JanelaDoLink({ href, titulo, className = "" }: { href?: string | null; titulo: string; className?: string }) {
  const pedido = janelaDoEndereco(href, titulo);
  if (!pedido) return null;
  return <BotaoAbrirEmJanela frente={pedido.frente} referencia={pedido.ref} titulo={titulo} className={className} />;
}
