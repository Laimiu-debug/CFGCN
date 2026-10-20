$CargoArguments = $args
$ErrorActionPreference = 'Stop'
# Import the existing C++ build environment only into this child process.
if ($env:OS -eq 'Windows_NT' -and -not (Get-Command link.exe -ErrorAction SilentlyContinue)) {
    $vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
    $installations = if (Test-Path -LiteralPath $vswhere) { & $vswhere -all -products '*' -property installationPath }
    $installations = @($installations) + @((Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\18\BuildTools'))
    $devcmd = $installations | ForEach-Object { Join-Path $_ 'Common7\Tools\VsDevCmd.bat' } | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if (-not $devcmd) { throw 'Install the Visual Studio C++ build tools and Windows SDK before building Rust on Windows.' }
    $environmentLines = & cmd.exe /d /s /c "`"$devcmd`" -no_logo -arch=x64 -host_arch=x64 && set"
    if ($LASTEXITCODE -ne 0) { throw 'Could not initialize the Visual Studio C++ build environment.' }
    foreach ($environmentLine in $environmentLines) {
        if ($environmentLine -match '^([^=]+)=(.*)$') { [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], 'Process') }
    }
}
& cargo @CargoArguments
exit $LASTEXITCODE
