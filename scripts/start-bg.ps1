$projectDir = Split-Path $MyInvocation.MyCommand.Path -Parent | Split-Path -Parent
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1
$proc = Start-Process node `
    -ArgumentList "src/index.js" `
    -WorkingDirectory $projectDir `
    -WindowStyle Hidden `
    -RedirectStandardOutput "$projectDir\server.log" `
    -RedirectStandardError "$projectDir\server-error.log" `
    -PassThru
$proc.Id | Out-File "$projectDir\server.pid"
Write-Host "Server PID: $($proc.Id) - http://localhost:3000"
