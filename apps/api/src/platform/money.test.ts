import { describe, expect, it } from 'vitest';
import type { Balance } from '@aphno/shared';
import { simplifyDebts, splitEqual, splitExact, splitPercent } from './money.js';

const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);

describe('splitEqual', () => {
  it('splits evenly when divisible', () => {
    const out = splitEqual(30000, ['a', 'b', 'c']);
    expect([...out.values()]).toEqual([10000, 10000, 10000]);
  });

  it('distributes the remainder paise deterministically and conserves the total', () => {
    const out = splitEqual(10000, ['a', 'b', 'c']); // ₹100 / 3
    expect(out.get('a')).toBe(3334);
    expect(out.get('b')).toBe(3333);
    expect(out.get('c')).toBe(3333);
    expect(sum(out)).toBe(10000);
  });

  it('throws with no participants', () => {
    expect(() => splitEqual(100, [])).toThrow();
  });
});

describe('splitExact', () => {
  it('accepts shares that sum to the total', () => {
    const out = splitExact(10000, [
      { userId: 'a', value: 6000 },
      { userId: 'b', value: 4000 },
    ]);
    expect(sum(out)).toBe(10000);
  });

  it('rejects shares that do not sum to the total', () => {
    expect(() =>
      splitExact(10000, [
        { userId: 'a', value: 6000 },
        { userId: 'b', value: 3000 },
      ]),
    ).toThrow();
  });
});

describe('splitPercent', () => {
  it('allocates by percentage and absorbs rounding on the last member', () => {
    const out = splitPercent(10000, [
      { userId: 'a', value: 33.33 },
      { userId: 'b', value: 33.33 },
      { userId: 'c', value: 33.34 },
    ]);
    expect(sum(out)).toBe(10000);
  });

  it('rejects percentages that do not sum to 100', () => {
    expect(() =>
      splitPercent(10000, [
        { userId: 'a', value: 50 },
        { userId: 'b', value: 40 },
      ]),
    ).toThrow();
  });
});

describe('simplifyDebts', () => {
  it('nets a simple two-person debt', () => {
    const balances: Balance[] = [
      { userId: 'a', name: 'A', net: -5000 },
      { userId: 'b', name: 'B', net: 5000 },
    ];
    const debts = simplifyDebts(balances);
    expect(debts).toEqual([{ fromUserId: 'a', toUserId: 'b', amount: 5000 }]);
  });

  it('produces transfers that clear every balance', () => {
    const balances: Balance[] = [
      { userId: 'a', name: 'A', net: -7000 },
      { userId: 'b', name: 'B', net: -3000 },
      { userId: 'c', name: 'C', net: 4000 },
      { userId: 'd', name: 'D', net: 6000 },
    ];
    const debts = simplifyDebts(balances);
    const applied = new Map(balances.map((b) => [b.userId, b.net]));
    for (const d of debts) {
      applied.set(d.fromUserId, (applied.get(d.fromUserId) ?? 0) + d.amount);
      applied.set(d.toUserId, (applied.get(d.toUserId) ?? 0) - d.amount);
    }
    for (const v of applied.values()) expect(v).toBe(0);
  });

  it('returns nothing when everyone is settled', () => {
    expect(simplifyDebts([{ userId: 'a', name: 'A', net: 0 }])).toEqual([]);
  });
});
