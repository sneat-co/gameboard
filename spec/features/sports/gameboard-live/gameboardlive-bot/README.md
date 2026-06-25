---
format: https://specscore.md/feature-specification
status: Approved
---

# Feature: GameBoardLiveBot

> [SpecScore.**Studio**](https://specscore.studio): | [Explore](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/gameboardlive-bot?op=explore) | [Edit](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/gameboardlive-bot?op=edit) | [Ask question](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/gameboardlive-bot?op=ask) | [Request change](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/gameboardlive-bot?op=request-change) |
**Status:** Approved
**Date:** 2026-06-23
**Owner:** alex
**Source Ideas:** sneat-sports
**Supersedes:** —
**Grade:** A

## Summary

A chat-bot **delivery** and lightweight **follow** surface for [GameBoard.live](../README.md). Spectators who live in chat apps (parents' group chats) can **follow** a team/player in one tap — the bot **auto-creates a sneat.app account from their verified chat identity** (satisfying [`account-gate`](../../account-gate/README.md), which requires a real account for any mutation, with no manual signup) — and then receive live and final scores in chat with no app install. The chat id becomes the **notification handle** on that account's follow ([`gameboard-live` REQ:follow-team-player](../README.md)). A **Telegram bot (`GameBoardLiveBot`) is the first implementation**; **WhatsApp is a follow-up** on the same chat-delivery contract. The bot is *delivery + distribution*, not the core loop: it consumes the follow-notification events `gameboard-live` already emits and reuses the `invitus` `telegram` channel. Concept: [`spec/ideas/sneat-sports.md`](../../../../ideas/sneat-sports.md).

## Problem

GameBoard.live's no-login web scoreboard proves the loop, but the audience that cares most already lives in chat apps, and email/SMS notifications are high-friction and easy to ignore. A chat bot meets followers where they are: a parent shares the bot or a deep link into the team's group chat, anyone taps "follow" — the bot auto-creates a sneat.app account from their chat identity (per account-gate; no manual signup) — and live/final scores arrive in chat, no app install. This keeps follow friction to one tap (the chat id becomes the notification handle on the auto-created account) and turns existing group chats into a distribution surface, without putting any delivery mechanism on the MVP critical path of the parent feature.

## Behavior

### Chat-delivery channel

#### REQ: chat-delivery-channel

The bot MUST be implemented against a **channel-agnostic chat-delivery contract** (follow, unfollow, deliver-notification, post-to-group) so that additional chat platforms are added as implementations of the same contract rather than as forks. The contract reuses the `invitus` `Channel` model (which already includes `telegram`). Telegram MUST be the first implementation; WhatsApp MUST be a later implementation of the *same* contract (see `## Not Doing`).

### Follow via chat

#### REQ: follow-via-chat

A user MUST be able to follow a team and/or player from the bot — via a bot command (e.g. `/follow`) or a deep link from the public scoreboard. Following is a mutation, so per [`account-gate`](../../account-gate/README.md) it requires a sneat.app account; the bot MUST **auto-create a sneat.app account from the user's verified chat identity** on first follow (no manual signup), and record the chat id as the **notification handle** on that account's follow ([`gameboard-live` REQ:follow-team-player](../README.md)). A user MUST also be able to **unfollow** / stop notifications from the bot.

### Notification delivery

#### REQ: deliver-game-notifications

For a follower on a chat channel, the bot MUST deliver the follow-notification events that [`gameboard-live` REQ:follow-notifications](../README.md) emits — at least: game scheduled, starting soon, going live, and final result — to that follower's chat. A user who has unfollowed (or never followed) MUST NOT receive them.

### Group distribution

#### REQ: group-live-updates

The bot MUST be addable to a group chat and, for a team followed in that group, MUST be able to post the game going live and the final result (and MAY post periodic score updates) into the group. Group posting MUST be opt-in (the bot is added and a team is followed for that group), not unsolicited.

### Minor safety

#### REQ: minor-safe-broadcast

Every message the bot sends (direct or group) MUST honor the minor publish-consent owned by [`sneat-team`](../../sneat-team/README.md) and surfaced by [`gameboard-live` REQ:minor-safe-public](../README.md). The bot MUST NOT broadcast a minor's non-consented personal details into any chat — **including group chats that contain members who are not part of the club** — and the consent rule MUST be applied per message at render time regardless of who is in the chat; absent consent a minor is referred to by jersey number only.

## Architecture

- **Delivery service:** a bot/webhook service that **consumes the follow-notification events** `gameboard-live` emits and renders them per channel. It is a *consumer* of the sports/eventus surfaces — it owns no game, roster, or scoreboard state.
- **Channel contract:** one internal chat-delivery interface; the **Telegram** implementation (`GameBoardLiveBot`) is first, reusing the `invitus` `telegram` channel; the **WhatsApp** implementation (via the WhatsApp Business API) is a later adapter behind the same interface.
- **Auto-account + follow handle:** on first follow the bot **auto-provisions a sneat.app account** from the verified chat identity; the chat id is then stored as the notification handle on that account's follow record (`gameboard-live`) — no parallel follow store, and no accountless follow record.
- **Consent:** before rendering any player-identifying content, the service applies the `minor-safe-public` consent rule sourced from `sneat-team`.
- **Deferral:** delivery is deferred by the Eventus thesis to the sneat-libs batch; this feature is built after the parent `gameboard-live` loop is proven.

## Interaction with Other Features

- **[`gameboard-live`](../README.md)** (parent) — emits the follow-notification events and owns the (account-held) follow record whose notification handle this bot populates; owns `minor-safe-public`.
- **[`account-gate`](../../account-gate/README.md)** — the policy the auto-created account satisfies (following requires a real account); the bot's auto-provisioning is its automatic upgrade path.
- **[`sneat-team`](../../sneat-team/README.md)** — source of truth for minor publish-consent.
- **`invitus`** — provides the `telegram` channel reused by the first implementation.

## Acceptance Criteria

### AC: telegram-first-channel (verifies REQ:chat-delivery-channel)

**Given** the bot built against the channel-agnostic chat-delivery contract,
**When** the first implementation is deployed,
**Then** it is a Telegram bot (`GameBoardLiveBot`) reusing the `invitus` `telegram` channel, and adding WhatsApp later requires a new channel adapter but no change to the follow/notification contract.

### AC: follow-via-chat-captures-handle (verifies REQ:follow-via-chat)

**Given** a user in Telegram following for the first time,
**When** the user taps follow for "Limerick Celtics U14 Girls" via the bot,
**Then** the bot auto-creates a sneat.app account from their chat identity and records a follow with their Telegram chat id as the notification handle; and when the user unfollows, they stop receiving that team's notifications.

### AC: notifications-delivered-to-chat (verifies REQ:deliver-game-notifications)

**Given** a Telegram follower of a team and a user who has not followed it,
**When** a game for that team goes live and later publishes a final result,
**Then** the follower receives the live and final-result messages in chat and the non-follower receives nothing.

### AC: group-live-posting-optin (verifies REQ:group-live-updates)

**Given** the bot added to a group chat with a team followed for that group,
**When** that team's game goes live and finishes,
**Then** the bot posts the live and final-result updates into the group; and a group without the bot (or without a followed team) receives no posts.

### AC: minor-not-broadcast (verifies REQ:minor-safe-broadcast)

**Given** a minor player without club consent to publish personal details, followed both directly and in a group chat that includes members who are not part of the club,
**When** the bot sends a direct message and a group message referring to that player,
**Then** in both cases — and to the non-club members in the group — the player is referred to by jersey number only and no date of birth or personal contact details are sent.

## Not Doing / Out of Scope

- **WhatsApp (and any non-Telegram channel) implementation** — explicitly a **follow-up** on the same chat-delivery contract, not part of this first cut.
- **Scoring from the bot** — running score/clock stays on the GameBoard.live web surface; the bot is delivery/follow only.
- **Rich in-chat scoreboards / mini-apps, reactions, chat-based stats** — future enhancements.
- **Owning game/roster/scoreboard state or the graph write** — those remain with `gameboard-live` / `first-use-backprop`; the bot is a consumer.
- **invitus delivery infrastructure itself** — the bot reuses the deferred `telegram` channel; building out the shared delivery batch is sneat-libs work.

## Assumption Carryover

From the `sneat-sports` Idea (delivery-channel slice):

- **Must-be-true — the follow atom is viral.** The bot strengthens this: chat is where the audience already is, and group posting turns existing chats into distribution. Measured post-MVP, not asserted by an AC here.
- **Should-be-true — auto-account chat-follow stays one-tap and converts.** Auto-creating a sneat.app account from the verified chat identity keeps follow to one tap while making every follower a real account (the chat id as notification handle). Addressed by `follow-via-chat` + its AC.

## Rehearse Integration

Rehearse stubs are deferred. The ACs are testable in principle (bot command handling, handle capture, delivery routing, consent filtering), but the implementation repo, the bot service, and the parent's notification-event surface do not exist yet. Stubs will be scaffolded during planning/implementation. No `_tests/` stubs are created at specify time.

## Open Questions

- **Follow identity & deep-linking.** The exact bot command / deep-link scheme from the scoreboard, and how a chat id maps to (and dedupes against) an existing or auto-created account; and the fallback if auto-account provisioning fails (verified chat identity but account creation errors).
- **Group consent & noise.** Per-group opt-in/opt-out, rate of score updates into groups, and how minor-consent is enforced when a group includes non-club members.
- **WhatsApp timing.** When the WhatsApp adapter follows, and whether Business API templating constraints affect the shared contract.
- **Channel ownership.** Whether this delivery surface ultimately generalizes beyond Sports into a shared Sneat notification/bot feature (it is scoped to GameBoard.live for now).

---
*This document follows the https://specscore.md/feature-specification*
