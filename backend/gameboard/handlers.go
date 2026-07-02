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
//
// The game-invites routes (basketball organize/invite/RSVP MVP — see
// game_invite.go/game_invite_service.go) are distinct from the games/* routes
// above: a GameInviteRecord is a coach's own team's game/practice + roster +
// RSVPs, not a live-scored two-team match.
func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("POST /v0/api4gameboard/games", h.createGame)
	mux.HandleFunc("GET /v0/api4gameboard/games/{gameID}", h.getGame)
	mux.HandleFunc("PUT /v0/api4gameboard/games/{gameID}", h.updateGame)
	mux.HandleFunc("POST /v0/api4gameboard/games/{gameID}/events", h.append)
	mux.HandleFunc("GET /v0/api4gameboard/games/{gameID}/events", h.list)
	mux.HandleFunc("GET /v0/api4gameboard/games/{gameID}/state", h.state)
	mux.HandleFunc("POST /v0/api4gameboard/follows", h.follow)

	mux.HandleFunc("POST /v0/api4gameboard/game-invites", h.createGameInvite)
	mux.HandleFunc("GET /v0/api4gameboard/game-invites", h.listMyGameInvites)
	mux.HandleFunc("GET /v0/api4gameboard/game-invites/by-token/{token}", h.getGameInviteByToken)
	mux.HandleFunc("POST /v0/api4gameboard/game-invites/by-token/{token}/rsvp", h.submitRsvpByToken)
	mux.HandleFunc("GET /v0/api4gameboard/game-invites/{gameInviteID}", h.getGameInvite)
	mux.HandleFunc("POST /v0/api4gameboard/game-invites/{gameInviteID}/roster", h.addRosterPlayer)
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

// updateGameRequest is the body of PUT /v0/api4gameboard/games/{gameID}.
// Fields are pointers so an omitted field leaves the stored value untouched.
type updateGameRequest struct {
	ScheduledMs *int64  `json:"scheduledMs,omitempty"`
	Location    *string `json:"location,omitempty"`
}

// updateGame edits a game's schedule/location. The caller MUST be authenticated
// and be the game's creator (organizer); others get 403. Reads stay public.
func (h *Handler) updateGame(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.requireUser(w, r)
	if !ok {
		return
	}
	var body updateGameRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "invalid settings body")
		return
	}
	g, err := h.svc.UpdateGameSettings(r.Context(), r.PathValue("gameID"), userID, body.ScheduledMs, body.Location)
	if err != nil {
		switch {
		case errors.Is(err, ErrGameNotFound):
			writeError(w, http.StatusNotFound, "not_found", "game not found")
		case errors.Is(err, ErrNotAuthorized):
			writeError(w, http.StatusForbidden, "forbidden", "only the organizer can edit this game")
		default:
			writeError(w, http.StatusInternalServerError, "internal", "failed to update game")
		}
		return
	}
	writeJSON(w, http.StatusOK, g)
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

// --- game-invites (basketball organize/invite/RSVP MVP) ---

// gameInviteRosterPlayerRequest is the wire shape of one roster player before
// a playerId is assigned (mirrors CreateRosterPlayerInput).
type gameInviteRosterPlayerRequest struct {
	Name         string `json:"name"`
	Jersey       string `json:"jersey,omitempty"`
	GuardianName string `json:"guardianName,omitempty"`
}

// createGameInviteRequest is the body of POST /v0/api4gameboard/game-invites.
type createGameInviteRequest struct {
	Sport         Sport                           `json:"sport"`
	TeamName      string                          `json:"teamName"`
	OpponentName  string                          `json:"opponentName,omitempty"`
	ScheduledMs   int64                           `json:"scheduledMs"`
	Venue         string                          `json:"venue,omitempty"`
	PlayersNeeded int                             `json:"playersNeeded"`
	Recurring     RecurringSchedule               `json:"recurring"`
	OrganizerName string                          `json:"organizerName"`
	Roster        []gameInviteRosterPlayerRequest `json:"roster"`
}

// createGameInvite organizes a new game/practice for the caller's own team —
// the "organize a game" step (roadmap doc MVP item 1). AUTHENTICATED: the
// organizer must be signed in (organizerUID is stamped from the bearer token).
func (h *Handler) createGameInvite(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.requireUser(w, r)
	if !ok {
		return
	}
	var body createGameInviteRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "invalid game-invite body")
		return
	}
	roster := make([]CreateRosterPlayerInput, 0, len(body.Roster))
	for _, p := range body.Roster {
		roster = append(roster, CreateRosterPlayerInput{Name: p.Name, Jersey: p.Jersey, GuardianName: p.GuardianName})
	}
	g, err := h.svc.CreateGameInvite(r.Context(), userID, CreateGameInviteInput{
		Sport: body.Sport, TeamName: body.TeamName, OpponentName: body.OpponentName,
		ScheduledMs: body.ScheduledMs, Venue: body.Venue, PlayersNeeded: body.PlayersNeeded,
		Recurring: body.Recurring, OrganizerName: body.OrganizerName, Roster: roster,
	})
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidGameInvite):
			writeError(w, http.StatusBadRequest, "invalid_game_invite", "team name is required")
		default:
			writeError(w, http.StatusInternalServerError, "internal", "failed to create game invite")
		}
		return
	}
	writeJSON(w, http.StatusCreated, g)
}

