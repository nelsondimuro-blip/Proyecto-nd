# ===========================================================
#  Genera un informe de la carpeta "TN TU OP" para poder
#  revisarla desde una sesion de Claude en la web.
#
#  Escribe un archivo de texto en el Escritorio llamado
#  "Informe_TN_TU_OP.txt" que se puede adjuntar en el chat.
#
#  Solo lee: no borra ni modifica nada.
# ===========================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$excluidos = @('node_modules', '.git', '.next', 'dist', 'build', '.turbo', '.pnpm-store', 'coverage')

Write-Host ''
Write-Host '  ================================================'
Write-Host '   INFORME DE LA CARPETA TN TU OP'
Write-Host '  ================================================'
Write-Host ''

# --- 1) Encontrar la carpeta --------------------------------
$candidatas = @(
    (Join-Path $env:USERPROFILE 'Desktop\TN TU OP'),
    (Join-Path $env:USERPROFILE 'Escritorio\TN TU OP')
)
if ($env:OneDrive) {
    $candidatas += (Join-Path $env:OneDrive 'Desktop\TN TU OP')
    $candidatas += (Join-Path $env:OneDrive 'Escritorio\TN TU OP')
}

$raiz = $null
foreach ($c in $candidatas) {
    if (Test-Path -LiteralPath $c -PathType Container) { $raiz = $c; break }
}

if (-not $raiz) {
    Write-Host '  No encontre la carpeta "TN TU OP". Busque en:'
    foreach ($c in $candidatas) { Write-Host ('    ' + $c) }
    Write-Host ''
    Write-Host '  Si esta en otro lado, arrastra la carpeta sobre este archivo'
    Write-Host '  o edita la lista de rutas de arriba.'
    Write-Host ''
    Read-Host '  Enter para cerrar' | Out-Null
    exit 1
}

Write-Host ('  Carpeta: {0}' -f $raiz)
Write-Host '  Recorriendo archivos...'

# --- 2) Recolectar archivos ---------------------------------
$todos = @(Get-ChildItem -LiteralPath $raiz -Recurse -File -Force -ErrorAction SilentlyContinue)

