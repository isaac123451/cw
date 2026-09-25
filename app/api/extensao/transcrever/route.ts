import { autenticar, responder, responderPreVoo, semSessao } from "@/lib/api/extensao";
import { transcreverAudio } from "@/lib/services/ia.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Até ~3 MB de áudio (4 MB em base64): alguns minutos de mensagem de voz. */
const TETO_BASE64 = 4_200_000;

/**
 * Transcrição da mensagem de voz que a pessoa ouviu no WhatsApp (1.82).
 *
 * A extensão manda o áudio só quando vai guardar a conversa — e só o que
 * a pessoa já tocou. Volta o texto falado; quem guarda (e marca como
 * transcrição) é a gravação da conversa. Nada fica guardado aqui.
 */
export async function POST(request: Request) {
  const { usuario, demonstracao } = await autenticar(request);
  if (!usuario && !demonstracao) return semSessao(request);
  if (!usuario) return responder(request, { erro: "Entre na aplicação para transcrever." }, 401);

  const entrada = (await request.json().catch(() => ({}))) as { base64?: string; mime?: string };
  const base64 = String(entrada.base64 ?? "");
  const mime = String(entrada.mime ?? "audio/ogg");
  if (!base64 || !/^audio\//.test(mime)) return responder(request, { erro: "Áudio ausente." }, 400);
  if (base64.length > TETO_BASE64) return responder(request, { erro: "Áudio longo demais para transcrever." }, 413);

  const r = await transcreverAudio({ base64, mime });
  return r.ok ? responder(request, { texto: r.texto }) : responder(request, { erro: r.erro }, 502);
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
