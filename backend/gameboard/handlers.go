package gameboard

import (
	"encoding/json"
	"errors"
	"net/http"

	et "github.com/sneat-co/gameboard-ext/backend/eventtimeline"
)

// Handler exposes the api4gameboard HTTP surface over a Service.
type Handler struct {
	svc *Service
}

// NewHandler wraps a Service in an HTTP Handler.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// Register wires the api4gameboard routes onto mux (Go 1.22 method+pattern mux).
//
//	POST /v0/api4gameboard/games/{gameID}/events  — append (authorized; idempotent)
//	GET  /v0/api4gameboard/games/{gameID}/events  — read the ordered log
//	GET  /v0/api4gameboard/games/{gameID}/state   — public deterministic fold
func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("POST /v0/api4gameboard/games/{gameID}/events", h.append)
	mux.HandleFunc("GET /v0/api4gameboard/games/{gameID}/events", h.list)
	mux.HandleFunc("GET /v0/api4gameboard/games/{gameID}/state", h.state)
}

// appendResponse mirrors the contract AppendEventResponse.
type appendResponse struct {
	EventID string `json:"eventID"`
	Applied bool   `json:"applied"`
	Status  string `json:"status"`
}

// append records an event. The event's `source` is taken from the (trusted)
// request body and checked against the authority matrix.
//
// STUB (recorded): a production deployment resolves `source` from the bearer
// token's identity → the game's per-game role (sneat-team/roles substrate),
// rather than trusting the body. That substrate is spec-only today.
func (h *Handler) append(w http.ResponseWriter, r *http.Request) {
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
