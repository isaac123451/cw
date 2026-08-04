"use client";

import {
  Mail,
  Phone,
  MapPin,
  User,
  MessageSquareWarning,
  CheckCircle2,
  XCircle,
} from "lucide-react";

import { Case } from "@/lib/models/case";


interface Props {
  data: Case;
}


export default function CustomerTab({
  data,
}: Props) {

  return (
    <div className="space-y-6">


      {/* Perfil */}

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
              rounded-full
              bg-violet-100
              text-xl
              font-bold
              text-violet-700
            "
          >

            {data.customer
              ?.charAt(0)
              .toUpperCase()
            }

          </div>


          <div>

            <h2 className="text-lg font-bold">
              {data.customer}
            </h2>


            <p className="text-sm text-zinc-500">
              Consumidor Reclame Aqui
            </p>


          </div>


        </div>


      </div>




      {/* Dados de contato */}

      <div>

        <h3 className="mb-4 text-lg font-semibold">
          Dados do Cliente
        </h3>


        <div className="grid grid-cols-2 gap-4">


          <InfoCard
            icon={<User size={18}/>}
            label="Nome"
            value={data.customer}
          />


          <InfoCard
            icon={<Phone size={18}/>}
            label="Telefone"
            value={data.phone}
          />


          <InfoCard
            icon={<Mail size={18}/>}
            label="Email"
            value={data.email}
          />


          <InfoCard
            icon={<MapPin size={18}/>}
            label="Localização"
            value={`${data.city || "-"} / ${data.state || "-"}`}
          />


        </div>


      </div>




      {/* Indicadores */}

      <div>

        <h3 className="mb-4 text-lg de-semibold">
          Indicadores do Consumidor
        </h3>


        <div className="grid grid-cols-2 gap-4">


          <Indicator
            label="Voltaria a fazer negócio"
            value={
              data.wouldDoBusiness
                ? "Sim"
                : "Não"
            }
            positive={data.wouldDoBusiness}
          />


          <Indicator
            label="Caso resolvido"
            value={
              data.resolved
                ? "Sim"
                : "Não"
            }
            positive={data.resolved}
          />


        </div>

      </div>




      {/* Histórico futuro */}

      <div
        className="
          rounded-2xl
          border
          border-zinc-200
          bg-zinc-50
          p-5
        "
      >

        <div className="flex items-center gap-3">


          <MessageSquareWarning size={20}/>


          <div>

            <h3 className="font-semibold">
              Histórico do consumidor
            </h3>


            <p className="text-sm text-zinc-500">
              Outros chamados e reclamações aparecerão aqui.
            </p>


          </div>


        </div>


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


        <div className="rounded-lg bg-zinc-100 p-2">
          {icon}
        </div>


        <div>

          <p className="text-xs uppercase text-zinc-500">
            {label}
          </p>


          <p className="mt-1 font-medium">
            {value || "-"}
          </p>


        </div>


      </div>


    </div>

  );

}





function Indicator({
  label,
  value,
  positive,
}: {
  label:string;
  value:string;
  positive:boolean;
}) {

  return (

    <div
      className="
        flex
        items-center
        justify-between
        rounded-xl
        border
        border-zinc-200
        bg-white
        p-4
      "
    >

      <div>

        <p className="text-xs uppercase text-zinc-500">
          {label}
        </p>


        <p className="mt-1 font-semibold">
          {value}
        </p>


      </div>


      {positive ? (

        <CheckCircle2
          className="text-green-600"
          size={22}
        />

      ) : (

        <XCircle
          className="text-red-600"
          size={22}
        />

      )}


    </div>

  );

}