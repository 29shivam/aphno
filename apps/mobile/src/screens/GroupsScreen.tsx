import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FeedItem } from '@aphno/shared';
import { api, ApiError, rupees } from '../api/client';
import { useAuth } from '../state/auth';
import { Avatar, Card, ErrorText, GradientButton, Input } from '../ui';
import { colors, font, gradients, radius } from '../theme';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}

export function GroupsScreen({
  onOpen,
  onOpenNotifications,
  onOpenProfile,
}: {
  onOpen: (groupId: string) => void;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [newName, setNewName] = useState('');
  const [newPhones, setNewPhones] = useState('');
  const [createErr, setCreateErr] = useState('');

  const [friendPhone, setFriendPhone] = useState('');
  const [friendName, setFriendName] = useState('');
  const [friendErr, setFriendErr] = useState('');

  const groups = useQuery({ queryKey: ['groups'], queryFn: api.listGroups });
  const friends = useQuery({ queryKey: ['friends'], queryFn: api.friends });
  const feed = useQuery({ queryKey: ['feed'], queryFn: () => api.feed() });
  const notifs = useQuery({ queryKey: ['notifications'], queryFn: () => api.notifications() });
  const unread = notifs.data?.unreadCount ?? 0;

  // One-line summary of a feed item from the viewer's perspective.
  const feedLine = (it: FeedItem): { title: string; sub: string; positive: boolean } => {
    if (it.kind === 'settlement') {
      const youPaid = it.fromId === user?.id;
      const youGot = it.toId === user?.id;
      const title = youPaid
        ? `You paid ${it.toName}`
        : youGot
          ? `${it.fromName} paid you`
          : `${it.fromName} paid ${it.toName}`;
      return { title, sub: `${it.groupName} · ${timeAgo(it.at)}`, positive: youGot };
    }
    const you = it.actorId === user?.id;
    const title = `${you ? 'You' : it.actorName} added “${it.description}”`;
    const share = it.yourShare && !you ? ` · you owe ${rupees(it.yourShare)}` : '';
    return { title, sub: `${it.groupName}${share} · ${timeAgo(it.at)}`, positive: false };
  };

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

  const addFriend = useMutation({
    mutationFn: () => api.addFriend(friendPhone.trim(), friendName.trim() || undefined),
    onSuccess: () => {
      setFriendPhone('');
      setFriendName('');
      setFriendErr('');
      qc.invalidateQueries({ queryKey: ['friends'] });
    },
    onError: (e) => setFriendErr(e instanceof ApiError ? e.message : 'Could not add friend'),
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
        <View style={styles.headerRight}>
          <Pressable onPress={onOpenNotifications} style={styles.bellBtn} hitSlop={8}>
            <Text style={styles.bellIcon}>🔔</Text>
            {unread > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable onPress={onOpenProfile} style={styles.profileBtn}>
            <Text style={styles.profileBtnText}>Profile</Text>
          </Pressable>
        </View>
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

      {needsUpi ? (
        <Pressable onPress={onOpenProfile} style={styles.banner}>
          <View style={styles.bannerDot} />
          <Text style={styles.bannerText}>
            Add your UPI ID so friends can pay you back in one tap
          </Text>
          <Text style={styles.bannerArrow}>→</Text>
        </Pressable>
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

      {/* Friends (1-on-1) */}
      <Text style={[styles.section, { marginTop: 28 }]}>Friends</Text>
      <Card style={{ marginBottom: 16 }}>
        <Input
          value={friendPhone}
          onChangeText={setFriendPhone}
          keyboardType="phone-pad"
          placeholder="Friend's phone (+91…)"
        />
        <View style={{ height: 10 }} />
        <Input value={friendName} onChangeText={setFriendName} placeholder="Name (optional)" />
        <ErrorText>{friendErr}</ErrorText>
        <View style={{ height: 12 }} />
        <GradientButton
          label="Add friend"
          onPress={() => addFriend.mutate()}
          loading={addFriend.isPending}
          disabled={!friendPhone.trim()}
        />
      </Card>

      {friends.isLoading ? (
        <Text style={styles.muted}>Loading…</Text>
      ) : friends.data && friends.data.length > 0 ? (
        friends.data.map((f) => {
          const label = f.name ?? f.phone ?? 'Friend';
          const val =
            f.net === 0
              ? 'settled up'
              : f.net > 0
                ? `owes you ${rupees(f.net)}`
                : `you owe ${rupees(-f.net)}`;
          const color = f.net === 0 ? colors.muted : f.net > 0 ? colors.positive : colors.negative;
          return (
            <Pressable key={f.groupId} onPress={() => onOpen(f.groupId)} style={styles.groupCard}>
              <Avatar name={label} id={f.userId} size={44} gradient />
              <View style={{ flex: 1 }}>
                <Text style={styles.groupName}>{label}</Text>
                <Text style={[styles.muted, { color }]}>{val}</Text>
              </View>
              <Text style={styles.chev}>›</Text>
            </Pressable>
          );
        })
      ) : (
        <Text style={styles.muted}>No friends yet — add one to split 1-on-1.</Text>
      )}

      {/* Global activity feed */}
      <Text style={[styles.section, { marginTop: 28 }]}>Activity</Text>
      {feed.isLoading ? (
        <Text style={styles.muted}>Loading…</Text>
      ) : feed.data && feed.data.items.length > 0 ? (
        feed.data.items.map((it) => {
          const line = feedLine(it);
          return (
            <Pressable
              key={`${it.kind}-${it.id}`}
              onPress={() => onOpen(it.groupId)}
              style={styles.feedRow}
            >
              {it.kind === 'settlement' ? (
                <View style={styles.feedIcon}>
                  <Text style={styles.feedIconText}>₹</Text>
                </View>
              ) : (
                <Avatar name={it.actorName} id={it.actorId ?? it.id} size={38} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.feedTitle} numberOfLines={1}>
                  {line.title}
                </Text>
                <Text style={styles.feedSub} numberOfLines={1}>
                  {line.sub}
                </Text>
              </View>
              <Text style={[styles.feedAmt, line.positive && { color: colors.positive }]}>
                {rupees(it.amount)}
              </Text>
            </Pressable>
          );
        })
      ) : (
        <Text style={styles.muted}>No activity yet.</Text>
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
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellIcon: { fontSize: 17 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.negative,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  feedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  feedIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.positiveSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedIconText: { color: colors.positive, fontSize: 18, fontWeight: '800' },
  feedTitle: { color: colors.text, fontSize: font.body, fontWeight: '700' },
  feedSub: { color: colors.muted, fontSize: font.small, marginTop: 2 },
  feedAmt: { color: colors.text, fontSize: font.h3, fontWeight: '800' },
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
