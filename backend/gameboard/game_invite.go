package gameboard

// game_invite.go is the "basketball game-invites" backend the roadmap doc's
// §8.2 Phase 1 calls for: a coach organizes a game/practice for THEIR OWN
// team's season roster (distinct from game.go's GameRecord — two competing
// teams, live-scored), invites the roster by link, parents RSVP on behalf of
// their kid (the parent-proxy model), and the coach watches the roster fill.
//
// Root/global entity (not space-scoped), consolidated single-document storage
// — same rationale as store_dalgo.go's event log: the production DB is
// wrapped by dalgo2memcachegae, which supports Get/Set/Exists but not
// queries, so roster + RSVPs live inline on one doc rather than a
// subcollection. A team's roster is a handful to a few dozen kids, well under
// Firestore's 1 MiB document limit.
//
// Reuse decision (backstage/docs/roadmaps/gameboard-game-invites.md §8.2):
// this is a self-contained, gameboard-native persistence layer — NOT yet
// composed from calendarius/eventius/invitus/sneat.team, which are either
// unmounted, Go-in-process-only, or 501 stubs today. Each field group below
// carries a `Fable:` marker at the point a later phase would swap it for the
// real facade, mirroring the frontend's game-invite-contract.ts markers.
import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"

	"github.com/dal-go/dalgo/dal"
)

// ErrGameInviteNotFound is returned when a game-invite record does not exist.
var ErrGameInviteNotFound = errors.New("gameboard: game invite not found")

// ErrPlayerNotFound is returned when an RSVP targets a playerId not on the
// game invite's roster.
var ErrPlayerNotFound = errors.New("gameboard: player not on roster")

// ErrInvalidGameInvite is returned for structurally invalid input (missing
// team name, missing player name, unrecognised RSVP status).
var ErrInvalidGameInvite = errors.New("gameboard: invalid game invite")

// ErrInvalidToken is returned when an invite-link token cannot be decoded —
// malformed, foreign, or hand-edited.
var ErrInvalidToken = errors.New("gameboard: invalid invite token")

// Sport is the game's sport tag. Only basketball has real game-day semantics
// today (see gameboard-live's "Not Doing" list); others are placeholders that
// generalise the frontend's SPORTS picker.
type Sport string

// RecurringSchedule models (does not yet execute) a weekly recurring
// practice/game — roadmap doc §2.2.1's gap.
//
// Fable: swap to a Calendarius happening
// (`HappeningSlotTiming{Repeats:"weekly", Weekdays:[...]}`,
// calendarius/backend/dbo4calendarius/slot_time.go) once gameboard imports
// facade4calendarius.CreateHappening in-process (roadmap doc §8.2 Phase 2).
type RecurringSchedule struct {
	Enabled bool   `json:"enabled" firestore:"enabled"`
	Weekday string `json:"weekday,omitempty" firestore:"weekday,omitempty"`
	Time    string `json:"time,omitempty" firestore:"time,omitempty"`
}

// RosterPlayer is one kid on the team roster.
//
// Fable: swap to a `sneat-team` season-roster `contactus` person (jersey #,
// position, DOB) linked to a parent via a `linkage` parent↔child /
// guardian-role edge (backstage/spec/features/sports/sneat-team + roles).
// sneat.team's backend is a 501 stub today (roadmap doc §8.1), so
// GuardianName stays the free-text label the organizer/parent typed — no
// real contact or account behind it yet.
type RosterPlayer struct {
	PlayerID     string `json:"playerId" firestore:"playerId"`
	Name         string `json:"name" firestore:"name"`
	Jersey       string `json:"jersey,omitempty" firestore:"jersey,omitempty"`
	GuardianName string `json:"guardianName,omitempty" firestore:"guardianName,omitempty"`
}

// RsvpStatus is the attendance answer for one roster player.
type RsvpStatus string

const (
	RsvpGoing RsvpStatus = "going"
	RsvpMaybe RsvpStatus = "maybe"
	RsvpOut   RsvpStatus = "out"
)

