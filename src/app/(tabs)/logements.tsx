import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { Badge, Button, Card, Empty, Row, Screen, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { listLogements, type Logement } from '@/db/queries';
import { formatGNF } from '@/lib/format';

export default function Logements() {
  const db = useSQLiteContext();
  const [logements, setLogements] = useState<Logement[]>([]);

  useFocusEffect(
    useCallback(() => {
      listLogements(db).then(setLogements);
    }, [db]),
  );

  return (
    <Screen tabs>
      <Row style={{ marginTop: Spacing.four }}>
        <T variant="title">Logements</T>
        <Button small title="+ Ajouter" onPress={() => router.push('/logement/nouveau')} />
      </Row>

      {logements.length === 0 ? (
        <Empty title="Aucun logement" text="Ajoutez vos appartements, chambres, magasins ou maisons." />
      ) : (
        logements.map((l) => (
          <Card key={l.id} onPress={() => router.push(`/logement/${l.id}`)}>
            <Row>
              <View style={{ flex: 1 }}>
                <T variant="subtitle">{l.nom}</T>
                {l.adresse ? <T variant="small">{l.adresse}</T> : null}
              </View>
              <Badge label={l.locataire_nom ? 'Occupé' : 'Libre'} tone={l.locataire_nom ? 'success' : 'neutral'} />
            </Row>
            <T variant="small">
              {formatGNF(l.loyer)} / mois{l.locataire_nom ? ` · ${l.locataire_nom}` : ''}
            </T>
          </Card>
        ))
      )}
    </Screen>
  );
}
