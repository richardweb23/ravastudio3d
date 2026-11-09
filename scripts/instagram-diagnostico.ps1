$ErrorActionPreference = 'Stop'
Write-Host 'Digite o valor existente de INSTAGRAM_WORKER_SECRET; ele nao sera exibido.'
$diagnosticSecure = Read-Host 'Segredo do worker' -AsSecureString
$diagnosticPtr = [IntPtr]::Zero
try {
  $diagnosticPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($diagnosticSecure)
  $diagnosticSecret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($diagnosticPtr)
  if ([string]::IsNullOrWhiteSpace($diagnosticSecret) -or $diagnosticSecret -match '[\x00-\x1F\x7F]') { throw 'Segredo vazio ou com caracteres de controle.' }
  $diagnosticResponse = Invoke-WebRequest -UseBasicParsing -Uri 'https://jmgasikbbuwnlckzxbdl.supabase.co/functions/v1/instagram-worker?diagnostic=1' -Method Post -Headers @{Authorization="Bearer $diagnosticSecret"} -ContentType 'application/json' -Body '{}' -TimeoutSec 45
  Write-Host "Diagnostico: $($diagnosticResponse.Content)"
} finally {
  if ($diagnosticPtr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($diagnosticPtr) }
  $diagnosticSecret = $null
  $diagnosticSecure.Dispose()
}
