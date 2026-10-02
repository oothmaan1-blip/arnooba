// Append-only list: each entry runs once, in order, inside a transaction.
// Never edit a migration that has shipped; add a new one instead.
export const MIGRATIONS: string[] = [
  `
  CREATE TABLE books (
    id            serial PRIMARY KEY,
    lang          text NOT NULL CHECK (lang IN ('ar', 'en')),
    title         text NOT NULL,
    author        text NOT NULL DEFAULT '',
    description   text NOT NULL DEFAULT '',
    category      text NOT NULL DEFAULT 'other',
    year          text NOT NULL DEFAULT '',
    cover_key     text,
    pdf_key       text,
    pdf_size      integer,
    epub_key      text,
    epub_size     integer,
    pages         integer,
    pages_approx  boolean NOT NULL DEFAULT false,
    source        text NOT NULL DEFAULT '',
    source_id     text UNIQUE,
    source_url    text NOT NULL DEFAULT '',
    license       text NOT NULL DEFAULT '',
    popularity    integer NOT NULL DEFAULT 0,
    downloads     integer NOT NULL DEFAULT 0,
    reads         integer NOT NULL DEFAULT 0,
    published     boolean NOT NULL DEFAULT true,
    search_text   text NOT NULL DEFAULT '',
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX books_lang_created_idx ON books (lang, created_at DESC);
  CREATE INDEX books_lang_category_idx ON books (lang, category);

  CREATE TABLE reports (
    id          serial PRIMARY KEY,
    book_id     integer REFERENCES books (id) ON DELETE CASCADE,
    reason      text NOT NULL,
    details     text NOT NULL DEFAULT '',
    contact     text NOT NULL DEFAULT '',
    status      text NOT NULL DEFAULT 'open',
    created_at  timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX reports_status_idx ON reports (status, created_at DESC);
  `,
  // 2: server-side admin sessions (revocable) and an audit trail.
  `
  CREATE TABLE admin_sessions (
    id            text PRIMARY KEY,
    pw_version    text NOT NULL,
    ip            text NOT NULL DEFAULT '',
    user_agent    text NOT NULL DEFAULT '',
    created_at    timestamptz NOT NULL DEFAULT now(),
    last_seen_at  timestamptz NOT NULL DEFAULT now(),
    expires_at    timestamptz NOT NULL
  );

  CREATE TABLE audit_log (
    id      serial PRIMARY KEY,
    at      timestamptz NOT NULL DEFAULT now(),
    event   text NOT NULL,
    ip      text NOT NULL DEFAULT '',
    detail  text NOT NULL DEFAULT ''
  );
  CREATE INDEX audit_log_event_at_idx ON audit_log (event, at DESC);
  CREATE INDEX audit_log_at_idx ON audit_log (at DESC);
  `,
  // 3: "made into a film" note and a verified-complete flag.
  `
  ALTER TABLE books ADD COLUMN film text NOT NULL DEFAULT '';
  ALTER TABLE books ADD COLUMN complete boolean NOT NULL DEFAULT false;
  UPDATE books SET complete = true WHERE source = 'Project Gutenberg';
  CREATE INDEX books_lang_film_idx ON books (lang) WHERE film <> '';
  `,
];
