"use client";

import Link from "next/link";

import { useEffect, useState, useTransition } from "react";

import {
  ArrowLeft,
  Check,
  Copy,
  RefreshCw,
  Send,
} from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";
import PageHeading from "@/components/shared/PageHeading";
import SurfaceCard from "@/components/shared/SurfaceCard";
import IaCard from "@/components/configuracoes/IaCard";

import {
  ConfirmDelete,
  Field,
  GhostButton,
  inputClass,
  PrimaryButton,
} from "@/components/shared/Modal";

import {
  canManageIntegrations,
  deleteWebhookConfig,
  getWebhookConfig,
  getWebhookDeliveries,
  regenerateWebhookSecret,
  saveWebhookConfig,
  sendTestWebhook,
} from "@/lib/actions/webhooks";

import {
  WEBHOOK_EVENT_LABELS,
  WEBHOOK_EVENTS,
  WebhookEvent,
} from "@/lib/models/webhook";

type WebhookConfigView = Awaited<
  ReturnType<typeof getWebhookConfig>
>;

type DeliveryView = Awaited<
  ReturnType<typeof getWebhookDeliveries>
>[number];

export default function IntegracoesPage() {

  const [webhook, setWebhook] =
    useState<WebhookConfigView>(null);

  const [deliveries, setDeliveries] = useState<
    DeliveryView[]
  >([]);

  const [loading, setLoading] = useState(true);

  /** `undefined` enquanto carrega; a tela não decide nada antes disso. */
  const [permitido, setPermitido] = useState<boolean>();

  const [url, setUrl] = useState("");
  const [active, setActive] = useState(true);

  const [events, setEvents] = useState<WebhookEvent[]>([
    ...WEBHOOK_EVENTS,
  ]);

  const [copied, setCopied] = useState(false);
  const [confirmingDelete, setConfirmingDelete] =
    useState(false);

  const [testResult, setTestResult] = useState<{
    ok: boolean;
    at: number;
  } | null>(null);

  const [pending, startTransition] = useTransition();

  /** Busca sem tocar em estado, para o efeito abaixo decidir se aplica. */
  async function buscar() {

    /**
     * A permissão vem antes de qualquer leitura: as actions do webhook
     * exigem ADMIN e lançariam erro para os demais. Perguntar primeiro
     * troca uma tela de erro por uma explicação.
     */
    const pode = await canManageIntegrations();

    if (!pode) {
      return {
        pode,
        config: null,
        deliveries: [] as Awaited<
          ReturnType<typeof getWebhookDeliveries>
        >,
      };
    }

    const config = await getWebhookConfig();

    return {
      pode,
      config,
      deliveries: config
        ? await getWebhookDeliveries(config.id)
        : [],
    };
  }

  function aplicar(dados: Awaited<ReturnType<typeof buscar>>) {

    setPermitido(dados.pode);
    setWebhook(dados.config);
    setDeliveries(dados.deliveries);

    if (dados.config) {
      setUrl(dados.config.url);
      setActive(dados.config.active);
      setEvents(dados.config.events as WebhookEvent[]);
    }

    setLoading(false);
  }

  async function recarregar() {
    aplicar(await buscar());
  }

  useEffect(() => {

    let ativo = true;

    buscar()
      .then((dados) => {
        if (ativo) aplicar(dados);
      })
      .catch((error: unknown) => {
        console.error("[webhook] carga falhou", error);
        if (ativo) setLoading(false);
      });

    return () => {
      ativo = false;
    };

    // Só na montagem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleEvent(event: WebhookEvent) {
    setEvents((prev) =>
      prev.includes(event)
        ? prev.filter((item) => item !== event)
        : [...prev, event]
    );
  }

  function salvar() {
    startTransition(async () => {

      await saveWebhookConfig({
        id: webhook?.id,
        url: url.trim(),
        active,
        events,
      });

      await recarregar();
    });
  }

  function regenerar() {

    if (!webhook) return;

    startTransition(async () => {
      await regenerateWebhookSecret(webhook.id);
      await recarregar();
    });
  }

  function excluir() {

    if (!webhook) return;

    startTransition(async () => {

      await deleteWebhookConfig(webhook.id);

      setWebhook(null);
      setUrl("");
      setEvents([...WEBHOOK_EVENTS]);
      setActive(true);
      setDeliveries([]);
      setConfirmingDelete(false);
    });
  }

  function testar() {

    if (!webhook) return;

    startTransition(async () => {

      const resultado = await sendTestWebhook(
        webhook.id
      );

      setTestResult({ ok: resultado.ok, at: Date.now() });

      await recarregar();
    });
  }

  function copiarSegredo() {

    if (!webhook) return;

    navigator.clipboard.writeText(webhook.secret);

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <MainLayout>

      <div className="space-y-5">

        <Link
          href="/configuracoes"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-violet-600"
        >
          <ArrowLeft size={16} />
          Voltar para Configurações
        </Link>

        <PageHeading
          eyebrow="Plataforma"
          title="Integrações"
          description="Quem responde pela inteligência artificial, e o webhook disparado por evento para o CW Engine ser avisado em vez de só puxar via API."
        />

        {/*
          A IA vem antes do webhook de propósito.

          É a configuração que a operação sente todo dia — "está
          demorando" é uma reclamação semanal —, enquanto o webhook é
          coisa de quem integra, e se mexe uma vez.
        */}
        <IaCard />

        {loading ? (

          <SurfaceCard
            title="Webhook"
            description="Carregando configuração..."
          >
            <p className="text-sm text-zinc-400">
              Carregando...
            </p>
          </SurfaceCard>

        ) : permitido === false ? (

          <SurfaceCard
            title="Acesso restrito"
            description="Só administradores configuram integrações."
          >
            <p className="text-sm leading-relaxed text-zinc-600">
              Esta tela mostra a chave de assinatura usada
              para o destino confirmar que a chamada veio
              daqui — quem a tem consegue forjar
              requisições em nome da empresa. Peça a um
              administrador se precisar alterar algo.
            </p>
          </SurfaceCard>

        ) : (

          <>
            <SurfaceCard
              title="Destino"
              description="URL que recebe o POST assinado a cada evento."
            >

              <div className="space-y-4">

                <Field
                  label="URL de destino"
                  hint="Precisa aceitar POST com corpo JSON."
                >
                  <input
                    value={url}
                    onChange={(e) =>
                      setUrl(e.target.value)
                    }
                    placeholder="https://cwengine.cardapioweb.com/webhooks/reputacao"
                    className={inputClass}
                  />
                </Field>

                <div>

                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Eventos
                  </p>

                  <div className="space-y-2">

                    {WEBHOOK_EVENTS.map((event) => (

                      <label
                        key={event}
                        className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700"
                      >
                        <input
                          type="checkbox"
                          checked={events.includes(
                            event
                          )}
                          onChange={() =>
                            toggleEvent(event)
                          }
                          className="h-4 w-4 accent-violet-600"
                        />
                        {WEBHOOK_EVENT_LABELS[event]}
                      </label>

                    ))}

                  </div>

                  <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                    &quot;Movimentação atrasada&quot; é
                    diferente dos outros dois: eles nascem
                    de alguém salvar um caso, e este nasce
                    do relógio passar do prazo. Quem o
                    dispara é a rotina agendada, uma vez
                    por movimentação — e ela só roda em
                    produção com{" "}
                    <code className="rounded bg-zinc-100 px-1 py-0.5 text-[11px]">
                      CRON_SECRET
                    </code>{" "}
                    definida.
                  </p>

                </div>

                <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) =>
                      setActive(e.target.checked)
                    }
                    className="h-4 w-4 accent-violet-600"
                  />
                  Ativo
                </label>

                <div className="flex items-center gap-2 pt-2">

                  <PrimaryButton
                    onClick={salvar}
                    disabled={pending || !url.trim()}
                  >
                    {webhook
                      ? "Salvar"
                      : "Criar webhook"}
                  </PrimaryButton>

                  {webhook && (
                    <GhostButton
                      onClick={() =>
                        setConfirmingDelete(true)
                      }
                    >
                      Excluir
                    </GhostButton>
                  )}

                </div>

              </div>

            </SurfaceCard>

            {webhook && (

              <>
                <SurfaceCard
                  title="Assinatura"
                  description="Chave HMAC-SHA256 usada para o destino confirmar que a chamada veio daqui."
                >

                  <div className="space-y-3">

                    <div className="flex items-center gap-2">

                      <code className="flex-1 truncate rounded-xl bg-zinc-50 px-3 py-2.5 text-sm text-zinc-700">
                        {webhook.secret}
                      </code>

                      <button
                        onClick={copiarSegredo}
                        title="Copiar"
                        className="rounded-xl border border-zinc-200 p-2.5 text-zinc-500 transition-colors hover:bg-zinc-50"
                      >
                        {copied ? (
                          <Check
                            size={16}
                            className="text-emerald-600"
                          />
                        ) : (
                          <Copy size={16} />
                        )}
                      </button>

                      <button
                        onClick={regenerar}
                        disabled={pending}
                        title="Gerar nova chave"
                        className="rounded-xl border border-zinc-200 p-2.5 text-zinc-500 transition-colors hover:bg-zinc-50 disabled:opacity-50"
                      >
                        <RefreshCw size={16} />
                      </button>

                    </div>

                    <p className="text-xs leading-relaxed text-zinc-400">
                      Cabeçalho{" "}
                      <code>
                        x-cw-signature:
                        t=&lt;timestamp&gt;,v1=&lt;hmac&gt;
                      </code>
                      , HMAC-SHA256 sobre{" "}
                      <code>{"{timestamp}.{corpo}"}</code>
                      . Gerar nova chave invalida a atual —
                      atualize no destino também.
                    </p>

                  </div>

                </SurfaceCard>

                <SurfaceCard
                  title="Histórico de entregas"
                  description="Últimas tentativas — sucesso, falha e o motivo."
                  action={
                    <button
                      onClick={testar}
                      disabled={pending}
                      className="flex shrink-0 items-center gap-2 rounded-xl border border-violet-200 px-3.5 py-2 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-50 disabled:opacity-50"
                    >
                      <Send size={14} />
                      Testar
                    </button>
                  }
                >

                  {testResult && (
                    <p
                      className={`mb-3 rounded-xl px-3 py-2.5 text-xs font-medium ${
                        testResult.ok
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      {testResult.ok
                        ? "Teste entregue com sucesso."
                        : "Teste falhou — veja o histórico abaixo."}
                    </p>
                  )}

                  {deliveries.length === 0 ? (

                    <p className="py-6 text-center text-sm text-zinc-400">
                      Nenhuma entrega ainda.
                    </p>

                  ) : (

                    <div className="space-y-2">

                      {deliveries.map((item) => (

                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 px-4 py-2.5 text-sm"
                        >

                          <div className="flex min-w-0 items-center gap-2.5">

                            <span
                              className={`h-2 w-2 shrink-0 rounded-full ${
                                item.ok
                                  ? "bg-emerald-500"
                                  : "bg-rose-500"
                              }`}
                            />

                            <span className="font-medium text-zinc-700">
                              {item.event}
                            </span>

                            {item.caseProtocol && (
                              <span className="truncate text-xs text-zinc-400">
                                {item.caseProtocol}
                              </span>
                            )}

                          </div>

                          <span className="shrink-0 text-xs text-zinc-400">
                            {item.statusCode ??
                              item.error ??
                              "—"}{" "}
                            ·{" "}
                            {new Date(
                              item.createdAt
                            ).toLocaleString("pt-BR")}
                          </span>

                        </div>

                      ))}

                    </div>

                  )}

                </SurfaceCard>
              </>

            )}

          </>

        )}

      </div>

      <ConfirmDelete
        open={confirmingDelete}
        label="Webhook"
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={excluir}
      />

    </MainLayout>
  );
}
