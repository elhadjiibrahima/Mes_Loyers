import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { Button, Card, Field, Screen, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { getProfil, saveProfil, type Profil } from '@/db/queries';

export default function ProfilScreen() {
  const db = useSQLiteContext();
  const [profil, setProfil] = useState<Profil>({ nom: '', telephone: '', ville: '' });

  useFocusEffect(
    useCallback(() => {
      getProfil(db).then(setProfil);
    }, [db]),
  );

  const enregistrer = async () => {
    await saveProfil(db, profil);
    Alert.alert('Enregistré', 'Vos informations apparaîtront sur les quittances et les relances.');
  };

  return (
    <Screen tabs>
      <T variant="title" style={{ marginTop: Spacing.four }}>Profil</T>
      <Card>
        <T variant="small">Ces informations sont imprimées sur les quittances.</T>
        <Field label="Nom du propriétaire" value={profil.nom} onChangeText={(nom) => setProfil({ ...profil, nom })} placeholder="Ex. Mamadou Diallo" />
        <Field label="Téléphone" value={profil.telephone} keyboardType="phone-pad" onChangeText={(telephone) => setProfil({ ...profil, telephone })} placeholder="Ex. 620 00 00 00" />
        <Field label="Ville" value={profil.ville} onChangeText={(ville) => setProfil({ ...profil, ville })} placeholder="Ex. Conakry" />
      </Card>
      <Button title="Enregistrer" onPress={enregistrer} />
      <T variant="small">Vos données restent sur ce téléphone et fonctionnent sans connexion.</T>
    </Screen>
  );
}
