"use client";

export default function NewComment() {
  return (
    <div className="rounded-xl border bg-white p-5">

      <h3 className="mb-4 font-semibold">
        Novo comentário
      </h3>

      <textarea
        className="min-h-32 w-full rounded-lg border p-3"
        placeholder="Escreva um comentário..."
      />

      <button
        className="mt-4 rounded-lg bg-violet-600 px-5 py-2 text-white"
      >
        Salvar comentário
      </button>

    </div>
  );
}