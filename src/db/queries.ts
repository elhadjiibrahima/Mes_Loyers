import type { SQLiteDatabase } from 'expo-sqlite';

export type Logement = {
  id: number;
  nom: string;
  adresse: string | null;
  loyer: number;
  locataire_nom: string | null;
};

export type Locataire = {
  id: number;
  nom: string;
  telephone: string | null;
  logement_id: number | null;
  date_entree: string;
  actif: number;
  logement_nom: string | null;
  loyer: number | null;
};

export type Paiement = {
  id: number;
  locataire_id: number;
  mois: string;
  montant: number;
  date_paiement: string;
  mode: ModePaiement;
};

export type ModePaiement = 'especes' | 'orange_money' | 'mtn_momo' | 'virement';

export const MODES: { value: ModePaiement; label: string }[] = [
  { value: 'especes', label: 'Espèces' },
  { value: 'orange_money', label: 'Orange Money' },
  { value: 'mtn_momo', label: 'MTN MoMo' },
  { value: 'virement', label: 'Virement' },
];

export type StatutLoyer = 'paye' | 'partiel' | 'impaye';

export type LigneMois = {
  locataire_id: number;
  nom: string;
  telephone: string | null;
  logement_nom: string | null;
  du: number;
  paye: number;
  statut: StatutLoyer;
};

// ---------- Logements ----------

export function listLogements(db: SQLiteDatabase) {
  return db.getAllAsync<Logement>(`
    SELECT l.*, (
      SELECT nom FROM locataires t WHERE t.logement_id = l.id AND t.actif = 1 LIMIT 1
    ) AS locataire_nom
    FROM logements l ORDER BY l.nom COLLATE NOCASE`);
}

export function addLogement(db: SQLiteDatabase, data: { nom: string; adresse: string; loyer: number }) {
  return db.runAsync('INSERT INTO logements (nom, adresse, loyer) VALUES (?, ?, ?)', data.nom, data.adresse || null, data.loyer);
}

export function deleteLogement(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM logements WHERE id = ?', id);
}

// ---------- Locataires ----------

const SELECT_LOCATAIRE = `
  SELECT t.*, l.nom AS logement_nom, l.loyer AS loyer
  FROM locataires t LEFT JOIN logements l ON l.id = t.logement_id`;

export function listLocataires(db: SQLiteDatabase) {
  return db.getAllAsync<Locataire>(`${SELECT_LOCATAIRE} ORDER BY t.actif DESC, t.nom COLLATE NOCASE`);
}

export function getLocataire(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Locataire>(`${SELECT_LOCATAIRE} WHERE t.id = ?`, id);
}

export function addLocataire(
  db: SQLiteDatabase,
  data: { nom: string; telephone: string; logement_id: number | null; date_entree: string },
) {
  return db.runAsync(
    'INSERT INTO locataires (nom, telephone, logement_id, date_entree) VALUES (?, ?, ?, ?)',
    data.nom,
    data.telephone || null,
    data.logement_id,
    data.date_entree,
  );
}

export function setLocataireActif(db: SQLiteDatabase, id: number, actif: boolean) {
  return db.runAsync('UPDATE locataires SET actif = ? WHERE id = ?', actif ? 1 : 0, id);
}

// ---------- Paiements ----------

export function listPaiements(db: SQLiteDatabase, locataireId: number) {
  return db.getAllAsync<Paiement>(
    'SELECT * FROM paiements WHERE locataire_id = ? ORDER BY mois DESC, date_paiement DESC',
    locataireId,
  );
}

export function getPaiement(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Paiement>('SELECT * FROM paiements WHERE id = ?', id);
}

export function addPaiement(
  db: SQLiteDatabase,
  data: { locataire_id: number; mois: string; montant: number; date_paiement: string; mode: ModePaiement },
) {
  return db.runAsync(
    'INSERT INTO paiements (locataire_id, mois, montant, date_paiement, mode) VALUES (?, ?, ?, ?, ?)',
    data.locataire_id,
    data.mois,
    data.montant,
    data.date_paiement,
    data.mode,
  );
}

export function deletePaiement(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM paiements WHERE id = ?', id);
}

/** Situation de chaque locataire actif pour un mois donné (AAAA-MM). */
export async function situationDuMois(db: SQLiteDatabase, mois: string): Promise<LigneMois[]> {
  const rows = await db.getAllAsync<Omit<LigneMois, 'statut'>>(
    `SELECT t.id AS locataire_id, t.nom, t.telephone, l.nom AS logement_nom,
            COALESCE(l.loyer, 0) AS du,
            COALESCE((SELECT SUM(p.montant) FROM paiements p
                      WHERE p.locataire_id = t.id AND p.mois = ?), 0) AS paye
     FROM locataires t LEFT JOIN logements l ON l.id = t.logement_id
     WHERE t.actif = 1 AND substr(t.date_entree, 1, 7) <= ?
     ORDER BY t.nom COLLATE NOCASE`,
    mois,
    mois,
  );
  return rows.map((r) => ({
    ...r,
    statut: r.paye >= r.du && r.du > 0 ? 'paye' : r.paye > 0 ? 'partiel' : 'impaye',
  }));
}

// ---------- Paramètres ----------

export type Profil = { nom: string; telephone: string; ville: string };

export async function getProfil(db: SQLiteDatabase): Promise<Profil> {
  const rows = await db.getAllAsync<{ cle: string; valeur: string }>('SELECT * FROM parametres');
  const map = Object.fromEntries(rows.map((r) => [r.cle, r.valeur]));
  return { nom: map.nom ?? '', telephone: map.telephone ?? '', ville: map.ville ?? '' };
}

export async function saveProfil(db: SQLiteDatabase, profil: Profil) {
  await db.withTransactionAsync(async () => {
    for (const [cle, valeur] of Object.entries(profil)) {
      await db.runAsync('INSERT OR REPLACE INTO parametres (cle, valeur) VALUES (?, ?)', cle, valeur);
    }
  });
}
