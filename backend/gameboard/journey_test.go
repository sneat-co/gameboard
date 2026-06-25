package gameboard

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/dal-go/dalgo/adapters/dalgo2memory"
	et "github.com/sneat-co/gameboard-ext/backend/eventtimeline"
)

// newServer wires the full stack (Handler → Service → dalgo store) for tests.
func newServer() http.Handler {
	mux := http.NewServeMux()
	NewHandler(NewService(NewDalgoStore(dalgo2memory.NewDB())), testID{}).Register(mux)
	return mux
}

func post(t *testing.T, srv http.Handler, gameID string, e et.Event) *httptest.ResponseRecorder {
	t.Helper()
	body, _ := json.Marshal(e)
	req := httptest.NewRequest(http.MethodPost, "/v0/api4gameboard/games/"+gameID+"/events", bytes.NewReader(body))
	req.Header.Set("Authorization", testBearer) // writes require auth
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	return rec
}

func getState(t *testing.T, srv http.Handler, gameID string) et.State {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/v0/api4gameboard/games/"+gameID+"/state", nil)
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("GET state: %d %s", rec.Code, rec.Body.String())
	}
	var st et.State
	if err := json.Unmarshal(rec.Body.Bytes(), &st); err != nil {
		t.Fatalf("decode state: %v", err)
	}
	return st
}

// TestFullGameJourney drives a whole game through the real HTTP stack and
// asserts the public read surfaces equal the deterministic fold of the appended
// events — the umbrella full-lifecycle journey at the API layer.
func TestFullGameJourney(t *testing.T) {
	srv := newServer()
	const g = "game-1"
	tk := func(t et.EventType) et.Source { return sourceFor(t) }
	var ts int64
	next := func() int64 { ts++; return ts }

	// helper to append and require success
	must := func(e et.Event) {
		e.Source = tk(e.Type)
		e.WallClockMs = next()
		rec := post(t, srv, g, e)
		if rec.Code != http.StatusCreated {
			t.Fatalf("append %s: %d %s", e.Type, rec.Code, rec.Body.String())
		}
	}

	// 1. tip-off: go live, period 1, start the clock
	must(et.Event{EventID: "s1", Type: et.EventStatus, Status: et.StatusLive})
	must(et.Event{EventID: "p1", Type: et.EventPeriod, Period: 1})
	must(et.Event{EventID: "c1", Type: et.EventClock, ClockAction: et.ClockStart, GameClockMs: 600000})

	// 2. confirm lineups (player-on subs)
	for _, p := range []string{"h1", "h2", "h3", "h4", "h5"} {
		must(et.Event{EventID: "subH-" + p, Type: et.EventSubstitution, Side: et.SideHome, PlayerOn: p})
	}
	for _, p := range []string{"a1", "a2", "a3", "a4", "a5"} {
		must(et.Event{EventID: "subA-" + p, Type: et.EventSubstitution, Side: et.SideAway, PlayerOn: p})
	}

	// 3. scoring: home +2 (assist), +3; away FT, +2
	must(et.Event{EventID: "sc1", Type: et.EventScore, Side: et.SideHome, Points: 2, ScorerID: "h1", AssistID: "h2"})
	must(et.Event{EventID: "sc2", Type: et.EventScore, Side: et.SideHome, Points: 3, ScorerID: "h3"})
	must(et.Event{EventID: "sc3", Type: et.EventScore, Side: et.SideAway, Points: 1, ScorerID: "a1"})
	must(et.Event{EventID: "sc4", Type: et.EventScore, Side: et.SideAway, Points: 2, ScorerID: "a2"})

	// 4. fouls: away commits 5 → home in bonus
	for i := 0; i < 5; i++ {
		must(et.Event{EventID: "fa" + string(rune('a'+i)), Type: et.EventTeamFoul, Side: et.SideAway})
	}

	// 5. substitution (coach request → scorekeeper records): h6 on for h5
	must(et.Event{EventID: "sub-swap", Type: et.EventSubstitution, Side: et.SideHome, PlayerOff: "h5", PlayerOn: "h6"})

	// 6. timeout for home
	must(et.Event{EventID: "to1", Type: et.EventTimeout, Side: et.SideHome})

	// 7. possession to away
	must(et.Event{EventID: "pos1", Type: et.EventPossession, Side: et.SideAway})

	// 8. final
	must(et.Event{EventID: "fin", Type: et.EventStatus, Status: et.StatusFinal})

	// Assert the public read equals the fold.
	st := getState(t, srv, g)
	if st.Status != et.StatusFinal {
		t.Fatalf("status: %s", st.Status)
	}
	if st.Scores[et.SideHome] != 5 || st.Scores[et.SideAway] != 3 {
		t.Fatalf("score: %+v want home=5 away=3", st.Scores)
	}
	if st.TeamFouls[et.SideAway] != 5 || !st.InBonus(et.SideHome, 5) {
		t.Fatalf("bonus did not flip: fouls=%+v", st.TeamFouls)
	}
	if st.TimeoutsUsed[et.SideHome] != 1 {
		t.Fatalf("timeouts: %+v", st.TimeoutsUsed)
	}
	if st.Possession != et.SideAway {
		t.Fatalf("possession: %s", st.Possession)
	}
	// lineup after swap: h5 off, h6 on
	if !contains(st.OnCourt[et.SideHome], "h6") || contains(st.OnCourt[et.SideHome], "h5") {
		t.Fatalf("oncourt home after swap: %+v", st.OnCourt[et.SideHome])
	}

	// Record read exposes both clocks and total order.
	req := httptest.NewRequest(http.MethodGet, "/v0/api4gameboard/games/"+g+"/events", nil)
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	var log []et.Event
	if err := json.Unmarshal(rec.Body.Bytes(), &log); err != nil {
		t.Fatalf("decode log: %v", err)
	}
	for i := 1; i < len(log); i++ {
		if log[i-1].WallClockMs > log[i].WallClockMs {
			t.Fatalf("log not ordered at %d", i)
		}
	}
}

