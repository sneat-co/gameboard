---
format: https://specscore.md/feature-specification
status: Approved
---

# Feature: Game-Day Role Invites

> [SpecScore.**Studio**](https://specscore.studio): | [Explore](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/role-invites?op=explore) | [Edit](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/role-invites?op=edit) | [Ask question](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/role-invites?op=ask) | [Request change](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/role-invites?op=request-change) |
**Status:** Approved
**Date:** 2026-06-24
**Owner:** alex
**Source Ideas:** sneat-sports
**Supersedes:** —
**Grade:** A

> **Approved (A).** The game creator's **"assign crew"** surface — the creator-initiated (**push**) counterpart to [`rsvp.express`](../../../eventus/mini-products/rsvp-express/sport-events/README.md)'s self-select (**pull**) RSVP. A **thin orchestration** Feature: it owns the *assignment intent and crew-coverage view*; invite **delivery + accept/decline** are delegated to rsvp.express, and the **role + permission model + authoritative grant** stay with [`roles`](../../sneat-team/roles/README.md).
>
> 🖼️ **Mockup:** [`../screens/screens.html`](../screens/screens.html) — the **Assign crew** tab of the GameBoard.live screen-prototype gallery (per-role assignee + status, targeted invite, crew-coverage view). Illustrative only, not normative.

## Summary

After a game is created ([`new-game`](../new-game/README.md)), the organizer often needs to **hand a specific person a specific game-day role** — "Mary, please keep the score sheet" — rather than wait for people to self-select. This Feature is that surface: the creator **assigns a game-day role to one or more candidate people and issues targeted invites with the role (and the permissions it carries) attached** — and, if **more than one candidate accepts** a single-holder role, **chooses** who holds it — then tracks **crew coverage** (which essential roles are filled / pending / unfilled) before tip-off.

It is deliberately **thin**. It does **not** re-implement RSVP: invite **delivery and accept/decline reuse [`rsvp.express`](../../../eventus/mini-products/rsvp-express/sport-events/README.md)** (its sport-events vertical), in a **targeted, pre-assigned-role** mode. It does **not** own permissions or the authoritative assignment: the **role + permission model and the grant on acceptance are owned by [`roles`](../../sneat-team/roles/README.md)**, and acting on an accepted role is **account-gated** ([`account-gate`](../../account-gate/README.md)). Concept/vision: [`spec/ideas/sneat-sports.md`](../../../../ideas/sneat-sports.md); RSVP integration: [`spec/ideas/rsvp-express.md`](../../../../ideas/rsvp-express.md).

## Problem

The pre-game **crew** — score-sheet keeper, clock/board runner, judge, coaches — and the lineup are settled ad-hoc over WhatsApp and improvised on the day. [`rsvp.express`](../../../eventus/mini-products/rsvp-express/sport-events/README.md) closes part of this by letting people **self-select** a role when they RSVP (pull), which *proposes* assignments. But the organizer frequently needs the **opposite direction**: to **push** a role to a **named person** with the **permissions that role carries**, and to **see at a glance** whether the essential roles are covered before tip-off. There is no surface for that creator-initiated assign-and-invite, and no consolidated crew-coverage view. This Feature is that surface — without rebuilding the RSVP engine or the role model it sits on.

## Behavior

### Assigning

#### REQ: assign-role-to-person

The organizer MUST be able to **assign one game-day role** (from the [`roles`](../../sneat-team/roles/README.md) set — e.g. head/assistant coach, score-sheet keeper, clock/board runner, judge) and invite **one or more candidate people** to it — chosen from the team roster / contacts ([`sneat-team`](../../sneat-team/README.md)) or by typing a name/handle. Each invite is recorded on the game as a **proposal pending acceptance**, never as an authoritative grant by this surface.

#### REQ: multi-candidate-resolution

A role MAY be offered to **several candidates at once**. For a **single-holder role** (e.g. score-sheet keeper, clock/board runner, judge, head coach), if **more than one candidate accepts**, the surface MUST mark the role **needs-resolution** and let the **organizer choose which accepter holds it**; only the chosen person's role is granted (via [`roles`](../../sneat-team/roles/README.md)), and the other accepters are **released** (notified they are not needed, optionally kept as backup). The surface MUST NOT silently grant a contested single-holder role to the first accepter without the organizer's choice.

#### REQ: invite-carries-role-and-permissions

Issuing the invite MUST **attach the assigned role and the permissions that role grants** (per [`roles`](../../sneat-team/roles/README.md)), so the invitee sees **what they are being asked to do and what they will be able to do**. Invite **delivery and the invitee's accept/decline reuse [`rsvp.express`](../../../eventus/mini-products/rsvp-express/sport-events/README.md)** (targeted mode); on **accept**, the role is granted by [`roles`](../../sneat-team/roles/README.md) and acting on it requires a **sneat.app account** ([`account-gate`](../../account-gate/README.md)).

#### REQ: targeted-vs-open

A **targeted invite** (organizer pre-assigns the role to a specific person) MUST be distinguishable from rsvp.express's **open self-select** RSVP, while both converge on the **same role-assignment read-back** governed by [`roles`](../../sneat-team/roles/README.md) (no second source of truth for assignments).

#### REQ: open-join-link

Besides targeted invites, the surface MUST offer an **open join QR / link** for the game's crew, so a person can **scan and self-select an open crew role** without being individually invited (delegating to [`rsvp.express`](../../../eventus/mini-products/rsvp-express/sport-events/README.md)'s open self-select RSVP, account-gated). Self-selected crew responses feed the **same proposal / read-back** as targeted invites (governed by [`roles`](../../sneat-team/roles/README.md)), and single-holder contention is resolved by the same `multi-candidate-resolution`.

