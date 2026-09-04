module github.com/williskipsjr/razorpay-ai-buildathon/decision-engine

go 1.23

// PostgreSQL driver, used via the stdlib database/sql interface (see internal/db).
// Run `go mod tidy` once (needs network) to resolve transitive deps and populate go.sum.
require github.com/jackc/pgx/v5 v5.7.2

require (
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
	github.com/jackc/puddle/v2 v2.2.2 // indirect
	golang.org/x/crypto v0.31.0 // indirect
	golang.org/x/sync v0.10.0 // indirect
	golang.org/x/text v0.21.0 // indirect
)
