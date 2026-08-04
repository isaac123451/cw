import Card from "@/components/design-system/Card";

export default function QuickActions(){

const actions=[

"Novo Caso",

"Nova Solicitação",

"Registrar Rede Social",

"Pesquisar Cliente"

]

return(

<Card>

<h3 className="font-semibold text-lg">

Ações rápidas

</h3>

<div className="mt-6 grid grid-cols-2 gap-4">

{

actions.map(action=>(

<button

key={action}

className="rounded-2xl border border-zinc-200 p-5 text-left transition hover:border-violet-500 hover:bg-violet-50"

>

{action}

</button>

))

}

</div>

</Card>

)

}