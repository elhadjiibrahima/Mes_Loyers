import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert } from 'react-native';

import { useAcces } from '@/auth/contexte';
import { Button, Field, Screen } from '@/components/ui';
import { addLogement } from '@/db/queries';
import { fermer } from '@/lib/actions';
import { parseMontant } from '@/lib/format';

export default function NouveauLogement() {
  const db = useSQLiteContext();
  const [nom, setNom] = useState('');
  const [adresse, setAdresse] = useState('');
  const [loyer, setLoyer] = useState('');
  const acces = useAcces();

  const enregistrer = async () => {
    const montant = parseMontant(loyer);
    if (!nom.trim() || montant <= 0) {
      Alert.alert('Champs manquants', 'Indiquez un nom et un loyer mensuel.');
      return;
    }
    if (!(await acces.peutAjouterLogement())) return;
    await addLogement(db, { nom: nom.trim(), adresse: adresse.trim(), loyer: montant });
    fermer();
  };

  return (
    <Screen>
      <Field label="Nom" value={nom} onChangeText={setNom} placeholder="Ex. Appartement A2, Kipé" autoFocus />
      <Field label="Adresse (facultatif)" value={adresse} onChangeText={setAdresse} placeholder="Quartier, rue…" />
      <Field label="Loyer mensuel (GNF)" value={loyer} onChangeText={setLoyer} keyboardType="number-pad" placeholder="Ex. 2500000" />
      <Button title="Enregistrer" onPress={enregistrer} />
    </Screen>
  );
}
