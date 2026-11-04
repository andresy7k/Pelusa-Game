# PIT en Windows cuando la ruta del usuario tiene caracteres no-ASCII (ej. C:\Users\Andréss).
# Los procesos "minion" de PIT no logran cargar agentes/clases desde rutas con tildes,
# así que se corre sobre una COPIA en una ruta ASCII y luego se trae el reporte.
# En Linux/macOS/CI basta con: mvn test-compile org.pitest:pitest-maven:mutationCoverage
#
# Uso (desde backend/):  powershell -ExecutionPolicy Bypass -File scripts\pit-windows.ps1
param(
  [string]$Work = "C:\Temp\pelusa-pitrun",
  [string]$Repo = "C:\Temp\m2"   # junction ASCII → %USERPROFILE%\.m2\repository
)
$ErrorActionPreference = "Stop"
$backend = Split-Path -Parent $PSScriptRoot

New-Item -ItemType Directory -Force (Split-Path $Work) | Out-Null
if (-not (Test-Path $Repo)) {
  cmd /c mklink /J $Repo "$env:USERPROFILE\.m2\repository" | Out-Null
}
$tmp = "C:\Temp\pelusa-pit"
New-Item -ItemType Directory -Force $tmp | Out-Null

# El JDK también debe estar en una ruta ASCII (ej. ~/.jdks con "é" en el usuario).
if (-not $env:JAVA_HOME) {
  Write-Host "Falta JAVA_HOME (JDK 25). Corré antes: . .\scripts\dev-env.ps1" -ForegroundColor Red
  exit 1
}
if ($env:JAVA_HOME -match '[^\x00-\x7F]') {
  $jdkLink = "C:\Temp\jdk25"
  if (-not (Test-Path $jdkLink)) {
    cmd /c mklink /J $jdkLink "$env:JAVA_HOME" | Out-Null
  }
  $env:JAVA_HOME = $jdkLink
  $env:PATH = "$jdkLink\bin;$env:PATH"
}

if (Test-Path $Work) { Remove-Item -Recurse -Force $Work }
New-Item -ItemType Directory -Force $Work | Out-Null
Copy-Item "$backend\pom.xml" $Work
Copy-Item -Recurse "$backend\src" $Work

$env:MAVEN_OPTS = "-Djava.io.tmpdir=$tmp"
Push-Location $Work
try {
  mvn -B -ntp "-Dmaven.repo.local=$Repo" test-compile org.pitest:pitest-maven:mutationCoverage
  $code = $LASTEXITCODE
} finally {
  Pop-Location
}
$out = "$backend\target\pit-reports"
if (Test-Path $out) { Remove-Item -Recurse -Force $out }
New-Item -ItemType Directory -Force "$backend\target" | Out-Null
Copy-Item -Recurse "$Work\target\pit-reports" $out
Write-Host "Reporte: $out\index.html"
exit $code
