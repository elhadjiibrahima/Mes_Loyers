import { useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Switch, View } from 'react-native';

import { useAcces } from '@/auth/contexte';
import { DateField } from '@/components/date-fields';
import { Avatar, Button, Card, Field, Icon, InfoRow, Introuvable, Row, Screen, T } from '@/components/ui';
import { enregistrerDepart, ficheSolde, getLocataire, type Locataire } from '@/db/queries';
import { useTheme } from '@/hooks/use-theme';
import { fermer } from '@/lib/actions';
import { aujourdHui, formatGNF, formatNombre, libelleMois, parseMontant } from '@/lib/format';

export default function Depart() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const c = useTheme();
  const [loc, setLoc] = useState<Locataire | null | undefined>(undefined);
  const [dateSortie, setDateSortie] = useState(aujourdHui());
  const [arrieres, setArrieres] = useState(0);
  const [deduire, setDeduire] = useState(true);
  const [rendu, setRendu] = useState<string | null>(null);
  const acces = useAcces();

  useEffect(() => {
    getLocataire(db, Number(id)).then(setLoc);
  }, [db, id]);

  // Les arriérés dépendent de la date de sortie choisie.
  useEffect(() => {
    if (loc) ficheSolde(db, { ...loc, date_sortie: dateSortie }).then((s) => setArrieres(s.arrieres));
  }, [db, loc, dateSortie]);

  if (loc === undefined) return null;
  if (loc === null) return <Introuvable quoi="Locataire" />;

  const retenue = deduire ? Math.min(arrieres, loc.caution) : 0;
  const aRendre = Math.max(loc.caution - retenue, 0);
  const montantRendu = rendu === null ? aRendre : parseMontant(rendu);
  const resteDu = Math.max(arrieres - retenue, 0);

  const valider = () =>
    acces.peutModifier() &&
    Alert.alert('Confirmer le départ ?', `${loc.nom} quittera ${loc.logement_nom ?? 'le logement'}, qui redeviendra libre.`, [
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
    <Screen
      footer={<Button variant="danger" icon="exit-outline" title="Enregistrer le départ" onPress={valider} />}>
      <Row style={{ justifyContent: 'flex-start', gap: 12 }}>
        <Avatar nom={loc.nom} size={44} tone="neutral" />
        <View style={{ flex: 1 }}>
          <T style={{ fontWeight: '700' }}>{loc.nom}</T>
          <T variant="small">{loc.logement_nom ?? 'Logement supprimé'}</T>
        </View>
      </Row>

      <DateField label="Date de sortie" value={dateSortie} onChange={setDateSortie} />
      <T variant="small">Le loyer reste dû jusqu'au mois de sortie inclus ({libelleMois(dateSortie.slice(0, 7))}).</T>

      <Card style={{ paddingVertical: 4 }}>
        <InfoRow label="Arriérés à la sortie" value={formatGNF(arrieres)} />
        <InfoRow label="Caution versée" value={formatGNF(loc.caution)} last={!(loc.caution > 0 && arrieres > 0)} />
        {loc.caution > 0 && arrieres > 0 && (
          <Row style={{ minHeight: 52 }}>
            <T style={{ flex: 1 }}>Déduire les arriérés de la caution</T>
            <Switch value={deduire} onValueChange={setDeduire} accessibilityLabel="Déduire les arriérés de la caution" />
          </Row>
        )}
      </Card>

      {retenue > 0 && (
        <Card style={{ backgroundColor: c.successBg }}>
          <Row style={{ justifyContent: 'flex-start', gap: 10 }}>
            <Icon name="information-circle-outline" color={c.success} />
            <T style={{ flex: 1 }} color={c.success}>
              {formatNombre(retenue)} GNF seront enregistrés comme paiement « Retenue sur caution ».
            </T>
          </Row>
        </Card>
      )}
      {resteDu > 0 && (
        <T style={{ fontWeight: '700' }} color={c.danger}>
          Il restera {formatGNF(resteDu)} à réclamer après le départ.
        </T>
      )}

      {loc.caution > 0 && (
        <Field
          label={`Caution rendue (GNF) — proposé : ${formatNombre(aRendre)}`}
          value={rendu ?? String(aRendre)}
          onChangeText={setRendu}
          keyboardType="number-pad"
        />
      )}
    </Screen>
  );
}
