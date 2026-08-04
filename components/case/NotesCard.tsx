import Card from "@/components/design-system/Card";

export default function NotesCard() {
  return (
    <Card>

      <h2 className="text-xl font-semibold mb-5">
        Observações
      </h2>

      <textarea
        className="min-h-[180px] w-full rounded-xl border p-4"
        placeholder="Registrar observações..."
      />

    </Card>
  );
}