import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';
import { useCallback } from 'react';
import { useColorScheme } from 'react-native';

import { estAdmin } from '@/auth/admin';
import { AuthProvider, useAuth } from '@/auth/contexte';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Colors } from '@/constants/theme';
import { getProfil, saveProfil } from '@/db/queries';
import { migrateDb } from '@/db/schema';
import { installerAlertWeb } from '@/lib/alert-web';

SplashScreen.preventAutoHideAsync();
installerAlertWeb();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <Navigation />
      </ThemeProvider>
    </AuthProvider>
  );
}

function Navigation() {
  const colorScheme = useColorScheme();
  const c = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { pret, compte } = useAuth();
  const admin = estAdmin(compte);

  // Chaque compte a sa propre base : à l'ouverture, on la met à jour et on
  // reprend le nom du compte dans le profil s'il est vide.
  const initialiser = useCallback(
    async (db: SQLiteDatabase) => {
      await migrateDb(db);
      if (compte) {
        const profil = await getProfil(db);
        if (!profil.nom) await saveProfil(db, { ...profil, nom: compte.nom });
      }
    },
    [compte],
  );

  if (!pret) return null;

  const ecrans = (
    <Stack
      screenOptions={{
        headerBackTitle: 'Retour',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: c.background },
        headerTintColor: c.text,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: c.background },
      }}>
      <Stack.Protected guard={admin}>
        <Stack.Screen name="admin/index" options={{ title: 'Administration' }} />
        <Stack.Screen name="admin/[id]" options={{ title: 'Propriétaire' }} />
      </Stack.Protected>
      <Stack.Protected guard={!!compte && !admin}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="logement/nouveau" options={{ title: 'Nouveau logement', presentation: 'modal' }} />
        <Stack.Screen name="logement/[id]" options={{ title: 'Logement' }} />
        <Stack.Screen name="locataire/nouveau" options={{ title: 'Nouveau locataire', presentation: 'modal' }} />
        <Stack.Screen name="locataire/[id]" options={{ title: 'Locataire' }} />
        <Stack.Screen name="locataire/modifier" options={{ title: 'Modifier le locataire', presentation: 'modal' }} />
        <Stack.Screen name="locataire/depart" options={{ title: 'Départ du locataire', presentation: 'modal' }} />
        <Stack.Screen name="paiement/nouveau" options={{ title: 'Encaisser un loyer', presentation: 'modal' }} />
        <Stack.Screen name="depense/nouveau" options={{ title: 'Nouvelle dépense', presentation: 'modal' }} />
        <Stack.Screen name="abonnement" options={{ title: 'Abonnement', presentation: 'modal' }} />
      </Stack.Protected>
      <Stack.Protected guard={!compte}>
        <Stack.Screen name="connexion" options={{ headerShown: false }} />
        <Stack.Screen name="inscription" options={{ title: 'Créer un compte' }} />
      </Stack.Protected>
    </Stack>
  );

  // Pas de base ouverte tant que personne n'est connecté.
  if (!compte) return ecrans;
  return (
    <SQLiteProvider key={compte.base} databaseName={compte.base} onInit={initialiser}>
      {ecrans}
    </SQLiteProvider>
  );
}
