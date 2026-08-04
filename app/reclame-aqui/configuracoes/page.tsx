"use client";


import MainLayout from "@/components/layout/MainLayout";

import WorkflowSettings from "@/components/reclame-aqui/settings/WorkflowSettings";



export default function ConfiguracoesPage(){


  return (

    <MainLayout>


      <div className="flex h-full flex-col gap-6 p-6">


        <div>

          <h1 className="text-2xl font-bold">

            Configuração de Fluxo

          </h1>


          <p className="mt-1 text-sm text-zinc-500">

            Configure as etapas do atendimento do Reclame Aqui.

          </p>


        </div>



        <WorkflowSettings />


      </div>


    </MainLayout>

  );

}