"use client";

import Link from "next/link";

import { useEffect, useState, useTransition } from "react";

import { ArrowLeft, ShieldCheck } from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";
import PageHeading from "@/components/shared/PageHeading";
import SurfaceCard from "@/components/shared/SurfaceCard";

import { useToast } from "@/lib/context/ToastContext";

import {
  listAccess,
  setModuleRole,
  type PessoaComAcesso,
} from "@/lib/actions/permissions";

import {
  ROLE_LABELS,
  MODULE_HINTS,
  MODULE_LABELS,
  MODULES,
} from "@/lib/auth/modules";

/**
 * Permissão por **módulo**, e não por ação.
 *
 * A pergunta estava aberta no roadmap, e a resposta é a coarse: a
 * operação tem três contas, e o recorte real é "quem mexe no NPS" contra
 * "quem mexe no Reclame Aqui". Permissão por ação exigiria uma decisão a
 * cada action nova, e quem esquecesse criaria um buraco que só aparece
 * quando alguém faz o que não devia.
 *
 * **A tela mostra a exceção, não a matriz inteira.** Quem está em
 * "Padrão" segue o papel da conta — e é isso que faz mudar o papel de
 * alguém continuar valendo em todo módulo onde ninguém mexeu.
 */
export default function PermissoesPage() {

  const { notify } = useToast();

  const [pessoas, setPessoas] = useState<
    PessoaComAcesso[]
  >([]);

  const [permitido, setPermitido] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, startSalvar] = useTransition();

  async function carregar() {
    const saida = await listAccess();
    setPessoas(saida.pessoas);
    setPermitido(saida.permitido);
    setCarregando(false);
  }

  /**
   * A carga é efeito porque depende do servidor.
   *
   * O `.then` e não `await` dentro do corpo: a regra
   * `set-state-in-effect` — que voltou a ser erro — recusa `setState`
   * síncrono no efeito, e com razão. Aqui o estado só muda quando a
   * resposta chega, que é sincronizar com sistema externo.
   *
   * O `ativo` evita gravar estado numa tela que já saiu de cena.
   */
  useEffect(() => {

    let ativo = true;

    listAccess()
      .then((saida) => {
        if (!ativo) return;
        setPessoas(saida.pessoas);
        setPermitido(saida.permitido);
      })
      .catch(() => {
        // Sem acesso ou sem banco: a tela mostra o cartão de recusa.
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };

  }, []);

  function mudar(
    pessoa: PessoaComAcesso,
    modulo: string,
    valor: string
  ) {

    /**
     * A tela muda antes do servidor responder.
     *
     * São dezenas de seletores numa grade; esperar a ida ao banco a
     * cada troca faria a tela parecer travada. Se o servidor recusar, o
     * aviso aparece e a recarga devolve o valor real.
     */
    setPessoas((atual) =>
      atual.map((p) => {

        if (p.id !== pessoa.id) return p;

        const overrides = { ...p.overrides };

        if (valor === "padrao") delete overrides[modulo];
        else
          overrides[modulo] = valor as
            | "ADMIN"
            | "AGENTE"
            | "LEITURA";

        return { ...p, overrides };
      })
    );

    startSalvar(async () => {

      const saida = await setModuleRole({
        userId: pessoa.id,
        modulo,
        role: valor as never,
      });

      if (saida.erro) {
        notify({
          tone: "error",
          title: "Não foi possível gravar.",
          detail: saida.erro,
        });
      }

      await carregar();
    });
  }

  return (
    <MainLayout>

      <div className="space-y-6">

        <Link
          href="/configuracoes"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-violet-600"
        >
          <ArrowLeft size={16} />
          Voltar para Configurações
        </Link>

        <PageHeading
          eyebrow="Plataforma"
          title="Permissões"
          description="O papel de cada pessoa dentro de cada módulo. Quem fica em Padrão segue o papel da conta."
        />

        {carregando ? (

          <SurfaceCard
            title="Acesso"
            description="Carregando..."
          >
            <p className="text-sm text-zinc-400">
              Carregando...
            </p>
          </SurfaceCard>

        ) : !permitido ? (

          <SurfaceCard
            title="Acesso restrito"
            description="Só administradores mudam permissões."
          >
            <p className="text-sm leading-relaxed text-zinc-600">
              Quem edita esta tela pode se dar acesso a
              qualquer coisa — deixá-la aberta a agentes
              tornaria o resto da checagem decorativa. Peça
              a um administrador.
            </p>
          </SurfaceCard>

        ) : (

          <>

            {pessoas.map((pessoa) => (

              <SurfaceCard
                key={pessoa.id}
                title={pessoa.name}
                description={`${pessoa.email} · papel da conta: ${ROLE_LABELS[pessoa.role]}${pessoa.active ? "" : " · conta desativada"}`}
                hint="Só o que difere do papel da conta é gravado. Voltar para Padrão apaga a exceção — e a pessoa volta a seguir o papel da conta, inclusive se ele mudar depois."
                bodyClassName="p-0"
              >

                <ul className="divide-y divide-zinc-100">

                  {MODULES.map((modulo) => {

                    /**
                     * "padrao" não é papel: é a ausência de exceção.
                     *
                     * O tipo é união com `Role` de propósito — o
                     * seletor precisa dos quatro valores, e só um
                     * deles não existe no banco.
                     */
                    const atual: string =
                      pessoa.overrides[modulo] ?? "padrao";

                    const excecao = atual !== "padrao";

                    return (
                      <li
                        key={modulo}
                        className={`flex flex-wrap items-center gap-3 px-5 py-2.5 ${excecao ? "bg-violet-50/40" : ""}`}
                      >

                        <span className="min-w-0 flex-1">

                          <span className="block text-sm font-medium text-zinc-800">
                            {MODULE_LABELS[modulo]}
                          </span>

                          <span className="mt-0.5 block text-[11px] leading-snug text-zinc-500">
                            {MODULE_HINTS[modulo]}
                          </span>

                        </span>

                        <select
                          value={atual}
                          disabled={salvando}
                          onChange={(e) =>
                            mudar(
                              pessoa,
                              modulo,
                              e.target.value
                            )
                          }
                          className={`h-9 shrink-0 rounded-lg border px-2.5 text-sm outline-none transition-colors focus:border-violet-400 ${excecao ? "border-violet-300 bg-white font-medium text-violet-800" : "border-zinc-200 text-zinc-600"}`}
                        >
                          <option value="padrao">
                            Padrão ({ROLE_LABELS[pessoa.role]})
                          </option>
                          <option value="ADMIN">
                            Administrador
                          </option>
                          <option value="AGENTE">
                            Agente
                          </option>
                          <option value="LEITURA">
                            Somente leitura
                          </option>
                        </select>

                      </li>
                    );
                  })}

                </ul>

              </SurfaceCard>

            ))}

            <SurfaceCard
              title="Como isso é verificado"
              description="No servidor, e não só na tela."
            >

              <p className="flex items-start gap-2 text-sm leading-relaxed text-zinc-600">

                <ShieldCheck
                  size={16}
                  className="mt-0.5 shrink-0 text-violet-600"
                />

                <span>
                  Cada arquivo de ação declara a que módulo
                  pertence, e o <code>requireRole</code>{" "}
                  resolve o papel ali antes de gravar
                  qualquer coisa. Esconder um botão não
                  impede ninguém de chamar a ação direto —
                  por isso a checagem mora no servidor, e
                  esta tela só escolhe o valor que ele vai
                  ler.
                </span>

              </p>

              <p className="mt-3 text-xs leading-relaxed text-zinc-500">
                Uma trava proposital: ninguém reduz o
                próprio acesso às Configurações. É a porta
                por onde se desfaz qualquer engano desta
                tela, e fechá-la exigiria mexer no banco à
                mão para voltar.
              </p>

            </SurfaceCard>

          </>

        )}

      </div>

    </MainLayout>
  );
}