$utiles = @($todos | Where-Object {
    $rel = $_.FullName.Substring($raiz.Length).TrimStart('\')
    $partes = $rel.Split('\')
    $hit = $false
    foreach ($p in $partes) { if ($excluidos -contains $p) { $hit = $true; break } }
    -not $hit
})

$pesados = @($todos | Where-Object { $_.Length -gt 5MB } | Sort-Object Length -Descending | Select-Object -First 15)

# --- 3) Armar el informe ------------------------------------
$out = New-Object System.Collections.Generic.List[string]
function Add-Line([string]$t) { $script:out.Add($t) }

Add-Line '=========================================='
Add-Line ' INFORME DE CARPETA - TN TU OP'
Add-Line (' Generado: {0:dd/MM/yyyy HH:mm}' -f (Get-Date))
Add-Line '=========================================='
Add-Line ''
Add-Line ('Ruta:  {0}' -f $raiz)
Add-Line ('Archivos totales:      {0}' -f $todos.Count)
Add-Line ('Archivos utiles:       {0}   (excluye {1})' -f $utiles.Count, ($excluidos -join ', '))
$tam = 0
foreach ($f in $todos) { $tam += $f.Length }
Add-Line ('Tamano total:          {0:N1} MB' -f ($tam / 1MB))
Add-Line ''

# --- Git ----------------------------------------------------
Add-Line '------------------------------------------'
Add-Line ' GIT'
Add-Line '------------------------------------------'
if (Test-Path -LiteralPath (Join-Path $raiz '.git')) {
    Push-Location -LiteralPath $raiz
    try {
        Add-Line ('Rama actual:  ' + (git rev-parse --abbrev-ref HEAD 2>&1 | Out-String).Trim())
        Add-Line ''
        Add-Line 'Remotos:'
        Add-Line ((git remote -v 2>&1 | Out-String).TrimEnd())
        Add-Line ''
        Add-Line 'Ultimos commits:'
        Add-Line ((git log --oneline -10 2>&1 | Out-String).TrimEnd())
        Add-Line ''
        Add-Line 'Cambios sin commitear:'
        $st = (git status --short 2>&1 | Out-String).TrimEnd()
        if ([string]::IsNullOrWhiteSpace($st)) { Add-Line '  (ninguno)' } else { Add-Line $st }
    } catch {
        Add-Line ('No pude leer el repo: ' + $_.Exception.Message)
    }
    Pop-Location
} else {
    Add-Line 'La carpeta NO es un repositorio git (no hay .git).'
    Add-Line 'O sea: lo que haya ahi no esta versionado ni subido a GitHub.'
}
Add-Line ''

# --- package.json -------------------------------------------
$pkgs = @($utiles | Where-Object { $_.Name -eq 'package.json' })
if ($pkgs.Count -gt 0) {
    Add-Line '------------------------------------------'
    Add-Line ' PACKAGE.JSON ENCONTRADOS'
    Add-Line '------------------------------------------'
    foreach ($p in $pkgs) {
        $rel = $p.FullName.Substring($raiz.Length).TrimStart('\')
        Add-Line ('--- ' + $rel + ' ---')
        try {
            Add-Line ((Get-Content -LiteralPath $p.FullName -Raw -ErrorAction Stop).TrimEnd())
        } catch {
            Add-Line '  (no se pudo leer)'
        }
        Add-Line ''
    }
}

# --- Archivos pesados ---------------------------------------
if ($pesados.Count -gt 0) {
    Add-Line '------------------------------------------'
    Add-Line ' ARCHIVOS DE MAS DE 5 MB'
    Add-Line '------------------------------------------'
    foreach ($f in $pesados) {
        $rel = $f.FullName.Substring($raiz.Length).TrimStart('\')
        Add-Line ('{0,8:N1} MB   {1}' -f ($f.Length / 1MB), $rel)
    }
    Add-Line ''
}

# --- Listado de archivos ------------------------------------
Add-Line '------------------------------------------'
Add-Line ' ARCHIVOS'
Add-Line '------------------------------------------'
foreach ($f in ($utiles | Sort-Object FullName)) {
    $rel = $f.FullName.Substring($raiz.Length).TrimStart('\')
    Add-Line ('{0,10:N0} B  {1:dd/MM/yyyy HH:mm}  {2}' -f $f.Length, $f.LastWriteTime, $rel)
}
Add-Line ''

# --- Conversaciones de Claude en esta carpeta ---------------
Add-Line '------------------------------------------'
Add-Line ' CONVERSACIONES DE CLAUDE EN ESTA CARPETA'
Add-Line '------------------------------------------'
$base = Join-Path $env:USERPROFILE '.claude\projects'
$encontradas = 0
if (Test-Path -LiteralPath $base) {
    foreach ($dir in Get-ChildItem -LiteralPath $base -Directory -ErrorAction SilentlyContinue) {
        $files = @(Get-ChildItem -LiteralPath $dir.FullName -Filter '*.jsonl' -File -ErrorAction SilentlyContinue)
        if ($files.Count -eq 0) { continue }
        $newest = $files | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        $cwd = $null
        foreach ($line in (Get-Content -LiteralPath $newest.FullName -TotalCount 50 -ErrorAction SilentlyContinue)) {
            if ([string]::IsNullOrWhiteSpace($line)) { continue }
            try { $obj = ConvertFrom-Json -InputObject $line -ErrorAction Stop } catch { continue }
            if ($obj.cwd) { $cwd = [string]$obj.cwd; break }
        }
        if ($cwd -and $cwd.TrimEnd('\') -eq $raiz.TrimEnd('\')) {
            $encontradas = $files.Count
            Add-Line ('{0} conversacion(es). Ultima: {1:dd/MM/yyyy HH:mm}' -f $files.Count, $newest.LastWriteTime)
        }
    }
}
if ($encontradas -eq 0) {
    Add-Line 'Ninguna conversacion guardada apunta a esta carpeta exacta.'
    Add-Line 'Usa Sesiones_TN.cmd para ver a que carpetas apuntan las que tenes.'
}
Add-Line ''
Add-Line '=========================  FIN  =========================='

# --- 4) Guardar ---------------------------------------------
$destino = Join-Path $env:USERPROFILE 'Desktop\Informe_TN_TU_OP.txt'
try {
    $out -join "`r`n" | Set-Content -LiteralPath $destino -Encoding UTF8 -ErrorAction Stop
} catch {
    $destino = Join-Path $env:USERPROFILE 'Informe_TN_TU_OP.txt'
    $out -join "`r`n" | Set-Content -LiteralPath $destino -Encoding UTF8
}

Write-Host ''
Write-Host '  Listo. Informe guardado en:'
Write-Host ('    {0}' -f $destino)
Write-Host ''
Write-Host '  Adjunta ese archivo en el chat de Claude para que lo revise.'
Write-Host ''
Read-Host '  Enter para cerrar' | Out-Null
exit 0
