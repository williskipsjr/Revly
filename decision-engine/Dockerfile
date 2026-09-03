# --- build stage ---
FROM golang:1.23-alpine AS build
WORKDIR /src
# Copy module files first for layer caching. go.sum is optional in Phase 0 (no deps yet).
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -o /out/decision-engine ./cmd/server

# --- runtime stage ---
FROM alpine:3.20
RUN apk add --no-cache wget ca-certificates
COPY --from=build /out/decision-engine /usr/local/bin/decision-engine
EXPOSE 8080
ENTRYPOINT ["decision-engine"]
