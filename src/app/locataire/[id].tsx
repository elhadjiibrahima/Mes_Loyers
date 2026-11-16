import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAcces } from '@/auth/contexte';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Empty,
  Icon,
  IconButton,
  InfoRow,
  Introuvable,
  Row,
  Screen,
  SectionTitle,
  T,
  type IconName,
} from '@/components/ui';
import {
  annulerDepart,
  calendrierAnnee,
  deletePaiementLot,
  calculerSolde,
  getContrat,
  getLocataire,
  loyerDu,
  getProfil,
  libelleMode,
  listPaiements,
  listPaiementsLot,
  payeParMois,
  type Contrat,
  type EtatMois,
  type Locataire,
  type Paiement,
  type Solde,
} from '@/db/queries';
import { useTheme } from '@/hooks/use-theme';
import { partagerQuittance, relancerWhatsApp } from '@/lib/actions';
import { formatDate, formatGNF, formatNombre, libelleMois, libelleMoisCourt, libellePeriode, moisCourant } from '@/lib/format';

const NOMS_MOIS = ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];

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

function GrosBouton({ icon, label, onPress, primary = false }: { icon: IconName; label: string; onPress: () => void; primary?: boolean }) {
  const c = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.grosBouton,
        primary ? { backgroundColor: c.primary } : { backgroundColor: c.backgroundElement, borderWidth: 1, borderColor: c.border },
        pressed && { opacity: 0.8 },
      ]}>
      <Icon name={icon} size={21} color={primary ? c.primaryText : c.primary} />
      <Text style={{ color: primary ? c.primaryText : c.text, fontSize: 13, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

export default function FicheLocataire() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const c = useTheme();
  const [loc, setLoc] = useState<Locataire | null | undefined>(undefined);
  const [contrat, setContrat] = useState<Contrat | null>(null);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [solde, setSolde] = useState<Solde | null>(null);
  const [paye, setPaye] = useState<Map<string, number>>(new Map());
  const [annee, setAnnee] = useState(new Date().getFullYear());
  const acces = useAcces();

  const charger = useCallback(() => {
    const n = Number(id);
    getLocataire(db, n).then(async (l) => {
      if (l) {
        const [ct, p] = await Promise.all([getContrat(db, l), payeParMois(db, l.id)]);
        setContrat(ct);
        setPaye(p);
        setSolde(calculerSolde(ct, p));
      }
      setLoc(l);
    });
    listPaiements(db, n).then(setPaiements);
  }, [db, id]);
  useFocusEffect(charger);

  if (loc === undefined) return null;
  if (loc === null) return <Introuvable quoi="Locataire" />;
  if (!solde || !contrat) return null;
  const parti = loc.date_sortie != null;
  const impayes = solde.moisImpayes.map((m) => m.mois);
  const calendrier = calendrierAnnee(contrat, paye, annee);

  const couleurs: Record<EtatMois, { bg: string; fg: string; marque: string; libelle: string; pointille?: boolean }> = {
    paye: { bg: c.successBg, fg: c.success, marque: '✓', libelle: 'payé' },
    partiel: { bg: c.warningBg, fg: c.warning, marque: '½', libelle: 'partiel' },
    impaye: { bg: c.dangerBg, fg: c.danger, marque: '!', libelle: 'impayé' },
    futur: { bg: c.backgroundElement, fg: c.textSecondary, marque: '', libelle: 'à venir', pointille: true },
    hors: { bg: c.background, fg: c.textSecondary, marque: '–', libelle: 'hors contrat' },
  };

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
          acces.peutModifier() &&
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
    acces.peutModifier() &&
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

  const whatsapp = async () => {
    if (solde.arrieres > 0) {
      relancerWhatsApp({ telephone: loc.telephone, nom: loc.nom, mois: impayes, reste: solde.arrieres, proprietaire: (await getProfil(db)).nom });
    } else if (loc.telephone) {
      const n = loc.telephone.replace(/\D/g, '');
      Linking.openURL(`https://wa.me/${n.length === 9 ? `224${n}` : n}`);
    } else {
      Alert.alert('Pas de numéro', 'Ajoutez un numéro de téléphone à ce locataire.');
    }
  };

  const appeler = () => {
    if (!loc.telephone) return Alert.alert('Pas de numéro', 'Ajoutez un numéro de téléphone à ce locataire.');
    Linking.openURL(`tel:${loc.telephone.replace(/[^\d+]/g, '')}`);
  };

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <IconButton icon="create-outline" label="Modifier" onPress={() => router.push({ pathname: '/locataire/modifier', params: { id: loc.id } })} />
          ),
        }}
      />

      <View style={{ alignItems: 'center', gap: 6 }}>
        <Avatar nom={loc.nom} size={72} tone={parti ? 'neutral' : solde.arrieres > 0 ? 'danger' : 'success'} />
        <T variant="big" style={{ textAlign: 'center' }}>{loc.nom}</T>
        <T variant="small" style={{ textAlign: 'center' }}>
          {loc.logement_nom ?? 'Logement supprimé'} · depuis {libelleMoisCourt(loc.date_entree.slice(0, 7))}
        </T>
        {parti && <Badge label={`Parti le ${formatDate(loc.date_sortie!)}`} tone="neutral" />}
      </View>

      {!parti && (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <GrosBouton primary icon="cash-outline" label="Encaisser" onPress={() => router.push({ pathname: '/paiement/nouveau', params: { locataire: loc.id } })} />
          <GrosBouton icon="chatbubble-outline" label={solde.arrieres > 0 ? 'Relancer' : 'WhatsApp'} onPress={whatsapp} />
          <GrosBouton icon="call-outline" label="Appeler" onPress={appeler} />
        </View>
      )}

      <Card style={{ gap: 12 }}>
        <Row>
          <T variant="small">{solde.arrieres > 0 ? 'Doit au total' : 'Situation'}</T>
          <T variant="small">Loyer {formatNombre(loyerDu(contrat, moisCourant()))} / mois</T>
        </Row>
        {solde.arrieres > 0 ? (
          <>
            <T variant="huge" color={c.danger}>{formatGNF(solde.arrieres)}</T>
            <T variant="small">
              {impayes.length} mois impayé{impayes.length > 1 ? 's' : ''} : {impayes.map(libelleMoisCourt).join(', ')}
            </T>
          </>
        ) : (
          <>
            <T variant="huge" color={c.success}>{solde.enCours ? 'Aucun retard ✓' : 'À jour ✓'}</T>
            {solde.payeJusqua && <T variant="small">Payé jusqu'à {libelleMois(solde.payeJusqua)}</T>}
          </>
        )}
        {solde.enCours && (
          <T variant="small" style={{ fontWeight: '700' }} color={c.warning}>
            Loyer de {libelleMois(solde.enCours.mois)} : {formatGNF(solde.enCours.reste)} à payer avant le{' '}
            {formatDate(solde.enCours.echeance)}
          </T>
        )}
        {solde.avance > 0 && <T variant="small">Dont {formatGNF(solde.avance)} d'avance</T>}

        <Row style={{ marginTop: 4 }}>
          <IconButton icon="chevron-back" label="Année précédente" onPress={() => setAnnee(annee - 1)} />
          <T style={{ fontWeight: '700' }}>Calendrier {String(annee)}</T>
          <IconButton icon="chevron-forward" label="Année suivante" onPress={() => setAnnee(annee + 1)} />
        </Row>
        <View style={styles.grille}>
          {calendrier.map(({ mois, etat }, i) => {
            const k = couleurs[etat];
            const courant = mois === moisCourant();
            return (
              <View
                key={mois}
                accessible
                accessibilityLabel={`${libelleMois(mois)} : ${k.libelle}`}
                style={[
                  styles.case,
                  { backgroundColor: k.bg },
                  k.pointille && { borderWidth: 1, borderStyle: 'dashed', borderColor: c.border },
                  courant && { borderWidth: 2, borderColor: c.text },
                ]}>
                <Text style={{ color: k.fg, fontSize: 11, fontWeight: '700' }}>{NOMS_MOIS[i]}</Text>
                <Text style={{ color: k.fg, fontSize: 11, fontWeight: '700' }}>{k.marque}</Text>
              </View>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          <T variant="small" color={c.success}>✓ Payé</T>
          <T variant="small" color={c.warning}>½ Partiel</T>
          <T variant="small" color={c.danger}>! Impayé</T>
          <T variant="small">□ À venir</T>
        </View>
      </Card>

      <Card style={{ paddingVertical: 4 }}>
        <InfoRow label="Caution" value={formatGNF(loc.caution)} />
        {parti && loc.caution_rendue != null && <InfoRow label="Rendue au départ" value={formatGNF(loc.caution_rendue)} />}
        <InfoRow label="Entré le" value={formatDate(loc.date_entree)} />
        <InfoRow label="Loyer dû le" value={loc.jour_echeance === 1 ? '1er du mois' : `${loc.jour_echeance} du mois`} />
        {contrat.historique.length > 1 &&
          contrat.historique.map((h) => (
            <InfoRow key={h.depuis} label={`Loyer depuis ${libelleMoisCourt(h.depuis)}`} value={formatGNF(h.montant)} />
          ))}
        <InfoRow label="Téléphone" value={loc.telephone ?? '—'} last />
      </Card>

      <SectionTitle title="Historique des paiements" />
      {paiements.length === 0 ? (
        <Empty icon="receipt-outline" title="Aucun paiement" text="Les loyers encaissés apparaîtront ici." />
      ) : (
        grouper(paiements).map((lot) => {
          const p = lot[0];
          const total = lot.reduce((s, x) => s + x.montant, 0);
          return (
            <Card key={p.lot ?? p.id} onPress={() => optionsPaiement(lot)} style={{ padding: 14 }}>
              <Row>
                <View style={{ flex: 1, gap: 2 }}>
                  <T style={{ fontWeight: '700', textTransform: 'capitalize' }}>{libellePeriode(p.mois, lot[lot.length - 1].mois)}</T>
                  <T variant="small">
                    {formatDate(p.date_paiement)} · {libelleMode(p.mode)}
                    {lot.length > 1 ? ` · ${lot.length} mois` : ''}
                  </T>
                </View>
                <T style={{ fontWeight: '800' }}>{formatNombre(total)}</T>
                <Icon name="document-text-outline" size={18} color={c.primary} />
              </Row>
            </Card>
          );
        })
      )}
      {paiements.length > 0 && <T variant="small">Appuyez sur un paiement pour partager sa quittance ou le supprimer.</T>}

      {parti ? (
        <Button variant="secondary" title="Annuler le départ" onPress={annuler} />
      ) : (
        <Button variant="danger" icon="exit-outline" title="Enregistrer le départ" onPress={() => router.push({ pathname: '/locataire/depart', params: { id: loc.id } })} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grosBouton: { flex: 1, height: 66, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 4 },
  grille: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  case: { width: '15%', flexGrow: 1, height: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 1 },
});
