import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { payerMois } from '@/auth/comptes';
import { useAuth } from '@/auth/contexte';
import { formule, formuleConseillee, FORMULES, MODE_TEST_PAIEMENT, type FormuleId } from '@/auth/formules';
import { Badge, Button, Card, Icon, InfoRow, Row, Screen, SectionTitle, T } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, formatGNF } from '@/lib/format';

export default function AbonnementScreen() {
  const db = useSQLiteContext();
  const c = useTheme();
  const { compte, abonnement, rafraichirAbonnement } = useAuth();
  const [nbLogements, setNbLogements] = useState(0);
  const [choix, setChoix] = useState<FormuleId | null>(null);
  const [envoi, setEnvoi] = useState(false);

  useFocusEffect(
    useCallback(() => {
      db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM logements').then((r) => setNbLogements(r?.n ?? 0));
      rafraichirAbonnement();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db]),
  );

  if (!compte || !abonnement) return null;
  const conseillee = formuleConseillee(nbLogements);
  const selection = formule(choix ?? (abonnement.statut === 'actif' ? abonnement.formule : conseillee.id));
  const tropPetite = selection.limite != null && nbLogements > selection.limite;

  const titre =
    abonnement.statut === 'essai'
      ? `Essai gratuit : ${abonnement.joursRestants} jour${abonnement.joursRestants > 1 ? 's' : ''} restant${abonnement.joursRestants > 1 ? 's' : ''}`
      : abonnement.statut === 'actif'
        ? `Formule ${formule(abonnement.formule).nom} active`
        : 'Abonnement expiré';
  const ton = abonnement.statut === 'expire' ? c.danger : abonnement.statut === 'essai' ? c.warning : c.success;

  const payer = () => {
    if (tropPetite) return;
    const libelle = `${selection.nom} · ${formatGNF(selection.prixMensuel)} pour 1 mois`;
    if (!MODE_TEST_PAIEMENT) {
      Alert.alert('Paiement', 'Le paiement Orange Money / MTN MoMo sera bientôt disponible.');
      return;
    }
    Alert.alert('Paiement de test', `${libelle}.\n\nAucun argent n'est prélevé : le paiement est simulé pour les tests.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Simuler le paiement',
        onPress: async () => {
          setEnvoi(true);
          await payerMois(compte.id, selection.id, 'test');
          await rafraichirAbonnement();
          setEnvoi(false);
          Alert.alert('Abonnement activé ✓', `Formule ${selection.nom} active pour 30 jours.`);
        },
      },
    ]);
  };

  return (
    <Screen
      footer={
        <>
          {MODE_TEST_PAIEMENT && (
            <T variant="small" style={{ textAlign: 'center' }}>
              Mode test : le paiement est simulé, aucun argent n'est prélevé.
            </T>
          )}
          <Button
            title={
              tropPetite
                ? `${selection.nom} : ${nbLogements} logements dépassent la limite`
                : `Payer ${formatGNF(selection.prixMensuel)} · 1 mois`
            }
            onPress={payer}
            disabled={envoi || tropPetite}
          />
        </>
      }>
      <Card style={{ gap: 6 }}>
        <T variant="subtitle" color={ton}>
          {titre}
        </T>
        <T variant="small">
          {abonnement.statut === 'expire'
            ? `Terminé le ${formatDate(abonnement.fin)}. Vos données restent consultables mais ne peuvent plus être modifiées.`
            : `Jusqu'au ${formatDate(abonnement.fin)} inclus.`}
        </T>
        <T variant="small">
          {nbLogements} logement{nbLogements > 1 ? 's' : ''} enregistré{nbLogements > 1 ? 's' : ''} · formule conseillée : {conseillee.nom}
        </T>
      </Card>

      <SectionTitle title="Choisir une formule" />
      {FORMULES.map((f) => {
        const actif = f.id === selection.id;
        const impossible = f.limite != null && nbLogements > f.limite;
        return (
          <Pressable
            key={f.id}
            onPress={() => setChoix(f.id)}
            disabled={impossible}
            accessibilityRole="radio"
            accessibilityState={{ checked: actif, disabled: impossible }}
            style={({ pressed }) => [
              {
                borderRadius: 16,
                padding: 16,
                gap: 6,
                backgroundColor: actif ? c.successBg : c.backgroundElement,
                borderWidth: actif ? 2 : 1,
                borderColor: actif ? c.primary : c.border,
                opacity: impossible ? 0.45 : pressed ? 0.8 : 1,
              },
            ]}>
            <Row>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name={actif ? 'radio-button-on' : 'radio-button-off'} size={20} color={actif ? c.primary : c.textSecondary} />
                <T style={{ fontWeight: '800' }}>{f.nom}</T>
                {f.id === conseillee.id && <Badge label="Conseillée" tone="success" />}
              </View>
              <Text style={{ color: c.text, fontWeight: '800', fontSize: 15 }}>
                {formatGNF(f.prixMensuel)}
                <Text style={{ color: c.textSecondary, fontWeight: '500', fontSize: 13 }}> / mois</Text>
              </Text>
            </Row>
            <T variant="small" style={{ marginLeft: 28 }}>
              {f.description}
              {impossible ? ` — vous avez ${nbLogements} logements` : ''}
            </T>
          </Pressable>
        );
      })}

      {abonnement.historique.length > 0 && (
        <>
          <SectionTitle title="Historique" />
          <Card style={{ paddingVertical: 4 }}>
            {abonnement.historique.map((a, i) => (
              <InfoRow
                key={a.id}
                label={`${a.mode === 'essai' ? 'Essai gratuit' : formule(a.formule).nom}${a.mode === 'test' ? ' (test)' : ''}`}
                value={`${formatDate(a.debut)} → ${formatDate(a.fin)}`}
                last={i === abonnement.historique.length - 1}
              />
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}
