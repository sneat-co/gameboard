package gameboard

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"testing"

	"github.com/dal-go/dalgo/adapters/dalgo2memory"
)

func newGameInviteSvc() *Service { return NewService(NewDalgoStore(dalgo2memory.NewDB())) }

func makeInput() CreateGameInviteInput {
	return CreateGameInviteInput{
		Sport:         "basketball",
		TeamName:      "U14 Girls",
		ScheduledMs:   1_000_000,
		PlayersNeeded: 10,
		Recurring:     RecurringSchedule{Enabled: false},
		OrganizerName: "Coach Alex",
		Roster: []CreateRosterPlayerInput{
			{Name: "Ann"}, {Name: "Bo", Jersey: "7", GuardianName: "Dana (mom)"},
		},
	}
}

// encodeToken mirrors the frontend's invite-token.ts encodeInviteToken so
// tests can mint a token the same way the client would.
func encodeToken(t *testing.T, gameID, playerID string) string {
	t.Helper()
	payload := struct {
		GameID   string `json:"gameId"`
		PlayerID string `json:"playerId,omitempty"`
	}{GameID: gameID, PlayerID: playerID}
	raw, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}
	return base64.RawURLEncoding.EncodeToString(raw)
}

func TestCreateAndGetGameInvite(t *testing.T) {
	s := newGameInviteSvc()
	ctx := context.Background()
	g, err := s.CreateGameInvite(ctx, "organizer-1", makeInput())
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if g.GameInviteID == "" {
		t.Fatal("no gameId assigned")
	}
	if len(g.Roster) != 2 || g.Roster[0].PlayerID == "" || g.Roster[1].PlayerID == "" {
		t.Fatalf("roster not assigned ids: %+v", g.Roster)
	}
	if g.Roster[0].PlayerID == g.Roster[1].PlayerID {
		t.Fatal("roster player ids collide")
	}
	if g.OrganizerUID != "organizer-1" {
		t.Fatalf("organizerUID not stamped: %q", g.OrganizerUID)
	}
	if g.Responses == nil || len(g.Responses) != 0 {
		t.Fatalf("expected empty responses map, got %+v", g.Responses)
	}

	got, err := s.GameInvite(ctx, g.GameInviteID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.TeamName != "U14 Girls" || len(got.Roster) != 2 {
		t.Fatalf("round-trip mismatch: %+v", got)
	}
}

func TestCreateGameInviteValidation(t *testing.T) {
	s := newGameInviteSvc()
	input := makeInput()
	input.TeamName = "   "
	if _, err := s.CreateGameInvite(context.Background(), "u", input); !errors.Is(err, ErrInvalidGameInvite) {
		t.Fatalf("expected ErrInvalidGameInvite, got %v", err)
	}
}

func TestGetGameInviteNotFound(t *testing.T) {
	s := newGameInviteSvc()
	if _, err := s.GameInvite(context.Background(), "missing"); !errors.Is(err, ErrGameInviteNotFound) {
		t.Fatalf("expected ErrGameInviteNotFound, got %v", err)
	}
}

func TestAddRosterPlayer(t *testing.T) {
	s := newGameInviteSvc()
	ctx := context.Background()
	g, err := s.CreateGameInvite(ctx, "organizer-1", makeInput())
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	updated, err := s.AddRosterPlayer(ctx, g.GameInviteID, CreateRosterPlayerInput{Name: "Cy", GuardianName: "Dana (mom)"})
	if err != nil {
		t.Fatalf("add player: %v", err)
	}
	if len(updated.Roster) != 3 {
		t.Fatalf("expected 3 roster players, got %d", len(updated.Roster))
	}
	added := updated.Roster[2]
	if added.Name != "Cy" || added.PlayerID == "" {
		t.Fatalf("bad added player: %+v", added)
	}
	if updated.UpdatedAtMs < g.UpdatedAtMs {
		t.Fatalf("updatedAt not bumped: before=%d after=%d", g.UpdatedAtMs, updated.UpdatedAtMs)
	}

	// Unknown game.
	if _, err := s.AddRosterPlayer(ctx, "missing", CreateRosterPlayerInput{Name: "X"}); !errors.Is(err, ErrGameInviteNotFound) {
		t.Fatalf("expected ErrGameInviteNotFound, got %v", err)
	}

	// Blank name rejected.
	if _, err := s.AddRosterPlayer(ctx, g.GameInviteID, CreateRosterPlayerInput{Name: "  "}); !errors.Is(err, ErrInvalidGameInvite) {
		t.Fatalf("expected ErrInvalidGameInvite, got %v", err)
	}
}

func TestGameInviteByToken(t *testing.T) {
	s := newGameInviteSvc()
	ctx := context.Background()
	g, err := s.CreateGameInvite(ctx, "organizer-1", makeInput())
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	playerID := g.Roster[0].PlayerID

	// Targeted token — resolves the game AND the targeted player.
	res, err := s.GameInviteByToken(ctx, encodeToken(t, g.GameInviteID, playerID))
	if err != nil {
		t.Fatalf("by-token: %v", err)
	}
	if res.Game.GameInviteID != g.GameInviteID || res.TargetPlayerID != playerID {
		t.Fatalf("bad resolution: %+v", res)
	}

	// Open (untargeted) token — resolves the game, no target.
	res2, err := s.GameInviteByToken(ctx, encodeToken(t, g.GameInviteID, ""))
	if err != nil {
		t.Fatalf("by-token open: %v", err)
	}
	if res2.TargetPlayerID != "" {
		t.Fatalf("expected no target player for an open link, got %q", res2.TargetPlayerID)
	}

	// Malformed token.
	if _, err := s.GameInviteByToken(ctx, "not-a-real-token!!"); !errors.Is(err, ErrInvalidToken) {
		t.Fatalf("expected ErrInvalidToken, got %v", err)
	}

	// Well-formed token, unknown game.
	if _, err := s.GameInviteByToken(ctx, encodeToken(t, "missing-game", "")); !errors.Is(err, ErrGameInviteNotFound) {
		t.Fatalf("expected ErrGameInviteNotFound, got %v", err)
	}
}

func TestSubmitRsvpByToken_ParentProxy(t *testing.T) {
	s := newGameInviteSvc()
	ctx := context.Background()
	g, err := s.CreateGameInvite(ctx, "organizer-1", makeInput())
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	playerID := g.Roster[0].PlayerID
	token := encodeToken(t, g.GameInviteID, playerID)

	// Anonymous RSVP: respondedByUID empty — the actor (parent, RespondedBy)
	// stays distinct from the subject (playerID, the kid).
	updated, err := s.SubmitRsvpByToken(ctx, token, "", SubmitRsvpInput{
		PlayerID: playerID, Status: RsvpGoing, RespondedBy: "Ann's mom",
	})
	if err != nil {
		t.Fatalf("submit rsvp: %v", err)
	}
	rsvp, ok := updated.Responses[playerID]
	if !ok {
		t.Fatalf("no response recorded for %q: %+v", playerID, updated.Responses)
	}
	if rsvp.PlayerID != playerID || rsvp.RespondedBy != "Ann's mom" || rsvp.Status != RsvpGoing {
		t.Fatalf("bad rsvp: %+v", rsvp)
	}
	if rsvp.RespondedByUID != "" {
		t.Fatalf("anonymous submission should not carry a UID, got %q", rsvp.RespondedByUID)
	}
	if rsvp.PlayerID == rsvp.RespondedBy {
		t.Fatal("playerId (subject) and respondedBy (actor) must never collapse into the same value")
	}
}

func TestSubmitRsvpByToken_Idempotent(t *testing.T) {
	s := newGameInviteSvc()
	ctx := context.Background()
	g, _ := s.CreateGameInvite(ctx, "organizer-1", makeInput())
	playerID := g.Roster[0].PlayerID
	token := encodeToken(t, g.GameInviteID, playerID)

	if _, err := s.SubmitRsvpByToken(ctx, token, "", SubmitRsvpInput{PlayerID: playerID, Status: RsvpMaybe, RespondedBy: "Ann's mom"}); err != nil {
		t.Fatalf("first rsvp: %v", err)
	}
	updated, err := s.SubmitRsvpByToken(ctx, token, "", SubmitRsvpInput{PlayerID: playerID, Status: RsvpGoing, RespondedBy: "Ann's mom"})
	if err != nil {
		t.Fatalf("second rsvp: %v", err)
	}
	if len(updated.Responses) != 1 {
		t.Fatalf("expected a single (overwritten) response, got %d: %+v", len(updated.Responses), updated.Responses)
	}
	if updated.Responses[playerID].Status != RsvpGoing {
		t.Fatalf("expected the second submission to win, got %s", updated.Responses[playerID].Status)
	}

	// Idempotent resubmission with the SAME status changes nothing observable.
	updated2, err := s.SubmitRsvpByToken(ctx, token, "", SubmitRsvpInput{PlayerID: playerID, Status: RsvpGoing, RespondedBy: "Ann's mom"})
	if err != nil {
		t.Fatalf("third rsvp: %v", err)
	}
	if len(updated2.Responses) != 1 || updated2.Responses[playerID].Status != RsvpGoing {
		t.Fatalf("idempotent resubmit changed shape: %+v", updated2.Responses)
	}
}

func TestSubmitRsvpByToken_PlayerNotOnRoster(t *testing.T) {
	s := newGameInviteSvc()
	ctx := context.Background()
	g, _ := s.CreateGameInvite(ctx, "organizer-1", makeInput())
	token := encodeToken(t, g.GameInviteID, "")
	if _, err := s.SubmitRsvpByToken(ctx, token, "", SubmitRsvpInput{PlayerID: "nonexistent", Status: RsvpGoing, RespondedBy: "P"}); !errors.Is(err, ErrPlayerNotFound) {
		t.Fatalf("expected ErrPlayerNotFound, got %v", err)
	}
}

func TestSubmitRsvpByToken_InvalidStatusAndToken(t *testing.T) {
	s := newGameInviteSvc()
	ctx := context.Background()
	g, _ := s.CreateGameInvite(ctx, "organizer-1", makeInput())
	playerID := g.Roster[0].PlayerID
	token := encodeToken(t, g.GameInviteID, playerID)

	if _, err := s.SubmitRsvpByToken(ctx, token, "", SubmitRsvpInput{PlayerID: playerID, Status: "not-a-status", RespondedBy: "P"}); !errors.Is(err, ErrInvalidGameInvite) {
		t.Fatalf("expected ErrInvalidGameInvite for bad status, got %v", err)
	}
	if _, err := s.SubmitRsvpByToken(ctx, "garbage-token", "", SubmitRsvpInput{PlayerID: playerID, Status: RsvpGoing, RespondedBy: "P"}); !errors.Is(err, ErrInvalidToken) {
		t.Fatalf("expected ErrInvalidToken, got %v", err)
	}
}

func TestSubmitRsvpByToken_AuthenticatedEnrichesParticipantIndex(t *testing.T) {
	s := newGameInviteSvc()
	ctx := context.Background()
	g, _ := s.CreateGameInvite(ctx, "organizer-1", makeInput())
	playerID := g.Roster[0].PlayerID
	token := encodeToken(t, g.GameInviteID, playerID)

	updated, err := s.SubmitRsvpByToken(ctx, token, "parent-account-1", SubmitRsvpInput{
		PlayerID: playerID, Status: RsvpGoing, RespondedBy: "Ann's mom",
	})
	if err != nil {
		t.Fatalf("submit rsvp: %v", err)
	}
	if updated.Responses[playerID].RespondedByUID != "parent-account-1" {
		t.Fatalf("expected respondedByUID to be recorded, got %+v", updated.Responses[playerID])
	}

	// The parent's account now sees this game under "my games" (invited half).
	mine, err := s.MyGameInvites(ctx, "parent-account-1")
	if err != nil {
		t.Fatalf("my games: %v", err)
	}
	if len(mine) != 1 || mine[0].GameInviteID != g.GameInviteID {
		t.Fatalf("expected the parent to see the game as invited, got %+v", mine)
	}
}

func TestMyGameInvites_OrganizerAndInvitedDeduped(t *testing.T) {
	s := newGameInviteSvc()
	ctx := context.Background()
	g, _ := s.CreateGameInvite(ctx, "organizer-1", makeInput())
	playerID := g.Roster[0].PlayerID
	token := encodeToken(t, g.GameInviteID, playerID)

	// The organizer ALSO RSVPs (e.g. a playing coach) — should still appear once.
	if _, err := s.SubmitRsvpByToken(ctx, token, "organizer-1", SubmitRsvpInput{PlayerID: playerID, Status: RsvpGoing, RespondedBy: "Coach"}); err != nil {
		t.Fatalf("rsvp: %v", err)
	}

	mine, err := s.MyGameInvites(ctx, "organizer-1")
	if err != nil {
		t.Fatalf("my games: %v", err)
	}
	if len(mine) != 1 {
		t.Fatalf("expected exactly 1 de-duplicated game, got %d: %+v", len(mine), mine)
	}
}

func TestMyGameInvites_EmptyForStranger(t *testing.T) {
	s := newGameInviteSvc()
	ctx := context.Background()
	if _, err := s.CreateGameInvite(ctx, "organizer-1", makeInput()); err != nil {
		t.Fatalf("create: %v", err)
	}
	mine, err := s.MyGameInvites(ctx, "someone-else")
	if err != nil {
		t.Fatalf("my games: %v", err)
	}
	if len(mine) != 0 {
		t.Fatalf("expected no games for a stranger, got %+v", mine)
	}
}

func TestGameInviteStoreUnconfigured(t *testing.T) {
	s := NewService(errStore{}) // errStore does not implement GameInviteStore
	if _, err := s.CreateGameInvite(context.Background(), "u", makeInput()); !errors.Is(err, ErrGameInviteStoreUnconfigured) {
		t.Fatalf("expected ErrGameInviteStoreUnconfigured, got %v", err)
	}
	if _, err := s.GameInvite(context.Background(), "x"); !errors.Is(err, ErrGameInviteNotFound) {
		t.Fatalf("expected ErrGameInviteNotFound, got %v", err)
	}
	if games, err := s.MyGameInvites(context.Background(), "u"); err != nil || games != nil {
		t.Fatalf("expected (nil, nil), got (%+v, %v)", games, err)
	}
}
