# Rip out base44 — full migration plan to a self-owned Supabase backend

> **How to use this document**: this is meant to be picked up cold, in a
> brand-new chat session with zero prior context. It contains every decision
> already made, the full current-state inventory, the full target schema/SQL,
> and concrete before/after code for every file that needs to change. Work
> through "Implementation order" top to bottom. Update this file's checkboxes
> as you go so a session that picks this up mid-way knows what's already done.

## 0. Why this exists / non-negotiable requirements

The app at `C:\Users\mwall\portfolio-tracker` (a personal/team portfolio
tracker — Areas → Products → Projects → Tasks, stakeholders, an AI chat
assistant) is currently built entirely on **base44**: base44 provides the
database, auth, file storage, and all non-trivial backend logic, and even its
branding is hardcoded into `index.html`. The user wants **full ownership**:
not a hint of base44 anywhere, replaced with infrastructure they actually
own, with **no visual or functional difference** in the app itself — except
two specific, explicitly-approved additions (see "Approved scope additions"
below). This is a real migration, not a redesign: preserve existing UX,
copy, field names, and business-logic quirks (including a couple of known
cascade inconsistencies in the original code — see §3) unless told otherwise.

## 1. Decisions already made (do not re-ask the user about these)

| Topic | Decision |
|---|---|
| Backend | **Supabase** (Postgres + Auth + Storage + Edge Functions). One project, no local Docker/CLI dev stack — the user has no hosting background, so setup is dashboard-first with minimal CLI use. |
| Users | Multiple real users, real registration/login/password-reset (not a single-user app). |
| Data sharing | **Team-scoped shared board** — this is an *approved new feature* (see §1a), replacing base44's literal per-creator RLS (which the user confirmed is not the desired behavior and doesn't match the app's actual "shared dashboard" premise). |
| Admin/user role | **Removed entirely.** The `User.role` field exists in base44 today but is never checked anywhere in any function or frontend code — it was dead weight. User's explicit call: "just remove admin, no admin." Do not add role-based permission gating. |
| AI chat LLM | **Anthropic Claude**, called directly from a Supabase Edge Function using an `ANTHROPIC_API_KEY` secret. User is "still looking" at exact plan/key details — get the key from them when this step is reached. |
| Existing data | **None to migrate** — user confirmed the live base44 app holds no real data worth preserving. New backend starts empty. Do not build an export/import pipeline. |
| Frontend hosting | Explicitly deferred/out of scope for this migration — user has no hosting knowledge and asked to defer that decision. Supabase hosts the DB/auth/storage/edge-function itself, so nothing here blocks on a frontend hosting choice. `npm run dev` / `npm run build` continue to work locally throughout. |
| Setup help needed | User needs first-time walkthroughs for both creating a Supabase project and getting an Anthropic API key — include exact steps (§8) rather than assuming familiarity. |

### 1a. Approved scope addition: teams

There is no Team/Workspace concept anywhere in the current app. Building
real multi-team isolation is **new functionality**, explicitly chosen by the
user after being told plainly that it's not a pure port and requires *some*
new UI. Smallest-viable version, also explicitly chosen:

- **Invite-code model**: registering either creates a brand-new team
  automatically, or joins an existing team if the registrant supplies that
  team's invite code. One user = exactly one team (no multi-team membership,
  no separate join table needed — just `profiles.team_id`).
- **New UI surface, kept deliberately minimal**: one optional "Team invite
  code" field on the Register page; one small "Team" block in Settings
  showing the current team's invite code with copy + regenerate buttons.
- No admin/owner distinction within a team (matches the "no admin role" decision) — any team member can see/rotate the invite code.

Everything else about the app must look and behave exactly as it does today.

## 2. Complete current-state inventory (base44 surface being replaced)

### 2.1 Entities (`base44/entities/*.jsonc`)

Every entity implicitly also has base44-managed `id`, `created_date`,
`updated_date`, `created_by_id` fields not shown in the jsonc (only *custom*
properties are declared there).

**User** — no custom `rls` block (base44-platform-managed).
```json
{ "properties": {
    "role": { "type": "string", "enum": ["admin","user"] },
    "department": { "type": "string" },
    "avatar_url": { "type": "string" }
  },
  "required": ["role"], "name": "User", "type": "object" }
```
Effective shape also includes base44-builtin `full_name`, `disabled`,
`email` (referenced by `deactivateAccount`). **`role` is being dropped per
§1.**

**Area** — `rls: { create/read/update/delete: { created_by_id: "{{user.id}}" } }` (this exact block is repeated on every entity below; it's base44's literal per-creator default, being replaced by team-scoped RLS per §1a):
```json
{ "properties": {
    "title": {"type":"string"}, "description": {"type":"string"},
    "custom_schema": {"type":"object"}, "custom_data": {"type":"object"},
    "display_on_card_fields": {"type":"array","items":{"type":"string"}},
    "deleted_at": {"type":"string","format":"date-time"}
  }, "required": ["title"] }
```

**Product**:
```json
{ "properties": {
    "parent_area_id": {"type":"string"}, "title": {"type":"string"},
    "description": {"type":"string"},
    "stakeholder_ids": {"type":"array","items":{"type":"string"}},
    "custom_data": {"type":"object"},
    "display_on_card_fields": {"type":"array","items":{"type":"string"}},
    "deleted_at": {"type":"string","format":"date-time"}
  }, "required": ["parent_area_id","title"] }
```

**Project** — `parent_product_id` is NOT required (a project can stand alone directly under an Area):
```json
{ "properties": {
    "parent_product_id": {"type":"string"}, "parent_area_id": {"type":"string"},
    "title": {"type":"string"}, "objective": {"type":"string"},
    "problem_statement": {"type":"string"}, "activity": {"type":"string"},
    "metrics": {"type":"object"}, "owner_name": {"type":"string"},
    "due_date": {"type":"string","format":"date-time"},
    "due_date_status": {"type":"string","enum":["ESTIMATED","COMMITTED"],"default":"ESTIMATED"},
    "stakeholder_ids": {"type":"array","items":{"type":"string"}},
    "related_product_ids": {"type":"array","items":{"type":"string"}},
    "attachments": {"type":"array","items":{"type":"object"}},
    "links": {"type":"array","items":{"type":"object"}},
    "is_archived": {"type":"boolean","default":false},
    "archived_at": {"type":"string","format":"date-time"},
    "deleted_at": {"type":"string","format":"date-time"},
    "custom_data": {"type":"object"},
    "display_on_card_fields": {"type":"array","items":{"type":"string"}}
  }, "required": ["parent_area_id","title"] }
```

**Task** — `quadrant` has no declared range, but code treats missing/falsy as bucket 4:
```json
{ "properties": {
    "project_id": {"type":"string"}, "description": {"type":"string"},
    "status": {"type":"string","enum":["NOT_STARTED","IN_PROGRESS","DELEGATED","PENDING_FEEDBACK","ON_HOLD","BLOCKED","DONE","DELEGATED_DONE"],"default":"NOT_STARTED"},
    "quadrant": {"type":"integer"},
    "is_highly_important": {"type":"boolean","default":false},
    "is_quick_task": {"type":"boolean","default":false},
    "type": {"type":"string","enum":["COMMUNICATION","OPEN_QUESTIONS","SCRUM_NEEDS","EMPLOYEE_NEEDS","OTHER"],"default":"OTHER"},
    "notes": {"type":"string"},
    "stakeholder_ids": {"type":"array","items":{"type":"string"}},
    "attachments": {"type":"array","items":{"type":"object"}},
    "is_weekly_focus": {"type":"boolean","default":false},
    "is_today_top_three": {"type":"boolean","default":false},
    "archived_at": {"type":"string","format":"date-time"},
    "deleted_at": {"type":"string","format":"date-time"}
  }, "required": ["project_id","description"] }
```

**ProjectNote** — no `deleted_at` (real hard delete only, no soft-delete):
```json
{ "properties": {
    "project_id": {"type":"string"},
    "type": {"type":"string","enum":["RISK","QUESTION","NOTE"]},
    "content": {"type":"string"}, "reporter": {"type":"string"},
    "stakeholder_ids": {"type":"array","items":{"type":"string"}}
  }, "required": ["project_id","type","content"] }
```

**Stakeholder** — `department` is a plain string, NOT a foreign key:
```json
{ "properties": {
    "name": {"type":"string"}, "department": {"type":"string"},
    "avatar_url": {"type":"string"},
    "deleted_at": {"type":"string","format":"date-time"}
  }, "required": ["name"] }
```

**Department**:
```json
{ "properties": {
    "name": {"type":"string"},
    "deleted_at": {"type":"string","format":"date-time"}
  }, "required": ["name"] }
```

**ChatSession** (no soft-delete field — sessions are never soft-deleted):
```json
{ "properties": { "title": {"type":"string"} }, "required": [] }
```

**ChatMessage** (no soft-delete field):
```json
{ "properties": {
    "session_id": {"type":"string"},
    "role": {"type":"string","enum":["user","assistant"]},
    "content": {"type":"string"},
    "pending_action": {"type":"object"}
  }, "required": ["session_id","role","content"] }
```

### 2.2 Backend functions (`base44/functions/*/entry.ts`) — cascade semantics to preserve

