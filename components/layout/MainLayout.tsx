import Sidebar from "./Sidebar";
import TopBar from "./Topbar";

interface Props {
  children: React.ReactNode;
}

export default function MainLayout({
  children,
}: Props) {
  return (
    <div className="flex h-screen bg-[#F6F7FB]">

      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">

        <TopBar />

        <main className="flex-1 overflow-auto px-6 py-6 lg:px-8">

          <div className="mx-auto min-h-full w-full max-w-[1600px]">

            {children}

          </div>

        </main>

      </div>

    </div>
  );
}
