const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'lifeos.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to SQLite database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

function initDB() {
  db.serialize(() => {
    // TRANSACTIONS
    db.run(`CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      desc TEXT,
      amount REAL,
      type TEXT,
      cat TEXT,
      date TEXT
    )`);

    // GOALS
    db.run(`CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      emoji TEXT,
      name TEXT,
      target REAL,
      current REAL DEFAULT 0,
      deadline TEXT,
      color TEXT
    )`);

    // TASKS
    db.run(`CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      status TEXT DEFAULT 'todo',
      priority TEXT,
      tag TEXT,
      due TEXT
    )`);

    // HABITS
    db.run(`CREATE TABLE IF NOT EXISTS habits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      emoji TEXT,
      name TEXT,
      color TEXT,
      streak INTEGER DEFAULT 0,
      logs TEXT DEFAULT '{}',
      repeat_days TEXT DEFAULT '[0,1,2,3,4,5,6]'
    )`);

    // Migration for existing databases
    db.run("ALTER TABLE habits ADD COLUMN repeat_days TEXT DEFAULT '[0,1,2,3,4,5,6]'", (err) => {
      // Ignore error if column already exists
    });


    // EVENTS
    db.run(`CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT,
      color TEXT NOT NULL
    )`);

    // DIET
    db.run(`CREATE TABLE IF NOT EXISTS diet (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meal_type TEXT NOT NULL,
      name TEXT NOT NULL,
      qty TEXT,
      calories INTEGER NOT NULL,
      protein REAL DEFAULT 0,
      carbs REAL DEFAULT 0,
      fat REAL DEFAULT 0,
      date TEXT NOT NULL
    )`);

    // WATER
    db.run(`CREATE TABLE IF NOT EXISTS water_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE NOT NULL,
      cups INTEGER DEFAULT 0
    )`);

    // SETTINGS
    db.run(`CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )`);

    // Initialize default settings
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('calorieGoal', '2000')`);


    console.log('Database tables initialized.');
  });
}

// Call initDB to ensure tables exist
initDB();

module.exports = db;