All 11 share this shape: `Deno.serve`, `createClientFromRequest(req)`,
`base44.auth.me()` gate (401 if missing), try/catch → 500 on error.
**Known real inconsistencies in the shipped code — preserve them as-is, they are not simplifications on my part:**
- `archiveProject` cascades `archived_at` to **every** task under the project unconditionally (no `deleted_at`/already-archived filter) — different from every delete-* function, which all filter out already-deleted children first.
- `restoreProject` only filters tasks by `t.archived_at` truthy, not by `deleted_at`.
- `deleteProduct` gathers tasks from **all** matched projects (regardless of the project's own deleted-state) before filtering the tasks themselves by `deleted_at`.

Full cascade logic per function (params → effect → return):
- **`archivedProjects({start?, end?})`** → date-range overlap query (see exact predicate reproduced in SQL §4) + per-project quadrant counts (`[1,2,3,4]`, missing/falsy quadrant → bucket 4, active tasks only). Returns trimmed projection `{id,title,objective,due_date,parent_product_id,parent_area_id,updated_date,is_archived,archived_at,quadrant_counts}`, not full rows. Request body defensively parsed (`.catch(()=>({}))`) — the only function that does this.
- **`archiveProject({projectId})`** → `Project.is_archived=true, archived_at=now`; ALL tasks under it get `archived_at=now` (no filter). Returns `{project}`.
- **`restoreProject({projectId})`** → `Project.is_archived=false, archived_at=null`; tasks with truthy `archived_at` get it cleared. Returns `{project}`.
- **`deleteProject({projectId})`** → soft-delete project (`deleted_at=now`); cascade to non-deleted tasks under it. Returns `{project}`.
- **`deleteArea({areaId})`** → soft-delete area; cascade to non-deleted Products (`parent_area_id`), non-deleted Projects (`parent_area_id`), non-deleted Tasks under those projects. Returns `{area}`.
- **`deleteProduct({productId})`** → soft-delete product; cascade to non-deleted Projects (`parent_product_id`); tasks gathered from ALL matched projects then filtered by `!deleted_at`. Returns `{product}`.
- **`deleteDepartment({departmentId})`** → 404 if not found; soft-delete department; every non-deleted Stakeholder with `department === oldName` (string match) gets `department=''`. Returns `{department}`.
- **`renameDepartment({departmentId,newName})`** → 404 if not found; renames; if name actually changed, cascades new name string to every non-deleted Stakeholder matching the OLD name. No-ops the cascade if `newName===oldName`. Returns `{department}`.
- **`toggleTopThree({taskId})`** → 404 if not found; flips `is_today_top_three`; when turning ON, rejects with 400 if ≥3 *other* tasks in the same project already have it true ("Only 3 \"Top 3\" tasks are allowed per project"); turning OFF has no limit check. Returns `{task}`.
- **`deactivateAccount()`** → operates only on caller's own user id; sets `disabled=true, full_name='Deleted User', avatar_url=null` via service-role (base44 needed service-role because `User` has no custom RLS and the client-side field-whitelist wasn't trustworthy — **not needed in our rebuild**, see §5). Deliberately does NOT touch any Area/Product/Project/Task/Stakeholder data (shared team data). Returns `{user}`.
- **`aiChatStream`** — see full breakdown in §6; the big one (LLM-driven action dispatch with a confirm-first flow for destructive actions).

### 2.3 Frontend base44 call sites (full inventory, all read/confirmed verbatim)

- `src/api/base44Client.js` — SDK client construction.
- `src/lib/app-params.js` — base44 app-id/token/localStorage URL-param plumbing. Dies entirely (no Supabase equivalent needed).
- `src/lib/AuthContext.jsx` — full source captured in §7.1.
- `src/pages/{Login,Register,ForgotPassword,ResetPassword}.jsx` — full source captured in §7.2–7.5. **Important discovery: none of these 4 pages are actually registered in `src/App.jsx`'s `<Routes>` today** — see §7.0, this needs fixing as part of the migration regardless of base44 (base44's `auth.redirectToLogin()` apparently redirected to base44's own hosted login UI externally, which we no longer have — see §7.0 for the required App.jsx routing fix).
- `src/lib/chatCommands.js` — no base44 calls, just the slash-command list (`task,project,product,area,note,risk,question,stakeholder,status,top3,focus,help`), kept in sync by hand with the server-side copy. **Unchanged.**
- `src/hooks/use{Areas,Departments,Products,Projects,ProjectNotes,Stakeholders,Tasks}.js` — full source captured in §7.6–7.12.
- `src/hooks/useChat{Controller,Messages,Sessions}.js` — full source captured in §7.13–7.15.
- `src/hooks/useFileUpload.js` — full source in §7.16.
- `src/hooks/useWindowGeometry.js` — **NOT actually a base44 call site.** Only mentions "base44" in a code comment about the base44 visual editor's preview iframe sizing quirk. No import of base44/SDK. **Leave this file untouched** except optionally rewording that one comment.
- `src/components/ui/image.jsx` — full source in §7.17 (Wix/base44-media-host responsive-transform logic).
- `src/components/settings/DeleteAccountDialog.jsx` — full source in §7.18.
- `src/components/sidebar/AddStakeholderModal.jsx` — full source in §7.19 (inline avatar upload).
- `src/components/sidebar/StakeholderList.jsx` — one inline call site inside `StakeholderRow`'s `handleAvatarChange`: `const { file_url } = await base44.integrations.Core.UploadFile({ file }); updateStakeholder.mutate({ id: stakeholder.id, data: { avatar_url: file_url } });` — same 2-line swap as every other upload call site (§7.20).
- `src/components/UserNotRegisteredError.jsx` — base44's "app has an allowlist of registered users" concept. Becomes dead code (open registration has no equivalent) — **delete this file** and the branch in AuthContext that renders it.

Full base44 API surface referenced across the app (for grep-verification once migration is done — none of these strings should remain):
`auth.me`, `auth.logout`, `auth.redirectToLogin`, `auth.loginViaEmailPassword`, `auth.loginWithProvider`, `auth.register`, `auth.verifyOtp`, `auth.setToken`, `auth.resendOtp`, `auth.resetPasswordRequest`, `auth.resetPassword`; `entities.{Area,Product,Project,Task,ProjectNote,Stakeholder,Department,ChatSession,ChatMessage}.{list,filter,get,create,update,delete,subscribe}`; `functions.invoke`; `integrations.Core.{UploadFile,InvokeLLM}`; `asServiceRole`.

## 3. Target architecture

