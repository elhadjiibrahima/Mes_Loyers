import type { SQLiteDatabase } from 'expo-sqlite';

import { aujourdHui, decalerMois, listeMois, minMois, moisCourant } from '@/lib/format';

export type Logement = {
  id: number;
  nom: string;
  adresse: string | null;
  loyer: number;
  locataire_id: number | null;
  locataire_nom: string | null;
  /** Loyer payé par le locataire actuel (peut différer du loyer affiché du logement). */
  locataire_loyer: number | null;
  /** Date de sortie du dernier locataire, si le logement est libre. */
  libre_depuis: string | null;
};

export type Locataire = {
  id: number;
  nom: string;
  telephone: string | null;
  logement_id: number | null;
  date_entree: string;
  debut_loyer: string;
  date_sortie: string | null;
  /** Loyer actuel (le dernier de l'historique). */
  loyer: number;
  caution: number;
  caution_rendue: number | null;
  /** Jour du mois où le loyer est dû (1 à 31). */
  jour_echeance: number;
  logement_nom: string | null;
};

export type ChangementLoyer = { depuis: string; montant: number };

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

/** `avenir` : pas encore échu (mois futur, ou mois en cours avant le jour d'échéance). */
export type StatutLoyer = 'paye' | 'partiel' | 'impaye' | 'avenir';

/** Numéro de téléphone acceptable : vide, ou 8 à 15 chiffres (espaces, +, tirets tolérés). */
export function telephoneValide(tel: string) {
  const t = tel.trim();
  if (!t) return true;
  const chiffres = t.replace(/\D/g, '');
  return /^[\d\s+().-]+$/.test(t) && chiffres.length >= 8 && chiffres.length <= 15;
}

// ---------- Logements ----------

const SELECT_LOGEMENT = `
  SELECT l.*, t.id AS locataire_id, t.nom AS locataire_nom, t.loyer AS locataire_loyer,
         CASE WHEN t.id IS NULL
              THEN (SELECT MAX(x.date_sortie) FROM locataires x WHERE x.logement_id = l.id)
         END AS libre_depuis
  FROM logements l
  LEFT JOIN locataires t ON t.logement_id = l.id AND t.date_sortie IS NULL`;

export function listLogements(db: SQLiteDatabase) {
  return db.getAllAsync<Logement>(`${SELECT_LOGEMENT} GROUP BY l.id ORDER BY l.nom COLLATE NOCASE`);
}

export function getLogement(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Logement>(`${SELECT_LOGEMENT} WHERE l.id = ? GROUP BY l.id`, id);
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
         t.loyer, t.caution, t.caution_rendue, t.jour_echeance, l.nom AS logement_nom
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
  jour_echeance: number;
  /** En modification : premier mois au nouveau loyer, s'il change. */
  loyer_depuis?: string;
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
  let id = 0;
  await db.withTransactionAsync(async () => {
    const res = await db.runAsync(
      `INSERT INTO locataires (nom, telephone, logement_id, date_entree, debut_loyer, loyer, caution, jour_echeance)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      d.nom,
      d.telephone || null,
      d.logement_id,
      d.date_entree,
      d.debut_loyer,
      d.loyer,
      d.caution,
      d.jour_echeance,
    );
    id = res.lastInsertRowId;
    await db.runAsync('INSERT INTO loyers_historique (locataire_id, depuis, montant) VALUES (?, ?, ?)', id, d.debut_loyer, d.loyer);
  });
  return id;
}

export async function updateLocataire(db: SQLiteDatabase, id: number, d: LocataireForm) {
  if (!(await logementLibre(db, d.logement_id, id))) throw new Error('occupe');
  const avant = await getLocataire(db, id);
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE locataires SET nom = ?, telephone = ?, logement_id = ?, date_entree = ?, debut_loyer = ?,
         caution = ?, jour_echeance = ? WHERE id = ?`,
      d.nom,
      d.telephone || null,
      d.logement_id,
      d.date_entree,
      d.debut_loyer,
      d.caution,
      d.jour_echeance,
      id,
    );
    // Les tarifs d'avant le premier loyer dû n'ont plus de sens : on les ramène au début.
    await db.runAsync('UPDATE OR REPLACE loyers_historique SET depuis = ? WHERE locataire_id = ? AND depuis < ?', d.debut_loyer, id, d.debut_loyer);
    if (avant && d.loyer !== avant.loyer) await ecrireChangementLoyer(db, id, d.loyer_depuis ?? moisCourant(), d.loyer, d.debut_loyer);
    await synchroniserLoyerActuel(db, id);
  });
}

