"use client";

import {
  X,
  Star,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";


interface Props {
  protocol: string;
  company: string;
  title?: string;
  status?: string;
  priority?: string;
  score?: number;
  resolved?: boolean;
  onClose: () => void;
}


export default function DrawerHeader({
  protocol,
  company,
  title,
  status,
  priority,
  score,
  resolved,
  onClose,
}: Props) {


  return (

    <div
      className="flex items-start justify-between border-b border-zinc-200 bg-white px-6 py-5"
    >


      <div className="min-w-0">


        <div className="flex items-center gap-3">


          <p
            className="text-xs font-semibold uppercase tracking-wide text-zinc-500"
          >

            {protocol}

          </p>



          {resolved ? (

            <span
              className="flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700"
            >

              <CheckCircle2 size={14}/>

              Resolvido

            </span>


          ) : (

            <span
              className="flex items-center gap-1 rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700"
            >

              <AlertCircle size={14}/>

              Em andamento

            </span>

          )}


        </div>




        <h2
          className="mt-2 text-xl font-bold text-zinc-900"
        >

          {company}

        </h2>




        {title && (

          <p
            className="mt-1 max-w-[500px] truncate text-sm text-zinc-500"
          >

            {title}

          </p>

        )}





        <div className="mt-4 flex flex-wrap gap-2">


          {status && (

            <span
              className="rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700"
            >

              {status}

            </span>

          )}



          {priority && (

            <span
              className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700"
            >

              {priority}

            </span>

          )}



          {score !== undefined && (

            <span
              className="flex items-center gap-1 rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-700"
            >

              <Star
                size={13}
                className="fill-yellow-400"
              />

              {score}

            </span>

          )}


        </div>


      </div>





      <button

        onClick={onClose}

        className="rounded-xl p-2 transition hover:bg-zinc-100"

      >

        <X size={22}/>

      </button>



    </div>

  );

}