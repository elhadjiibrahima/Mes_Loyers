import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { TextInput, View } from 'react-native';

import { AddButton } from '@/components/add-menu';
import { Avatar, Badge, Button, Card, Empty, Icon, IconButton, Row, Screen, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { ficheSolde, listLocataires, type Locataire } from '@/db/queries';
import { useTheme } from '@/hooks/use-theme';
import { formatCourt, formatGNF } from '@/lib/format';

type Ligne = Locataire & { arrieres: number };

/** Ignore accents et majuscules pour la recherche. */
function normaliser(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export default function Locataires() {
  const db = useSQLiteContext();
  const c = useTheme();
  const [locataires, setLocataires] = useState<Ligne[]>([]);
  const [recherche, setRecherche] = useState('');

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const locs = await listLocataires(db);
        setLocataires(await Promise.all(locs.map(async (l) => ({ ...l, arrieres: (await ficheSolde(db, l)).arrieres }))));
      })();
    }, [db]),
  );

  const q = normaliser(recherche.trim());
  const visibles = q
    ? locataires.filter((l) => normaliser(`${l.nom} ${l.logement_nom ?? ''} ${l.telephone ?? ''}`).includes(q))
    : locataires;

  return (
    <View style={{ flex: 1 }}>
      <Screen tabs>
        <Row style={{ marginTop: Spacing.four }}>
          <T variant="title">Locataires</T>
          <IconButton icon="add" label="Ajouter un locataire" variant="primary" onPress={() => router.push('/locataire/nouveau')} />
        </Row>

        {locataires.length === 0 ? (
          <Empty
            icon="people-outline"
            title="Aucun locataire"
            text="Ajoutez un locataire et associez-le à un logement."
            action={<Button title="Ajouter un locataire" onPress={() => router.push('/locataire/nouveau')} />}
          />
        ) : (
          <>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: c.backgroundElement,
                borderRadius: 12,
                paddingHorizontal: 12,
                minHeight: 46,
              }}>
              <Icon name="search-outline" size={18} color={c.textSecondary} />
              <TextInput
                value={recherche}
                onChangeText={setRecherche}
                placeholder="Rechercher un nom, un logement…"
                placeholderTextColor={c.textSecondary}
                accessibilityLabel="Rechercher un locataire"
                style={{ flex: 1, color: c.text, fontSize: 15, paddingVertical: 10 }}
              />
            </View>

            {visibles.map((l) => {
              const parti = l.date_sortie != null;
              return (
                <Card key={l.id} onPress={() => router.push(`/locataire/${l.id}`)} style={{ padding: 14 }}>
                  <Row style={{ gap: 12 }}>
                    <Avatar nom={l.nom} tone={parti ? 'neutral' : l.arrieres > 0 ? 'danger' : 'success'} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <T style={{ fontWeight: '700' }} numberOfLines={1}>{l.nom}</T>
                      <T variant="small" numberOfLines={1}>
                        {l.logement_nom ?? 'Logement supprimé'} · {formatGNF(l.loyer)}
                      </T>
                    </View>
                    {parti ? (
                      <Badge label="Parti" tone="neutral" />
                    ) : l.arrieres > 0 ? (
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <Badge label="En retard" tone="danger" />
                        <T variant="small" color={c.danger} style={{ fontWeight: '700' }}>{formatCourt(l.arrieres)}</T>
                      </View>
                    ) : (
                      <Badge label="À jour" tone="success" />
                    )}
                  </Row>
                </Card>
              );
            })}
            {visibles.length === 0 && <T variant="small" style={{ textAlign: 'center' }}>Aucun résultat pour « {recherche} ».</T>}
          </>
        )}
      </Screen>
      <AddButton />
    </View>
  );
}
