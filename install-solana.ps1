$ErrorActionPreference = "Stop"
$installDir = "$env:USERPROFILE\.local\share\solana\install"
$binDir = "$installDir\active_release\bin"

Write-Host "Baixando Solana CLI para Windows..." -ForegroundColor Cyan

$url = "https://github.com/anza-xyz/agave/releases/latest/download/solana-release-x86_64-pc-windows-msvc.tar.bz2"
$tarFile = "$env:TEMP\solana-release.tar.bz2"

Invoke-WebRequest -Uri $url -OutFile $tarFile -UseBasicParsing
Write-Host "Download concluido!" -ForegroundColor Green

New-Item -ItemType Directory -Force -Path $installDir | Out-Null

tar -xjf $tarFile -C $installDir
Write-Host "Extraido com sucesso!" -ForegroundColor Green

$currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
if ($currentPath -notlike "*$binDir*") {
    [Environment]::SetEnvironmentVariable("PATH", "$currentPath;$binDir", "User")
    Write-Host "PATH atualizado!" -ForegroundColor Green
}

Write-Host ""
Write-Host "Solana CLI instalado em: $binDir" -ForegroundColor Yellow
Write-Host "IMPORTANTE: Feche e reabra o terminal para o PATH ter efeito." -ForegroundColor Red
Write-Host ""
Write-Host "Depois execute: solana --version" -ForegroundColor Cyan
