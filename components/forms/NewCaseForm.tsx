"use client";

import { useState } from "react";

export default function NewCaseForm() {
  const [form, setForm] = useState({
    company: "",
    source: "Reclame Aqui",
    category: "",
    priority: "Média",
    status: "Novo",
    owner: "Carlos Isaac",
  });

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    console.log(form);

    alert("Caso criado (mock)");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-2xl border bg-white p-8"
    >
      <h2 className="text-2xl font-bold">
        Novo Caso
      </h2>

      <div className="grid grid-cols-2 gap-6">

        <div>
          <label className="mb-2 block text-sm font-medium">
            Empresa
          </label>

          <input
            name="company"
            value={form.company}
            onChange={handleChange}
            className="w-full rounded-xl border p-3"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Origem
          </label>

          <select
            name="source"
            value={form.source}
            onChange={handleChange}
            className="w-full rounded-xl border p-3"
          >
            <option>Reclame Aqui</option>
            <option>Instagram</option>
            <option>Facebook</option>
            <option>Google</option>
            <option>LinkedIn</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Categoria
          </label>

          <input
            name="category"
            value={form.category}
            onChange={handleChange}
            className="w-full rounded-xl border p-3"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Prioridade
          </label>

          <select
            name="priority"
            value={form.priority}
            onChange={handleChange}
            className="w-full rounded-xl border p-3"
          >
            <option>Baixa</option>
            <option>Média</option>
            <option>Alta</option>
            <option>Crítica</option>
          </select>
        </div>

      </div>

      <button
        className="rounded-xl bg-violet-600 px-6 py-3 text-white transition hover:bg-violet-700"
      >
        Criar Caso
      </button>

    </form>
  );
}