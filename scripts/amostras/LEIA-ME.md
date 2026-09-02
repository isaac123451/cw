# Amostras de aviso do Reclame Aqui

O `npm run check:email-ra` confere aqui dentro se o interpretador lê o
protocolo certo de um aviso **de verdade**. Sem nenhum arquivo, ele
reprova de propósito: as recusas que ele testa provam só o que o módulo
não faz, e verificador verde por falta de dado é pior que verificador
nenhum.

## Como salvar uma

No Gmail, abra o aviso, copie o corpo, e crie
`aviso-ra-<algo>.txt` neste diretório com três linhas de cabeçalho
antes do corpo:

```
De: Reclame Aqui <nao-responda@reclameaqui.com.br>
Assunto: Você recebeu uma nova reclamação
Data: 2026-09-01T10:00:00.000Z

(linha em branco acima, e o corpo daqui para baixo)
```

## Antes de salvar

**Troque os dados do consumidor por fictícios** — nome, e-mail,
telefone, documento. Estes arquivos vão para o repositório, e um aviso
real carrega dado de uma pessoa que não pediu para estar aqui.

O protocolo pode ficar como está: ele identifica a reclamação, não a
pessoa, e é justamente o que precisa ser conferido.

## Quantas

Uma já destrava. Mais de uma vale quando os avisos tiverem formatos
diferentes — reclamação nova, resposta do consumidor, reabertura —,
porque cada formato é um caminho de extração diferente.