// TestUnauthorizedAppendRejectedOverHTTP — timekeeper cannot append a score.
func TestUnauthorizedAppendRejectedOverHTTP(t *testing.T) {
	srv := newServer()
	e := et.Event{EventID: "x", Type: et.EventScore, Source: et.SourceTimekeeper, WallClockMs: 1, Side: et.SideHome, Points: 2}
	if rec := post(t, srv, "g", e); rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d %s", rec.Code, rec.Body.String())
	}
}

// TestIdempotentReplayOverHTTP — a replayed append returns 200 already-processed.
func TestIdempotentReplayOverHTTP(t *testing.T) {
	srv := newServer()
	e := et.Event{EventID: "dup", Type: et.EventScore, Source: et.SourceScorekeeper, WallClockMs: 1, Side: et.SideHome, Points: 2}
	if rec := post(t, srv, "g", e); rec.Code != http.StatusCreated {
		t.Fatalf("first: %d", rec.Code)
	}
	rec := post(t, srv, "g", e)
	if rec.Code != http.StatusOK {
		t.Fatalf("replay should be 200, got %d", rec.Code)
	}
	var ar appendResponse
	_ = json.Unmarshal(rec.Body.Bytes(), &ar)
	if ar.Applied || ar.Status != "already-processed" {
		t.Fatalf("replay response: %+v", ar)
	}
}

func TestBadRequestBody(t *testing.T) {
	srv := newServer()
	req := httptest.NewRequest(http.MethodPost, "/v0/api4gameboard/games/g/events", bytes.NewReader([]byte("not-json")))
	req.Header.Set("Authorization", testBearer)
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

// TestAppendRequiresAuth — an anonymous append (no bearer token) is rejected 401,
// before any body processing. Reads stay public (covered by other tests).
func TestAppendRequiresAuth(t *testing.T) {
	srv := newServer()
	body, _ := json.Marshal(et.Event{EventID: "x", Type: et.EventScore, Source: et.SourceScorekeeper, WallClockMs: 1, Side: et.SideHome, Points: 2})
	req := httptest.NewRequest(http.MethodPost, "/v0/api4gameboard/games/g/events", bytes.NewReader(body))
	// no Authorization header
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous append: expected 401, got %d %s", rec.Code, rec.Body.String())
	}
}

func TestInvalidEventOverHTTP(t *testing.T) {
	srv := newServer()
	// missing eventID
	e := et.Event{Type: et.EventScore, Source: et.SourceScorekeeper}
	if rec := post(t, srv, "g", e); rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

func contains(xs []string, x string) bool {
	for _, v := range xs {
		if v == x {
			return true
		}
	}
	return false
}

// sourceFor returns the canonical authorized source for an event type (test helper).
func sourceFor(t et.EventType) et.Source {
	switch t {
	case et.EventScore, et.EventTeamFoul, et.EventSubstitution:
		return et.SourceScorekeeper
	case et.EventClock, et.EventPeriod, et.EventPossession, et.EventTimeout, et.EventStatus:
		return et.SourceTimekeeper
	default:
		return et.SourceJudge
	}
}
