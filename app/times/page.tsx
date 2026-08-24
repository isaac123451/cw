import { redirect } from "next/navigation";

/**
 * "Meu time" deixou de existir como tela própria em 23/08/2026.
 *
 * Ela mantinha um cadastro de times e pessoas **paralelo** ao do fluxo
 * de reclamações: dois lugares com o mesmo nome, conteúdo diferente e
 * nenhuma ligação com NPS ou ManyChat. Times e responsáveis passaram a
 * viver num lugar só, dentro do fluxo que os usa.
 *
 * A rota fica de pé como redirecionamento, e não apagada: quem tinha o
 * endereço salvo ou aberto numa aba receberia um 404 sem explicação, e
 * um 404 é o pior jeito de anunciar que algo mudou de lugar.
 */
export default function TimesPage() {
  redirect("/reclame-aqui/configuracoes?tab=times");
}
