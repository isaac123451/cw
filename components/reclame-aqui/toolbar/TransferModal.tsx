"use client";

import { useActionState, useState } from "react";

import {
  CircleAlert,
  CircleCheck,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react";

import Modal, {
  GhostButton,
} from "@/components/shared/Modal";

import {
  exportCases,
  importCases,
  type ImportSummary,
} from "@/lib/actions/transfer";

import { useCases } from "@/lib/context/CaseContext";

/**
 * Importar e exportar a base de reclamações.
 *
 * O botão "Importar" da barra existia sem ação nenhuma — abria nada e
 * não fazia nada. Aqui ele passa a receber o export do HugMe e gravar no
 * banco, e ganha o caminho inverso.
 */
export default function TransferModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {

  const { recarregar, hasDatabase } = useCases();

  const [resultado, formAction, importando] =
    useActionState<ImportSummary, FormData>(
      async (state, formData) => {
        const saida = await importCases(state, formData);

        // Traz para a tela o que acabou de entrar no banco.
        if (!saida.error) await recarregar();

        return saida;
      },
      {}
    );

  const [exportando, setExportando] = useState(false);
  const [erroExport, setErroExport] = useState<
    string | null
  >(null);

  async function baixar() {

    setExportando(true);
    setErroExport(null);

    try {
      const saida = await exportCases();

      if (saida.error || !saida.arquivo) {
        setErroExport(
          saida.error ?? "Falha ao gerar o arquivo."
        );
        return;
      }

      // Base64 de volta para binário, e o navegador baixa.
      const bytes = Uint8Array.from(
        atob(saida.arquivo),
        (c) => c.charCodeAt(0)
      );

      const url = URL.createObjectURL(
        new Blob([bytes], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        })
      );

      const link = document.createElement("a");
      link.href = url;
      link.download = saida.nome ?? "reclamacoes.xlsx";
      link.click();

      URL.revokeObjectURL(url);

    } catch (error) {
      console.error("[exportar] falhou", error);
      setErroExport("Falha ao gerar o arquivo.");
    } finally {
      setExportando(false);
    }
  }

  if (!open) return null;

  return (
    <Modal
      open
      size="wide"
      title="Importar e exportar"
      description="Planilha do Reclame Aqui exportada pelo HugMe."
      onClose={onClose}
      footer={
        <GhostButton onClick={onClose}>
          Fechar
        </GhostButton>
      }
    >

      <div className="space-y-6">

        {!hasDatabase && (
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-3 text-sm text-amber-800 ring-1 ring-inset ring-amber-100">
            <CircleAlert
              size={15}
              className="mt-0.5 shrink-0"
            />
            Sem banco configurado a importação fica
            indisponível — não haveria onde gravar.
          </p>
        )}

        {/* Importar */}

        <form action={formAction} className="space-y-3">

          <div>

            <p className="text-sm font-semibold text-zinc-900">
              Importar planilha
            </p>

            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              Use o export{" "}
              <strong className="font-medium text-zinc-700">
                Base de dados do Reclame Aqui
              </strong>{" "}
              do HugMe. O protocolo identifica cada
              reclamação: as que já existem são atualizadas,
              as novas entram. Nada é apagado.
            </p>

          </div>

          <input
            type="file"
            name="arquivo"
            accept=".xlsx,.xls"
            required
            disabled={!hasDatabase || importando}
            className="block w-full cursor-pointer rounded-xl border border-dashed border-zinc-300 px-4 py-4 text-sm text-zinc-600 file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-violet-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-violet-700 hover:border-violet-300 disabled:cursor-not-allowed disabled:opacity-60"
          />

          <button
            type="submit"
            disabled={!hasDatabase || importando}
            className="flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
          >
            {importando ? (
              <Loader2
                size={16}
                className="animate-spin"
              />
            ) : (
              <Upload size={16} />
            )}
            {importando
              ? "Importando..."
              : "Importar para o banco"}
          </button>

          {resultado.error && (
            <p className="flex items-start gap-2 rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-100">
              <CircleAlert
                size={15}
                className="mt-0.5 shrink-0"
              />
              {resultado.error}
            </p>
          )}

          {resultado.gravadas !== undefined && (

            <div className="rounded-xl bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800 ring-1 ring-inset ring-emerald-100">

              <p className="flex items-center gap-2 font-medium">
                <CircleCheck size={15} />
                {resultado.gravadas === 0
                  ? "Nada a atualizar — a base já está igual à planilha."
                  : `${resultado.gravadas} reclamação(ões) gravada(s).`}
              </p>

              <p className="mt-1 text-xs leading-relaxed text-emerald-700">
                {resultado.novas} nova(s),{" "}
                {resultado.atualizadas} atualizada(s) e{" "}
                {resultado.inalteradas} sem mudança — de{" "}
                {resultado.de} a {resultado.ate}.
              </p>

            </div>

          )}

        </form>

        {/* Exportar */}

        <div className="space-y-3 border-t border-zinc-100 pt-5">

          <div>

            <p className="text-sm font-semibold text-zinc-900">
              Exportar base atual
            </p>

            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              Gera um .xlsx com tudo que está no banco,
              incluindo a classificação e o trabalho da
              operação — responsável, etiquetas e resposta
              pública.
            </p>

          </div>

          <button
            onClick={baixar}
            disabled={!hasDatabase || exportando}
            className="flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {exportando ? (
              <Loader2
                size={16}
                className="animate-spin"
              />
            ) : (
              <Download size={16} />
            )}
            {exportando
              ? "Gerando..."
              : "Baixar planilha"}
          </button>

          {erroExport && (
            <p className="flex items-start gap-2 rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-100">
              <CircleAlert
                size={15}
                className="mt-0.5 shrink-0"
              />
              {erroExport}
            </p>
          )}

        </div>

        <p className="flex items-start gap-2 border-t border-zinc-100 pt-4 text-xs leading-relaxed text-zinc-400">
          <FileSpreadsheet
            size={13}
            className="mt-0.5 shrink-0"
          />
          O export do HugMe traz CPF, e-mail e telefone do
          consumidor. Esses dados ficam no banco, com acesso
          controlado — não no repositório.
        </p>

      </div>

    </Modal>
  );
}
