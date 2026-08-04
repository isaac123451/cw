"use client";


import {
  createContext,
  useContext,
  useState,
  ReactNode,
} from "react";


import {
  mockWorkflow
} from "@/lib/data/mockWorkflow";


import {
  WorkflowStatus
} from "@/lib/models/workflow";



interface WorkflowContextProps {


  workflow: WorkflowStatus[];


  addStatus: (
    item: WorkflowStatus
  ) => void;



  updateStatus: (
    item: WorkflowStatus
  ) => void;



  deleteStatus: (
    id:string
  ) => void;



  toggleStatus: (
    id:string
  ) => void;


}



const WorkflowContext =
createContext<WorkflowContextProps | undefined>(
  undefined
);




export function WorkflowProvider({

children

}:{

children:ReactNode

}){


const [workflow,setWorkflow] =
useState<WorkflowStatus[]>(
  mockWorkflow
);





function addStatus(
item:WorkflowStatus
){

setWorkflow(current=>[
...current,
item
]);

}





function updateStatus(
item:WorkflowStatus
){

setWorkflow(current=>

current.map(status=>

status.id===item.id
?
item
:
status

)

);

}





function deleteStatus(
id:string
){

setWorkflow(current=>

current.filter(
item=>item.id!==id
)

);

}





function toggleStatus(
id:string
){

setWorkflow(current=>

current.map(item=>

item.id===id

?

{
...item,
active:!item.active
}

:

item

)

);

}





return (

<WorkflowContext.Provider

value={{

workflow,

addStatus,

updateStatus,

deleteStatus,

toggleStatus

}}

>

{children}

</WorkflowContext.Provider>


);


}





export function useWorkflow(){


const context =
useContext(
WorkflowContext
);


if(!context){

throw new Error(
" useWorkflow deve estar dentro de WorkflowProvider"
);

}


return context;


}