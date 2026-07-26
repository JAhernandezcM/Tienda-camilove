$port = 8002
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

try {
    $listener.Start()
    Write-Host "Server successfully started at http://localhost:$port/"
    Write-Host "Press Ctrl+C in terminal or terminate the task to stop."
} catch {
    Write-Error "Failed to start server: $_"
    exit 1
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $rawUrl = $request.Url.LocalPath
        Write-Host "$(Get-Date -Format 'HH:mm:ss') - $($request.HttpMethod) - $rawUrl"

        if ($rawUrl -eq "/") {
            $rawUrl = "/index.html"
        }

        # Safe file path resolution
        # Clean path and decode URL characters
        $decodedUrl = [System.Uri]::UnescapeDataString($rawUrl)
        $cleanPath = $decodedUrl.Replace('/', [System.IO.Path]::DirectorySeparatorChar).TrimStart([System.IO.Path]::DirectorySeparatorChar)
        $filePath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine((Get-Location).Path, $cleanPath))

        # Support clean URLs (e.g. /checkout -> checkout.html)
        if (-not (Test-Path $filePath -PathType Leaf) -and [System.IO.Path]::GetExtension($filePath) -eq "") {
            $filePath = "$filePath.html"
        }

        # Check if the requested file is within the current workspace directory to prevent path traversal
        $currentDir = [System.IO.Path]::GetFullPath((Get-Location).Path)
        if (-not $filePath.StartsWith($currentDir)) {
            $response.StatusCode = 403
            $response.ContentType = "text/plain"
            $errBytes = [System.Text.Encoding]::UTF8.GetBytes("403 Forbidden")
            $response.ContentLength64 = $errBytes.Length
            $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
            $response.Close()
            continue
        }

        if (Test-Path $filePath -PathType Leaf) {
            try {
                $bytes = [System.IO.File]::ReadAllBytes($filePath)

                # Set content-type
                $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                switch ($ext) {
                    ".html" { $response.ContentType = "text/html; charset=utf-8" }
                    ".css"  { $response.ContentType = "text/css; charset=utf-8" }
                    ".js"   { $response.ContentType = "application/javascript; charset=utf-8" }
                    ".png"  { $response.ContentType = "image/png" }
                    ".jpg"  { $response.ContentType = "image/jpeg" }
                    ".jpeg" { $response.ContentType = "image/jpeg" }
                    ".gif"  { $response.ContentType = "image/gif" }
                    ".svg"  { $response.ContentType = "image/svg+xml" }
                    ".ico"  { $response.ContentType = "image/x-icon" }
                    default { $response.ContentType = "application/octet-stream" }
                }

                # Evita que el navegador guarde en caché versiones viejas mientras editamos el sitio.
                $response.Headers.Add("Cache-Control", "no-store, no-cache, must-revalidate")
                $response.Headers.Add("Pragma", "no-cache")

                $response.ContentLength64 = $bytes.Length
                if ($request.HttpMethod -ne "HEAD") {
                    $response.OutputStream.Write($bytes, 0, $bytes.Length)
                }
            } catch {
                $response.StatusCode = 500
                $response.ContentType = "text/plain"
                $errBytes = [System.Text.Encoding]::UTF8.GetBytes("500 Internal Server Error: $_")
                $response.ContentLength64 = $errBytes.Length
                $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
            }
        } else {
            $response.StatusCode = 404
            $response.ContentType = "text/plain"
            $errBytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.ContentLength64 = $errBytes.Length
            $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
        }
        $response.Close()
    }
} catch {
    Write-Host "Server loop stopped: $_"
} finally {
    $listener.Stop()
    Write-Host "Server stopped."
}
