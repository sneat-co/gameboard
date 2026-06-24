package gameboard

import (
	"context"
	"errors"

	et "github.com/sneat-co/gameboard-ext/backend/eventtimeline"
)

// ErrUnauthorizedSource is returned when a source appends an event type it is
// not authorized for (the append is rejected, never stored).
var ErrUnauthorizedSource = errors.New("gameboard: unauthorized source for event type")

// ErrInvalidEvent is returned for a structurally invalid append (e.g. no EventID).
var ErrInvalidEvent = errors.New("gameboard: invalid event")

// Service appends authorized events and serves the deterministic fold.
type Service struct {
	store EventStore
}

// NewService wires a Service over an EventStore.
func NewService(store EventStore) *Service { return &Service{store: store} }

// AppendResult reports the outcome of an append.
type AppendResult struct {
	EventID string
	Applied bool   // false when the eventID was already processed (idempotent replay)
	Status  string // "appended" | "already-processed"
}

// Append validates authority, then idempotently appends e to game gameID.
// A replayed append (same EventID) is a no-op reported as already-processed.
func (s *Service) Append(ctx context.Context, gameID string, e et.Event) (AppendResult, error) {
	if e.EventID == "" || e.Type == "" {
		return AppendResult{}, ErrInvalidEvent
	}
	if !IsAuthorized(e.Source, e.Type) {
		return AppendResult{}, ErrUnauthorizedSource
	}
	added, err := s.store.Append(ctx, gameID, e)
	if err != nil {
		return AppendResult{}, err
	}
	if !added {
		return AppendResult{EventID: e.EventID, Applied: false, Status: "already-processed"}, nil
	}
	return AppendResult{EventID: e.EventID, Applied: true, Status: "appended"}, nil
}

// Events returns the complete log in canonical total order (both clocks intact).
func (s *Service) Events(ctx context.Context, gameID string) ([]et.Event, error) {
	raw, err := s.store.List(ctx, gameID)
	if err != nil {
		return nil, err
	}
	return et.Order(raw), nil
}

// State returns the deterministic projection (the public scoreboard read).
func (s *Service) State(ctx context.Context, gameID string) (et.State, error) {
	raw, err := s.store.List(ctx, gameID)
	if err != nil {
		return et.State{}, err
	}
	return et.Fold(raw), nil
}
