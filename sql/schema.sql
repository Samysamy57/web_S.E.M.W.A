CREATE TYPE user_role AS ENUM ('attendee', 'organizer', 'admin');

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

<<<<<<< HEAD

CREATE TABLE conversations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         VARCHAR(255),
  is_group      BOOLEAN      NOT NULL DEFAULT FALSE,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conversations_created_by
  ON conversations(created_by);

CREATE TRIGGER trg_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();



CREATE TABLE conversation_participants (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID         NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id          UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_read_at     TIMESTAMPTZ,
  UNIQUE (conversation_id, user_id)
);

CREATE INDEX idx_participants_conversation
  ON conversation_participants(conversation_id);

CREATE INDEX idx_participants_user
  ON conversation_participants(user_id);





CREATE TABLE messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID         NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id        UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content          TEXT         NOT NULL,
  message_type     VARCHAR(20)  NOT NULL DEFAULT 'text',
  is_edited        BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation
  ON messages(conversation_id);

CREATE INDEX idx_messages_sender
  ON messages(sender_id);

CREATE INDEX idx_messages_created_at
  ON messages(created_at);

CREATE TRIGGER trg_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
=======
>>>>>>> 7d9a84a914d96001583e64e38b500f9fb7a0cc54
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();