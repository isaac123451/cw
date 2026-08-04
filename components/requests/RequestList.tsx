import RequestCard from "./RequestCard";

const requests = [
  {
    title: "Desconto",
    status: "Concedido",
  },
  {
    title: "Treinamento",
    status: "Em análise",
  },
];

export default function RequestList() {
  return (
    <div className="space-y-4">

      {requests.map((item) => (
        <RequestCard
          key={item.title}
          title={item.title}
          status={item.status}
        />
      ))}

    </div>
  );
}