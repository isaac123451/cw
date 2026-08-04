"use client";

import {
  Download,
  Eye,
  FileText,
  ImageIcon,
  Trash2,
  Upload,
  Paperclip,
} from "lucide-react";

import { useState } from "react";


interface Attachment {
  id: number;
  name: string;
  type: "image" | "pdf";
  size: string;
  date: string;
}



const initialAttachments: Attachment[] = [

  {
    id: 1,
    name: "print-conversa.png",
    type: "image",
    size: "1,8 MB",
    date: "Hoje • 14:35",
  },


  {
    id: 2,
    name: "nota-fiscal.pdf",
    type: "pdf",
    size: "420 KB",
    date: "Ontem • 09:12",
  },

];



export default function AttachmentsTab() {


  const [
    attachments,
    setAttachments
  ] = useState<Attachment[]>(
    initialAttachments
  );




  function removeAttachment(id:number){

    setAttachments((current)=>
      current.filter(
        item=>item.id !== id
      )
    );

  }





  return (

    <div className="space-y-6">



      {/* Upload */}

      <div
        className="
          rounded-2xl
          border-2
          border-dashed
          border-zinc-300
          bg-zinc-50
          p-8
          text-center
        "
      >


        <div
          className="
            mx-auto
            flex
            h-16
            w-16
            items-center
            justify-center
            rounded-full
            bg-violet-100
            text-violet-600
          "
        >

          <Upload size={30}/>

        </div>



        <h3 className="mt-5 text-lg font-semibold">

          Adicionar anexos

        </h3>



        <p className="mt-2 text-sm text-zinc-500">

          Envie imagens, documentos ou comprovantes relacionados ao caso.

        </p>




        <button
          className="
            mt-5
            rounded-xl
            bg-violet-600
            px-6
            py-3
            text-sm
            font-medium
            text-white
            hover:bg-violet-700
          "
        >

          Selecionar arquivos

        </button>


      </div>







      {/* Lista */}

      <div>


        <div
          className="
            mb-4
            flex
            items-center
            justify-between
          "
        >


          <div className="flex items-center gap-2">

            <Paperclip size={20}/>


            <h3 className="text-lg font-semibold">

              Arquivos anexados

            </h3>


          </div>



          <span
            className="
              rounded-full
              bg-zinc-100
              px-3
              py-1
              text-xs
              font-medium
            "
          >

            {attachments.length} arquivos

          </span>


        </div>





        <div className="space-y-3">


          {attachments.length === 0 ? (

            <div
              className="
                rounded-xl
                border
                border-zinc-200
                p-5
                text-sm
                text-zinc-500
              "
            >

              Nenhum arquivo anexado.

            </div>

          ) : (


            attachments.map((file)=>(


              <div
                key={file.id}
                className="
                  flex
                  items-center
                  justify-between
                  rounded-2xl
                  border
                  border-zinc-200
                  bg-white
                  p-4
                "
              >



                <div className="flex items-center gap-4">


                  <div
                    className="
                      rounded-xl
                      bg-violet-100
                      p-3
                      text-violet-600
                    "
                  >

                    {file.type === "image" ? (

                      <ImageIcon size={22}/>

                    ) : (

                      <FileText size={22}/>

                    )}

                  </div>





                  <div>

                    <p className="font-medium">

                      {file.name}

                    </p>


                    <p className="text-sm text-zinc-500">

                      {file.size} • {file.date}

                    </p>


                  </div>


                </div>





                <div className="flex items-center gap-1">


                  <button
                    className="
                      rounded-lg
                      p-2
                      hover:bg-zinc-100
                    "
                  >

                    <Eye size={18}/>

                  </button>



                  <button
                    className="
                      rounded-lg
                      p-2
                      hover:bg-zinc-100
                    "
                  >

                    <Download size={18}/>

                  </button>




                  <button

                    onClick={() =>
                      removeAttachment(file.id)
                    }

                    className="
                      rounded-lg
                      p-2
                      text-red-500
                      hover:bg-red-50
                    "

                  >

                    <Trash2 size={18}/>

                  </button>



                </div>




              </div>


            ))

          )}


        </div>


      </div>



    </div>

  );

}