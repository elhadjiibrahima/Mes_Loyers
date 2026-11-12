import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';

import { Badge, Button, Card, Empty, Row, Screen, T } from '@/components/ui';
import {
  annulerDepart,
  deletePaiementLot,
  ficheSolde,
  getLocataire,
  getProfil,
  libelleMode,
  listPaiements,
  listPaiementsLot,
  type Locataire,
  type Paiement,
  type Solde,
} from '@/db/queries';
import { useTheme } from '@/hooks/use-theme';
import { partagerQuittance, relancerWhatsApp } from '@/lib/actions';
import { formatDate, formatGNF, libelleMois, libelleMoisCourt, libellePeriode } from '@/lib/format';

/** Regroupe les paiements d'un même lot (paiement sur plusieurs mois). */
function grouper(paiements: Paiement[]) {
  const groupes: Paiement[][] = [];
  const parLot = new Map<string, Paiement[]>();
  for (const p of paiements) {
    if (!p.lot) groupes.push([p]);
    else if (parLot.has(p.lot)) parLot.get(p.lot)!.push(p);
    else {
      const g = [p];
      parLot.set(p.lot, g);
      groupes.push(g);
    }
  }
  return groupes.map((g) => [...g].sort((a, b) => a.mois.localeCompare(b.mois)));
}

export default function FicheLocataire() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const c = useTheme();
  const [loc, setLoc] = useState<Locataire | null>(null);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [solde, setSolde] = useState<Solde | null>(null);

  const charger = useCallback(() => {
    const n = Number(id);
    getLocataire(db, n).then(async (l) => {
      setLoc(l);
      if (l) setSolde(await ficheSolde(db, l));
    });
    listPaiements(db, n).then(setPaiements);
  }, [db, id]);
  useFocusEffect(charger);

  if (!loc || !solde) return null;
  const parti = loc.date_sortie != null;

  const optionsPaiement = (lot: Paiement[]) => {
    const total = lot.reduce((s, p) => s + p.montant, 0);
    Alert.alert(`${formatGNF(total)} · ${libellePeriode(lot[0].mois, lot[lot.length - 1].mois)}`, undefined, [
      {
        text: 'Partager la quittance',
        onPress: async () => partagerQuittance(await listPaiementsLot(db, lot[0]), loc, await getProfil(db)),
      },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Supprimer ce paiement ?', lot.length > 1 ? `Les ${lot.length} mois de ce paiement seront supprimés.` : undefined, [
            { text: 'Annuler', style: 'cancel' },
            {
              text: 'Supprimer',
              style: 'destructive',
              onPress: async () => {
                await deletePaiementLot(db, lot[0]);
                charger();
              },
            },
          ]),
      },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const annuler = () =>
    Alert.alert('Annuler le départ ?', 'Le locataire redevient actif et les retenues sur caution sont supprimées.', [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Oui',
        onPress: async () => {
          try {
            await annulerDepart(db, loc);
            charger();
          } catch {
            Alert.alert('Impossible', 'Le logement est maintenant occupé par un autre locataire.');
          }
        },
      },
    ]);

  const impayes = solde.moisImpayes.map((m) => m.mois);

  return (
    <Screen>
      <Stack.Screen options={{ title: loc.nom }} />

      <Card>
        <Row>
          <T variant="small" style={{ flex: 1 }}>
            {loc.logement_nom ?? 'Logement supprimé'} · {formatGNF(loc.loyer)} / mois
          </T>
          {parti && <Badge label="Parti" tone="neutral" />}
        </Row>
        <T variant="small">
          Entré le {formatDate(loc.date_entree)}
          {parti ? ` · sorti le ${formatDate(loc.date_sortie!)}` : ''}
        </T>
        {loc.telephone ? <T>{loc.telephone}</T> : null}

        {solde.arrieres > 0 ? (
          <>
            <T variant="small">Arriérés</T>
            <T variant="big" color={c.danger}>{formatGNF(solde.arrieres)}</T>
            <T variant="small">
              {impayes.length} mois : {impayes.map(libelleMoisCourt).join(', ')}
            </T>
          </>
        ) : (
          <>
            <T variant="big" color={c.success}>À jour ✓</T>
            {solde.payeJusqua && <T variant="small">Payé jusqu'à {libelleMois(solde.payeJusqua)}</T>}
          </>
        )}
        {solde.avance > 0 && <T variant="small">Dont avance : {formatGNF(solde.avance)}</T>}

        {!parti && (
          <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
            <Button small title="Encaisser" onPress={() => router.push({ pathname: '/paiement/nouveau', params: { locataire: loc.id } })} />
            {solde.arrieres > 0 && (
              <Button
                small
                variant="secondary"
                title="Relancer WhatsApp"
                onPress={async () =>
                  relancerWhatsApp({ telephone: loc.telephone, nom: loc.nom, mois: impayes, reste: solde.arrieres, proprietaire: (await getProfil(db)).nom })
                }
              />
            )}
          </Row>
        )}
      </Card>

      <Card>
        <Row>
          <T>Caution</T>
          <T variant="subtitle">{formatGNF(loc.caution)}</T>
        </Row>
        {parti && loc.caution_rendue != null && (
          <Row>
            <T>Rendue au départ</T>
            <T variant="subtitle">{formatGNF(loc.caution_rendue)}</T>
          </Row>
        )}
      </Card>

      <T variant="subtitle">Historique des paiements</T>
      {paiements.length === 0 ? (
        <Empty title="Aucun paiement" text="Les loyers encaissés apparaîtront ici." />
      ) : (
        grouper(paiements).map((lot) => {
          const p = lot[0];
          const total = lot.reduce((s, x) => s + x.montant, 0);
          return (
            <Card key={p.lot ?? p.id} onPress={() => optionsPaiement(lot)}>
              <Row>
                <View style={{ flex: 1 }}>
                  <T variant="subtitle" style={{ textTransform: 'capitalize' }}>
                    {libellePeriode(p.mois, lot[lot.length - 1].mois)}
                  </T>
                  <T variant="small">
                    {formatDate(p.date_paiement)} · {libelleMode(p.mode)}
                    {lot.length > 1 ? ` · ${lot.length} mois` : ''}
                  </T>
                </View>
                <T variant="subtitle">{formatGNF(total)}</T>
              </Row>
            </Card>
          );
        })
      )}
      {paiements.length > 0 && <T variant="small">Appuyez sur un paiement pour partager sa quittance ou le supprimer.</T>}

      <Button variant="secondary" title="Modifier" onPress={() => router.push({ pathname: '/locataire/modifier', params: { id: loc.id } })} />
      {parti ? (
        <Button variant="secondary" title="Annuler le départ" onPress={annuler} />
      ) : (
        <Button variant="danger" title="Enregistrer le départ" onPress={() => router.push({ pathname: '/locataire/depart', params: { id: loc.id } })} />
      )}
    </Screen>
  );
}
