package gameboard

import (
	"context"
	"sync"

	et "github.com/sneat-co/gameboard-ext/backend/eventtimeline"
)

// MemStore is an in-memory EventStore for tests and local runs. It enforces the
// same EventID idempotency the Firestore doc key gives in production.
type MemStore struct {
	mu     sync.Mutex
	games  map[string]map[string]et.Event // gameID -> eventID -> event
}

// NewMemStore returns an empty in-memory store.
func NewMemStore() *MemStore {
	return &MemStore{games: map[string]map[string]et.Event{}}
}

// Append implements EventStore.
func (m *MemStore) Append(_ context.Context, gameID string, e et.Event) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	g := m.games[gameID]
	if g == nil {
		g = map[string]et.Event{}
		m.games[gameID] = g
	}
	if _, exists := g[e.EventID]; exists {
		return false, nil
	}
	g[e.EventID] = e
	return true, nil
}

// List implements EventStore.
func (m *MemStore) List(_ context.Context, gameID string) ([]et.Event, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	g := m.games[gameID]
	out := make([]et.Event, 0, len(g))
	for _, e := range g {
		out = append(out, e)
	}
	return out, nil
}