// RsvpRecord is one parent's RSVP for one roster kid — the parent-proxy
// write-back the roadmap doc's §2.2.2 gap calls for.
//
// PlayerID is the CONTACT the response is about (the kid); RespondedBy is the
// ACTOR (the parent's display name) who submitted it — these are always kept
// distinct, never collapsed into one "who responded" field, because a minor
// player has no account of its own. RespondedByUID is set only when the
// submission carried a valid bearer token (mirrors eventius's `ViaAccount`,
// rsvp.go) — best-effort account-graph enrichment, never required.
//
// Fable: swap to rsvp-express's `sport-events` vertical's guardian-mediated
// response REQ, writing {contact, role, attendance} onto the calendarius
// happening (backstage/spec/.../rsvp-express/sport-events).
type RsvpRecord struct {
	PlayerID       string     `json:"playerId" firestore:"playerId"`
	Status         RsvpStatus `json:"status" firestore:"status"`
	RespondedBy    string     `json:"respondedBy" firestore:"respondedBy"`
	RespondedByUID string     `json:"respondedByUID,omitempty" firestore:"respondedByUID,omitempty"`
	RespondedAtMs  int64      `json:"respondedAt" firestore:"respondedAt"`
	Note           string     `json:"note,omitempty" firestore:"note,omitempty"`
}

// GameInviteRecord is the persisted aggregate for one organized game/practice
// + its roster + RSVPs, at /ext/gameboard/gameInvites/{gameInviteID}.
//
// JSON tags match the frontend's GameInviteDoc (game-invite-contract.ts)
// field-for-field so the HTTP response can be typed directly as a
// GameInviteDoc client-side, plus two organizer-authorization fields
// (OrganizerUID, SpaceID) the client doesn't need to see structurally but
// which travel over the wire anyway (extra JSON properties are harmless to a
// TypeScript consumer typing the response as GameInviteDoc).
type GameInviteRecord struct {
	GameInviteID string `json:"gameId"`
	Sport        Sport  `json:"sport"`
	TeamName     string `json:"teamName"`
	OpponentName string `json:"opponentName,omitempty"`
	ScheduledMs  int64  `json:"scheduledMs"`
	Venue        string `json:"venue,omitempty"`
	// PlayersNeeded is the team/coach-set target ("need 10"); the fill count
	// ("have 6") is a fold over Responses, computed client-side by
	// roster-fill.ts (or server-side — the roadmap doc leaves this either/or).
	PlayersNeeded int               `json:"playersNeeded"`
	Recurring     RecurringSchedule `json:"recurring"`
	OrganizerName string            `json:"organizerName"`
	// OrganizerUID is the authenticated creator (stamped server-side from the
	// bearer token, never client-supplied) — the space/roster owner once
	// sneat.team ships; SpaceID is the forward-compatible seam for that (empty
	// for an ad-hoc, non-team-linked game, mirroring et.Side.SpaceID in
	// game.go).
	OrganizerUID string                `json:"organizerUID"`
	SpaceID      string                `json:"spaceID,omitempty"`
	Roster       []RosterPlayer        `json:"roster"`
	Responses    map[string]RsvpRecord `json:"responses"`
	CreatedAtMs  int64                 `json:"createdAt"`
	UpdatedAtMs  int64                 `json:"updatedAt"`
}

// CreateRosterPlayerInput is a roster player before a playerId is assigned
// (mirrors the frontend's Omit<RosterPlayer, 'playerId'>).
type CreateRosterPlayerInput struct {
	Name         string `json:"name"`
	Jersey       string `json:"jersey,omitempty"`
	GuardianName string `json:"guardianName,omitempty"`
}

