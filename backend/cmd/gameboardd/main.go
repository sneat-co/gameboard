// Command gameboardd is the GameBoard.live backend service.
//
// It exposes the api4gameboard event-timeline endpoints (append / list / state)
// at the root extension path /ext/gameboard/... Persistence currently uses
// dalgo's in-memory database; the Firestore-backed dalgo DB and the bearer-token
// identity → per-game role (sneat-team/roles) adapter are the next bootstrap
// steps (same Service, swapped adapters).
package main

import (
	"log"
	"net/http"
	"os"

	"github.com/dal-go/dalgo/adapters/dalgo2memory"

	"github.com/sneat-co/gameboard/backend/gameboard"
)

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
	gameboard.NewHandler(gameboard.NewService(gameboard.NewDalgoStore(db))).Register(mux)

	log.Printf("gameboardd listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("gameboardd failed: %v", err)
	}
}
