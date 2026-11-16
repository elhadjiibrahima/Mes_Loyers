import { Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { DateField, MonthField } from '@/components/date-fields';
import { Avatar, Button, Card, Chips, Empty, Icon, IconButton, Row, Screen, T, useSaisieRemplace } from '@/components/ui';
import {
  addPaiements,
  ficheSolde,
  getLocataire,
  getProfil,
  listLocataires,
  MODES,
  repartirPaiement,
  type Locataire,
  type ModePaiement,
  type Repartition,
  type Solde,
} from '@/db/queries';
import { useTheme } from '@/hooks/use-theme';
import { fermer, partagerQuittance } from '@/lib/actions';
import {
  aujourdHui,
  decalerMois,
  formatGNF,
  formatNombre,
  libelleMois,
  moisCourant,
  parseMontant,
  prenom,
} from '@/lib/format';

const RACCOURCIS = [1, 3, 6, 12];

/** Liste des locataires actifs, quand l'écran est ouvert depuis le bouton « + ». */
function ChoixLocataire({ onChoix }: { onChoix: (id: number) => void }) {
  const db = useSQLiteContext();
  const [locs, setLocs] = useState<Locataire[] | null>(null);
  useEffect(() => {
    listLocataires(db).then((l) => setLocs(l.filter((x) => !x.date_sortie)));
  }, [db]);
  if (!locs) return null;
  return (
    <Screen>
      <T variant="subtitle">Qui a payé ?</T>
      {locs.length === 0 ? (
        <Empty icon="people-outline" title="Aucun locataire" text="Ajoutez d'abord un locataire." />
      ) : (
        locs.map((l) => (
          <Card key={l.id} onPress={() => onChoix(l.id)} style={{ padding: 14 }}>
            <Row style={{ gap: 12 }}>
              <Avatar nom={l.nom} />
              <View style={{ flex: 1 }}>
                <T style={{ fontWeight: '700' }}>{l.nom}</T>
                <T variant="small">{l.logement_nom ?? 'Logement supprimé'} · {formatGNF(l.loyer)}</T>
              </View>
              <Icon name="chevron-forward" size={18} />
            </Row>
          </Card>
        ))
      )}
    </Screen>
  );
}

export default function NouveauPaiement() {
  const params = useLocalSearchParams<{ locataire?: string; mois?: string }>();
  const [locId, setLocId] = useState<number | null>(params.locataire ? Number(params.locataire) : null);
  if (locId == null) return <ChoixLocataire onChoix={setLocId} />;
  return <FormulairePaiement locId={locId} moisParam={params.mois} />;
}

function FormulairePaiement({ locId, moisParam }: { locId: number; moisParam?: string }) {
  const db = useSQLiteContext();
  const c = useTheme();
  const [loc, setLoc] = useState<Locataire | null>(null);
  const [solde, setSolde] = useState<Solde | null>(null);
  const [premierMois, setPremierMois] = useState(moisParam ?? moisCourant());
  const [montant, setMontant] = useState(0);
  const [date, setDate] = useState(aujourdHui());
  const [mode, setMode] = useState<ModePaiement>('especes');
  const [envoyerQuittance, setEnvoyerQuittance] = useState(true);
  const [repartition, setRepartition] = useState<Repartition[]>([]);
  const [envoi, setEnvoi] = useState(false);

  // Par défaut : commencer au plus ancien mois impayé, montant = ce qui reste sur ce mois.
  useEffect(() => {
    (async () => {
      const l = await getLocataire(db, locId);
      if (!l) return;
      setLoc(l);
      const s = await ficheSolde(db, l);
      setSolde(s);
      // Ordre : plus ancien impayé, puis loyer du mois en cours, puis mois suivant le dernier payé.
      const aRegler = s.moisImpayes[0] ?? s.enCours;
      if (aRegler) {
        setPremierMois(aRegler.mois);
        setMontant(aRegler.reste);
      } else {
        const suivant = s.payeJusqua ? decalerMois(s.payeJusqua, 1) : (moisParam ?? moisCourant());
        setPremierMois(suivant < l.debut_loyer ? l.debut_loyer : suivant);
        setMontant(l.loyer);
      }
    })();
  }, [db, locId, moisParam]);

  const saisie = useSaisieRemplace(montant ? formatNombre(montant) : '', (t) => setMontant(parseMontant(t)), '0');

  useEffect(() => {
    if (!loc || montant <= 0) return setRepartition([]);
    repartirPaiement(db, loc, premierMois, montant).then(setRepartition);
  }, [db, loc, premierMois, montant]);

  if (!loc || !solde) return null;

  // Ce qui restera dû sur les mois échus après ce paiement.
  const reglesEchus = repartition.filter((r) => r.mois <= moisCourant()).reduce((s, r) => s + r.montant, 0);
  const resteApres = Math.max(solde.arrieres + (solde.enCours?.reste ?? 0) - reglesEchus, 0);
  const dernierComplet = [...repartition].reverse().find((r) => r.montant >= loc.loyer)?.mois;

  const nbMoisPayes = loc.loyer > 0 ? Math.round((montant / loc.loyer) * 10) / 10 : 0;

  const enregistrer = async () => {
    if (repartition.length === 0) return Alert.alert('Montant manquant', 'Indiquez le montant reçu.');
    if (nbMoisPayes > 12) {
      Alert.alert(
        'Montant inhabituel',
        `${formatGNF(montant)}, soit ${nbMoisPayes} mois de loyer. Confirmez-vous ce montant ?`,
        [
          { text: 'Corriger', style: 'cancel' },
          { text: 'Confirmer', onPress: valider },
        ],
      );
      return;
    }
    valider();
  };

  const valider = async () => {
    setEnvoi(true);
    const lot = await addPaiements(db, loc.id, repartition, { date_paiement: date, mode });
    fermer();
    if (envoyerQuittance) partagerQuittance(lot, loc, await getProfil(db));
  };

  return (
    <Screen
      footer={
        <>
          <Row>
            <T style={{ flex: 1 }}>Envoyer la quittance</T>
            <Switch value={envoyerQuittance} onValueChange={setEnvoyerQuittance} accessibilityLabel="Envoyer la quittance" />
          </Row>
          <Button
            title={montant > 0 ? `Enregistrer ${formatGNF(montant)}` : 'Enregistrer'}
            onPress={enregistrer}
            disabled={envoi || montant <= 0}
          />
        </>
      }>
      <Stack.Screen options={{ title: 'Encaisser' }} />
      <Row style={{ justifyContent: 'flex-start', gap: 12 }}>
        <Avatar nom={loc.nom} size={40} />
        <View style={{ flex: 1 }}>
          <T style={{ fontWeight: '700' }}>{loc.nom}</T>
          <T variant="small">
            {loc.logement_nom ?? 'Logement supprimé'} · {formatGNF(loc.loyer)} / mois
          </T>
        </View>
      </Row>

      <View style={{ alignItems: 'center', gap: 4, paddingVertical: 8 }}>
        <T variant="small">Montant reçu</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%' }}>
          <TextInput
            value={montant ? formatNombre(montant) : ''}
            onChangeText={(t) => setMontant(parseMontant(t))}
            keyboardType="number-pad"
            placeholderTextColor={c.textSecondary}
            accessibilityLabel="Montant reçu en GNF"
            {...saisie}
            style={[styles.montant, { color: c.text, fontSize: formatNombre(montant).length > 10 ? 30 : 40 }]}
          />
          <Text style={{ color: c.textSecondary, fontSize: 18, fontWeight: '700' }}>GNF</Text>
          {montant > 0 && <IconButton icon="close-circle" label="Effacer le montant" onPress={() => setMontant(0)} />}
        </View>
        {nbMoisPayes > 12 && (
          <T variant="small" color={c.warning} style={{ fontWeight: '700', textAlign: 'center' }}>
            Attention : cela fait {nbMoisPayes} mois de loyer. Vérifiez le montant.
          </T>
        )}
      </View>

      <View style={{ alignItems: 'center' }}>
        <Chips
          options={RACCOURCIS.map((n) => ({ value: n, label: `${n} mois` }))}
          value={RACCOURCIS.find((n) => montant === n * loc.loyer) ?? null}
          onChange={(n) => setMontant(n * loc.loyer)}
        />
      </View>

      <MonthField label="À partir du mois" value={premierMois} onChange={setPremierMois} min={loc.debut_loyer} />

      {repartition.length > 0 && (
        <View style={[styles.regle, { backgroundColor: c.backgroundSelected }]}>
          <T variant="label">Ce paiement règle</T>
          {repartition.map((r) => (
            <Row key={r.mois}>
              <T style={{ textTransform: 'capitalize' }}>
                {libelleMois(r.mois)}
                {r.montant < loc.loyer ? ' (partiel)' : ''}
              </T>
              <T style={{ fontWeight: '700' }}>{formatNombre(r.montant)}</T>
            </Row>
          ))}
          <View style={[styles.conclusion, { borderTopColor: c.border }]}>
            <Icon
              name={resteApres === 0 ? 'checkmark-circle' : 'alert-circle-outline'}
              size={18}
              color={resteApres === 0 ? c.success : c.warning}
            />
            <T style={{ flex: 1, fontWeight: '600' }} color={resteApres === 0 ? c.success : c.warning}>
              {resteApres === 0
                ? dernierComplet
                  ? `${prenom(loc.nom)} sera à jour jusqu'à ${libelleMois(dernierComplet)}`
                  : `${prenom(loc.nom)} sera à jour`
                : `Il restera ${formatGNF(resteApres)} à payer`}
            </T>
          </View>
        </View>
      )}

      <T variant="label">Mode de paiement</T>
      <View style={styles.modes}>
        {MODES.map((m) => {
          const actif = m.value === mode;
          return (
            <Pressable
              key={m.value}
              onPress={() => setMode(m.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: actif }}
              style={[
                styles.mode,
                actif
                  ? { borderWidth: 2, borderColor: c.primary, backgroundColor: c.successBg }
                  : { borderWidth: 1, borderColor: c.border, backgroundColor: c.backgroundElement },
              ]}>
              <Text style={{ color: actif ? c.success : c.text, fontSize: 15, fontWeight: actif ? '800' : '600' }}>{m.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <DateField label="Date du paiement" value={date} onChange={setDate} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  montant: { flex: 1, minWidth: 0, fontSize: 40, fontWeight: '800', letterSpacing: -1, textAlign: 'center', padding: 0 },
  regle: { borderRadius: 16, padding: 16, gap: 10 },
  conclusion: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  modes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mode: { width: '48%', flexGrow: 1, height: 54, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
