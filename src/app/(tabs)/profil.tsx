import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';

import { Avatar, Button, Card, Field, Icon, Row, Screen, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { getProfil, saveProfil, type Profil } from '@/db/queries';
import { useTheme } from '@/hooks/use-theme';

export default function ProfilScreen() {
  const db = useSQLiteContext();
  const c = useTheme();
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

      <View style={{ alignItems: 'center', gap: 6 }}>
        <Avatar nom={profil.nom || '?'} size={72} />
        <T variant="subtitle">{profil.nom || 'Propriétaire'}</T>
        {profil.ville ? <T variant="small">{profil.ville}</T> : null}
      </View>

      <Card>
        <T variant="small">Ces informations sont imprimées sur les quittances et signent vos relances.</T>
        <Field label="Nom du propriétaire" value={profil.nom} onChangeText={(nom) => setProfil({ ...profil, nom })} placeholder="Ex. Mamadou Diallo" />
        <Field label="Téléphone" value={profil.telephone} keyboardType="phone-pad" onChangeText={(telephone) => setProfil({ ...profil, telephone })} placeholder="Ex. 620 00 00 00" />
        <Field label="Ville" value={profil.ville} onChangeText={(ville) => setProfil({ ...profil, ville })} placeholder="Ex. Conakry" />
      </Card>
      <Button title="Enregistrer" onPress={enregistrer} />

      <Card style={{ backgroundColor: c.successBg }}>
        <Row style={{ justifyContent: 'flex-start', gap: 10 }}>
          <Icon name="phone-portrait-outline" color={c.success} />
          <T style={{ flex: 1 }} color={c.success}>Vos données restent sur ce téléphone et fonctionnent sans connexion.</T>
        </Row>
      </Card>
    </Screen>
  );
}
