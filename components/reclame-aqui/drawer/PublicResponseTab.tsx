"use client";

import { useState } from "react";

import {
  Send,
  Save,
  MessageSquare,
} from "lucide-react";

import { Case } from "@/lib/models/case";


interface Props {
  data: Case;
}


const responseHistory = [
  {
    id: 1,
    user: "Carlos",
    date: "Hoje 12:30",
    text:
      "Olá, João. Identificamos o problema e estamos trabalhando para solucionar.",
  },

];



export default function PublicResponseTab({
  data,
}: Props) {


  const [response, setResponse] = useState(
    data.publicResponse || ""
  );


  return (
    <div className="space-y-6">


      {/* Editor */}

      <div
        className="rounded-2xl border border-zinc-200 bg-white p-5"
      >

        <div className="mb-4 flex items-center gap-2">

          <MessageSquare size={20}/>

          <h3 className="font-semibold">
            Resposta pública
          </h3>

        </div>



        <textarea

          value={response}

          onChange={(e)=>setResponse(e.target.value)}

          rows={10}

          placeholder="Digite a resposta que será publicada no Reclame Aqui..."

          className="w-full resize-none rounded-xl border border-zinc-200 p-4 text-sm outline-none focus:border-violet-500"

        />



        <div
          className="mt-3 flex items-center justify-between text-xs text-zinc-500"
        >

          <span>
            {response.length} caracteres
          </span>


          <span>
            Recomendado: até 3000 caracteres
          </span>


        </div>



        <div
          className="mt-5 flex justify-end gap-3"
        >

          <button
            className="flex items-center gap-2 rounded-xl border border-zinc-300 px-5 py-3 text-sm font-medium"
          >

            <Save size={16}/>

            Salvar rascunho

          </button>



          <button
            className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-medium text-white hover:bg-violet-700"
          >

            <Send size={16}/>

            Publicar resposta

          </button>


        </div>


      </div>





      {/* Histórico */}

      <div>


        <h3 className="mb-4 text-lg font-semibold">
          Histórico de respostas
        </h3>



        <div className="space-y-3">


          {responseHistory.length === 0 ? (

            <div
              className="rounded-xl border border-zinc-200 p-5 text-sm text-zinc-500"
            >

              Nenhuma resposta publicada.

            </div>

          ) : (


            responseHistory.map((item)=> (

              <div
                key={item.id}
                className="rounded-2xl border border-zinc-200 bg-white p-5"
              >

                <div
                  className="flex justify-between"
                >

                  <p className="font-semibold">
                    {item.user}
                  </p>


                  <span className="text-xs text-zinc-500">
                    {item.date}
                  </span>


                </div>


                <p className="mt-3 text-sm text-zinc-700">
                  {item.text}
                </p>


              </div>

            ))

          )}


        </div>


      </div>


    </div>
  );
}