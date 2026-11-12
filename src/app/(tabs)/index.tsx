import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { Badge, Button, Card, Empty, Row, Screen, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { getProfil, situationDuMois, type LigneMois } from '@/db/queries';
import { useTheme } from '@/hooks/use-theme';
import { relancerWhatsApp } from '@/lib/actions';
import { decalerMois, formatGNF, libelleMois, moisCourant } from '@/lib/format';

const STATUT = {
  paye: { label: 'Payé', tone: 'success' },
  partiel: { label: 'Partiel', tone: 'warning' },
  impaye: { label: 'Impayé', tone: 'danger' },
} as const;

export default function Tableau() {
  const db = useSQLiteContext();
  const c = useTheme();
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
  const encaisse = lignes.reduce((s, l) => s + Math.min(l.paye, l.du || l.paye), 0);
  const reste = Math.max(attendu - encaisse, 0);
  const taux = attendu > 0 ? Math.round((encaisse / attendu) * 100) : 0;

  return (
    <Screen tabs>
      <T variant="title" style={{ marginTop: Spacing.four }}>Loyers</T>

      <Row>
        <Button small variant="secondary" title="‹" onPress={() => setMois(decalerMois(mois, -1))} />
        <T variant="subtitle" style={{ textTransform: 'capitalize' }}>{libelleMois(mois)}</T>
        <Button small variant="secondary" title="›" onPress={() => setMois(decalerMois(mois, 1))} />
      </Row>

      <Card>
        <T variant="small">Encaissé ce mois</T>
        <T variant="big" color={c.primary}>{formatGNF(encaisse)}</T>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: c.backgroundSelected, overflow: 'hidden' }}>
          <View style={{ width: `${taux}%`, height: '100%', backgroundColor: c.primary }} />
        </View>
        <Row>
          <T variant="small">Attendu : {formatGNF(attendu)}</T>
          <T variant="small" color={reste > 0 ? c.danger : c.success}>Reste : {formatGNF(reste)}</T>
        </Row>
      </Card>

      {lignes.length === 0 ? (
        <Empty
          title="Aucun locataire actif"
          text="Ajoutez un logement puis un locataire pour suivre vos loyers."
          action={<Button title="Ajouter un logement" onPress={() => router.push('/logement/nouveau')} />}
        />
      ) : (
        lignes.map((l) => {
          const resteLigne = Math.max(l.du - l.paye, 0);
          return (
            <Card key={l.locataire_id} onPress={() => router.push(`/locataire/${l.locataire_id}`)}>
              <Row>
                <View style={{ flex: 1 }}>
                  <T variant="subtitle">{l.nom}</T>
                  <T variant="small">{l.logement_nom ?? 'Sans logement'}</T>
                </View>
                <Badge label={STATUT[l.statut].label} tone={STATUT[l.statut].tone} />
              </Row>
              <T variant="small">
                {formatGNF(l.paye)} / {formatGNF(l.du)}
              </T>
              {l.statut !== 'paye' && (
                <Row style={{ justifyContent: 'flex-start' }}>
                  <Button
                    small
                    title="Encaisser"
                    onPress={() =>
                      router.push({
                        pathname: '/paiement/nouveau',
                        params: { locataire: l.locataire_id, mois, montant: resteLigne },
                      })
                    }
                  />
                  <Button
                    small
                    variant="secondary"
                    title="Relancer WhatsApp"
                    onPress={() =>
                      relancerWhatsApp({ telephone: l.telephone, nom: l.nom, mois, reste: resteLigne, proprietaire: proprio })
                    }
                  />
                </Row>
              )}
            </Card>
          );
        })
      )}
    </Screen>
  );
}
