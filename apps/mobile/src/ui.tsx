import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { colors } from './theme';

export function Button({
  label,
  onPress,
  loading,
  variant = 'primary',
  disabled,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
}) {
  const bg =
    variant === 'primary' ? colors.accent : variant === 'danger' ? 'transparent' : 'transparent';
  const fg =
    variant === 'primary' ? colors.accentText : variant === 'danger' ? colors.danger : colors.muted;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        variant !== 'primary' && s.btnBordered,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[s.btnText, { color: fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Input(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.faint} style={s.input} {...props} />;
}

export function Card({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Row({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={[s.rowValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <Text style={s.error}>{children}</Text>;
}

const s = StyleSheet.create({
  btn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  btnBordered: { borderWidth: 1, borderColor: colors.border },
  btnText: { fontSize: 15, fontWeight: '700' },
  input: {
    backgroundColor: colors.cardAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 18 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { color: colors.muted, fontSize: 14 },
  rowValue: { color: colors.text, fontSize: 15, fontWeight: '600' },
  error: { color: colors.negative, fontSize: 13, marginTop: 6 },
});
