package gameboard

import (
	"context"
	"errors"
	"strings"
)

// ErrGameInviteStoreUnconfigured is returned when the wired store does not
// implement GameInviteStore (mirrors "game store not configured" in service.go).
var ErrGameInviteStoreUnconfigured = errors.New("gameboard: game-invite store not configured")

// GameInviteByTokenResult is the resolved read for an anonymous invite-link
// visit: the game (teaser + full roster/RSVP state, all public reads per
// account-gate's "reads are free") plus which roster player, if any, the link
// specifically targets (role-invites' targeted-invite pattern; empty for an
// open join link).
type GameInviteByTokenResult struct {
	Game           GameInviteRecord
	TargetPlayerID string
}

// CreateGameInvite creates a new game-invite aggregate — the "organize a
// game" step (roadmap doc MVP item 1). organizerUID is the authenticated
// caller, stamped server-side (never client-supplied), mirroring
// Service.CreateGame's createdBy.
func (s *Service) CreateGameInvite(ctx context.Context, organizerUID string, input CreateGameInviteInput) (GameInviteRecord, error) {
	if s.gameInvites == nil {
		return GameInviteRecord{}, ErrGameInviteStoreUnconfigured
	}
	teamName := strings.TrimSpace(input.TeamName)
	if teamName == "" {
		return GameInviteRecord{}, ErrInvalidGameInvite
	}
	organizerName := strings.TrimSpace(input.OrganizerName)
	if organizerName == "" {
		organizerName = "Coach"
	}
	roster := make([]RosterPlayer, 0, len(input.Roster))
	for _, p := range input.Roster {
		name := strings.TrimSpace(p.Name)
		if name == "" {
			continue // a blank draft row is silently dropped, mirroring the
			// frontend's addPlayer guard (draftName().trim() must be non-empty
			// before the button is even enabled).
		}
		roster = append(roster, RosterPlayer{
			PlayerID:     newGameID(), // generic dashless-hex id generator (game.go), reused for roster player ids too
			Name:         name,
			Jersey:       strings.TrimSpace(p.Jersey),
			GuardianName: strings.TrimSpace(p.GuardianName),
		})
	}
	now := nowFunc().UnixMilli()
	g := GameInviteRecord{
		GameInviteID:  newGameID(),
		Sport:         input.Sport,
		TeamName:      teamName,
		OpponentName:  strings.TrimSpace(input.OpponentName),
		ScheduledMs:   input.ScheduledMs,
		Venue:         strings.TrimSpace(input.Venue),
		PlayersNeeded: input.PlayersNeeded,
		Recurring:     input.Recurring,
		OrganizerName: organizerName,
		OrganizerUID:  organizerUID,
		Roster:        roster,
		Responses:     map[string]RsvpRecord{},
		CreatedAtMs:   now,
		UpdatedAtMs:   now,
	}
	if err := s.gameInvites.CreateGameInvite(ctx, g); err != nil {
		return GameInviteRecord{}, err
	}
	return g, nil
}

// GameInvite reads a game-invite record by id (the organizer/roster console
// read) — public, no auth required (account-gate: "reads are free").
func (s *Service) GameInvite(ctx context.Context, gameInviteID string) (GameInviteRecord, error) {
	if s.gameInvites == nil {
		return GameInviteRecord{}, ErrGameInviteNotFound
	}
	return s.gameInvites.GetGameInvite(ctx, gameInviteID)
}

// AddRosterPlayer adds one player to an existing game invite's roster.
// PUBLIC/anon-friendly by design (see Handler.addRosterPlayer's doc comment):
// both the organizer console's "add a player" and the RSVP page's "not on the
// list? add my kid" call this today with no sign-in required.
func (s *Service) AddRosterPlayer(ctx context.Context, gameInviteID string, player CreateRosterPlayerInput) (GameInviteRecord, error) {
	if s.gameInvites == nil {
		return GameInviteRecord{}, ErrGameInviteStoreUnconfigured
	}
	name := strings.TrimSpace(player.Name)
	if name == "" {
		return GameInviteRecord{}, ErrInvalidGameInvite
	}
	rp := RosterPlayer{
		PlayerID:     newGameID(),
		Name:         name,
		Jersey:       strings.TrimSpace(player.Jersey),
		GuardianName: strings.TrimSpace(player.GuardianName),
	}
	return s.gameInvites.AddRosterPlayer(ctx, gameInviteID, rp)
}