- **DB**: Supabase Postgres, one project/environment (no local Docker dev stack — dashboard SQL editor is the primary tool).
- **Auth**: Supabase Auth — email+password with OTP-code email verification (custom email template using `{{ .Token }}`), password recovery, Google OAuth provider (kept, but functionally gated on the user completing Google Cloud OAuth setup — see §8.4).
- **Storage**: one Supabase Storage bucket (`uploads`) for attachments + avatars.
- **Backend logic**: **10 of the 11 base44 functions become plain Postgres RPC functions** (`SECURITY INVOKER`, relying on RLS — no service-role needed anywhere, unlike base44's `deactivateAccount` which needed it). Created via one SQL script pasted into the Supabase SQL editor — **no CLI required** for any of these. Only `aiChatStream` needs a real server (secret + outbound HTTPS to Anthropic) — that one becomes a Supabase **Edge Function**, the only piece requiring the Supabase CLI.
- **Teams**: `teams` table + `profiles.team_id` (one team per user). Every data table gets a `team_id` column; RLS scopes every read/write to the caller's team via a `current_team_id()` helper function.
- **Realtime**: Postgres Changes replication enabled on `tasks` (replaces `Task.subscribe`).

## 4. Full SQL migration (paste into Supabase SQL Editor, in this order)

```sql
-- ============================================================
-- Portfolio Tracker — schema, RLS, triggers, RPC functions
-- Run this entire file in Supabase Dashboard > SQL Editor > New query
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- updated_date trigger helper ----------
create or replace function set_updated_date()
returns trigger language plpgsql as $$
begin
  new.updated_date = now();
  return new;
end;
$$;

-- ---------- teams ----------
create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create trigger trg_teams_updated before update on teams
  for each row execute function set_updated_date();

-- ---------- profiles (1 row per auth.users, 1 team per user) ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  team_id uuid references teams(id),
  full_name text,
  department text,
  avatar_url text,
  disabled boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create trigger trg_profiles_updated before update on profiles
  for each row execute function set_updated_date();

-- auto-create a profile row whenever a new auth user signs up
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- current_team_id() helper for RLS (security definer avoids
-- ---------- recursive-RLS issues when profiles itself is RLS-protected) ----------
create or replace function current_team_id()
returns uuid language sql stable security definer as $$
  select team_id from public.profiles where id = auth.uid();
$$;

-- ---------- areas ----------
create table areas (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) default current_team_id(),
  title text not null,
  description text,
  custom_schema jsonb,
  custom_data jsonb,
  display_on_card_fields text[],
  deleted_at timestamptz,
  created_by_id uuid references auth.users(id) default auth.uid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create trigger trg_areas_updated before update on areas
  for each row execute function set_updated_date();

-- ---------- products ----------
create table products (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) default current_team_id(),
  parent_area_id uuid not null references areas(id),
  title text not null,
  description text,
  stakeholder_ids uuid[] not null default '{}',
  custom_data jsonb,
  display_on_card_fields text[],
  deleted_at timestamptz,
  created_by_id uuid references auth.users(id) default auth.uid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create trigger trg_products_updated before update on products
  for each row execute function set_updated_date();

-- ---------- projects ----------
create table projects (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) default current_team_id(),
  parent_product_id uuid references products(id),
  parent_area_id uuid not null references areas(id),
  title text not null,
  objective text,
  problem_statement text,
  activity text,
  metrics jsonb,
  owner_name text,
  due_date timestamptz,
  due_date_status text not null default 'ESTIMATED' check (due_date_status in ('ESTIMATED','COMMITTED')),
  stakeholder_ids uuid[] not null default '{}',
  related_product_ids uuid[] not null default '{}',
  attachments jsonb not null default '[]',
  links jsonb not null default '[]',
  is_archived boolean not null default false,
  archived_at timestamptz,
  deleted_at timestamptz,
  custom_data jsonb,
  display_on_card_fields text[],
  created_by_id uuid references auth.users(id) default auth.uid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create trigger trg_projects_updated before update on projects
  for each row execute function set_updated_date();

-- ---------- tasks ----------
create table tasks (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) default current_team_id(),
  project_id uuid not null references projects(id),
  description text not null,
  status text not null default 'NOT_STARTED' check (status in
    ('NOT_STARTED','IN_PROGRESS','DELEGATED','PENDING_FEEDBACK','ON_HOLD','BLOCKED','DONE','DELEGATED_DONE')),
  quadrant int,
  is_highly_important boolean not null default false,
  is_quick_task boolean not null default false,
  type text not null default 'OTHER' check (type in
    ('COMMUNICATION','OPEN_QUESTIONS','SCRUM_NEEDS','EMPLOYEE_NEEDS','OTHER')),
  notes text,
  stakeholder_ids uuid[] not null default '{}',
  attachments jsonb not null default '[]',
  is_weekly_focus boolean not null default false,
  is_today_top_three boolean not null default false,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_by_id uuid references auth.users(id) default auth.uid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create trigger trg_tasks_updated before update on tasks
  for each row execute function set_updated_date();

-- ---------- project_notes (no soft delete — matches base44, real hard delete only) ----------
create table project_notes (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) default current_team_id(),
  project_id uuid not null references projects(id),
  type text not null check (type in ('RISK','QUESTION','NOTE')),
  content text not null,
  reporter text,
  stakeholder_ids uuid[] not null default '{}',
  created_by_id uuid references auth.users(id) default auth.uid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create trigger trg_project_notes_updated before update on project_notes
  for each row execute function set_updated_date();

-- ---------- stakeholders (department is a free string, not an FK) ----------
create table stakeholders (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) default current_team_id(),
  name text not null,
  department text,
  avatar_url text,
  deleted_at timestamptz,
  created_by_id uuid references auth.users(id) default auth.uid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create trigger trg_stakeholders_updated before update on stakeholders
  for each row execute function set_updated_date();

-- ---------- departments ----------
create table departments (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) default current_team_id(),
  name text not null,
  deleted_at timestamptz,
  created_by_id uuid references auth.users(id) default auth.uid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create trigger trg_departments_updated before update on departments
  for each row execute function set_updated_date();

-- ---------- chat_sessions (never soft-deleted) ----------
create table chat_sessions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) default current_team_id(),
  title text,
  created_by_id uuid references auth.users(id) default auth.uid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create trigger trg_chat_sessions_updated before update on chat_sessions
  for each row execute function set_updated_date();

-- ---------- chat_messages ----------
create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) default current_team_id(),
  session_id uuid not null references chat_sessions(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  pending_action jsonb,
  created_by_id uuid references auth.users(id) default auth.uid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create trigger trg_chat_messages_updated before update on chat_messages
  for each row execute function set_updated_date();

-- ============================================================
-- RLS
-- ============================================================
alter table teams enable row level security;
alter table profiles enable row level security;
alter table areas enable row level security;
alter table products enable row level security;
alter table projects enable row level security;
alter table tasks enable row level security;
alter table project_notes enable row level security;
alter table stakeholders enable row level security;
alter table departments enable row level security;
alter table chat_sessions enable row level security;
alter table chat_messages enable row level security;

create policy teams_select on teams for select using (id = current_team_id());
create policy teams_update on teams for update using (id = current_team_id());

create policy profiles_select_own on profiles for select using (id = auth.uid());
create policy profiles_update_own on profiles for update using (id = auth.uid());
create policy profiles_select_team on profiles for select using (team_id = current_team_id());

create policy areas_all on areas for all using (team_id = current_team_id()) with check (team_id = current_team_id());
create policy products_all on products for all using (team_id = current_team_id()) with check (team_id = current_team_id());
create policy projects_all on projects for all using (team_id = current_team_id()) with check (team_id = current_team_id());
create policy tasks_all on tasks for all using (team_id = current_team_id()) with check (team_id = current_team_id());
create policy project_notes_all on project_notes for all using (team_id = current_team_id()) with check (team_id = current_team_id());
create policy stakeholders_all on stakeholders for all using (team_id = current_team_id()) with check (team_id = current_team_id());
create policy departments_all on departments for all using (team_id = current_team_id()) with check (team_id = current_team_id());
create policy chat_sessions_all on chat_sessions for all using (team_id = current_team_id()) with check (team_id = current_team_id());
create policy chat_messages_all on chat_messages for all using (team_id = current_team_id()) with check (team_id = current_team_id());

-- ============================================================
-- Realtime — replaces Task.subscribe()
-- ============================================================
alter publication supabase_realtime add table tasks;

-- ============================================================
-- RPC functions (replace base44/functions/*/entry.ts)
-- ============================================================

create or replace function join_or_create_team(p_invite_code text default null, p_team_name text default null)
returns jsonb language plpgsql security definer as $$
declare
  v_team teams;
  v_code text;
begin
  if p_invite_code is not null and length(trim(p_invite_code)) > 0 then
    select * into v_team from teams where invite_code = upper(trim(p_invite_code));
    if v_team.id is null then
      raise exception 'Invalid invite code';
    end if;
  else
    loop
      v_code := upper(substr(md5(random()::text), 1, 8));
      exit when not exists (select 1 from teams where invite_code = v_code);
    end loop;
    insert into teams (name, invite_code)
      values (coalesce(p_team_name, 'My Team'), v_code)
      returning * into v_team;
  end if;

  update profiles set team_id = v_team.id where id = auth.uid();

  return jsonb_build_object('team', to_jsonb(v_team));
end;
$$;

create or replace function regenerate_team_invite_code()
returns jsonb language plpgsql security invoker as $$
declare
  v_team_id uuid := current_team_id();
  v_code text;
begin
  if v_team_id is null then
    raise exception 'You are not on a team';
  end if;
  loop
    v_code := upper(substr(md5(random()::text), 1, 8));
    exit when not exists (select 1 from teams where invite_code = v_code);
  end loop;
  update teams set invite_code = v_code where id = v_team_id;
  return jsonb_build_object('invite_code', v_code);
end;
$$;

create or replace function delete_area(p_area_id uuid)
returns jsonb language plpgsql security invoker as $$
declare
  v_now timestamptz := now();
  v_area areas;
begin
  update areas set deleted_at = v_now where id = p_area_id and team_id = current_team_id()
    returning * into v_area;
  if v_area.id is null then raise exception 'Area not found'; end if;

  update products set deleted_at = v_now
    where parent_area_id = p_area_id and deleted_at is null and team_id = current_team_id();

  update projects set deleted_at = v_now
    where parent_area_id = p_area_id and deleted_at is null and team_id = current_team_id();

  update tasks set deleted_at = v_now
    where project_id in (select id from projects where parent_area_id = p_area_id)
      and deleted_at is null and team_id = current_team_id();

  return jsonb_build_object('area', to_jsonb(v_area));
end;
$$;

create or replace function delete_product(p_product_id uuid)
returns jsonb language plpgsql security invoker as $$
declare
  v_now timestamptz := now();
  v_product products;
begin
  update products set deleted_at = v_now where id = p_product_id and team_id = current_team_id()
    returning * into v_product;
  if v_product.id is null then raise exception 'Product not found'; end if;

  update projects set deleted_at = v_now
    where parent_product_id = p_product_id and deleted_at is null and team_id = current_team_id();

  -- matches base44's actual behavior: tasks gathered from ALL matched
  -- projects regardless of the project's own deleted-state, then filtered
  -- by the task's own deleted_at before updating.
  update tasks set deleted_at = v_now
    where project_id in (select id from projects where parent_product_id = p_product_id)
      and deleted_at is null and team_id = current_team_id();

  return jsonb_build_object('product', to_jsonb(v_product));
end;
$$;

create or replace function delete_project(p_project_id uuid)
returns jsonb language plpgsql security invoker as $$
declare
  v_now timestamptz := now();
  v_project projects;
begin
  update projects set deleted_at = v_now where id = p_project_id and team_id = current_team_id()
    returning * into v_project;
  if v_project.id is null then raise exception 'Project not found'; end if;

  update tasks set deleted_at = v_now
    where project_id = p_project_id and deleted_at is null and team_id = current_team_id();

  return jsonb_build_object('project', to_jsonb(v_project));
end;
$$;

-- NOTE: matches base44's actual (slightly inconsistent) behavior — cascades
-- to ALL tasks under the project unconditionally, no deleted_at/already-archived filter.
create or replace function archive_project(p_project_id uuid)
returns jsonb language plpgsql security invoker as $$
declare
  v_now timestamptz := now();
  v_project projects;
begin
  update projects set is_archived = true, archived_at = v_now
    where id = p_project_id and team_id = current_team_id()
    returning * into v_project;
  if v_project.id is null then raise exception 'Project not found'; end if;

  update tasks set archived_at = v_now
    where project_id = p_project_id and team_id = current_team_id();

  return jsonb_build_object('project', to_jsonb(v_project));
end;
$$;

create or replace function restore_project(p_project_id uuid)
returns jsonb language plpgsql security invoker as $$
declare
  v_project projects;
begin
  update projects set is_archived = false, archived_at = null
    where id = p_project_id and team_id = current_team_id()
    returning * into v_project;
  if v_project.id is null then raise exception 'Project not found'; end if;

  update tasks set archived_at = null
    where project_id = p_project_id and archived_at is not null and team_id = current_team_id();

  return jsonb_build_object('project', to_jsonb(v_project));
end;
$$;

create or replace function delete_department(p_department_id uuid)
returns jsonb language plpgsql security invoker as $$
declare
  v_now timestamptz := now();
  v_department departments;
begin
  select * into v_department from departments where id = p_department_id and team_id = current_team_id();
  if v_department.id is null then raise exception 'Department not found'; end if;

  update departments set deleted_at = v_now where id = p_department_id
    returning * into v_department;

  update stakeholders set department = ''
    where department = v_department.name and deleted_at is null and team_id = current_team_id();

  return jsonb_build_object('department', to_jsonb(v_department));
end;
$$;

create or replace function rename_department(p_department_id uuid, p_new_name text)
returns jsonb language plpgsql security invoker as $$
declare
  v_department departments;
  v_old_name text;
begin
  select * into v_department from departments where id = p_department_id and team_id = current_team_id();
  if v_department.id is null then raise exception 'Department not found'; end if;
  v_old_name := v_department.name;

  update departments set name = p_new_name where id = p_department_id
    returning * into v_department;

  if v_old_name is distinct from p_new_name then
    update stakeholders set department = p_new_name
      where department = v_old_name and deleted_at is null and team_id = current_team_id();
  end if;

  return jsonb_build_object('department', to_jsonb(v_department));
end;
$$;

create or replace function toggle_top_three(p_task_id uuid)
returns jsonb language plpgsql security invoker as $$
declare
  v_task tasks;
  v_next boolean;
  v_other_count int;
begin
  select * into v_task from tasks where id = p_task_id and team_id = current_team_id();
  if v_task.id is null then raise exception 'Task not found'; end if;

  v_next := not v_task.is_today_top_three;

  if v_next then
    select count(*) into v_other_count from tasks
      where project_id = v_task.project_id and is_today_top_three = true and id <> p_task_id
        and team_id = current_team_id();
    if v_other_count >= 3 then
      raise exception 'Only 3 "Top 3" tasks are allowed per project';
    end if;
  end if;

  update tasks set is_today_top_three = v_next where id = p_task_id
    returning * into v_task;

  return jsonb_build_object('task', to_jsonb(v_task));
end;
$$;

-- date-range overlap logic ported 1:1 from archivedProjects/entry.ts:
--   if neither start nor end given -> only is_archived projects
--   else -> keep if NOT(created_date > end) AND NOT(is_archived AND archived_at < start)
create or replace function archived_projects(p_start timestamptz default null, p_end timestamptz default null)
returns jsonb language plpgsql security invoker as $$
declare
  v_result jsonb;
begin
  with filtered as (
    select p.*
    from projects p
    where p.team_id = current_team_id()
      and p.deleted_at is null
      and (
        (p_start is null and p_end is null and p.is_archived)
        or (
          (p_start is not null or p_end is not null)
          and (p_end is null or p.created_date <= p_end)
          and (p_start is null or not (p.is_archived and p.archived_at is not null and p.archived_at < p_start))
        )
      )
  ),
  with_quadrants as (
    select
      f.id, f.title, f.objective, f.due_date, f.parent_product_id, f.parent_area_id,
      f.updated_date, f.is_archived, f.archived_at,
      array[
        count(*) filter (where t.deleted_at is null and coalesce(t.quadrant,4) = 1),
        count(*) filter (where t.deleted_at is null and coalesce(t.quadrant,4) = 2),
        count(*) filter (where t.deleted_at is null and coalesce(t.quadrant,4) = 3),
        count(*) filter (where t.deleted_at is null and coalesce(t.quadrant,4) = 4)
      ] as quadrant_counts
    from filtered f
    left join tasks t on t.project_id = f.id
    group by f.id, f.title, f.objective, f.due_date, f.parent_product_id, f.parent_area_id,
             f.updated_date, f.is_archived, f.archived_at
  )
  select jsonb_build_object('projects', coalesce(jsonb_agg(to_jsonb(w)), '[]'::jsonb))
    into v_result
  from with_quadrants w;

  return v_result;
end;
$$;

-- no service-role needed: this only ever touches the caller's own row,
-- and profiles RLS already permits users to update their own row.
create or replace function deactivate_account()
returns jsonb language plpgsql security invoker as $$
declare
  v_profile profiles;
begin
  update profiles set disabled = true, full_name = 'Deleted User', avatar_url = null
    where id = auth.uid()
    returning * into v_profile;
  return jsonb_build_object('user', to_jsonb(v_profile));
end;
$$;

grant execute on function join_or_create_team(text, text) to authenticated;
grant execute on function regenerate_team_invite_code() to authenticated;
grant execute on function delete_area(uuid) to authenticated;
grant execute on function delete_product(uuid) to authenticated;
grant execute on function delete_project(uuid) to authenticated;
grant execute on function archive_project(uuid) to authenticated;
grant execute on function restore_project(uuid) to authenticated;
grant execute on function delete_department(uuid) to authenticated;
grant execute on function rename_department(uuid, text) to authenticated;
grant execute on function toggle_top_three(uuid) to authenticated;
grant execute on function archived_projects(timestamptz, timestamptz) to authenticated;
grant execute on function deactivate_account() to authenticated;
```

**Before running**: this is a solid draft reflecting all known logic, but
treat it as a first pass — test each RPC against the manual QA checklist in
§10 and fix any plpgsql issues found (e.g. double-check `with` clause syntax
compiles as one statement in `archived_projects`; split into a `plpgsql`
loop with a `return query` / temp variable if the Supabase SQL editor
rejects the multi-CTE-in-one-`select`-into form as written).

## 5. Storage bucket

In Supabase Dashboard → Storage → create a new **public** bucket named
`uploads`. Files are stored under random UUID-based paths (see §7.16's
`uploadFile` helper) so no folder-per-user structure is needed — team-level
access control for attachments isn't enforced at the storage layer in this
first pass (matches base44, which also didn't scope file access by team).

## 6. Edge Function: `ai-chat-stream`

Full port of `aiChatStream/entry.ts`. Directory: `supabase/functions/ai-chat-stream/index.ts`.
Deploy with the Supabase CLI (the one piece of backend logic that needs it —
see §8.2). Secret needed: `ANTHROPIC_API_KEY`.

Preserve exactly: the `ACTION_CATALOG` and `SLASH_COMMAND_GUIDE` prompt text
(verbatim from the original — see the original file, already fully quoted
earlier in this migration's research and unchanged in meaning), the
`buildPrompt` structure, the `DESTRUCTIVE_ACTIONS` set and confirm-first flow,
and every `executeAction` case — just swap the datastore calls from
`base44.entities.X.create/update/filter/get` to Supabase equivalents scoped
by the caller's team, and swap the LLM call from
`base44.integrations.Core.InvokeLLM` to a direct Anthropic Messages API call.

Key structural pieces:

```ts
// supabase/functions/ai-chat-stream/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

// ACTION_CATALOG, SLASH_COMMAND_GUIDE, DESTRUCTIVE_ACTIONS, buildPrompt():
// copy verbatim from base44/functions/aiChatStream/entry.ts — no changes
// needed to the prompt text itself, only to executeAction()'s datastore calls.

async function executeAction(supabase, action, args) {
  switch (action) {
    case 'CREATE_AREA': {
      const { data, error } = await supabase.from('areas')
        .insert({ title: args.title, description: args.description })
        .select().single();
      if (error) throw error;
      return { toolResult: { area: data } };
    }
    case 'UPDATE_AREA': {
      const { data, error } = await supabase.from('areas')
        .update({ title: args.title, description: args.description })
        .eq('id', args.area_id).select().single();
      if (error) throw error;
      return { toolResult: { area: data } };
    }
    case 'DELETE_AREA': {
      const { data, error } = await supabase.rpc('delete_area', { p_area_id: args.area_id });
      if (error) throw error;
      return { toolResult: { area: data.area } };
    }
    // ...every other action ports the same way: plain table calls for
    // CREATE_*/UPDATE_*/single-entity mutations, supabase.rpc(...) for
    // anything that used to be a nested cascade (DELETE_AREA, DELETE_PRODUCT,
    // DELETE_PROJECT, ARCHIVE_PROJECT, RESTORE_PROJECT, DELETE_DEPARTMENT,
    // RENAME_DEPARTMENT — reuse the exact same RPCs from §4), and
    // straightforward .update()/.select() pairs for the toggle/status/note/
    // task/stakeholder cases (TOGGLE_WEEKLY_FOCUS, UPDATE_TASK_STATUS,
    // TOGGLE_TOP_THREE via the toggle_top_three RPC, ARCHIVE_DONE_TASKS as a
    // bulk .update().in('id', ids), SET_CUSTOM_FIELD as a straight jsonb merge
    // update). See the original entry.ts for the exact per-action arg shapes
    // — they don't change, only the persistence calls underneath do.
    default:
      throw new Error(`Unknown action "${action}"`);
  }
}

async function callAnthropic(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5', // confirm current recommended model id at implementation time
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
      tools: [{
        name: 'respond',
        description: 'Return the routing decision as structured data.',
        input_schema: {
          type: 'object',
          properties: {
            action: { type: 'string' },
            args_json: { type: 'string' },
            message: { type: 'string' },
          },
          required: ['action', 'message'],
        },
      }],
      tool_choice: { type: 'tool', name: 'respond' },
    }),
  });
  const json = await res.json();
  const toolUse = json.content?.find((c) => c.type === 'tool_use');
  if (!toolUse) throw new Error('Model did not return a structured response');
  return toolUse.input; // { action, args_json, message }
}

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { confirmedAction } = body;

    if (confirmedAction) {
      const { action, args } = confirmedAction;
      const result = await executeAction(supabase, action, args);
      return Response.json({ reply: confirmedAction.confirmMessage || 'Done.', toolResult: result.toolResult, action });
    }

    const { message, conversationHistory, activeProjectId } = body;
    if (!message) return Response.json({ error: 'message is required' }, { status: 400 });

    // fetch areas/products/projects/tasks/stakeholders/notes/departments the
    // same way the original did (base44.entities.X.list()), just via
    // supabase.from('x').select('*') — RLS already scopes to the caller's team.
    const [{data: areas}, {data: products}, {data: allProjects}, {data: allTasksRaw},
           {data: stakeholders}, {data: notes}, {data: departments}] = await Promise.all([
      supabase.from('areas').select('*'),
      supabase.from('products').select('*'),
      supabase.from('projects').select('*'),
      supabase.from('tasks').select('*'),
      supabase.from('stakeholders').select('*'),
      supabase.from('project_notes').select('*'),
      supabase.from('departments').select('*'),
    ]);

    // same filtering/prompt-building as original, then:
    const decision = await callAnthropic(prompt);
    const { action, args_json, message: reply } = decision;
    let args = {};
    try { args = args_json ? JSON.parse(args_json) : {}; } catch { args = {}; }

    if (!action || action === 'CHAT_ONLY' || action === 'UNKNOWN') {
      return Response.json({ reply: reply || "I couldn't map that to an action — could you rephrase?" });
    }
    if (action === 'UNDO_LAST_ACTION') {
      return Response.json({ reply, action: 'UNDO_LAST_ACTION' });
    }
    if (DESTRUCTIVE_ACTIONS.has(action)) {
      return Response.json({ reply, pending_action: { action, args, confirmMessage: reply } });
    }
    const result = await executeAction(supabase, action, args);
    return Response.json({ reply, toolResult: result.toolResult, action });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
```

Because RLS already scopes every table to `current_team_id()`, the Edge
Function doesn't need to do any team-scoping itself — just forward the
caller's Authorization header into the Supabase client and let RLS do the
work, exactly mirroring how base44's function relied on
`createClientFromRequest(req)` + entity RLS.

## 7. Frontend changes — file by file, with exact current source and target replacement

### 7.0 Required routing fix (found during research, not base44-specific but blocks the migration)

`src/App.jsx`'s `<Routes>` currently only defines `/chat`, `/settings`, `/`,
and `*` — **`/login`, `/register`, `/forgot-password`, `/reset-password` are
never registered**, even though all 4 page components are fully built. In
the base44 version, `navigateToLogin()` called `base44.auth.redirectToLogin()`
which apparently redirected out to base44's own hosted login UI (consistent
with `app-params.js` picking up an `access_token` URL param on return) —
that hosted UI no longer exists once base44 is gone, so **this needs fixing
as part of the migration**, using the app's own already-built pages.

Current `src/App.jsx` (77 lines, full source already read):
```jsx
import { ThemeProvider } from "next-themes"
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import { HighlightProvider } from '@/lib/HighlightContext';
import { FilterProvider } from '@/lib/FilterContext';
import AppShell from '@/components/layout/AppShell';
import Dashboard from '@/pages/Dashboard';
import ChatPage from '@/pages/ChatPage';
import SettingsPage from '@/pages/SettingsPage';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  if (isLoadingPublicSettings || isLoadingAuth) { /* spinner */ }
  if (authError) {
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
    else if (authError.type === 'auth_required') { navigateToLogin(); return null; }
  }
  return (
    <Routes>
      <Route path="/chat" element={<ChatPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/" element={<AppShell><Dashboard /></AppShell>} />
      <Route path="*" element={<AppShell><PageNotFound /></AppShell>} />
    </Routes>
  );
};
// ... App() wraps ThemeProvider > AuthProvider > QueryClientProvider > HighlightProvider > FilterProvider > Router(ScrollToTop, AuthenticatedApp) + Toaster
```

**New `src/App.jsx`** — add the 4 auth routes as public, gate everything
else on `isAuthenticated`, drop `UserNotRegisteredError`/`isLoadingPublicSettings`:
```jsx
import { ThemeProvider } from "next-themes"
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import { HighlightProvider } from '@/lib/HighlightContext';
import { FilterProvider } from '@/lib/FilterContext';
import AppShell from '@/components/layout/AppShell';
import Dashboard from '@/pages/Dashboard';
import ChatPage from '@/pages/ChatPage';
import SettingsPage from '@/pages/SettingsPage';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/reset-password'];

const AuthenticatedApp = () => {
  const { isLoadingAuth, isAuthenticated } = useAuth();
  const location = useLocation();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-border border-t-foreground rounded-full animate-spin"></div>
      </div>
    );
  }

  const isPublicPath = PUBLIC_PATHS.includes(location.pathname);
  if (!isAuthenticated && !isPublicPath) return <Navigate to="/login" replace />;
  if (isAuthenticated && isPublicPath) return <Navigate to="/" replace />;

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/chat" element={<ChatPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/" element={<AppShell><Dashboard /></AppShell>} />
      <Route path="*" element={<AppShell><PageNotFound /></AppShell>} />
    </Routes>
  );
};

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <HighlightProvider>
            <FilterProvider>
              <Router>
                <ScrollToTop />
                <AuthenticatedApp />
              </Router>
              <Toaster />
            </FilterProvider>
          </HighlightProvider>
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
```

### 7.1 `src/lib/AuthContext.jsx`

New version (drops base44 public-settings/user-not-registered plumbing entirely):
```jsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    checkUserAuth();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsAuthenticated(!!session?.user);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const checkUserAuth = async () => {
    setIsLoadingAuth(true);
    const { data: { session } } = await supabase.auth.getSession();
    setUser(session?.user ?? null);
    setIsAuthenticated(!!session?.user);
    setIsLoadingAuth(false);
    setAuthChecked(true);
  };

  const logout = async () => {
    setUser(null);
    setIsAuthenticated(false);
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated, isLoadingAuth, authChecked,
      logout, navigateToLogin, checkUserAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
```
Note: `isLoadingPublicSettings` and `authError` are gone from the context —
confirm nothing besides `App.jsx` (already updated in §7.0) reads them
before removing (grep `isLoadingPublicSettings|authError` across `src/`).

### 7.2 `src/pages/Login.jsx`

Only these two lines change (everything else — JSX, layout, error copy — stays identical):
```diff
- import { base44 } from "@/api/base44Client";
+ import { supabase } from "@/api/supabaseClient";
  ...
  const handleSubmit = async (e) => {
    ...
    try {
-     await base44.auth.loginViaEmailPassword(email, password);
+     const { error } = await supabase.auth.signInWithPassword({ email, password });
+     if (error) throw error;
      window.location.href = "/";
    } catch (err) { ... }
  };

  const handleGoogle = () => {
-   base44.auth.loginWithProvider("google", "/");
+   supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
  };
```

### 7.3 `src/pages/Register.jsx`

Adds the one approved new field (team invite code) and swaps auth calls:
```diff
- import { base44 } from "@/api/base44Client";
+ import { supabase } from "@/api/supabaseClient";
  ...
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
+ const [inviteCode, setInviteCode] = useState("");
  ...
  const handleSubmit = async (e) => {
    ...
    try {
-     await base44.auth.register({ email, password });
+     const { error } = await supabase.auth.signUp({ email, password });
+     if (error) throw error;
      setShowOtp(true);
    } catch (err) { ... }
  };

  const handleVerify = async () => {
    ...
    try {
-     const result = await base44.auth.verifyOtp({ email, otpCode });
-     if (result?.access_token) base44.auth.setToken(result.access_token);
+     const { error } = await supabase.auth.verifyOtp({ email, token: otpCode, type: "signup" });
+     if (error) throw error;
+     const { error: teamError } = await supabase.rpc("join_or_create_team", {
+       p_invite_code: inviteCode.trim() || null,
+     });
+     if (teamError) throw teamError;
      window.location.href = "/";
    } catch (err) { ... }
  };

  const handleResend = async () => {
    try {
-     await base44.auth.resendOtp(email);
+     const { error } = await supabase.auth.resend({ type: "signup", email });
+     if (error) throw error;
      toast({ title: "Code sent", description: "Check your email for the new code." });
    } catch (err) { ... }
  };

  const handleGoogle = () => {
-   base44.auth.loginWithProvider("google", "/");
+   supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
  };
```
Add the new field to the form JSX, right after the password/confirm fields
(smallest possible new UI, per §1a):
```jsx
<div className="space-y-2">
  <Label htmlFor="inviteCode">Team invite code (optional)</Label>
  <Input
    id="inviteCode"
    placeholder="Leave blank to create a new team"
    value={inviteCode}
    onChange={(e) => setInviteCode(e.target.value)}
    className="h-12"
  />
</div>
```
If `join_or_create_team` throws (e.g. invalid code), surface it the same way
as any other registration error (`setError(err.message || ...)`) — the user
still has a verified auth account at that point, so consider whether to let
them retry just the team-join step rather than the whole signup; simplest
first-pass behavior: show the error, they can re-submit the OTP verify
button again to retry `join_or_create_team` (email/password already
verified so `verifyOtp` would just no-op/error harmlessly — verify this
during implementation and adjust to a dedicated "retry joining team" path if
`verifyOtp` can't be safely re-called).

### 7.4 `src/pages/ForgotPassword.jsx`

One line changes, same "always show success" behavior preserved:
```diff
- import { base44 } from "@/api/base44Client";
+ import { supabase } from "@/api/supabaseClient";
  ...
  try {
-   await base44.auth.resetPasswordRequest(email);
+   await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
  } catch {
    // Always show success regardless
  } finally { ... }
```

### 7.5 `src/pages/ResetPassword.jsx`

This one needs a real behavioral adaptation (not just a call swap) because
Supabase's recovery model differs from base44's: instead of a `resetToken`
manually read from the URL and passed alongside the new password, Supabase's
recovery email link signs the browser into a temporary recovery **session**
(via a URL hash/PKCE code that the Supabase client consumes automatically on
load), and you then just call `supabase.auth.updateUser({password})` while
that session is active. **User-visible steps stay identical**: click email
link → land on this page → enter new password → submit → redirect to
`/login`.
```diff
- import { base44 } from "@/api/base44Client";
- import { useSearchParams } from "react-router-dom";
+ import { supabase } from "@/api/supabaseClient";
+ import { useEffect, useState } from "react";

  export default function ResetPassword() {
-   const [searchParams] = useSearchParams();
-   const resetToken = searchParams.get("token");
+   const [hasRecoverySession, setHasRecoverySession] = useState(null); // null = checking

+   useEffect(() => {
+     // Supabase's recovery link redirects back here already signed into a
+     // temporary recovery session — just confirm one exists.
+     supabase.auth.getSession().then(({ data: { session } }) => {
+       setHasRecoverySession(!!session);
+     });
+   }, []);
    ...
    const handleSubmit = async (e) => {
      ...
      try {
-       await base44.auth.resetPassword({ resetToken, newPassword });
+       const { error } = await supabase.auth.updateUser({ password: newPassword });
+       if (error) throw error;
        window.location.href = "/login";
      } catch (err) { ... }
    };

-   if (!resetToken) {
+   if (hasRecoverySession === false) {
      return ( /* same "Invalid reset link" UI as before */ );
    }
+   if (hasRecoverySession === null) {
+     return null; // or a small spinner — brief check on mount
+   }
    return ( /* same "New password" form as before */ );
  }
```

### 7.6 `src/api/base44Client.js` → `src/api/supabaseClient.js`

Delete `base44Client.js`. New file:
```js
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

### 7.7 `src/hooks/useAreas.js` (current source already fully captured in §2.3 research — reproduced exactly, 42 lines)

```js
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/supabaseClient";
import { excludeSoftDeleted } from "@/lib/entityUtils";

export function useAreas() {
  return useQuery({
    queryKey: ["areas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("areas").select("*");
      if (error) throw error;
      return excludeSoftDeleted(data);
    },
  });
}

export function useUpdateArea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => {
      const { data: updated, error } = await supabase.from("areas").update(data).eq("id", id).select().single();
      if (error) throw error;
      return updated;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["areas"] }),
  });
}

