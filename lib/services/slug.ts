/**
 * Slug estável usado nas rotas de estabelecimento e cliente.
 * O nome pode ser corrigido depois sem quebrar o link já compartilhado.
 */
export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
