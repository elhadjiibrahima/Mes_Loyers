/**
 * Offres d'abonnement. Les prix sont provisoires : modifiez-les ici, tout
 * l'écran d'abonnement se met à jour.
 */
export type FormuleId = 'particulier' | 'essentiel' | 'pro' | 'agence';

export type Formule = {
  id: FormuleId;
  nom: string;
  /** Nombre maximum de logements (null = illimité). */
  limite: number | null;
  prixMensuel: number;
  description: string;
};

export const FORMULES: Formule[] = [
  { id: 'particulier', nom: 'Particulier', limite: 2, prixMensuel: 50_000, description: '1 ou 2 logements, prix unique' },
  { id: 'essentiel', nom: 'Essentiel', limite: 5, prixMensuel: 100_000, description: "Jusqu'à 5 logements" },
  { id: 'pro', nom: 'Pro', limite: 20, prixMensuel: 200_000, description: "Jusqu'à 20 logements (immeuble)" },
  { id: 'agence', nom: 'Agence', limite: null, prixMensuel: 400_000, description: 'Logements illimités' },
];

/** Durée de l'essai gratuit, avec toutes les fonctionnalités. */
export const JOURS_ESSAI = 30;

/** Durée payée par une mensualité. */
export const JOURS_PAR_MOIS = 30;

/**
 * Mode test : le paiement est simulé par un bouton (pas de vrai Orange Money / MTN).
 * À passer à false quand un moyen de paiement réel sera branché.
 */
export const MODE_TEST_PAIEMENT = true;

export function formule(id: FormuleId) {
  return FORMULES.find((f) => f.id === id) ?? FORMULES[0];
}

/** Plus petite formule qui couvre ce nombre de logements. */
export function formuleConseillee(nbLogements: number) {
  return FORMULES.find((f) => f.limite == null || nbLogements <= f.limite) ?? FORMULES[FORMULES.length - 1];
}
