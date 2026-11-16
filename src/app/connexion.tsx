import { Link } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErreurCompte } from '@/auth/comptes';
import { useAuth } from '@/auth/contexte';
import { Button, Field, T } from '@/components/ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function Connexion() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { connexion } = useAuth();
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  const valider = async () => {
    setErreur('');
    if (!email.trim() || !motDePasse) return setErreur('Saisissez votre e-mail et votre mot de passe.');
    setEnvoi(true);
    try {
      await connexion(email, motDePasse);
    } catch (e) {
      setErreur(e instanceof ErreurCompte ? e.message : 'Connexion impossible. Réessayez.');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        <View
          style={{
            backgroundColor: c.hero,
            paddingTop: insets.top + Spacing.six,
            paddingBottom: Spacing.six,
            alignItems: 'center',
            gap: Spacing.two,
          }}>
          <Image source={require('@/assets/images/splash-icon.png')} style={{ width: 96, height: 96 }} accessibilityIgnoresInvertColors />
          <Text style={{ color: c.heroText, fontSize: 28, fontWeight: '800' }}>Mes Loyers</Text>
          <Text style={{ color: c.heroMuted, fontSize: 15 }}>Vos loyers, simplement.</Text>
        </View>

        <View style={{ padding: Spacing.four, gap: Spacing.three, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' }}>
          <T variant="title">Connexion</T>
          <Field
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            placeholder="vous@exemple.com"
          />
          <Field
            label="Mot de passe"
            value={motDePasse}
            onChangeText={setMotDePasse}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            onSubmitEditing={valider}
          />
          {erreur ? (
            <T color={c.danger} style={{ fontWeight: '600' }}>
              {erreur}
            </T>
          ) : null}
          <Button title={envoi ? 'Connexion…' : 'Se connecter'} onPress={valider} disabled={envoi} />
          <Button
            variant="secondary"
            title="Mot de passe oublié ?"
            onPress={() =>
              Alert.alert(
                'Mot de passe oublié',
                "Pendant la phase de test, les comptes sont enregistrés sur cet appareil. Créez un nouveau compte ou contactez l'administrateur de l'application.",
              )
            }
          />

          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: Spacing.two }}>
            <T variant="small">Pas encore de compte ?</T>
            <Link href="/inscription" style={{ color: c.primary, fontWeight: '700', fontSize: 13 }}>
              Créer un compte
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
