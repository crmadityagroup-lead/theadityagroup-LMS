$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $projectRoot '.env'
$secretLine = Get-Content -LiteralPath $envFile | Where-Object { $_ -match '^CRON_SECRET=' } | Select-Object -First 1
if (-not $secretLine) { throw 'CRON_SECRET is not configured in .env.' }
$secret = ($secretLine -replace '^CRON_SECRET=', '').Trim().Trim('"').Trim("'")
if (-not $secret) { throw 'CRON_SECRET is empty.' }

Invoke-RestMethod -Method Get -Uri 'http://127.0.0.1:3000/api/cron/open-enquiry-escalation' -Headers @{ Authorization = "Bearer $secret" }
