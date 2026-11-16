import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Colors } from '@/constants/theme';
import { migrateDb } from '@/db/schema';
import { installerAlertWeb } from '@/lib/alert-web';

SplashScreen.preventAutoHideAsync();
installerAlertWeb();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const c = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  return (
    <SQLiteProvider databaseName="loyers.db" onInit={migrateDb}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <Stack
          screenOptions={{
            headerBackTitle: 'Retour',
            headerShadowVisible: false,
            headerStyle: { backgroundColor: c.background },
            headerTintColor: c.text,
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: c.background },
          }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="logement/nouveau" options={{ title: 'Nouveau logement', presentation: 'modal' }} />
          <Stack.Screen name="logement/[id]" options={{ title: 'Logement' }} />
          <Stack.Screen name="locataire/nouveau" options={{ title: 'Nouveau locataire', presentation: 'modal' }} />
          <Stack.Screen name="locataire/[id]" options={{ title: 'Locataire' }} />
          <Stack.Screen name="locataire/modifier" options={{ title: 'Modifier le locataire', presentation: 'modal' }} />
          <Stack.Screen name="locataire/depart" options={{ title: 'Départ du locataire', presentation: 'modal' }} />
          <Stack.Screen name="paiement/nouveau" options={{ title: 'Encaisser un loyer', presentation: 'modal' }} />
          <Stack.Screen name="depense/nouveau" options={{ title: 'Nouvelle dépense', presentation: 'modal' }} />
        </Stack>
      </ThemeProvider>
    </SQLiteProvider>
  );
}
