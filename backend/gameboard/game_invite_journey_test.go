package gameboard

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestGameInviteFullJourneyOverHTTP drives the whole "organize → invite →
// anon RSVP → roster fills → organizer lists my games" loop through the real
// HTTP stack (Handler → Service → dalgo store) — the umbrella journey test
// for the basketball game-invites MVP, mirroring journey_test.go's
// TestFullGameJourney for the live-scoring path.
func TestGameInviteFullJourneyOverHTTP(t *testing.T) {
	srv := newServer()

	// 1. Organize a game — AUTHENTICATED.
	createBody, _ := json.Marshal(createGameInviteRequest{
		Sport: "basketball", TeamName: "U14 Girls", ScheduledMs: 1_700_000_000_000,
		PlayersNeeded: 2, OrganizerName: "Coach Alex",
		Roster: []gameInviteRosterPlayerRequest{{Name: "Ann"}, {Name: "Bo", Jersey: "7"}},
	})
	req := httptest.NewRequest(http.MethodPost, "/v0/api4gameboard/game-invites", bytes.NewReader(createBody))
	req.Header.Set("Authorization", testBearer)
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", rec.Code, rec.Body.String())
	}
	var g GameInviteRecord
	if err := json.Unmarshal(rec.Body.Bytes(), &g); err != nil {
		t.Fatalf("decode created game invite: %v", err)
	}
	if g.GameInviteID == "" || len(g.Roster) != 2 {
		t.Fatalf("bad created record: %+v", g)
	}

	// Anonymous create → 401.
	req = httptest.NewRequest(http.MethodPost, "/v0/api4gameboard/game-invites", bytes.NewReader(createBody))
	rec = httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous create: expected 401, got %d", rec.Code)
	}

	// 2. Organizer console reads the game back — PUBLIC.
	req = httptest.NewRequest(http.MethodGet, "/v0/api4gameboard/game-invites/"+g.GameInviteID, nil)
	rec = httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("get: %d %s", rec.Code, rec.Body.String())
	}

	// missing game invite → 404
	req = httptest.NewRequest(http.MethodGet, "/v0/api4gameboard/game-invites/nope", nil)
	rec = httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}

	// 3. Copy the per-player invite link (client-side token, same shape as
	// invite-token.ts) for Ann, and resolve it — ANONYMOUS.
	annID := g.Roster[0].PlayerID
	token := encodeToken(t, g.GameInviteID, annID)
	req = httptest.NewRequest(http.MethodGet, "/v0/api4gameboard/game-invites/by-token/"+token, nil)
	rec = httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("by-token: %d %s", rec.Code, rec.Body.String())
	}
	var byToken gameInviteByTokenResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &byToken); err != nil {
		t.Fatalf("decode by-token: %v", err)
	}
	if byToken.TargetPlayerID != annID {
		t.Fatalf("expected targeted player %q, got %q", annID, byToken.TargetPlayerID)
	}

	// A malformed token → 400, not 404/500.
	req = httptest.NewRequest(http.MethodGet, "/v0/api4gameboard/game-invites/by-token/not-valid-base64!!", nil)
	rec = httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for malformed token, got %d", rec.Code)
	}

	// 4. Ann's mom RSVPs "going" against the token — ANONYMOUS, no bearer.
	rsvpBody, _ := json.Marshal(submitRsvpByTokenRequest{PlayerID: annID, Status: RsvpGoing, RespondedBy: "Ann's mom"})
	req = httptest.NewRequest(http.MethodPost, "/v0/api4gameboard/game-invites/by-token/"+token+"/rsvp", bytes.NewReader(rsvpBody))
	rec = httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("rsvp: %d %s", rec.Code, rec.Body.String())
	}
	var afterRsvp GameInviteRecord
	_ = json.Unmarshal(rec.Body.Bytes(), &afterRsvp)
	if afterRsvp.Responses[annID].Status != RsvpGoing || afterRsvp.Responses[annID].RespondedBy != "Ann's mom" {
		t.Fatalf("rsvp not recorded: %+v", afterRsvp.Responses)
	}

	// RSVP targeting a player not on the roster → 400.
	badRsvp, _ := json.Marshal(submitRsvpByTokenRequest{PlayerID: "ghost", Status: RsvpGoing, RespondedBy: "Nobody"})
	req = httptest.NewRequest(http.MethodPost, "/v0/api4gameboard/game-invites/by-token/"+token+"/rsvp", bytes.NewReader(badRsvp))
	rec = httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for unknown player, got %d %s", rec.Code, rec.Body.String())
	}

	// 5. A parent adds a walk-in kid not yet on the roster — ANONYMOUS.
	addBody, _ := json.Marshal(gameInviteRosterPlayerRequest{Name: "Cy", GuardianName: "Dana (mom)"})
	req = httptest.NewRequest(http.MethodPost, "/v0/api4gameboard/game-invites/"+g.GameInviteID+"/roster", bytes.NewReader(addBody))
	rec = httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("add roster player: %d %s", rec.Code, rec.Body.String())
	}
	var afterAdd GameInviteRecord
	_ = json.Unmarshal(rec.Body.Bytes(), &afterAdd)
	if len(afterAdd.Roster) != 3 {
		t.Fatalf("expected 3 roster players after walk-in add, got %d", len(afterAdd.Roster))
	}

	// 6. Organizer lists "my games" — AUTHENTICATED (test-user, not the actual
	// organizer-uid stamped above since testID always authenticates as
	// "test-user" — so list against that same identity: re-create as test-user
	// is already how `g` was created above via testBearer, so list for it).
	req = httptest.NewRequest(http.MethodGet, "/v0/api4gameboard/game-invites", nil)
	req.Header.Set("Authorization", testBearer)
	rec = httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("list mine: %d %s", rec.Code, rec.Body.String())
	}
	var mine []GameInviteRecord
	if err := json.Unmarshal(rec.Body.Bytes(), &mine); err != nil {
		t.Fatalf("decode list: %v", err)
	}
	found := false
	for _, gi := range mine {
		if gi.GameInviteID == g.GameInviteID {
			found = true
		}
	}
	if !found {
		t.Fatalf("organizer's own game missing from 'my games': %+v", mine)
	}

	// Anonymous list → 401.
	req = httptest.NewRequest(http.MethodGet, "/v0/api4gameboard/game-invites", nil)
	rec = httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous list: expected 401, got %d", rec.Code)
	}
}

