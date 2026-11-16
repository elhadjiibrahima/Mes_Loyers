import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert } from 'react-native';

import {
  compteConnecte,
  connecter,
  deconnecter,
  etatAbonnement,
  inscrire,
  type Compte,
  type EtatAbonnement,
} from '@/auth/comptes';
import { formule } from '@/auth/formules';

type Auth = {
  /** false tant que la session n'est pas lue. */
  pret: boolean;
  compte: Compte | null;
  abonnement: EtatAbonnement | null;
  connexion: (email: string, motDePasse: string) => Promise<void>;
  inscription: (nom: string, email: string, motDePasse: string) => Promise<void>;
  deconnexion: () => Promise<void>;
  rafraichirAbonnement: () => Promise<void>;
};

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [pret, setPret] = useState(false);
  const [compte, setCompte] = useState<Compte | null>(null);
  const [abonnement, setAbonnement] = useState<EtatAbonnement | null>(null);

  const ouvrir = useCallback(async (c: Compte | null) => {
    setAbonnement(c ? await etatAbonnement(c.id) : null);
    setCompte(c);
  }, []);

  useEffect(() => {
    compteConnecte()
      .then(ouvrir)
      .catch(() => ouvrir(null))
      .finally(() => setPret(true));
  }, [ouvrir]);

  const valeur = useMemo<Auth>(
    () => ({
      pret,
      compte,
      abonnement,
      connexion: async (email, mdp) => ouvrir(await connecter(email, mdp)),
      inscription: async (nom, email, mdp) => ouvrir(await inscrire(nom, email, mdp)),
      deconnexion: async () => {
        await deconnecter();
        await ouvrir(null);
      },
      rafraichirAbonnement: async () => {
        if (compte) setAbonnement(await etatAbonnement(compte.id));
      },
    }),
    [pret, compte, abonnement, ouvrir],
  );

  return <AuthContext.Provider value={valeur}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const a = useContext(AuthContext);
  if (!a) throw new Error('useAuth doit être utilisé dans AuthProvider');
  return a;
}

/**
 * Vérifie l'abonnement avant une action. Renvoie true si l'action est permise,
 * sinon explique pourquoi et propose l'écran d'abonnement.
 */
export function useAcces() {
  const { abonnement } = useAuth();
  const db = useSQLiteContext();

  const proposer = (titre: string, message: string) =>
    Alert.alert(titre, message, [
      { text: 'Plus tard', style: 'cancel' },
      { text: "Voir l'abonnement", onPress: () => router.push('/abonnement') },
    ]);

  return {
    /** Toute modification des données (encaisser, ajouter, modifier…). */
    peutModifier: () => {
      if (abonnement?.peutModifier) return true;
      proposer(
        abonnement?.statut === 'expire' ? 'Abonnement expiré' : 'Abonnement requis',
        'Vos données restent consultables. Renouvelez votre abonnement pour encaisser, ajouter ou modifier.',
      );
      return false;
    },
    /** Ajout d'un logement : vérifie aussi la limite de la formule. */
    peutAjouterLogement: async () => {
      if (!abonnement?.peutModifier) {
        proposer('Abonnement expiré', 'Renouvelez votre abonnement pour ajouter des logements.');
        return false;
      }
      const limite = abonnement.limiteLogements;
      if (limite == null) return true;
      const n = (await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM logements'))?.n ?? 0;
      if (n < limite) return true;
      proposer(
        'Limite de la formule atteinte',
        `La formule ${formule(abonnement.formule).nom} permet ${limite} logement${limite > 1 ? 's' : ''}. Passez à une formule supérieure pour en ajouter.`,
      );
      return false;
    },
  };
}
