package gameboard

import "context"

// testID is a test UserIdentity: any request carrying a non-empty Bearer token
// authenticates as "test-user"; an absent token is anonymous. (The real Firebase
// verification lives in the sneat-go gameboard module's adapter.)
type testID struct{}

func (testID) UserID(_ context.Context, bearerToken string) (string, bool) {
	if bearerToken == "" {
		return "", false
	}
	return "test-user", true
}

const testBearer = "Bearer test-token"
