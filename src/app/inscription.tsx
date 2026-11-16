import { useState } from 'react';

import { ErreurCompte } from '@/auth/comptes';
import { useAuth } from '@/auth/contexte';
import { JOURS_ESSAI } from '@/auth/formules';
import { Button, Card, Field, Icon, Row, Screen, T } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';

export default function Inscription() {
  const c = useTheme();
  const { inscription } = useAuth();
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  const valider = async () => {
    setErreur('');
    if (motDePasse !== confirmation) return setErreur('Les deux mots de passe ne sont pas identiques.');
    setEnvoi(true);
    try {
      await inscription(nom, email, motDePasse);
    } catch (e) {
      setErreur(e instanceof ErreurCompte ? e.message : 'Création du compte impossible. Réessayez.');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Screen footer={<Button title={envoi ? 'Création…' : 'Créer mon compte'} onPress={valider} disabled={envoi} />}>
      <Card style={{ backgroundColor: c.successBg }}>
        <Row style={{ justifyContent: 'flex-start', gap: 10, alignItems: 'flex-start' }}>
          <Icon name="gift-outline" color={c.success} />
          <T style={{ flex: 1 }} color={c.success}>
            {JOURS_ESSAI} jours d'essai gratuit, sans engagement, avec toutes les fonctionnalités.
          </T>
        </Row>
      </Card>
      <Field label="Nom complet" value={nom} onChangeText={setNom} autoComplete="name" placeholder="Ex. Mamadou Diallo" autoFocus />
      <Field
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        placeholder="vous@exemple.com"
      />
      <Field
        label="Mot de passe (8 caractères minimum)"
        value={motDePasse}
        onChangeText={setMotDePasse}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <Field label="Confirmer le mot de passe" value={confirmation} onChangeText={setConfirmation} secureTextEntry autoComplete="new-password" />
      {erreur ? (
        <T color={c.danger} style={{ fontWeight: '600' }}>
          {erreur}
        </T>
      ) : null}
      <T variant="small">Votre nom apparaîtra sur les quittances. Vous pourrez le modifier dans le profil.</T>
    </Screen>
  );
}
