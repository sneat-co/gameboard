// Package gameboard is the backend implementation of the GameBoard.live event
// timeline: it appends authorized events to a game's append-only log and serves
// the deterministic fold, all against the frozen gameboard-ext contract.
//
// Persistence is a port (EventStore). The production adapter is dalgo→Firestore
// at the global path /ext/gameboard/games/{gameID}/events/{eventID}; an
// in-memory adapter (memstore.go) backs the service-logic tests. The service
// logic (idempotency, authority, fold) is identical regardless of adapter.
package gameboard

import (
	"context"

	et "github.com/sneat-co/gameboard-ext/backend/eventtimeline"
)

// EventStore is the persistence port for a game's append-only event log.
//
// Append MUST be idempotent on EventID: appending an event whose EventID already
// exists is a no-op and reports added=false (the idempotency key doubles as the
// Firestore doc key, so a retried append never stores twice).
type EventStore interface {
	// Append stores e under game gameID keyed by e.EventID. Returns added=false
	// if an event with that EventID already exists.
	Append(ctx context.Context, gameID string, e et.Event) (added bool, err error)
	// List returns all events for gameID (unordered; callers fold via et.Order).
	List(ctx context.Context, gameID string) ([]et.Event, error)
}
