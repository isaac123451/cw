"use client";

import Link from "next/link";

import {
  ArrowUpRight,
  ExternalLink,
  Pencil,
  UserCheck,
} from "lucide-react";

import { Case } from "@/lib/models/case";
import { useTeams } from "@/lib/context/TeamsContext";
import { useEstablishments } from "@/lib/context/EstablishmentsContext";
import { useSession } from "@/lib/context/SessionContext";
import { useSla } from "@/lib/context/SlaContext";

import {
  slaStatus,
  toneOfSla,
} from "@/lib/services/sla.service";

import { formatHours } from "@/lib/models/sla";
import Combobox from "@/components/shared/Combobox";

interface Props {
  data: Case;
  owners: string[];
  onChange: (patch: Partial<Case>) => void;

  /**
   * Leva para a aba "Avaliação RA", onde estes campos se editam.
   *
   * A lateral **espelha** avaliação e situação; quem edita é a aba. Ter
   * dois lugares que gravam o mesmo campo é como duas telas passam a
   * discordar — então aqui o lápis não abre um segundo formulário,
   * leva ao único que existe.
   */
  onEditarAvaliacao?: () => void;
}

function Block({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">

      <div className="flex items-start justify-between gap-3">

        <h3 className="text-base font-semibold text-zinc-900">
          {title}
        </h3>

        {action}

      </div>

      <div className="mt-3">{children}</div>

    </section>
  );
}

