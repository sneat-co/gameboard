package gameboard

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/dal-go/dalgo/adapters/dalgo2memory"
	et "github.com/sneat-co/gameboard-ext/backend/eventtimeline"
)

func TestCreateAndGetGame(t *testing.T) {
	s := NewService(NewDalgoStore(dalgo2memory.NewDB()))
	ctx := context.Background()
	spaceID := "space-home"
	g, err := s.CreateGame(ctx, "organizer-1",
		et.Side{Name: "Hawks", Colour: "#c00", SpaceID: &spaceID},
		et.Side{Name: "Foxes", Colour: "#00c"}, // ad-hoc, no spaceID
		1700000000000)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if g.GameID == "" || g.Status != et.StatusScheduled {
		t.Fatalf("bad record: %+v", g)
	}
	if g.CreatedBy != "organizer-1" || g.CreatedAt.IsZero() {
		t.Fatalf("audit fields not stamped: createdBy=%q createdAt=%v", g.CreatedBy, g.CreatedAt)
	}
	got, err := s.Game(ctx, g.GameID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Home.Name != "Hawks" || got.Away.Name != "Foxes" || got.Home.SpaceID == nil || got.Away.SpaceID != nil {
		t.Fatalf("round-trip mismatch: %+v", got)
	}
	if got.CreatedBy != "organizer-1" { // createdBy round-trips through the store
		t.Fatalf("createdBy not persisted: %q", got.CreatedBy)
	}
}

func TestUpdateGameSettings(t *testing.T) {
	s := NewService(NewDalgoStore(dalgo2memory.NewDB()))
	ctx := context.Background()
	g, err := s.CreateGame(ctx, "organizer-1",
		et.Side{Name: "Hawks"}, et.Side{Name: "Foxes"}, 1700000000000)
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	// Non-creator cannot edit.
	newMs := int64(1800000000000)
	loc := "Central Park, Field 3"
	if _, err := s.UpdateGameSettings(ctx, g.GameID, "intruder", &newMs, &loc); !errors.Is(err, ErrNotAuthorized) {
		t.Fatalf("expected ErrNotAuthorized for non-creator, got %v", err)
	}

	// Creator edits time + location.
	updated, err := s.UpdateGameSettings(ctx, g.GameID, "organizer-1", &newMs, &loc)
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	if updated.ScheduledMs != newMs || updated.Location != loc {
		t.Fatalf("update not applied: %+v", updated)
	}

	// Persisted.
	got, err := s.Game(ctx, g.GameID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.ScheduledMs != newMs || got.Location != loc {
		t.Fatalf("settings not persisted: %+v", got)
	}
	if got.CreatedBy != "organizer-1" {
		t.Fatalf("createdBy clobbered: %q", got.CreatedBy)
	}

	// Partial update: nil fields leave existing values untouched.
	loc2 := "Riverside Courts"
	if _, err := s.UpdateGameSettings(ctx, g.GameID, "organizer-1", nil, &loc2); err != nil {
		t.Fatalf("partial update: %v", err)
	}
	got2, _ := s.Game(ctx, g.GameID)
	if got2.ScheduledMs != newMs || got2.Location != loc2 {
		t.Fatalf("partial update wrong: %+v", got2)
	}

	// Unknown game.
	if _, err := s.UpdateGameSettings(ctx, "missing", "organizer-1", &newMs, &loc); !errors.Is(err, ErrGameNotFound) {
		t.Fatalf("expected ErrGameNotFound, got %v", err)
	}
}

func TestCreateGameValidation(t *testing.T) {
	s := NewService(NewDalgoStore(dalgo2memory.NewDB()))
	if _, err := s.CreateGame(context.Background(), "u", et.Side{Name: ""}, et.Side{Name: "B"}, 0); !errors.Is(err, ErrInvalidEvent) {
		t.Fatalf("expected invalid, got %v", err)
	}
}

func TestGetGameNotFound(t *testing.T) {
	s := NewService(NewDalgoStore(dalgo2memory.NewDB()))
	if _, err := s.Game(context.Background(), "missing"); !errors.Is(err, ErrGameNotFound) {
		t.Fatalf("expected ErrGameNotFound, got %v", err)
	}
}

func TestGameStoreUnconfigured(t *testing.T) {
	s := NewService(errStore{}) // errStore does not implement GameStore
	if _, err := s.CreateGame(context.Background(), "u", et.Side{Name: "A"}, et.Side{Name: "B"}, 0); err == nil {
		t.Fatal("expected error when game store not configured")
	}
	if _, err := s.Game(context.Background(), "x"); !errors.Is(err, ErrGameNotFound) {
		t.Fatalf("expected ErrGameNotFound, got %v", err)
	}
}

func TestCreateGameOverHTTP(t *testing.T) {
	srv := newServer()
	body, _ := json.Marshal(createGameRequest{Home: et.Side{Name: "Hawks", Colour: "#c00"}, Away: et.Side{Name: "Foxes", Colour: "#00c"}})
	req := httptest.NewRequest(http.MethodPost, "/v0/api4gameboard/games", bytes.NewReader(body))
	req.Header.Set("Authorization", testBearer)
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", rec.Code, rec.Body.String())
	}
	var g GameRecord
	_ = json.Unmarshal(rec.Body.Bytes(), &g)
	if g.GameID == "" {
		t.Fatal("no gameID returned")
	}
	if g.CreatedBy != "test-user" { // stamped from the authenticated caller
		t.Fatalf("createdBy not stamped from auth: %q", g.CreatedBy)
	}

	// GET the record back
	req = httptest.NewRequest(http.MethodGet, "/v0/api4gameboard/games/"+g.GameID, nil)
	rec = httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("get: %d", rec.Code)
	}

	// missing game → 404
	req = httptest.NewRequest(http.MethodGet, "/v0/api4gameboard/games/nope", nil)
	rec = httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
}

