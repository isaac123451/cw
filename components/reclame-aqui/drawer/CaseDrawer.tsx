"use client";

import { useEffect, useState } from "react";

import { Case } from "@/lib/models/case";

import DrawerHeader from "./DrawerHeader";
import DrawerTabs from "./DrawerTabs";

import GeneralTab from "./GeneralTab";
import CustomerTab from "./CustomerTab";
import CompanyTab from "./CompanyTab";
import TimelineTab from "./TimelineTab";
import ChecklistTab from "./ChecklistTab";
import NotesTab from "./NotesTab";
import AttachmentsTab from "./AttachmentsTab";
import PublicResponseTab from "./PublicResponseTab";


interface Props {
  open: boolean;
  data?: Case;
  onClose: () => void;
}


type Tab =
  | "general"
  | "customer"
  | "company"
  | "timeline"
  | "checklist"
  | "notes"
  | "attachments"
  | "response";



export default function CaseDrawer({
  open,
  data,
  onClose,
}: Props) {


  const [activeTab, setActiveTab] =
    useState<Tab>("general");



  useEffect(() => {

    if(open){
      setActiveTab("general");
    }

  }, [open, data]);




  if(!open || !data){
    return null;
  }




  return (

    <>

      {/* Overlay */}

      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/40"
      />





      {/* Drawer */}

      <aside
        className="fixed right-0 top-0 z-50 flex h-screen w-[760px] max-w-full flex-col bg-white shadow-2xl"
      >




        {/* Header */}

        <DrawerHeader

          protocol={data.protocol}

          company={data.company}

          title={data.title}

          status={data.status}

          priority={data.priority}

          score={data.score}

          resolved={data.resolved}

          onClose={onClose}

        />





        {/* Navegação */}

        <DrawerTabs

          active={activeTab}

          onChange={setActiveTab}

        />






        {/* Conteúdo */}

        <div
          className="flex-1 overflow-y-auto p-6"
        >



          {activeTab === "general" && (

            <GeneralTab
              data={data}
            />

          )}






          {activeTab === "customer" && (

            <CustomerTab
              data={data}
            />

          )}






          {activeTab === "company" && (

            <CompanyTab
              data={data}
            />

          )}






          {activeTab === "timeline" && (

            <TimelineTab />

          )}






          {activeTab === "checklist" && (

            <ChecklistTab />

          )}






          {activeTab === "notes" && (

            <NotesTab />

          )}






          {activeTab === "attachments" && (

            <AttachmentsTab />

          )}






          {activeTab === "response" && (

            <PublicResponseTab
              data={data}
            />

          )}






        </div>






        {/* Footer */}

        <div
          className="flex items-center justify-between border-t border-zinc-200 bg-white px-6 py-4"
        >



          <button

            onClick={onClose}

            className="rounded-xl border border-zinc-300 px-5 py-3 text-sm font-medium hover:bg-zinc-50"

          >

            Fechar

          </button>






          <button

            className="rounded-xl bg-violet-600 px-6 py-3 text-sm font-medium text-white hover:bg-violet-700"

          >

            Salvar Alterações

          </button>





        </div>





      </aside>


    </>

  );
}