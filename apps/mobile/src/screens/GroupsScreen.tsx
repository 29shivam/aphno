import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import { useAuth } from '../state/auth';
import { Avatar, Button, Card, ErrorText, GradientButton, Input } from '../ui';
import { colors, font, gradients, radius } from '../theme';

export function GroupsScreen({ onOpen }: { onOpen: (groupId: string) => void }) {
  const { user, setUser, signOut } = useAuth();
  const qc = useQueryClient();
  const [showProfile, setShowProfile] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
  const [upiId, setUpiId] = useState(user?.upiId ?? '');
  const [profileErr, setProfileErr] = useState('');

  const [newName, setNewName] = useState('');
  const [newPhones, setNewPhones] = useState('');
  const [createErr, setCreateErr] = useState('');

  const groups = useQuery({ queryKey: ['groups'], queryFn: api.listGroups });

  const saveProfile = useMutation({
    mutationFn: () =>
      api.updateMe({ name: name.trim() || undefined, upiId: upiId.trim() || undefined }),
    onSuccess: (u) => {
      setUser(u);
      setShowProfile(false);
      setProfileErr('');
    },
    onError: (e) => setProfileErr(e instanceof ApiError ? e.message : 'Could not save'),
  });

  const createGroup = useMutation({
    mutationFn: () => {
      const phones = newPhones
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      return api.createGroup(newName.trim(), phones.length ? phones : undefined);
    },
    onSuccess: () => {
      setNewName('');
      setNewPhones('');
      setCreateErr('');
      qc.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (e) => setCreateErr(e instanceof ApiError ? e.message : 'Could not create group'),
  });

  const needsUpi = !user?.upiId;

  const groupCount = groups.data?.length ?? 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Avatar name={user?.name ?? user?.phone ?? '?'} id={user?.id} size={46} gradient />
          <View>
            <Text style={styles.hi}>Hi{user?.name ? `, ${user.name}` : ''} 👋</Text>
            <Text style={styles.phone}>{user?.phone}</Text>
          </View>
        </View>
        <Pressable onPress={() => setShowProfile((v) => !v)} style={styles.profileBtn}>
          <Text style={styles.profileBtnText}>{showProfile ? 'Close' : 'Profile'}</Text>
        </Pressable>
      </View>

      {/* Hero */}
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <Text style={styles.heroLabel}>YOUR GROUPS</Text>
        <Text style={styles.heroBig}>{groupCount}</Text>
        <Text style={styles.heroSub}>
          {groupCount === 0
            ? 'Create your first group to start splitting'
            : `${groupCount} active · split bills, settle over UPI`}
        </Text>
      </LinearGradient>

      {needsUpi && !showProfile ? (
        <Pressable onPress={() => setShowProfile(true)} style={styles.banner}>
          <View style={styles.bannerDot} />
          <Text style={styles.bannerText}>
            Add your UPI ID so friends can pay you back in one tap
          </Text>
          <Text style={styles.bannerArrow}>→</Text>
        </Pressable>
      ) : null}

      {showProfile ? (
        <Card style={{ marginBottom: 20 }}>
          <Text style={styles.cardTitle}>Your profile</Text>
          <Input label="Display name" value={name} onChangeText={setName} placeholder="Aarav" />
          <View style={{ height: 12 }} />
          <Input
            label="UPI ID"
            value={upiId}
            onChangeText={setUpiId}
            autoCapitalize="none"
            placeholder="name@okhdfc"
          />
          <ErrorText>{profileErr}</ErrorText>
          <View style={{ height: 14 }} />
          <GradientButton
            label="Save"
            onPress={() => saveProfile.mutate()}
            loading={saveProfile.isPending}
          />
          <View style={{ height: 8 }} />
          <Button label="Sign out" variant="danger" onPress={signOut} />
        </Card>
      ) : null}

      <Text style={styles.section}>New group</Text>
      <Card style={{ marginBottom: 24 }}>
        <Input value={newName} onChangeText={setNewName} placeholder="Group name (e.g. Goa Trip)" />
        <View style={{ height: 10 }} />
        <Input
          value={newPhones}
          onChangeText={setNewPhones}
          autoCapitalize="none"
          placeholder="Member phones, comma-separated (optional)"
        />
        <ErrorText>{createErr}</ErrorText>
        <View style={{ height: 14 }} />
        <GradientButton
          label="Create group"
          onPress={() => createGroup.mutate()}
          loading={createGroup.isPending}
          disabled={!newName.trim()}
        />
      </Card>

      <Text style={styles.section}>Your groups</Text>
      {groups.isLoading ? (
        <Text style={styles.muted}>Loading…</Text>
      ) : groups.error ? (
        <ErrorText>Could not load groups.</ErrorText>
      ) : groups.data && groups.data.length > 0 ? (
        groups.data.map((g) => (
          <Pressable key={g.id} onPress={() => onOpen(g.id)} style={styles.groupCard}>
            <Avatar name={g.name} id={g.id} size={44} gradient />
            <View style={{ flex: 1 }}>
              <Text style={styles.groupName}>{g.name}</Text>
              <Text style={styles.muted}>
                {g.memberCount} member{g.memberCount === 1 ? '' : 's'}
              </Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </Pressable>
        ))
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🧾</Text>
          <Text style={styles.emptyText}>No groups yet — create one above.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 60, maxWidth: 560, width: '100%', alignSelf: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 8,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hi: { color: colors.text, fontSize: font.h2, fontWeight: '800' },
  phone: { color: colors.muted, fontSize: font.small, marginTop: 2 },
  profileBtn: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  profileBtnText: { color: colors.text, fontSize: font.small, fontWeight: '700' },
  hero: {
    borderRadius: radius.xl,
    padding: 22,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroLabel: { color: colors.muted, fontSize: font.tiny, fontWeight: '800', letterSpacing: 1.2 },
  heroBig: { color: colors.text, fontSize: 46, fontWeight: '900', marginTop: 4, letterSpacing: -1 },
  heroSub: { color: colors.muted, fontSize: font.body, marginTop: 4 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 20,
  },
  bannerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  bannerText: { color: colors.text, fontSize: font.small, flex: 1, fontWeight: '500' },
  bannerArrow: { color: colors.accent, fontSize: font.body, fontWeight: '800' },
  cardTitle: { color: colors.text, fontSize: font.h3, fontWeight: '700', marginBottom: 12 },
  section: {
    color: colors.muted,
    fontSize: font.small,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 12,
    marginLeft: 2,
    textTransform: 'uppercase',
  },
  muted: { color: colors.muted, fontSize: font.small },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  groupName: { color: colors.text, fontSize: font.h3 + 1, fontWeight: '700' },
  chev: { color: colors.faint, fontSize: 26, fontWeight: '300' },
  empty: { alignItems: 'center', paddingVertical: 32 },
  emptyEmoji: { fontSize: 40, marginBottom: 10 },
  emptyText: { color: colors.muted, fontSize: font.body },
});
