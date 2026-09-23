$proj = 'c:\Users\Utilisateur\.gemini\antigravity\scratch\Inventaire_dev'
$config = Join-Path $proj 'api\config.php'

$content = Get-Content $config -Raw
$content = $content -replace '/volume1/Secrets/users_dev.json', "${proj}\Secrets\users_dev.json"
$content = $content -replace '/volume1/Secrets/rate_limit.json', "${proj}\Secrets\rate_limit.json"

Set-Content $config $content -Encoding UTF8
Write-Host 'config.php mis à jour'
