import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import { useAcces } from '@/auth/contexte';
import { AddButton } from '@/components/add-menu';
import { Badge, Button, Card, Chips, Empty, Icon, IconButton, Row, Screen, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { listLogements, type Logement } from '@/db/queries';
import { useTheme } from '@/hooks/use-theme';
import { formatCourt, formatNombre, joursDepuis } from '@/lib/format';

type Filtre = 'tous' | 'occupes' | 'libres';

function detail(l: Logement) {
  const lieu = l.adresse ? `${l.adresse} · ` : '';
  if (l.locataire_nom) return `${lieu}${l.locataire_nom}`;
  if (l.libre_depuis) {
    const j = joursDepuis(l.libre_depuis);
    return `${lieu}libre depuis ${j} jour${j > 1 ? 's' : ''}`;
  }
  return `${lieu}jamais loué`;
}

export default function Logements() {
  const db = useSQLiteContext();
  const c = useTheme();
  const [logements, setLogements] = useState<Logement[]>([]);
  const [filtre, setFiltre] = useState<Filtre>('tous');
  const acces = useAcces();
  const ajouter = async () => (await acces.peutAjouterLogement()) && router.push('/logement/nouveau');

  useFocusEffect(
    useCallback(() => {
      listLogements(db).then(setLogements);
    }, [db]),
  );

  const occupes = logements.filter((l) => l.locataire_id);
  const taux = logements.length ? Math.round((occupes.length / logements.length) * 100) : 0;
  const revenu = occupes.reduce((s, l) => s + (l.locataire_loyer ?? l.loyer), 0);
  const visibles = logements.filter((l) => (filtre === 'tous' ? true : filtre === 'occupes' ? l.locataire_id : !l.locataire_id));

  const chiffre = (valeur: string, libelle: string) => (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={{ color: c.inverseText, fontSize: 22, fontWeight: '800' }}>{valeur}</Text>
      <Text style={{ color: c.inverseMuted, fontSize: 12 }}>{libelle}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <Screen tabs fab>
        <Row style={{ marginTop: Spacing.four }}>
          <T variant="title">Logements</T>
          <IconButton icon="add" label="Ajouter un logement" variant="primary" onPress={ajouter} />
        </Row>

        {logements.length === 0 ? (
          <Empty
            icon="business-outline"
            title="Aucun logement"
            text="Ajoutez vos appartements, chambres, magasins ou maisons."
            action={<Button title="Ajouter un logement" onPress={ajouter} />}
          />
        ) : (
          <>
            <View style={{ backgroundColor: c.inverse, borderRadius: 18, padding: 16, flexDirection: 'row', gap: 8 }}>
              {chiffre(String(logements.length), logements.length > 1 ? 'Logements' : 'Logement')}
              {chiffre(`${taux} %`, 'Occupés')}
              {chiffre(formatCourt(revenu), 'GNF / mois')}
            </View>

            <Chips
              dark
              value={filtre}
              onChange={setFiltre}
              options={[
                { value: 'tous', label: 'Tous' },
                { value: 'occupes', label: `Occupés (${occupes.length})` },
                { value: 'libres', label: `Libres (${logements.length - occupes.length})` },
              ]}
            />

            {visibles.map((l) => (
              <Card key={l.id} onPress={() => router.push(`/logement/${l.id}`)} style={{ padding: 14 }}>
                <Row style={{ gap: 12 }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      backgroundColor: l.locataire_id ? c.successBg : c.backgroundSelected,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Icon name="business-outline" color={l.locataire_id ? c.success : c.textSecondary} />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <T style={{ fontWeight: '700' }} numberOfLines={1}>{l.nom}</T>
                    <T variant="small" numberOfLines={2}>{detail(l)}</T>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <Badge label={l.locataire_id ? 'Occupé' : 'Libre'} tone={l.locataire_id ? 'success' : 'neutral'} />
                    <T variant="small" style={{ fontWeight: '700' }} color={c.text}>{formatNombre(l.locataire_loyer ?? l.loyer)}</T>
                  </View>
                </Row>
              </Card>
            ))}
          </>
        )}
      </Screen>
      <AddButton />
    </View>
  );
}
