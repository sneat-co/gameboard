package gameboard

import (
	"context"
	"fmt"
	"reflect"

	"github.com/dal-go/dalgo/dal"
	et "github.com/sneat-co/gameboard-ext/backend/eventtimeline"
)

// gameboard is a ROOT/GLOBAL extension (not space-scoped): a game belongs to no
// space. The append-only event log lives at
//
//	/ext/gameboard/games/{gameID}/events/{eventID}
//
// keyed by the client-generated dashless eventID (the Firestore doc key, which
// doubles as the idempotency key).
const (
	extCollection    = "ext"
	moduleID         = "gameboard"
	gamesCollection  = "games"
	eventsCollection = "events"
)

func gameKey(gameID string) *dal.Key {
	root := dal.NewKeyWithID(extCollection, moduleID)
	return dal.NewKeyWithParentAndID(root, gamesCollection, gameID)
}

func eventKey(gameID, eventID string) *dal.Key {
	return dal.NewKeyWithParentAndID(gameKey(gameID), eventsCollection, eventID)
}

func eventsCollectionRef(gameID string) dal.CollectionRef {
	return dal.NewCollectionRef(eventsCollection, "", gameKey(gameID))
}

// eventDBO is the persisted representation of an event. GameID is denormalised
// onto the record so the list-by-game query can filter (the in-memory adapter
// keys collections by name only — same rationale as eventus's eventDBO).
type eventDBO struct {
	// firestore tag mirrors the json tag so the WhereField("gameID") list query
	// matches the stored field name on Firestore (the Firestore client ignores
	// json tags); dalgo2memory resolves via the json tag.
	GameID string `json:"gameID" firestore:"gameID"`
	et.Event
}

// dalgoStore is an EventStore backed by a dalgo dal.DB. Tests use dalgo's
// in-memory database (dalgo2memory); production wires a Firestore-backed dalgo
// DB (config swap, same store) at /ext/gameboard/...
type dalgoStore struct {
	db dal.DB
}

// NewDalgoStore returns an EventStore backed by the given dalgo database.
func NewDalgoStore(db dal.DB) EventStore { return &dalgoStore{db: db} }

// Append idempotently stores e under gameID keyed by e.EventID. Within one
// read-write transaction it checks for an existing doc at the eventID key; if
// present the append is discarded (added=false, no overwrite — the log is
// append-only and the id is the idempotency key), otherwise it is written.
func (s *dalgoStore) Append(ctx context.Context, gameID string, e et.Event) (bool, error) {
	added := false
	err := s.db.RunReadwriteTransaction(ctx, func(ctx context.Context, tx dal.ReadwriteTransaction) error {
		var existing eventDBO
		getRec := dal.NewRecordWithData(eventKey(gameID, e.EventID), &existing)
		if err := tx.Get(ctx, getRec); err != nil {
			if !dal.IsNotFound(err) {
				return fmt.Errorf("failed to probe event: %w", err)
			}
			// not found → first time → write it
			dbo := eventDBO{GameID: gameID, Event: e}
			rec := dal.NewRecordWithData(eventKey(gameID, e.EventID), &dbo)
			rec.SetError(nil) // mark data valid for write (dalgo2firestore reads record.Data())
			if err := tx.Set(ctx, rec); err != nil {
				return fmt.Errorf("failed to append event: %w", err)
			}
			added = true
		}
		return nil
	})
	if err != nil {
		return false, err
	}
	return added, nil
}

// List returns all events for gameID (unordered; callers fold via et.Order).
func (s *dalgoStore) List(ctx context.Context, gameID string) ([]et.Event, error) {
	q := dal.From(eventsCollectionRef(gameID)).NewQuery().
		WhereField("gameID", dal.Equal, gameID).
		SelectIntoRecord(func() dal.Record {
			return dal.NewRecordWithIncompleteKey(eventsCollection, reflect.String, new(eventDBO))
		})
	records, err := dal.ExecuteQueryAndReadAllToRecords(ctx, q, s.db)
	if err != nil {
		return nil, fmt.Errorf("failed to list events: %w", err)
	}
	out := make([]et.Event, 0, len(records))
	for _, rec := range records {
		dbo := rec.Data().(*eventDBO)
		out = append(out, dbo.Event)
	}
	return out, nil
}