### Tracking

#### REQ: crew-coverage

The organizer MUST see **crew coverage** for the game: which **essential roles** (at minimum score-sheet keeper and clock/board runner) are **filled / pending / unfilled**, **who accepted, declined, or is pending** (a role may have **multiple candidates**), and a **needs-choice** state when **more than one** candidate has accepted a single-holder role — so gaps and pending decisions are visible **before tip-off**.

#### REQ: reassign-revoke

The organizer MUST be able to **reassign or revoke** a role invite **before acceptance** (and, after acceptance, via the governance owned by [`roles`](../../sneat-team/roles/README.md)), without this surface mutating the authoritative role grant directly.

### Authority & safety

#### REQ: proposes-not-grants

This surface **proposes and invites**; it MUST NOT be the authoritative grantor of a role or permissions — the **grant on acceptance and the permission model are owned by [`roles`](../../sneat-team/roles/README.md)**, and acting on a granted role is account-gated ([`account-gate`](../../account-gate/README.md)). Targeting a **minor** MUST honour publish-consent ([`sneat-team`](../../sneat-team/README.md) / [`roles`](../../sneat-team/roles/README.md)).

## Architecture

A **thin orchestrator**; it owns the *assignment intent, targeting, and crew-coverage view* and nothing underneath.

- **Delivery + response:** delegated to [`rsvp.express`](../../../eventus/mini-products/rsvp-express/sport-events/README.md) (sport-events vertical) in a **targeted, pre-assigned-role** mode — it carries the invite, captures accept/decline, and reads back per its existing contract. This surface hands it *(occasion + target person + the single pre-assigned role)*.
- **Role + permission model + authoritative grant:** owned by [`roles`](../../sneat-team/roles/README.md). On acceptance, roles grants; permissions follow from the role.
- **Account requirement:** acting on an accepted official role is account-gated ([`account-gate`](../../account-gate/README.md)).
- **Game context:** the game and its lifecycle are [`gameboard-live`](../README.md); creation is [`new-game`](../new-game/README.md); the lineup (present players) is `gameboard-live` `select-lineup`, distinct from operator-role assignment.
- **Owns no:** RSVP/delivery mechanics, permission model, authoritative grant, or self-select RSVP.

## Interaction with Other Features

- **[`rsvp.express`](../../../eventus/mini-products/rsvp-express/sport-events/README.md)** — the RSVP engine this Feature drives in targeted mode for delivery + accept/decline; the open self-select RSVP is its pull counterpart.
- **[`roles`](../../sneat-team/roles/README.md)** — owns the game-day role + permission model and the authoritative grant on acceptance; this surface only proposes.
- **[`account-gate`](../../account-gate/README.md)** — an accepted official role is acted on only by a signed-in account.
- **[`new-game`](../new-game/README.md)** — creation precedes this; the creator's disclosed role is their own initial claim, this surface assigns the rest of the crew.
- **[`sneat-team`](../../sneat-team/README.md)** — roster / contacts the organizer targets; minor publish-consent.
- **[`screens`](../screens/README.md)** — the screen map; this adds the organizer's "assign crew" surface to the inventory.

