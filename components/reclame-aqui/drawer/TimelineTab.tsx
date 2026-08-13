"use client";

import {
  Upload,
  UserCog,
  MessageCircle,
  Clock3,
} from "lucide-react";


const events = [
  {
    title: "Caso importado do Reclame Aqui",
    description:
      "A reclamação foi criada automaticamente através da importação.",
    time: "Hoje 08:15",
    icon: Upload,
  },

  {
    title: "Responsável atribuído",
    description:
      "O caso foi direcionado para Carlos.",
    time: "Hoje 09:22",
    icon: UserCog,
  },

  {
    title: "Cliente respondeu",
    description:
      "Nova interação recebida através da plataforma Reclame Aqui.",
    time: "Hoje 10:04",
    icon: MessageCircle,
  },

  {
    title: "Aguardando resolução",
    description:
      "Caso permanece em acompanhamento pelo time responsável.",
    time: "Hoje 11:30",
    icon: Clock3,
  },

];


export default function TimelineTab() {

  return (
    <div className="space-y-6">


      <div>

        <h3 className="text-lg font-semibold">
          Histórico do Caso
        </h3>


        <p className="mt-1 text-sm text-zinc-500">
          Todas as movimentações realizadas neste atendimento.
        </p>


      </div>



      <div className="relative">


        {/* linha vertical */}

        <div
          className="absolute left-5 top-5 h-[calc(100%-40px)] w-px bg-zinc-200"
        />



        <div className="space-y-6">


          {events.map((event,index)=>{


            const Icon = event.icon;


            return (

              <div
                key={index}
                className="relative flex gap-4"
              >


                <div
                  className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700"
                >

                  <Icon size={18}/>

                </div>



                <div
                  className="flex-1 rounded-2xl border border-zinc-200 bg-white p-4"
                >

                  <div className="flex items-start justify-between">


                    <div>

                      <h4 className="font-semibold">
                        {event.title}
                      </h4>


                      <p className="mt-1 text-sm text-zinc-500">
                        {event.description}
                      </p>


                    </div>


                    <span className="text-xs text-zinc-400">
                      {event.time}
                    </span>


                  </div>


                </div>


              </div>

            );

          })}


        </div>


      </div>


    </div>
  );
}