// CreateGameInviteInput is the body of "organize a game" (mirrors the
// frontend's CreateGameInviteInput in game-invite-store.ts).
type CreateGameInviteInput struct {
	Sport         Sport                     `json:"sport"`
	TeamName      string                    `json:"teamName"`
	OpponentName  string                    `json:"opponentName,omitempty"`
	ScheduledMs   int64                     `json:"scheduledMs"`
	Venue         string                    `json:"venue,omitempty"`
	PlayersNeeded int                       `json:"playersNeeded"`
	Recurring     RecurringSchedule         `json:"recurring"`
	OrganizerName string                    `json:"organizerName"`
	Roster        []CreateRosterPlayerInput `json:"roster"`
}

// SubmitRsvpInput is one parent-proxy RSVP submission (by token).
type SubmitRsvpInput struct {
	PlayerID    string
	Status      RsvpStatus
	RespondedBy string
	Note        string
}

// GameInviteStore persists the game-invite aggregate + the organizer/
// participant lookup indexes.
type GameInviteStore interface {
	CreateGameInvite(ctx context.Context, g GameInviteRecord) error
	GetGameInvite(ctx context.Context, gameInviteID string) (GameInviteRecord, error)
	// AddRosterPlayer appends player and returns the updated record. Returns
	// ErrGameInviteNotFound if gameInviteID doesn't exist.
	AddRosterPlayer(ctx context.Context, gameInviteID string, player RosterPlayer) (GameInviteRecord, error)
	// SubmitRsvp upserts rsvp keyed by rsvp.PlayerID (idempotent: resubmitting
	// for the same player overwrites rather than duplicates — the map key IS
	// the idempotency key). Returns ErrGameInviteNotFound /
	// ErrPlayerNotFound as appropriate.
	SubmitRsvp(ctx context.Context, gameInviteID string, rsvp RsvpRecord) (GameInviteRecord, error)
	// ListGameInvitesByOrganizer returns games organizerUID created.
	ListGameInvitesByOrganizer(ctx context.Context, organizerUID string) ([]GameInviteRecord, error)
	// ListGameInvitesByParticipant returns games accountID has RSVP'd to
	// (while authenticated) — the "invited" half of "my games".
	ListGameInvitesByParticipant(ctx context.Context, accountID string) ([]GameInviteRecord, error)
	// PutGameInviteParticipant idempotently records that accountID
	// participated in gameInviteID (best-effort index maintenance).
	PutGameInviteParticipant(ctx context.Context, accountID, gameInviteID string) error
}

const (
	gameInvitesCollection            = "gameInvites"
	gameInviteParticipantsCollection = "gameInviteParticipants"
)

func gameInviteKey(gameInviteID string) *dal.Key {
	root := dal.NewKeyWithID(extCollection, moduleID)
	return dal.NewKeyWithParentAndID(root, gameInvitesCollection, gameInviteID)
}

func gameInviteParticipantKey(accountID, gameInviteID string) *dal.Key {
	root := dal.NewKeyWithID(extCollection, moduleID)
	id := accountID + ":" + gameInviteID
	return dal.NewKeyWithParentAndID(root, gameInviteParticipantsCollection, id)
}

// gameInviteDBO is the persisted form of GameInviteRecord. Both `json` and
// `firestore` tags are set to the same names: dalgo2memory's WhereField
// filter (the in-memory test adapter) matches on the `json` tag, while
// dalgo2firestore (production) matches on `firestore` — same dual-tag
// convention as followDBO/eventLogDBO, required for ListGameInvitesByOrganizer
// to actually find rows under both adapters.
type gameInviteDBO struct {
	Sport         Sport                 `json:"sport" firestore:"sport"`
	TeamName      string                `json:"teamName" firestore:"teamName"`
	OpponentName  string                `json:"opponentName,omitempty" firestore:"opponentName,omitempty"`
	ScheduledMs   int64                 `json:"scheduledMs" firestore:"scheduledMs"`
	Venue         string                `json:"venue,omitempty" firestore:"venue,omitempty"`
	PlayersNeeded int                   `json:"playersNeeded" firestore:"playersNeeded"`
	Recurring     RecurringSchedule     `json:"recurring" firestore:"recurring"`
	OrganizerName string                `json:"organizerName" firestore:"organizerName"`
	OrganizerUID  string                `json:"organizerUID" firestore:"organizerUID"`
	SpaceID       string                `json:"spaceID,omitempty" firestore:"spaceID,omitempty"`
	Roster        []RosterPlayer        `json:"roster" firestore:"roster"`
	Responses     map[string]RsvpRecord `json:"responses" firestore:"responses"`
	CreatedAtMs   int64                 `json:"createdAt" firestore:"createdAt"`
	UpdatedAtMs   int64                 `json:"updatedAt" firestore:"updatedAt"`
}

