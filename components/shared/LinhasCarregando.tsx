/**
 * O lugar de uma lista enquanto os dados não chegaram (out/2026).
 *
 * Existe porque o vazio de cada bloco é uma afirmação — "Nenhum caso
 * crítico em aberto", "Nada pendente para hoje" — e ela aparecia durante a
 * carga, antes de haver o que contar. Quem olhava primeiro acreditava.
 */
export default function LinhasCarregando({ linhas = 3, className = "" }: { linhas?: number; className?: string }) {
  return (
    <div aria-busy="true" aria-label="Carregando" className={`space-y-2.5 ${className}`}>
      {Array.from({ length: linhas }, (_, i) => (
        <span
          key={i}
          className="block h-3.5 animate-pulse rounded bg-zinc-100"
          style={{ width: `${[78, 62, 70, 54][i % 4]}%` }}
        />
      ))}
    </div>
  );
}
