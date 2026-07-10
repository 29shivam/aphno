import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { avatarPalette, colors, font, gradients, radius, vivid } from './theme';

// Deterministic vivid gradient pair from any seed (id/name).
export function vividPair(seed: string): readonly [string, string] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return vivid[h % vivid.length] as unknown as readonly [string, string];
}

export function Button({
  label,
  onPress,
  loading,
  variant = 'primary',
  size = 'lg',
  disabled,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'lg' | 'md' | 'sm';
  disabled?: boolean;
}) {
  const bg = variant === 'primary' ? colors.accent : 'transparent';
  const fg =
    variant === 'primary' ? colors.accentText : variant === 'danger' ? colors.danger : colors.muted;
  const pad = size === 'lg' ? 14 : size === 'md' ? 11 : 8;
  const minH = size === 'lg' ? 52 : size === 'md' ? 44 : 36;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: bg, paddingVertical: pad, minHeight: minH },
        variant !== 'primary' && s.btnBordered,
        { opacity: disabled ? 0.45 : pressed ? 0.82 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[s.btnText, { color: fg, fontSize: size === 'sm' ? 13 : 15 }]}>{label}</Text>
      )}
    </Pressable>
  );
}

// Primary call-to-action with a vibrant gradient fill.
export function GradientButton({
  label,
  onPress,
  loading,
  disabled,
  colors: g = gradients.brand,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  colors?: readonly [string, string];
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => ({ opacity: disabled ? 0.4 : pressed ? 0.9 : 1 })}
    >
      <LinearGradient colors={g} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.gradBtn}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.gradBtnText}>{label}</Text>}
      </LinearGradient>
    </Pressable>
  );
}

export function Input({ label, ...props }: TextInputProps & { label?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ width: '100%' }}>
      {label ? <Text style={s.inputLabel}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.faint}
        style={[s.input, focused && s.inputFocused]}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        {...props}
      />
    </View>
  );
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

// Segmented toggle — used for the split-type switch (Equal / Exact / Percent).
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={s.segTrack}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[s.segItem, active && s.segItemActive]}
          >
            <Text style={[s.segText, active && s.segTextActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Circular initials avatar. Soft-tinted by default, or a vivid gradient fill
// (`gradient`) for headers and group icons.
export function Avatar({
  name,
  id,
  size = 34,
  gradient = false,
}: {
  name?: string | null;
  id?: string;
  size?: number;
  gradient?: boolean;
}) {
  const seed = id ?? name ?? '?';
  const initials =
    (name ?? '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || '?';
  if (gradient) {
    return (
      <LinearGradient
        colors={vividPair(seed)}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.avatar, { width: size, height: size, borderRadius: size / 2 }]}
      >
        <Text style={[s.avatarText, { color: '#fff', fontSize: size * 0.4 }]}>{initials}</Text>
      </LinearGradient>
    );
  }
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const bg = avatarPalette[hash % avatarPalette.length];
  return (
    <View
      style={[
        s.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg + '2E' },
      ]}
    >
      <Text style={[s.avatarText, { color: bg, fontSize: size * 0.4 }]}>{initials}</Text>
    </View>
  );
}

// Small status chip with a soft tinted background.
export function Pill({
  label,
  tone = 'muted',
}: {
  label: string;
  tone?: 'accent' | 'positive' | 'negative' | 'warning' | 'muted';
}) {
  const map = {
    accent: [colors.accentSoft, colors.accent],
    positive: [colors.positiveSoft, colors.positive],
    negative: [colors.negativeSoft, colors.negative],
    warning: [colors.warningSoft, colors.warning],
    muted: [colors.cardAlt, colors.muted],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[s.pill, { backgroundColor: bg }]}>
      <Text style={[s.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  btn: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnBordered: { borderWidth: 1, borderColor: colors.borderStrong },
  btnText: { fontWeight: '700', letterSpacing: 0.2 },
  gradBtn: {
    borderRadius: radius.md,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
  },
  gradBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  inputLabel: {
    color: colors.muted,
    fontSize: font.small,
    fontWeight: '600',
    marginBottom: 6,
    marginLeft: 2,
  },
  input: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: font.body + 1,
  },
  inputFocused: { borderColor: colors.accentBorder, backgroundColor: colors.bgElevated },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { color: colors.muted, fontSize: font.body },
  rowValue: { color: colors.text, fontSize: font.body, fontWeight: '600' },
  error: { color: colors.negative, fontSize: font.small, marginTop: 6 },
  segTrack: {
    flexDirection: 'row',
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    padding: 4,
    gap: 4,
  },
  segItem: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radius.sm + 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segItemActive: { backgroundColor: colors.accent },
  segText: { color: colors.muted, fontSize: font.small, fontWeight: '700' },
  segTextActive: { color: colors.accentText },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '800' },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  pillText: { fontSize: font.tiny + 1, fontWeight: '700', letterSpacing: 0.2 },
});
