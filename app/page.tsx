import { redirect } from "next/navigation";

/**
 * A primeira tela do dia é a rotina — "a rotina documentada vira a
 * primeira tela do dia", do roadmap 1.0. O painel continua no menu.
 */
export default function Home() {
  redirect("/meu-dia");
}