// TestGameInviteBadBodiesOverHTTP covers the malformed-JSON edges for each
// game-invite write endpoint.
func TestGameInviteBadBodiesOverHTTP(t *testing.T) {
	srv := newServer()

	req := httptest.NewRequest(http.MethodPost, "/v0/api4gameboard/game-invites", bytes.NewReader([]byte("not-json")))
	req.Header.Set("Authorization", testBearer)
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("create bad body: expected 400, got %d", rec.Code)
	}

	// Blank team name → 400.
	body, _ := json.Marshal(createGameInviteRequest{TeamName: "   "})
	req = httptest.NewRequest(http.MethodPost, "/v0/api4gameboard/game-invites", bytes.NewReader(body))
	req.Header.Set("Authorization", testBearer)
	rec = httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("create blank team name: expected 400, got %d", rec.Code)
	}

	req = httptest.NewRequest(http.MethodPost, "/v0/api4gameboard/game-invites/some-id/roster", bytes.NewReader([]byte("not-json")))
	rec = httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("add player bad body: expected 400, got %d", rec.Code)
	}

	req = httptest.NewRequest(http.MethodPost, "/v0/api4gameboard/game-invites/by-token/sometoken/rsvp", bytes.NewReader([]byte("not-json")))
	rec = httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("rsvp bad body: expected 400, got %d", rec.Code)
	}
}
