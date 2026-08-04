import Card from "@/components/design-system/Card";
import Badge from "@/components/design-system/Badge";

interface Props{

    title:string;

    value:number;

    status:"success"|"warning"|"danger";
}

export default function PriorityCard({

title,

value,

status

}:Props){

return(

<Card>

<div className="flex justify-between items-center">

<div>

<p className="text-zinc-500">

{title}

</p>

<h2 className="mt-3 text-5xl font-bold">

{value}

</h2>

</div>

<Badge variant={status}>

{status==="success"&&"OK"}

{status==="warning"&&"Atenção"}

{status==="danger"&&"Crítico"}

</Badge>

</div>

</Card>

)

}