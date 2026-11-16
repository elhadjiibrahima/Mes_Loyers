import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_VERSION = 3;

/** Crée ou met à jour le schéma de la base locale (mode hors ligne). */
export async function migrateDb(db: SQLiteDatabase) {
  // À chaque ouverture : les clés étrangères (suppressions en cascade) ne sont
  // actives que si on les demande sur la connexion.
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  if (version >= DATABASE_VERSION) return;

  if (version === 0) {
    await db.execAsync(`
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

  if (version === 1) {
    // v2 : le loyer est rattaché au locataire (contrat), dates de début de loyer
    // et de sortie, caution, et regroupement des paiements multi-mois (lot).
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        ALTER TABLE locataires ADD COLUMN loyer INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE locataires ADD COLUMN debut_loyer TEXT;
        ALTER TABLE locataires ADD COLUMN date_sortie TEXT;
        ALTER TABLE locataires ADD COLUMN caution INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE locataires ADD COLUMN caution_rendue INTEGER;
        ALTER TABLE paiements ADD COLUMN lot TEXT;

        UPDATE locataires SET loyer = COALESCE((SELECT l.loyer FROM logements l WHERE l.id = locataires.logement_id), 0);
        UPDATE locataires SET debut_loyer = substr(date_entree, 1, 7);
        UPDATE locataires SET date_sortie = date('now') WHERE actif = 0;
        CREATE INDEX IF NOT EXISTS idx_paiements_locataire ON paiements(locataire_id, mois);
      `);
    });
    version = 2;
  }

  if (version === 2) {
    // v3 : jour d'échéance, historique des loyers (une augmentation ne réécrit
    // plus le passé) et dépenses par logement.
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        ALTER TABLE locataires ADD COLUMN jour_echeance INTEGER NOT NULL DEFAULT 5;

        CREATE TABLE IF NOT EXISTS loyers_historique (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          locataire_id INTEGER NOT NULL REFERENCES locataires(id) ON DELETE CASCADE,
          depuis TEXT NOT NULL,          -- AAAA-MM : premier mois au nouveau tarif
          montant INTEGER NOT NULL,
          UNIQUE (locataire_id, depuis)
        );
        INSERT OR IGNORE INTO loyers_historique (locataire_id, depuis, montant)
          SELECT id, debut_loyer, loyer FROM locataires;

        CREATE TABLE IF NOT EXISTS depenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          logement_id INTEGER REFERENCES logements(id) ON DELETE SET NULL,
          date TEXT NOT NULL,            -- AAAA-MM-JJ
          montant INTEGER NOT NULL,
          categorie TEXT NOT NULL,
          libelle TEXT,
          cree_le TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_depenses_date ON depenses(date);
        CREATE INDEX IF NOT EXISTS idx_paiements_date ON paiements(date_paiement);
      `);
    });
    version = 3;
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
