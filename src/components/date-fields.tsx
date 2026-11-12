import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { aujourdHui, decalerMois, formatDate, libelleMois } from '@/lib/format';

const JOURS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function Champ({ label, valeur, onPress }: { label: string; valeur: string; onPress: () => void }) {
  const c = useTheme();
  return (
    <View style={{ gap: Spacing.one }}>
      <T variant="small">{label}</T>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label} : ${valeur}`}
        style={[styles.champ, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
        <Text style={{ color: c.text, fontSize: 16 }}>{valeur}</Text>
        <Text style={{ color: c.textSecondary }}>📅</Text>
      </Pressable>
    </View>
  );
}

/** Sélecteur de mois : ‹ novembre 2026 › */
export function MonthField({ label, value, onChange }: { label: string; value: string; onChange: (m: string) => void }) {
  const c = useTheme();
  return (
    <View style={{ gap: Spacing.one }}>
      <T variant="small">{label}</T>
      <View style={[styles.champ, { backgroundColor: c.backgroundElement, borderColor: c.border, paddingVertical: 6 }]}>
        <Pressable accessibilityLabel="Mois précédent" hitSlop={10} onPress={() => onChange(decalerMois(value, -1))} style={styles.fleche}>
          <Text style={{ color: c.primary, fontSize: 22 }}>‹</Text>
        </Pressable>
        <Text style={{ color: c.text, fontSize: 16, textTransform: 'capitalize' }}>{libelleMois(value)}</Text>
        <Pressable accessibilityLabel="Mois suivant" hitSlop={10} onPress={() => onChange(decalerMois(value, 1))} style={styles.fleche}>
          <Text style={{ color: c.primary, fontSize: 22 }}>›</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Sélecteur de date avec un petit calendrier (AAAA-MM-JJ). */
export function DateField({ label, value, onChange }: { label: string; value: string; onChange: (d: string) => void }) {
  const c = useTheme();
  const [ouvert, setOuvert] = useState(false);
  const [mois, setMois] = useState(value.slice(0, 7));

  const [a, m] = mois.split('-').map(Number);
  const premierJour = (new Date(a, m - 1, 1).getDay() + 6) % 7; // lundi = 0
  const nbJours = new Date(a, m, 0).getDate();
  const cases = [...Array(premierJour).fill(null), ...Array.from({ length: nbJours }, (_, i) => i + 1)];
  const aujourd = aujourdHui();

  const choisir = (j: number) => {
    onChange(`${mois}-${String(j).padStart(2, '0')}`);
    setOuvert(false);
  };

  return (
    <>
      <Champ
        label={label}
        valeur={formatDate(value)}
        onPress={() => {
          setMois(value.slice(0, 7));
          setOuvert(true);
        }}
      />
      <Modal visible={ouvert} transparent animationType="fade" onRequestClose={() => setOuvert(false)}>
        <Pressable style={styles.fond} onPress={() => setOuvert(false)}>
          <Pressable style={[styles.calendrier, { backgroundColor: c.backgroundElement }]} onPress={() => {}}>
            <View style={styles.entete}>
              <Pressable accessibilityLabel="Mois précédent" hitSlop={10} onPress={() => setMois(decalerMois(mois, -1))} style={styles.fleche}>
                <Text style={{ color: c.primary, fontSize: 22 }}>‹</Text>
              </Pressable>
              <T variant="subtitle" style={{ textTransform: 'capitalize' }}>{libelleMois(mois)}</T>
              <Pressable accessibilityLabel="Mois suivant" hitSlop={10} onPress={() => setMois(decalerMois(mois, 1))} style={styles.fleche}>
                <Text style={{ color: c.primary, fontSize: 22 }}>›</Text>
              </Pressable>
            </View>
            <View style={styles.grille}>
              {JOURS.map((j, i) => (
                <View key={`h${i}`} style={styles.case}>
                  <Text style={{ color: c.textSecondary, fontSize: 12 }}>{j}</Text>
                </View>
              ))}
              {cases.map((j, i) => {
                if (j == null) return <View key={`v${i}`} style={styles.case} />;
                const date = `${mois}-${String(j).padStart(2, '0')}`;
                const choisi = date === value;
                return (
                  <Pressable
                    key={date}
                    onPress={() => choisir(j)}
                    accessibilityLabel={formatDate(date)}
                    style={[styles.case, styles.jour, choisi && { backgroundColor: c.primary }, !choisi && date === aujourd && { borderColor: c.primary, borderWidth: 1 }]}>
                    <Text style={{ color: choisi ? c.primaryText : c.text }}>{j}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Button small variant="secondary" title="Aujourd'hui" onPress={() => { onChange(aujourd); setOuvert(false); }} />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  champ: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fleche: { paddingHorizontal: 8, paddingVertical: 2 },
  fond: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: Spacing.three },
  calendrier: { width: '100%', maxWidth: 360, borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  entete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  grille: { flexDirection: 'row', flexWrap: 'wrap' },
  case: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  jour: { borderRadius: 999 },
});
