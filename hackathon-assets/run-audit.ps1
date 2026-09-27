param([string]$File)
$audit = Get-Content "hackathon-assets\audit.html" -Raw
$js = [regex]::Match($audit, '(?s)<script>(.*)</script>').Groups[1].Value
$html = Get-Content $File -Raw
$html = $html.Replace("</body>", "<script>$js</script></body>")
$tmp = [System.IO.Path]::Combine($env:TEMP, "audit-injected.html")
Set-Content $tmp $html -Encoding UTF8
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
& $chrome --headless=old --disable-gpu --no-sandbox --window-size=1600,900 --virtual-time-budget=5000 --dump-dom $tmp 2>$null |
  Out-File -FilePath "hackathon-assets\dom.txt" -Encoding UTF8
$d = Get-Content "hackathon-assets\dom.txt" -Raw
if ($d -match '(?s)<pre id="AUDIT">(.*?)</pre>') {
  $matches[1] -replace '&quot;', '"' -replace '&amp;', '&' -replace '&lt;', '<' -replace '&gt;', '>'
} else {
  "no audit block"
}
