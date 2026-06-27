package gameboard

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/dal-go/dalgo/dal"
	et "github.com/sneat-co/gameboard-ext/backend/eventtimeline"
	"github.com/strongo/strongoapp/with"
)

// ErrGameNotFound is returned when a game record does not exist.
var ErrGameNotFound = errors.New("gameboard: game not found")

// nowFunc is a seam so tests can pin the created-at timestamp.
var nowFunc = time.Now

// GameRecord is the game aggregate at /ext/gameboard/games/{gameID}. A game
// belongs to no space; each side is inline {name, colour, spaceID?} — spaceID is
// nil for an ad-hoc name (first-use-backprop fills it when a team space links).
// CreatedFields (createdBy + createdAt) record the authenticated organizer, per
// the platform `with` convention (same as a Calendarius happening).
type GameRecord struct {
	GameID      string        `json:"gameID"`
	Home        et.Side       `json:"home"`
	Away        et.Side       `json:"away"`
	ScheduledMs int64         `json:"scheduledMs"`
	Location    string        `json:"location,omitempty"`
	Status      et.GameStatus `json:"status"`
	with.CreatedFields
}

// GameStore persists the game aggregate document (the parent of the event log).
type GameStore interface {
	CreateGame(ctx context.Context, g GameRecord) error
	GetGame(ctx context.Context, gameID string) (GameRecord, error)
	UpdateGame(ctx context.Context, g GameRecord) error
}

// gameRecordDBO is the persisted form, stored at the gameKey doc. with.CreatedFields
// carries firestore tags (createdBy/createdAt) so they round-trip by key.
type gameRecordDBO struct {
	Home        et.Side       `json:"home"`
	Away        et.Side       `json:"away"`
	ScheduledMs int64         `json:"scheduledMs"`
	Location    string        `json:"location,omitempty"`
	Status      et.GameStatus `json:"status"`
	with.CreatedFields
}

// CreateGame writes the game record at /ext/gameboard/games/{gameID}.
func (s *dalgoStore) CreateGame(ctx context.Context, g GameRecord) error {
	dbo := gameRecordDBO{Home: g.Home, Away: g.Away, ScheduledMs: g.ScheduledMs, Location: g.Location, Status: g.Status, CreatedFields: g.CreatedFields}
	return s.db.RunReadwriteTransaction(ctx, func(ctx context.Context, tx dal.ReadwriteTransaction) error {
		rec := dal.NewRecordWithData(gameKey(g.GameID), &dbo)
		rec.SetError(nil) // mark data valid for write (dalgo2firestore reads record.Data())
		if err := tx.Set(ctx, rec); err != nil {
			return fmt.Errorf("failed to create game: %w", err)
		}
		return nil
	})
}

// UpdateGame overwrites the game aggregate document with g (a full-record Set).
// Callers (Service.UpdateGameSettings) load, authorize, mutate, then write back.
func (s *dalgoStore) UpdateGame(ctx context.Context, g GameRecord) error {
	dbo := gameRecordDBO{Home: g.Home, Away: g.Away, ScheduledMs: g.ScheduledMs, Location: g.Location, Status: g.Status, CreatedFields: g.CreatedFields}
	return s.db.RunReadwriteTransaction(ctx, func(ctx context.Context, tx dal.ReadwriteTransaction) error {
		rec := dal.NewRecordWithData(gameKey(g.GameID), &dbo)
		rec.SetError(nil) // mark data valid for write (dalgo2firestore reads record.Data())
		if err := tx.Set(ctx, rec); err != nil {
			return fmt.Errorf("failed to update game: %w", err)
		}
		return nil
	})
}

// GetGame reads the game record.
func (s *dalgoStore) GetGame(ctx context.Context, gameID string) (GameRecord, error) {
	var dbo gameRecordDBO
	err := s.db.RunReadonlyTransaction(ctx, func(ctx context.Context, tx dal.ReadTransaction) error {
		rec := dal.NewRecordWithData(gameKey(gameID), &dbo)
		if err := tx.Get(ctx, rec); err != nil {
			if dal.IsNotFound(err) {
				return ErrGameNotFound
			}
			return fmt.Errorf("failed to read game: %w", err)
		}
		return nil
	})
	if err != nil {
		return GameRecord{}, err
	}
	return GameRecord{GameID: gameID, Home: dbo.Home, Away: dbo.Away, ScheduledMs: dbo.ScheduledMs, Location: dbo.Location, Status: dbo.Status, CreatedFields: dbo.CreatedFields}, nil
}

// newGameID returns a random dashless hex id (same shape as event ids).
func newGameID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
