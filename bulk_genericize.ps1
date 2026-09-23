$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

# Mapping of patterns to generic replacements
$replacements = @{
    '/volume1/Web/Inventaire_Pompier' = $projectRoot
    '/volume1/Secrets'               = Join-Path $projectRoot 'Secrets'
    'CT Taluyers / Montagny / Chassagny' = 'Votre caserne de secours'
    'CT Taluyers' = 'Caserne'
    'SDMIS' = 'SDIS'
    'Inventaire_TMC' = 'Inventaire_Generique'
}

# File extensions to process
$extensions = @('*.php','*.py','*.md','*.json')

Get-ChildItem -Path $projectRoot -Recurse -Include $extensions -File | ForEach-Object {
    $content = Get-Content -Path $_.FullName -Raw
    foreach ($pattern in $replacements.Keys) {
        $escaped = [regex]::Escape($pattern)
        $content = $content -replace $escaped, $replacements[$pattern]
    }
    Set-Content -Path $_.FullName -Value $content -Encoding UTF8
    Write-Host "Processed: $($_.FullName)"
}

# Mise à jour du README (phrase générique)
$readmePath = Join-Path $projectRoot 'README.md'
if (Test-Path $readmePath) {
    $readme = Get-Content -Path $readmePath -Raw
    $readme = $readme -replace 'CT Taluyers / Montagny / Chassagny', 'Votre caserne de secours'
    $readme = $readme -replace 'Ce projet a été initialement conçu pour les besoins du CT Taluyers / Montagny / Chassagny', 'Ce projet a été initialement conçu pour les besoins d’une caserne de secours'
    Set-Content -Path $readmePath -Value $readme -Encoding UTF8
    Write-Host "README updated"
}
