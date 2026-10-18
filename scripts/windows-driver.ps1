$ErrorActionPreference = 'Stop'
# Use the WebView2 runtime's exact version, which may differ from the Edge browser.
$clients = 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients'
$runtime = Get-ChildItem $clients | ForEach-Object { Get-ItemProperty $_.PSPath } | Where-Object { $_.name -match 'WebView2' } | Select-Object -First 1
if (-not $runtime.pv) { throw 'WebView2 runtime not found on this Windows runner.' }
$version = $runtime.pv
$destination = Join-Path $env:RUNNER_TEMP 'wendao-edge-driver'
New-Item -ItemType Directory -Force -Path $destination | Out-Null
$archive = Join-Path $destination 'driver.zip'
Invoke-WebRequest "https://msedgedriver.microsoft.com/$version/edgedriver_win64.zip" -OutFile $archive
Expand-Archive $archive -DestinationPath $destination -Force
$destination | Out-File -FilePath $env:GITHUB_PATH -Encoding utf8 -Append
Write-Host "WebView2 and Edge Driver: $version"

$installer = Get-ChildItem 'src-tauri/target/release/bundle/nsis/*-setup.exe' | Select-Object -First 1
if (-not $installer) { throw 'NSIS installer not found.' }
$installed = Join-Path $env:RUNNER_TEMP 'wendao-installed'
$process = Start-Process -FilePath $installer.FullName -ArgumentList @('/S', "/D=$installed") -Wait -PassThru
if ($process.ExitCode -ne 0) { throw "NSIS failed: $($process.ExitCode)" }
$application = Get-ChildItem $installed -Filter '*.exe' | Where-Object { $_.Name -notmatch 'uninstall' } | Select-Object -First 1
if (-not $application) { throw 'Installed app executable not found.' }
"TAURI_SMOKE_APP=$($application.FullName)" | Out-File -FilePath $env:GITHUB_ENV -Encoding utf8 -Append
