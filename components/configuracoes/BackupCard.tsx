"use client";

import { useEffect, useState } from "react";

import { Download, HardDrive } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";

import { estadoDoBackup } from "@/lib/actions/backup";

/**
 * O backup da base, para quem administra (Fase 31, 1.99).
 *
 * O botão baixa a cópia de agora (JSON compactado, sem senhas, chaves nem
 * códigos). A cópia diária fora do banco — no Supabase Storage, as 14 mais
 * novas — liga quando a Vercel tem as duas variáveis; o cartão diz se está
 * ligada, sem fingir.
 */
export default function BackupCard() {
  const [estado, setEstado] = useState<{ admin: boolean; diario: boolean } | null>(null);

  useEffect(() => {
    let vivo = true;
    estadoDoBackup().then((e) => vivo && setEstado(e)).catch(() => vivo && setEstado({ admin: false, diario: false }));
    return () => {
      vivo = false;
    };
  }, []);

  if (!estado?.admin) return null;

  return (
    <SurfaceCard
      title="Backup da base"
      description="Uma cópia de todas as tabelas, compactada. Serve para desfazer um erro — um lote apagado, uma importação errada."
      action={
        <a
          href="/api/backup"
          className="flex items-center gap-1.5 rounded-xl bg-violet-700 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-800"
        >
          <Download size={15} />
          Baixar backup agora
        </a>
      }
    >
      <p className="flex items-start gap-2 text-sm text-zinc-700">
        <HardDrive size={15} className="mt-0.5 shrink-0 text-zinc-400" />
        {estado.diario ? (
          <span>
            <b>Cópia diária ligada:</b> a rotina da madrugada guarda a cópia no Supabase Storage (bucket <code>backups</code>) e mantém as 14 mais novas.
          </span>
        ) : (
          <span>
            <b>Cópia diária desligada.</b> Para a rotina da madrugada guardar uma cópia por dia fora do banco, ponha{" "}
            <code>SUPABASE_URL</code> e <code>SUPABASE_SERVICE_ROLE_KEY</code> nas variáveis da Vercel (Supabase → Project Settings → API). Até lá, o
            botão acima baixa a cópia na hora.
          </span>
        )}
      </p>
      <p className="mt-2 text-xs text-zinc-500">Senhas, chaves de acesso, tokens do Google e códigos de verificação ficam fora da cópia.</p>
    </SurfaceCard>
  );
}
