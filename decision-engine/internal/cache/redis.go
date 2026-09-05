package cache

import (
	"bufio"
	"context"
	"fmt"
	"net"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"
)

// urlError marks a malformed redis:// URL (a config error), distinct from a connection failure
// (which is tolerated by falling back to the no-op cache).
type urlError struct{ err error }

func (e *urlError) Error() string { return e.err.Error() }

// redisClient is a minimal, concurrency-safe RESP client over a single reconnecting TCP
// connection. Commands are serialized by mu — sufficient for the low-QPS accelerator role;
// Redis is never on the critical correctness path (PLAN.md §13).
type redisClient struct {
	addr     string
	password string
	db       int
	dialTO   time.Duration

	mu    sync.Mutex
	conn  net.Conn
	rw    *bufio.ReadWriter
	alive bool
}

func dial(redisURL string) (*redisClient, error) {
	u, err := url.Parse(redisURL)
	if err != nil {
		return nil, &urlError{err}
	}
	if u.Scheme != "redis" && u.Scheme != "rediss" {
		return nil, &urlError{fmt.Errorf("cache: unsupported scheme %q", u.Scheme)}
	}
	host := u.Host
	if !strings.Contains(host, ":") {
		host += ":6379"
	}
	db := 0
	if p := strings.TrimPrefix(u.Path, "/"); p != "" {
		if n, err := strconv.Atoi(p); err == nil {
			db = n
		}
	}
	pw, _ := u.User.Password()
	c := &redisClient{addr: host, password: pw, db: db, dialTO: 2 * time.Second}
	// Best-effort initial connect; a failure leaves alive=false and callers fall back.
	_ = c.reconnect()
	return c, nil
}

// reconnect establishes a fresh connection and runs AUTH/SELECT as needed. Caller holds mu, or
// it is called before first use.
func (c *redisClient) reconnect() error {
	if c.conn != nil {
		_ = c.conn.Close()
		c.conn = nil
	}
	conn, err := net.DialTimeout("tcp", c.addr, c.dialTO)
	if err != nil {
		c.alive = false
		return err
	}
	c.conn = conn
	c.rw = bufio.NewReadWriter(bufio.NewReader(conn), bufio.NewWriter(conn))
	if c.password != "" {
		if _, err := c.doLocked("AUTH", c.password); err != nil {
			c.alive = false
			return err
		}
	}
	if c.db != 0 {
		if _, err := c.doLocked("SELECT", strconv.Itoa(c.db)); err != nil {
			c.alive = false
			return err
		}
	}
	c.alive = true
	return nil
}

func (c *redisClient) Available() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.alive
}

// do runs one command, reconnecting once on a transport error. Serialized by mu.
func (c *redisClient) do(args ...string) (any, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.conn == nil {
		if err := c.reconnect(); err != nil {
			return nil, err
		}
	}
	reply, err := c.doLocked(args...)
	if err != nil {
		// One reconnect+retry to ride over an idle-closed socket.
		if rerr := c.reconnect(); rerr != nil {
			return nil, err
		}
		return c.doLocked(args...)
	}
	return reply, nil
}

// doLocked writes a RESP array command and reads one reply. Caller holds mu and a live conn.
func (c *redisClient) doLocked(args ...string) (any, error) {
	if _, err := c.rw.WriteString("*" + strconv.Itoa(len(args)) + "\r\n"); err != nil {
		c.alive = false
		return nil, err
	}
	for _, a := range args {
		if _, err := c.rw.WriteString("$" + strconv.Itoa(len(a)) + "\r\n" + a + "\r\n"); err != nil {
			c.alive = false
			return nil, err
		}
	}
	if err := c.rw.Flush(); err != nil {
		c.alive = false
		return nil, err
	}
	return c.readReply()
}

// readReply parses a single RESP reply (simple string, error, integer, bulk string, or nil).
func (c *redisClient) readReply() (any, error) {
	line, err := c.rw.ReadString('\n')
	if err != nil {
		c.alive = false
		return nil, err
	}
	line = strings.TrimRight(line, "\r\n")
	if line == "" {
		return nil, fmt.Errorf("cache: empty reply")
	}
	switch line[0] {
	case '+':
		return line[1:], nil
	case '-':
		return nil, fmt.Errorf("cache: redis error: %s", line[1:])
	case ':':
		n, _ := strconv.ParseInt(line[1:], 10, 64)
		return n, nil
	case '$':
		n, _ := strconv.Atoi(line[1:])
		if n < 0 {
			return nil, nil // null bulk
		}
		buf := make([]byte, n+2) // include trailing CRLF
		if _, err := readFull(c.rw, buf); err != nil {
			c.alive = false
			return nil, err
		}
		return string(buf[:n]), nil
	default:
		return nil, fmt.Errorf("cache: unexpected reply %q", line)
	}
}

func readFull(r *bufio.ReadWriter, buf []byte) (int, error) {
	total := 0
	for total < len(buf) {
		n, err := r.Read(buf[total:])
		total += n
		if err != nil {
			return total, err
		}
	}
	return total, nil
}

func (c *redisClient) Ping(_ context.Context) error {
	_, err := c.do("PING")
	return err
}

func (c *redisClient) SetCooldown(_ context.Context, key string, ttl time.Duration) error {
	secs := int(ttl.Seconds())
	if secs < 1 {
		secs = 1
	}
	_, err := c.do("SET", key, "1", "EX", strconv.Itoa(secs))
	return err
}

func (c *redisClient) CooldownActive(_ context.Context, key string) (bool, error) {
	reply, err := c.do("EXISTS", key)
	if err != nil {
		return false, err
	}
	n, _ := reply.(int64)
	return n > 0, nil
}

func (c *redisClient) IncrCounter(_ context.Context, key string, ttl time.Duration) (int64, error) {
	reply, err := c.do("INCR", key)
	if err != nil {
		return 0, err
	}
	n, _ := reply.(int64)
	if n == 1 && ttl > 0 { // first write in the window → attach the TTL
		_, _ = c.do("EXPIRE", key, strconv.Itoa(int(ttl.Seconds())))
	}
	return n, nil
}

func (c *redisClient) GetCounter(_ context.Context, key string) (int64, error) {
	reply, err := c.do("GET", key)
	if err != nil {
		return 0, err
	}
	if reply == nil {
		return 0, nil
	}
	s, _ := reply.(string)
	n, _ := strconv.ParseInt(s, 10, 64)
	return n, nil
}

func (c *redisClient) Enqueue(_ context.Context, queue, payload string) error {
	_, err := c.do("LPUSH", queue, payload)
	return err
}

func (c *redisClient) Dequeue(_ context.Context, queue string) (string, bool, error) {
	reply, err := c.do("RPOP", queue)
	if err != nil {
		return "", false, err
	}
	if reply == nil {
		return "", false, nil
	}
	s, _ := reply.(string)
	return s, true, nil
}

func (c *redisClient) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.conn != nil {
		return c.conn.Close()
	}
	return nil
}
