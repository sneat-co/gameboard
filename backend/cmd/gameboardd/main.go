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

	"github.com/dal-go/dalgo/adapters/dalgo2memory"

	"github.com/sneat-co/gameboard/backend/gameboard"
)

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

	// TODO(gameboard-mvp): replace dalgo2memory with a Firestore-backed dalgo DB.
	db := dalgo2memory.NewDB()
	gameboard.NewHandler(gameboard.NewService(gameboard.NewDalgoStore(db)), devIdentity{}).Register(mux)

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
