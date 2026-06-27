# Design: Game Settings page, backed by a Calendarius happening

**Date:** 2026-06-26 (updated 2026-06-27)
**Status:** Partially implemented — see "Implementation status" below
**Owner:** alex
**Repo:** sneat-co/gameboard (with changes in sneat-co/sneat-go and sneat-co/gameboard-ext)

## Implementation status (2026-06-27)

- **Platform dependency shipped.** The `SpaceTypeSystem` space type (the
  mechanism for "current user writes to a reserved space without membership,
  authorization delegated to the extension") is implemented and released:
  `sneat-go-core` v0.57.0 (the enum) and `sneat-core-modules` v0.40.0 (the
  dal4spaceus access-check branch + create-space guard). Spec:
  `sneat-co/sneat-specs` → `spec/plans/system-space-type.md`. **This supersedes
  the "system identity" mechanism described in decisions 2–3 below** — there is
  no system user; the current user's gameboard backend call writes the happening
  into the reserved `games` System space.
- **Slice shipped first (GameRecord-first):** redirect-on-create to a new
  `g/:gameID/settings` page that edits **time + venue stored directly on
  `GameRecord`** (new `Location` field), authorized to the game's creator
  (organizer) and backend-enforced (403 otherwise). This deliberately ships the
  user-facing fix (the missing redirect) and editable settings **without** the
  Calendarius-happening backing, which becomes a clean later refactor onto the
  now-available `SpaceTypeSystem`. The `games`-space provisioning question
  (below) is therefore not yet on the critical path.

## Problem

After creating a game at `/app/new-game`, the user is **not redirected** anywhere —
`new-game-page.component.ts` ends with a literal `// TODO: navigate to the game
scoreboard once that route exists`. There is also no place to manage a created
game: its **time** and **venue** cannot be edited after creation (the new-game
form collects venue/competition but the backend only persists
`home`/`away`/`scheduledMs`), and there is no surface for the game's **crew**.

We want a **Game Settings page** that the creator lands on after creating a game,
where they can edit the game's **schedule and location** and (later) manage the
**crew**.

## Goals (this design)

- Redirect to a new `game-settings` page on game creation.
- Let an authorized organizer edit the game's **time** and **location**.
- Persist time/location by representing the game as a **Calendarius happening**,
  reusing the existing Calendarius backend + happening endpoints + UI components
  rather than inventing gameboard-specific schedule/venue storage.
- Establish a forward-compatible **crew** authorization model on the game.

## Non-goals (deferred to later slices)

- Crew **invites** and organizer **granting** UI/endpoints (data model is seeded
  now; the management UI is later).
- A **map / place lookup** dialog for location (text fields only for now).
- Scoring-role authorization for event writes (layers on later via the existing
  `backend/gameboard/authority.go`).
- Re-homing a game's happening into a club/team space (a `first-use-backprop`
  concern).
- Private games / gated reads (games are public for now).
- The **generic, platform-level record authorization** mechanism (captured as a
  separate idea seed in `sneat-libs`:
  `generic-record-level-authorization-allow-mutating-a`). The gameboard `crew`
  model here can migrate onto it once it exists.

## Key architectural decisions

1. **A game is backed by a Calendarius happening.** Time and location are
   *generic happening fields* (a happening slot carries `Timing` = date/time +
   duration, and `Locations[]` = `{type, title, address}`). The gameboard
   `GameRecord` keeps the sport-specific fields (teams, colours, status, crew)
   and **references** the happening via `happeningID` + `spaceID`. This matches
   the `new-game` Feature's stated architecture ("time + place establish the game
   as a Calendarius happening with a thin eventus overlay").

2. **Games stay spaceless to users; happenings live in a reserved `games`
   space.** Calendarius is space-scoped (`/spaces/{spaceID}/ext/calendarius/...`),
   but gameboard games are a *root/global* extension (`/ext/gameboard/games/{id}`)
   and must keep presenting as spaceless. Resolution: a single **reserved
   gameboard system space** (well-known id, e.g. `games`, owned by a system
   identity) is the internal home for all game happenings. Users never see or
   browse this space.

