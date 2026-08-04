"use client";

import { Pencil, Trash2, Plus } from "lucide-react";

import { mockWorkflow } from "@/lib/data/mockWorkflow";

export default function WorkflowTable() {
    return (

        <div className="rounded-2xl border bg-white">

            <div className="flex items-center justify-between border-b p-6">

                <h2 className="text-xl font-semibold">

                    Status

                </h2>

                <button className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-white">

                    <Plus size={18} />

                    Novo Status

                </button>

            </div>

            <table className="w-full">

                <thead>

                    <tr className="border-b bg-zinc-50">

                        <th className="p-4 text-left">
                            Ordem
                        </th>

                        <th className="text-left">
                            Nome
                        </th>

                        <th className="text-left">
                            Cor
                        </th>

                        <th className="text-right">
                            Ações
                        </th>

                    </tr>

                </thead>

                <tbody>

                    {mockWorkflow.map((status) => (

                        <tr
                            key={status.id}
                            className="border-b"
                        >

                            <td className="p-4">

                                {status.order}

                            </td>

                            <td>

                                {status.name}

                            </td>

                            <td>

                                <div
                                    className="h-5 w-5 rounded-full"
                                    style={{
                                        backgroundColor: status.color,
                                    }}
                                />

                            </td>

                            <td>

                                <div className="flex justify-end gap-3 pr-4">

                                    <button>

                                        <Pencil size={18} />

                                    </button>

                                    <button>

                                        <Trash2 size={18} />

                                    </button>

                                </div>

                            </td>

                        </tr>

                    ))}

                </tbody>

            </table>

        </div>
    );
}