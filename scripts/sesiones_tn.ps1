# ===========================================================
#  Lista TODAS las conversaciones de Claude Code guardadas en
#  esta PC, agrupadas por la carpeta en la que se trabajo, y
#  abre la que elijas.
#
#  Claude Code guarda las conversaciones por carpeta, dentro de
#  %USERPROFILE%\.claude\projects\. El nombre de cada subcarpeta
#  es la ruta codificada, dificil de leer; por eso la ruta real
#  se lee del campo "cwd" que viene adentro del .jsonl.
#
#  No borra ni modifica nada: solo lee.
# ===========================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$base = Join-Path $env:USERPROFILE '.claude\projects'

Write-Host ''
Write-Host '  ================================================'
Write-Host '   TUS CONVERSACIONES DE CLAUDE - GRUPO TN'
Write-Host '  ================================================'
Write-Host ''

if (-not (Test-Path -LiteralPath $base)) {
    Write-Host "  No existe la carpeta $base"
    Write-Host '  Todavia no hay ninguna conversacion guardada en esta PC.'
    Write-Host ''
    Read-Host '  Enter para cerrar' | Out-Null
    exit 1
}

$items = New-Object System.Collections.Generic.List[object]

foreach ($dir in Get-ChildItem -LiteralPath $base -Directory -ErrorAction SilentlyContinue) {

    $files = @(Get-ChildItem -LiteralPath $dir.FullName -Filter '*.jsonl' -File -ErrorAction SilentlyContinue)
    if ($files.Count -eq 0) { continue }

    $newest = $files | Sort-Object LastWriteTime -Descending | Select-Object -First 1

    # Buscar el cwd real en las primeras lineas del .jsonl mas reciente.
    $cwd = $null
    foreach ($line in (Get-Content -LiteralPath $newest.FullName -TotalCount 50 -ErrorAction SilentlyContinue)) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        try { $obj = ConvertFrom-Json -InputObject $line -ErrorAction Stop } catch { continue }
        if ($obj.cwd) { $cwd = [string]$obj.cwd; break }
    }
    if ([string]::IsNullOrWhiteSpace($cwd)) { $cwd = $dir.Name }

    $items.Add([pscustomobject]@{
        Carpeta  = $cwd
        Sesiones = $files.Count
        Ultima   = $newest.LastWriteTime
        Existe   = (Test-Path -LiteralPath $cwd -PathType Container)
    })
}

if ($items.Count -eq 0) {
    Write-Host '  No encontre conversaciones guardadas.'
    Write-Host ''
    Read-Host '  Enter para cerrar' | Out-Null
    exit 1
}

$orden = @($items | Sort-Object Ultima -Descending)

$i = 0
foreach ($it in $orden) {
    $i++
    $marca = ' '
    if (-not $it.Existe) { $marca = '!' }
    Write-Host ('  [{0}]{1} {2}' -f $i, $marca, $it.Carpeta)
    Write-Host ('        {0} conversacion(es)   ultima: {1:dd/MM/yyyy HH:mm}' -f $it.Sesiones, $it.Ultima)
    Write-Host ''
}

$faltantes = @($orden | Where-Object { -not $_.Existe })
if ($faltantes.Count -gt 0) {
    Write-Host '  (!) esa carpeta ya no existe en el disco. Las conversaciones'
    Write-Host '      siguen guardadas, pero hay que volver a crear la carpeta'
    Write-Host '      con ese nombre exacto para poder retomarlas.'
    Write-Host ''
}

$sel = Read-Host ('  Numero para abrir (1-{0}), o Enter para salir' -f $orden.Count)
if ([string]::IsNullOrWhiteSpace($sel)) { exit 0 }

$n = 0
if ((-not [int]::TryParse($sel.Trim(), [ref]$n)) -or $n -lt 1 -or $n -gt $orden.Count) {
    Write-Host ''
    Write-Host '  Opcion invalida.'
    Read-Host '  Enter para cerrar' | Out-Null
    exit 1
}

$elegido = $orden[$n - 1]

if (-not (Test-Path -LiteralPath $elegido.Carpeta -PathType Container)) {
    Write-Host ''
    Write-Host ('  La carpeta ya no existe: {0}' -f $elegido.Carpeta)
    Write-Host '  Volve a crearla (o renombrala) con ese nombre exacto y proba de nuevo.'
    Write-Host ''
    Read-Host '  Enter para cerrar' | Out-Null
    exit 1
}

# Buscar claude.exe: primero en el perfil, despues en el PATH.
$claude = Join-Path $env:USERPROFILE '.local\bin\claude.exe'
if (-not (Test-Path -LiteralPath $claude)) {
    $encontrado = Get-Command claude -ErrorAction SilentlyContinue
    if ($encontrado) {
        $claude = $encontrado.Source
    } else {
        Write-Host ''
        Write-Host '  No encontre claude.exe (ni en el perfil ni en el PATH).'
        Write-Host '  Instalalo desde https://claude.com/claude-code'
        Write-Host ''
        Read-Host '  Enter para cerrar' | Out-Null
        exit 1
    }
}

Set-Location -LiteralPath $elegido.Carpeta

Write-Host ''
Write-Host ('  Abriendo en: {0}' -f (Get-Location).Path)
Write-Host '  Elegi la conversacion con las flechas y Enter.'
Write-Host ''

& $claude --resume

if ($LASTEXITCODE -ne 0) {
    Write-Host ''
    Write-Host ('  Claude termino con codigo {0}.' -f $LASTEXITCODE)
    Write-Host ''
    Read-Host '  Enter para cerrar' | Out-Null
}

exit $LASTEXITCODE
