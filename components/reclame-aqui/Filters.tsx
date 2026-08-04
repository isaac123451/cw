export default function Filters() {
  return (
    <div className="mb-6 flex gap-4">

      <input
        placeholder="Pesquisar empresa..."
        className="w-80 rounded-xl border px-4 py-3"
      />

      <select className="rounded-xl border px-4 py-3">
        <option>Status</option>
        <option>Novo</option>
        <option>Em Atendimento</option>
        <option>Resolvido</option>
      </select>

      <select className="rounded-xl border px-4 py-3">
        <option>Categoria</option>
        <option>Fiscal</option>
        <option>Financeiro</option>
        <option>Sistema</option>
      </select>

      <select className="rounded-xl border px-4 py-3">
        <option>Prioridade</option>
        <option>Crítica</option>
        <option>Alta</option>
        <option>Média</option>
        <option>Baixa</option>
      </select>

    </div>
  );
}