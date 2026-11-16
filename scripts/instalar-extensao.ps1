# Instala a extensão do CW Reputação com atualização automática (16/11/2026).
#
# "melhore a parte da atualização, tem que ser algo automático sem ter que
# ficar baixando nada". O Chrome não atualiza sozinho uma extensão carregada
# de uma pasta; este instalador cuida da pasta:
#
#   1. põe a extensão em %LOCALAPPDATA%\CWReputacao\extensao;
#   2. grava o atualizador (atualizar.ps1) e uma tarefa do Windows, só do
#      usuário (sem administrador), que a cada 10 minutos confere a versão na
#      plataforma e, se mudou, troca a pasta sozinha;
#   3. a extensão confere a própria pasta a cada 5 minutos e, quando ela
#      muda, se recarrega e volta às abas abertas.
#
# Uma vez por computador, colando no PowerShell o comando da página
# Extensão da plataforma. Servido em /extensao/instalar.txt; não usa "exit"
# (rodando por "iex", fecharia a janela de quem colou).

$ErrorActionPreference = 'Stop'
if (-not $CWOrigem) { $CWOrigem = 'https://cw-rho-eight.vercel.app' }
$CWOrigem = $CWOrigem.TrimEnd('/')

$base = Join-Path $env:LOCALAPPDATA 'CWReputacao'
$pasta = Join-Path $base 'extensao'
New-Item -ItemType Directory -Force -Path $base | Out-Null

$atualizador = @'
param([string]$Origem, [string]$Base)
# O atualizador da extensão do CW Reputação. Roda escondido a cada 10 min.
$ErrorActionPreference = 'Stop'
if (-not $Base) { $Base = Join-Path $env:LOCALAPPDATA 'CWReputacao' }
$pasta = Join-Path $Base 'extensao'
$marca = Join-Path $Base 'assinatura.txt'
$log = Join-Path $Base 'atualizacao.log'
$tmp = $null
try {
  $v = Invoke-RestMethod -Uri "$Origem/extensao/versao.json" -Headers @{ 'Cache-Control' = 'no-cache' } -TimeoutSec 30
  if (-not $v.assinatura) { throw 'versao.json sem assinatura' }
  $atual = if (Test-Path $marca) { (Get-Content $marca -Raw).Trim() } else { '' }
  if ($v.assinatura -eq $atual -and (Test-Path (Join-Path $pasta 'manifest.json'))) { exit 0 }
  $tmp = Join-Path $env:TEMP ('cw-extensao-' + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Force -Path $tmp | Out-Null
  $zip = Join-Path $tmp 'extensao.zip'
  Invoke-WebRequest -Uri "$Origem/extensao/cw-reputacao-extensao.zip" -OutFile $zip -UseBasicParsing -TimeoutSec 120
  Expand-Archive -Path $zip -DestinationPath $tmp -Force
  $nova = Join-Path $tmp 'cw-reputacao-extensao'
  if (-not (Test-Path (Join-Path $nova 'manifest.json'))) { throw 'o pacote veio sem manifest.json' }
  New-Item -ItemType Directory -Force -Path $pasta | Out-Null
  robocopy $nova $pasta /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "robocopy terminou com $LASTEXITCODE" }
  Set-Content -Path $marca -Value $v.assinatura -Encoding ascii
  Add-Content -Path $log -Value ('{0} atualizada para {1}' -f (Get-Date -Format s), $v.versao)
} catch {
  Add-Content -Path $log -Value ('{0} erro: {1}' -f (Get-Date -Format s), $_.Exception.Message)
} finally {
  if ($tmp) { Remove-Item -Path $tmp -Recurse -Force -ErrorAction SilentlyContinue }
}
'@
$arquivoDoAtualizador = Join-Path $base 'atualizar.ps1'
Set-Content -Path $arquivoDoAtualizador -Value $atualizador -Encoding utf8

# O lançador sem janela: o PowerShell direto pela tarefa piscaria a cada 10 minutos.
$lancador = Join-Path $base 'atualizar.vbs'
$linha = 'CreateObject("WScript.Shell").Run "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""' + $arquivoDoAtualizador + '"" -Origem ' + $CWOrigem + '", 0, False'
Set-Content -Path $lancador -Value $linha -Encoding ascii

Write-Host 'Baixando a extensão...'
& powershell -NoProfile -ExecutionPolicy Bypass -File $arquivoDoAtualizador -Origem $CWOrigem
if (-not (Test-Path (Join-Path $pasta 'manifest.json'))) {
  Write-Host 'Não deu para baixar a extensão agora. Veja o motivo em:' -ForegroundColor Yellow
  Write-Host (Join-Path $base 'atualizacao.log')
} else {
  schtasks /Create /F /SC MINUTE /MO 10 /TN 'CW Reputacao - atualizar extensao' /TR ('wscript.exe "' + $lancador + '"') | Out-Null
  try { Set-Clipboard -Value $pasta } catch { }
  Write-Host ''
  Write-Host 'Pronto. A extensão está em:' -ForegroundColor Green
  Write-Host "  $pasta"
  Write-Host '(o caminho já está copiado)'
  Write-Host ''
  Write-Host 'Falta uma vez só, no Chrome:'
  Write-Host '  1. Abra chrome://extensions e ligue o Modo do desenvolvedor.'
  Write-Host '  2. Se houver uma extensão CW Reputação antiga, clique em Remover.'
  Write-Host '  3. Clique em Carregar sem compactação e cole o caminho acima.'
  Write-Host '  4. Nas Opções da extensão, confira o endereço da plataforma.'
  Write-Host ''
  Write-Host 'Daqui em diante ela se atualiza sozinha: o Windows confere a cada 10 minutos.'
}
