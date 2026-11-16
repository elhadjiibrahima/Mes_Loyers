import { Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { Button, Field, Screen, T } from '@/components/ui';
import { deleteLogement, getLogement, updateLogement, type Logement } from '@/db/queries';
import { fermer } from '@/lib/actions';
import { parseMontant } from '@/lib/format';

export default function ModifierLogement() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const [logement, setLogement] = useState<Logement | null>(null);
  const [nom, setNom] = useState('');
  const [adresse, setAdresse] = useState('');
  const [loyer, setLoyer] = useState('');

  useEffect(() => {
    getLogement(db, Number(id)).then((l) => {
      if (!l) return;
      setLogement(l);
      setNom(l.nom);
      setAdresse(l.adresse ?? '');
      setLoyer(String(l.loyer));
    });
  }, [db, id]);

  if (!logement) return null;

  const enregistrer = async () => {
    const montant = parseMontant(loyer);
    if (!nom.trim() || montant <= 0) return Alert.alert('Champs manquants', 'Indiquez un nom et un loyer mensuel.');
    await updateLogement(db, logement.id, { nom: nom.trim(), adresse: adresse.trim(), loyer: montant });
    fermer();
  };

  const supprimer = () => {
    if (logement.locataire_id) {
      Alert.alert('Logement occupé', `Enregistrez d'abord le départ de ${logement.locataire_nom}.`);
      return;
    }
    Alert.alert('Supprimer ce logement ?', `${logement.nom} sera supprimé. L'historique des anciens locataires est conservé.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          await deleteLogement(db, logement.id);
          fermer();
        },
      },
    ]);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: logement.nom }} />
      <Field label="Nom" value={nom} onChangeText={setNom} />
      <Field label="Adresse (facultatif)" value={adresse} onChangeText={setAdresse} />
      <Field label="Loyer mensuel (GNF)" value={loyer} onChangeText={setLoyer} keyboardType="number-pad" />
      {logement.locataire_nom && (
        <T variant="small">
          Occupé par {logement.locataire_nom}. Ce loyer s'applique aux prochains locataires ; le loyer du locataire
          actuel se modifie depuis sa fiche.
        </T>
      )}
      <Button title="Enregistrer" onPress={enregistrer} />
      <Button variant="secondary" title="Supprimer le logement" onPress={supprimer} />
    </Screen>
  );
}
