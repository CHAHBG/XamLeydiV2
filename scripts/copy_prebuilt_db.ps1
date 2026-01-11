$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$src = Join-Path $repoRoot 'prebuilt\parcelapp.db'
$targets = @()
$targets += Join-Path $repoRoot 'parcelapp.db'
$targets += Join-Path $repoRoot 'ParcelApp\parcelapp.db'
$targets += Join-Path $repoRoot 'android-bundle\assets\raw\prebuilt_parcelapp.db'

if(-not (Test-Path $src)){
    Write-Error "Source prebuilt DB not found: $src"
    exit 1
}

foreach($t in $targets){
    $tdir = Split-Path $t -Parent
    if(-not (Test-Path $tdir)){
        New-Item -ItemType Directory -Path $tdir -Force | Out-Null
    }
    Copy-Item -Path $src -Destination $t -Force
    Write-Output "Copied to $t"
}

Write-Output "Sizes after copy:"
foreach($t in $targets){
    if(Test-Path $t){
        $s=Get-Item $t
        Write-Output "$t size=$($s.Length) mtime=$($s.LastWriteTime)"
    } else {
        Write-Output "Missing: $t"
    }
}