async function ecrireChangementLoyer(db: SQLiteDatabase, id: number, depuis: string, montant: number, debut: string) {
  if (depuis <= debut) {
    // Correction du loyer depuis le début : il remplace tout l'historique antérieur.
    await db.runAsync('DELETE FROM loyers_historique WHERE locataire_id = ? AND depuis <= ?', id, debut);
    depuis = debut;
  }
  await db.runAsync(
    'INSERT OR REPLACE INTO loyers_historique (locataire_id, depuis, montant) VALUES (?, ?, ?)',
    id,
    depuis,
    montant,
  );
}

/** `locataires.loyer` = dernier tarif connu (sert aux listes et aux raccourcis). */
async function synchroniserLoyerActuel(db: SQLiteDatabase, id: number) {
  await db.runAsync(
    `UPDATE locataires SET loyer = COALESCE(
       (SELECT montant FROM loyers_historique WHERE locataire_id = ? ORDER BY depuis DESC LIMIT 1), loyer)
     WHERE id = ?`,
    id,
    id,
  );
}

export function getHistoriqueLoyer(db: SQLiteDatabase, id: number) {
  return db.getAllAsync<ChangementLoyer>(
    'SELECT depuis, montant FROM loyers_historique WHERE locataire_id = ? ORDER BY depuis',
    id,
  );
}

