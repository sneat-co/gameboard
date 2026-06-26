// Command gameboardd is the GameBoard.live backend service.
//
// It exposes the api4gameboard event-timeline endpoints (append / list / state)
// at the root extension path /ext/gameboard/... Persistence currently uses
// dalgo's in-memory database; the Firestore-backed dalgo DB and the bearer-token
// identity → per-game role (sneat-team/roles) adapter are the next bootstrap
// steps (same Service, swapped adapters).
package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"cloud.google.com/go/firestore"
	"github.com/dal-go/dalgo/adapters/dalgo2memory"
	"github.com/dal-go/dalgo/dal"
	"github.com/dal-go/dalgo2firestore"

	"github.com/sneat-co/gameboard/backend/gameboard"
)

// defaultEmulatorProject is the demo Firestore project used for the local /
// CI Firestore emulator (matches firebase.json / .firebaserc at the repo root).
const defaultEmulatorProject = "demo-gameboard"

// newStore selects the persistence adapter. When FIRESTORE_EMULATOR_HOST is set
// (local dev / Playwright E2E / CI via `firebase emulators:exec`), it wires a
// Firestore-backed dalgo DB — the firestore client auto-detects the emulator
// from that env var. Otherwise it keeps the in-memory default. The Service and
// store logic are identical regardless of adapter (config swap, same store).
//
// The returned cleanup func must be deferred by the caller; for the in-memory
// adapter it is a no-op, for Firestore it closes the client.
func newStore(ctx context.Context) (gameboard.EventStore, func(), error) {
	if os.Getenv("FIRESTORE_EMULATOR_HOST") == "" {
		log.Printf("gameboardd store=memory (in-process)")
		return gameboard.NewDalgoStore(dalgo2memory.NewDB()), func() {}, nil
	}
	log.Printf("gameboardd store=firestore-emulator (FIRESTORE_EMULATOR_HOST=%s)", os.Getenv("FIRESTORE_EMULATOR_HOST"))
	projectID := os.Getenv("GOOGLE_CLOUD_PROJECT")
	if projectID == "" {
		projectID = os.Getenv("GCLOUD_PROJECT")
	}
	if projectID == "" {
		projectID = defaultEmulatorProject
	}
	client, err := firestore.NewClient(ctx, projectID)
	if err != nil {
		return nil, func() {}, err
	}
	var db dal.DB = dalgo2firestore.NewDatabase(projectID, client)
	return gameboard.NewDalgoStore(db), func() { _ = client.Close() }, nil
}

// devIdentity is a DEV-ONLY UserIdentity for the local gameboardd server (and
// the Playwright E2E, which has no login yet): every request is treated as a
// fixed dev user, so writes are permitted without real auth. PRODUCTION uses the
// real Firebase-token adapter wired in sneat-go's pkg/modules/gameboard.
type devIdentity struct{}

func (devIdentity) UserID(context.Context, string) (string, bool) { return "dev-user", true }

func main() {
	addr := os.Getenv("GAMEBOARD_ADDR")
	if addr == "" {
		addr = ":8080"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})

	store, cleanup, err := newStore(context.Background())
	if err != nil {
		log.Fatalf("gameboardd: failed to init store: %v", err)
	}
	defer cleanup()
	gameboard.NewHandler(gameboard.NewService(store), devIdentity{}).Register(mux)

	// Optionally serve a built SPA (used by the Playwright E2E for same-origin —
	// the app and API share an origin, so no CORS is needed). Unknown non-API
	// paths fall back to index.html.
	if staticDir := os.Getenv("GAMEBOARD_STATIC_DIR"); staticDir != "" {
		fs := http.FileServer(http.Dir(staticDir))
		mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
			if _, err := os.Stat(staticDir + r.URL.Path); os.IsNotExist(err) && r.URL.Path != "/" {
				http.ServeFile(w, r, staticDir+"/index.html")
				return
			}
			fs.ServeHTTP(w, r)
		})
	}

	log.Printf("gameboardd listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("gameboardd failed: %v", err)
	}
}