3. **All happening reads/writes are backend-mediated under a system identity.**
   Because no end user is a member of the reserved `games` space (membership would
   leak every game's happening to every member), the gameboard backend calls the
   Calendarius facade as the **system identity** that owns the `games` space. The
   frontend talks only to gameboard endpoints; the happening is an internal detail.

4. **Authorization is gameboard's, via a `crew` list — not Calendarius space
   membership.** Calendarius (`calendarius/backend@v0.1.0`) does **not** authorize
   happening edits by resource role — its update facades run through
   `RunHappeningSpaceWorker` with space/API-layer access, and the
   participant/contact role model is not wired to gate edits. We therefore enforce
   authorization in gameboard:
   - **Reads** are public (games are public for now): anyone with a `gameID` can
     read the game + its happening (schedule/venue/scoreboard). No auth.
   - **Writes** are checked by the gameboard backend against
     `GameRecord.crew` (a list of `{userID, role}`): a mutation is allowed iff the
     caller holds a permitting role. Settings edits require role `organizer`. This
     works regardless of space membership and supports multiple organizers.

5. **Create is wrapped by gameboard for traceability; updates too.** The existing
   `POST /v0/api4gameboard/games` stays the single traceable creation entry point
   and now also creates the backing happening. Because writes are backend-mediated
   (decision 3), gameboard also wraps **update** and **read** of the happening
   (the frontend does not call Calendarius happening endpoints directly).

## Data model changes

`GameRecord` (and its `gameRecordDBO`) in
`/Users/alexandertrakhimenok/projects/sneat-co/gameboard/backend/gameboard/game.go`
gain:

- `HappeningID string` — the backing Calendarius happening id.
- `SpaceID string` — the reserved `games` space id the happening lives in.
- `Crew []CrewMember` where `CrewMember = { UserID string; Role string }`,
  seeded at creation with `{ UserID: createdBy, Role: "organizer" }`.

`ScheduledMs` is retained as a **denormalized cache** of the happening's start
time (kept in sync on create/update) so the existing scoreboard read path keeps
working unchanged. The happening is the source of truth for editing.

The wire contract is mirrored in `gameboard-ext`
(`/Users/alexandertrakhimenok/projects/sneat-co/gameboard-ext/typespec/api4gameboard.tsp`)
and in the frontend client mirror
(`frontend/apps/gameboard-app/src/app/new-game/game-contract.ts`).

## Slice 0 — Game create wraps happening create (foundation, backend)

- **`backend/gameboard` (this repo):** define a `HappeningCreator` port (mirrors
  eventus's `HappeningCreator`). `Service.CreateGame` calls it after building the
  game, stores `happeningID`+`spaceID` on the `GameRecord`, and seeds `crew`.
- **`sneat-go/pkg/modules/gameboard/module.go` (host):** inject a
  `happeningCreatorAdapter` that calls `facade4calendarius.CreateHappening` under
  the system identity for the reserved `games` space — copied from
  `sneat-go/pkg/modules/eventus/adapters.go` (`HappeningTypeSingle`, one `once`
  slot carrying the scheduled start + optional location; title e.g. "Home vs
  Away").
- **Provisioning:** the reserved `games` space and its owning system identity are
  provisioned once (well-known id; exact id + provisioning mechanism is a
  plan-time detail).

## Slice 1 — Game Settings page (frontend) + update/read endpoints

- **Route:** add `g/:gameID/settings` in
  `frontend/apps/gameboard-app/src/app/app.routes.ts`, **auth-guarded** (signed-in
  required). After `create()` succeeds in `new-game-page.component.ts`, redirect
  here (replacing the `// TODO` at line ~511).
- **Authorization (UI):** the page is an organizer tool — the signed-in user must
  be in `crew` with role `organizer` to edit; non-organizers are bounced (or shown
  a read-only state). The read API itself is public.
- **Editing:** the page edits **time** and **location** by calling gameboard
  wrapper endpoints (which call the Calendarius facade as the system identity):
  - `PATCH /v0/api4gameboard/games/{gameID}` with a partial body
    `{ scheduledMs?, location? }` (extensible to future fields). Authorized to
    `crew` role `organizer`. Mutates the happening (and syncs `ScheduledMs`).
  - `GET /v0/api4gameboard/games/{gameID}` returns the game including its
    happening-derived schedule/location for the page to populate. Public.
- **Component reuse:** reuse Calendarius/schedulus UI where cleanly extractable —
  the `sneat-start-end-datetime-form` component for time; a thin **text** location
  field (title + address) using the `SlotLocation` shape. No map/lookup dialog.
- **Crew section:** a read-only "Crew (coming soon)" placeholder so the page
  structure matches the eventual vision; no invite/grant actions yet.

## Error handling

- **Create:** if happening creation fails, `CreateGame` fails as a whole (no
  orphan game) and returns an error the new-game form already surfaces ("Could not
  create the game. Please try again.").
- **Pre-existing games** (created before this change, e.g.
  `1e192c4f6a871d576cee018086a098ed`, which has no `happeningID`): the settings
  page shows "No schedule/venue linked yet" and the backend **lazily creates the
  happening on first settings save**. (Chosen over a one-off backfill migration.)
- **Authorization failures:** writes by a non-organizer return `403`.

## Testing

- **Backend (slice 0):** unit-test `Service.CreateGame` creates and links a
  happening using a fake `HappeningCreator`; seeds `crew` with the creator as
  `organizer`. Host adapter tested against the Calendarius facade the same way
  eventus's adapter is.
- **Backend (slice 1):** `PATCH` authorizes against `crew` (organizer allowed,
  others 403), mutates the happening, and syncs `ScheduledMs`; lazy happening
  creation for a game with no `happeningID`.
- **Frontend:** settings page loads a game, redirect-on-create lands here,
  organizer gate, and time/location save calls the gameboard update endpoint
  (mocked). Extend the existing real-stack E2E to cover create → redirect →
  edit-schedule/location → read-back.

## Assumptions (recorded)

1. The reserved `games` space and its owning system identity are provisioned once;
   the exact well-known space id and provisioning mechanism are plan-time details.
2. Pre-existing games lazily acquire a happening on first settings save (rather
   than a backfill migration).

## Open questions / follow-ups

- Exact reserved space id and system-identity provisioning mechanism.
- Whether `location` lives as a gameboard-local type or imports the Calendarius
  `SlotLocation` type directly (leaning gameboard-local mirror to avoid
  cross-extension coupling; revisit at plan time).
- Future: lift authorization into the generic platform mechanism (idea seed
  `generic-record-level-authorization-allow-mutating-a` in `sneat-libs`).
- Future slices: crew invites + organizer granting UI, scoring-role authz, map /
  place lookup dialog.
