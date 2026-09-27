param([string]$File)
$js = @'
window.addEventListener("load", () => {
  const out = [];
  const slides = Array.from(document.querySelectorAll(".slide"));
  out.push("slides found: " + slides.length);

  slides.forEach((slide, i) => {
    const sr = slide.getBoundingClientRect();
    const label = "slide " + (i + 1);
    let worst = 0, worstSel = "";
    let collisions = [];

    slide.querySelectorAll("h1, h2, h3, p, li, td, th, .card, .node, .link, .meter-row, .tag, .pill, b").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const bottomOver = r.bottom - sr.bottom;
      const rightOver = r.right - sr.right;
      const worstHere = Math.max(bottomOver, rightOver);
      if (worstHere > worst) {
        worst = worstHere;
        worstSel = el.tagName + "." + (el.className || "(none)") + " bottom=" + Math.round(r.bottom) + " right=" + Math.round(r.right);
      }
    });
    out.push(label + " overflow: " + (worst > 1 ? worst.toFixed(0) + "px  [" + worstSel + "]" : "clear"));

    // content height check: does the stacked content exceed the slide?
    const foot = slide.querySelector(".foot");
    const kids = Array.from(slide.querySelectorAll(".content > *, .kicker, h1, h2, .cols, .flow"));
    let maxBottom = 0;
    kids.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.height > 0) maxBottom = Math.max(maxBottom, r.bottom - sr.top);
    });
    if (foot) {
      const fr = foot.getBoundingClientRect();
      out.push(label + " content bottom " + Math.round(maxBottom) + " vs footer top " + Math.round(fr.top - sr.top) + " -> " + (maxBottom <= (fr.top - sr.top) + 1 ? "clear" : "COLLISION"));
    }
  });

  const pre = document.createElement("pre");
  pre.id = "AUDIT";
  pre.textContent = out.join("\n");
  document.body.appendChild(pre);
});
'@
$html = Get-Content $File -Raw
$html = $html.Replace("</body>", "<script>$js</script></body>")
$tmp = [System.IO.Path]::Combine($env:TEMP, "deck-audit.html")
Set-Content $tmp $html -Encoding UTF8
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
& $chrome --headless=old --disable-gpu --no-sandbox --window-size=1280,4000 --virtual-time-budget=6000 --dump-dom $tmp 2>$null |
  Out-File -FilePath "hackathon-assets\dom-deck.txt" -Encoding UTF8
$d = Get-Content "hackathon-assets\dom-deck.txt" -Raw
if ($d -match '(?s)<pre id="AUDIT">(.*?)</pre>') {
  $matches[1] -replace '&quot;', '"' -replace '&amp;', '&' -replace '&lt;', '<' -replace '&gt;', '>'
} else { "no audit block" }