export function useCreateArea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const { data: created, error } = await supabase.from("areas").insert(data).select().single();
      if (error) throw error;
      return created;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["areas"] }),
  });
}

export function useDeleteArea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { data, error } = await supabase.rpc("delete_area", { p_area_id: id });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["areas"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["allTasks"] });
    },
  });
}
```

### 7.8 `src/hooks/useDepartments.js`

```js
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/supabaseClient";
import { excludeSoftDeleted } from "@/lib/entityUtils";

export function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("departments").select("*");
      if (error) throw error;
      return excludeSoftDeleted(data).sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const { data: created, error } = await supabase.from("departments").insert(data).select().single();
      if (error) throw error;
      return created;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["departments"] }),
  });
}

export function useRenameDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }) => {
      const { data, error } = await supabase.rpc("rename_department", { p_department_id: id, p_new_name: name });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      queryClient.invalidateQueries({ queryKey: ["stakeholders"] });
    },
  });
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { data, error } = await supabase.rpc("delete_department", { p_department_id: id });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      queryClient.invalidateQueries({ queryKey: ["stakeholders"] });
    },
  });
}
```

### 7.9 `src/hooks/useProducts.js`

```js
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/supabaseClient";
import { excludeSoftDeleted } from "@/lib/entityUtils";

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*");
      if (error) throw error;
      return excludeSoftDeleted(data);
    },
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const { data: created, error } = await supabase.from("products").insert(data).select().single();
      if (error) throw error;
      return created;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => {
      const { data: updated, error } = await supabase.from("products").update(data).eq("id", id).select().single();
      if (error) throw error;
      return updated;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { data, error } = await supabase.rpc("delete_product", { p_product_id: id });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["allTasks"] });
    },
  });
}
```

### 7.10 `src/hooks/useProjects.js`

```js
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/supabaseClient";
import { excludeSoftDeleted } from "@/lib/entityUtils";

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*");
      if (error) throw error;
      return excludeSoftDeleted(data).filter((p) => !p.is_archived);
    },
  });
}

