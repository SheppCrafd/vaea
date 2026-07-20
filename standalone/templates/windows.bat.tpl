@echo off
setlocal
set "PTL_SELF=%~f0"
set "PTL_MARKER=:::PAYLOAD_START:::"
set "PTL_PS1=%TEMP%\portfolio-tracker-launcher-%RANDOM%.ps1"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$src=$env:PTL_SELF;$marker=$env:PTL_MARKER;$dst=$env:PTL_PS1;$c=Get-Content -LiteralPath $src -Raw;$i=$c.LastIndexOf($marker);if($i -lt 0){Write-Error 'payload marker not found';exit 1};$payload=$c.Substring($i+$marker.Length);Set-Content -LiteralPath $dst -Value $payload -NoNewline -Encoding UTF8"
if errorlevel 1 (
  echo.
  echo Something went wrong unpacking this launcher. Please re-download the file.
  echo.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%PTL_PS1%"
del "%PTL_PS1%" >nul 2>nul
echo.
pause
exit /b

:::PAYLOAD_START:::
$ErrorActionPreference = 'Stop'
$Port = 4173
$MaxPortAttempts = 20
$AppZipBase64 = @'
__PAYLOAD_B64__
'@

Add-Type -AssemblyName System.IO.Compression.FileSystem

$tempRoot = Join-Path $env:TEMP ("portfolio-tracker-" + [System.Guid]::NewGuid().ToString('N'))
$appDir = Join-Path $tempRoot 'app'
New-Item -ItemType Directory -Path $appDir -Force | Out-Null
$zipPath = Join-Path $tempRoot 'app.zip'

[System.IO.File]::WriteAllBytes($zipPath, [System.Convert]::FromBase64String(($AppZipBase64 -replace '\s', '')))
[System.IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $appDir)
Remove-Item $zipPath -Force
$fullAppDir = (Resolve-Path $appDir).Path

$mimeMap = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.mjs' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json; charset=utf-8'; '.svg' = 'image/svg+xml'
  '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.gif' = 'image/gif'; '.webp' = 'image/webp'
  '.ico' = 'image/x-icon'; '.woff' = 'font/woff'; '.woff2' = 'font/woff2'; '.ttf' = 'font/ttf'
  '.txt' = 'text/plain; charset=utf-8'; '.map' = 'application/json; charset=utf-8'
}

function Get-FreeListener {
  param([int]$StartPort, [int]$Attempts)
  for ($p = $StartPort; $p -lt $StartPort + $Attempts; $p++) {
    try {
      $l = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $p)
      $l.Start()
      return @{ Listener = $l; Port = $p }
    } catch {
      continue
    }
  }
  throw "Could not find a free port between $StartPort and $($StartPort + $Attempts)."
}

$bound = Get-FreeListener -StartPort $Port -Attempts $MaxPortAttempts
$listener = $bound.Listener
$Port = $bound.Port
$url = "http://127.0.0.1:$Port"

Write-Host ""
Write-Host "  Portfolio Tracker is running."
Write-Host "  $url"
Write-Host ""
Write-Host "  All your data is stored locally in this browser only -- nothing"
Write-Host "  is sent to a server. The AI chat widget is included but needs a"
Write-Host "  Base44 account to work."
Write-Host ""
Write-Host "  Close this window (or press Ctrl+C) to stop the app."

Start-Process $url

while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    # Browsers routinely open extra speculative/preconnect sockets that
    # never send a request. This server handles one connection at a time,
    # so without a timeout a single idle connection like that would block
    # ReadLine() forever and permanently wedge the whole server.
    $client.ReceiveTimeout = 3000
    $client.SendTimeout = 3000
    $stream = $client.GetStream()
    $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII)
    $requestLine = $reader.ReadLine()
    if (-not $requestLine) { $client.Close(); continue }
    while (($headerLine = $reader.ReadLine()) -and $headerLine -ne '') { }

    $reqPath = '/'
    $parts = $requestLine -split ' '
    if ($parts.Length -ge 2) { $reqPath = $parts[1] }
    $reqPath = $reqPath.Split('?')[0]
    $reqPath = [System.Uri]::UnescapeDataString($reqPath)
    if ($reqPath -eq '/') { $reqPath = '/index.html' }

    $candidatePath = Join-Path $appDir ($reqPath.TrimStart('/').Replace('/', [IO.Path]::DirectorySeparatorChar))
    $resolvedCandidate = $null
    if (Test-Path -LiteralPath $candidatePath -PathType Leaf) {
      $resolvedCandidate = (Resolve-Path -LiteralPath $candidatePath).Path
    }
    if (-not $resolvedCandidate -or -not $resolvedCandidate.StartsWith($fullAppDir)) {
      $finalPath = Join-Path $appDir 'index.html'
    } else {
      $finalPath = $resolvedCandidate
    }

    $bytes = [System.IO.File]::ReadAllBytes($finalPath)
    $ext = [System.IO.Path]::GetExtension($finalPath).ToLowerInvariant()
    $mime = $mimeMap[$ext]
    if (-not $mime) { $mime = 'application/octet-stream' }

    $header = "HTTP/1.1 200 OK`r`nContent-Type: $mime`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`n`r`n"
    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
    $stream.Write($headerBytes, 0, $headerBytes.Length)
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Flush()
  } catch {
    # best-effort -- a single bad request shouldn't take the server down
  } finally {
    $client.Close()
  }
}
