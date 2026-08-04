import CommentList from "@/components/comments/CommentList";
import NewComment from "@/components/comments/NewComment";

export default function CommentsTab() {
  return (
    <div className="space-y-6">

      <CommentList />

      <NewComment />

    </div>
  );
}