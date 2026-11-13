import type { FrenteId } from "@/lib/models/frentes";

/**
 * O Meu dia de cada um (05/11/2026).
 *
 * Pedido do Isaac: "outra pessoa irá trabalhar comigo e preciso que cada
 * um consiga usar perfeitamente. tipo as atividades do dia precisam ser
 * separadas". O Meu dia contava tudo da operação para quem abrisse: com
 * duas pessoas, as duas viam os mesmos 138 itens e trabalhariam em dobro.
 *
 * A regra, sem gravar nada no banco:
 *
 * 1. Item com responsável presente é dele.
 * 2. Sem responsável (ou com o responsável ausente): vai para quem recebe
 *    atendimentos e cobre a frente — papel de agente ou mais no módulo,
 *    a mesma regra da tela de Distribuição. Entre duas pessoas na mesma
 *    frente, a divisão é fixa por item (um hash do id): metade para cada,
 *    sempre a mesma metade, sem item sumir ou trocar de mão a cada recarga.
 * 3. Com uma pessoa só recebendo (ou quem abre não recebe), nada muda: o
 *    dia é o da operação inteira, como antes.
 *
 * Medido em 05/11/2026: 365 reclamações do RA, 145 das Redes e os 869 NPS
 * abertos estavam sem responsável — sem a regra 2, "separar" deixaria
 * quase tudo fora do dia de todo mundo.
 */

export interface PessoaDaDivisao {
  id: string;
  nome: string;
  /** As frentes em que recebe. */
  frentes: FrenteId[];
  ausente: boolean;
}

export interface DivisaoDoDia {
  /** Quem abriu a tela. */
  eu: string;
  /** Quem recebe atendimentos (marcado em Permissões), presente ou não. */
  pessoas: PessoaDaDivisao[];
  /**
   * Todas as contas ativas (13/11/2026): o caso com responsável é só do dia
   * dele, mesmo sem a divisão ligada — "o meu dia precisa ser diferente de
   * cada usuário". Sem isso, o caso que caiu para a Michele aparecia também
   * no dia de todo mundo.
   */
  usuarios?: { id: string; nome: string }[];
}

/** FNV-1a de 32 bits: estável entre servidor, navegador e recargas. */
export function hashDoItem(texto: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i += 1) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const presentes = (d: DivisaoDoDia) => d.pessoas.filter((p) => !p.ausente);

/** A divisão vale quando há duas ou mais pessoas presentes e quem abriu é uma delas. */
export function divisaoAtiva(d: DivisaoDoDia | null | undefined): d is DivisaoDoDia {
  if (!d) return false;
  const p = presentes(d);
  return p.length >= 2 && p.some((x) => x.id === d.eu);
}

/**
 * Quem faz o item hoje: o id da pessoa. `dono` é o nome do responsável
 * (é como as telas guardam), ou vazio.
 */
export function quemFaz(item: { chave: string; dono?: string | null; frente: FrenteId }, d: DivisaoDoDia): string | null {
  const aqui = presentes(d);
  const dono = item.dono?.trim();
  if (dono) {
    const pessoa = aqui.find((p) => p.nome === dono);
    if (pessoa) return pessoa.id;
  }
  const naFrente = aqui.filter((p) => p.frentes.includes(item.frente));
  const candidatos = (naFrente.length ? naFrente : aqui).slice().sort((a, b) => a.id.localeCompare(b.id));
  if (!candidatos.length) return null;
  return candidatos[hashDoItem(`${item.frente}:${item.chave}`) % candidatos.length].id;
}

/** O dono do item é outra conta ativa (e presente)? Então o item é do dia dela. */
function donoDeOutro(item: { dono?: string | null }, d: DivisaoDoDia) {
  const dono = item.dono?.trim();
  if (!dono) return null;
  const conta = d.usuarios?.find((u) => u.nome === dono);
  if (!conta) return null;
  const ausente = d.pessoas.find((p) => p.id === conta.id)?.ausente;
  if (ausente) return null;
  return conta.id;
}

/** O dia está separado por pessoa? Pela divisão, ou só pelo responsável de cada caso (13/11/2026). */
export function separacaoAtiva(d: DivisaoDoDia | null | undefined): d is DivisaoDoDia {
  if (!d) return false;
  const outrasContas = (d.usuarios ?? []).filter((u) => u.id !== d.eu).length;
  return outrasContas > 0 || divisaoAtiva(d);
}

/**
 * O item é de quem abriu?
 *
 * 1. Com responsável que é outra conta ativa e presente: só dela.
 * 2. Com a divisão ligada: a regra de `quemFaz`.
 * 3. Sem divisão: tudo o que não é de outra pessoa é de quem abriu.
 */
export function ehMeu(item: { chave: string; dono?: string | null; frente: FrenteId }, d: DivisaoDoDia | null | undefined) {
  if (!d) return true;
  const dono = donoDeOutro(item, d);
  if (dono) return dono === d.eu;
  if (!divisaoAtiva(d)) return true;
  return quemFaz(item, d) === d.eu;
}

/** "Thais" — o primeiro nome, para "o dia da Thais". */
export const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? nome;
