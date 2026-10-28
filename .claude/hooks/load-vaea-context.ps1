# SessionStart loader for Vaea. Claude Code cuts any single hook's output to a ~2 KB
# preview once it passes roughly 10,000 characters, so everything here stays under
# $Budget: git state first, then the openings of the newest Vaea notes.
$repoPath = "C:\Users\mwall\vaea"
$vaultPath = "C:\Users\mwall\AI Dev Vault"
$Budget = 9000
$OpeningChars = 1200
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$out = New-Object System.Text.StringBuilder

Push-Location $repoPath
[void]$out.AppendLine("## Git status ($(git branch --show-current))")
$status = (git status --short) -join "`n"
[void]$out.AppendLine($(if ($status) { $status } else { "(clean)" }))
[void]$out.AppendLine()
[void]$out.AppendLine("## Recent commits")
[void]$out.AppendLine(((git log --oneline -10) -join "`n"))
Pop-Location

[void]$out.AppendLine()
[void]$out.AppendLine("## Vaea-related vault notes (5 most recently updated; openings only, Read the file for the rest)")
$notes = Get-ChildItem $vaultPath -Recurse -Filter "Vaea*.md" -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch '\\\.obsidian\\' } |
    Sort-Object LastWriteTime -Descending | Select-Object -First 5

foreach ($n in $notes) {
    $rel = $n.FullName.Substring($vaultPath.Length + 1)
    $text = Get-Content -LiteralPath $n.FullName -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
    if ($null -eq $text) { $text = '' }
    $text = $text.Trim()
    if ($text.Length -gt $OpeningChars) { $text = $text.Substring(0, $OpeningChars).TrimEnd() + " [...]" }
    $block = "--- $rel (updated $($n.LastWriteTime.ToString('yyyy-MM-dd HH:mm'))) ---`n$text`n"
    if ($out.Length + $block.Length -gt $Budget) {
        [void]$out.AppendLine("--- (more notes skipped to stay under the hook size limit) ---")
        break
    }
    [void]$out.AppendLine($block)
}

Write-Output $out.ToString()
