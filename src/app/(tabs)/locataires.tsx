import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { Badge, Button, Card, Empty, Row, Screen, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { listLocataires, type Locataire } from '@/db/queries';
import { formatGNF } from '@/lib/format';

export default function Locataires() {
  const db = useSQLiteContext();
  const [locataires, setLocataires] = useState<Locataire[]>([]);

  useFocusEffect(
    useCallback(() => {
      listLocataires(db).then(setLocataires);
    }, [db]),
  );

  return (
    <Screen tabs>
      <Row style={{ marginTop: Spacing.four }}>
        <T variant="title">Locataires</T>
        <Button small title="+ Ajouter" onPress={() => router.push('/locataire/nouveau')} />
      </Row>

      {locataires.length === 0 ? (
        <Empty title="Aucun locataire" text="Ajoutez un locataire et associez-le à un logement." />
      ) : (
        locataires.map((l) => (
          <Card key={l.id} onPress={() => router.push(`/locataire/${l.id}`)}>
            <Row>
              <View style={{ flex: 1 }}>
                <T variant="subtitle">{l.nom}</T>
                <T variant="small">
                  {l.logement_nom ?? 'Sans logement'}
                  {l.loyer ? ` · ${formatGNF(l.loyer)}` : ''}
                </T>
              </View>
              {!l.actif && <Badge label="Parti" tone="neutral" />}
            </Row>
          </Card>
        ))
      )}
    </Screen>
  );
}
