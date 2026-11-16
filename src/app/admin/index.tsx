import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';

import { listProprietaires, statistiques, tousLesAbonnements, type ProprietaireAdmin, type StatsAdmin } from '@/auth/comptes';
import { useAuth } from '@/auth/contexte';
import { formule } from '@/auth/formules';
import { Avatar, Badge, Card, Chips, Empty, Icon, IconButton, Row, Screen, SectionTitle, T, type Tone } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { formatCourt, formatDate, formatGNF } from '@/lib/format';

type Filtre = 'tous' | 'essai' | 'actif' | 'expire';

const STATUT: Record<ProprietaireAdmin['abonnement']['statut'], { label: string; tone: Tone }> = {
  essai: { label: 'Essai', tone: 'warning' },
  actif: { label: 'Actif', tone: 'success' },
  expire: { label: 'Expiré', tone: 'danger' },
};

function normaliser(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export default function Administration() {
  const c = useTheme();
  const { compte, deconnexion } = useAuth();
  const [liste, setListe] = useState<ProprietaireAdmin[] | null>(null);
  const [stats, setStats] = useState<StatsAdmin | null>(null);
  const [filtre, setFiltre] = useState<Filtre>('tous');
  const [recherche, setRecherche] = useState('');

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [l, h] = await Promise.all([listProprietaires(), tousLesAbonnements()]);
        setListe(l);
        setStats(statistiques(l, h));
      })();
    }, []),
  );

  const seDeconnecter = () =>
    Alert.alert('Se déconnecter ?', undefined, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Se déconnecter', style: 'destructive', onPress: () => deconnexion() },
    ]);

  if (!liste || !stats) return null;
  const q = normaliser(recherche.trim());
  const visibles = liste
    .filter((p) => filtre === 'tous' || p.abonnement.statut === filtre)
    .filter((p) => !q || normaliser(`${p.nom} ${p.email}`).includes(q));

  const tuile = (valeur: string, libelle: string, couleur: string = c.inverseText) => (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={{ color: couleur, fontSize: 20, fontWeight: '800' }} numberOfLines={1}>
        {valeur}
      </Text>
      <Text style={{ color: c.inverseMuted, fontSize: 12 }}>{libelle}</Text>
    </View>
  );

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: 'Administration',
          headerRight: () => <IconButton icon="log-out-outline" label="Se déconnecter" onPress={seDeconnecter} />,
        }}
      />
      <T variant="small">Connecté en administrateur : {compte?.email}</T>

      <View style={{ backgroundColor: c.inverse, borderRadius: 18, padding: 16, gap: 16 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {tuile(formatCourt(stats.revenuRecurrent), 'Revenu mensuel récurrent', '#7DDBB8')}
          {tuile(formatCourt(stats.revenusMois), 'Encaissé ce mois')}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {tuile(String(stats.total), 'Propriétaires')}
          {tuile(String(stats.essai), 'En essai')}
          {tuile(String(stats.actifs), 'Abonnés')}
          {tuile(String(stats.expires), 'Expirés', stats.expires ? '#F8A5A5' : c.inverseText)}
        </View>
      </View>

      <SectionTitle title="Propriétaires" />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.backgroundElement, borderRadius: 12, paddingHorizontal: 12, minHeight: 46 }}>
        <Icon name="search-outline" size={18} color={c.textSecondary} />
        <TextInput
          value={recherche}
          onChangeText={setRecherche}
          placeholder="Nom ou e-mail…"
          placeholderTextColor={c.textSecondary}
          accessibilityLabel="Rechercher un propriétaire"
          autoCapitalize="none"
          style={{ flex: 1, color: c.text, fontSize: 15, paddingVertical: 10 }}
        />
      </View>
      <Chips
        dark
        value={filtre}
        onChange={setFiltre}
        options={[
          { value: 'tous', label: `Tous (${stats.total})` },
          { value: 'essai', label: `Essai (${stats.essai})` },
          { value: 'actif', label: `Abonnés (${stats.actifs})` },
          { value: 'expire', label: `Expirés (${stats.expires})` },
        ]}
      />

      {liste.length === 0 ? (
        <Empty icon="people-outline" title="Aucun propriétaire" text="Les comptes créés sur cet appareil apparaîtront ici." />
      ) : (
        visibles.map((p) => {
          const st = STATUT[p.abonnement.statut];
          return (
            <Card key={p.id} onPress={() => router.push(`/admin/${p.id}`)} style={{ padding: 14 }}>
              <Row style={{ gap: 12 }}>
                <Avatar nom={p.nom} tone={st.tone} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T style={{ fontWeight: '700' }} numberOfLines={1}>{p.nom}</T>
                  <T variant="small" numberOfLines={1}>{p.email}</T>
                  <T variant="small" numberOfLines={1}>
                    {p.nbLogements ?? '?'} logement{(p.nbLogements ?? 0) > 1 ? 's' : ''} ·{' '}
                    {p.abonnement.statut === 'essai' ? `essai jusqu'au ${formatDate(p.abonnement.fin)}` : formule(p.abonnement.formule).nom}
                  </T>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Badge label={st.label} tone={st.tone} />
                  {p.abonnement.statut === 'actif' && <T variant="small">{formatGNF(formule(p.abonnement.formule).prixMensuel)}</T>}
                </View>
              </Row>
            </Card>
          );
        })
      )}
      {liste.length > 0 && visibles.length === 0 && <T variant="small" style={{ textAlign: 'center' }}>Aucun résultat.</T>}
    </Screen>
  );
}
