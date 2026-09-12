/**
 * Prova do relógio de horas úteis — `lib/services/horasUteis.ts`.
 *
 * Sem banco: cada caso é uma data de parede em Brasília e o prazo que a
 * documentação do time exige para ela. As datas são reais de 2026 —
 * feriado de 7 de setembro numa segunda, 12 de outubro numa segunda,
 * sexta à noite — porque é nelas que um relógio ingênuo erra.
 *
 *   npm run check:horas-uteis
 */
import {
  descreverMinutosUteis,
  descreverPrazo,
  EXPEDIENTE_PADRAO,
  ehDiaUtil,
  expedienteValido,
  folgaDoDia,
  inicioUtil,
  instanteDe,
  minutosUteisEntre,
  paredeDe,
  pascoa,
  prazoUtil,
} from "../lib/services/horasUteis";

let falhas = 0;

function confere(nome: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`${ok ? "ok  " : "FALHOU"}  ${nome}${ok ? "" : `\n        esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`}`);
}

/** "2026-09-15 16:00" em Brasília → Date. */
function br(texto: string) {
  const [dia, hora] = texto.split(" ");
  const [h, m] = hora.split(":").map(Number);
  return instanteDe(dia, h * 60 + m);
}

/** Date → "2026-09-16 10:00" em Brasília. */
function mostra(d: Date) {
  const { dia, min } = paredeDe(d);
  return `${dia} ${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

console.log("\n— Páscoa e feriados móveis —");
confere("Páscoa 2024", pascoa(2024), "2024-03-31");
confere("Páscoa 2025", pascoa(2025), "2025-04-20");
confere("Páscoa 2026", pascoa(2026), "2026-04-05");
confere("Páscoa 2027", pascoa(2027), "2027-03-28");
confere("Sexta-feira Santa 2026", folgaDoDia("2026-04-03"), "Sexta-feira Santa");
confere("Carnaval 2026 (segunda)", folgaDoDia("2026-02-16"), "Carnaval");
confere("Carnaval 2026 (terça)", folgaDoDia("2026-02-17"), "Carnaval");
confere("Corpus Christi 2026", folgaDoDia("2026-06-04"), "Corpus Christi");
confere("Independência 2026", folgaDoDia("2026-09-07"), "Independência do Brasil");
confere("Consciência Negra 2026", folgaDoDia("2026-11-20"), "Dia Nacional de Zumbi e da Consciência Negra");
confere("Consciência Negra 2023 ainda não era nacional", folgaDoDia("2023-11-20"), null);

console.log("\n— Dia útil —");
confere("sábado não é útil", ehDiaUtil("2026-09-12"), false);
confere("segunda comum é útil", ehDiaUtil("2026-09-14"), true);
confere("feriado numa segunda não é útil", ehDiaUtil("2026-09-07"), false);
confere(
  "Carnaval é útil quando o expediente conta ponto facultativo",
  ehDiaUtil("2026-02-16", { ...EXPEDIENTE_PADRAO, pularFacultativos: false }),
  true
);

console.log("\n— Onde o relógio começa —");
confere("dentro do expediente começa na hora", mostra(instanteDe(inicioUtil(br("2026-09-15 10:30")).dia, inicioUtil(br("2026-09-15 10:30")).min)), "2026-09-15 10:30");
confere("antes da abertura começa às 08h", inicioUtil(br("2026-09-15 06:10")), { dia: "2026-09-15", min: 480 });
confere("sexta à noite começa segunda às 08h", inicioUtil(br("2026-09-11 22:00")), { dia: "2026-09-14", min: 480 });
confere("23h59 de Brasília ainda é o mesmo dia", paredeDe(br("2026-09-15 23:59")).dia, "2026-09-15");

console.log("\n— Prazos da documentação —");
confere("Urgente, 4h úteis às 16h → 10h do dia seguinte", mostra(prazoUtil(br("2026-09-15 16:00"), 4)), "2026-09-16 10:00");
confere("4h úteis às 09h → 13h do mesmo dia", mostra(prazoUtil(br("2026-09-15 09:00"), 4)), "2026-09-15 13:00");
confere("Alta, 24h úteis numa sexta às 10h → segunda às 10h", mostra(prazoUtil(br("2026-09-11 10:00"), 24)), "2026-09-14 10:00");
confere("24h úteis numa sexta às 22h → terça às 08h", mostra(prazoUtil(br("2026-09-11 22:00"), 24)), "2026-09-15 08:00");
confere("24h úteis pulam o 7 de setembro", mostra(prazoUtil(br("2026-09-04 10:00"), 24)), "2026-09-08 10:00");
confere("Normal, 48h úteis numa quarta às 09h → sexta às 09h", mostra(prazoUtil(br("2026-09-16 09:00"), 48)), "2026-09-18 09:00");
confere("7 dias úteis pulam o 12 de outubro", mostra(prazoUtil(br("2026-10-05 09:00"), 7 * 24)), "2026-10-15 09:00");
confere("1h às 17h30 de sexta → segunda às 08h30", mostra(prazoUtil(br("2026-09-11 17:30"), 1)), "2026-09-14 08:30");
confere("4h úteis que terminam no fechamento", mostra(prazoUtil(br("2026-09-15 14:00"), 4)), "2026-09-15 18:00");

console.log("\n— Tempo útil entre dois instantes —");
confere("sexta 17h → segunda 09h = 2h úteis", minutosUteisEntre(br("2026-09-11 17:00"), br("2026-09-14 09:00")), 120);
confere("ao contrário, negativo", minutosUteisEntre(br("2026-09-14 09:00"), br("2026-09-11 17:00")), -120);
confere("o fim de semana inteiro vale zero", minutosUteisEntre(br("2026-09-12 08:00"), br("2026-09-13 20:00")), 0);
confere("um expediente inteiro vale 600 min", minutosUteisEntre(br("2026-09-15 00:00"), br("2026-09-16 00:00")), 600);
confere(
  "o prazo de 4h mede 240 min úteis a partir do início",
  minutosUteisEntre(br("2026-09-15 16:00"), prazoUtil(br("2026-09-15 16:00"), 4)),
  240
);

console.log("\n— Como se escreve —");
confere("2h40", descreverMinutosUteis(160), "2h40");
confere("45min", descreverMinutosUteis(45), "45min");
confere("1 dia útil", descreverMinutosUteis(600), "1 dia útil");
confere("1 dia útil e 1h", descreverMinutosUteis(660), "1 dia útil e 1h");
confere("prazo de 4h", descreverPrazo(4), "4h úteis");
confere("prazo de 24h", descreverPrazo(24), "1 dia útil");
confere("prazo de 120h", descreverPrazo(120), "5 dias úteis");

console.log("\n— Expediente que não faz sentido volta ao padrão —");
confere("abertura depois do fechamento", expedienteValido({ inicioMin: 1080, fimMin: 480, dias: [1] }), EXPEDIENTE_PADRAO);
confere("nenhum dia útil", expedienteValido({ inicioMin: 480, fimMin: 1080, dias: [] }), EXPEDIENTE_PADRAO);
confere(
  "expediente de sábado aceito",
  expedienteValido({ inicioMin: 540, fimMin: 780, dias: [6, 1], pularFacultativos: false }),
  { inicioMin: 540, fimMin: 780, dias: [1, 6], pularFacultativos: false }
);

console.log(falhas === 0 ? "\nTudo certo." : `\n${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
