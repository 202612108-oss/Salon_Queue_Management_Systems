export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS salon_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_gu TEXT,
  name_hi TEXT,
  duration_minutes INTEGER NOT NULL,
  price INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS barbers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  working_today INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'Available',
  break_started_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS queue_entries (
  id TEXT PRIMARY KEY,
  token_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  preferred_barber_id TEXT,
  assigned_barber_id TEXT,
  status TEXT NOT NULL DEFAULT 'Waiting',
  source TEXT NOT NULL DEFAULT 'online',
  total_duration_minutes INTEGER NOT NULL,
  total_price INTEGER NOT NULL,
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  called_at TEXT,
  service_started_at TEXT,
  completed_at TEXT,
  cancelled_at TEXT,
  no_show_at TEXT,
  FOREIGN KEY (preferred_barber_id) REFERENCES barbers (id),
  FOREIGN KEY (assigned_barber_id) REFERENCES barbers (id)
);

CREATE TABLE IF NOT EXISTS queue_entry_services (
  entry_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  name_en TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  price INTEGER NOT NULL,
  PRIMARY KEY (entry_id, service_id),
  FOREIGN KEY (entry_id) REFERENCES queue_entries (id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services (id)
);

CREATE INDEX IF NOT EXISTS idx_queue_entries_status ON queue_entries (status);
CREATE INDEX IF NOT EXISTS idx_queue_entries_phone ON queue_entries (customer_phone);
`;
