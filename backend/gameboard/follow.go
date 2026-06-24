package gameboard

import (
	"context"
	"errors"
	"fmt"
	"reflect"

	"github.com/dal-go/dalgo/dal"
)

// ErrAnonymousFollow is returned when an anonymous (no-account) viewer tries to
// follow — anonymous viewers may read/share but cannot follow.
var ErrAnonymousFollow = errors.New("gameboard: follow requires an account")

// FollowTargetType is what is being followed.
type FollowTargetType string

const (
	FollowGame   FollowTargetType = "game"
	FollowTeam   FollowTargetType = "team"
	FollowPlayer FollowTargetType = "player"
)

// FollowEdge is an account → target follow relationship. In production this is
// written via the linkage facade behind account-gate; here it is stored as a
// dalgo edge at /ext/gameboard/follows/{accountID:targetType:targetID} so the
// account-gate semantics (anonymous cannot follow) are testable now.
type FollowEdge struct {
	AccountID  string           `json:"accountID"`
	TargetType FollowTargetType `json:"targetType"`
	TargetID   string           `json:"targetID"`
}

// FollowStore persists follow edges.
type FollowStore interface {
	PutFollow(ctx context.Context, e FollowEdge) error
	ListFollows(ctx context.Context, accountID string) ([]FollowEdge, error)
}

const followsCollection = "follows"

func followKey(e FollowEdge) *dal.Key {
	root := dal.NewKeyWithID(extCollection, moduleID)
	id := e.AccountID + ":" + string(e.TargetType) + ":" + e.TargetID
	return dal.NewKeyWithParentAndID(root, followsCollection, id)
}

type followDBO struct {
	AccountID  string           `json:"accountID"`
	TargetType FollowTargetType `json:"targetType"`
	TargetID   string           `json:"targetID"`
}

// PutFollow writes (idempotently — the composite id is the key) a follow edge.
func (s *dalgoStore) PutFollow(ctx context.Context, e FollowEdge) error {
	dbo := followDBO{AccountID: e.AccountID, TargetType: e.TargetType, TargetID: e.TargetID}
	return s.db.RunReadwriteTransaction(ctx, func(ctx context.Context, tx dal.ReadwriteTransaction) error {
		if err := tx.Set(ctx, dal.NewRecordWithData(followKey(e), &dbo)); err != nil {
			return fmt.Errorf("failed to write follow: %w", err)
		}
		return nil
	})
}

// ListFollows returns an account's follow edges.
func (s *dalgoStore) ListFollows(ctx context.Context, accountID string) ([]FollowEdge, error) {
	root := dal.NewKeyWithID(extCollection, moduleID)
	q := dal.From(dal.NewCollectionRef(followsCollection, "", root)).NewQuery().
		WhereField("accountID", dal.Equal, accountID).
		SelectIntoRecord(func() dal.Record {
			return dal.NewRecordWithIncompleteKey(followsCollection, reflect.String, new(followDBO))
		})
	records, err := dal.ExecuteQueryAndReadAllToRecords(ctx, q, s.db)
	if err != nil {
		return nil, fmt.Errorf("failed to list follows: %w", err)
	}
	out := make([]FollowEdge, 0, len(records))
	for _, rec := range records {
		dbo := rec.Data().(*followDBO)
		out = append(out, FollowEdge{AccountID: dbo.AccountID, TargetType: dbo.TargetType, TargetID: dbo.TargetID})
	}
	return out, nil
}

// Follow records that accountID follows a target. An empty accountID is an
// anonymous viewer and is rejected (account-gate). Verifies follow-requires-
// account + account-follow-records-edge.
func (s *Service) Follow(ctx context.Context, accountID string, t FollowTargetType, targetID string) error {
	if accountID == "" {
		return ErrAnonymousFollow
	}
	if s.follows == nil {
		return errors.New("gameboard: follow store not configured")
	}
	return s.follows.PutFollow(ctx, FollowEdge{AccountID: accountID, TargetType: t, TargetID: targetID})
}

// Follows lists an account's follow edges.
func (s *Service) Follows(ctx context.Context, accountID string) ([]FollowEdge, error) {
	if s.follows == nil {
		return nil, nil
	}
	return s.follows.ListFollows(ctx, accountID)
}
