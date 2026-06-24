package gameboard

import (
	"context"
	"errors"
	"testing"

	et "github.com/sneat-co/gameboard-ext/backend/eventtimeline"
)

func newSvc() *Service { return NewService(NewMemStore()) }

func scoreEvent(id string, ms int64, side et.TeamSide, pts int) et.Event {
	return et.Event{EventID: id, Type: et.EventScore, Source: et.SourceScorekeeper, WallClockMs: ms, Side: side, Points: pts}
}

// AC: only-authorized-source-appends — authorized append succeeds; unauthorized rejected.
func TestAppend_Authority(t *testing.T) {
	s := newSvc()
	ctx := context.Background()

	// scorekeeper may append a score
	if r, err := s.Append(ctx, "g1", scoreEvent("e1", 1, et.SideHome, 2)); err != nil || !r.Applied {
		t.Fatalf("authorized append failed: r=%+v err=%v", r, err)
	}
	// timekeeper may NOT append a score
	bad := scoreEvent("e2", 2, et.SideHome, 2)
	bad.Source = et.SourceTimekeeper
	if _, err := s.Append(ctx, "g1", bad); !errors.Is(err, ErrUnauthorizedSource) {
		t.Fatalf("expected ErrUnauthorizedSource, got %v", err)
	}
	// consensus may append plays when there is no crew
	cons := scoreEvent("e3", 3, et.SideAway, 3)
	cons.Source = et.SourceConsensus
	if r, err := s.Append(ctx, "g1", cons); err != nil || !r.Applied {
		t.Fatalf("consensus append failed: r=%+v err=%v", r, err)
	}
	// scorekeeper may NOT append a correction (judge-only)
	corr := et.Event{EventID: "e4", Type: et.EventCorrection, Source: et.SourceScorekeeper, WallClockMs: 4, CorrectionOf: "e1"}
	if _, err := s.Append(ctx, "g1", corr); !errors.Is(err, ErrUnauthorizedSource) {
		t.Fatalf("scorekeeper correction should be rejected, got %v", err)
	}
}

// AC: append-immutable-ordered — idempotent replay is a no-op.
func TestAppend_Idempotent(t *testing.T) {
	s := newSvc()
	ctx := context.Background()
	e := scoreEvent("dup", 1, et.SideHome, 2)
	r1, _ := s.Append(ctx, "g", e)
	r2, _ := s.Append(ctx, "g", e)
	if !r1.Applied || r1.Status != "appended" {
		t.Fatalf("first append: %+v", r1)
	}
	if r2.Applied || r2.Status != "already-processed" {
		t.Fatalf("replay should be already-processed: %+v", r2)
	}
	st, _ := s.State(ctx, "g")
	if st.Scores[et.SideHome] != 2 {
		t.Fatalf("replay double-counted: %d", st.Scores[et.SideHome])
	}
}

func TestAppend_InvalidRejected(t *testing.T) {
	s := newSvc()
	if _, err := s.Append(context.Background(), "g", et.Event{Type: et.EventScore}); !errors.Is(err, ErrInvalidEvent) {
		t.Fatalf("missing eventID should be invalid, got %v", err)
	}
	if _, err := s.Append(context.Background(), "g", et.Event{EventID: "x"}); !errors.Is(err, ErrInvalidEvent) {
		t.Fatalf("missing type should be invalid, got %v", err)
	}
}

// AC: state-is-deterministic-fold + record-access — Events ordered, State folds.
func TestEventsAndState(t *testing.T) {
	s := newSvc()
	ctx := context.Background()
	_, _ = s.Append(ctx, "g", scoreEvent("b", 20, et.SideHome, 3))
	_, _ = s.Append(ctx, "g", scoreEvent("a", 10, et.SideAway, 2))

	evs, err := s.Events(ctx, "g")
	if err != nil || len(evs) != 2 || evs[0].EventID != "a" || evs[1].EventID != "b" {
		t.Fatalf("events not ordered by wall-clock: %+v err=%v", evs, err)
	}
	st, _ := s.State(ctx, "g")
	if st.Scores[et.SideHome] != 3 || st.Scores[et.SideAway] != 2 {
		t.Fatalf("state fold wrong: %+v", st.Scores)
	}
}

// store error propagation
type errStore struct{}

func (errStore) Append(context.Context, string, et.Event) (bool, error) {
	return false, errors.New("boom")
}
func (errStore) List(context.Context, string) ([]et.Event, error) {
	return nil, errors.New("boom")
}

func TestStoreErrorsPropagate(t *testing.T) {
	s := NewService(errStore{})
	ctx := context.Background()
	if _, err := s.Append(ctx, "g", scoreEvent("e", 1, et.SideHome, 2)); err == nil {
		t.Fatal("expected append error")
	}
	if _, err := s.Events(ctx, "g"); err == nil {
		t.Fatal("expected events error")
	}
	if _, err := s.State(ctx, "g"); err == nil {
		t.Fatal("expected state error")
	}
}

func TestIsAuthorizedMatrix(t *testing.T) {
	cases := []struct {
		src et.Source
		typ et.EventType
		ok  bool
	}{
		{et.SourceScorekeeper, et.EventScore, true},
		{et.SourceScorekeeper, et.EventClock, false},
		{et.SourceTimekeeper, et.EventClock, true},
		{et.SourceTimekeeper, et.EventScore, false},
		{et.SourceJudge, et.EventCorrection, true},
		{et.SourceJudge, et.EventScore, false},
		{et.SourceConsensus, et.EventScore, true},
		{et.SourceConsensus, et.EventCorrection, false},
	}
	for _, c := range cases {
		if got := IsAuthorized(c.src, c.typ); got != c.ok {
			t.Errorf("IsAuthorized(%s,%s)=%v want %v", c.src, c.typ, got, c.ok)
		}
	}
}
