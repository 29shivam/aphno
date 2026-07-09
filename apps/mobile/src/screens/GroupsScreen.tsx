import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import { useAuth } from '../state/auth';
import { Button, Card, ErrorText, Input } from '../ui';
import { colors } from '../theme';

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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.hi}>Hi{user?.name ? `, ${user.name}` : ''} 👋</Text>
          <Text style={styles.phone}>{user?.phone}</Text>
        </View>
        <Pressable onPress={() => setShowProfile((v) => !v)}>
          <Text style={styles.link}>{showProfile ? 'Close' : 'Profile'}</Text>
        </Pressable>
      </View>

      {needsUpi && !showProfile ? (
        <Pressable onPress={() => setShowProfile(true)}>
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              Add your UPI ID so friends can pay you back in one tap →
            </Text>
          </View>
        </Pressable>
      ) : null}

      {showProfile ? (
        <Card style={{ marginBottom: 16 }}>
          <Text style={styles.cardTitle}>Your profile</Text>
          <Text style={styles.fieldLabel}>Display name</Text>
          <Input value={name} onChangeText={setName} placeholder="Aarav" />
          <Text style={styles.fieldLabel}>UPI ID</Text>
          <Input
            value={upiId}
            onChangeText={setUpiId}
            autoCapitalize="none"
            placeholder="name@okhdfc"
          />
          <ErrorText>{profileErr}</ErrorText>
          <View style={{ height: 12 }} />
          <Button
            label="Save"
            onPress={() => saveProfile.mutate()}
            loading={saveProfile.isPending}
          />
          <View style={{ height: 8 }} />
          <Button label="Sign out" variant="danger" onPress={signOut} />
        </Card>
      ) : null}

      <Text style={styles.section}>New group</Text>
      <Card style={{ marginBottom: 20 }}>
        <Input value={newName} onChangeText={setNewName} placeholder="Group name (e.g. Goa Trip)" />
        <View style={{ height: 10 }} />
        <Input
          value={newPhones}
          onChangeText={setNewPhones}
          autoCapitalize="none"
          placeholder="Member phones, comma-separated (optional)"
        />
        <ErrorText>{createErr}</ErrorText>
        <View style={{ height: 12 }} />
        <Button
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
          <Pressable key={g.id} onPress={() => onOpen(g.id)}>
            <Card style={styles.groupCard}>
              <View>
                <Text style={styles.groupName}>{g.name}</Text>
                <Text style={styles.muted}>
                  {g.memberCount} member{g.memberCount === 1 ? '' : 's'}
                </Text>
              </View>
              <Text style={styles.chev}>›</Text>
            </Card>
          </Pressable>
        ))
      ) : (
        <Text style={styles.muted}>No groups yet — create one above.</Text>
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
  hi: { color: colors.text, fontSize: 24, fontWeight: '800' },
  phone: { color: colors.muted, fontSize: 13, marginTop: 2 },
  link: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  banner: {
    backgroundColor: colors.cardAlt,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  bannerText: { color: colors.text, fontSize: 13 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  fieldLabel: { color: colors.muted, fontSize: 12, marginTop: 12, marginBottom: 6 },
  section: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
    marginLeft: 4,
  },
  muted: { color: colors.muted, fontSize: 14 },
  groupCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  groupName: { color: colors.text, fontSize: 17, fontWeight: '700' },
  chev: { color: colors.faint, fontSize: 28, fontWeight: '300' },
});