// GameInviteByToken resolves an anonymous invite-link visit: decodes the
// token (never requires auth — anyone with the link may read the teaser/
// roster/fill), reads the game, and reports which roster player the link
// targets (if any). Mirrors eventius's links.Resolve(token) → event read
// (rsvp_handlers.go submitRsvp) but combined into one call since the
// game-invites frontend always needs both together.
func (s *Service) GameInviteByToken(ctx context.Context, token string) (GameInviteByTokenResult, error) {
	if s.gameInvites == nil {
		return GameInviteByTokenResult{}, ErrGameInviteNotFound
	}
	gameID, playerID, ok := decodeInviteToken(token)
	if !ok {
		return GameInviteByTokenResult{}, ErrInvalidToken
	}
	g, err := s.gameInvites.GetGameInvite(ctx, gameID)
	if err != nil {
		return GameInviteByTokenResult{}, err
	}
	return GameInviteByTokenResult{Game: g, TargetPlayerID: playerID}, nil
}

// SubmitRsvpByToken records a parent-proxy RSVP against a link token.
// ANONYMOUS-FRIENDLY: respondedByUID is "" for an anonymous submission and
// only set when the HTTP caller supplied a valid bearer token (see
// Handler.submitRsvpByToken) — mirrors eventius's ViaAccount (rsvp.go).
// Idempotent per (gameID, playerID): a resubmission for the same player
// overwrites rather than duplicates (SubmitRsvp's map-key semantics).
func (s *Service) SubmitRsvpByToken(ctx context.Context, token, respondedByUID string, input SubmitRsvpInput) (GameInviteRecord, error) {
	if s.gameInvites == nil {
		return GameInviteRecord{}, ErrGameInviteStoreUnconfigured
	}
	gameID, _, ok := decodeInviteToken(token)
	if !ok {
		return GameInviteRecord{}, ErrInvalidToken
	}
	switch input.Status {
	case RsvpGoing, RsvpMaybe, RsvpOut:
	default:
		return GameInviteRecord{}, ErrInvalidGameInvite
	}
	playerID := strings.TrimSpace(input.PlayerID)
	if playerID == "" {
		return GameInviteRecord{}, ErrInvalidGameInvite
	}
	respondedBy := strings.TrimSpace(input.RespondedBy)
	if respondedBy == "" {
		respondedBy = "A parent" // never attribute a response to an empty string (mirrors parent-proxy.ts buildProxyResponse)
	}
	rsvp := RsvpRecord{
		PlayerID:       playerID,
		Status:         input.Status,
		RespondedBy:    respondedBy,
		RespondedByUID: respondedByUID,
		RespondedAtMs:  nowFunc().UnixMilli(),
		Note:           strings.TrimSpace(input.Note),
	}
	updated, err := s.gameInvites.SubmitRsvp(ctx, gameID, rsvp)
	if err != nil {
		return GameInviteRecord{}, err
	}
	// Best-effort participant-index write for the "invited" half of "my
	// games" — never fails the RSVP itself (already durably persisted above),
	// mirrors eventius's attendance-edge enrichment being best-effort
	// (rsvp_handlers.go submitRsvp: "enrichment is best-effort").
	if respondedByUID != "" {
		_ = s.gameInvites.PutGameInviteParticipant(ctx, respondedByUID, gameID)
	}
	return updated, nil
}

// MyGameInvites lists the games uid organizes plus the games uid has RSVP'd
// to while signed in (the participant index), de-duplicated. AUTHENTICATED
// only (Handler.listMyGameInvites requires a bearer token) — an anonymous
// visitor has no stable identity to list "my games" against.
func (s *Service) MyGameInvites(ctx context.Context, uid string) ([]GameInviteRecord, error) {
	if s.gameInvites == nil {
		return nil, nil
	}
	organized, err := s.gameInvites.ListGameInvitesByOrganizer(ctx, uid)
	if err != nil {
		return nil, err
	}
	invited, err := s.gameInvites.ListGameInvitesByParticipant(ctx, uid)
	if err != nil {
		return nil, err
	}
	seen := make(map[string]bool, len(organized))
	out := make([]GameInviteRecord, 0, len(organized)+len(invited))
	for _, g := range organized {
		seen[g.GameInviteID] = true
		out = append(out, g)
	}
	for _, g := range invited {
		if seen[g.GameInviteID] {
			continue
		}
		seen[g.GameInviteID] = true
		out = append(out, g)
	}
	return out, nil
}
