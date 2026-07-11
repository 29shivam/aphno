import { useMemo, useRef, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Expense, GroupMember, Settlement, SplitType } from '@aphno/shared';
import { api, ApiError, rupees, toPaise } from '../api/client';
import { useAuth } from '../state/auth';
import {
  Avatar,
  Button,
  Card,
  ErrorText,
  GradientButton,
  Input,
  Pill,
  SegmentedControl,
} from '../ui';
import { colors, font, radius } from '../theme';

// Compact relative time for the activity feed.
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

function openUpi(url: string) {
  if (Platform.OS === 'web') {
    globalThis.open?.(url, '_blank');
  } else {
    Linking.openURL(url).catch(() => {});
  }
}

export function GroupDetailScreen({ groupId, onBack }: { groupId: string; onBack: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [addErr, setAddErr] = useState('');
  const [memberPhone, setMemberPhone] = useState('');
  const [splitType, setSplitType] = useState<SplitType>('EQUAL');
  const [splitInputs, setSplitInputs] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const group = useQuery({ queryKey: ['group', groupId], queryFn: () => api.getGroup(groupId) });
  const balances = useQuery({
    queryKey: ['balances', groupId],
    queryFn: () => api.balances(groupId),
  });
  const expenses = useQuery({
    queryKey: ['expenses', groupId],
    queryFn: () => api.listExpenses(groupId),
  });
  const settlements = useQuery({
    queryKey: ['settlements', groupId],
    queryFn: () => api.listSettlements(groupId),
  });

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const mem of group.data?.members ?? [])
      m.set(mem.userId, mem.name ?? mem.phone ?? 'Member');
    return m;
  }, [group.data]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['balances', groupId] });
    qc.invalidateQueries({ queryKey: ['expenses', groupId] });
    qc.invalidateQueries({ queryKey: ['settlements', groupId] });
    qc.invalidateQueries({ queryKey: ['group', groupId] });
  };

  const members = group.data?.members ?? [];
  const totalPaise = Math.round((parseFloat(amount) || 0) * 100);

  // Live per-person split math for EXACT / PERCENT. `remaining` drives the
  // balance pill; `valid` gates the submit button; `splits` is the API payload.
  const split = useMemo(() => {
    if (splitType === 'EQUAL') return { valid: true, remaining: 0, splits: [] };
    if (splitType === 'EXACT') {
      const rows = members.map((m) => ({
        userId: m.userId,
        paise: Math.round((parseFloat(splitInputs[m.userId] ?? '') || 0) * 100),
      }));
      const sum = rows.reduce((a, r) => a + r.paise, 0);
      const remaining = totalPaise - sum;
      return {
        valid: totalPaise > 0 && remaining === 0,
        remaining,
        splits: rows.filter((r) => r.paise > 0).map((r) => ({ userId: r.userId, value: r.paise })),
      };
    }
    const rows = members.map((m) => ({
      userId: m.userId,
      pct: parseFloat(splitInputs[m.userId] ?? '') || 0,
    }));
    const sum = rows.reduce((a, r) => a + r.pct, 0);
    const remaining = Math.round((100 - sum) * 100) / 100;
    return {
      valid: totalPaise > 0 && Math.abs(remaining) < 0.01,
      remaining,
      splits: rows.filter((r) => r.pct > 0).map((r) => ({ userId: r.userId, value: r.pct })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitType, splitInputs, totalPaise, group.data]);

  // Distribute the amount (or 100%) evenly, giving any rounding remainder to
  // the last member so the split always balances exactly.
  const fillEvenly = () => {
    if (members.length === 0) return;
    const whole = splitType === 'PERCENT' ? 100 : parseFloat(amount) || 0;
    if (whole <= 0) return;
    const each = Math.floor((whole / members.length) * 100) / 100;
    let acc = 0;
    const next: Record<string, string> = {};
    members.forEach((m, i) => {
      const v = i === members.length - 1 ? Math.round((whole - acc) * 100) / 100 : each;
      acc += each;
      next[m.userId] = String(v);
    });
    setSplitInputs(next);
  };

  const resetForm = () => {
    setDesc('');
    setAmount('');
    setSplitInputs({});
    setSplitType('EQUAL');
    setEditingId(null);
    setAddErr('');
  };

  // Create when adding, PATCH when editing — same validated body either way.
  const saveExpense = useMutation({
    mutationFn: () => {
      const body = {
        description: desc.trim(),
        amount: toPaise(amount),
        splitType,
        ...(splitType !== 'EQUAL' ? { splits: split.splits } : {}),
      };
      return editingId ? api.updateExpense(editingId, body) : api.addExpense(groupId, body);
    },
    onSuccess: () => {
      resetForm();
      refresh();
    },
    onError: (e) => setAddErr(e instanceof ApiError ? e.message : 'Could not save expense'),
  });

  const removeExpense = useMutation({
    mutationFn: (id: string) => api.deleteExpense(id),
    onSuccess: () => {
      resetForm();
      refresh();
    },
    onError: (e) => setAddErr(e instanceof ApiError ? e.message : 'Could not delete expense'),
  });

  // Load an existing expense into the form for editing, then scroll to it.
  const startEdit = (e: Expense) => {
    setEditingId(e.id);
    setDesc(e.description);
    setAmount((e.amount / 100).toString());
    setSplitType(e.splitType);
    if (e.splitType === 'EXACT') {
      const next: Record<string, string> = {};
      for (const s of e.splits) next[s.userId] = (s.amount / 100).toString();
      setSplitInputs(next);
    } else if (e.splitType === 'PERCENT') {
      const next: Record<string, string> = {};
      for (const s of e.splits)
        next[s.userId] = String(Math.round((s.amount / e.amount) * 1000) / 10);
      setSplitInputs(next);
    } else {
      setSplitInputs({});
    }
    setAddErr('');
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  // Merge expenses + settlements into one reverse-chronological activity feed.
  type ActivityItem =
    | { kind: 'expense'; at: string; expense: Expense }
    | { kind: 'settlement'; at: string; settlement: Settlement };
  const activity = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [];
    for (const e of expenses.data ?? [])
      items.push({ kind: 'expense', at: e.createdAt, expense: e });
    for (const s of settlements.data ?? [])
      items.push({ kind: 'settlement', at: s.createdAt, settlement: s });
    items.sort((a, b) => b.at.localeCompare(a.at));
    return items;
  }, [expenses.data, settlements.data]);

  const addMember = useMutation({
    mutationFn: () => api.addMember(groupId, memberPhone.trim()),
    onSuccess: () => {
      setMemberPhone('');
      refresh();
    },
  });

  const settle = useMutation({
    mutationFn: (vars: { toUserId: string; amount: number }) =>
      api.createSettlement(groupId, { toUserId: vars.toUserId, amount: vars.amount }),
    onSuccess: async (settlement) => {
      if (settlement.upiIntentUrl) openUpi(settlement.upiIntentUrl);
      // Optimistically mark it paid so balances reflect the settle-up.
      await api.completeSettlement(settlement.id, undefined).catch(() => {});
      refresh();
    },
  });

  // Debts where the current user is the one who owes.
  const myDebts = (balances.data?.debts ?? []).filter((d) => d.fromUserId === user?.id);

  // Smart settle-up: how many raw IOUs the minimal-transfer graph collapsed.
  const totalTransfers = balances.data?.debts.length ?? 0;
  const naiveTransfers = balances.data?.naiveTransferCount ?? 0;
  const smartSaved = naiveTransfers - totalTransfers;

  return (
    <ScrollView ref={scrollRef} style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} hitSlop={12}>
        <Text style={styles.back}>‹ Groups</Text>
      </Pressable>
      <Text style={styles.title}>{group.data?.name ?? '…'}</Text>

      {/* Balances */}
      <Text style={styles.section}>Balances</Text>
      <Card style={{ marginBottom: 16 }}>
        {balances.isLoading ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : (
          (balances.data?.balances ?? []).map((b) => {
            const isMe = b.userId === user?.id;
            const label = (b.name ?? nameById.get(b.userId) ?? 'Member') + (isMe ? ' (you)' : '');
            const val =
              b.net === 0
                ? 'settled up'
                : b.net > 0
                  ? `gets ${rupees(b.net)}`
                  : `owes ${rupees(-b.net)}`;
            const color =
              b.net === 0 ? colors.muted : b.net > 0 ? colors.positive : colors.negative;
            return (
              <View key={b.userId} style={styles.balRow}>
                <Text style={styles.balName}>{label}</Text>
                <Text style={[styles.balVal, { color }]}>{val}</Text>
              </View>
            );
          })
        )}
      </Card>

      {/* Smart settle-up */}
      {myDebts.length > 0 ? (
        <>
          <View style={styles.sectionRow}>
            <Text style={styles.section}>Smart settle-up</Text>
            {smartSaved > 0 ? (
              <Pill tone="positive" label={`${naiveTransfers} → ${totalTransfers}`} />
            ) : null}
          </View>
          <Card style={{ marginBottom: 16 }}>
            {smartSaved > 0 ? (
              <Text style={styles.smartLine}>
                ⚡ Minimized {naiveTransfers} back-and-forth IOUs into just {totalTransfers} payment
                {totalTransfers === 1 ? '' : 's'} — settle in the fewest taps.
              </Text>
            ) : null}
            {myDebts.map((d) => (
              <View key={d.toUserId} style={styles.settleRow}>
                <Text style={styles.balName}>
                  Pay {nameById.get(d.toUserId) ?? 'member'} {rupees(d.amount)}
                </Text>
                <Pressable
                  style={styles.payBtn}
                  onPress={() => settle.mutate({ toUserId: d.toUserId, amount: d.amount })}
                >
                  <Text style={styles.payBtnText}>Pay via UPI</Text>
                </Pressable>
              </View>
            ))}
            <Text style={styles.hint}>Opens your UPI app, then marks the debt settled.</Text>
          </Card>
        </>
      ) : null}

      {/* Add / edit expense */}
      <View style={styles.sectionRow}>
        <Text style={styles.section}>{editingId ? 'Edit expense' : 'Add an expense'}</Text>
        {editingId ? (
          <Pressable onPress={resetForm} hitSlop={8}>
            <Text style={styles.link}>Cancel</Text>
          </Pressable>
        ) : null}
      </View>
      <Card style={{ marginBottom: 16 }}>
        <Input
          label="Description"
          value={desc}
          onChangeText={setDesc}
          placeholder="What was it for?"
        />
        <View style={{ height: 14 }} />
        <Input
          label="Amount"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="₹ 0.00"
        />
        <View style={{ height: 16 }} />
        <Text style={styles.fieldLabel}>Split</Text>
        <SegmentedControl
          value={splitType}
          onChange={setSplitType}
          options={[
            { label: 'Equally', value: 'EQUAL' },
            { label: 'Exact ₹', value: 'EXACT' },
            { label: 'Percent', value: 'PERCENT' },
          ]}
        />

        {splitType === 'EQUAL' ? (
          <Text style={styles.hint}>
            Split equally between all {members.length} member{members.length === 1 ? '' : 's'}
            {totalPaise > 0 && members.length > 0
              ? ` · ${rupees(Math.round(totalPaise / members.length))} each`
              : ''}
            .
          </Text>
        ) : (
          <View style={{ marginTop: 14 }}>
            <View style={styles.splitHead}>
              <Text style={styles.fieldLabelSm}>Per person</Text>
              <Pressable onPress={fillEvenly} hitSlop={8}>
                <Text style={styles.link}>Split evenly</Text>
              </Pressable>
            </View>
            {members.map((m) => (
              <View key={m.userId} style={styles.splitRow}>
                <Avatar name={m.name ?? m.phone} id={m.userId} size={32} />
                <Text style={styles.splitName} numberOfLines={1}>
                  {m.name ?? m.phone}
                  {m.userId === user?.id ? ' (you)' : ''}
                </Text>
                <View style={styles.splitInputWrap}>
                  {splitType === 'EXACT' ? <Text style={styles.affix}>₹</Text> : null}
                  <TextInput
                    value={splitInputs[m.userId] ?? ''}
                    onChangeText={(t) => setSplitInputs((p) => ({ ...p, [m.userId]: t }))}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={colors.faint}
                    style={styles.splitInput}
                  />
                  {splitType === 'PERCENT' ? <Text style={styles.affix}>%</Text> : null}
                </View>
              </View>
            ))}
            <View style={styles.splitFooter}>
              <Text style={styles.muted}>
                {splitType === 'EXACT'
                  ? `Must total ${totalPaise > 0 ? rupees(totalPaise) : '—'}`
                  : 'Must total 100%'}
              </Text>
              {totalPaise <= 0 ? (
                <Pill tone="muted" label="Enter amount" />
              ) : splitType === 'EXACT' ? (
                split.remaining === 0 ? (
                  <Pill tone="positive" label="Balanced" />
                ) : split.remaining > 0 ? (
                  <Pill tone="warning" label={`${rupees(split.remaining)} left`} />
                ) : (
                  <Pill tone="negative" label={`Over ${rupees(-split.remaining)}`} />
                )
              ) : Math.abs(split.remaining) < 0.01 ? (
                <Pill tone="positive" label="100%" />
              ) : split.remaining > 0 ? (
                <Pill tone="warning" label={`${split.remaining}% left`} />
              ) : (
                <Pill tone="negative" label={`Over ${-split.remaining}%`} />
              )}
            </View>
          </View>
        )}

        <ErrorText>{addErr}</ErrorText>
        <View style={{ height: 16 }} />
        <GradientButton
          label={editingId ? 'Save changes' : 'Add expense'}
          onPress={() => saveExpense.mutate()}
          loading={saveExpense.isPending}
          disabled={!desc.trim() || !amount.trim() || (splitType !== 'EQUAL' && !split.valid)}
        />
        {editingId ? (
          <>
            <View style={{ height: 8 }} />
            <Button
              label="Delete expense"
              variant="danger"
              onPress={() => removeExpense.mutate(editingId)}
              loading={removeExpense.isPending}
            />
          </>
        ) : null}
      </Card>

      {/* Activity feed — expenses + settlements, newest first */}
      <Text style={styles.section}>Activity</Text>
      {expenses.isLoading || settlements.isLoading ? (
        <Text style={styles.muted}>Loading…</Text>
      ) : activity.length > 0 ? (
        activity.map((item) =>
          item.kind === 'expense' ? (
            <Pressable
              key={`e-${item.expense.id}`}
              onPress={() => startEdit(item.expense)}
              style={[styles.actRow, editingId === item.expense.id && styles.actRowEditing]}
            >
              <Avatar
                name={nameById.get(item.expense.paidById)}
                id={item.expense.paidById}
                size={38}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.actTitle} numberOfLines={1}>
                  {item.expense.description}
                </Text>
                <Text style={styles.actSub} numberOfLines={1}>
                  {nameById.get(item.expense.paidById) ?? 'Someone'} paid · split{' '}
                  {item.expense.splitType.toLowerCase()} · {timeAgo(item.at)}
                </Text>
              </View>
              <Text style={styles.actAmt}>{rupees(item.expense.amount)}</Text>
            </Pressable>
          ) : (
            <View key={`s-${item.settlement.id}`} style={styles.actRow}>
              <View style={styles.settleIcon}>
                <Text style={styles.settleIconText}>₹</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actTitle} numberOfLines={1}>
                  {nameById.get(item.settlement.fromUserId) ?? 'Someone'} paid{' '}
                  {nameById.get(item.settlement.toUserId) ?? 'member'}
                </Text>
                <Text style={styles.actSub} numberOfLines={1}>
                  {item.settlement.method.toUpperCase()} · {item.settlement.status.toLowerCase()} ·{' '}
                  {timeAgo(item.at)}
                </Text>
              </View>
              <Text style={[styles.actAmt, { color: colors.positive }]}>
                {rupees(item.settlement.amount)}
              </Text>
            </View>
          ),
        )
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🧾</Text>
          <Text style={styles.muted}>No activity yet — add your first expense above.</Text>
        </View>
      )}

      {/* Members */}
      <Text style={styles.section}>Members</Text>
      <Card style={{ marginBottom: 16 }}>
        {(group.data?.members ?? []).map((m: GroupMember) => (
          <View key={m.userId} style={styles.balRow}>
            <Text style={styles.balName}>
              {m.name ?? m.phone}
              {m.userId === user?.id ? ' (you)' : ''}
            </Text>
            <Text style={styles.muted}>{m.role.toLowerCase()}</Text>
          </View>
        ))}
        <View style={{ height: 12 }} />
        <Input
          value={memberPhone}
          onChangeText={setMemberPhone}
          keyboardType="phone-pad"
          placeholder="Add member by phone"
        />
        <View style={{ height: 10 }} />
        <Button
          label="Add member"
          variant="ghost"
          onPress={() => addMember.mutate()}
          loading={addMember.isPending}
          disabled={!memberPhone.trim()}
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 60, maxWidth: 560, width: '100%', alignSelf: 'center' },
  back: { color: colors.accent, fontSize: 15, fontWeight: '600', marginTop: 8, marginBottom: 8 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800', marginBottom: 20 },
  section: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
    marginLeft: 4,
  },
  muted: { color: colors.muted, fontSize: 14 },
  hint: { color: colors.faint, fontSize: 12, marginTop: 8 },
  balRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  balName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  balVal: { fontSize: 15, fontWeight: '700' },
  settleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  payBtn: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  payBtnText: { color: colors.accentText, fontWeight: '700', fontSize: 13 },
  expCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  expDesc: { color: colors.text, fontSize: 16, fontWeight: '600' },
  expAmt: { color: colors.text, fontSize: 16, fontWeight: '800' },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  smartLine: {
    color: colors.positive,
    fontSize: font.small,
    fontWeight: '600',
    marginBottom: 12,
    lineHeight: 18,
  },
  actRow: {
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
  actRowEditing: { borderColor: colors.accentBorder, backgroundColor: colors.bgElevated },
  actTitle: { color: colors.text, fontSize: font.body + 1, fontWeight: '700' },
  actSub: { color: colors.muted, fontSize: font.small, marginTop: 2 },
  actAmt: { color: colors.text, fontSize: font.h3, fontWeight: '800' },
  settleIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.positiveSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settleIconText: { color: colors.positive, fontSize: 18, fontWeight: '800' },
  empty: { alignItems: 'center', paddingVertical: 28 },
  emptyEmoji: { fontSize: 36, marginBottom: 8 },
  fieldLabel: {
    color: colors.muted,
    fontSize: font.small,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 2,
  },
  fieldLabelSm: { color: colors.muted, fontSize: font.small, fontWeight: '600' },
  splitHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  link: { color: colors.accent, fontSize: font.small, fontWeight: '700' },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  splitName: { flex: 1, color: colors.text, fontSize: font.body, fontWeight: '600' },
  splitInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardAlt,
    borderRadius: radius.sm + 2,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    minWidth: 96,
  },
  affix: { color: colors.muted, fontSize: font.body, fontWeight: '600' },
  splitInput: {
    flex: 1,
    color: colors.text,
    fontSize: font.body,
    fontWeight: '600',
    paddingVertical: 8,
    paddingHorizontal: 4,
    textAlign: 'right',
  },
  splitFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
