/**
 * O telefone como se lê (out/2026).
 *
 * As fichas mostravam o número como estava gravado — "11960599984",
 * "5511960599984" —, e quem precisava ditar ou conferir um número contava
 * dígito por dígito. Aqui:
 *
 * - 55 + DDD + 8 ou 9 dígitos: "+55 11 96059-9984";
 * - DDD + 8 ou 9 dígitos: "(11) 96059-9984";
 * - o resto volta como veio — o mascarado da base ("(11)•••••-1234"), o
 *   estrangeiro, o incompleto. Melhor cru do que formatado errado.
 */
export function telefoneLegivel(valor?: string | null): string {
  const bruto = String(valor ?? "").trim();
  if (!bruto || bruto.includes("•")) return bruto;
  const d = bruto.replace(/\D/g, "");
  /* "+" de outro país: os dígitos não são DDD + número brasileiro. */
  if (bruto.startsWith("+") && !d.startsWith("55")) return bruto;
  const comPais = d.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  if (comPais) return `+55 ${comPais[1]} ${comPais[2]}-${comPais[3]}`;
  const local = d.match(/^(\d{2})(\d{4,5})(\d{4})$/);
  if (local) return `(${local[1]}) ${local[2]}-${local[3]}`;
  return bruto;
}
