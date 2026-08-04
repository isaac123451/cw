interface Comment {
  id: number;
  author: string;
 message: string;
  createdAt: string;
}

const comments: Comment[] = [
  {
    id: 1,
    author: "Carlos Isaac",
    message: "Caso recebido pelo Reclame Aqui.",
    createdAt: "Hoje • 09:20",
  },
  {
    id: 2,
    author: "Equipe Fiscal",
    message: "Em análise.",
    createdAt: "Hoje • 09:45",
  },
];

export default function CommentList() {
  return (
    <div className="space-y-4">
      {comments.map((comment) => (
        <div
          key={comment.id}
          className="rounded-xl border bg-white p-4"
        >
          <div className="mb-2 flex items-center justify-between">
            <strong>{comment.author}</strong>

            <span className="text-sm text-zinc-500">
              {comment.createdAt}
            </span>
          </div>

          <p>{comment.message}</p>
        </div>
      ))}
    </div>
  );
}