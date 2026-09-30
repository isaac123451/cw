/**
 * CW Reputação → planilha "Métricas do Reclame Aqui" (1.97).
 *
 * Preenche SOMENTE as células vazias da aba do mês. Nada que já está
 * preenchido é tocado — nem se o número do CW for diferente.
 *
 * COMO INSTALAR (uma vez, por quem administra a planilha):
 *   1. Na planilha: Extensões → Apps Script. Apague o que houver e cole
 *      este arquivo inteiro. Salve.
 *   2. Configurações do projeto (engrenagem) → Propriedades do script →
 *      adicione:
 *        CW_BASE   = https://cw-rho-eight.vercel.app
 *        CW_TOKEN  = o API_TOKEN da Vercel (o mesmo da API do CW)
 *   3. Volte ao editor, escolha a função `instalar` e clique em Executar.
 *      O Google pede autorização uma vez. Pronto: roda todo dia às 8h e
 *      aparece o menu "CW" na planilha para rodar na hora.
 *
 * O QUE PREENCHE (conferido contra os dias 1 a 24 de setembro/2026):
 *   Nº de reclamações entrantes (RA) · Reclamações respondidas ·
 *   Ciclos com o selo ativo — contados pelo CW;
 *   Nota de Reputação · Nota média dos consumidores · Voltariam ·
 *   Resolvidas (%) · Tempo médio · Não respondidas — do painel oficial do
 *   portal lido naquele dia (dia sem leitura fica vazio).
 * As outras linhas continuam à mão.
 */

var LINHAS_DO_CW = [
  "Nº de reclamações entrantes (RA)",
  "Nota de Reputação",
  "Reclamações respondidas",
  "Nota média dos consumidores",
  "Voltariam a fazer negócio",
  "Reclamações resolvidas (percentual)",
  "Tempo médio",
  "Ciclos com o selo ativo",
  "Reclamações não respondidas",
];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("CW")
    .addItem("Preencher o vazio agora", "preencherMetricas")
    .addToUi();
}

/** Cria o gatilho diário (8h) — rode uma vez. */
function instalar() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "preencherMetricas") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("preencherMetricas").timeBased().everyDays(1).atHour(8).create();
  preencherMetricas();
}

function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** A aba cujo A1 é o mês ("Set/2026"), do mês atual e do anterior. */
function preencherMetricas() {
  var props = PropertiesService.getScriptProperties();
  var base = String(props.getProperty("CW_BASE") || "").replace(/\/+$/, "");
  var token = String(props.getProperty("CW_TOKEN") || "");
  if (!base || !token) throw new Error("Defina CW_BASE e CW_TOKEN nas propriedades do script.");

  var hoje = new Date();
  var meses = [Utilities.formatDate(hoje, "America/Sao_Paulo", "yyyy-MM")];
  /* Nos três primeiros dias do mês, completa também o fim do mês anterior. */
  if (Number(Utilities.formatDate(hoje, "America/Sao_Paulo", "d")) <= 3) {
    var antes = new Date(hoje.getTime() - 5 * 86400000);
    meses.unshift(Utilities.formatDate(antes, "America/Sao_Paulo", "yyyy-MM"));
  }

  var resumo = [];
  meses.forEach(function (mes) {
    var r = UrlFetchApp.fetch(base + "/api/planilha/metricas?mes=" + mes, {
      headers: { Authorization: "Bearer " + token },
      muteHttpExceptions: true,
    });
    if (r.getResponseCode() !== 200) {
      resumo.push(mes + ": o CW respondeu " + r.getResponseCode() + " — " + r.getContentText().slice(0, 120));
      return;
    }
    resumo.push(preencherAba(JSON.parse(r.getContentText())));
  });

  Logger.log(resumo.join("\n"));
  try {
    SpreadsheetApp.getActive().toast(resumo.join("\n"), "CW Reputação", 8);
  } catch (e) {
    /* Rodando pelo gatilho, sem planilha aberta: só o registro. */
  }
}

function preencherAba(dados) {
  var planilha = SpreadsheetApp.getActive();
  var aba = planilha.getSheets().filter(function (s) {
    return normalizar(s.getRange(1, 1).getDisplayValue()) === normalizar(dados.cabecalho);
  })[0];
  if (!aba) return dados.cabecalho + ": nenhuma aba com " + dados.cabecalho + " em A1 — nada feito.";

  var faixa = aba.getDataRange();
  var valores = faixa.getDisplayValues();

  /* As colunas dos dias: o cabeçalho da linha 1 começa com o número do dia ("01-set."). */
  var colunaDoDia = {};
  valores[0].forEach(function (texto, col) {
    var m = String(texto).match(/^(\d{1,2})\s*-/);
    if (m && col > 0) colunaDoDia[Number(m[1])] = col;
  });

  var preenchidas = 0;
  LINHAS_DO_CW.forEach(function (rotulo) {
    var serie = dados.valores[rotulo];
    if (!serie) return;
    var linha = -1;
    for (var i = 0; i < valores.length; i++) {
      if (normalizar(valores[i][0]) === normalizar(rotulo)) { linha = i; break; }
    }
    if (linha < 0) return;

    dados.dias.forEach(function (dia, k) {
      var valor = serie[k];
      if (valor === null || valor === undefined || valor === "") return;
      var col = colunaDoDia[Number(dia.slice(8))];
      if (col === undefined) return;
      /* A regra: só o que está vazio. */
      if (String(valores[linha][col]).trim() !== "") return;
      aba.getRange(linha + 1, col + 1).setValue(valor);
      preenchidas++;
    });
  });

  return dados.cabecalho + ": " + preenchidas + " célula(s) vazia(s) preenchida(s).";
}