func (g GameInviteRecord) toDBO() gameInviteDBO {
	return gameInviteDBO{
		Sport: g.Sport, TeamName: g.TeamName, OpponentName: g.OpponentName,
		ScheduledMs: g.ScheduledMs, Venue: g.Venue, PlayersNeeded: g.PlayersNeeded,
		Recurring: g.Recurring, OrganizerName: g.OrganizerName, OrganizerUID: g.OrganizerUID,
		SpaceID: g.SpaceID, Roster: g.Roster, Responses: g.Responses,
		CreatedAtMs: g.CreatedAtMs, UpdatedAtMs: g.UpdatedAtMs,
	}
}

func (dbo gameInviteDBO) toRecord(gameInviteID string) GameInviteRecord {
	responses := dbo.Responses
	if responses == nil {
		responses = map[string]RsvpRecord{}
	}
	roster := dbo.Roster
	if roster == nil {
		roster = []RosterPlayer{}
	}
	return GameInviteRecord{
		GameInviteID: gameInviteID, Sport: dbo.Sport, TeamName: dbo.TeamName, OpponentName: dbo.OpponentName,
		ScheduledMs: dbo.ScheduledMs, Venue: dbo.Venue, PlayersNeeded: dbo.PlayersNeeded,
		Recurring: dbo.Recurring, OrganizerName: dbo.OrganizerName, OrganizerUID: dbo.OrganizerUID,
		SpaceID: dbo.SpaceID, Roster: roster, Responses: responses,
		CreatedAtMs: dbo.CreatedAtMs, UpdatedAtMs: dbo.UpdatedAtMs,
	}
}

// gameInviteParticipantDBO is a {accountID, gameInviteID} edge — same
// composite-key-doc idea as followDBO, so "has accountID ever RSVP'd to
// gameInviteID" is idempotent and queryable by accountID. See gameInviteDBO's
// doc comment for why both `json` and `firestore` tags are needed.
type gameInviteParticipantDBO struct {
	AccountID    string `json:"accountID" firestore:"accountID"`
	GameInviteID string `json:"gameInviteID" firestore:"gameInviteID"`
}

// CreateGameInvite writes the game-invite record at
// /ext/gameboard/gameInvites/{gameInviteID}.
func (s *dalgoStore) CreateGameInvite(ctx context.Context, g GameInviteRecord) error {
	dbo := g.toDBO()
	return s.db.RunReadwriteTransaction(ctx, func(ctx context.Context, tx dal.ReadwriteTransaction) error {
		rec := dal.NewRecordWithData(gameInviteKey(g.GameInviteID), &dbo)
		rec.SetError(nil) // mark data valid for write (dalgo2firestore reads record.Data())
		if err := tx.Set(ctx, rec); err != nil {
			return fmt.Errorf("failed to create game invite: %w", err)
		}
		return nil
	})
}

// GetGameInvite reads the game-invite record.
func (s *dalgoStore) GetGameInvite(ctx context.Context, gameInviteID string) (GameInviteRecord, error) {
	var dbo gameInviteDBO
	err := s.db.RunReadonlyTransaction(ctx, func(ctx context.Context, tx dal.ReadTransaction) error {
		rec := dal.NewRecordWithData(gameInviteKey(gameInviteID), &dbo)
		if err := tx.Get(ctx, rec); err != nil {
			if dal.IsNotFound(err) {
				return ErrGameInviteNotFound
			}
			return fmt.Errorf("failed to read game invite: %w", err)
		}
		return nil
	})
	if err != nil {
		return GameInviteRecord{}, err
	}
	return dbo.toRecord(gameInviteID), nil
}

