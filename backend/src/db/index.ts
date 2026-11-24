import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { SCHEMA_SQL } from './schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Data directory and database file path (supports Render persistent disk mount via DATA_DIR or DATABASE_PATH)
const defaultDataDir = path.resolve(__dirname, '../../data');
const dataDir = process.env.DATA_DIR || defaultDataDir;
const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'salon.sqlite');

const resolvedDir = path.dirname(dbPath);
if (!fs.existsSync(resolvedDir)) {
  fs.mkdirSync(resolvedDir, { recursive: true });
}

export const db = new DatabaseSync(dbPath);

// Enable foreign keys, WAL mode, and busy timeout for high concurrency
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA busy_timeout = 5000;');
db.exec('PRAGMA journal_mode = WAL;');

export function initDatabase() {
  db.exec(SCHEMA_SQL);
  seedInitialData();
  console.log('[Database] Initialized SQLite database successfully at', dbPath);
}

function seedInitialData() {
  // 1. Seed salon settings if not present
  const settingsCountStmt = db.prepare('SELECT COUNT(*) as count FROM salon_settings');
  const settingsCount = (settingsCountStmt.get() as { count: number }).count;
  if (settingsCount === 0) {
    const insertSetting = db.prepare('INSERT INTO salon_settings (key, value) VALUES (?, ?)');
    insertSetting.run('salon_name', 'Royal Cuts Lounge');
    insertSetting.run('tagline', 'Luxury Grooming for Gentlemen');
    insertSetting.run('address', '4th Floor, Silver Plaza, Ring Road, Surat');
    insertSetting.run('phone', '9876543210');
    insertSetting.run('opening_time', '09:00');
    insertSetting.run('closing_time', '23:00');
    insertSetting.run('is_open', '1');
    insertSetting.run('is_paused', '0');
  }

  // 2. Seed services if not present
  const servicesCountStmt = db.prepare('SELECT COUNT(*) as count FROM services');
  const servicesCount = (servicesCountStmt.get() as { count: number }).count;
  if (servicesCount === 0) {
    const insertService = db.prepare(
      'INSERT INTO services (id, name_en, name_gu, name_hi, duration_minutes, price, active, order_index) VALUES (?, ?, ?, ?, ?, ?, 1, ?)'
    );
    // Required dummy services from user prompt:
    // Haircut ₹150 – 30 minutes.
    // Beard Trim ₹80 – 15 minutes.
    // Hair Spa ₹400 – 45 minutes.
    // Hair Colour ₹600 – 60 minutes.
    // Facial ₹300 – 30 minutes.
    insertService.run('srv-1', 'Haircut', 'હેરકટ', 'बाल कटाई', 30, 150, 1);
    insertService.run('srv-2', 'Beard Trim', 'દાઢી સેટ', 'दाढ़ी ट्रिम', 15, 80, 2);
    insertService.run('srv-3', 'Hair Spa', 'હેર સ્પા', 'हेयर स्पा', 45, 400, 3);
    insertService.run('srv-4', 'Hair Colour', 'હેર કલર', 'हेयर कलर', 60, 600, 4);
    insertService.run('srv-5', 'Facial', 'ફેસિયલ', 'फेशियल', 30, 300, 5);
  }

  // 3. Seed barbers if not present
  const barbersCountStmt = db.prepare('SELECT COUNT(*) as count FROM barbers');
  const barbersCount = (barbersCountStmt.get() as { count: number }).count;
  if (barbersCount === 0) {
    const insertBarber = db.prepare(
      'INSERT INTO barbers (id, name, slug, active, working_today, status) VALUES (?, ?, ?, 1, 1, ?)'
    );
    // Required dummy barbers: Ravi, Amit and Imran
    insertBarber.run('barb-1', 'Ravi', 'ravi', 'Available');
    insertBarber.run('barb-2', 'Amit', 'amit', 'Available');
    insertBarber.run('barb-3', 'Imran', 'imran', 'Available');
  }
}
