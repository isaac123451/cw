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

      {/*
        A lateral fixa só a partir de lg.

        São 256 px de largura: num celular de 375 sobrariam 119 para o
        conteúdo, e a barra de cima transbordava para fora da janela.
        Abaixo de lg quem navega é a gaveta do MobileNav.
      */}
      <div className="hidden lg:flex">
        <Sidebar />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">

        <TopBar />

        <main className="flex-1 overflow-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8">

          <div className="mx-auto min-h-full w-full max-w-[1600px]">

            {children}

          </div>

        </main>

      </div>

    </div>
  );
}
