import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { migrateDb } from '@/db/schema';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <SQLiteProvider databaseName="loyers.db" onInit={migrateDb}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <Stack screenOptions={{ headerBackTitle: 'Retour' }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="logement/nouveau" options={{ title: 'Nouveau logement', presentation: 'modal' }} />
          <Stack.Screen name="locataire/nouveau" options={{ title: 'Nouveau locataire', presentation: 'modal' }} />
          <Stack.Screen name="locataire/[id]" options={{ title: 'Locataire' }} />
          <Stack.Screen name="paiement/nouveau" options={{ title: 'Encaisser un loyer', presentation: 'modal' }} />
        </Stack>
      </ThemeProvider>
    </SQLiteProvider>
  );
}
