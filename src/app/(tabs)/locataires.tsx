import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { Badge, Button, Card, Empty, Row, Screen, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { ficheSolde, listLocataires, type Locataire } from '@/db/queries';
import { useTheme } from '@/hooks/use-theme';
import { formatGNF } from '@/lib/format';

type Ligne = Locataire & { arrieres: number };

export default function Locataires() {
  const db = useSQLiteContext();
  const c = useTheme();
  const [locataires, setLocataires] = useState<Ligne[]>([]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const locs = await listLocataires(db);
        const avecSolde = await Promise.all(locs.map(async (l) => ({ ...l, arrieres: (await ficheSolde(db, l)).arrieres })));
        setLocataires(avecSolde);
      })();
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
                  {l.logement_nom ?? 'Logement supprimé'} · {formatGNF(l.loyer)}
                </T>
              </View>
              {l.date_sortie ? (
                <Badge label="Parti" tone="neutral" />
              ) : l.arrieres > 0 ? (
                <Badge label="En retard" tone="danger" />
              ) : (
                <Badge label="À jour" tone="success" />
              )}
            </Row>
            {l.arrieres > 0 && <T variant="small" color={c.danger}>Doit {formatGNF(l.arrieres)}</T>}
          </Card>
        ))
      )}
    </Screen>
  );
}