// AddRosterPlayer appends player within a single read-write transaction
// (read-modify-write over the consolidated doc — same shape as
// store_dalgo.go's Append over the event-log doc).
func (s *dalgoStore) AddRosterPlayer(ctx context.Context, gameInviteID string, player RosterPlayer) (GameInviteRecord, error) {
	var out GameInviteRecord
	err := s.db.RunReadwriteTransaction(ctx, func(ctx context.Context, tx dal.ReadwriteTransaction) error {
		var dbo gameInviteDBO
		rec := dal.NewRecordWithData(gameInviteKey(gameInviteID), &dbo)
		if err := tx.Get(ctx, rec); err != nil {
			if dal.IsNotFound(err) {
				return ErrGameInviteNotFound
			}
			return fmt.Errorf("failed to read game invite: %w", err)
		}
		dbo.Roster = append(dbo.Roster, player)
		dbo.UpdatedAtMs = nowFunc().UnixMilli()
		wrec := dal.NewRecordWithData(gameInviteKey(gameInviteID), &dbo)
		wrec.SetError(nil)
		if err := tx.Set(ctx, wrec); err != nil {
			return fmt.Errorf("failed to add roster player: %w", err)
		}
		out = dbo.toRecord(gameInviteID)
		return nil
	})
	if err != nil {
		return GameInviteRecord{}, err
	}
	return out, nil
}

// SubmitRsvp upserts rsvp keyed by rsvp.PlayerID within a single read-write
// transaction. Idempotent: resubmitting for the same player (e.g. a parent
// changing their mind, or a retried request) overwrites the same map entry
// rather than accumulating duplicates.
func (s *dalgoStore) SubmitRsvp(ctx context.Context, gameInviteID string, rsvp RsvpRecord) (GameInviteRecord, error) {
	var out GameInviteRecord
	err := s.db.RunReadwriteTransaction(ctx, func(ctx context.Context, tx dal.ReadwriteTransaction) error {
		var dbo gameInviteDBO
		rec := dal.NewRecordWithData(gameInviteKey(gameInviteID), &dbo)
		if err := tx.Get(ctx, rec); err != nil {
			if dal.IsNotFound(err) {
				return ErrGameInviteNotFound
			}
			return fmt.Errorf("failed to read game invite: %w", err)
		}
		found := false
		for _, p := range dbo.Roster {
			if p.PlayerID == rsvp.PlayerID {
				found = true
				break
			}
		}
		if !found {
			return ErrPlayerNotFound
		}
		if dbo.Responses == nil {
			dbo.Responses = map[string]RsvpRecord{}
		}
		dbo.Responses[rsvp.PlayerID] = rsvp
		dbo.UpdatedAtMs = nowFunc().UnixMilli()
		wrec := dal.NewRecordWithData(gameInviteKey(gameInviteID), &dbo)
		wrec.SetError(nil)
		if err := tx.Set(ctx, wrec); err != nil {
			return fmt.Errorf("failed to submit rsvp: %w", err)
		}
		out = dbo.toRecord(gameInviteID)
		return nil
	})
	if err != nil {
		return GameInviteRecord{}, err
	}
	return out, nil
}

// ListGameInvitesByOrganizer queries gameInvites where organizerUID == uid
// (same WhereField query pattern as follow.go's ListFollows).
func (s *dalgoStore) ListGameInvitesByOrganizer(ctx context.Context, organizerUID string) ([]GameInviteRecord, error) {
	root := dal.NewKeyWithID(extCollection, moduleID)
	q := dal.From(dal.NewCollectionRef(gameInvitesCollection, "", root)).NewQuery().
		WhereField("organizerUID", dal.Equal, organizerUID).
		SelectIntoRecord(func() dal.Record {
			return dal.NewRecordWithIncompleteKey(gameInvitesCollection, reflect.String, new(gameInviteDBO))
		})
	records, err := dal.ExecuteQueryAndReadAllToRecords(ctx, q, s.db)
	if err != nil {
		return nil, fmt.Errorf("failed to list organized game invites: %w", err)
	}
	out := make([]GameInviteRecord, 0, len(records))
	for _, rec := range records {
		dbo := rec.Data().(*gameInviteDBO)
		id, _ := rec.Key().ID.(string)
		out = append(out, dbo.toRecord(id))
	}
	return out, nil
}

