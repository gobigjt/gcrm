# Smaller sideload APKs: one file per CPU (~17MB arm64 vs ~52MB universal).
# Symbols folder is for deobfuscating crash stacks — do not publish publicly.
#
# Set API base URL for release (required for real devices / production):
#   $env:API_BASE_URL = "https://your-api.example.com/api"
#   .\tool\build_release_apk.ps1
Set-Location $PSScriptRoot\..
if ($env:API_BASE_URL -and $env:API_BASE_URL.Trim().Length -gt 0) {
    Write-Host "Using API_BASE_URL from environment."
    flutter build apk --release --split-per-abi --obfuscate --split-debug-info=build/app/outputs/symbols `
        --dart-define=API_BASE_URL=$($env:API_BASE_URL.Trim())
} else {
    Write-Warning "API_BASE_URL is not set. The APK will use dev defaults (10.0.2.2 on Android). For production or a physical phone, set `$env:API_BASE_URL before running this script."
    flutter build apk --release --split-per-abi --obfuscate --split-debug-info=build/app/outputs/symbols
}