// getGameInvite reads a game invite by id — the organizer/roster console
// read. PUBLIC — no auth required (account-gate: "reads are free").
func (h *Handler) getGameInvite(w http.ResponseWriter, r *http.Request) {
	g, err := h.svc.GameInvite(r.Context(), r.PathValue("gameInviteID"))
	if err != nil {
		if errors.Is(err, ErrGameInviteNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "game invite not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", "failed to read game invite")
		return
	}
	writeJSON(w, http.StatusOK, g)
}

// addRosterPlayer adds one player to an existing game invite's roster.
//
// PUBLIC/anon-friendly by design: this mirrors the frontend's existing
// anon-first UX — the organizer console's "add a player" AND the RSVP page's
// "not on the list? add my kid" both call this today with no sign-in. This
// knowingly relaxes account-gate's strict "every mutation requires an
// account" invariant until sneat.team's real roster/consent model ships
// (roadmap doc §7, "minor-consent granularity for the roster itself" —
// tracked as an open question, not silently ignored).
func (h *Handler) addRosterPlayer(w http.ResponseWriter, r *http.Request) {
	var body gameInviteRosterPlayerRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "invalid player body")
		return
	}
	g, err := h.svc.AddRosterPlayer(r.Context(), r.PathValue("gameInviteID"), CreateRosterPlayerInput{Name: body.Name, Jersey: body.Jersey, GuardianName: body.GuardianName})
	if err != nil {
		switch {
		case errors.Is(err, ErrGameInviteNotFound):
			writeError(w, http.StatusNotFound, "not_found", "game invite not found")
		case errors.Is(err, ErrInvalidGameInvite):
			writeError(w, http.StatusBadRequest, "invalid_player", "player name is required")
		default:
			writeError(w, http.StatusInternalServerError, "internal", "failed to add player")
		}
		return
	}
	writeJSON(w, http.StatusCreated, g)
}

// gameInviteByTokenResponse is the wire shape of
// GET /v0/api4gameboard/game-invites/by-token/{token}.
type gameInviteByTokenResponse struct {
	Game           GameInviteRecord `json:"game"`
	TargetPlayerID string           `json:"targetPlayerId,omitempty"`
}

// getGameInviteByToken resolves an anonymous invite-link visit. PUBLIC — no
// auth required; this is the anon-first RSVP page's entry read (mirrors
// eventius's links.Resolve(token) pattern, rsvp_handlers.go).
func (h *Handler) getGameInviteByToken(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.GameInviteByToken(r.Context(), r.PathValue("token"))
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidToken):
			writeError(w, http.StatusBadRequest, "invalid_token", "this invite link looks broken")
		case errors.Is(err, ErrGameInviteNotFound):
			writeError(w, http.StatusNotFound, "not_found", "game invite not found")
		default:
			writeError(w, http.StatusInternalServerError, "internal", "failed to resolve invite")
		}
		return
	}
	writeJSON(w, http.StatusOK, gameInviteByTokenResponse{Game: res.Game, TargetPlayerID: res.TargetPlayerID})
}

// submitRsvpByTokenRequest is the body of
// POST /v0/api4gameboard/game-invites/by-token/{token}/rsvp.
type submitRsvpByTokenRequest struct {
	PlayerID    string     `json:"playerId"`
	Status      RsvpStatus `json:"status"`
	RespondedBy string     `json:"respondedBy"`
	Note        string     `json:"note,omitempty"`
}

// submitRsvpByToken records a parent-proxy RSVP against a link token.
//
// ANONYMOUS-FRIENDLY (mirrors eventius's POST rsvp/{token}, rsvp_handlers.go
// submitRsvp): no bearer token is required to RSVP. If a valid bearer token IS
// supplied it is captured as respondedByUID purely for the best-effort
// participant-index enrichment (Service.SubmitRsvpByToken) — an absent or
// invalid token never blocks the RSVP.
func (h *Handler) submitRsvpByToken(w http.ResponseWriter, r *http.Request) {
	var body submitRsvpByTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "invalid rsvp body")
		return
	}
	respondedByUID, _ := h.identity.UserID(r.Context(), bearerToken(r)) // optional; "" when anonymous
	g, err := h.svc.SubmitRsvpByToken(r.Context(), r.PathValue("token"), respondedByUID, SubmitRsvpInput{
		PlayerID: body.PlayerID, Status: body.Status, RespondedBy: body.RespondedBy, Note: body.Note,
	})
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidToken):
			writeError(w, http.StatusBadRequest, "invalid_token", "this invite link looks broken")
		case errors.Is(err, ErrGameInviteNotFound):
			writeError(w, http.StatusNotFound, "not_found", "game invite not found")
		case errors.Is(err, ErrPlayerNotFound):
			writeError(w, http.StatusBadRequest, "player_not_found", "pick which kid this RSVP is for")
		case errors.Is(err, ErrInvalidGameInvite):
			writeError(w, http.StatusBadRequest, "invalid_rsvp", "invalid RSVP")
		default:
			writeError(w, http.StatusInternalServerError, "internal", "failed to save rsvp")
		}
		return
	}
	writeJSON(w, http.StatusCreated, g)
}

// listMyGameInvites lists the games the caller organizes + has RSVP'd to.
// AUTHENTICATED — an anonymous visitor has no stable identity to list
// "my games" against.
func (h *Handler) listMyGameInvites(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.requireUser(w, r)
	if !ok {
		return
	}
	games, err := h.svc.MyGameInvites(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "failed to list game invites")
		return
	}
	writeJSON(w, http.StatusOK, games)
}

func writeJSON(w http.ResponseWriter, code int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(body)
}

func writeError(w http.ResponseWriter, code int, errCode, msg string) {
	writeJSON(w, code, map[string]string{"error": errCode, "message": msg})
}
