import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { Button, Chips, Field, Screen, T } from '@/components/ui';
import { addLocataire, listLogements, type Logement } from '@/db/queries';
import { aujourdHui, estDateValide } from '@/lib/format';

export default function NouveauLocataire() {
  const db = useSQLiteContext();
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [dateEntree, setDateEntree] = useState(aujourdHui());
  const [logementId, setLogementId] = useState<number | null>(null);
  const [logements, setLogements] = useState<Logement[]>([]);

  useEffect(() => {
    listLogements(db).then(setLogements);
  }, [db]);

  const libres = logements.filter((l) => !l.locataire_nom);

  const enregistrer = async () => {
    if (!nom.trim()) return Alert.alert('Nom manquant', 'Indiquez le nom du locataire.');
    if (!estDateValide(dateEntree)) return Alert.alert('Date invalide', 'Utilisez le format AAAA-MM-JJ.');
    await addLocataire(db, { nom: nom.trim(), telephone: telephone.trim(), logement_id: logementId, date_entree: dateEntree });
    router.back();
  };

  return (
    <Screen>
      <Field label="Nom complet" value={nom} onChangeText={setNom} placeholder="Ex. Fatoumata Bah" autoFocus />
      <Field label="Téléphone (WhatsApp)" value={telephone} onChangeText={setTelephone} keyboardType="phone-pad" placeholder="Ex. 620 00 00 00" />
      <Field label="Date d'entrée (AAAA-MM-JJ)" value={dateEntree} onChangeText={setDateEntree} />
      <T variant="small">Logement</T>
      {libres.length === 0 ? (
        <T variant="small">Aucun logement libre. Ajoutez-en un dans l'onglet Logements.</T>
      ) : (
        <Chips options={libres.map((l) => ({ value: l.id, label: l.nom }))} value={logementId} onChange={setLogementId} />
      )}
      <Button title="Enregistrer" onPress={enregistrer} />
    </Screen>
  );
}
