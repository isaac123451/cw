# API de dados — CW Reputação

Endpoints para **nós fornecermos nossos dados** a outros sistemas da
Cardápio Web — o CW Engine ou um banco de destino. Somente leitura: quem
consome lê os indicadores e as reclamações daqui, não escreve.

Nada a ver com a API do Reclame Aqui, que não existe publicamente.

## Autenticação

Token no cabeçalho, em todas as rotas:

```
Authorization: Bearer <API_TOKEN>
```

`API_TOKEN` é uma variável de ambiente com no mínimo 16 caracteres.
**Sem ela a API responde 503 e fica desligada — nunca aberta.** É
proposital: a base tem reclamação de consumidor real, e um endpoint
público por esquecimento de variável seria vazamento.

```bash
openssl rand -hex 32
```

| Resposta | Quando |
| -------- | ------ |
| `401` | Token ausente ou errado |
| `400` | Parâmetro inválido (a mensagem diz os valores aceitos) |
| `503` | `API_TOKEN` não configurado |

## O que a API não devolve

`e-mail` e `telefone` ficam de fora do payload. Um endpoint de gestão
responde "quantas reclamações de Financeiro estouraram o prazo" sem
precisar de contato do consumidor; quem precisa falar com ele usa a
tela, que tem controle de acesso por sessão.

## `GET /api/reputacao`

Nota do Reclame Aqui e os quatro indicadores que a compõem.

| Parâmetro | Valores | Padrão |
| --------- | ------- | ------ |
| `periodo` | `30d`, `3m`, `6m`, `12m` | `6m` |
| `modo` | `vigente`, `proximo` | `vigente` |

`modo=proximo` projeta a janela do mês seguinte — a leitura que a
calculadora do Hugme não faz.

```bash
curl -H "Authorization: Bearer $API_TOKEN" \
  "https://<host>/api/reputacao?periodo=6m&modo=vigente"
```

```json
{
  "periodo": {
    "chave": "6m",
    "rotulo": "6 meses",
    "modo": "vigente",
    "inicio": "2026-02-01",
    "fim": "2026-07-31",
    "parcial": false
  },
  "nota": 8.5,
  "faixa": "RA1000",
  "ra1000": true,
  "notaIndisponivel": false,
  "indicadores": {
    "resposta":      { "valor": 93.8, "meta": 90 },
    "consumidor":    { "valor": 7.82, "meta": 7 },
    "solucao":       { "valor": 92.3, "meta": 90 },
    "novosNegocios": { "valor": 76.9, "meta": 70 }
  },
  "tempoMedioRespostaMinutos": 28397,
  "contagens": {
    "recebidas": 129, "respondidas": 121, "semResposta": 8,
    "avaliadas": 78, "resolvidas": 72, "voltariam": 60
  }
}
```

A janela é sempre de **meses fechados**, como o Reclame Aqui apura —
nunca dias corridos. `parcial` indica que a janela ainda não terminou.

## `GET /api/casos`

Lista paginada.

| Parâmetro | Valores | Padrão |
| --------- | ------- | ------ |
| `canal` | `reclame-aqui`, `social`, `all` | `reclame-aqui` |
| `periodo` | `30d`, `3m`, `6m`, `12m` | sem filtro (base inteira) |
| `status` | nome exato do status | — |
| `categoria` | nome exato da categoria | — |
| `responsavel` | nome exato | — |
| `atualizadoApos` | `AAAA-MM-DD` | — |
| `limite` | 1 a 200 | 50 |
| `pagina` | a partir de 1 | 1 |

`atualizadoApos` é o parâmetro da **sincronização incremental**: devolve
só o que mudou depois da data, para quem puxa periodicamente não
reprocessar a base inteira a cada rodada.

```bash
# rotina diária do CW Engine
curl -H "Authorization: Bearer $API_TOKEN" \
  "https://<host>/api/casos?atualizadoApos=2026-08-07&limite=200"
```

```bash
curl -H "Authorization: Bearer $API_TOKEN" \
  "https://<host>/api/casos?periodo=6m&categoria=Financeiro&limite=50"
```

Devolve `total`, `pagina`, `limite`, `paginas` e `casos`, do mais recente
para o mais antigo.

## Fonte dos dados

Com `DATABASE_URL` configurado a API **lê do banco** — é o caminho de
produção. Sem banco, cai no dataset do repositório, para continuar
respondendo em desenvolvimento e no modo demonstração.

A troca vive em `lib/api/source.ts` e só ali: as rotas não sabem de onde
o dado veio.

Uma ressalva honesta enquanto os contextos da interface não migram para o
Prisma: **edições feitas nas telas não chegam à API**, porque ainda vivem
em memória. O que a API serve é o que está no banco (o seed carrega as
327 reclamações). Ver `ROADMAP.md`.
