---
name: l
description: Answer one pending Vaea Chat message waiting in this folder's prompts/ directory, using this agent's own real tools, then write the reply where Vaea expects it. Use when the user says something like "check local mode", "answer the pending prompt", or "run the local relay".
---

You're answering ONE pending Vaea Chat message on behalf of the user, using
your own real tools (file read/write, search, etc.) — not by running any
separate script.

1. List files in prompts/ in this folder (the folder this skill lives
   under, i.e. the one Vaea's Local Mode is connected to). For each one
   with no same-named file yet in responses/, it's unanswered — pick the
   oldest.

2. This folder also has VAEA_SYSTEM_PROMPT.md (the app's own behavior
   instructions) and VAEA_TOOL_CATALOG.json (the full list of tools you can
   call) — read them yourself, directly, once at the start of answering.
   Every prompts/<id>-r<round>.json file (including round 0) only ever
   holds {"round": N, "messages": [...]} — the live conversation itself,
   nothing static.

3. For anything about the CURRENT state of the user's workspace (their
   actual Areas/Products/Projects/Tasks/Stakeholders/Departments/Notes),
   read workspace-data.json in this same folder — it's rewritten fresh
   right before every message, so re-read it rather than trusting anything
   left over from earlier in this session. For the real current date/time,
   run `date` (or your own equivalent) yourself — don't trust anything
   else for either of these two things.

4. Read the unanswered prompt file — JSON shaped like
   {"round": N, "messages": [...]}. The LAST item in "messages" is the
   actual question to answer right now — treat it exactly as if the user
   asked you directly in this chat, following VAEA_SYSTEM_PROMPT.md's
   instructions for how to behave. Use your own tools freely (reading
   files, searching the web, planning across multiple steps) to answer it
   well.

5. Do NOT use your own tools to directly create, edit, or delete anything
   in the user's Vaea workspace as a way of accomplishing what they asked —
   the only way to make Vaea actually do something is a "tool_use" block in
   your JSON reply, using one of the tools listed in VAEA_TOOL_CATALOG.json
   and matching its input_schema exactly. Vaea applies it afterward, with
   its own confirm-before-destructive step — that gate has to stay real
   regardless of what answered this prompt.

6. Write your answer to responses/<the exact same filename> as raw JSON:
   {"content": [...]}, each item either {"type": "text", "text": "..."} or
   {"type": "tool_use", "id": "toolu_1", "name": "TOOL_NAME", "input": {...}}.

7. If your reply included a tool_use block, don't stop here — Vaea needs a
   few seconds to actually run it and write the next round's prompt file.
   Wait about 5 seconds (e.g. run `sleep 5`, or your own equivalent), then
   check prompts/ again for a new round of the SAME request id (same id,
   next round number) with no matching file yet in responses/. If it's
   there, go back and answer it the same way. If it's not there yet, wait
   and check again — try this up to about 12 times (roughly a minute total)
   before telling the user Vaea hasn't produced the next round yet, rather
   than silently ending. Only stop right away, with no waiting, when your
   OWN reply was text-only (no tool_use block) — that's a genuinely final
   answer; nothing more is coming for this request.

   Don't delete the prompt file yourself — Vaea moves the pair into
   processed/ automatically once it reads your answer.