export function useProject(id) {
  return useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useArchivedProjects(start, end) {
  return useQuery({
    queryKey: ["archivedProjects", start, end],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("archived_projects", { p_start: start, p_end: end });
      if (error) throw error;
      return data; // { projects: [...] }
    },
  });
}

export function useMoveProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, parent_product_id }) => {
      const { data, error } = await supabase.from("projects").update({ parent_product_id }).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => {
      const { data: updated, error } = await supabase.from("projects").update(data).eq("id", id).select().single();
      if (error) throw error;
      return updated;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const { data: created, error } = await supabase.from("projects").insert(data).select().single();
      if (error) throw error;
      return created;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });
}

function invalidateProjectRelated(queryClient) {
  queryClient.invalidateQueries({ queryKey: ["projects"] });
  queryClient.invalidateQueries({ queryKey: ["archivedProjects"] });
  queryClient.invalidateQueries({ queryKey: ["allTasks"] });
}

export function useArchiveProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { data, error } = await supabase.rpc("archive_project", { p_project_id: id });
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidateProjectRelated(queryClient),
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { data, error } = await supabase.rpc("delete_project", { p_project_id: id });
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidateProjectRelated(queryClient),
  });
}

export function useRestoreProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { data, error } = await supabase.rpc("restore_project", { p_project_id: id });
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidateProjectRelated(queryClient),
  });
}
```

### 7.11 `src/hooks/useProjectNotes.js`

```js
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/supabaseClient";

