"use client";

import {
  CheckCircle2,
  XCircle,
  Star,
  Clock3,
  User,
  Tag,
} from "lucide-react";

import { Case } from "@/lib/models/case";


interface Props {
  data: Case;
}


export default function GeneralTab({
  data,
}: Props) {

  return (
    <div className="space-y-6">


      {/* Informações principais */}

      <div className="grid grid-cols-2 gap-4">


        <InfoCard
          label="Protocolo"
          value={data.protocol}
        />


        <InfoCard
          label="Status"
          value={data.status}
        />


        <InfoCard
          label="Prioridade"
          value={data.priority}
        />


        <InfoCard
          label="Categoria"
          value={data.category}
        />


        <InfoCard
          label="Subcategoria"
          value={data.subcategory}
        />


        <InfoCard
          label="Responsável"
          value={data.owner}
        />


      </div>



      {/* Indicadores */}

      <div className="grid grid-cols-3 gap-4">


        <Metric
          title="Nota"
          value={
            data.score !== undefined
              ? String(data.score)
              : "-"
          }
          icon={
            <Star
              size={18}
              className="fill-yellow-400 text-yellow-400"
            />
          }
        />



        <Metric
          title="Resolvido"
          value={
            data.resolved
              ? "Sim"
              : "Não"
          }
          icon={
            data.resolved ? (
              <CheckCircle2
                size={18}
                className="text-green-600"
              />
            ) : (
              <XCircle
                size={18}
                className="text-red-600"
              />
            )
          }
        />



        <Metric
          title="Voltaria"
          value={
            data.wouldDoBusiness
              ? "Sim"
              : "Não"
          }
          icon={
            <User size={18}/>
          }
        />


      </div>



      {/* SLA */}

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">


        <div className="flex items-center gap-3">

          <Clock3 size={20}/>


          <div>

            <p className="text-xs uppercase text-zinc-500">
              SLA
            </p>

            <p className="font-semibold">
              {data.sla}
            </p>

          </div>


        </div>


        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">


          <div>

            <p className="text-zinc-500">
              Tempo de resposta
            </p>

            <p className="font-medium">
              {data.responseTime || "-"}
            </p>

          </div>


          <div>

            <p className="text-zinc-500">
              Tempo de solução
            </p>

            <p className="font-medium">
              {data.solutionTime || "-"}
            </p>

          </div>


        </div>


      </div>




      {/* Tags */}

      {data.tags && data.tags.length > 0 && (

        <div>

          <div className="mb-3 flex items-center gap-2">

            <Tag size={18}/>

            <h3 className="font-semibold">
              Tags
            </h3>

          </div>


          <div className="flex flex-wrap gap-2">

            {data.tags.map((tag)=> (

              <span
                key={tag}
                className="rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700"
              >

                {tag}

              </span>

            ))}

          </div>

        </div>

      )}




      {/* Descrição */}

      <section>


        <h3 className="mb-3 text-lg font-semibold">
          Descrição da Reclamação
        </h3>


        <div
          className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm leading-relaxed"
        >

          {data.description}


        </div>


      </section>


    </div>
  );
}




function InfoCard({
  label,
  value,
}: {
  label:string;
  value?:string;
}) {

  return (

    <div
      className="rounded-xl border border-zinc-200 bg-white p-4"
    >

      <p className="text-xs uppercase text-zinc-500">
        {label}
      </p>


      <p className="mt-1 font-semibold">
        {value || "-"}
      </p>


    </div>

  );

}




function Metric({
  title,
  value,
  icon,
}: {
  title:string;
  value:string;
  icon:React.ReactNode;
}) {

  return (

    <div
      className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4"
    >

      <div className="rounded-xl bg-zinc-100 p-2">
        {icon}
      </div>


      <div>

        <p className="text-xs uppercase text-zinc-500">
          {title}
        </p>


        <p className="font-bold">
          {value}
        </p>


      </div>


    </div>

  );

}