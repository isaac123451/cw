"use client";

import { useActionState } from "react";

import {
  CircleAlert,
  CircleCheck,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react";

import Modal, {
  GhostButton,
} from "@/components/shared/Modal";

import {
  importNpsPlanilha,
  type ResultadoDaPlanilha,
} from "@/lib/actions/nps";

/**
 * Importar NPS por planilha.
 *
 * O Reclame Aqui já entrava assim; o NPS só entrava pela API do Wootric,
 * e isso deixava de fora três casos reais: a pesquisa que roda fora do
 * Wootric, o histórico anterior à integração, e a correção em massa —
 * exportar, arrumar numa planilha e devolver.
 *
 * **O relatório de linha ignorada é metade do recurso.** Uma importação
 * que diz "gravei 780" sobre um arquivo de 800 deixa vinte linhas
 * sumirem em silêncio, e ninguém descobre qual. Aqui cada descarte vem
 * com o número da linha e o motivo.
 */
export default function NpsSheetImport({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {

  const [resultado, formAction, importando] =
    useActionState<ResultadoDaPlanilha, FormData>(
      async (estado, formData) => {

        const saida = await importNpsPlanilha(
          estado,
          formData
        );

        // Traz para a tela o que acabou de entrar no banco.
        if (!saida.erro) await onDone();

        return saida;
      },
      {
        lidas: 0,
        novas: 0,
        atualizadas: 0,
        ignoradas: [],
      }
    );

  const gravou =
    !resultado.erro &&
    resultado.novas + resultado.atualizadas > 0;

  return (
    <Modal
      open={open}
      title="Importar NPS por planilha"
      description="Um .xlsx ou .csv com uma coluna de nota e uma de cliente. As demais são opcionais."
      onClose={importando ? () => {} : onClose}
      footer={
        <GhostButton onClick={onClose}>
          {importando ? "Importando..." : "Fechar"}
        </GhostButton>
      }
    >

      <div className="space-y-4">

        <form action={formAction} className="space-y-3">

          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-zinc-300 px-4 py-6 transition-colors hover:border-violet-300 hover:bg-violet-50/40">

            <FileSpreadsheet
              size={20}
              className="shrink-0 text-violet-600"
            />

            <span className="min-w-0 flex-1 text-sm text-zinc-600">
              Escolher o arquivo
            </span>

            <input
              type="file"
              name="arquivo"
              accept=".xlsx,.xls,.csv"
              required
              className="min-w-0 flex-1 text-xs text-zinc-500 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-violet-700"
            />

          </label>

          <button
            type="submit"
            disabled={importando}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800 disabled:opacity-60"
          >
            {importando ? (
              <Loader2
                size={15}
                className="animate-spin"
              />
            ) : (
              <Upload size={15} />
            )}
            {importando ? "Importando..." : "Importar"}
          </button>

        </form>

        {resultado.erro && (
          <p className="flex items-start gap-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800 ring-1 ring-inset ring-rose-100">
            <CircleAlert
              size={15}
              className="mt-0.5 shrink-0"
            />
            {resultado.erro}
          </p>
        )}

        {gravou && (
          <div className="rounded-xl bg-emerald-50 px-3.5 py-2.5 ring-1 ring-inset ring-emerald-100">

            <p className="flex items-center gap-2 text-sm font-medium text-emerald-800">
              <CircleCheck size={15} />
              {resultado.novas} nova(s) ·{" "}
              {resultado.atualizadas} atualizada(s)
            </p>

            {resultado.de && (
              <p className="mt-1 text-xs text-emerald-700">
                De {resultado.de} a {resultado.ate}.
              </p>
            )}

          </div>
        )}

        {resultado.ignoradas.length > 0 && (

          <div className="rounded-xl bg-amber-50 px-3.5 py-2.5 ring-1 ring-inset ring-amber-100">

            <p className="text-sm font-medium text-amber-900">
              {resultado.ignoradas.length} linha(s)
              ficaram de fora
            </p>

            <ul className="mt-1.5 max-h-32 space-y-0.5 overflow-y-auto text-xs text-amber-800">
              {resultado.ignoradas
                .slice(0, 20)
                .map((item) => (
                  <li key={item.linha}>
                    linha {item.linha} — {item.motivo}
                  </li>
                ))}
            </ul>

            {resultado.ignoradas.length > 20 && (
              <p className="mt-1 text-xs text-amber-700">
                e mais{" "}
                {resultado.ignoradas.length - 20}.
              </p>
            )}

          </div>

        )}

        <div className="space-y-2 text-xs leading-relaxed text-zinc-500">

          <p>
            As colunas são reconhecidas pelo nome, não pela
            posição — &ldquo;Nota&rdquo;,
            &ldquo;Cliente&rdquo;, &ldquo;E-mail&rdquo;,
            &ldquo;Telefone&rdquo;,
            &ldquo;Comentário&rdquo;, &ldquo;Respondido
            em&rdquo;, &ldquo;Tipo&rdquo; e &ldquo;Causa
            raiz&rdquo;. É o mesmo cabeçalho que a
            exportação desta tela gera, então exportar,
            corrigir e devolver funciona.
          </p>

          <p>
            <strong className="font-semibold text-zinc-700">
              Reimportar não duplica
            </strong>{" "}
            e{" "}
            <strong className="font-semibold text-zinc-700">
              não desfaz tratativa
            </strong>
            : status, responsável, tentativas e pós-contato
            são trabalho da operação e ficam intactos. A
            planilha atualiza nota, comentário, contato,
            tipo e causa raiz.
          </p>

        </div>

      </div>

    </Modal>
  );
}
