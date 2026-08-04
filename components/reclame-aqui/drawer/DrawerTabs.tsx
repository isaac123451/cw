"use client";


type TabId =
  | "general"
  | "customer"
  | "company"
  | "timeline"
  | "checklist"
  | "notes"
  | "attachments"
  | "response";


interface Props {
  active: TabId;

  onChange: (
    value: TabId
  ) => void;
}



const tabs: {
  id: TabId;
  label: string;
}[] = [

  {
    id: "general",
    label: "Geral",
  },

  {
    id: "customer",
    label: "Cliente",
  },

  {
    id: "company",
    label: "Empresa",
  },

  {
    id: "timeline",
    label: "Histórico",
  },

  {
    id: "checklist",
    label: "Checklist",
  },

  {
    id: "notes",
    label: "Comentários",
  },

  {
    id: "attachments",
    label: "Anexos",
  },

  {
    id: "response",
    label: "Resposta Pública",
  },

];



export default function DrawerTabs({
  active,
  onChange,
}: Props) {


  return (

    <div
      className="
        border-b
        border-zinc-200
        bg-white
      "
    >

      <div
        className="
          flex
          overflow-x-auto
          px-6
          scrollbar-thin
        "
      >


        {tabs.map((tab)=>(


          <button

            key={tab.id}

            onClick={() => onChange(tab.id)}

            className={`
              relative
              shrink-0
              whitespace-nowrap
              px-5
              py-4
              text-sm
              font-medium
              transition

              ${
                active === tab.id

                ? "text-violet-600"

                : "text-zinc-500 hover:text-zinc-900"
              }

            `}

          >

            {tab.label}



            {active === tab.id && (

              <span

                className="
                  absolute
                  bottom-0
                  left-2
                  right-2
                  h-0.5
                  rounded-full
                  bg-violet-600
                "

              />

            )}


          </button>


        ))}


      </div>


    </div>

  );

}