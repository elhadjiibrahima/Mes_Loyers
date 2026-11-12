import type { SQLiteDatabase } from 'expo-sqlite';

import { decalerMois, listeMois, minMois, moisCourant } from '@/lib/format';

export type Logement = {
  id: number;
  nom: string;
  adresse: string | null;
  loyer: number;
  locataire_id: number | null;
  locataire_nom: string | null;
};

export type Locataire = {
  id: number;
  nom: string;
  telephone: string | null;
  logement_id: number | null;
  date_entree: string;
  debut_loyer: string;
  date_sortie: string | null;
  loyer: number;
  caution: number;
  caution_rendue: number | null;
  logement_nom: string | null;
};

export type Paiement = {
  id: number;
  locataire_id: number;
  mois: string;
  montant: number;
  date_paiement: string;
  mode: ModePaiement;
  lot: string | null;
};

export type ModePaiement = 'especes' | 'orange_money' | 'mtn_momo' | 'virement' | 'caution';

/** Modes proposés à l'encaissement ("caution" est réservé aux retenues au départ). */
export const MODES: { value: ModePaiement; label: string }[] = [
  { value: 'especes', label: 'Espèces' },
  { value: 'orange_money', label: 'Orange Money' },
  { value: 'mtn_momo', label: 'MTN MoMo' },
  { value: 'virement', label: 'Virement' },
];

export function libelleMode(mode: ModePaiement) {
  return mode === 'caution' ? 'Retenue sur caution' : (MODES.find((m) => m.value === mode)?.label ?? mode);
}

export type StatutLoyer = 'paye' | 'partiel' | 'impaye';

// ---------- Logements ----------

export function listLogements(db: SQLiteDatabase) {
  return db.getAllAsync<Logement>(`
    SELECT l.*, t.id AS locataire_id, t.nom AS locataire_nom
    FROM logements l
    LEFT JOIN locataires t ON t.logement_id = l.id AND t.date_sortie IS NULL
    GROUP BY l.id
    ORDER BY l.nom COLLATE NOCASE`);
}

export function getLogement(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Logement>(
    `SELECT l.*, t.id AS locataire_id, t.nom AS locataire_nom
     FROM logements l
     LEFT JOIN locataires t ON t.logement_id = l.id AND t.date_sortie IS NULL
     WHERE l.id = ? GROUP BY l.id`,
    id,
  );
}

export function addLogement(db: SQLiteDatabase, data: { nom: string; adresse: string; loyer: number }) {
  return db.runAsync('INSERT INTO logements (nom, adresse, loyer) VALUES (?, ?, ?)', data.nom, data.adresse || null, data.loyer);
}

export function updateLogement(db: SQLiteDatabase, id: number, data: { nom: string; adresse: string; loyer: number }) {
  return db.runAsync(
    'UPDATE logements SET nom = ?, adresse = ?, loyer = ? WHERE id = ?',
    data.nom,
    data.adresse || null,
    data.loyer,
    id,
  );
}

/** Supprime un logement s'il est libre. Les anciens locataires gardent leur historique. */
export async function deleteLogement(db: SQLiteDatabase, id: number) {
  const occupe = await db.getFirstAsync('SELECT 1 FROM locataires WHERE logement_id = ? AND date_sortie IS NULL', id);
  if (occupe) throw new Error('occupe');
  await db.runAsync('DELETE FROM logements WHERE id = ?', id);
}

// ---------- Locataires ----------

const SELECT_LOCATAIRE = `
  SELECT t.id, t.nom, t.telephone, t.logement_id, t.date_entree, t.debut_loyer, t.date_sortie,
         t.loyer, t.caution, t.caution_rendue, l.nom AS logement_nom
  FROM locataires t LEFT JOIN logements l ON l.id = t.logement_id`;

export function listLocataires(db: SQLiteDatabase) {
  return db.getAllAsync<Locataire>(`${SELECT_LOCATAIRE} ORDER BY (t.date_sortie IS NOT NULL), t.nom COLLATE NOCASE`);
}

export function getLocataire(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Locataire>(`${SELECT_LOCATAIRE} WHERE t.id = ?`, id);
}

export type LocataireForm = {
  nom: string;
  telephone: string;
  logement_id: number | null;
  date_entree: string;
  debut_loyer: string;
  loyer: number;
  caution: number;
};

async function logementLibre(db: SQLiteDatabase, logementId: number | null, saufLocataire?: number) {
  if (logementId == null) return true;
  const r = await db.getFirstAsync(
    'SELECT 1 FROM locataires WHERE logement_id = ? AND date_sortie IS NULL AND id != ?',
    logementId,
    saufLocataire ?? -1,
  );
  return !r;
}

