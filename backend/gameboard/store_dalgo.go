package gameboard

import (
	"context"
	"fmt"

	"github.com/dal-go/dalgo/dal"
	et "github.com/sneat-co/gameboard-ext/backend/eventtimeline"
)

// gameboard is a ROOT/GLOBAL extension (not space-scoped): a game belongs to no
// space. The authoritative append-only event log is stored as a SINGLE document
// per game at
//
//	/ext/gameboard/games/{gameID}/log/eventlog
//
// holding the ordered events array. It is read and written by key only (Get /
// Set), never by query.
//
// Why a single doc rather than a doc-per-event subcollection: in production the
// sneat-go DB is wrapped by dalgo2memcachegae, which supports Get/Set/Exists but
// returns ErrNotSupported for queries (ExecuteQueryToRecordsReader). A
// subcollection list therefore cannot be read in prod. The event-timeline spec
// explicitly permits a materialised/consolidated projection, so the log is
// consolidated into one key-addressable doc. Idempotency is preserved by
// deduping on eventID within the array; append-only by never removing entries.
// (Game size — a few hundred small events — stays well under Firestore's 1 MiB
// document limit.)
const (
	extCollection   = "ext"
	moduleID        = "gameboard"
	gamesCollection = "games"
	logCollection   = "log"
	eventLogDocID   = "eventlog"
)

func gameKey(gameID string) *dal.Key {
	root := dal.NewKeyWithID(extCollection, moduleID)
	return dal.NewKeyWithParentAndID(root, gamesCollection, gameID)
}

func eventLogKey(gameID string) *dal.Key {
	return dal.NewKeyWithParentAndID(gameKey(gameID), logCollection, eventLogDocID)
}

// eventLogDBO is the persisted event log for a game (a single document).
type eventLogDBO struct {
	Events []et.Event `json:"events" firestore:"events"`
}

// dalgoStore is an EventStore backed by a dalgo dal.DB. Tests use dalgo's
// in-memory database (dalgo2memory); production wires a Firestore-backed dalgo
// DB (config swap, same store) at /ext/gameboard/...
type dalgoStore struct {
	db dal.DB
}

// NewDalgoStore returns an EventStore backed by the given dalgo database.
func NewDalgoStore(db dal.DB) EventStore { return &dalgoStore{db: db} }

// getEventLog loads the event-log doc within tx; returns an empty log if absent.
func getEventLog(ctx context.Context, tx dal.ReadSession, gameID string) (eventLogDBO, bool, error) {
	var dbo eventLogDBO
	rec := dal.NewRecordWithData(eventLogKey(gameID), &dbo)
	if err := tx.Get(ctx, rec); err != nil {
		if dal.IsNotFound(err) {
			return eventLogDBO{}, false, nil
		}
		return eventLogDBO{}, false, fmt.Errorf("failed to read event log: %w", err)
	}
	return dbo, true, nil
}

// Append idempotently appends e to the game's event-log doc. Within one
// read-write transaction it loads the log, discards the append if e.EventID is
// already present (added=false), otherwise appends and writes back.
func (s *dalgoStore) Append(ctx context.Context, gameID string, e et.Event) (bool, error) {
	added := false
	err := s.db.RunReadwriteTransaction(ctx, func(ctx context.Context, tx dal.ReadwriteTransaction) error {
		dbo, _, err := getEventLog(ctx, tx, gameID)
		if err != nil {
			return err
		}
		for i := range dbo.Events {
			if dbo.Events[i].EventID == e.EventID {
				return nil // already processed → idempotent no-op
			}
		}
		dbo.Events = append(dbo.Events, e)
		rec := dal.NewRecordWithData(eventLogKey(gameID), &dbo)
		rec.SetError(nil) // mark data valid for write (dalgo2firestore reads record.Data())
		if err := tx.Set(ctx, rec); err != nil {
			return fmt.Errorf("failed to append event: %w", err)
		}
		added = true
		return nil
	})
	if err != nil {
		return false, err
	}
	return added, nil
}

// List returns all events for gameID (unordered; callers fold via et.Order).
func (s *dalgoStore) List(ctx context.Context, gameID string) ([]et.Event, error) {
	var out []et.Event
	err := s.db.RunReadonlyTransaction(ctx, func(ctx context.Context, tx dal.ReadTransaction) error {
		dbo, _, err := getEventLog(ctx, tx, gameID)
		if err != nil {
			return err
		}
		out = dbo.Events
		return nil
	})
	if err != nil {
		return nil, err
	}
	return out, nil
}
