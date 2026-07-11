import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { colors, font, radius } from '../theme';

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

function iconFor(type: string): { emoji: string; bg: string; fg: string } {
  if (type === 'SETTLEMENT_RECEIVED')
    return { emoji: '₹', bg: colors.positiveSoft, fg: colors.positive };
  return { emoji: '🧾', bg: colors.accentSoft, fg: colors.accent };
}

export function NotificationsScreen({ onBack }: { onBack: () => void }) {
  const qc = useQueryClient();
  const notifs = useQuery({ queryKey: ['notifications'], queryFn: () => api.notifications() });
  const marked = useRef(false);

  const markRead = useMutation({
    mutationFn: () => api.markNotificationsRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  // Mark everything read once, after the first load that has unread items.
  useEffect(() => {
    if (!marked.current && (notifs.data?.unreadCount ?? 0) > 0) {
      marked.current = true;
      markRead.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifs.data?.unreadCount]);

  const items = notifs.data?.items ?? [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} hitSlop={12}>
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>
      <Text style={styles.title}>Notifications</Text>

      {notifs.isLoading ? (
        <Text style={styles.muted}>Loading…</Text>
      ) : items.length > 0 ? (
        items.map((n) => {
          const ic = iconFor(n.type);
          return (
            <View key={n.id} style={[styles.row, !n.read && styles.rowUnread]}>
              <View style={[styles.icon, { backgroundColor: ic.bg }]}>
                <Text style={[styles.iconText, { color: ic.fg }]}>{ic.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.body}>{n.body}</Text>
                <Text style={styles.meta}>
                  {n.title} · {timeAgo(n.createdAt)}
                </Text>
              </View>
              {!n.read ? <View style={styles.dot} /> : null}
            </View>
          );
        })
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🔔</Text>
          <Text style={styles.muted}>No notifications yet.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 60, maxWidth: 560, width: '100%', alignSelf: 'center' },
  back: { color: colors.accent, fontSize: 15, fontWeight: '600', marginTop: 8, marginBottom: 8 },
  title: { color: colors.text, fontSize: font.h1, fontWeight: '800', marginBottom: 20 },
  muted: { color: colors.muted, fontSize: font.body },
  row: {
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
  rowUnread: { borderColor: colors.accentBorder, backgroundColor: colors.bgElevated },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 18, fontWeight: '800' },
  body: { color: colors.text, fontSize: font.body, fontWeight: '600' },
  meta: { color: colors.muted, fontSize: font.small, marginTop: 3 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.accent },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyEmoji: { fontSize: 40, marginBottom: 10 },
});
