package gameboard

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	et "github.com/sneat-co/gameboard-ext/backend/eventtimeline"
)

// UserIdentity verifies a request's Firebase bearer token and returns the
// authenticated user id, or ("", false) for an absent/invalid token (anonymous).
// The sneat-go gameboard module supplies the real Firebase-token adapter; tests
// pass a stub. (Same shape as the eventus module's UserIdentity.)
type UserIdentity interface {
	UserID(ctx context.Context, bearerToken string) (userID string, ok bool)
}

// Handler exposes the api4gameboard HTTP surface over a Service.
type Handler struct {
	svc      *Service
	identity UserIdentity
}

// NewHandler wraps a Service in an HTTP Handler. identity authenticates writes
// (append / create-game / follow); reads (state / events / game) stay public.
func NewHandler(svc *Service, identity UserIdentity) *Handler {
	return &Handler{svc: svc, identity: identity}
}

// bearerToken extracts the token from an "Authorization: Bearer <token>" header.
func bearerToken(r *http.Request) string {
	if t, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer "); ok {
		return strings.TrimSpace(t)
	}
	return ""
}

// requireUser authenticates the request. On an anonymous/invalid token it writes
// 401 and returns ("", false); the caller must return.
func (h *Handler) requireUser(w http.ResponseWriter, r *http.Request) (string, bool) {
	userID, ok := h.identity.UserID(r.Context(), bearerToken(r))
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthenticated", "sign in to perform this action")
		return "", false
	}
	return userID, true
}

// Register wires the api4gameboard routes onto mux (Go 1.22 method+pattern mux).
//
//	POST /v0/api4gameboard/games/{gameID}/events  — append (authorized; idempotent)
//	GET  /v0/api4gameboard/games/{gameID}/events  — read the ordered log
//	GET  /v0/api4gameboard/games/{gameID}/state   — public deterministic fold
func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("POST /v0/api4gameboard/games", h.createGame)
	mux.HandleFunc("GET /v0/api4gameboard/games/{gameID}", h.getGame)
	mux.HandleFunc("POST /v0/api4gameboard/games/{gameID}/events", h.append)
	mux.HandleFunc("GET /v0/api4gameboard/games/{gameID}/events", h.list)
	mux.HandleFunc("GET /v0/api4gameboard/games/{gameID}/state", h.state)
	mux.HandleFunc("POST /v0/api4gameboard/follows", h.follow)
}

// followRequest is the body of POST /v0/api4gameboard/follows.
type followRequest struct {
	TargetType FollowTargetType `json:"targetType"`
	TargetID   string           `json:"targetID"`
}

func (h *Handler) follow(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.requireUser(w, r) // anonymous viewers may read/share but not follow
	if !ok {
		return
	}
	var body followRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "invalid follow body")
		return
	}
	if err := h.svc.Follow(r.Context(), userID, body.TargetType, body.TargetID); err != nil {
		if errors.Is(err, ErrAnonymousFollow) {
			writeError(w, http.StatusUnauthorized, "account_required", "follow requires an account")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", "failed to follow")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"status": "following"})
}

// createGameRequest is the body of POST /v0/api4gameboard/games.
type createGameRequest struct {
	Home        et.Side `json:"home"`
	Away        et.Side `json:"away"`
	ScheduledMs int64   `json:"scheduledMs"`
}

func (h *Handler) createGame(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.requireUser(w, r)
	if !ok {
		return
	}
	var body createGameRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "invalid game body")
		return
	}
	g, err := h.svc.CreateGame(r.Context(), userID, body.Home, body.Away, body.ScheduledMs)
	if err != nil {
		if errors.Is(err, ErrInvalidEvent) {
			writeError(w, http.StatusBadRequest, "invalid_game", "both sides need a name")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", "failed to create game")
		return
	}
	writeJSON(w, http.StatusCreated, g)
}

func (h *Handler) getGame(w http.ResponseWriter, r *http.Request) {
	g, err := h.svc.Game(r.Context(), r.PathValue("gameID"))
	if err != nil {
		if errors.Is(err, ErrGameNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "game not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", "failed to read game")
		return
	}
	writeJSON(w, http.StatusOK, g)
}

// appendResponse mirrors the contract AppendEventResponse.
type appendResponse struct {
	EventID string `json:"eventID"`
	Applied bool   `json:"applied"`
	Status  string `json:"status"`
}

// append records an event. The caller MUST be authenticated (no anonymous
// writes). The event's `source` is checked against the authority matrix.
//
// STUB (recorded): the per-game ROLE check (does this user hold the scorekeeper/
// timekeeper/judge role for this game?) needs the sneat-team/roles substrate,
// which is spec-only; until then any authenticated user may append, and `source`
// is taken from the body. Authentication (this gate) closes the anonymous-write
// hole now; role authorization layers on when roles ships.
func (h *Handler) append(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.requireUser(w, r); !ok {
		return
	}
	gameID := r.PathValue("gameID")
	var e et.Event
	if err := json.NewDecoder(r.Body).Decode(&e); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "invalid event body")
		return
	}
	res, err := h.svc.Append(r.Context(), gameID, e)
	if err != nil {
		switch {
		case errors.Is(err, ErrUnauthorizedSource):
			writeError(w, http.StatusForbidden, "unauthorized_source", err.Error())
		case errors.Is(err, ErrInvalidEvent):
			writeError(w, http.StatusBadRequest, "invalid_event", err.Error())
		default:
			writeError(w, http.StatusInternalServerError, "internal", "failed to append event")
		}
		return
	}
	code := http.StatusCreated
	if !res.Applied {
		code = http.StatusOK // idempotent replay — already processed
	}
	writeJSON(w, code, appendResponse(res))
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	events, err := h.svc.Events(r.Context(), r.PathValue("gameID"))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "failed to read log")
		return
	}
	writeJSON(w, http.StatusOK, events)
}

func (h *Handler) state(w http.ResponseWriter, r *http.Request) {
	st, err := h.svc.State(r.Context(), r.PathValue("gameID"))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "failed to read state")
		return
	}
	writeJSON(w, http.StatusOK, st)
}

func writeJSON(w http.ResponseWriter, code int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(body)
}

func writeError(w http.ResponseWriter, code int, errCode, msg string) {
	writeJSON(w, code, map[string]string{"error": errCode, "message": msg})
}
