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
)

func TestFollow_RequiresAccount(t *testing.T) {
	s := NewService(NewDalgoStore(dalgo2memory.NewDB()))
	// anonymous (empty accountID) → rejected
	if err := s.Follow(context.Background(), "", FollowTeam, "team-1"); !errors.Is(err, ErrAnonymousFollow) {
		t.Fatalf("anonymous follow should be rejected, got %v", err)
	}
}

func TestFollow_RecordsEdge(t *testing.T) {
	s := NewService(NewDalgoStore(dalgo2memory.NewDB()))
	ctx := context.Background()
	if err := s.Follow(ctx, "acc-1", FollowTeam, "team-1"); err != nil {
		t.Fatalf("follow: %v", err)
	}
	if err := s.Follow(ctx, "acc-1", FollowPlayer, "p9"); err != nil {
		t.Fatalf("follow: %v", err)
	}
	// idempotent re-follow of the same edge
	if err := s.Follow(ctx, "acc-1", FollowTeam, "team-1"); err != nil {
		t.Fatalf("re-follow: %v", err)
	}
	edges, err := s.Follows(ctx, "acc-1")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(edges) != 2 {
		t.Fatalf("expected 2 distinct edges, got %d: %+v", len(edges), edges)
	}
}

func TestFollow_UnconfiguredStore(t *testing.T) {
	s := NewService(errStore{}) // no FollowStore
	if err := s.Follow(context.Background(), "acc", FollowGame, "g"); err == nil {
		t.Fatal("expected error when follow store not configured")
	}
	if edges, _ := s.Follows(context.Background(), "acc"); edges != nil {
		t.Fatalf("expected nil follows, got %+v", edges)
	}
}

func TestFollow_HTTP_AccountGate(t *testing.T) {
	srv := newServer()
	body, _ := json.Marshal(followRequest{TargetType: FollowTeam, TargetID: "team-1"})

	// anonymous → 401
	req := httptest.NewRequest(http.MethodPost, "/v0/api4gameboard/follows", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous follow: expected 401, got %d", rec.Code)
	}

	// signed-in (Bearer token) → 201
	req = httptest.NewRequest(http.MethodPost, "/v0/api4gameboard/follows", bytes.NewReader(body))
	req.Header.Set("Authorization", testBearer)
	rec = httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("signed-in follow: expected 201, got %d %s", rec.Code, rec.Body.String())
	}
}

func TestFollow_HTTP_BadBody(t *testing.T) {
	srv := newServer()
	req := httptest.NewRequest(http.MethodPost, "/v0/api4gameboard/follows", bytes.NewReader([]byte("x")))
	req.Header.Set("Authorization", testBearer)
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}
