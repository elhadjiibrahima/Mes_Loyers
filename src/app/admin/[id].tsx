import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';

import { getProprietaire, payerMois, reinitialiserMotDePasse, suspendre, type ProprietaireAdmin } from '@/auth/comptes';
import { formule, formuleConseillee, FORMULES, type FormuleId } from '@/auth/formules';
import { Avatar, Badge, Button, Card, Chips, InfoRow, Introuvable, Row, Screen, SectionTitle, T } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, formatGNF } from '@/lib/format';

const DUREES = [1, 3, 6, 12];

const MODE: Record<string, string> = { essai: 'Essai gratuit', test: 'Paiement de test', paiement: 'Paiement en ligne', manuel: 'Paiement reçu (admin)' };

export default function ProprietaireDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useTheme();
  const [p, setP] = useState<ProprietaireAdmin | null | undefined>(undefined);
  const [choix, setChoix] = useState<FormuleId | null>(null);
  const [mois, setMois] = useState(1);
  const [envoi, setEnvoi] = useState(false);

  const charger = useCallback(() => {
    getProprietaire(Number(id)).then(setP);
  }, [id]);
  useFocusEffect(charger);

  if (p === undefined) return null;
  if (p === null) return <Introuvable quoi="Propriétaire" />;

  const ab = p.abonnement;
  const conseillee = formuleConseillee(p.nbLogements ?? 0);
  const selection = formule(choix ?? (ab.statut === 'actif' ? ab.formule : conseillee.id));
  const montant = selection.prixMensuel * mois;

  const enregistrerPaiement = () =>
    Alert.alert(
      'Enregistrer ce paiement ?',
      `${p.nom} · ${selection.nom} · ${mois} mois\nMontant reçu : ${formatGNF(montant)}`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Enregistrer',
          onPress: async () => {
            setEnvoi(true);
            await payerMois(p.id, selection.id, 'manuel', mois);
            setEnvoi(false);
            charger();
          },
        },
      ],
    );

  const couper = () =>
    Alert.alert("Suspendre l'accès ?", `${p.nom} ne pourra plus modifier ses données jusqu'au prochain paiement. Ses données sont conservées.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Suspendre',
        style: 'destructive',
        onPress: async () => {
          await suspendre(p.id);
          charger();
        },
      },
    ]);

  const reinitialiser = () =>
    Alert.alert('Réinitialiser le mot de passe ?', `Un mot de passe temporaire sera créé pour ${p.email}.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Réinitialiser',
        onPress: async () => {
          const temporaire = await reinitialiserMotDePasse(p.id);
          Alert.alert(
            'Mot de passe temporaire',
            `${temporaire}\n\nCommuniquez-le à ${p.nom}. Il pourra le changer dans Profil › Changer le mot de passe.`,
          );
        },
      },
    ]);

  const statut =
    ab.statut === 'essai'
      ? { label: `Essai · ${ab.joursRestants} j`, tone: 'warning' as const }
      : ab.statut === 'actif'
        ? { label: `${formule(ab.formule).nom} · ${ab.joursRestants} j`, tone: 'success' as const }
        : { label: 'Expiré', tone: 'danger' as const };

  return (
    <Screen
      footer={
        <Button
          title={`Enregistrer ${formatGNF(montant)} reçus`}
          icon="cash-outline"
          onPress={enregistrerPaiement}
          disabled={envoi}
        />
      }>
      <Stack.Screen options={{ title: p.nom }} />
      <Row style={{ justifyContent: 'flex-start', gap: 12 }}>
        <Avatar nom={p.nom} size={56} tone={statut.tone} />
        <View style={{ flex: 1, gap: 4 }}>
          <T variant="subtitle">{p.nom}</T>
          <T variant="small">{p.email}</T>
          <Badge label={statut.label} tone={statut.tone} />
        </View>
      </Row>

      <Card style={{ paddingVertical: 4 }}>
        <InfoRow label="Inscrit le" value={formatDate(p.cree_le.slice(0, 10))} />
        <InfoRow label="Logements" value={p.nbLogements == null ? 'inconnu' : String(p.nbLogements)} />
        <InfoRow label="Formule conseillée" value={`${conseillee.nom} (${formatGNF(conseillee.prixMensuel)})`} />
        <InfoRow label={ab.statut === 'expire' ? 'Terminé le' : "Accès jusqu'au"} value={formatDate(ab.fin)} last />
      </Card>

      <SectionTitle title="Enregistrer un paiement reçu" />
      <T variant="small">
        Après un paiement Orange Money, MTN MoMo ou en espèces, choisissez la formule et la durée. Si la formule ne
        change pas, les mois s'ajoutent à la suite de l'abonnement en cours.
      </T>
      <T variant="label">Formule</T>
      <Chips
        value={selection.id}
        onChange={setChoix}
        options={FORMULES.filter((f) => f.limite == null || (p.nbLogements ?? 0) <= f.limite).map((f) => ({
          value: f.id,
          label: `${f.nom} · ${formatGNF(f.prixMensuel)}`,
        }))}
      />
      <T variant="label">Durée</T>
      <Chips value={mois} onChange={setMois} options={DUREES.map((n) => ({ value: n, label: `${n} mois` }))} />

      <SectionTitle title="Compte" />
      <Button variant="secondary" icon="key-outline" title="Réinitialiser le mot de passe" onPress={reinitialiser} />
      {ab.statut !== 'expire' && <Button variant="danger" icon="ban-outline" title="Suspendre l'accès" onPress={couper} />}

      <SectionTitle title="Historique" />
      <Card style={{ paddingVertical: 4 }}>
        {ab.historique.length === 0 ? (
          <T variant="small" style={{ paddingVertical: 12 }}>Aucun abonnement.</T>
        ) : (
          ab.historique.map((a, i) => (
            <InfoRow
              key={a.id}
              label={`${MODE[a.mode] ?? a.mode}${a.mode !== 'essai' ? ` · ${formule(a.formule).nom}` : ''}${a.montant ? ` · ${formatGNF(a.montant)}` : ''}`}
              value={`${formatDate(a.debut)} → ${formatDate(a.fin)}`}
              last={i === ab.historique.length - 1}
            />
          ))
        )}
      </Card>
      <T variant="small" color={c.textSecondary}>
        Les données de gestion du propriétaire (locataires, paiements) restent privées et ne sont pas affichées ici.
      </T>
    </Screen>
  );
}
