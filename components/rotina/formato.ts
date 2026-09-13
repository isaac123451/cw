/** "45min", "1h30", "3h" — minutos de trabalho, para o plano e a rotina. */
export function descreverMinutos(min: number) {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}min`;
  return r ? `${h}h${String(r).padStart(2, "0")}` : `${h}h`;
}
