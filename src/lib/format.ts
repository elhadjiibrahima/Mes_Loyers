const MOIS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/** 1500000 -> "1 500 000 GNF" */
export function formatGNF(montant: number) {
  const s = Math.round(montant).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${s} GNF`;
}

/** Garde uniquement les chiffres d'une saisie ("1 500 000" -> 1500000). */
export function parseMontant(texte: string) {
  const n = parseInt(texte.replace(/\D/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

export function moisCourant(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function aujourdHui(d = new Date()) {
  return `${moisCourant(d)}-${String(d.getDate()).padStart(2, '0')}`;
}

export function decalerMois(mois: string, delta: number) {
  const [a, m] = mois.split('-').map(Number);
  return moisCourant(new Date(a, m - 1 + delta, 1));
}

/** "2026-11" -> "novembre 2026" */
export function libelleMois(mois: string) {
  const [a, m] = mois.split('-').map(Number);
  return `${MOIS_FR[m - 1]} ${a}`;
}

/** "2026-11-12" -> "12/11/2026" */
export function formatDate(date: string) {
  const [a, m, j] = date.split('-');
  return `${j}/${m}/${a}`;
}

export function estMoisValide(mois: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(mois);
}

export function estDateValide(date: string) {
  return /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(date);
}
