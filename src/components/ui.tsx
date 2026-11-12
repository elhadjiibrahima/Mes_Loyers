import { type ReactNode } from 'react';
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

import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function Screen({ children, tabs = false }: { children: ReactNode; tabs?: boolean }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        padding: Spacing.three,
        paddingBottom: Spacing.five + (tabs ? BottomTabInset + insets.bottom : insets.bottom),
        gap: Spacing.three,
        width: '100%',
        maxWidth: MaxContentWidth,
        alignSelf: 'center',
      }}>
      {children}
    </ScrollView>
  );
}

export function T({
  children,
  variant = 'body',
  color,
  style,
}: {
  children: ReactNode;
  variant?: 'title' | 'subtitle' | 'body' | 'small' | 'big';
  color?: string;
  style?: TextStyle;
}) {
  const c = useTheme();
  return (
    <Text
      style={[
        styles[variant],
        { color: color ?? (variant === 'small' ? c.textSecondary : c.text) },
        style,
      ]}>
      {children}
    </Text>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: ViewStyle; onPress?: () => void }) {
  const c = useTheme();
  const base = [styles.card, { backgroundColor: c.backgroundElement, borderColor: c.border }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.7 }]}>
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
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  small?: boolean;
  disabled?: boolean;
}) {
  const c = useTheme();
  const bg = variant === 'primary' ? c.primary : variant === 'danger' ? c.danger : c.backgroundSelected;
  const fg = variant === 'primary' ? c.primaryText : variant === 'danger' ? '#fff' : c.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
      ]}>
      <Text style={[styles.buttonText, small && { fontSize: 14 }, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const c = useTheme();
  return (
    <View style={{ gap: Spacing.one }}>
      <T variant="small">{label}</T>
      <TextInput
        placeholderTextColor={c.textSecondary}
        {...props}
        style={[styles.input, { color: c.text, backgroundColor: c.backgroundElement, borderColor: c.border }]}
      />
    </View>
  );
}

export function Chips<V extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: V; label: string }[];
  value: V | null;
  onChange: (v: V) => void;
}) {
  const c = useTheme();
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            style={[
              styles.chip,
              { borderColor: active ? c.primary : c.border, backgroundColor: active ? c.primary : c.backgroundElement },
            ]}>
            <Text style={{ color: active ? c.primaryText : c.text, fontWeight: '500' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Badge({ label, tone }: { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }) {
  const c = useTheme();
  const color = tone === 'neutral' ? c.textSecondary : c[tone];
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={{ color, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

export function Empty({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: Spacing.five, gap: Spacing.two }}>
      <T variant="subtitle">{title}</T>
      <T variant="small" style={{ textAlign: 'center' }}>
        {text}
      </T>
      {action}
    </Card>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '700' },
  big: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 16 },
  small: { fontSize: 13 },
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.three, gap: Spacing.two },
  button: { borderRadius: 12, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center' },
  buttonSmall: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
});
