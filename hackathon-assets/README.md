# Hackathon submission assets

Generated for the AssemblyAI Voice Agent Hackathon. Source files are kept so
every asset can be regenerated after a design change.

| File | What it is | Status |
| --- | --- | --- |
| `intervue-deck.pdf` | 9-slide pitch deck, 16:9 (960×540 pt), generated from `deck.html` | Ready |
| `deck.html` | Deck source. Uses the app's own palette (`#0b111d`, `#d8f97a`) | Source |
| `intervue-cover.png` | 1600×900 16:9 cover image, generated from `cover.html` | Ready |
| `cover.html` | Cover source | Source |
| `VIDEO_SCRIPT.md` | Shot-by-shot recording script with exact spoken lines | Ready — **you must record this** |
| `audit.html` | Layout audit for the cover (catches overflow and collisions) | Tooling |
| `run-audit.ps1` | Runs the cover audit in headless Chrome | Tooling |
| `audit-deck.ps1` | Runs the deck overflow audit in headless Chrome | Tooling |

## Regenerating the PDF and cover

```powershell
# Deck -> PDF (9 pages, exactly 16:9)
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=old --disable-gpu `
  --print-to-pdf="$PWD\hackathon-assets\intervue-deck.pdf" --no-pdf-header-footer `
  "$PWD\hackathon-assets\deck.html"

# Cover -> PNG (1600x900)
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=old --disable-gpu `
  --hide-scrollbars --screenshot="$PWD\hackathon-assets\intervue-cover.png" `
  --window-size=1600,900 "$PWD\hackathon-assets\cover.html"
```

Edge works as a drop-in replacement if Chrome is not installed.

## After editing either HTML file, re-run the layout audit

```powershell
& ".\hackathon-assets\run-audit.ps1" -File ".\hackathon-assets\cover.html"
& ".\hackathon-assets\audit-deck.ps1" -File ".\hackathon-assets\deck.html"
```

The cover audit reports headline line count, clearance from the orb, and
clearance above the footer. Both currently report `clear` on every slide. This
matters because the two HTML files use fixed pixel dimensions — a longer
headline or a larger font will silently overlap the orb or the footer, and
that is invisible in a diff.

## Remaining manual steps

1. **Deploy.** Set `ASSEMBLYAI_API_KEY` in the Render/Railway dashboard, then
   verify the live URL end to end with a real microphone.
2. **Rotate the AssemblyAI key** before deploying. The current key was shared in
   chat and should be treated as compromised.
3. **Record the video** following `VIDEO_SCRIPT.md`. This is the only required
   asset that cannot be generated from the repository.
4. **Upload** the repo URL, live demo URL, MP4, this PDF and the cover PNG.
