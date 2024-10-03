import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

// Open the database
const db = await open({
  filename: './feedback.db',
  driver: sqlite3.Database
});

await db.exec(`
  CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

await db.close();