// PutGameInviteParticipant idempotently records that accountID participated
// in gameInviteID (composite-key doc, same idea as follow.go's followKey).
func (s *dalgoStore) PutGameInviteParticipant(ctx context.Context, accountID, gameInviteID string) error {
	dbo := gameInviteParticipantDBO{AccountID: accountID, GameInviteID: gameInviteID}
	return s.db.RunReadwriteTransaction(ctx, func(ctx context.Context, tx dal.ReadwriteTransaction) error {
		rec := dal.NewRecordWithData(gameInviteParticipantKey(accountID, gameInviteID), &dbo)
		rec.SetError(nil)
		if err := tx.Set(ctx, rec); err != nil {
			return fmt.Errorf("failed to write game-invite participant index: %w", err)
		}
		return nil
	})
}

// ListGameInvitesByParticipant queries the participant index for accountID,
// then reads each referenced game invite. A stale index entry (the game was
// somehow removed) is skipped rather than failing the whole list.
func (s *dalgoStore) ListGameInvitesByParticipant(ctx context.Context, accountID string) ([]GameInviteRecord, error) {
	root := dal.NewKeyWithID(extCollection, moduleID)
	q := dal.From(dal.NewCollectionRef(gameInviteParticipantsCollection, "", root)).NewQuery().
		WhereField("accountID", dal.Equal, accountID).
		SelectIntoRecord(func() dal.Record {
			return dal.NewRecordWithIncompleteKey(gameInviteParticipantsCollection, reflect.String, new(gameInviteParticipantDBO))
		})
	records, err := dal.ExecuteQueryAndReadAllToRecords(ctx, q, s.db)
	if err != nil {
		return nil, fmt.Errorf("failed to list game-invite participant index: %w", err)
	}
	out := make([]GameInviteRecord, 0, len(records))
	for _, rec := range records {
		dbo := rec.Data().(*gameInviteParticipantDBO)
		g, err := s.GetGameInvite(ctx, dbo.GameInviteID)
		if err != nil {
			if errors.Is(err, ErrGameInviteNotFound) {
				continue
			}
			return nil, err
		}
		out = append(out, g)
	}
	return out, nil
}

// --- invite-link token (the hand-rolled invitus stand-in) ---

// inviteTokenPayload mirrors the frontend's InviteTokenPayload
// (invite-token.ts): {gameId, playerId?}.
type inviteTokenPayload struct {
	GameID   string `json:"gameId"`
	PlayerID string `json:"playerId,omitempty"`
}

// decodeInviteToken decodes the opaque link token minted client-side by
// invite-token.ts's encodeInviteToken (base64url JSON, unpadded — exactly
// base64.RawURLEncoding). Returns ok=false for a malformed/foreign token,
// never an error/panic — mirrors eventius's links.Resolve returning
// ErrLinkNotFound for an unresolvable token rather than blowing up.
//
// Fable: swap to invitus's InviteDbo (Type/Channel/TargetType/TargetIDs/Pin/
// Limit/Expires) once invitus is registered in sneat-go (roadmap doc §8.1 —
// today invitus.Extension() is never mounted).
func decodeInviteToken(token string) (gameID, playerID string, ok bool) {
	raw, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return "", "", false
	}
	var p inviteTokenPayload
	if err := json.Unmarshal(raw, &p); err != nil {
		return "", "", false
	}
	if p.GameID == "" {
		return "", "", false
	}
	return p.GameID, p.PlayerID, true
}
