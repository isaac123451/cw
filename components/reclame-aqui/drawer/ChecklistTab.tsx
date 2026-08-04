"use client";

import {
  CheckCircle2,
  Circle,
  ListChecks,
} from "lucide-react";


const checklist = [
  {
    id: 1,
    title: "Validar dados do cliente",
    description:
      "Conferir informações de contato e identificação.",
    done: true,
  },

  {
    id: 2,
    title: "Conferir pedido",
    description:
      "Validar histórico do pedido ou contratação.",
    done: true,
  },

  {
    id: 3,
    title: "Analisar reclamação",
    description:
      "Identificar causa raiz do problema.",
    done: false,
  },

  {
    id: 4,
    title: "Responder empresa",
    description:
      "Enviar retorno interno para o estabelecimento.",
    done: false,
  },

  {
    id: 5,
    title: "Publicar resposta",
    description:
      "Enviar resposta pública no Reclame Aqui.",
    done: false,
  },

];


export default function ChecklistTab() {


  const completed = checklist.filter(
    item => item.done
  ).length;


  const percentage = Math.round(
    (completed / checklist.length) * 100
  );


  return (
    <div className="space-y-6">


      {/* Cabeçalho */}

      <div
        className="
          rounded-2xl
          border
          border-zinc-200
          bg-white
          p-5
        "
      >

        <div className="flex items-center gap-3">

          <div
            className="
              rounded-xl
              bg-violet-100
              p-3
              text-violet-700
            "
          >

            <ListChecks size={22}/>

          </div>


          <div>

            <h3 className="font-semibold">
              Andamento do Checklist
            </h3>


            <p className="text-sm text-zinc-500">
              {completed} de {checklist.length} etapas concluídas
            </p>


          </div>


        </div>



        {/* Barra progresso */}

        <div className="mt-5">

          <div className="mb-2 flex justify-between text-xs">

            <span>
              Progresso
            </span>


            <span className="font-semibold">
              {percentage}%
            </span>


          </div>


          <div
            className="
              h-2
              overflow-hidden
              rounded-full
              bg-zinc-200
            "
          >

            <div
              className="
                h-full
                rounded-full
                bg-violet-600
              "
              style={{
                width:`${percentage}%`
              }}
            />


          </div>


        </div>


      </div>





      {/* Etapas */}

      <div className="space-y-3">


        {checklist.map((item)=> (

          <div
            key={item.id}
            className="
              flex
              items-center
              gap-4
              rounded-2xl
              border
              border-zinc-200
              bg-white
              p-4
            "
          >


            <button
              className="
                flex
                h-8
                w-8
                items-center
                justify-center
              "
            >

              {item.done ? (

                <CheckCircle2
                  className="text-green-600"
                  size={24}
                />

              ) : (

                <Circle
                  className="text-zinc-400"
                  size={24}
                />

              )}

            </button>



            <div className="flex-1">


              <h4
                className={`
                  font-medium
                  ${
                    item.done
                    ? "text-zinc-400 line-through"
                    : "text-zinc-900"
                  }
                `}
              >
                {item.title}
              </h4>


              <p className="mt-1 text-sm text-zinc-500">
                {item.description}
              </p>


            </div>



            <span
              className={`
                rounded-full
                px-3
                py-1
                text-xs
                font-semibold

                ${
                  item.done
                  ? "bg-green-100 text-green-700"
                  : "bg-yellow-100 text-yellow-700"
                }
              `}
            >

              {item.done
                ? "Concluído"
                : "Pendente"
              }

            </span>


          </div>


        ))}


      </div>


    </div>
  );
}