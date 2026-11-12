import { useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';

import { DateField, MonthField } from '@/components/date-fields';
import { Button, Card, Chips, Field, Row, Screen, T } from '@/components/ui';
import {
  addPaiements,
  ficheSolde,
  getLocataire,
  getProfil,
  MODES,
  repartirPaiement,
  type Locataire,
  type ModePaiement,
  type Repartition,
} from '@/db/queries';
import { fermer, partagerQuittance } from '@/lib/actions';
import { aujourdHui, decalerMois, formatGNF, libelleMois, moisCourant, parseMontant } from '@/lib/format';

const RACCOURCIS = [1, 3, 6, 12];

export default function NouveauPaiement() {
  const params = useLocalSearchParams<{ locataire: string; mois?: string }>();
  const db = useSQLiteContext();
  const [loc, setLoc] = useState<Locataire | null>(null);
  const [premierMois, setPremierMois] = useState(params.mois ?? moisCourant());
  const [montant, setMontant] = useState('');
  const [date, setDate] = useState(aujourdHui());
  const [mode, setMode] = useState<ModePaiement>('especes');
  const [repartition, setRepartition] = useState<Repartition[]>([]);
  const [envoi, setEnvoi] = useState(false);

  // Par défaut : commencer au plus ancien mois impayé, montant = ce qui reste sur ce mois.
  useEffect(() => {
    (async () => {
      const l = await getLocataire(db, Number(params.locataire));
      if (!l) return;
      setLoc(l);
      const solde = await ficheSolde(db, l, params.mois ?? moisCourant());
      const ancien = solde.moisImpayes[0];
      if (ancien) {
        setPremierMois(ancien.mois);
        setMontant(String(ancien.reste));
      } else if (!params.mois && solde.payeJusqua) {
        setPremierMois(decalerMois(solde.payeJusqua, 1));
        setMontant(String(l.loyer));
      } else {
        setMontant(String(l.loyer));
      }
    })();
  }, [db, params.locataire, params.mois]);

  useEffect(() => {
    const m = parseMontant(montant);
    if (!loc || m <= 0) return setRepartition([]);
    repartirPaiement(db, loc, premierMois, m).then(setRepartition);
  }, [db, loc, premierMois, montant]);

  if (!loc) return null;

  const enregistrer = async () => {
    if (repartition.length === 0) return Alert.alert('Montant manquant', 'Indiquez le montant reçu.');
    setEnvoi(true);
    const lot = await addPaiements(db, loc.id, repartition, { date_paiement: date, mode });
    fermer();
    Alert.alert('Loyer encaissé ✓', 'Envoyer la quittance au locataire ?', [
      { text: 'Plus tard', style: 'cancel' },
      { text: 'Partager', onPress: async () => partagerQuittance(lot, loc, await getProfil(db)) },
    ]);
  };

  return (
    <Screen>
      <T variant="subtitle">{loc.nom}</T>
      <T variant="small">Loyer : {formatGNF(loc.loyer)} / mois</T>

      <MonthField label="À partir du mois" value={premierMois} onChange={setPremierMois} />
      <Field label="Montant reçu (GNF)" value={montant} onChangeText={setMontant} keyboardType="number-pad" />
      <Chips
        options={RACCOURCIS.map((n) => ({ value: n, label: n === 1 ? '1 mois' : `${n} mois` }))}
        value={RACCOURCIS.find((n) => parseMontant(montant) === n * loc.loyer) ?? null}
        onChange={(n) => setMontant(String(n * loc.loyer))}
      />

      {repartition.length > 0 && (
        <Card>
          <T variant="small">Ce paiement couvre :</T>
          {repartition.map((r) => (
            <Row key={r.mois}>
              <T style={{ textTransform: 'capitalize' }}>{libelleMois(r.mois)}</T>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <T>{formatGNF(r.montant)}</T>
                {r.montant < loc.loyer && <T variant="small">(partiel)</T>}
              </View>
            </Row>
          ))}
        </Card>
      )}

      <DateField label="Date du paiement" value={date} onChange={setDate} />
      <T variant="small">Mode de paiement</T>
      <Chips options={MODES} value={mode} onChange={setMode} />
      <Button title="Enregistrer" onPress={enregistrer} disabled={envoi} />
    </Screen>
  );
}
