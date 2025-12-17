export const migration = {
  name: '003_pokemon_data',
  up: `
    CREATE TABLE IF NOT EXISTS pokemon_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `,
  down: `
    DROP TABLE IF EXISTS pokemon_data;
  `
};
