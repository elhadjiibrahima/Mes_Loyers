import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { useAcces } from '@/auth/contexte';
import { FormulaireLocataire } from '@/components/locataire-form';
import { Button, Introuvable, Screen } from '@/components/ui';
import { deleteLocataire, getLocataire, updateLocataire, type Locataire } from '@/db/queries';
import { fermer } from '@/lib/actions';

export default function ModifierLocataire() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const [loc, setLoc] = useState<Locataire | null | undefined>(undefined);
  const acces = useAcces();

  useEffect(() => {
    getLocataire(db, Number(id)).then(setLoc);
  }, [db, id]);

  if (loc === undefined) return null;
  if (loc === null) return <Introuvable quoi="Locataire" />;

  const supprimer = () =>
    acces.peutModifier() &&
    Alert.alert(
      'Supprimer définitivement ?',
      `${loc.nom} et tous ses paiements seront effacés. Pour un locataire qui quitte le logement, utilisez plutôt « Enregistrer le départ ».`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await deleteLocataire(db, loc.id);
            if (router.canDismiss()) router.dismissAll();
            router.replace('/locataires');
          },
        },
      ],
    );

  return (
    <Screen>
      <FormulaireLocataire
        initial={loc}
        onSubmit={async (data) => {
          await updateLocataire(db, loc.id, data);
          fermer();
        }}
      />
      <Button variant="danger" icon="trash-outline" title="Supprimer ce locataire" onPress={supprimer} />
    </Screen>
  );
}
