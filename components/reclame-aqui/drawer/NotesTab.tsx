"use client";

import {
  MessageSquare,
  Send,
} from "lucide-react";


const notes = [
  {
    id: 1,
    user: "Carlos",
    date: "Hoje 10:30",
    text:
      "Cliente informou que aguarda retorno da empresa.",
  },

  {
    id: 2,
    user: "Ana",
    date: "Hoje 11:15",
    text:
      "Solicitado comprovante do pedido para análise.",
  },

];


export default function NotesTab() {


  return (
    <div className="space-y-6">


      {/* Novo comentário */}

      <div
        className="
          rounded-2xl
          border
          border-zinc-200
          bg-white
          p-5
        "
      >

        <div className="mb-4 flex items-center gap-2">

          <MessageSquare size={20}/>

          <h3 className="font-semibold">
            Novo comentário interno
          </h3>

        </div>



        <textarea
          rows={5}
          placeholder="Digite uma observação interna para o time..."
          className="
            w-full
            resize-none
            rounded-xl
            border
            border-zinc-200
            p-4
            text-sm
            outline-none
            transition
            focus:border-violet-500
          "
        />


        <div className="mt-4 flex justify-end">

          <button
            className="
              flex
              items-center
              gap-2
              rounded-xl
              bg-violet-600
              px-5
              py-3
              text-sm
              font-medium
              text-white
              transition
              hover:bg-violet-700
            "
          >

            <Send size={16}/>

            Salvar comentário

          </button>


        </div>


      </div>





      {/* Histórico de comentários */}

      <div>

        <h3 className="mb-4 text-lg font-semibold">
          Comentários internos
        </h3>



        <div className="space-y-3">


          {notes.map((note)=> (

            <div
              key={note.id}
              className="
                rounded-2xl
                border
                border-zinc-200
                bg-white
                p-5
              "
            >

              <div
                className="
                  flex
                  items-center
                  justify-between
                "
              >

                <div>

                  <p className="font-semibold">
                    {note.user}
                  </p>


                  <p className="text-xs text-zinc-500">
                    {note.date}
                  </p>

                </div>


              </div>


              <p className="mt-3 text-sm text-zinc-700">
                {note.text}
              </p>


            </div>

          ))}


        </div>


      </div>


    </div>
  );
}