func TestUpdateGameOverHTTP(t *testing.T) {
	srv := newServer()
	body, _ := json.Marshal(createGameRequest{Home: et.Side{Name: "Hawks"}, Away: et.Side{Name: "Foxes"}})
	req := httptest.NewRequest(http.MethodPost, "/v0/api4gameboard/games", bytes.NewReader(body))
	req.Header.Set("Authorization", testBearer)
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", rec.Code, rec.Body.String())
	}
	var g GameRecord
	_ = json.Unmarshal(rec.Body.Bytes(), &g)

	// PUT schedule + location as the creator → 200, persisted.
	ms := int64(1800000000000)
	loc := "Wembley"
	body, _ = json.Marshal(updateGameRequest{ScheduledMs: &ms, Location: &loc})
	req = httptest.NewRequest(http.MethodPut, "/v0/api4gameboard/games/"+g.GameID, bytes.NewReader(body))
	req.Header.Set("Authorization", testBearer)
	rec = httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("patch: %d %s", rec.Code, rec.Body.String())
	}
	var updated GameRecord
	_ = json.Unmarshal(rec.Body.Bytes(), &updated)
	if updated.ScheduledMs != ms || updated.Location != loc {
		t.Fatalf("patch not applied: %+v", updated)
	}

	// PUT without auth → 401.
	req = httptest.NewRequest(http.MethodPut, "/v0/api4gameboard/games/"+g.GameID, bytes.NewReader(body))
	rec = httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}

	// PUT a missing game → 404.
	req = httptest.NewRequest(http.MethodPut, "/v0/api4gameboard/games/nope", bytes.NewReader(body))
	req.Header.Set("Authorization", testBearer)
	rec = httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
}

func TestCreateGameBadBodyOverHTTP(t *testing.T) {
	srv := newServer()
	// invalid JSON
	req := httptest.NewRequest(http.MethodPost, "/v0/api4gameboard/games", bytes.NewReader([]byte("nope")))
	req.Header.Set("Authorization", testBearer)
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
	// missing names
	body, _ := json.Marshal(createGameRequest{})
	req = httptest.NewRequest(http.MethodPost, "/v0/api4gameboard/games", bytes.NewReader(body))
	req.Header.Set("Authorization", testBearer)
	rec = httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

// TestCreateGameRequiresAuth — anonymous create is rejected 401.
func TestCreateGameRequiresAuth(t *testing.T) {
	srv := newServer()
	body, _ := json.Marshal(createGameRequest{Home: et.Side{Name: "A"}, Away: et.Side{Name: "B"}})
	req := httptest.NewRequest(http.MethodPost, "/v0/api4gameboard/games", bytes.NewReader(body))
	// no Authorization header
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous create: expected 401, got %d", rec.Code)
	}
}
