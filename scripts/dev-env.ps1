# Prepara ESTA terminal de PowerShell para el proyecto: JDK 25 + Maven en el PATH.
# No cambia nada permanente (otras terminales y otros proyectos siguen igual).
#
# Uso, desde la raíz del repo (con el punto y el espacio delante):
#   . .\scripts\dev-env.ps1
#
# Busca el JDK 25 en JAVA_HOME, ~/.jdks y "Program Files", y Maven en el PATH o en ~/.maven.

function Find-Jdk25 {
  $candidates = @()
  if ($env:JAVA_HOME) { $candidates += $env:JAVA_HOME }
  $candidates += Get-ChildItem -Directory -ErrorAction SilentlyContinue `
    "$env:USERPROFILE\.jdks\*25*", "$env:USERPROFILE\.jdk25\*",
    "$env:ProgramFiles\Eclipse Adoptium\jdk-25*", "$env:ProgramFiles\Java\jdk-25*" |
    Sort-Object Name -Descending | ForEach-Object FullName
  foreach ($c in $candidates) {
    $release = Join-Path $c "release"
    if ((Test-Path "$c\bin\java.exe") -and (Test-Path $release) -and
        (Select-String -Path $release -Pattern 'JAVA_VERSION="25' -Quiet)) {
      return $c
    }
  }
  return $null
}

function Find-MavenBin {
  $mvn = Get-Command mvn -ErrorAction SilentlyContinue
  if ($mvn) { return Split-Path $mvn.Source }
  $dir = Get-ChildItem -Directory -ErrorAction SilentlyContinue "$env:USERPROFILE\.maven\apache-maven-*" |
    Sort-Object Name -Descending | Select-Object -First 1
  if ($dir -and (Test-Path "$($dir.FullName)\bin\mvn.cmd")) { return "$($dir.FullName)\bin" }
  return $null
}

$jdk = Find-Jdk25
if (-not $jdk) {
  Write-Host "No encontré un JDK 25. Instalalo (https://adoptium.net) o poné JAVA_HOME apuntando a él." -ForegroundColor Red
  return
}
$mavenBin = Find-MavenBin
if (-not $mavenBin) {
  Write-Host "No encontré Maven. Instalalo (https://maven.apache.org) o agregalo al PATH." -ForegroundColor Red
  return
}

$env:JAVA_HOME = $jdk
$env:PATH = "$jdk\bin;$mavenBin;$env:PATH"

Write-Host "Listo para Pelusa en esta terminal:" -ForegroundColor Green
Write-Host "  JAVA_HOME = $jdk"
Write-Host "  Maven     = $mavenBin"
& "$jdk\bin\java.exe" -version 2>&1 | Select-Object -First 1 | ForEach-Object { Write-Host "  $_" }
