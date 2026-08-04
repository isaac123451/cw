import Sidebar from "./Sidebar";
import TopBar from "./Topbar";

interface Props {
  children: React.ReactNode;
}

export default function MainLayout({
  children,
}: Props) {
  return (
    <div className="flex h-screen bg-zinc-100">

      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">

        <TopBar />

        <main className="flex-1 overflow-auto p-6">

          {children}

        </main>

      </div>

    </div>
  );
}