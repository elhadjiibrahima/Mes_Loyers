import type { Compte } from '@/auth/comptes';

/**
 * Adresses e-mail qui ouvrent l'espace d'administration au lieu de l'application.
 * Phase de test : le rôle est vérifié sur l'appareil. Avec un serveur, il devra
 * être vérifié côté serveur.
 */
export const ADMIN_EMAILS = ['admin@mesloyers.app'];

export function estAdmin(compte: Pick<Compte, 'email'> | null | undefined) {
  return !!compte && ADMIN_EMAILS.includes(compte.email.toLowerCase());
}