/** Supprime définitivement un locataire et tous ses paiements (saisie par erreur). */
export async function deleteLocataire(db: SQLiteDatabase, id: number) {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM paiements WHERE locataire_id = ?', id);
    await db.runAsync('DELETE FROM loyers_historique WHERE locataire_id = ?', id);
    await db.runAsync('DELETE FROM locataires WHERE id = ?', id);
  });
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
  const fiche = opts.deduireArrieres ? await ficheSolde(db, { ...loc, date_sortie: opts.date_sortie }) : null;
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE locataires SET date_sortie = ?, caution_rendue = ?, actif = 0 WHERE id = ?',
      opts.date_sortie,
      opts.caution_rendue,
      loc.id,
    );
    if (fiche) {
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
export async function payeParMois(db: SQLiteDatabase, locataireId: number) {
  const rows = await db.getAllAsync<{ mois: string; total: number }>(
    'SELECT mois, SUM(montant) AS total FROM paiements WHERE locataire_id = ? GROUP BY mois',
    locataireId,
  );
  return new Map(rows.map((r) => [r.mois, r.total]));
}

// ---------- Contrat : loyer et échéance de chaque mois ----------

/** Ce qu'il faut savoir d'un locataire pour calculer ce qu'il doit. */
export type Contrat = Pick<Locataire, 'loyer' | 'debut_loyer' | 'date_sortie' | 'jour_echeance'> & {
  historique: ChangementLoyer[];
};

export async function getContrat(db: SQLiteDatabase, loc: Locataire): Promise<Contrat> {
  return { ...loc, historique: await getHistoriqueLoyer(db, loc.id) };
}

/** Loyer applicable à un mois donné, d'après l'historique des tarifs. */
export function loyerDu(c: Contrat, mois: string) {
  let montant = c.historique[0]?.montant ?? c.loyer;
  for (const h of c.historique) if (h.depuis <= mois) montant = h.montant;
  return montant;
}

/** Date d'échéance (AAAA-MM-JJ) d'un mois, ramenée au dernier jour si besoin (ex. 31 → 30). */
export function dateEcheance(c: Pick<Contrat, 'jour_echeance'>, mois: string) {
  const [a, m] = mois.split('-').map(Number);
  const dernier = new Date(a, m, 0).getDate();
  return `${mois}-${String(Math.min(Math.max(c.jour_echeance, 1), dernier)).padStart(2, '0')}`;
}

/**
 * Un mois est échu quand sa date d'échéance est passée. Après un départ, tous les
 * mois jusqu'à la sortie sont dus.
 */
export function estEchu(c: Contrat, mois: string, aujourdhui = aujourdHui()) {
  if (c.date_sortie && mois <= c.date_sortie.slice(0, 7)) return true;
  return aujourdhui > dateEcheance(c, mois);
}

export type MoisImpaye = { mois: string; du: number; paye: number; reste: number };

export type Solde = {
  /** Total restant dû sur les mois échus. */
  arrieres: number;
  /** Montant payé pour des mois après le mois en cours. */
  avance: number;
  /** Dernier mois couvert par les paiements (si à jour ou en avance). */
  payeJusqua: string | null;
  moisImpayes: MoisImpaye[];
  /** Loyer du mois en cours pas encore échu et pas entièrement payé. */
  enCours: (MoisImpaye & { echeance: string }) | null;
};

/** Dernier mois pendant lequel le loyer est dû (mois de sortie ou mois de référence). */
function finDu(c: Pick<Contrat, 'date_sortie'>, reference: string) {
  return c.date_sortie ? minMois(c.date_sortie.slice(0, 7), reference) : reference;
}

export function calculerSolde(c: Contrat, paye: Map<string, number>, aujourdhui = aujourdHui()): Solde {
  const reference = aujourdhui.slice(0, 7);
  const moisImpayes: MoisImpaye[] = [];
  let arrieres = 0;
  let enCours: Solde['enCours'] = null;
  for (const m of listeMois(c.debut_loyer, finDu(c, reference))) {
    const du = loyerDu(c, m);
    const p = paye.get(m) ?? 0;
    if (p >= du) continue;
    if (estEchu(c, m, aujourdhui)) {
      moisImpayes.push({ mois: m, du, paye: p, reste: du - p });
      arrieres += du - p;
    } else {
      enCours = { mois: m, du, paye: p, reste: du - p, echeance: dateEcheance(c, m) };
    }
  }
  let avance = 0;
  for (const [m, p] of paye) if (m > reference) avance += p;

  let payeJusqua: string | null = null;
  if (moisImpayes.length === 0 && !enCours) {
    let m = finDu(c, reference);
    if (m < c.debut_loyer) m = decalerMois(c.debut_loyer, -1);
    const limite = c.date_sortie ? c.date_sortie.slice(0, 7) : '9999-12';
    while (decalerMois(m, 1) <= limite && (paye.get(decalerMois(m, 1)) ?? 0) >= loyerDu(c, decalerMois(m, 1))) m = decalerMois(m, 1);
    payeJusqua = m >= c.debut_loyer ? m : null;
  }
  return { arrieres, avance, payeJusqua, moisImpayes, enCours };
}

export async function ficheSolde(db: SQLiteDatabase, loc: Locataire, aujourdhui = aujourdHui()) {
  return calculerSolde(await getContrat(db, loc), await payeParMois(db, loc.id), aujourdhui);
}

export type Repartition = { mois: string; montant: number };

/**
 * Répartit un montant à partir de `premierMois` (jamais avant le premier loyer dû,
 * jamais après la sortie) : chaque mois reçoit ce qui manque pour atteindre son
 * loyer ; le surplus éventuel va sur le dernier mois.
 */
export async function repartirPaiement(
  db: SQLiteDatabase,
  loc: Locataire,
  premierMois: string,
  montant: number,
): Promise<Repartition[]> {
  const c = await getContrat(db, loc);
  const deja = await payeParMois(db, loc.id);
  const res: Repartition[] = [];
  const debut = premierMois < c.debut_loyer ? c.debut_loyer : premierMois;
  const fin = c.date_sortie ? c.date_sortie.slice(0, 7) : null;
  let reste = montant;
  let mois = debut;
  for (let i = 0; i < 120 && reste > 0 && (!fin || mois <= fin); i++, mois = decalerMois(mois, 1)) {
    const manque = Math.max(loyerDu(c, mois) - (deja.get(mois) ?? 0), 0);
    if (manque === 0) continue;
    const part = Math.min(manque, reste);
    res.push({ mois, montant: part });
    reste -= part;
  }
  if (reste > 0) {
    if (res.length) res[res.length - 1].montant += reste;
    else res.push({ mois: debut, montant: reste });
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

// ---------- Tableau du mois ----------

export type LigneMois = {
  locataire_id: number;
  nom: string;
  telephone: string | null;
  logement_nom: string | null;
  du: number;
  paye: number;
  statut: StatutLoyer;
  echeance: string;
  /** Restant dû sur les mois échus avant le mois affiché. */
  arrieresAvant: number;
  nbMoisRetard: number;
};

/** Situation de chaque locataire présent pendant le mois `mois` (AAAA-MM). */
export async function situationDuMois(db: SQLiteDatabase, mois: string, aujourdhui = aujourdHui()): Promise<LigneMois[]> {
  const locs = await db.getAllAsync<Locataire>(
    `${SELECT_LOCATAIRE}
     WHERE t.debut_loyer <= ? AND (t.date_sortie IS NULL OR substr(t.date_sortie, 1, 7) >= ?)
     ORDER BY t.nom COLLATE NOCASE`,
    mois,
    mois,
  );
  const [rows, hist] = await Promise.all([
    db.getAllAsync<{ locataire_id: number; mois: string; total: number }>(
      'SELECT locataire_id, mois, SUM(montant) AS total FROM paiements GROUP BY locataire_id, mois',
    ),
    db.getAllAsync<ChangementLoyer & { locataire_id: number }>(
      'SELECT locataire_id, depuis, montant FROM loyers_historique ORDER BY depuis',
    ),
  ]);
  const payeParLoc = new Map<number, Map<string, number>>();
  for (const r of rows) {
    if (!payeParLoc.has(r.locataire_id)) payeParLoc.set(r.locataire_id, new Map());
    payeParLoc.get(r.locataire_id)!.set(r.mois, r.total);
  }

  return locs.map((l) => {
    const c: Contrat = { ...l, historique: hist.filter((h) => h.locataire_id === l.id) };
    const paye = payeParLoc.get(l.id) ?? new Map<string, number>();
    const solde = calculerSolde(c, paye, aujourdhui);
    const avant = solde.moisImpayes.filter((m) => m.mois < mois);
    const du = loyerDu(c, mois);
    const p = paye.get(mois) ?? 0;
    const statut: StatutLoyer =
      p >= du ? 'paye' : !estEchu(c, mois, aujourdhui) ? 'avenir' : p > 0 ? 'partiel' : 'impaye';
    return {
      locataire_id: l.id,
      nom: l.nom,
      telephone: l.telephone,
      logement_nom: l.logement_nom,
      du,
      paye: p,
      statut,
      echeance: dateEcheance(c, mois),
      arrieresAvant: avant.reduce((s, m) => s + m.reste, 0),
      nbMoisRetard: avant.length + (statut === 'partiel' || statut === 'impaye' ? 1 : 0),
    };
  });
}

// ---------- Calendrier ----------

export type EtatMois = 'hors' | 'paye' | 'partiel' | 'impaye' | 'futur';

/** État de chacun des 12 mois d'une année pour un locataire. */
export function calendrierAnnee(c: Contrat, paye: Map<string, number>, annee: number, aujourdhui = aujourdHui()) {
  const fin = c.date_sortie ? c.date_sortie.slice(0, 7) : null;
  return Array.from({ length: 12 }, (_, i) => {
    const mois = `${annee}-${String(i + 1).padStart(2, '0')}`;
    const p = paye.get(mois) ?? 0;
    let etat: EtatMois;
    if (mois < c.debut_loyer || (fin && mois > fin)) etat = 'hors';
    else if (p >= loyerDu(c, mois)) etat = 'paye';
    else if (p > 0) etat = 'partiel';
    else etat = estEchu(c, mois, aujourdhui) ? 'impaye' : 'futur';
    return { mois, etat };
  });
}

// ---------- Dépenses et bilan ----------

export type Depense = {
  id: number;
  logement_id: number | null;
  logement_nom: string | null;
  date: string;
  montant: number;
  categorie: CategorieDepense;
  libelle: string | null;
};

export type CategorieDepense = 'travaux' | 'electricite' | 'eau' | 'taxes' | 'gardiennage' | 'autre';

export const CATEGORIES: { value: CategorieDepense; label: string }[] = [
  { value: 'travaux', label: 'Travaux' },
  { value: 'electricite', label: 'Électricité' },
  { value: 'eau', label: 'Eau' },
  { value: 'taxes', label: 'Taxes' },
  { value: 'gardiennage', label: 'Gardiennage' },
  { value: 'autre', label: 'Autre' },
];

export function libelleCategorie(c: CategorieDepense) {
  return CATEGORIES.find((x) => x.value === c)?.label ?? c;
}

export function listDepenses(db: SQLiteDatabase, annee: number) {
  return db.getAllAsync<Depense>(
    `SELECT d.*, l.nom AS logement_nom FROM depenses d LEFT JOIN logements l ON l.id = d.logement_id
     WHERE substr(d.date, 1, 4) = ? ORDER BY d.date DESC, d.id DESC`,
    String(annee),
  );
}

export function addDepense(
  db: SQLiteDatabase,
  d: { logement_id: number | null; date: string; montant: number; categorie: CategorieDepense; libelle: string },
) {
  return db.runAsync(
    'INSERT INTO depenses (logement_id, date, montant, categorie, libelle) VALUES (?, ?, ?, ?, ?)',
    d.logement_id,
    d.date,
    d.montant,
    d.categorie,
    d.libelle || null,
  );
}

export function deleteDepense(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM depenses WHERE id = ?', id);
}

export type Bilan = {
  annee: number;
  /** 12 valeurs, de janvier à décembre. */
  revenusParMois: number[];
  depensesParMois: number[];
  revenus: number;
  depenses: number;
  parLogement: { nom: string; revenus: number; depenses: number }[];
};

/** Bilan d'une année, en encaissements réels (date du paiement) et dépenses. */
export async function bilanAnnee(db: SQLiteDatabase, annee: number): Promise<Bilan> {
  const a = String(annee);
  const [rev, dep, revLog, depLog] = await Promise.all([
    db.getAllAsync<{ m: string; total: number }>(
      `SELECT substr(date_paiement, 6, 2) AS m, SUM(montant) AS total FROM paiements
       WHERE substr(date_paiement, 1, 4) = ? GROUP BY m`,
      a,
    ),
    db.getAllAsync<{ m: string; total: number }>(
      `SELECT substr(date, 6, 2) AS m, SUM(montant) AS total FROM depenses WHERE substr(date, 1, 4) = ? GROUP BY m`,
      a,
    ),
    db.getAllAsync<{ nom_logement: string; total: number }>(
      `SELECT COALESCE(l.nom, 'Logement supprimé') AS nom_logement, SUM(p.montant) AS total
       FROM paiements p JOIN locataires t ON t.id = p.locataire_id LEFT JOIN logements l ON l.id = t.logement_id
       WHERE substr(p.date_paiement, 1, 4) = ? GROUP BY nom_logement`,
      a,
    ).then((r) => r.map((x) => ({ nom: x.nom_logement, total: x.total }))),
    db.getAllAsync<{ nom_logement: string; total: number }>(
      `SELECT COALESCE(l.nom, 'Général') AS nom_logement, SUM(d.montant) AS total
       FROM depenses d LEFT JOIN logements l ON l.id = d.logement_id
       WHERE substr(d.date, 1, 4) = ? GROUP BY nom_logement`,
      a,
    ).then((r) => r.map((x) => ({ nom: x.nom_logement, total: x.total }))),
  ]);
  const parMois = (rows: { m: string; total: number }[]) => {
    const t = Array(12).fill(0);
    for (const r of rows) t[Number(r.m) - 1] = r.total;
    return t;
  };
  const noms = new Set([...revLog.map((r) => r.nom), ...depLog.map((r) => r.nom)]);
  const parLogement = [...noms]
    .map((nom) => ({
      nom,
      revenus: revLog.find((r) => r.nom === nom)?.total ?? 0,
      depenses: depLog.find((r) => r.nom === nom)?.total ?? 0,
    }))
    .sort((x, y) => y.revenus - y.depenses - (x.revenus - x.depenses));
  const revenusParMois = parMois(rev);
  const depensesParMois = parMois(dep);
  return {
    annee,
    revenusParMois,
    depensesParMois,
    revenus: revenusParMois.reduce((s, v) => s + v, 0),
    depenses: depensesParMois.reduce((s, v) => s + v, 0),
    parLogement,
  };
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
