$ErrorActionPreference = 'Stop'
$instagramProject = 'jmgasikbbuwnlckzxbdl'
$instagramPost = '18059583107571294'
$instagramComment = '18493053655111813'
$instagramWorkerSecret = $null
$instagramPtr = [IntPtr]::Zero

Write-Host 'Teste pontual do comentario da conta @richardweb23.'
Write-Host 'Digite o valor existente de INSTAGRAM_WORKER_SECRET; ele nao sera exibido.'
$instagramSecureSecret = Read-Host 'Segredo do worker' -AsSecureString
try {
  $instagramPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($instagramSecureSecret)
  $instagramWorkerSecret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($instagramPtr)
  if ([string]::IsNullOrWhiteSpace($instagramWorkerSecret)) { throw 'Segredo vazio; teste cancelado.' }
  if ($instagramWorkerSecret -match '[\x00-\x1F\x7F]') { throw 'O segredo contem quebra de linha ou outro caractere de controle. Digite apenas o valor, em uma unica linha.' }
  Push-Location (Join-Path $PSScriptRoot '..')
  try {
    # Fail closed if the event has already been claimed or processed.
    $sql = "do `$`$ begin if not exists (select 1 from public.instagram_eventos_brutos where estado='pendente' and payload::text like '%$instagramComment%') then raise exception 'Comentario de teste nao esta pendente'; end if; update public.instagram_publicacoes set monitorada=true where id='$instagramPost'; if not found then raise exception 'Publicacao nao encontrada'; end if; update public.instagram_configuracao set ativa=true; end `$`$;"
    & npx supabase db query --linked --project-ref $instagramProject $sql
    if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel preparar a publicacao.' }
    & npx supabase secrets set INSTAGRAM_SEND_ENABLED=true --project-ref $instagramProject
    if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel habilitar o envio de teste.' }
    try {
      $response = Invoke-WebRequest -Uri "https://$instagramProject.supabase.co/functions/v1/instagram-worker" -Method Post -Headers @{Authorization="Bearer $instagramWorkerSecret"} -ContentType 'application/json' -Body '{}' -TimeoutSec 45 -UseBasicParsing
      Write-Host "Resultado do worker: HTTP $($response.StatusCode) $($response.Content)"
    } catch {
      Write-Host "O worker retornou erro ou nao confirmou o resultado: $($_.Exception.Message)"
      Write-Host 'Nao repita a chamada; sera necessario verificar a atividade.'
    }
  } finally {
    & npx supabase secrets set INSTAGRAM_SEND_ENABLED=false --project-ref $instagramProject
    if ($LASTEXITCODE -ne 0) { Write-Warning 'Nao foi possivel desabilitar INSTAGRAM_SEND_ENABLED; verifique no Supabase imediatamente.' }
    $stopSql = "begin; update public.instagram_publicacoes set monitorada=false where id='$instagramPost'; update public.instagram_configuracao set ativa=false; commit;"
    & npx supabase db query --linked --project-ref $instagramProject $stopSql
    if ($LASTEXITCODE -ne 0) { Write-Warning 'Nao foi possivel desativar a automacao no banco; verifique no painel imediatamente.' }
    Pop-Location
  }
} finally {
  if ($instagramPtr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($instagramPtr) }
  $instagramWorkerSecret = $null
  $instagramSecureSecret.Dispose()
}
