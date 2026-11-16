import { useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Switch } from 'react-native';

import { DateField } from '@/components/date-fields';
import { Button, Card, Field, Row, Screen, T } from '@/components/ui';
import { enregistrerDepart, ficheSolde, getLocataire, type Locataire } from '@/db/queries';
import { useTheme } from '@/hooks/use-theme';
import { fermer } from '@/lib/actions';
import { aujourdHui, formatGNF, parseMontant } from '@/lib/format';

export default function Depart() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const c = useTheme();
  const [loc, setLoc] = useState<Locataire | null>(null);
  const [dateSortie, setDateSortie] = useState(aujourdHui());
  const [arrieres, setArrieres] = useState(0);
  const [deduire, setDeduire] = useState(true);
  const [rendu, setRendu] = useState<string | null>(null);

  useEffect(() => {
    getLocataire(db, Number(id)).then(setLoc);
  }, [db, id]);

  // Les arriérés dépendent de la date de sortie choisie.
  useEffect(() => {
    if (loc) ficheSolde(db, { ...loc, date_sortie: dateSortie }).then((s) => setArrieres(s.arrieres));
  }, [db, loc, dateSortie]);

  if (!loc) return null;

  const retenue = deduire ? Math.min(arrieres, loc.caution) : 0;
  const aRendre = Math.max(loc.caution - retenue, 0);
  const montantRendu = rendu === null ? aRendre : parseMontant(rendu);

  const valider = () =>
    Alert.alert('Confirmer le départ ?', `${loc.nom} quittera ${loc.logement_nom ?? 'le logement'}.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Confirmer',
        onPress: async () => {
          await enregistrerDepart(db, loc, { date_sortie: dateSortie, caution_rendue: montantRendu, deduireArrieres: deduire });
          fermer();
        },
      },
    ]);

  return (
    <Screen>
      <T variant="subtitle">{loc.nom}</T>
      <DateField label="Date de sortie" value={dateSortie} onChange={setDateSortie} />
      <T variant="small">Le loyer reste dû jusqu'au mois de sortie inclus.</T>

      <Card>
        <Row>
          <T>Arriérés à la sortie</T>
          <T variant="subtitle" color={arrieres > 0 ? c.danger : c.success}>{formatGNF(arrieres)}</T>
        </Row>
        <Row>
          <T>Caution versée</T>
          <T variant="subtitle">{formatGNF(loc.caution)}</T>
        </Row>
        {loc.caution > 0 && arrieres > 0 && (
          <Row>
            <T style={{ flex: 1 }}>Déduire les arriérés de la caution</T>
            <Switch value={deduire} onValueChange={setDeduire} />
          </Row>
        )}
        {retenue > 0 && (
          <T variant="small">
            {formatGNF(retenue)} seront enregistrés comme paiement « Retenue sur caution ».
          </T>
        )}
      </Card>

      {loc.caution > 0 && (
        <Field
          label={`Caution rendue (GNF) — proposé : ${formatGNF(aRendre)}`}
          value={rendu ?? String(aRendre)}
          onChangeText={setRendu}
          keyboardType="number-pad"
        />
      )}

      <Button variant="danger" title="Enregistrer le départ" onPress={valider} />
    </Screen>
  );
}
