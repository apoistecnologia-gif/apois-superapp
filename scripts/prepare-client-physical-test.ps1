$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Require-Command([string]$Name) {
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $cmd) { throw "[FAIL] Comando ausente: $Name" }
  return $cmd.Source
}

function Require-Env([string]$Name) {
  $value = [Environment]::GetEnvironmentVariable($Name, 'Process')
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "[FAIL] Variável obrigatória ausente nesta janela do PowerShell: $Name"
  }
  Write-Host "[OK] $Name carregada" -ForegroundColor Green
}

Write-Host "=== APOIS Cliente — preparação de teste físico ===" -ForegroundColor Cyan

$requiredEnv = @(
  'CORRIDAS_VITE_SUPABASE_URL',
  'CORRIDAS_VITE_SUPABASE_PUBLISHABLE_KEY',
  'CORRIDAS_WEB_MAPS_API_KEY',
  'CORRIDAS_ANDROID_MAPS_API_KEY'
)
$requiredEnv | ForEach-Object { Require-Env $_ }

Require-Command git | Out-Null
Require-Command node | Out-Null
Require-Command npm | Out-Null
Require-Command bun | Out-Null

$javaCandidates = @(
  $env:JAVA_HOME,
  'C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot'
) | Where-Object { $_ -and (Test-Path $_) }
if (-not $javaCandidates) { throw '[FAIL] Java 21 não encontrado.' }
$env:JAVA_HOME = $javaCandidates[0]
$env:Path = "$($env:JAVA_HOME)\bin;$env:Path"

$androidSdkCandidates = @(
  $env:ANDROID_SDK_ROOT,
  $env:ANDROID_HOME,
  "$env:LOCALAPPDATA\Android\Sdk"
) | Where-Object { $_ -and (Test-Path $_) }
if (-not $androidSdkCandidates) { throw '[FAIL] Android SDK não encontrado.' }
$env:ANDROID_SDK_ROOT = $androidSdkCandidates[0]
$env:ANDROID_HOME = $env:ANDROID_SDK_ROOT
$adb = Join-Path $env:ANDROID_SDK_ROOT 'platform-tools\adb.exe'
if (-not (Test-Path $adb)) { throw "[FAIL] adb não encontrado em $adb" }

Write-Host '[1/8] Inicializando snapshots protegidos...' -ForegroundColor Cyan
git submodule sync --recursive
if ($LASTEXITCODE -ne 0) { throw '[FAIL] git submodule sync' }
git submodule update --init --recursive
if ($LASTEXITCODE -ne 0) { throw '[FAIL] git submodule update' }
npm run verify:pins
if ($LASTEXITCODE -ne 0) { throw '[FAIL] verify:pins' }

Write-Host '[2/8] Auditorias e build Corridas + Entregas + shell...' -ForegroundColor Cyan
npm run build:superapp
if ($LASTEXITCODE -ne 0) { throw '[FAIL] build:superapp' }

$visualMarker = 'APOIS_VISUAL_KIT_V1'
$corridasDist = Join-Path $root 'superapp\shell\dist\modules\corridas'
$markerFound = Get-ChildItem $corridasDist -Recurse -File -Include *.js,*.css,*.html -ErrorAction Stop |
  Select-String -SimpleMatch $visualMarker -Quiet
if (-not $markerFound) { throw '[FAIL] APOIS_VISUAL_KIT_V1 não chegou ao shell final.' }
Write-Host '[OK] APOIS_VISUAL_KIT_V1 presente no shell final.' -ForegroundColor Green

Write-Host '[3/8] Preparando host Android Capacitor...' -ForegroundColor Cyan
$shell = Join-Path $root 'superapp\shell'
Set-Location $shell
bun install
if ($LASTEXITCODE -ne 0) { throw '[FAIL] bun install shell' }
if (Test-Path 'android') { Remove-Item 'android' -Recurse -Force }
bunx cap add android
if ($LASTEXITCODE -ne 0) { throw '[FAIL] cap add android' }
$sdkForward = $env:ANDROID_SDK_ROOT -replace '\\','/'
Set-Content -Path 'android\local.properties' -Value "sdk.dir=$sdkForward" -Encoding ASCII
bunx cap sync android
if ($LASTEXITCODE -ne 0) { throw '[FAIL] cap sync android' }

Write-Host '[4/8] Aplicando configuração e branding Android...' -ForegroundColor Cyan
Set-Location $root
node scripts/configure-superapp-android.mjs
if ($LASTEXITCODE -ne 0) { throw '[FAIL] configure-superapp-android' }
node scripts/install-superapp-launcher.mjs
if ($LASTEXITCODE -ne 0) { throw '[FAIL] install-superapp-launcher' }

Write-Host '[5/8] Gerando APK debug...' -ForegroundColor Cyan
$android = Join-Path $root 'superapp\shell\android'
Set-Location $android
& .\gradlew.bat assembleDebug --no-daemon --stacktrace
if ($LASTEXITCODE -ne 0) { throw '[FAIL] Gradle assembleDebug' }

$apk = Join-Path $android 'app\build\outputs\apk\debug\app-debug.apk'
if (-not (Test-Path $apk)) { throw "[FAIL] APK não encontrado em $apk" }
$apkItem = Get-Item $apk
$apkHash = (Get-FileHash $apk -Algorithm SHA256).Hash
Write-Host "[OK] APK: $($apkItem.FullName)" -ForegroundColor Green
Write-Host "[OK] Tamanho: $($apkItem.Length) bytes | SHA256: $apkHash" -ForegroundColor Green

Write-Host '[6/8] Verificando aparelho ADB...' -ForegroundColor Cyan
$devices = & $adb devices
$deviceLines = $devices | Select-String "\tdevice$"
if (-not $deviceLines) { throw '[FAIL] Nenhum aparelho Android autorizado no ADB.' }
$preferred = $deviceLines | Where-Object { $_.Line -like 'RX8RB0DLY8Y*' } | Select-Object -First 1
$serial = if ($preferred) { ($preferred.Line -split "\t")[0] } else { (($deviceLines | Select-Object -First 1).Line -split "\t")[0] }
Write-Host "[OK] Dispositivo: $serial" -ForegroundColor Green

Write-Host '[7/8] Instalando APK...' -ForegroundColor Cyan
& $adb -s $serial install -r $apk
if ($LASTEXITCODE -ne 0) { throw '[FAIL] adb install -r' }

Write-Host '[8/8] Abrindo APOIS Cliente...' -ForegroundColor Cyan
& $adb -s $serial shell am force-stop br.com.apois.app | Out-Null
& $adb -s $serial shell monkey -p br.com.apois.app -c android.intent.category.LAUNCHER 1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw '[FAIL] não foi possível abrir br.com.apois.app' }

Set-Location $root
Write-Host ''
Write-Host '=============================================' -ForegroundColor Green
Write-Host 'APOIS CLIENTE PRONTO PARA TESTE FÍSICO' -ForegroundColor Green
Write-Host 'Teste agora: Shell > Corridas > mapa > busca > selecionar endereço > categorias.' -ForegroundColor Yellow
Write-Host 'NÃO solicite uma corrida real e NÃO faça pagamento durante esta homologação.' -ForegroundColor Yellow
Write-Host "APK: $apk" -ForegroundColor Green
Write-Host '=============================================' -ForegroundColor Green
