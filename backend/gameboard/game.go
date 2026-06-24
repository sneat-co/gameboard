package gameboard

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"

	"github.com/dal-go/dalgo/dal"
	et "github.com/sneat-co/gameboard-ext/backend/eventtimeline"
)

// ErrGameNotFound is returned when a game record does not exist.
var ErrGameNotFound = errors.New("gameboard: game not found")

// GameRecord is the game aggregate at /ext/gameboard/games/{gameID}. A game
// belongs to no space; each side is inline {name, colour, spaceID?} — spaceID is
// nil for an ad-hoc name (first-use-backprop fills it when a team space links).
type GameRecord struct {
	GameID      string         `json:"gameID"`
	Home        et.Side        `json:"home"`
	Away        et.Side        `json:"away"`
	ScheduledMs int64          `json:"scheduledMs"`
	Status      et.GameStatus  `json:"status"`
}

// GameStore persists the game aggregate document (the parent of the event log).
type GameStore interface {
	CreateGame(ctx context.Context, g GameRecord) error
	GetGame(ctx context.Context, gameID string) (GameRecord, error)
}

// gameRecordDBO is the persisted form, stored at the gameKey doc.
type gameRecordDBO struct {
	Home        et.Side       `json:"home"`
	Away        et.Side       `json:"away"`
	ScheduledMs int64         `json:"scheduledMs"`
	Status      et.GameStatus `json:"status"`
}

// CreateGame writes the game record at /ext/gameboard/games/{gameID}.
func (s *dalgoStore) CreateGame(ctx context.Context, g GameRecord) error {
	dbo := gameRecordDBO{Home: g.Home, Away: g.Away, ScheduledMs: g.ScheduledMs, Status: g.Status}
	return s.db.RunReadwriteTransaction(ctx, func(ctx context.Context, tx dal.ReadwriteTransaction) error {
		if err := tx.Set(ctx, dal.NewRecordWithData(gameKey(g.GameID), &dbo)); err != nil {
			return fmt.Errorf("failed to create game: %w", err)
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
	return GameRecord{GameID: gameID, Home: dbo.Home, Away: dbo.Away, ScheduledMs: dbo.ScheduledMs, Status: dbo.Status}, nil
}

// newGameID returns a random dashless hex id (same shape as event ids).
func newGameID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
