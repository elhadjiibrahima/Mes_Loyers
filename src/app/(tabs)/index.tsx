import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddButton } from '@/components/add-menu';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Empty,
  IconButton,
  ProgressBar,
  Row,
  Screen,
  SectionTitle,
  StatTile,
  T,
  type Tone,
} from '@/components/ui';
import { Spacing, WebTabInset } from '@/constants/theme';
import { ficheSolde, getLocataire, getProfil, situationDuMois, type LigneMois } from '@/db/queries';
import { useTheme } from '@/hooks/use-theme';
import { relancerWhatsApp } from '@/lib/actions';
import { decalerMois, formatCourt, formatGNF, formatNombre, libelleMois, moisCourant, salutation } from '@/lib/format';

const TONE: Record<LigneMois['statut'], Tone> = { paye: 'success', partiel: 'warning', impaye: 'danger' };

export default function Accueil() {
  const db = useSQLiteContext();
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [mois, setMois] = useState(moisCourant());
  const [lignes, setLignes] = useState<LigneMois[]>([]);
  const [proprio, setProprio] = useState('');

  useFocusEffect(
    useCallback(() => {
      situationDuMois(db, mois).then(setLignes);
      getProfil(db).then((p) => setProprio(p.nom));
    }, [db, mois]),
  );

  const attendu = lignes.reduce((s, l) => s + l.du, 0);
  const encaisse = lignes.reduce((s, l) => s + Math.min(l.paye, l.du), 0);
  const arrieres = lignes.reduce((s, l) => s + l.arrieresAvant, 0);
  const taux = attendu > 0 ? Math.round((encaisse / attendu) * 100) : 0;
  const compte = (st: LigneMois['statut']) => lignes.filter((l) => l.statut === st).length;

  const aRelancer = lignes
    .filter((l) => l.statut !== 'paye' || l.arrieresAvant > 0)
    .map((l) => ({ ...l, doit: Math.max(l.du - l.paye, 0) + l.arrieresAvant }))
    .sort((a, b) => b.doit - a.doit);
  const aJour = lignes.filter((l) => l.statut === 'paye' && l.arrieresAvant === 0);

  const relancer = async (l: LigneMois) => {
    const loc = await getLocataire(db, l.locataire_id);
    if (!loc) return;
    const solde = await ficheSolde(db, loc, mois);
    relancerWhatsApp({
      telephone: l.telephone,
      nom: l.nom,
      mois: solde.moisImpayes.map((m) => m.mois),
      reste: solde.arrieres,
      proprietaire: proprio,
    });
  };

  const detail = (l: LigneMois & { doit: number }) => {
    const nbMois = Math.round(l.doit / Math.max(l.du, 1));
    if (l.statut === 'partiel' && l.arrieresAvant === 0) return 'partiel';
    return nbMois > 1 ? `${nbMois} mois de retard` : 'loyer du mois';
  };

  const bandeau = (
    <View
      style={{
        backgroundColor: c.hero,
        paddingTop: insets.top + Spacing.four + WebTabInset,
        paddingHorizontal: Spacing.four,
        paddingBottom: 72,
        gap: Spacing.three,
      }}>
      <Row>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.heroMuted, fontSize: 14 }}>{salutation()},</Text>
          {proprio ? (
            <Text style={{ color: c.heroText, fontSize: 22, fontWeight: '800' }} numberOfLines={1}>
              {proprio}
            </Text>
          ) : (
            <Pressable onPress={() => router.push('/profil')} accessibilityRole="link">
              <Text style={{ color: c.heroText, fontSize: 18, fontWeight: '700', textDecorationLine: 'underline' }}>
                Ajoutez votre nom
              </Text>
            </Pressable>
          )}
        </View>
      </Row>
      <Row>
        <IconButton icon="chevron-back" label="Mois précédent" variant="onHero" onPress={() => setMois(decalerMois(mois, -1))} />
        <Text style={{ color: c.heroText, fontSize: 16, fontWeight: '700', textTransform: 'capitalize' }}>{libelleMois(mois)}</Text>
        <IconButton icon="chevron-forward" label="Mois suivant" variant="onHero" onPress={() => setMois(decalerMois(mois, 1))} />
      </Row>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <Screen tabs top={bandeau}>
        <Card
          style={{
            marginTop: -56,
            gap: 14,
            padding: 20,
            ...Platform.select({
              web: { boxShadow: '0 8px 24px rgba(19,32,27,0.08)' },
              default: { shadowColor: '#13201B', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
            }),
          }}>
          <Row style={{ alignItems: 'flex-end' }}>
            <View style={{ flex: 1, gap: 4 }}>
              <T variant="small">Encaissé ce mois</T>
              <Text style={{ color: c.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }}>
                {formatNombre(encaisse)} <Text style={{ fontSize: 15, color: c.textSecondary, fontWeight: '600' }}>GNF</Text>
              </Text>
            </View>
            <T style={{ fontWeight: '800' }} color={c.primary}>{`${taux} %`}</T>
          </Row>
          <ProgressBar value={taux} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <StatTile value={compte('paye')} label={compte('paye') > 1 ? 'Payés' : 'Payé'} tone="success" />
            <StatTile value={compte('partiel')} label={compte('partiel') > 1 ? 'Partiels' : 'Partiel'} tone="warning" />
            <StatTile value={compte('impaye')} label={compte('impaye') > 1 ? 'Impayés' : 'Impayé'} tone="danger" />
          </View>
          <Row style={{ flexWrap: 'wrap' }}>
            <T variant="small">Attendu : {formatGNF(attendu)}</T>
            {arrieres > 0 && (
              <T variant="small" color={c.danger} style={{ fontWeight: '700' }}>
                + {formatNombre(arrieres)} d'arriérés
              </T>
            )}
          </Row>
        </Card>

        {lignes.length === 0 ? (
          <Empty
            icon="home-outline"
            title="Aucun locataire ce mois-ci"
            text="Ajoutez un logement puis un locataire pour suivre vos loyers."
            action={<Button title="Ajouter un logement" onPress={() => router.push('/logement/nouveau')} />}
          />
        ) : (
          <>
            {aRelancer.length > 0 && <SectionTitle title="À relancer" />}
            {aRelancer.map((l) => (
              <Card key={l.locataire_id} style={{ gap: 12, padding: 14 }}>
                <Pressable
                  onPress={() => router.push(`/locataire/${l.locataire_id}`)}
                  accessibilityRole="link"
                  accessibilityLabel={`Voir la fiche de ${l.nom}`}
                  style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12 }, pressed && { opacity: 0.7 }]}>
                  <Avatar nom={l.nom} tone={l.arrieresAvant > 0 ? 'danger' : TONE[l.statut]} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <T style={{ fontWeight: '700' }} numberOfLines={1}>{l.nom}</T>
                    <T variant="small" numberOfLines={1}>
                      {l.logement_nom ?? 'Logement supprimé'} · {detail(l)}
                    </T>
                  </View>
                  <T style={{ fontWeight: '800' }} color={l.arrieresAvant > 0 || l.statut === 'impaye' ? c.danger : c.warning}>
                    {formatCourt(l.doit)}
                  </T>
                </Pressable>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button
                    small
                    title="Encaisser"
                    style={{ flex: 1 }}
                    onPress={() => router.push({ pathname: '/paiement/nouveau', params: { locataire: l.locataire_id, mois } })}
                  />
                  <Button small variant="secondary" icon="chatbubble-outline" title="Relancer" style={{ flex: 1 }} onPress={() => relancer(l)} />
                </View>
              </Card>
            ))}

            {aJour.length > 0 && <SectionTitle title="À jour" />}
            {aJour.map((l) => (
              <Card key={l.locataire_id} onPress={() => router.push(`/locataire/${l.locataire_id}`)} style={{ padding: 14 }}>
                <Row style={{ gap: 12 }}>
                  <Avatar nom={l.nom} tone="success" />
                  <View style={{ flex: 1, gap: 2 }}>
                    <T style={{ fontWeight: '700' }} numberOfLines={1}>{l.nom}</T>
                    <T variant="small" numberOfLines={1}>{l.logement_nom ?? 'Logement supprimé'}</T>
                  </View>
                  <Badge label="Payé" tone="success" />
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
