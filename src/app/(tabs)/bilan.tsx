import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { useAcces } from '@/auth/contexte';
import {
  Button,
  Card,
  Empty,
  Icon,
  IconButton,
  InfoRow,
  Row,
  Screen,
  SectionTitle,
  T,
} from '@/components/ui';
import { Spacing } from '@/constants/theme';
import {
  bilanAnnee,
  deleteDepense,
  getProfil,
  libelleCategorie,
  listDepenses,
  type Bilan,
  type Depense,
} from '@/db/queries';
import { useTheme } from '@/hooks/use-theme';
import { partagerBilan } from '@/lib/actions';
import { formatCourt, formatDate, formatGNF, formatNombre } from '@/lib/format';

const MOIS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

export default function BilanScreen() {
  const db = useSQLiteContext();
  const c = useTheme();
  const [annee, setAnnee] = useState(new Date().getFullYear());
  const [bilan, setBilan] = useState<Bilan | null>(null);
  const [depenses, setDepenses] = useState<Depense[]>([]);
  const acces = useAcces();

  const charger = useCallback(() => {
    bilanAnnee(db, annee).then(setBilan);
    listDepenses(db, annee).then(setDepenses);
  }, [db, annee]);
  useFocusEffect(charger);

  if (!bilan) return null;
  const net = bilan.revenus - bilan.depenses;
  const max = Math.max(...bilan.revenusParMois, ...bilan.depensesParMois, 1);

  const supprimer = (d: Depense) =>
    acces.peutModifier() &&
    Alert.alert('Supprimer cette dépense ?', `${libelleCategorie(d.categorie)} · ${formatGNF(d.montant)}`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          await deleteDepense(db, d.id);
          charger();
        },
      },
    ]);

  const chiffre = (valeur: string, libelle: string, couleur: string) => (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={{ color: couleur, fontSize: 20, fontWeight: '800' }} numberOfLines={1}>
        {valeur}
      </Text>
      <Text style={{ color: c.inverseMuted, fontSize: 12 }}>{libelle}</Text>
    </View>
  );

  return (
    <Screen tabs>
      <Row style={{ marginTop: Spacing.four }}>
        <T variant="title">Bilan</T>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <IconButton icon="chevron-back" label="Année précédente" onPress={() => setAnnee(annee - 1)} />
          <T style={{ fontWeight: '800' }}>{String(annee)}</T>
          <IconButton icon="chevron-forward" label="Année suivante" onPress={() => setAnnee(annee + 1)} />
        </View>
      </Row>

      <View style={{ backgroundColor: c.inverse, borderRadius: 18, padding: 16, flexDirection: 'row', gap: 8 }}>
        {chiffre(formatCourt(bilan.revenus), 'Encaissé', c.inverseText)}
        {chiffre(formatCourt(bilan.depenses), 'Dépenses', c.inverseText)}
        {chiffre(formatCourt(net), 'Bénéfice net', net >= 0 ? '#7DDBB8' : '#F8A5A5')}
      </View>

      <Card style={{ gap: 12 }}>
        <Row>
          <T variant="label">Par mois</T>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <T variant="small" color={c.success}>■ Encaissé</T>
            <T variant="small" color={c.warning}>■ Dépenses</T>
          </View>
        </Row>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 140, gap: 4 }} accessible accessibilityLabel={`Encaissements ${annee} par mois`}>
          {MOIS.map((m, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 1, height: 116 }}>
                <View style={{ width: 8, borderRadius: 3, backgroundColor: c.primary, height: Math.max((bilan.revenusParMois[i] / max) * 116, 2) }} />
                <View style={{ width: 5, borderRadius: 3, backgroundColor: c.warning, height: Math.max((bilan.depensesParMois[i] / max) * 116, bilan.depensesParMois[i] ? 2 : 0) }} />
              </View>
              <Text style={{ color: c.textSecondary, fontSize: 11 }}>{m}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Button variant="secondary" icon="document-text-outline" title="Exporter le bilan en PDF" onPress={async () => partagerBilan(bilan, depenses, await getProfil(db))} />

      {bilan.parLogement.length > 0 && (
        <>
          <SectionTitle title="Par logement" />
          <Card style={{ paddingVertical: 4 }}>
            {bilan.parLogement.map((l, i) => (
              <InfoRow
                key={l.nom}
                label={l.nom}
                value={`${formatCourt(l.revenus)} − ${formatCourt(l.depenses)} = ${formatCourt(l.revenus - l.depenses)}`}
                last={i === bilan.parLogement.length - 1}
              />
            ))}
          </Card>
        </>
      )}

      <SectionTitle
        title="Dépenses"
        action={<Button small title="+ Ajouter" onPress={() => router.push('/depense/nouveau')} />}
      />
      {depenses.length === 0 ? (
        <Empty icon="construct-outline" title={`Aucune dépense en ${annee}`} text="Travaux, électricité, eau, taxes… pour connaître votre vrai bénéfice." />
      ) : (
        depenses.map((d) => (
          <Card key={d.id} onPress={() => supprimer(d)} style={{ padding: 14 }}>
            <Row style={{ gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.warningBg, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="construct-outline" size={20} color={c.warning} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <T style={{ fontWeight: '700' }} numberOfLines={1}>
                  {libelleCategorie(d.categorie)}
                  {d.libelle ? ` · ${d.libelle}` : ''}
                </T>
                <T variant="small" numberOfLines={1}>
                  {formatDate(d.date)} · {d.logement_nom ?? 'Général'}
                </T>
              </View>
              <T style={{ fontWeight: '800' }}>{formatNombre(d.montant)}</T>
            </Row>
          </Card>
        ))
      )}
      {depenses.length > 0 && <T variant="small">Appuyez sur une dépense pour la supprimer.</T>}
    </Screen>
  );
}
