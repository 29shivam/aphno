import { useMemo, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GroupMember } from '@aphno/shared';
import { api, ApiError, rupees, toPaise } from '../api/client';
import { useAuth } from '../state/auth';
import { Button, Card, ErrorText, Input } from '../ui';
import { colors } from '../theme';

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

  const group = useQuery({ queryKey: ['group', groupId], queryFn: () => api.getGroup(groupId) });
  const balances = useQuery({
    queryKey: ['balances', groupId],
    queryFn: () => api.balances(groupId),
  });
  const expenses = useQuery({
    queryKey: ['expenses', groupId],
    queryFn: () => api.listExpenses(groupId),
  });

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const mem of group.data?.members ?? []) m.set(mem.userId, mem.name ?? mem.phone);
    return m;
  }, [group.data]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['balances', groupId] });
    qc.invalidateQueries({ queryKey: ['expenses', groupId] });
    qc.invalidateQueries({ queryKey: ['group', groupId] });
  };

  const addExpense = useMutation({
    mutationFn: () =>
      api.addExpense(groupId, {
        description: desc.trim(),
        amount: toPaise(amount),
        splitType: 'EQUAL',
      }),
    onSuccess: () => {
      setDesc('');
      setAmount('');
      setAddErr('');
      refresh();
    },
    onError: (e) => setAddErr(e instanceof ApiError ? e.message : 'Could not add expense'),
  });

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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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

      {/* Settle up */}
      {myDebts.length > 0 ? (
        <>
          <Text style={styles.section}>Settle up</Text>
          <Card style={{ marginBottom: 16 }}>
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

      {/* Add expense */}
      <Text style={styles.section}>Add an expense</Text>
      <Card style={{ marginBottom: 16 }}>
        <Input value={desc} onChangeText={setDesc} placeholder="What was it for?" />
        <View style={{ height: 10 }} />
        <Input
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="Amount in ₹ (e.g. 1200)"
        />
        <Text style={styles.hint}>
          Split equally between all {group.data?.members.length ?? 0} members.
        </Text>
        <ErrorText>{addErr}</ErrorText>
        <View style={{ height: 12 }} />
        <Button
          label="Add expense"
          onPress={() => addExpense.mutate()}
          loading={addExpense.isPending}
          disabled={!desc.trim() || !amount.trim()}
        />
      </Card>

      {/* Expenses list */}
      <Text style={styles.section}>Expenses</Text>
      {expenses.isLoading ? (
        <Text style={styles.muted}>Loading…</Text>
      ) : expenses.data && expenses.data.length > 0 ? (
        expenses.data.map((e) => (
          <Card key={e.id} style={styles.expCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.expDesc}>{e.description}</Text>
              <Text style={styles.muted}>
                {nameById.get(e.paidById) ?? 'Someone'} paid · split {e.splitType.toLowerCase()}
              </Text>
            </View>
            <Text style={styles.expAmt}>{rupees(e.amount)}</Text>
          </Card>
        ))
      ) : (
        <Text style={styles.muted}>No expenses yet.</Text>
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
});