export function useProjectNotes(projectId) {
  return useQuery({
    queryKey: ["projectNotes", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_notes").select("*").eq("project_id", projectId);
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });
}

export function useAllProjectNotes() {
  return useQuery({
    queryKey: ["allProjectNotes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_notes").select("*");
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateProjectNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const { data: created, error } = await supabase.from("project_notes").insert(data).select().single();
      if (error) throw error;
      return created;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["projectNotes", variables.project_id] });
      queryClient.invalidateQueries({ queryKey: ["allProjectNotes"] });
    },
  });
}

export function useUpdateProjectNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => {
      const { data: updated, error } = await supabase.from("project_notes").update(data).eq("id", id).select().single();
      if (error) throw error;
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projectNotes"] });
      queryClient.invalidateQueries({ queryKey: ["allProjectNotes"] });
    },
  });
}

export function useDeleteProjectNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("project_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projectNotes"] });
      queryClient.invalidateQueries({ queryKey: ["allProjectNotes"] });
    },
  });
}
```

### 7.12 `src/hooks/useStakeholders.js`

```js
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/supabaseClient";
import { excludeSoftDeleted } from "@/lib/entityUtils";

export function useStakeholders() {
  return useQuery({
    queryKey: ["stakeholders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stakeholders").select("*");
      if (error) throw error;
      return excludeSoftDeleted(data);
    },
  });
}

export function useCreateStakeholder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const { data: created, error } = await supabase.from("stakeholders").insert(data).select().single();
      if (error) throw error;
      return created;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stakeholders"] }),
  });
}

export function useUpdateStakeholder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => {
      const { data: updated, error } = await supabase.from("stakeholders").update(data).eq("id", id).select().single();
      if (error) throw error;
      return updated;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stakeholders"] }),
  });
}

export function useDeleteStakeholder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { data, error } = await supabase.from("stakeholders")
        .update({ deleted_at: new Date().toISOString() }).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stakeholders"] }),
  });
}
```

### 7.13 `src/hooks/useTasks.js`

```js
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/supabaseClient";
import { filterActiveTasks, isTaskArchived, isTaskDeleted } from "@/lib/taskUtils";

