-- ─── FUNCTION ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

-- ─── USERS ──────────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('attendee', 'organizer', 'admin');

CREATE TABLE users (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(80)  NOT NULL,
  first_name    VARCHAR(80)  NOT NULL,
  last_name     VARCHAR(80)  NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT         NOT NULL,
  role          user_role    NOT NULL DEFAULT 'attendee',
  avatar_url    TEXT,
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role  ON users(role);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── ADMIN REQUESTS ─────────────────────────────────────
CREATE TABLE admin_requests (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  status     VARCHAR(20) NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── EVENTS ─────────────────────────────────────────────
CREATE TYPE event_status AS ENUM ('draft', 'published', 'cancelled', 'completed');
CREATE TYPE event_participant_status AS ENUM ('registered', 'waitlisted', 'cancelled', 'attended');

CREATE TABLE events (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title            VARCHAR(255) NOT NULL,
  description      TEXT,
  location         VARCHAR(255),
  address          TEXT,
  city             VARCHAR(100),
  postal_code      VARCHAR(20),
  country          VARCHAR(100) DEFAULT 'France',
  start_date       TIMESTAMPTZ  NOT NULL,
  end_date         TIMESTAMPTZ,
  max_participants INTEGER CHECK (max_participants IS NULL OR max_participants > 0),
  status           event_status NOT NULL DEFAULT 'draft',
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_created_by ON events(created_by);
CREATE INDEX idx_events_status     ON events(status);
CREATE INDEX idx_events_start_date ON events(start_date);

CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── EVENT PARTICIPANTS ──────────────────────────────────
CREATE TABLE event_participants (
  id            UUID                   PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID                   NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id       UUID                   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status        event_participant_status NOT NULL DEFAULT 'registered',
  registered_at TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX idx_event_participants_event ON event_participants(event_id);
CREATE INDEX idx_event_participants_user  ON event_participants(user_id);

CREATE TRIGGER trg_event_participants_updated_at
  BEFORE UPDATE ON event_participants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── FOLLOWS ────────────────────────────────────────────
CREATE TABLE follows (
  follower_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (follower_id, following_id)
);

-- ─── CONVERSATIONS ───────────────────────────────────────
CREATE TABLE conversations (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  title      VARCHAR(255),
  is_group   BOOLEAN      NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conversations_created_by ON conversations(created_by);

CREATE TRIGGER trg_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── CONVERSATION PARTICIPANTS ───────────────────────────
CREATE TABLE conversation_participants (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_read_at    TIMESTAMPTZ,
  UNIQUE (conversation_id, user_id)
);

CREATE INDEX idx_participants_conversation ON conversation_participants(conversation_id);
CREATE INDEX idx_participants_user         ON conversation_participants(user_id);

-- ─── MESSAGES ────────────────────────────────────────────
CREATE TABLE messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content         TEXT        NOT NULL,
  message_type    VARCHAR(20) NOT NULL DEFAULT 'text',
  is_edited       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_sender       ON messages(sender_id);
CREATE INDEX idx_messages_created_at   ON messages(created_at);

CREATE TRIGGER trg_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();