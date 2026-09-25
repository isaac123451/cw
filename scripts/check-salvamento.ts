/**
 * Salvamento que avisa — o aviso, a ponte do áudio e a marca de transcrição.
 *
 *   npm run check:salvamento
 *
 * Sem navegador e sem banco: confere as peças no código. A transcrição
 * em si foi provada com um áudio sintetizado (ver ROADMAP, 1.82).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(64)} ${String(JSON.stringify(obtido)).slice(0, 30)}`);
}
const ler = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n");

console.log("\n  SALVAMENTO QUE AVISA\n");

const ponte = ler("extensao/conteudo/audio-ponte.js");
conferir("a ponte só avisa endereço blob:, e nunca toca nada sozinha", [ponte.includes('startsWith("blob:")'), (ponte.match(/\.play\(|tocar\.apply/g) ?? []).length], [true, 1]);
conferir("a ponte não fala com a rede", /fetch\(|XMLHttpRequest|chrome\./.test(ponte), false);

const manifesto = JSON.parse(ler("extensao/manifest.json")) as { content_scripts: { js: string[]; world?: string; run_at?: string }[] };
const entrada = manifesto.content_scripts.find((c) => c.js.includes("conteudo/audio-ponte.js"));
conferir("a ponte roda no mundo da página, no início", [entrada?.world, entrada?.run_at], ["MAIN", "document_start"]);

const painel = ler("extensao/conteudo/painel-contato.js");
conferir("a gravação sozinha transcreve só o áudio já ouvido", painel.includes("a.endereco && !ja.has(`${a.id}:t`)"), true);
conferir("a transcrição vai marcada", painel.includes("transcricao: true"), true);
conferir("avisa fora do painel ao guardar e ao falhar (uma vez por motivo)", [painel.includes("CW.notificar?.(\n            `Conversa guardada"), painel.includes("ultimoAvisoDeFalha.get(tel) !== erro")], [true, true]);

const nucleo = ler("extensao/conteudo/nucleo.js");
conferir("o aviso é texto (textContent), não HTML", nucleo.includes("pilula.textContent = String(texto"), true);

const servico = ler("lib/services/conversas.service.ts");
conferir("a mensagem transcrita é gravada com origem \"transcricao\"", servico.includes('origem: m.transcricao ? "transcricao" : entrada.origem'), true);
const baloes = ler("components/conversas/Baloes.tsx");
conferir("a tela marca a transcrição de áudio", baloes.includes('m.origem === "transcricao"'), true);

console.log(`\n  ${falhas === 0 ? "Tudo certo." : `${falhas} falha(s).`}\n`);
process.exit(falhas === 0 ? 0 : 1);
