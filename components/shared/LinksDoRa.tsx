"use client";

import { Building2, ExternalLink } from "lucide-react";

import { linksDoRa } from "@/lib/models/linksDoRa";

interface Props {
  caso: { protocol: string; raUrl?: string | null };
  /**
   * `icones`: dois ícones pequenos, para linhas e cartões.
   * `botoes`: com o nome escrito, para o cabeçalho da ficha.
   */
  variante?: "icones" | "botoes";
  /**
   * Dentro de um link (o cartão do quadro, a linha da busca), um `<a>`
   * aninhado é HTML inválido: aí vira botão que abre a aba.
   */
  dentroDeLink?: boolean;
  className?: string;
}

/**
 * A página pública e a área da empresa, lado a lado — ver `linksDoRa`.
 * Sem nenhum dos dois (Redes Sociais), não desenha nada.
 */
export default function LinksDoRa({ caso, variante = "icones", dentroDeLink = false, className = "" }: Props) {

  const links = linksDoRa(caso);

  if (links.length === 0) return null;

  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      {links.map((l) => {
        const Icone = l.tipo === "empresa" ? Building2 : ExternalLink;
        const estilo =
          variante === "botoes"
            ? "flex items-center gap-2 rounded-xl border border-violet-200 px-3.5 py-2.5 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-50"
            : "rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-violet-50 hover:text-violet-700";
        const conteudo = (
          <>
            <Icone size={variante === "botoes" ? 15 : 14} aria-hidden />
            {variante === "botoes" ? l.rotulo : <span className="sr-only">{l.rotulo}</span>}
          </>
        );

        if (dentroDeLink) {
          return (
            <button
              key={l.tipo}
              type="button"
              title={l.titulo}
              draggable={false}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.open(l.href, "_blank", "noopener,noreferrer");
              }}
              className={estilo}
            >
              {conteudo}
            </button>
          );
        }

        return (
          <a
            key={l.tipo}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            title={l.titulo}
            onClick={(e) => e.stopPropagation()}
            className={estilo}
          >
            {conteudo}
          </a>
        );
      })}
    </span>
  );
}
