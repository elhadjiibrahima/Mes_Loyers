import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { useAcces } from '@/auth/contexte';
import { DateField } from '@/components/date-fields';
import { Button, Chips, Field, Screen, T } from '@/components/ui';
import { addDepense, CATEGORIES, listLogements, type CategorieDepense, type Logement } from '@/db/queries';
import { fermer } from '@/lib/actions';
import { aujourdHui, parseMontant } from '@/lib/format';

export default function NouvelleDepense() {
  const db = useSQLiteContext();
  const [logements, setLogements] = useState<Logement[]>([]);
  const [montant, setMontant] = useState('');
  const [categorie, setCategorie] = useState<CategorieDepense>('travaux');
  const [logementId, setLogementId] = useState<number>(0);
  const [date, setDate] = useState(aujourdHui());
  const [libelle, setLibelle] = useState('');
  const acces = useAcces();

  useEffect(() => {
    listLogements(db).then(setLogements);
  }, [db]);

  const enregistrer = async () => {
    const m = parseMontant(montant);
    if (m <= 0) return Alert.alert('Montant manquant', 'Indiquez le montant de la dépense.');
    if (!acces.peutModifier()) return;
    await addDepense(db, { logement_id: logementId || null, date, montant: m, categorie, libelle: libelle.trim() });
    fermer();
  };

  return (
    <Screen footer={<Button title="Enregistrer la dépense" onPress={enregistrer} />}>
      <Field label="Montant (GNF)" value={montant} onChangeText={setMontant} keyboardType="number-pad" placeholder="Ex. 350000" autoFocus />
      <T variant="label">Catégorie</T>
      <Chips options={CATEGORIES} value={categorie} onChange={setCategorie} />
      <T variant="label">Logement concerné</T>
      <Chips
        options={[{ value: 0, label: 'Général' }, ...logements.map((l) => ({ value: l.id, label: l.nom }))]}
        value={logementId}
        onChange={setLogementId}
      />
      <Field label="Détail (facultatif)" value={libelle} onChangeText={setLibelle} placeholder="Ex. peinture de la façade" />
      <DateField label="Date" value={date} onChange={setDate} />
    </Screen>
  );
}
