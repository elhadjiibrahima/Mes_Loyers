import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type IconName } from '@/components/ui';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const ACTIONS: { icon: IconName; titre: string; detail: string; href: Href }[] = [
  { icon: 'cash-outline', titre: 'Encaisser un loyer', detail: 'Enregistrer un paiement reçu', href: '/paiement/nouveau' },
  { icon: 'person-add-outline', titre: 'Nouveau locataire', detail: 'Associer une personne à un logement', href: '/locataire/nouveau' },
  { icon: 'business-outline', titre: 'Nouveau logement', detail: 'Appartement, chambre, magasin…', href: '/logement/nouveau' },
];

/** Bouton « + » flottant des onglets, avec les trois actions rapides. */
export function AddButton() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [ouvert, setOuvert] = useState(false);
  const bas = Platform.OS === 'web' ? 24 : BottomTabInset + insets.bottom + 16;

  const aller = (href: Href) => {
    setOuvert(false);
    router.push(href);
  };

  return (
    <>
      <Pressable
        onPress={() => setOuvert(true)}
        accessibilityRole="button"
        accessibilityLabel="Ajouter"
        style={({ pressed }) => [
          styles.fab,
          { bottom: bas, backgroundColor: c.primary, shadowColor: c.primary, opacity: pressed ? 0.85 : 1 },
        ]}>
        <Ionicons name="add" size={30} color={c.primaryText} />
      </Pressable>

      <Modal visible={ouvert} transparent animationType="fade" onRequestClose={() => setOuvert(false)}>
        <View style={styles.fond}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setOuvert(false)}
            accessibilityRole="button"
            accessibilityLabel="Fermer le menu"
          />
          <View style={[styles.feuille, { backgroundColor: c.backgroundElement, paddingBottom: Spacing.four + insets.bottom }]}>
            <View style={[styles.poignee, { backgroundColor: c.border }]} />
            {ACTIONS.map((a) => (
              <Pressable
                key={a.titre}
                onPress={() => aller(a.href)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.action, pressed && { backgroundColor: c.backgroundSelected }]}>
                <View style={[styles.actionIcone, { backgroundColor: c.successBg }]}>
                  <Ionicons name={a.icon} size={22} color={c.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontSize: 16, fontWeight: '700' }}>{a.titre}</Text>
                  <Text style={{ color: c.textSecondary, fontSize: 13 }}>{a.detail}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={c.textSecondary} />
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  fond: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  feuille: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.two,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  poignee: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: Spacing.two },
  action: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: 14, minHeight: 64 },
  actionIcone: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