export default function CaseSidebar({
  data,
  owners,
  onChange,
  onEditarAvaliacao,
}: Props) {

  const { people } = useTeams();
  const { rules } = useSla();

  const sla = slaStatus(data, rules);
  const { establishments } = useEstablishments();

  const sessao = useSession();

  /**
   * Quem está logado entra na lista mesmo sem cadastro em Times.
   *
   * Era o defeito por trás do pedido do Isaac: quem acabou de entrar na
   * equipe não aparece em lugar nenhum até alguém cadastrá-la, e o
   * caso fica sem dono enquanto isso. Pior — sem este nome entre as
   * opções, atribuir para si deixaria o `<select>` com um valor que não
   * casa com nenhuma `<option>`, e o campo apareceria **em branco**
   * logo depois de ter sido preenchido.
   */
  const eu = sessao?.name?.trim() || "";

  const opcoes = [
    ...new Set(
      [
        ...people.map((item) => item.name),
        ...owners,
        eu,
      ].filter(Boolean)
    ),
  ].sort();

  const jaEMeu =
    Boolean(eu) &&
    (data.owner ?? "").trim() === eu;

  const avaliada = data.evaluated;

  return (
    <div className="space-y-4">

      <Block
        title="Status"
        action={
          /*
            Era um `<span>` com um lápis cinza: parecia botão de editar
            e não fazia nada. Um ícone que promete ação e não entrega é
            pior do que ícone nenhum — a pessoa clica, não acontece, e
            passa a desconfiar dos outros botões da tela.
          */
          onEditarAvaliacao ? (
            <button
              type="button"
              onClick={onEditarAvaliacao}
              title="Editar em Avaliação RA"
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-50"
            >
              <Pencil size={12} />
              Editar
            </button>
          ) : null
        }
      >

        <span
          className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
            avaliada
              ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
              : "bg-zinc-100 text-zinc-600 ring-zinc-200"
          }`}
        >
          {avaliada
            ? "Reclamação avaliada"
            : "Aguardando avaliação"}
        </span>

        <p className="mt-3 text-sm leading-relaxed text-zinc-500">
          {avaliada
            ? "Acompanhar a avaliação final e fechar o ciclo da reclamação."
            : "Cliente ainda não avaliou o atendimento no Reclame Aqui."}
        </p>

      </Block>

      <Block
        title="Responsável"
        action={
          /*
            Pegar um caso para si é a ação mais comum desta tela, e
            fazê-la pela lista custa abrir o `<select>`, procurar o
            próprio nome no meio de dezenas e escolher. Um clique
            resolve — e some quando o caso já é seu, porque aí o botão
            não teria o que fazer.
          */
          eu && !jaEMeu ? (
            <button
              type="button"
              onClick={() => onChange({ owner: eu })}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-50"
            >
              <UserCheck size={13} />
              Atribuir para mim
            </button>
          ) : null
        }
      >

        {/*
          Com busca, porque a lista cresce com o time.

          Um `<select>` nativo obriga a rolar atrás de um nome que a
          pessoa já sabe de cor. Três letras resolvem, e o campo nativo
          não tem onde recebê-las.
        */}
        <Combobox
          value={data.owner ?? ""}
          onChange={(owner) => onChange({ owner })}
          emptyLabel="Sem responsável"
          placeholder="Sem responsável"
          options={opcoes.map((item) => ({
            value: item,
            label:
              item === eu ? `${item} (você)` : item,
          }))}
        />

        {jaEMeu && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700">
            <UserCheck size={12} />
            Este caso é seu.
          </p>
        )}

      </Block>

      <Block
        title="Estabelecimento"
        action={
          data.establishmentId && (
            <Link
              href={`/estabelecimentos/${
                establishments.find(
                  (item) => item.id === data.establishmentId
                )?.slug ?? ""
              }`}
              title="Ver estabelecimento"
              className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:text-violet-700"
            >
              <ArrowUpRight size={14} />
            </Link>
          )
        }
      >

        {/*
          Esta é a caixa que o Isaac mostrou na print.

          Duzentos e trinta e nove restaurantes numa lista nativa: para
          achar um, rola-se a lista inteira atrás de um nome que a
          pessoa já sabe de cor. Aqui três letras bastam, e a busca
          alcança também a cidade e o documento — porque "Maceió
          Burgers" tem homônimo e o CNPJ não tem.
        */}
        <Combobox
          value={data.establishmentId ?? ""}
          onChange={(id) =>
            onChange({
              establishmentId: id || undefined,

              /*
                Escolher à mão trava o vínculo.

                Sem isto, a próxima varredura por documento
                sobrescreveria a escolha da pessoa — que é o defeito
                que `establishmentManual` existe para impedir.
              */
              establishmentManual: true,
            })
          }
          emptyLabel="Sem vínculo"
          placeholder="Buscar restaurante…"
          options={establishments.map((item) => ({
            value: item.id,
            label: item.name,
            hint: [item.city, item.document]
              .filter(Boolean)
              .join(" · "),
          }))}
        />

        <p className="mt-2 text-xs leading-relaxed text-zinc-500">
          O Reclame Aqui não informa o estabelecimento. O
          vínculo se faz sozinho pelo CPF ou CNPJ da
          reclamação; escolher aqui à mão passa na frente
          e não é desfeito pela próxima varredura.
        </p>

      </Block>

      <Block
        title="Situação"
        action={
          onEditarAvaliacao ? (
            <button
              type="button"
              onClick={onEditarAvaliacao}
              title="Editar em Avaliação RA"
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-50"
            >
              <Pencil size={12} />
              Editar
            </button>
          ) : null
        }
      >

        <span
          className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
            data.resolved
              ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
              : "bg-amber-50 text-amber-700 ring-amber-100"
          }`}
        >
          {data.resolved ? "Encerrada" : "Em aberto"}
        </span>

        <p className="mt-3 text-sm leading-relaxed text-zinc-500">
          {data.resolved
            ? "A tratativa foi concluída e registrada."
            : "A reclamação continua em andamento ativo."}
        </p>

      </Block>

      <Block title="SLA">

        {/* Prazo vem da regra por categoria, não mais de um texto fixo. */}
        <span
          className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${toneOfSla(
            sla.situation
          )}`}
        >
          {sla.label}
        </span>

        {sla.rule ? (

          <>
            <p className="mt-3 text-sm leading-relaxed text-zinc-500">
              {sla.situation === "estourado"
                ? `Passou ${Math.abs(
                    Math.round(sla.remainingHours)
                  )}h do prazo.`
                : sla.situation === "concluido"
                ? "Caso encerrado — o relógio parou."
                : `Restam ${Math.round(
                    sla.remainingHours
                  )}h no prazo.`}
            </p>

            <dl className="mt-3 space-y-2 border-t border-zinc-100 pt-3">

              {[
                [
                  "Resposta",
                  formatHours(sla.rule.responseHours),
                ],
                [
                  "Solução",
                  formatHours(sla.rule.solutionHours),
                ],
                ["Time", sla.rule.team ?? "—"],
              ].map(([label, value]) => (

                <div
                  key={label}
                  className="flex items-center justify-between"
                >

                  <dt className="text-xs text-zinc-500">
                    {label}
                  </dt>

                  <dd className="text-xs font-medium text-zinc-800">
                    {value}
                  </dd>

                </div>

              ))}

            </dl>

            <Link
              href="/processos"
              className="mt-3 block text-xs font-medium text-violet-700 hover:underline"
            >
              Ver regra em Processos
            </Link>
          </>

        ) : (

          <p className="mt-3 text-sm leading-relaxed text-zinc-500">
            Nenhuma regra de SLA cobre esta categoria.{" "}
            <Link
              href="/processos"
              className="font-medium text-violet-700 hover:underline"
            >
              Cadastrar regra
            </Link>
          </p>

        )}

      </Block>

      <Block title="Reclame Aqui">

        <p className="text-sm text-zinc-500">
          Publicado em{" "}
          {data.createdAt
            .split("-")
            .reverse()
            .join("/")}
        </p>

        <p className="mt-0.5 text-sm text-zinc-500">
          Protocolo {data.protocol}
        </p>

        {data.evaluatedAt && (
          <p className="mt-0.5 text-sm text-zinc-500">
            Avaliado em{" "}
            {data.evaluatedAt
              .split("-")
              .reverse()
              .join("/")}
          </p>
        )}

        <input
          value={data.raUrl ?? ""}
          onChange={(e) =>
            onChange({
              raUrl: e.target.value.trim() || undefined,
            })
          }
          placeholder="Cole o link da reclamação no portal"
          className="mt-3 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm outline-none transition-colors focus:border-violet-400"
        />

        {/* O export do HugMe não traz a URL — o botão só aparece
            depois que alguém colar o link do caso. */}
        {data.raUrl && (
          <a
            href={data.raUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex items-center justify-center gap-2 rounded-xl border border-violet-200 px-4 py-2.5 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-50"
          >
            <ExternalLink size={15} />
            Abrir no Reclame Aqui
          </a>
        )}

      </Block>

      <Block title="Classificação">

        <dl className="space-y-3">

          {[
            ["Categoria", data.category],
            ["Subcategoria", data.subcategory || "—"],
            ["Time envolvido", data.department || "—"],
            [
              "Nota",
              data.evaluated
                ? String(data.score ?? 0)
                : "—",
            ],
          ].map(([label, value]) => (

            <div key={label}>

              <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                {label}
              </dt>

              <dd className="mt-0.5 text-sm text-zinc-800">
                {value}
              </dd>

            </div>

          ))}

          <div>

            <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Voltaria
            </dt>

            <dd className="mt-1">
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                  data.wouldDoBusiness
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                    : "bg-rose-50 text-rose-700 ring-rose-100"
                }`}
              >
                {data.wouldDoBusiness ? "Sim" : "Não"}
              </span>
            </dd>

          </div>

        </dl>

      </Block>

    </div>
  );
}
