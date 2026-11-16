import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import * as Crypto from 'expo-crypto';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { estAdmin } from '@/auth/admin';
import { formule, JOURS_ESSAI, JOURS_PAR_MOIS, type FormuleId } from '@/auth/formules';

/**
 * Comptes et abonnements, dans une base à part (`comptes.db`). Chaque compte a
 * sa propre base de données de gestion : les propriétaires ne voient jamais
 * les données des autres.
 *
 * Ce stockage est local à l'appareil (phase de test). Pour un vrai service en
 * ligne, ces fonctions seront remplacées par des appels à un serveur, sans
 * changer les écrans.
 */

export type Compte = { id: number; email: string; nom: string; base: string };

export type Abonnement = {
  id: number;
  compte_id: number;
  formule: FormuleId;
  debut: string;
  fin: string;
  /** manuel : paiement reçu (Orange Money, MTN, espèces) et enregistré par l'administrateur. */
  mode: 'essai' | 'test' | 'paiement' | 'manuel';
  montant: number;
};

const ITERATIONS = 20_000;
const SESSION = 'session_compte';

let promesseBase: Promise<SQLiteDatabase> | null = null;

export function baseComptes() {
  if (!promesseBase) {
    promesseBase = (async () => {
      const db = await openDatabaseAsync('comptes.db');
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS comptes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT NOT NULL UNIQUE COLLATE NOCASE,
          nom TEXT NOT NULL,
          mot_de_passe TEXT NOT NULL,   -- PBKDF2-SHA256, jamais en clair
          sel TEXT NOT NULL,
          base TEXT NOT NULL,           -- fichier SQLite des données de ce compte
          cree_le TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS abonnements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          compte_id INTEGER NOT NULL REFERENCES comptes(id) ON DELETE CASCADE,
          formule TEXT NOT NULL,
          debut TEXT NOT NULL,          -- AAAA-MM-JJ
          fin TEXT NOT NULL,            -- AAAA-MM-JJ, dernier jour inclus
          mode TEXT NOT NULL,           -- essai | test | paiement
          montant INTEGER NOT NULL DEFAULT 0,
          cree_le TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS session (cle TEXT PRIMARY KEY, valeur TEXT);
      `);
      return db;
    })();
  }
  return promesseBase;
}

async function hacher(motDePasse: string, selHex: string) {
  const cle = await pbkdf2Async(sha256, motDePasse, hexToBytes(selHex), { c: ITERATIONS, dkLen: 32 });
  return bytesToHex(cle);
}

/** Comparaison en temps constant, pour ne rien révéler sur le mot de passe. */
function egaux(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function emailValide(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export class ErreurCompte extends Error {}

function dateIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function ajouterJours(date: string, jours: number) {
  const [a, m, j] = date.split('-').map(Number);
  return dateIso(new Date(a, m - 1, j + jours));
}

export async function inscrire(nom: string, email: string, motDePasse: string): Promise<Compte> {
  const db = await baseComptes();
  email = email.trim().toLowerCase();
  if (!nom.trim()) throw new ErreurCompte('Indiquez votre nom.');
  if (!emailValide(email)) throw new ErreurCompte('Adresse e-mail invalide.');
  if (motDePasse.length < 8) throw new ErreurCompte('Le mot de passe doit contenir au moins 8 caractères.');
  if (await db.getFirstAsync('SELECT 1 FROM comptes WHERE email = ?', email)) {
    throw new ErreurCompte('Un compte existe déjà avec cette adresse. Connectez-vous.');
  }
  // Le tout premier compte de l'appareil reprend les données saisies avant la connexion.
  const premier = !(await db.getFirstAsync('SELECT 1 FROM comptes'));
  const sel = bytesToHex(Crypto.getRandomBytes(16));
  const hash = await hacher(motDePasse, sel);

  let id = 0;
  await db.withTransactionAsync(async () => {
    const res = await db.runAsync(
      'INSERT INTO comptes (email, nom, mot_de_passe, sel, base) VALUES (?, ?, ?, ?, ?)',
      email,
      nom.trim(),
      hash,
      sel,
      'temporaire',
    );
    id = res.lastInsertRowId;
    await db.runAsync('UPDATE comptes SET base = ? WHERE id = ?', premier ? 'loyers.db' : `loyers-${id}.db`, id);
    const debut = dateIso(new Date());
    if (!estAdmin({ email })) {
      await db.runAsync(
        "INSERT INTO abonnements (compte_id, formule, debut, fin, mode, montant) VALUES (?, 'agence', ?, ?, 'essai', 0)",
        id,
        debut,
        ajouterJours(debut, JOURS_ESSAI - 1),
      );
    }
    await db.runAsync('INSERT OR REPLACE INTO session (cle, valeur) VALUES (?, ?)', SESSION, String(id));
  });
  return (await getCompte(id))!;
}

export async function connecter(email: string, motDePasse: string): Promise<Compte> {
  const db = await baseComptes();
  const ligne = await db.getFirstAsync<Compte & { mot_de_passe: string; sel: string }>(
    'SELECT * FROM comptes WHERE email = ?',
    email.trim().toLowerCase(),
  );
  // Même message dans les deux cas : on ne dit pas si l'e-mail existe.
  const erreur = new ErreurCompte('E-mail ou mot de passe incorrect.');
  if (!ligne) throw erreur;
  if (!egaux(await hacher(motDePasse, ligne.sel), ligne.mot_de_passe)) throw erreur;
  await db.runAsync('INSERT OR REPLACE INTO session (cle, valeur) VALUES (?, ?)', SESSION, String(ligne.id));
  return { id: ligne.id, email: ligne.email, nom: ligne.nom, base: ligne.base };
}

export async function changerMotDePasse(compteId: number, actuel: string, nouveau: string) {
  const db = await baseComptes();
  const ligne = await db.getFirstAsync<{ mot_de_passe: string; sel: string }>('SELECT mot_de_passe, sel FROM comptes WHERE id = ?', compteId);
  if (!ligne || !egaux(await hacher(actuel, ligne.sel), ligne.mot_de_passe)) throw new ErreurCompte('Mot de passe actuel incorrect.');
  if (nouveau.length < 8) throw new ErreurCompte('Le nouveau mot de passe doit contenir au moins 8 caractères.');
  const sel = bytesToHex(Crypto.getRandomBytes(16));
  await db.runAsync('UPDATE comptes SET mot_de_passe = ?, sel = ? WHERE id = ?', await hacher(nouveau, sel), sel, compteId);
}

export async function deconnecter() {
  const db = await baseComptes();
  await db.runAsync('DELETE FROM session WHERE cle = ?', SESSION);
}

export async function getCompte(id: number) {
  const db = await baseComptes();
  return db.getFirstAsync<Compte>('SELECT id, email, nom, base FROM comptes WHERE id = ?', id);
}

export async function compteConnecte() {
  const db = await baseComptes();
  const s = await db.getFirstAsync<{ valeur: string }>('SELECT valeur FROM session WHERE cle = ?', SESSION);
  return s ? getCompte(Number(s.valeur)) : null;
}

// ---------- Abonnement ----------

export type EtatAbonnement = {
  statut: 'essai' | 'actif' | 'expire';
  formule: FormuleId;
  /** null : aucune limite (essai ou formule Agence). */
  limiteLogements: number | null;
  fin: string;
  joursRestants: number;
  /** Ajouter, encaisser, modifier : interdit quand l'abonnement est expiré. */
  peutModifier: boolean;
  historique: Abonnement[];
};

function joursEntre(de: string, a: string) {
  const [a1, m1, j1] = de.split('-').map(Number);
  const [a2, m2, j2] = a.split('-').map(Number);
  return Math.round((new Date(a2, m2 - 1, j2).getTime() - new Date(a1, m1 - 1, j1).getTime()) / 86_400_000);
}

export async function etatAbonnement(compteId: number, aujourdhui = dateIso(new Date())): Promise<EtatAbonnement> {
  const db = await baseComptes();
  const historique = await db.getAllAsync<Abonnement>(
    'SELECT * FROM abonnements WHERE compte_id = ? ORDER BY fin DESC, id DESC',
    compteId,
  );
  const dernier = historique[0];
  if (!dernier) {
    return { statut: 'expire', formule: 'particulier', limiteLogements: 0, fin: aujourdhui, joursRestants: 0, peutModifier: false, historique };
  }
  const restant = joursEntre(aujourdhui, dernier.fin) + 1;
  const enCours = restant > 0;
  const statut = !enCours ? 'expire' : dernier.mode === 'essai' ? 'essai' : 'actif';
  return {
    statut,
    formule: dernier.formule,
    limiteLogements: statut === 'essai' ? null : formule(dernier.formule).limite,
    fin: dernier.fin,
    joursRestants: Math.max(restant, 0),
    peutModifier: enCours,
    historique,
  };
}

/**
 * Enregistre une mensualité. Si l'abonnement est encore en cours, le nouveau mois
 * s'ajoute à la suite ; sinon il commence aujourd'hui.
 */
export async function payerMois(compteId: number, id: FormuleId, mode: 'test' | 'paiement' | 'manuel', mois = 1) {
  const db = await baseComptes();
  const etat = await etatAbonnement(compteId);
  const aujourdhui = dateIso(new Date());
  // Même formule : le mois s'ajoute à la suite. Changement de formule : effet immédiat.
  const enCoursPaye = etat.statut === 'actif' && etat.formule === id;
  const debut = enCoursPaye ? ajouterJours(etat.fin, 1) : aujourdhui;
  const fin = ajouterJours(debut, JOURS_PAR_MOIS * mois - 1);
  await db.runAsync(
    'INSERT INTO abonnements (compte_id, formule, debut, fin, mode, montant) VALUES (?, ?, ?, ?, ?, ?)',
    compteId,
    id,
    debut,
    fin,
    mode,
    formule(id).prixMensuel * mois,
  );
}

// ---------- Administration ----------

export type ProprietaireAdmin = Compte & {
  cree_le: string;
  abonnement: EtatAbonnement;
  nbLogements: number | null;
};

/** Nombre de logements d'un compte, en ouvrant sa base (null si illisible). */
async function compterLogements(base: string) {
  try {
    const db = await openDatabaseAsync(base);
    const r = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM logements');
    return r?.n ?? 0;
  } catch {
    return null;
  }
}

export async function listProprietaires(): Promise<ProprietaireAdmin[]> {
  const db = await baseComptes();
  const comptes = await db.getAllAsync<Compte & { cree_le: string }>(
    'SELECT id, email, nom, base, cree_le FROM comptes ORDER BY cree_le DESC',
  );
  const proprietaires = comptes.filter((c) => !estAdmin(c));
  return Promise.all(
    proprietaires.map(async (c) => ({ ...c, abonnement: await etatAbonnement(c.id), nbLogements: await compterLogements(c.base) })),
  );
}

export async function getProprietaire(id: number): Promise<ProprietaireAdmin | null> {
  const db = await baseComptes();
  const c = await db.getFirstAsync<Compte & { cree_le: string }>('SELECT id, email, nom, base, cree_le FROM comptes WHERE id = ?', id);
  if (!c || estAdmin(c)) return null;
  return { ...c, abonnement: await etatAbonnement(c.id), nbLogements: await compterLogements(c.base) };
}

export type StatsAdmin = {
  total: number;
  essai: number;
  actifs: number;
  expires: number;
  /** Encaissé ce mois-ci (abonnements enregistrés depuis le 1er). */
  revenusMois: number;
  /** Revenu mensuel récurrent : somme des formules des abonnés actifs. */
  revenuRecurrent: number;
};

export function statistiques(liste: ProprietaireAdmin[], historiques: Abonnement[]): StatsAdmin {
  const mois = dateIso(new Date()).slice(0, 7);
  const actifs = liste.filter((p) => p.abonnement.statut === 'actif');
  return {
    total: liste.length,
    essai: liste.filter((p) => p.abonnement.statut === 'essai').length,
    actifs: actifs.length,
    expires: liste.filter((p) => p.abonnement.statut === 'expire').length,
    revenusMois: historiques.filter((a) => a.mode !== 'essai' && a.debut.slice(0, 7) === mois).reduce((s, a) => s + a.montant, 0),
    revenuRecurrent: actifs.reduce((s, p) => s + formule(p.abonnement.formule).prixMensuel, 0),
  };
}

export async function tousLesAbonnements() {
  const db = await baseComptes();
  return db.getAllAsync<Abonnement>('SELECT * FROM abonnements');
}

/** Coupe l'accès immédiatement : l'abonnement en cours se termine hier. */
export async function suspendre(compteId: number) {
  const db = await baseComptes();
  const hier = ajouterJours(dateIso(new Date()), -1);
  await db.runAsync('UPDATE abonnements SET fin = ? WHERE compte_id = ? AND fin > ?', hier, compteId, hier);
}

/** Donne un mot de passe temporaire à communiquer au propriétaire (mot de passe oublié). */
export async function reinitialiserMotDePasse(compteId: number) {
  const db = await baseComptes();
  // 32 caractères (sans l, o, 0, 1) : chaque octet % 32 tombe de façon uniforme.
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  const octets = Crypto.getRandomBytes(10);
  const temporaire = Array.from(octets, (o) => alphabet[o % alphabet.length]).join('');
  const sel = bytesToHex(Crypto.getRandomBytes(16));
  await db.runAsync('UPDATE comptes SET mot_de_passe = ?, sel = ? WHERE id = ?', await hacher(temporaire, sel), sel, compteId);
  return temporaire;
}
