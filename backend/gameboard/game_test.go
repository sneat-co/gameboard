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
	g, err := s.CreateGame(ctx,
		et.Side{Name: "Hawks", Colour: "#c00", SpaceID: &spaceID},
		et.Side{Name: "Foxes", Colour: "#00c"}, // ad-hoc, no spaceID
		1700000000000)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if g.GameID == "" || g.Status != et.StatusScheduled {
		t.Fatalf("bad record: %+v", g)
	}
	got, err := s.Game(ctx, g.GameID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Home.Name != "Hawks" || got.Away.Name != "Foxes" || got.Home.SpaceID == nil || got.Away.SpaceID != nil {
		t.Fatalf("round-trip mismatch: %+v", got)
	}
}

func TestCreateGameValidation(t *testing.T) {
	s := NewService(NewDalgoStore(dalgo2memory.NewDB()))
	if _, err := s.CreateGame(context.Background(), et.Side{Name: ""}, et.Side{Name: "B"}, 0); !errors.Is(err, ErrInvalidEvent) {
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
	if _, err := s.CreateGame(context.Background(), et.Side{Name: "A"}, et.Side{Name: "B"}, 0); err == nil {
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

func TestCreateGameBadBodyOverHTTP(t *testing.T) {
	srv := newServer()
	// invalid JSON
	req := httptest.NewRequest(http.MethodPost, "/v0/api4gameboard/games", bytes.NewReader([]byte("nope")))
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
	// missing names
	body, _ := json.Marshal(createGameRequest{})
	req = httptest.NewRequest(http.MethodPost, "/v0/api4gameboard/games", bytes.NewReader(body))
	rec = httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}