## Acceptance Criteria

### AC: assign-records-proposal (verifies REQ:assign-role-to-person)

**Given** a created game and the organizer,
**When** the organizer assigns "score-sheet keeper" and invites one or more named people from the roster,
**Then** a pending role-assignment proposal is recorded per invited candidate, and no authoritative role grant is made by this surface.

### AC: overaccept-creator-chooses (verifies REQ:multi-candidate-resolution)

**Given** a single-holder role (clock/board runner) offered to two candidates and **both accept**,
**When** the organizer opens the crew view,
**Then** the role shows a **needs-choice** state, the organizer picks one accepter, only that person's role is granted via `roles`, and the other accepter is released (not granted).

### AC: invite-shows-role-and-permissions (verifies REQ:invite-carries-role-and-permissions)

**Given** a pending assignment,
**When** the organizer issues the invite,
**Then** the invite carries the assigned role and its permissions, is delivered via rsvp.express, and on the invitee's account-gated accept the role is granted by `roles` — the coach console / scorekeeper console / timekeeper console it unlocks follows from that role.

### AC: targeted-and-open-converge (verifies REQ:targeted-vs-open)

**Given** one person sent a targeted "clock/board runner" invite and another who self-selects the same role via open RSVP,
**When** both accept,
**Then** both resolve to the same game-day role assignment governed by `roles`, with no conflicting second record.

### AC: open-join-via-qr (verifies REQ:open-join-link)

**Given** the organizer's crew screen showing a join QR / link,
**When** a person scans it and self-selects the open "clock/board runner" role,
**Then** the response is captured via rsvp.express and proposed as the same `roles` assignment a targeted invite would produce — with single-holder contention resolved the same way.

### AC: coverage-shows-gaps (verifies REQ:crew-coverage)

**Given** a game where the clock/board runner role is unfilled,
**When** the organizer opens the crew view before tip-off,
**Then** score-sheet keeper shows filled/accepted, clock/board runner shows unfilled, and each pending invite shows accepted / declined / pending.

### AC: revoke-before-accept (verifies REQ:reassign-revoke)

**Given** a pending (not yet accepted) role invite,
**When** the organizer revokes or reassigns it,
**Then** the prior invite is withdrawn and no role is granted from it; post-acceptance changes defer to `roles` governance.

### AC: not-authoritative-grantor (verifies REQ:proposes-not-grants)

**Given** this surface,
**When** a role invite is accepted,
**Then** the authoritative grant and permissions come from `roles` (not from this Feature), the actor is a signed-in account, and a minor target is handled under publish-consent.

## Not Doing / Out of Scope

- **The RSVP/invite delivery engine and accept/decline mechanics** — owned by [`rsvp.express`](../../../eventus/mini-products/rsvp-express/sport-events/README.md).
- **The role + permission model and the authoritative grant** — owned by [`roles`](../../sneat-team/roles/README.md).
- **Open self-select RSVP** (the pull direction) — owned by rsvp.express's sport-events vertical.
- **Lineup selection** (present players) — owned by [`gameboard-live`](../README.md) `select-lineup`.
- **Account creation / materialization** — owned by [`first-use-backprop`](../../first-use-backprop/README.md).

## Open Questions

- **rsvp.express targeted mode.** rsvp.express today is self-select only; this Feature needs a **targeted (pre-assigned-role, named-recipient)** invite mode added to its sport-events vertical. Confirm that capability lands there (not here).
- **Post-acceptance reassignment.** Exact governance when revoking/reassigning a role **after** acceptance (mid-game hand-off of the score sheet) — owned by `roles`; this surface only triggers.
- **Permission customization.** Whether the organizer may attach **non-default** permissions to a role invite, or only the role's standard permission set.
- **Delegation.** Whether a non-creator with sufficient role (head coach) may also assign/invite crew, or only the organizer.
- **Minor targeting.** Consent/flow when the targeted person is a minor.

---
*This document follows the https://specscore.md/feature-specification*
