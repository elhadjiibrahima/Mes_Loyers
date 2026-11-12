import type { SQLiteDatabase } from 'expo-sqlite';

const DATABASE_VERSION = 1;

/** Crée ou met à jour le schéma de la base locale (mode hors ligne). */
export async function migrateDb(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  if (version >= DATABASE_VERSION) return;

  if (version === 0) {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS logements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom TEXT NOT NULL,
        adresse TEXT,
        loyer INTEGER NOT NULL,
        cree_le TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS locataires (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom TEXT NOT NULL,
        telephone TEXT,
        logement_id INTEGER REFERENCES logements(id) ON DELETE SET NULL,
        date_entree TEXT NOT NULL,
        actif INTEGER NOT NULL DEFAULT 1,
        cree_le TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS paiements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        locataire_id INTEGER NOT NULL REFERENCES locataires(id) ON DELETE CASCADE,
        mois TEXT NOT NULL,            -- format AAAA-MM
        montant INTEGER NOT NULL,
        date_paiement TEXT NOT NULL,   -- format AAAA-MM-JJ
        mode TEXT NOT NULL DEFAULT 'especes',
        cree_le TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_paiements_mois ON paiements(mois);

      CREATE TABLE IF NOT EXISTS parametres (
        cle TEXT PRIMARY KEY,
        valeur TEXT
      );
    `);
    version = 1;
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
