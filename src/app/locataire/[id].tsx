import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';

import { Button, Card, Empty, Row, Screen, T } from '@/components/ui';
import {
  deletePaiement,
  getLocataire,
  getProfil,
  listPaiements,
  MODES,
  setLocataireActif,
  type Locataire,
  type Paiement,
} from '@/db/queries';
import { useTheme } from '@/hooks/use-theme';
import { partagerQuittance, relancerWhatsApp } from '@/lib/actions';
import { formatDate, formatGNF, libelleMois, moisCourant } from '@/lib/format';

export default function FicheLocataire() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const c = useTheme();
  const [loc, setLoc] = useState<Locataire | null>(null);
  const [paiements, setPaiements] = useState<Paiement[]>([]);

  const charger = useCallback(() => {
    const n = Number(id);
    getLocataire(db, n).then(setLoc);
    listPaiements(db, n).then(setPaiements);
  }, [db, id]);
  useFocusEffect(charger);

  if (!loc) return null;

  const mois = moisCourant();
  const payeCeMois = paiements.filter((p) => p.mois === mois).reduce((s, p) => s + p.montant, 0);
  const reste = Math.max((loc.loyer ?? 0) - payeCeMois, 0);

  const quittance = async (p: Paiement) => partagerQuittance(p, loc, await getProfil(db));

  const optionsPaiement = (p: Paiement) =>
    Alert.alert(`${formatGNF(p.montant)} · ${libelleMois(p.mois)}`, undefined, [
      { text: 'Partager la quittance', onPress: () => quittance(p) },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          await deletePaiement(db, p.id);
          charger();
        },
      },
      { text: 'Annuler', style: 'cancel' },
    ]);

  const basculerActif = () =>
    Alert.alert(loc.actif ? 'Marquer comme parti ?' : 'Réactiver ce locataire ?', 'Le logement sera libéré.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Confirmer',
        onPress: async () => {
          await setLocataireActif(db, loc.id, !loc.actif);
          charger();
        },
      },
    ]);

  return (
    <Screen>
      <Stack.Screen options={{ title: loc.nom }} />

      <Card>
        <T variant="small">{loc.logement_nom ?? 'Sans logement'} · depuis le {formatDate(loc.date_entree)}</T>
        {loc.telephone ? <T>{loc.telephone}</T> : null}
        <T variant="small">Ce mois ({libelleMois(mois)})</T>
        <T variant="big" color={reste > 0 ? c.danger : c.success}>
          {reste > 0 ? `Reste ${formatGNF(reste)}` : 'À jour ✓'}
        </T>
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
          <Button
            small
            title="Encaisser"
            onPress={() =>
              router.push({ pathname: '/paiement/nouveau', params: { locataire: loc.id, mois, montant: reste || loc.loyer || 0 } })
            }
          />
          {reste > 0 && (
            <Button
              small
              variant="secondary"
              title="Relancer WhatsApp"
              onPress={async () =>
                relancerWhatsApp({ telephone: loc.telephone, nom: loc.nom, mois, reste, proprietaire: (await getProfil(db)).nom })
              }
            />
          )}
        </Row>
      </Card>

      <T variant="subtitle">Historique des paiements</T>
      {paiements.length === 0 ? (
        <Empty title="Aucun paiement" text="Les loyers encaissés apparaîtront ici." />
      ) : (
        paiements.map((p) => (
          <Card key={p.id} onPress={() => optionsPaiement(p)}>
            <Row>
              <View>
                <T variant="subtitle" style={{ textTransform: 'capitalize' }}>{libelleMois(p.mois)}</T>
                <T variant="small">
                  {formatDate(p.date_paiement)} · {MODES.find((m) => m.value === p.mode)?.label}
                </T>
              </View>
              <T variant="subtitle">{formatGNF(p.montant)}</T>
            </Row>
          </Card>
        ))
      )}
      {paiements.length > 0 && <T variant="small">Appuyez sur un paiement pour partager sa quittance PDF.</T>}

      <Button variant="secondary" title={loc.actif ? 'Marquer comme parti' : 'Réactiver'} onPress={basculerActif} />
    </Screen>
  );
}
