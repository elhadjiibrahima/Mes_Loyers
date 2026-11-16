import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, type ComponentProps, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset, MaxContentWidth, Radius, Spacing, WebTabInset } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color?: string }) {
  const c = useTheme();
  return <Ionicons name={name} size={size} color={color ?? c.text} />;
}

/**
 * Écran défilant. `top` s'affiche sur toute la largeur au-dessus du contenu
 * (bandeau d'accueil), `footer` reste fixé en bas (bouton principal).
 */
export function Screen({
  children,
  tabs = false,
  top,
  footer,
  fab = false,
}: {
  children: ReactNode;
  tabs?: boolean;
  top?: ReactNode;
  footer?: ReactNode;
  /** Laisse la place du bouton « + » flottant sous le dernier élément. */
  fab?: boolean;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior={top ? 'never' : 'automatic'}
        keyboardShouldPersistTaps="handled">
        {top}
        <View
          style={{
            padding: Spacing.three,
            paddingTop: top ? 0 : Spacing.three + (tabs ? WebTabInset : 0),
            paddingBottom: Spacing.five + (fab ? 76 : 0) + (footer ? 0 : tabs ? BottomTabInset + insets.bottom : insets.bottom),
            gap: Spacing.three,
            width: '100%',
            maxWidth: MaxContentWidth,
            alignSelf: 'center',
          }}>
          {children}
        </View>
      </ScrollView>
      {footer && (
        <View
          style={{
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: c.border,
            backgroundColor: c.backgroundElement,
            paddingHorizontal: Spacing.three,
            paddingTop: Spacing.three,
            paddingBottom: Spacing.three + insets.bottom,
            gap: Spacing.two,
          }}>
          <View style={{ width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.two }}>{footer}</View>
        </View>
      )}
    </View>
  );
}

export function T({
  children,
  variant = 'body',
  color,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  variant?: 'title' | 'subtitle' | 'body' | 'small' | 'big' | 'label' | 'huge';
  color?: string;
  style?: TextStyle;
  numberOfLines?: number;
}) {
  const c = useTheme();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[styles[variant], { color: color ?? (variant === 'small' || variant === 'label' ? c.textSecondary : c.text) }, style]}>
      {children}
    </Text>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: ViewStyle; onPress?: () => void }) {
  const c = useTheme();
  const base = [styles.card, { backgroundColor: c.backgroundElement }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [base, pressed && { opacity: 0.75 }]}>
      {children}
    </Pressable>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  small = false,
  disabled = false,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'dark';
  small?: boolean;
  disabled?: boolean;
  icon?: IconName;
  style?: ViewStyle;
}) {
  const c = useTheme();
  const bg = { primary: c.primary, secondary: c.backgroundElement, danger: c.dangerBg, dark: c.inverse }[variant];
  const fg = { primary: c.primaryText, secondary: c.text, danger: c.danger, dark: c.inverseText }[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        variant === 'secondary' && { borderWidth: 1, borderColor: c.border },
        style,
      ]}>
      {icon && <Ionicons name={icon} size={small ? 17 : 19} color={variant === 'secondary' ? c.primary : fg} />}
      <Text style={[styles.buttonText, small && { fontSize: 14 }, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

/** Bouton rond avec icône seule (toujours avec un libellé d'accessibilité). */
export function IconButton({
  icon,
  label,
  onPress,
  variant = 'plain',
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  variant?: 'plain' | 'primary' | 'onHero';
}) {
  const c = useTheme();
  const bg = { plain: 'transparent', primary: c.primary, onHero: 'rgba(255,255,255,0.16)' }[variant];
  const fg = { plain: c.text, primary: c.primaryText, onHero: c.heroText }[variant];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [styles.iconButton, { backgroundColor: bg, opacity: pressed ? 0.7 : 1 }]}>
      <Ionicons name={icon} size={22} color={fg} />
    </Pressable>
  );
}

/**
 * Pour un montant prérempli : au toucher, le champ se vide (l'ancienne valeur
 * reste en gris) pour que la saisie remplace le montant au lieu de s'y ajouter.
 * Si rien n'est tapé, l'ancienne valeur revient en quittant le champ.
 */
export function useSaisieRemplace(value: string, onChange: (v: string) => void, placeholder?: string) {
  const ancien = useRef<string | null>(null);
  return {
    placeholder: ancien.current ?? placeholder,
    onFocus: () => {
      if (value) {
        ancien.current = value;
        onChange('');
      }
    },
    onBlur: () => {
      if (!value && ancien.current) onChange(ancien.current);
      ancien.current = null;
    },
  };
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const c = useTheme();
  const remplace = useSaisieRemplace(props.value ?? '', props.onChangeText ?? (() => {}), props.placeholder);
  const montant = props.keyboardType === 'number-pad';
  return (
    <View style={{ gap: Spacing.one }}>
      <T variant="label">{label}</T>
      <TextInput
        placeholderTextColor={c.textSecondary}
        accessibilityLabel={label}
        {...props}
        {...(montant ? remplace : null)}
        style={[styles.input, { color: c.text, backgroundColor: c.backgroundElement, borderColor: c.border }]}
      />
    </View>
  );
}

