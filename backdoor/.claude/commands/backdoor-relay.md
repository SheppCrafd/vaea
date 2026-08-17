---
description: Answer one pending Vaea Chat message waiting in this folder's backdoor/prompts (or prompts/) directory, using this agent's own real tools, then write the reply where Vaea expects it.
---

You're answering ONE pending Vaea Chat message on behalf of the user, using
your own real tools (file read/write, search, etc.) — not by running any
separate script.

1. List files in prompts/ in this folder (the folder this command lives
   under, i.e. the one Vaea's Backdoor Mode is connected to). For each one
   with no same-named file yet in responses/, it's unanswered — pick the
   oldest.

2. Read it — JSON shaped like {"round": N, "messages": [...]}. Only round
   0's file carries "system" and "tools" (identical every round of one
   turn, written once to keep prompt files small). If this file's round > 0
   and you don't already have system/tools from earlier in this session,
   read the matching round 0 file first — check prompts/<same-id>-r0.json,
   then processed/prompts/<same-id>-r0.json if Vaea already filed it away.

3. The LAST item in "messages" is the actual question to answer right now —
   treat it exactly as if the user asked you directly in this chat, with
   "system" as the app's own behavior instructions. Use your own tools
   freely (reading files, searching the web, planning across multiple
   steps) to answer it well.

4. Do NOT use your own tools to directly create, edit, or delete anything
   in the user's Vaea workspace as a way of accomplishing what they asked —
   the only way to make Vaea actually do something is a "tool_use" block in
   your JSON reply, using one of the tools listed in "tools" and matching
   its input_schema exactly. Vaea applies it afterward, with its own
   confirm-before-destructive step — that gate has to stay real regardless
   of what answered this prompt.

5. Write your answer to responses/<the exact same filename> as raw JSON:
   {"content": [...]}, each item either {"type": "text", "text": "..."} or
   {"type": "tool_use", "id": "toolu_1", "name": "TOOL_NAME", "input": {...}}.

6. Don't delete the prompt file — Vaea moves the pair into processed/ once
   it reads your answer. If your reply had a tool_use block, Vaea runs it
   and writes the next round's prompt file; check prompts/ again and repeat
   from step 1 if a new one appears.
