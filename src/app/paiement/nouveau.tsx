import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { Button, Chips, Field, Screen, T } from '@/components/ui';
import {
  addPaiement,
  getLocataire,
  getPaiement,
  getProfil,
  MODES,
  type Locataire,
  type ModePaiement,
} from '@/db/queries';
import { partagerQuittance } from '@/lib/actions';
import { aujourdHui, estDateValide, estMoisValide, moisCourant, parseMontant } from '@/lib/format';

export default function NouveauPaiement() {
  const params = useLocalSearchParams<{ locataire: string; mois?: string; montant?: string }>();
  const db = useSQLiteContext();
  const [loc, setLoc] = useState<Locataire | null>(null);
  const [mois, setMois] = useState(params.mois ?? moisCourant());
  const [montant, setMontant] = useState(params.montant && params.montant !== '0' ? params.montant : '');
  const [date, setDate] = useState(aujourdHui());
  const [mode, setMode] = useState<ModePaiement>('especes');

  useEffect(() => {
    getLocataire(db, Number(params.locataire)).then(setLoc);
  }, [db, params.locataire]);

  const enregistrer = async () => {
    const m = parseMontant(montant);
    if (!loc) return;
    if (m <= 0) return Alert.alert('Montant manquant', 'Indiquez le montant reçu.');
    if (!estMoisValide(mois)) return Alert.alert('Mois invalide', 'Utilisez le format AAAA-MM.');
    if (!estDateValide(date)) return Alert.alert('Date invalide', 'Utilisez le format AAAA-MM-JJ.');

    const res = await addPaiement(db, { locataire_id: loc.id, mois, montant: m, date_paiement: date, mode });
    const paiement = await getPaiement(db, res.lastInsertRowId);
    router.back();
    if (paiement) {
      Alert.alert('Loyer encaissé ✓', 'Envoyer la quittance au locataire ?', [
        { text: 'Plus tard', style: 'cancel' },
        { text: 'Partager', onPress: async () => partagerQuittance(paiement, loc, await getProfil(db)) },
      ]);
    }
  };

  return (
    <Screen>
      {loc && <T variant="subtitle">{loc.nom}</T>}
      <Field label="Mois concerné (AAAA-MM)" value={mois} onChangeText={setMois} />
      <Field label="Montant reçu (GNF)" value={montant} onChangeText={setMontant} keyboardType="number-pad" autoFocus />
      <Field label="Date du paiement (AAAA-MM-JJ)" value={date} onChangeText={setDate} />
      <T variant="small">Mode de paiement</T>
      <Chips options={MODES} value={mode} onChange={setMode} />
      <Button title="Enregistrer" onPress={enregistrer} />
    </Screen>
  );
}