export function useTasks(projectId) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["tasks", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").eq("project_id", projectId);
      if (error) throw error;
      return filterActiveTasks(data);
    },
    enabled: !!projectId,
  });

  useEffect(() => {
    if (!projectId) return;
    const channel = supabase
      .channel(`tasks-${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `project_id=eq.${projectId}` },
        () => queryClient.invalidateQueries({ queryKey: ["tasks", projectId] })
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [projectId, queryClient]);

  return query;
}

export function useArchivedTasks(projectId) {
  return useQuery({
    queryKey: ["archivedTasks", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").eq("project_id", projectId);
      if (error) throw error;
      return data.filter((t) => isTaskArchived(t) && !isTaskDeleted(t));
    },
    enabled: !!projectId,
  });
}

export function useAllTasks() {
  return useQuery({
    queryKey: ["allTasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*");
      if (error) throw error;
      return filterActiveTasks(data);
    },
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const { data: created, error } = await supabase.from("tasks").insert(data).select().single();
      if (error) throw error;
      return created;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      if (variables?.project_id) {
        queryClient.invalidateQueries({ queryKey: ["tasks", variables.project_id] });
      }
      queryClient.invalidateQueries({ queryKey: ["allTasks"] });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => {
      const { data: updated, error } = await supabase.from("tasks").update(data).eq("id", id).select().single();
      if (error) throw error;
      return updated;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["archivedTasks"] });
      if (variables?.data?.project_id) {
        queryClient.invalidateQueries({ queryKey: ["tasks", variables.data.project_id] });
      }
      queryClient.invalidateQueries({ queryKey: ["allTasks"] });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { data, error } = await supabase.from("tasks")
        .update({ deleted_at: new Date().toISOString() }).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["allTasks"] });
    },
  });
}

export function useToggleTopThree() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }) => {
      const { data, error } = await supabase.rpc("toggle_top_three", { p_task_id: id });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["allTasks"] });
    },
  });
}
```
Remember to enable Realtime replication on `tasks` (already in the §4 SQL:
`alter publication supabase_realtime add table tasks;`) — without it the
channel subscription silently receives nothing.

### 7.14 `src/hooks/useChatSessions.js`

```js
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/supabaseClient";

export function useChatSessions() {
  return useQuery({
    queryKey: ["chatSessions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("chat_sessions").select("*");
      if (error) throw error;
      return [...data].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    },
  });
}

export function useCreateChatSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const { data: created, error } = await supabase.from("chat_sessions").insert(data).select().single();
      if (error) throw error;
      return created;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chatSessions"] }),
  });
}

export function useUpdateChatSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => {
      const { data: updated, error } = await supabase.from("chat_sessions").update(data).eq("id", id).select().single();
      if (error) throw error;
      return updated;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chatSessions"] }),
  });
}

export function useDeleteChatSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      // chat_messages has `on delete cascade` on session_id (see §4 schema),
      // so deleting the session alone is sufficient — no need to fetch and
      // delete each message first like the original base44 version did.
      const { error } = await supabase.from("chat_sessions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["chatSessions"] });
      queryClient.invalidateQueries({ queryKey: ["chatMessages", id] });
    },
  });
}
```

### 7.15 `src/hooks/useChatMessages.js`

```js
import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/supabaseClient";

const PAGE_SIZE = 20;

export function useChatMessages(sessionId) {
  const [olderMessages, setOlderMessages] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    setOlderMessages([]);
    setHasMore(true);
  }, [sessionId]);

  const recentQuery = useQuery({
    queryKey: ["chatMessages", sessionId, "recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_date", { ascending: false })
        .limit(PAGE_SIZE);
      if (error) throw error;
      return [...data].reverse();
    },
    enabled: !!sessionId,
  });

  const recentMessages = recentQuery.data || [];

  const loadMore = useCallback(async () => {
    if (!sessionId || isLoadingMore || !hasMore) return;
    const oldestLoaded = olderMessages[0] || recentMessages[0];
    if (!oldestLoaded) return;
    setIsLoadingMore(true);
    try {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("session_id", sessionId)
        .lt("created_date", oldestLoaded.created_date)
        .order("created_date", { ascending: false })
        .limit(PAGE_SIZE);
      if (error) throw error;
      if (data.length < PAGE_SIZE) setHasMore(false);
      setOlderMessages((prev) => [...[...data].reverse(), ...prev]);
    } finally {
      setIsLoadingMore(false);
    }
  }, [sessionId, isLoadingMore, hasMore, olderMessages, recentMessages]);

  return {
    ...recentQuery,
    messages: [...olderMessages, ...recentMessages],
    hasMore,
    isLoadingMore,
    loadMore,
  };
}

export function useCreateChatMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const { data: created, error } = await supabase.from("chat_messages").insert(data).select().single();
      if (error) throw error;
      return created;
    },
    onSuccess: (created, variables) => {
      queryClient.setQueryData(["chatMessages", variables.session_id, "recent"], (prev = []) => [...prev, created]);
    },
  });
}

export function useUpdateChatMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => {
      const { data: updated, error } = await supabase.from("chat_messages").update(data).eq("id", id).select().single();
      if (error) throw error;
      return updated;
    },
    onSuccess: (_, variables) => {
      if (variables?.data?.session_id) {
        queryClient.invalidateQueries({ queryKey: ["chatMessages", variables.data.session_id] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["chatMessages"] });
      }
    },
  });
}
```

### 7.16 File upload — new shared helper + `useFileUpload.js` + 3 inline call sites

New `src/lib/uploadFile.js`:
```js
import { supabase } from "@/api/supabaseClient";

const BUCKET = "uploads";

export async function uploadFile(file) {
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
  const path = `${crypto.randomUUID()}${ext ? `.${ext}` : ""}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
```

`src/hooks/useFileUpload.js`:
```js
import { useState } from "react";
import { uploadFile } from "@/lib/uploadFile";

export function useFileUpload() {
  const [isUploading, setIsUploading] = useState(false);

  const upload = async (file) => {
    setIsUploading(true);
    try {
      return await uploadFile(file);
    } finally {
      setIsUploading(false);
    }
  };

  return { isUploading, upload };
}
```

`src/hooks/useChatController.js` — only `handleFileChange` and `invokeAssistant` change (rest of the 247-line file, already fully captured, is untouched):
```diff
- import { base44 } from "@/api/base44Client";
+ import { supabase } from "@/api/supabaseClient";
+ import { uploadFile } from "@/lib/uploadFile";
  ...
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingAttachment(true);
    try {
-     const { file_url } = await base44.integrations.Core.UploadFile({ file });
+     const file_url = await uploadFile(file);
      setAttachedFile({ name: file.name, url: file_url });
    } finally {
      setIsUploadingAttachment(false);
      e.target.value = "";
    }
  };

  const invokeAssistant = async (payload) => {
-   const res = await base44.functions.invoke("aiChatStream", payload);
-   if (res.data?.error) throw new Error(res.data.error);
-   return res.data;
+   const { data, error } = await supabase.functions.invoke("ai-chat-stream", { body: payload });
+   if (error) throw new Error(error.message || "Assistant request failed");
+   if (data?.error) throw new Error(data.error);
+   return data;
  };
```
**Verify during implementation**: `supabase.functions.invoke`'s exact error
shape when the Edge Function itself returns a non-2xx status (e.g. the 401
Unauthorized or 400 "message is required" cases) — recent `supabase-js`
versions populate `error` as a `FunctionsHttpError` and may also expose the
parsed body via `error.context`; make sure whatever error message ends up
surfaced to the user in the chat ("⚠️ Error: ...") is still meaningful,
adjusting the `if (error)` branch above to pull from `error.context` if
`error.message` alone isn't descriptive enough.

`src/components/sidebar/AddStakeholderModal.jsx` — one call site:
```diff
- import { base44 } from "@/api/base44Client";
+ import { uploadFile } from "@/lib/uploadFile";
  ...
    let avatar_url;
    if (file) {
-     const { file_url } = await base44.integrations.Core.UploadFile({ file });
-     avatar_url = file_url;
+     avatar_url = await uploadFile(file);
    }
```

`src/components/sidebar/StakeholderList.jsx` — one call site inside `StakeholderRow`'s `handleAvatarChange` (not fully re-read verbatim, but the exact 2-line pattern is confirmed identical to every other call site above):
```diff
- const { file_url } = await base44.integrations.Core.UploadFile({ file });
- updateStakeholder.mutate({ id: stakeholder.id, data: { avatar_url: file_url } });
+ const file_url = await uploadFile(file);
+ updateStakeholder.mutate({ id: stakeholder.id, data: { avatar_url: file_url } });
```
(swap the `base44` import for `import { uploadFile } from "@/lib/uploadFile";` at the top of that file too — check whether `base44` is imported for anything else in that large file before removing the import line entirely; per the research pass it was only used for this one upload call.)

### 7.17 `src/components/ui/image.jsx`

Drop the base44/Wix-specific transform logic — 244 lines total, current
source already fully captured above in this conversation. Replace the whole
file with a much simpler version that just renders the stored URL directly
(no responsive srcset/format-conversion for uploaded images going forward —
a minor loss of an optimization, not a visual regression; images still
display correctly at their native resolution):
```jsx
import * as React from "react"

const FALLBACK_IMAGE_URL = "" // pick a real fallback asset path if the app has one; base44's Wix-hosted fallback image is gone

const Image = React.forwardRef(
  ({ src, fittingType = "fill", originWidth, originHeight, ...props }, ref) => {
    const [imgSrc, setImgSrc] = React.useState(src)

    React.useEffect(() => {
      setImgSrc(src)
    }, [src])

    if (!src) {
      return <img ref={ref} src={FALLBACK_IMAGE_URL} alt="" data-empty-image {...props} />
    }

    return (
      <img
        ref={ref}
        src={imgSrc}
        onError={() => setImgSrc(FALLBACK_IMAGE_URL)}
        style={{ objectFit: fittingType === "fit" ? "contain" : "cover", width: "100%", height: "100%" }}
        {...props}
      />
    )
  }
)
Image.displayName = "Image"

export { Image }
```
**Before finalizing**: grep every usage of `<Image .../>` in `src/components`
to confirm which props are actually relied upon (`aspectRatio`,
`focalPointX/Y`, `quality`, the blur-up placeholder) — if the visual
blur-up-on-load effect is something the user would notice/miss, either keep
a simplified version of `ResponsiveImage`'s loaded-state fade without the
Wix-specific URL building, or explicitly confirm with the user that losing
it is acceptable ("no visual difference" is the standing bar — treat this
file as the one place a literal pixel-level behavior might slip if not
checked carefully).

### 7.18 `src/components/settings/DeleteAccountDialog.jsx`

```diff
- import { base44 } from "@/api/base44Client";
+ import { supabase } from "@/api/supabaseClient";
  ...
  const handleDelete = async () => {
    if (!canDelete) return;
    setIsDeleting(true);
    try {
-     const res = await base44.functions.invoke("deactivateAccount", {});
-     if (res.data?.error) throw new Error(res.data.error);
+     const { data, error } = await supabase.rpc("deactivate_account");
+     if (error) throw error;
      logout();
    } catch (error) { ... }
  };
```
Also reword the base44-branded copy in the JSX:
```diff
- <p>This doesn't remove your login from Base44 entirely — contact Base44 support for that.</p>
+ <p>This doesn't remove your login credentials entirely — contact support if you need that done.</p>
```
(Keep the exact same best-effort-disable *behavior* — this is a copy-only
wording fix, not a functional change; whether to actually offer full account
deletion now that our own Supabase backend *can* do it via
`supabase.auth.admin.deleteUser()` is a real capability upgrade beyond
today's behavior — do not implement that without asking the user first,
since it changes what "delete account" actually does.)

### 7.19–7.20 Already covered inline in §7.16 (AddStakeholderModal, StakeholderList).

## 8. Cleanup checklist

- [ ] Delete `base44/` directory entirely.
- [ ] Delete `src/lib/app-params.js`.
- [ ] Delete `src/components/UserNotRegisteredError.jsx` (dead once base44's allowlist concept is gone — already dropped from `AuthContext`/`App.jsx` in §7.0/7.1).
- [ ] Delete `src/api/base44Client.js` (replaced by `src/api/supabaseClient.js`, §7.6).
- [ ] `vite.config.js` — remove the `@base44/vite-plugin` import/usage, keep only `@vitejs/plugin-react`:
  ```js
  import react from '@vitejs/plugin-react'
  import { defineConfig } from 'vite'

  export default defineConfig({
    plugins: [react()],
  });
  ```
- [ ] `package.json` — remove `@base44/sdk`, `@base44/vite-plugin`; add `@supabase/supabase-js`; rename `"name": "base44-app"` → `"name": "portfolio-tracker"`.
- [ ] `index.html` — remove base44 branding:
  ```diff
  - <link rel="icon" type="image/svg+xml" href="https://base44.com/logo_v2.svg" />
  + <!-- pick a real favicon asset, or drop the tag for the browser default -->
    ...
  - <title>Base44 APP</title>
  + <title>Portfolio Tracker</title>
  ```
- [ ] `AGENTS.md` — currently entirely base44-CLI-oriented (full current content already captured above). Rewrite to describe the new stack, e.g.:
  ```markdown
  # AGENTS.md

  ## Project Context
  Self-owned app: React/Vite frontend, Supabase (Postgres/Auth/Storage/Edge
  Functions) backend. See `plan.md` for the full migration history/architecture
  if anything is unclear, and `README.md` for day-to-day setup.

  ## Key Files
  - `src/api/supabaseClient.js`: frontend Supabase client.
  - `supabase/functions/ai-chat-stream/`: the one Edge Function (AI chat assistant).
  - `.env.local`: local-only environment values (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`); never commit secrets.

  ## Working Notes
  - `npm run dev` runs the frontend against the hosted Supabase project directly — there's no local backend process to start.
  - Run the relevant checks from `package.json` before finishing code changes.
  ```
  `CLAUDE.md` just points to `AGENTS.md` — leave as-is.
- [ ] `README.md` — rewrite the "Backend" bullet in Architecture, the "Backend functions" section, and the entire "Getting Started"/"Publishing" sections (base44 CLI instructions) to describe the Supabase setup instead. Scrub the `Base44 CLI`/`base44 dashboard open`/docs-link sections entirely.
- [ ] Scrub `Prod_Spec.md` / `Prod_Status.md` for base44 mentions if present (not yet read in full — check before finishing).
- [ ] Final check: `grep -ri base44` across the whole repo (excluding `.git`, `node_modules`, and this `plan.md` itself, which necessarily documents the migration) should return nothing.

## 9. Prerequisites the user must complete themselves (external accounts — cannot be done on their behalf)

### 9.1 Supabase project
1. Go to supabase.com → sign up/log in → "New project". Pick a name, a strong DB password (save it), and a region.
2. Once provisioned: Project Settings → API → copy the **Project URL** and the **anon public key**. These go into `.env.local`:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
3. SQL Editor → New query → paste the entire script from §4 → Run.
4. Storage → New bucket → name it `uploads`, mark it **Public**.
5. Authentication → Email Templates → edit the "Confirm signup" and "Reset password" templates to include `{{ .Token }}` (the 6-digit OTP code) so the OTP-code flow in Register/ResetPassword works as designed — check Supabase's current docs for the exact template variable name at implementation time, this has shifted between versions.
6. Authentication → Providers → confirm Email provider is enabled (it is by default).

### 9.2 Supabase CLI (only needed for the one Edge Function)
```bash
npm install -g supabase
supabase login
supabase link --project-ref <your-project-ref>   # found in the project's dashboard URL
supabase functions deploy ai-chat-stream
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

### 9.3 Anthropic API key
Go to console.anthropic.com → API Keys → create a new key. Use it in the
`supabase secrets set` command above — never put it in frontend code or
`VITE_`-prefixed env vars (those ship to the browser).

### 9.4 Google OAuth (optional — only if the existing "Continue with Google" button should actually work)
1. Google Cloud Console → create/select a project → APIs & Services → Credentials → Create OAuth client ID (type: Web application).
2. Add `https://<your-project-ref>.supabase.co/auth/v1/callback` as an authorized redirect URI.
3. Supabase Dashboard → Authentication → Providers → Google → paste the client ID/secret, enable.
Everything else in the app works fully without this step — it only gates the Google button specifically, so it's safe to defer.

## 10. Implementation order

1. [ ] Run §4's SQL in the Supabase SQL editor; set up Storage bucket + email templates (§9.1).
2. [ ] `src/api/supabaseClient.js` (§7.6), delete `base44Client.js`.
3. [ ] `AuthContext.jsx` (§7.1) + the 4 auth pages (§7.2–7.5) + `App.jsx` routing fix (§7.0).
4. [ ] All 7 entity hooks (§7.7–7.13) + 3 chat hooks (§7.14, 7.15, and useChatController's two changed spots in §7.16).
5. [ ] File upload: `src/lib/uploadFile.js`, `useFileUpload.js`, the 3 inline call sites (§7.16).
6. [ ] `ai-chat-stream` Edge Function (§6) — write, then deploy per §9.2 once an Anthropic key is available.
7. [ ] `components/ui/image.jsx` simplification (§7.17) — check prop usage across callers first.
8. [ ] `DeleteAccountDialog.jsx` (§7.18).
9. [ ] Cleanup pass (§8): delete `base44/`, `app-params.js`, `UserNotRegisteredError.jsx`; strip deps/plugin from `package.json`/`vite.config.js`; branding in `index.html`; docs rewrite (`README.md`, `AGENTS.md`).
10. [ ] Verification (§11).

## 11. Verification

- [ ] `grep -ri base44` across the repo returns nothing (outside this plan.md).
- [ ] `npm run lint`, `npm run typecheck`, `npm test` all pass.
- [ ] `npm run build` succeeds.
- [ ] `npm run dev`, manually walk through, against the real Supabase project:
  - [ ] Register a brand-new user with no invite code (creates a team) → verify email OTP → lands on `/`.
  - [ ] Log out, log back in with email/password.
  - [ ] Forgot password → reset via emailed link → log in with new password.
  - [ ] Settings → find/copy the team invite code; register a second user using that code → confirm they see the *same* Areas/Products/Projects/Tasks/Stakeholders as the first user (this is the core correctness check for the new team-scoping — get this wrong and users either see nothing or see everyone's data).
  - [ ] Create an Area, Product, Project (standalone and nested), Task, Note, Stakeholder, Department.
  - [ ] Archive a project → confirm its tasks show `archived_at` too; restore it.
  - [ ] Delete an Area → confirm cascade to its Products/Projects/Tasks (soft-deleted, disappear from active views).
  - [ ] Rename a Department → confirm its Stakeholders' `department` field updates; delete a Department → confirm its Stakeholders become "Unassigned" rather than deleted.
  - [ ] Toggle "Top 3" on a 4th task in the same project → confirm the "only 3" error surfaces the same as before.
  - [ ] "Clear Done" bulk-archives done tasks in a project.
  - [ ] Upload a task/project attachment and a stakeholder avatar — confirm both display.
  - [ ] AI chat: a simple create action, a destructive action (confirm dialog appears, confirm/cancel both work), an undo.
  - [ ] Account deactivation (Settings → Delete account) → confirm profile is disabled/cleared and you're logged out, but shared Area/Project/Task data is untouched.
  - [ ] Live task-count updates in the Eisenhower matrix when a task changes (Realtime subscription working).
