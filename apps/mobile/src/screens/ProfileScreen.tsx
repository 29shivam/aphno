import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import { useAuth } from '../state/auth';
import { Avatar, Button, Card, ErrorText, GradientButton, Input, Pill, Row } from '../ui';
import { colors, font, radius } from '../theme';

// Mirror of the server-side UPI id rule so we can validate before submitting.
const UPI_RE = /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/;

export function ProfileScreen({ onBack }: { onBack: () => void }) {
  const { user, setUser, signOut } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [upiId, setUpiId] = useState(user?.upiId ?? '');
  const [err, setErr] = useState('');

  const upiValid = upiId.trim() === '' || UPI_RE.test(upiId.trim());
  const dirty = name.trim() !== (user?.name ?? '') || upiId.trim() !== (user?.upiId ?? '');

  const save = useMutation({
    mutationFn: () =>
      api.updateMe({
        ...(name.trim() ? { name: name.trim() } : {}),
        ...(upiId.trim() ? { upiId: upiId.trim() } : {}),
      }),
    onSuccess: (u) => {
      setUser(u);
      setErr('');
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : 'Could not save profile'),
  });

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    : '—';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} hitSlop={12}>
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>

      {/* Hero */}
      <View style={styles.hero}>
        <Avatar name={user?.name ?? user?.phone ?? '?'} id={user?.id} size={88} gradient />
        <Text style={styles.name}>{user?.name ?? user?.phone ?? 'Your profile'}</Text>
        {user?.phone ? <Text style={styles.sub}>{user.phone}</Text> : null}
        {user?.email ? <Text style={styles.sub}>{user.email}</Text> : null}
        <View style={{ height: 12 }} />
        {user?.upiId ? (
          <Pill tone="positive" label={`UPI · ${user.upiId}`} />
        ) : (
          <Pill tone="warning" label="No UPI ID yet" />
        )}
      </View>

      {/* Edit */}
      <Text style={styles.section}>Edit profile</Text>
      <Card style={{ marginBottom: 20 }}>
        <Input label="Display name" value={name} onChangeText={setName} placeholder="Aarav" />
        <View style={{ height: 14 }} />
        <Input
          label="UPI ID"
          value={upiId}
          onChangeText={setUpiId}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="name@okhdfc"
        />
        <Text style={[styles.hint, !upiValid && { color: colors.negative }]}>
          {upiValid
            ? 'So friends can pay you back in one tap.'
            : 'Enter a valid UPI id, e.g. name@okhdfc'}
        </Text>
        <ErrorText>{err}</ErrorText>
        <View style={{ height: 14 }} />
        <GradientButton
          label="Save changes"
          onPress={() => save.mutate()}
          loading={save.isPending}
          disabled={!dirty || !upiValid}
        />
      </Card>

      {/* Account */}
      <Text style={styles.section}>Account</Text>
      <Card style={{ marginBottom: 24 }}>
        <Row label="Phone" value={user?.phone ?? '—'} />
        <Row label="Email" value={user?.email ?? 'Not linked'} />
        <Row label="Member since" value={memberSince} />
      </Card>

      <Button label="Sign out" variant="danger" onPress={signOut} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 60, maxWidth: 560, width: '100%', alignSelf: 'center' },
  back: { color: colors.accent, fontSize: 15, fontWeight: '600', marginTop: 8, marginBottom: 8 },
  hero: { alignItems: 'center', paddingVertical: 20, marginBottom: 8 },
  name: { color: colors.text, fontSize: font.h1, fontWeight: '800', marginTop: 14 },
  sub: { color: colors.muted, fontSize: font.body, marginTop: 3 },
  section: {
    color: colors.muted,
    fontSize: font.small,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 12,
    marginLeft: 2,
  },
  hint: { color: colors.faint, fontSize: font.small, marginTop: 8 },
});
