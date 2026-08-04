"use client";

import {
  Building2,
  FileText,
  Layers,
  User,
  Globe,
  Tag,
} from "lucide-react";

import { Case } from "@/lib/models/case";


interface Props {
  data: Case;
}


export default function CompanyTab({
  data,
}: Props) {

  return (
    <div className="space-y-6">


      {/* Cabeçalho empresa */}

      <div
        className="
          rounded-2xl
          border
          border-zinc-200
          bg-white
          p-6
        "
      >

        <div className="flex items-center gap-4">


          <div
            className="
              flex
              h-14
              w-14
              items-center
              justify-center
              rounded-xl
              bg-violet-100
              text-violet-700
            "
          >

            <Building2 size={28}/>

          </div>


          <div>

            <h2 className="text-xl font-bold">
              {data.company}
            </h2>


            <p className="text-sm text-zinc-500">
              Estabelecimento cadastrado
            </p>


          </div>


        </div>


      </div>




      {/* Dados da empresa */}

      <div>

        <h3 className="mb-4 text-lg font-semibold">
          Informações do Estabelecimento
        </h3>


        <div className="grid grid-cols-2 gap-4">


          <InfoCard
            icon={<Building2 size={18}/>}
            label="Empresa"
            value={data.company}
          />


          <InfoCard
            icon={<FileText size={18}/>}
            label="CNPJ"
            value={data.cnpj}
          />


          <InfoCard
            icon={<Globe size={18}/>}
            label="Origem"
            value={data.source}
          />


          <InfoCard
            icon={<User size={18}/>}
            label="Responsável"
            value={data.owner}
          />


        </div>


      </div>




      {/* Classificação */}

      <div>

        <h3 className="mb-4 text-lg font-semibold">
          Classificação do Caso
        </h3>


        <div className="grid grid-cols-2 gap-4">


          <InfoCard
            icon={<Layers size={18}/>}
            label="Categoria"
            value={data.category}
          />


          <InfoCard
            icon={<Tag size={18}/>}
            label="Subcategoria"
            value={data.subcategory}
          />


        </div>


      </div>




      {/* Área preparada para indicadores */}

      <div
        className="
          rounded-2xl
          border
          border-zinc-200
          bg-zinc-50
          p-5
        "
      >

        <h3 className="font-semibold">
          Indicadores do Estabelecimento
        </h3>


        <p className="mt-2 text-sm text-zinc-500">
          Futuramente serão exibidos dados consolidados:
          quantidade de reclamações, nota média,
          SLA médio e desempenho da operação.
        </p>


      </div>


    </div>
  );
}




function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label:string;
  value?:string;
}) {

  return (

    <div
      className="
        rounded-xl
        border
        border-zinc-200
        bg-white
        p-4
      "
    >

      <div className="flex items-center gap-3">


        <div
          className="
            rounded-lg
            bg-zinc-100
            p-2
          "
        >

          {icon}

        </div>


        <div>

          <p className="text-xs uppercase text-zinc-500">
            {label}
          </p>


          <p className="mt-1 font-semibold">
            {value || "-"}
          </p>


        </div>


      </div>


    </div>

  );

}