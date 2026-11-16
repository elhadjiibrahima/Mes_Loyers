import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';

import { Avatar, Button, Card, Field, Icon, Row, Screen, SectionTitle, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { getProfil, saveProfil, telephoneValide, type Profil } from '@/db/queries';
import { choisirSauvegarde, exporterSauvegarde, restaurerSauvegarde, resumeSauvegarde } from '@/db/sauvegarde';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/format';

export default function ProfilScreen() {
  const db = useSQLiteContext();
  const c = useTheme();
  const [profil, setProfil] = useState<Profil>({ nom: '', telephone: '', ville: '' });
  const [occupe, setOccupe] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getProfil(db).then(setProfil);
    }, [db]),
  );

  const enregistrer = async () => {
    if (!telephoneValide(profil.telephone)) {
      return Alert.alert('Téléphone invalide', 'Saisissez un numéro avec 8 à 15 chiffres, par exemple 620 00 00 00.');
    }
    await saveProfil(db, { nom: profil.nom.trim(), telephone: profil.telephone.trim(), ville: profil.ville.trim() });
    Alert.alert('Enregistré', 'Vos informations apparaîtront sur les quittances et les relances.');
  };

  const exporter = async () => {
    setOccupe(true);
    try {
      await exporterSauvegarde(db);
    } catch {
      Alert.alert('Erreur', 'La sauvegarde n’a pas pu être créée.');
    } finally {
      setOccupe(false);
    }
  };

  const importer = async () => {
    try {
      const data = await choisirSauvegarde();
      if (!data) return;
      Alert.alert(
        'Restaurer cette sauvegarde ?',
        `Sauvegarde du ${formatDate(data.exporte_le.slice(0, 10))} : ${resumeSauvegarde(data)}.\n\nToutes les données actuelles de ce téléphone seront remplacées.`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Restaurer',
            style: 'destructive',
            onPress: async () => {
              await restaurerSauvegarde(db, data);
              setProfil(await getProfil(db));
              Alert.alert('Restauration terminée', 'Vos données ont été restaurées.');
            },
          },
        ],
      );
    } catch (e) {
      Alert.alert('Fichier non valide', e instanceof Error ? e.message : 'Ce fichier ne peut pas être lu.');
    }
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

      <SectionTitle title="Sauvegarde" />
      <Card style={{ backgroundColor: c.successBg }}>
        <Row style={{ justifyContent: 'flex-start', gap: 10, alignItems: 'flex-start' }}>
          <Icon name="shield-checkmark-outline" color={c.success} />
          <T style={{ flex: 1 }} color={c.success}>
            Vos données sont enregistrées dans une base SQLite sur ce téléphone. Exportez-les régulièrement (WhatsApp,
            Google Drive, e-mail) pour ne rien perdre si le téléphone est perdu ou changé.
          </T>
        </Row>
      </Card>
      <Button icon="cloud-upload-outline" title="Exporter mes données" onPress={exporter} disabled={occupe} />
      <Button variant="secondary" icon="cloud-download-outline" title="Restaurer une sauvegarde" onPress={importer} />
    </Screen>
  );
}