export function Chips<V extends string | number>({
  options,
  value,
  onChange,
  dark = false,
}: {
  options: { value: V; label: string }[];
  value: V | null;
  onChange: (v: V) => void;
  /** Sélection en noir plutôt qu'en vert (filtres). */
  dark?: boolean;
}) {
  const c = useTheme();
  const actif = dark ? c.inverse : c.primary;
  const actifTexte = dark ? c.inverseText : c.primaryText;
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[
              styles.chip,
              { borderColor: active ? actif : c.border, backgroundColor: active ? actif : c.backgroundElement },
            ]}>
            <Text style={{ color: active ? actifTexte : c.text, fontWeight: '600', fontSize: 14 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export type Tone = 'success' | 'warning' | 'danger' | 'neutral';

export function useTone(tone: Tone) {
  const c = useTheme();
  if (tone === 'neutral') return { fg: c.textSecondary, bg: c.backgroundSelected };
  return { fg: c[tone], bg: c[`${tone}Bg`] };
}

export function Badge({ label, tone }: { label: string; tone: Tone }) {
  const { fg, bg } = useTone(tone);
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export function initiales(nom: string) {
  const mots = nom.trim().split(/\s+/).filter(Boolean);
  return ((mots[0]?.[0] ?? '') + (mots.length > 1 ? mots[mots.length - 1][0] : '')).toUpperCase();
}

export function Avatar({ nom, tone = 'success', size = 44 }: { nom: string; tone?: Tone; size?: number }) {
  const { fg, bg } = useTone(tone);
  return (
    <View
      accessible={false}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: fg, fontWeight: '800', fontSize: size * 0.34 }}>{initiales(nom)}</Text>
    </View>
  );
}

/** Petite tuile chiffrée colorée (Payés / Partiel / Impayé). */
export function StatTile({ value, label, tone }: { value: string | number; label: string; tone: Tone }) {
  const { fg, bg } = useTone(tone);
  return (
    <View style={{ flex: 1, backgroundColor: bg, borderRadius: 12, padding: 10, gap: 2 }}>
      <Text style={{ color: fg, fontSize: 20, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: fg, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <Row style={{ marginTop: Spacing.two }}>
      <T variant="subtitle">{title}</T>
      {action}
    </Row>
  );
}

/** Ligne libellé / valeur dans une carte. */
export function InfoRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  const c = useTheme();
  return (
    <View
      style={[
        styles.row,
        { minHeight: 48, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: c.border },
      ]}>
      <T color={c.textSecondary}>{label}</T>
      <T style={{ fontWeight: '600', flexShrink: 1, textAlign: 'right' }}>{value}</T>
    </View>
  );
}

export function ProgressBar({ value }: { value: number }) {
  const c = useTheme();
  return (
    <View style={{ height: 10, borderRadius: 5, backgroundColor: c.backgroundSelected, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: '100%', backgroundColor: c.primary, borderRadius: 5 }} />
    </View>
  );
}

export function Empty({ title, text, action, icon }: { title: string; text: string; action?: ReactNode; icon?: IconName }) {
  const c = useTheme();
  return (
    <Card style={{ alignItems: 'center', paddingVertical: Spacing.five, gap: Spacing.two }}>
      {icon && <Ionicons name={icon} size={32} color={c.textSecondary} />}
      <T variant="subtitle">{title}</T>
      <T variant="small" style={{ textAlign: 'center' }}>
        {text}
      </T>
      {action}
    </Card>
  );
}

/** Écran affiché quand l'élément demandé n'existe plus (lien ancien, suppression). */
export function Introuvable({ quoi }: { quoi: string }) {
  return (
    <Screen>
      <Empty icon="search-outline" title={`${quoi} introuvable`} text="Il a peut-être été supprimé." />
    </Screen>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  huge: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  big: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 17, fontWeight: '700' },
  body: { fontSize: 15 },
  small: { fontSize: 13 },
  label: { fontSize: 13, fontWeight: '600' },
  card: { borderRadius: Radius.large, padding: Spacing.three, gap: Spacing.two },
  button: {
    minHeight: 50,
    borderRadius: Radius.medium,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonSmall: { minHeight: 44, paddingHorizontal: 12, borderRadius: 12 },
  buttonText: { fontSize: 16, fontWeight: '700' },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, minHeight: 40, justifyContent: 'center' },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
});