export async function addLocataire(db: SQLiteDatabase, d: LocataireForm) {
  if (!(await logementLibre(db, d.logement_id))) throw new Error('occupe');
  return db.runAsync(
    `INSERT INTO locataires (nom, telephone, logement_id, date_entree, debut_loyer, loyer, caution)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    d.nom,
    d.telephone || null,
    d.logement_id,
    d.date_entree,
    d.debut_loyer,
    d.loyer,
    d.caution,
  );
}

export async function updateLocataire(db: SQLiteDatabase, id: number, d: LocataireForm) {
  if (!(await logementLibre(db, d.logement_id, id))) throw new Error('occupe');
  return db.runAsync(
    `UPDATE locataires SET nom = ?, telephone = ?, logement_id = ?, date_entree = ?, debut_loyer = ?,
       loyer = ?, caution = ? WHERE id = ?`,
    d.nom,
    d.telephone || null,
    d.logement_id,
    d.date_entree,
    d.debut_loyer,
    d.loyer,
    d.caution,
    id,
  );
}

/**
 * Enregistre le départ. Si `deduireArrieres`, les mois impayés sont soldés par une
 * retenue sur la caution (dans la limite de la caution).
 */
export async function enregistrerDepart(
  db: SQLiteDatabase,
  loc: Locataire,
  opts: { date_sortie: string; caution_rendue: number; deduireArrieres: boolean },
) {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE locataires SET date_sortie = ?, caution_rendue = ?, actif = 0 WHERE id = ?',
      opts.date_sortie,
      opts.caution_rendue,
      loc.id,
    );
    if (opts.deduireArrieres) {
      const fiche = await ficheSolde(db, { ...loc, date_sortie: opts.date_sortie });
      let dispo = loc.caution;
      const lot = `caution-${loc.id}-${Date.now()}`;
      for (const m of fiche.moisImpayes) {
        if (dispo <= 0) break;
        const montant = Math.min(m.reste, dispo);
        dispo -= montant;
        await db.runAsync(
          `INSERT INTO paiements (locataire_id, mois, montant, date_paiement, mode, lot) VALUES (?, ?, ?, ?, 'caution', ?)`,
          loc.id,
          m.mois,
          montant,
          opts.date_sortie,
          lot,
        );
      }
    }
  });
}

/** Annule un départ si le logement est toujours libre. */
export async function annulerDepart(db: SQLiteDatabase, loc: Locataire) {
  if (!(await logementLibre(db, loc.logement_id, loc.id))) throw new Error('occupe');
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM paiements WHERE locataire_id = ? AND mode = 'caution'", loc.id);
    await db.runAsync('UPDATE locataires SET date_sortie = NULL, caution_rendue = NULL, actif = 1 WHERE id = ?', loc.id);
  });
}

// ---------- Paiements ----------

export function listPaiements(db: SQLiteDatabase, locataireId: number) {
  return db.getAllAsync<Paiement>(
    'SELECT * FROM paiements WHERE locataire_id = ? ORDER BY mois DESC, id DESC',
    locataireId,
  );
}

export function listPaiementsLot(db: SQLiteDatabase, paiement: Paiement) {
  if (!paiement.lot) return Promise.resolve([paiement]);
  return db.getAllAsync<Paiement>('SELECT * FROM paiements WHERE lot = ? ORDER BY mois', paiement.lot);
}

export async function deletePaiementLot(db: SQLiteDatabase, paiement: Paiement) {
  if (paiement.lot) await db.runAsync('DELETE FROM paiements WHERE lot = ?', paiement.lot);
  else await db.runAsync('DELETE FROM paiements WHERE id = ?', paiement.id);
}

/** Total déjà payé par mois pour un locataire. */
async function payeParMois(db: SQLiteDatabase, locataireId: number) {
  const rows = await db.getAllAsync<{ mois: string; total: number }>(
    'SELECT mois, SUM(montant) AS total FROM paiements WHERE locataire_id = ? GROUP BY mois',
    locataireId,
  );
  return new Map(rows.map((r) => [r.mois, r.total]));
}

export type Repartition = { mois: string; montant: number };

/**
 * Répartit un montant sur les mois à partir de `premierMois` : chaque mois reçoit
 * ce qui manque pour atteindre le loyer ; le surplus éventuel va sur le dernier mois.
 */
export async function repartirPaiement(
  db: SQLiteDatabase,
  loc: Pick<Locataire, 'id' | 'loyer'>,
  premierMois: string,
  montant: number,
): Promise<Repartition[]> {
  const deja = await payeParMois(db, loc.id);
  const res: Repartition[] = [];
  let reste = montant;
  let mois = premierMois;
  for (let i = 0; i < 36 && reste > 0; i++, mois = decalerMois(mois, 1)) {
    const manque = Math.max(loc.loyer - (deja.get(mois) ?? 0), 0);
    if (manque === 0) continue;
    const part = Math.min(manque, reste);
    res.push({ mois, montant: part });
    reste -= part;
  }
  if (reste > 0) {
    if (res.length) res[res.length - 1].montant += reste;
    else res.push({ mois: premierMois, montant: reste });
  }
  return res;
}

export async function addPaiements(
  db: SQLiteDatabase,
  locataireId: number,
  repartition: Repartition[],
  data: { date_paiement: string; mode: ModePaiement },
) {
  const lot = repartition.length > 1 ? `lot-${locataireId}-${Date.now()}` : null;
  let premierId = 0;
  await db.withTransactionAsync(async () => {
    for (const r of repartition) {
      const res = await db.runAsync(
        'INSERT INTO paiements (locataire_id, mois, montant, date_paiement, mode, lot) VALUES (?, ?, ?, ?, ?, ?)',
        locataireId,
        r.mois,
        r.montant,
        data.date_paiement,
        data.mode,
        lot,
      );
      if (!premierId) premierId = res.lastInsertRowId;
    }
  });
  return db.getAllAsync<Paiement>(
    lot ? 'SELECT * FROM paiements WHERE lot = ? ORDER BY mois' : 'SELECT * FROM paiements WHERE id = ?',
    lot ?? premierId,
  );
}

// ---------- Soldes et arriérés ----------

export type MoisImpaye = { mois: string; du: number; paye: number; reste: number };

export type Solde = {
  /** Total restant dû sur les mois échus (jusqu'au mois courant ou au départ). */
  arrieres: number;
  /** Montant payé pour des mois futurs. */
  avance: number;
  /** Dernier mois couvert par les paiements (si à jour ou en avance). */
  payeJusqua: string | null;
  moisImpayes: MoisImpaye[];
};

/** Dernier mois pendant lequel le loyer est dû (mois de sortie ou mois de référence). */
function finDu(loc: Pick<Locataire, 'date_sortie'>, reference: string) {
  return loc.date_sortie ? minMois(loc.date_sortie.slice(0, 7), reference) : reference;
}

function calculerSolde(
  loc: Pick<Locataire, 'loyer' | 'debut_loyer' | 'date_sortie'>,
  paye: Map<string, number>,
  reference: string,
): Solde {
  const moisDus = listeMois(loc.debut_loyer, finDu(loc, reference));
  const moisImpayes: MoisImpaye[] = [];
  let arrieres = 0;
  for (const m of moisDus) {
    const p = paye.get(m) ?? 0;
    if (p < loc.loyer) {
      moisImpayes.push({ mois: m, du: loc.loyer, paye: p, reste: loc.loyer - p });
      arrieres += loc.loyer - p;
    }
  }
  let avance = 0;
  for (const [m, p] of paye) if (m > reference) avance += p;

  let payeJusqua: string | null = null;
  if (moisImpayes.length === 0) {
    let m = moisDus.length ? moisDus[moisDus.length - 1] : decalerMois(loc.debut_loyer, -1);
    while ((paye.get(decalerMois(m, 1)) ?? 0) >= loc.loyer && loc.loyer > 0) m = decalerMois(m, 1);
    payeJusqua = m >= loc.debut_loyer ? m : null;
  }
  return { arrieres, avance, payeJusqua, moisImpayes };
}

export async function ficheSolde(db: SQLiteDatabase, loc: Locataire, reference = moisCourant()) {
  return calculerSolde(loc, await payeParMois(db, loc.id), reference);
}

export type LigneMois = {
  locataire_id: number;
  nom: string;
  telephone: string | null;
  logement_nom: string | null;
  du: number;
  paye: number;
  statut: StatutLoyer;
  /** Restant dû sur les mois précédant le mois affiché. */
  arrieresAvant: number;
  premierImpaye: string | null;
};

/** Situation de chaque locataire présent pendant le mois `mois` (AAAA-MM). */
export async function situationDuMois(db: SQLiteDatabase, mois: string): Promise<LigneMois[]> {
  const locs = await db.getAllAsync<Locataire>(
    `${SELECT_LOCATAIRE}
     WHERE t.debut_loyer <= ? AND (t.date_sortie IS NULL OR substr(t.date_sortie, 1, 7) >= ?)
     ORDER BY t.nom COLLATE NOCASE`,
    mois,
    mois,
  );
  const rows = await db.getAllAsync<{ locataire_id: number; mois: string; total: number }>(
    'SELECT locataire_id, mois, SUM(montant) AS total FROM paiements WHERE mois <= ? GROUP BY locataire_id, mois',
    mois,
  );
  const parLoc = new Map<number, Map<string, number>>();
  for (const r of rows) {
    if (!parLoc.has(r.locataire_id)) parLoc.set(r.locataire_id, new Map());
    parLoc.get(r.locataire_id)!.set(r.mois, r.total);
  }

  return locs.map((l) => {
    const paye = parLoc.get(l.id) ?? new Map<string, number>();
    const avant = calculerSolde(l, paye, decalerMois(mois, -1));
    const p = paye.get(mois) ?? 0;
    const statut: StatutLoyer = p >= l.loyer ? 'paye' : p > 0 ? 'partiel' : 'impaye';
    return {
      locataire_id: l.id,
      nom: l.nom,
      telephone: l.telephone,
      logement_nom: l.logement_nom,
      du: l.loyer,
      paye: p,
      statut,
      arrieresAvant: avant.arrieres,
      premierImpaye: avant.moisImpayes[0]?.mois ?? (p < l.loyer ? mois : null),
    };
  });
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
