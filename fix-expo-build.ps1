Param(
  [switch]$SkipPrebuild,
  [switch]$SkipGradleUserCache,
  [switch]$NoLegacyPeerDeps
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Write-Host "=== Expo / React Native Android Build Repair ===" -ForegroundColor Green

function Section($title){ Write-Host "`n[$title]" -ForegroundColor Cyan }
function Info($msg){ Write-Host "   [INFO] $msg" -ForegroundColor Gray }
function Ok($msg){ Write-Host "   [OK]   $msg" -ForegroundColor Green }
function Warn($msg){ Write-Host "   [WARN] $msg" -ForegroundColor Yellow }
function Err($msg){ Write-Host "   [ERR]  $msg" -ForegroundColor Red }

# Sanity checks
if(!(Test-Path package.json)){ Err "Run from project root (package.json missing)."; exit 1 }
if(!(Test-Path android)){ Err "android folder missing"; exit 1 }

Section "1. Stop Gradle daemons"
if(Test-Path "android/gradlew.bat"){
  & android/gradlew.bat --stop | Out-Null; Ok "Gradle daemons stopped"
} else { Warn "gradlew.bat not found" }

Section "2. Clean JavaScript dependencies"
# Attempt to stop common lock holders
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process java -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process gradle -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process metro -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

if(Test-Path node_modules){
  try {
    Remove-Item node_modules -Recurse -Force -ErrorAction Stop
    Ok "Removed node_modules"
  } catch {
    Warn "Direct deletion failed (locks). Fallback: rename node_modules"
    $stamp = Get-Date -Format yyyyMMddHHmmss
    $backup = "node_modules._old_$stamp"
    try {
      Rename-Item node_modules $backup -ErrorAction Stop
      Ok "Renamed to $backup (will be ignored)"
    } catch {
      Err "Failed to remove or rename node_modules: $_"; exit 1
    }
  }
} else { Info "node_modules already gone" }
if(Test-Path package-lock.json){ Remove-Item package-lock.json -Force; Ok "Removed package-lock.json" }

Section "3. Normalize package.json versions"
$pkgPath = "package.json"
$pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json

# Target versions for Expo SDK 53 (React 18 / RN 0.76 line)
$targetReact = "18.2.0"
$targetRN = "0.76.3"

if($pkg.dependencies.react -ne $targetReact){ $pkg.dependencies.react = $targetReact; Info "Set react -> $targetReact" }
if($pkg.dependencies.'react-native' -ne $targetRN){ $pkg.dependencies.'react-native' = $targetRN; Info "Set react-native -> $targetRN" }

if($pkg.dependencies.expo){
  # Keep higher patch if present
  if(-not ($pkg.dependencies.expo -match "^~53\.")){ $pkg.dependencies.expo = "~53.0.0"; Info "Set expo -> ~53.0.0" }
} else { Warn "expo not listed in dependencies" }

# Dev deps alignment for React 18
if($pkg.devDependencies.'@types/react' -and ($pkg.devDependencies.'@types/react' -match '^19\.')){ $pkg.devDependencies.'@types/react' = '18.2.45'; Info "Downgraded @types/react -> 18.2.45" }
if($pkg.devDependencies.'react-test-renderer' -and ($pkg.devDependencies.'react-test-renderer' -match '^19\.')){ $pkg.devDependencies.'react-test-renderer' = '18.2.0'; Info "Downgraded react-test-renderer -> 18.2.0" }

$pkg | ConvertTo-Json -Depth 20 | Set-Content $pkgPath -Encoding UTF8
Ok "package.json updated"

Section "4. Install JS dependencies"
$npmArgs = @('install')
if(-not $NoLegacyPeerDeps){ $npmArgs += '--legacy-peer-deps' }
$npmArgs += '--no-audit','--no-fund'
Write-Host ("npm " + ($npmArgs -join ' ')) -ForegroundColor Gray
try {
  npm @npmArgs
  if($LASTEXITCODE -eq 0){ Ok "npm install complete" } else { Warn "npm install returned code $LASTEXITCODE" }
} catch { Err "npm install failed: $_"; exit 1 }

Section "5. Purge Gradle caches"
Push-Location android
if(Test-Path '.gradle'){ Remove-Item .gradle -Recurse -Force; Ok "Removed android/.gradle" }
Pop-Location
if(-not $SkipGradleUserCache){
  $userCache = Join-Path $env:USERPROFILE '.gradle/caches'
  if(Test-Path $userCache){ Remove-Item $userCache -Recurse -Force; Ok "Removed user Gradle caches" } else { Info "User Gradle cache already clean" }
} else { Warn "Skipping user Gradle cache purge (parameter -SkipGradleUserCache)" }

Section "6. Normalize gradle.properties"
$gradlePropsPath = 'android/gradle.properties'
if(Test-Path $gradlePropsPath){
  $lines = Get-Content $gradlePropsPath
  $filtered = @()
  foreach($l in $lines){
    if($l -match '^kotlin\.version=' -or $l -match '^expo\.jsEngine=' -or $l -match '^newArchEnabled=true'){ Info "Removing: $l"; continue }
    $filtered += $l
  }
  if(-not ($filtered -match '^newArchEnabled=')){ $filtered += 'newArchEnabled=false'; Info 'Added newArchEnabled=false' }
  if(-not ($filtered -match '^hermesEnabled=')){ $filtered += 'hermesEnabled=true'; Info 'Added hermesEnabled=true' }
  Set-Content $gradlePropsPath $filtered -Encoding UTF8
  Ok "gradle.properties updated"
} else { Warn "gradle.properties missing" }

Section "7. Root build.gradle sanity"
$rootBuild = 'android/build.gradle'
if(Test-Path $rootBuild){
  $rootContent = Get-Content $rootBuild -Raw
  if($rootContent -match 'kotlin-gradle-plugin:1\.9\.24'){ Warn 'Found Kotlin 1.9.24 override; recommend removal for Expo SDK 53' }
  elseif($rootContent -match 'kotlin-gradle-plugin:2\.0\.21'){ Info 'Kotlin plugin 2.0.21 detected (ok)' }
  else { Info 'No explicit Kotlin plugin version (plugin may inject)' }
}

Section "8. Autolinking / prebuild"
if($SkipPrebuild){ Warn 'Skipping expo prebuild (--SkipPrebuild)'; }
else {
  Write-Host 'Running: npx expo prebuild --platform android --clean --non-interactive' -ForegroundColor Gray
  npx expo prebuild --platform android --clean --non-interactive
  if($LASTEXITCODE -ne 0){ Warn 'expo prebuild failed, attempting react-native config'; npx react-native config | Out-Null }
  else { Ok 'Prebuild complete' }
}

Section "9. Gradle clean + assembleDebug"
Push-Location android
Write-Host 'Running: gradlew.bat clean' -ForegroundColor Gray
& .\gradlew.bat clean
if($LASTEXITCODE -ne 0){ Err 'Gradle clean failed'; Pop-Location; exit 1 } else { Ok 'Gradle clean passed' }
Write-Host 'Running: gradlew.bat assembleDebug --stacktrace' -ForegroundColor Gray
& .\gradlew.bat assembleDebug --stacktrace
if($LASTEXITCODE -eq 0){ Ok 'BUILD SUCCESS (assembleDebug)' } else { Err 'Build failed (see errors above)' }
Pop-Location

Write-Host "`n=== Done ===" -ForegroundColor Green
Write-Host "If failure persists check: PackageList.java vs installed node_modules, duplicate resources, or leftover manual edits in MainApplication.kt." -ForegroundColor Yellow
