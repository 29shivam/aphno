import { z } from 'zod';

// ─────────────────────────────────────────────────────────────
// Primitives
// ─────────────────────────────────────────────────────────────

// E.164-ish phone: optional +, 10–15 digits.
export const PhoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{10,15}$/, 'invalid phone number');

// Money is always integer paise (₹1 = 100). Never floats over the wire.
export const PaiseSchema = z.number().int().positive();

export const uuid = z.string().uuid();

// ─────────────────────────────────────────────────────────────
// Health
// ─────────────────────────────────────────────────────────────

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  uptime: z.number(),
  dbConnected: z.boolean(),
  userCount: z.number(),
  timestamp: z.string(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

// ─────────────────────────────────────────────────────────────
// Error envelope
// ─────────────────────────────────────────────────────────────

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

// ─────────────────────────────────────────────────────────────
// User
// ─────────────────────────────────────────────────────────────

export const UserSchema = z.object({
  id: uuid,
  phone: z.string(),
  name: z.string().nullable(),
  upiId: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  createdAt: z.string(),
});
export type User = z.infer<typeof UserSchema>;

export const UpdateProfileSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  upiId: z
    .string()
    .trim()
    .regex(/^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/, 'invalid UPI id')
    .optional(),
  avatarUrl: z.string().url().optional(),
});
export type UpdateProfile = z.infer<typeof UpdateProfileSchema>;

// ─────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────

export const OtpRequestSchema = z.object({ phone: PhoneSchema });
export type OtpRequest = z.infer<typeof OtpRequestSchema>;

export const OtpRequestResponseSchema = z.object({
  requestId: uuid,
  expiresInSec: z.number(),
  // Present only outside production so the client/dev can auto-fill.
  devCode: z.string().optional(),
});
export type OtpRequestResponse = z.infer<typeof OtpRequestResponseSchema>;

export const OtpVerifySchema = z.object({
  phone: PhoneSchema,
  code: z.string().regex(/^[0-9]{6}$/, 'code must be 6 digits'),
});
export type OtpVerify = z.infer<typeof OtpVerifySchema>;

export const AuthTokenResponseSchema = z.object({
  token: z.string(),
  user: UserSchema,
});
export type AuthTokenResponse = z.infer<typeof AuthTokenResponseSchema>;

// ─────────────────────────────────────────────────────────────
// Groups
// ─────────────────────────────────────────────────────────────

export const GroupRoleSchema = z.enum(['OWNER', 'MEMBER']);

export const GroupMemberSchema = z.object({
  userId: uuid,
  name: z.string().nullable(),
  phone: z.string(),
  upiId: z.string().nullable(),
  role: GroupRoleSchema,
});
export type GroupMember = z.infer<typeof GroupMemberSchema>;

export const GroupSchema = z.object({
  id: uuid,
  name: z.string(),
  createdById: uuid,
  createdAt: z.string(),
  memberCount: z.number(),
});
export type Group = z.infer<typeof GroupSchema>;

export const GroupDetailSchema = GroupSchema.extend({
  members: z.array(GroupMemberSchema),
});
export type GroupDetail = z.infer<typeof GroupDetailSchema>;

export const CreateGroupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  // Phones of people to seed into the group; unknown numbers become stub users.
  memberPhones: z.array(PhoneSchema).max(50).optional(),
});
export type CreateGroup = z.infer<typeof CreateGroupSchema>;

export const AddMemberSchema = z.object({
  phone: PhoneSchema,
  name: z.string().trim().min(1).max(80).optional(),
});
export type AddMember = z.infer<typeof AddMemberSchema>;

// ─────────────────────────────────────────────────────────────
// Expenses
// ─────────────────────────────────────────────────────────────

export const SplitTypeSchema = z.enum(['EQUAL', 'EXACT', 'PERCENT']);
export type SplitType = z.infer<typeof SplitTypeSchema>;

// For EXACT: value is paise owed. For PERCENT: value is a percentage (0–100).
// Omitted entirely for EQUAL splits.
export const SplitInputSchema = z.object({
  userId: uuid,
  value: z.number().nonnegative(),
});
export type SplitInput = z.infer<typeof SplitInputSchema>;

export const CreateExpenseSchema = z
  .object({
    description: z.string().trim().min(1).max(140),
    amount: PaiseSchema,
    paidById: uuid.optional(), // defaults to the authed user
    splitType: SplitTypeSchema.default('EQUAL'),
    // For EQUAL, list of member userIds to split between (defaults to all members).
    participants: z.array(uuid).min(1).optional(),
    // Required for EXACT / PERCENT.
    splits: z.array(SplitInputSchema).min(1).optional(),
  })
  .refine((v) => v.splitType === 'EQUAL' || (v.splits && v.splits.length > 0), {
    message: 'splits are required for EXACT and PERCENT split types',
    path: ['splits'],
  });
export type CreateExpense = z.infer<typeof CreateExpenseSchema>;

export const ExpenseSplitSchema = z.object({
  userId: uuid,
  amount: z.number().int(), // owed share in paise
});

export const ExpenseSchema = z.object({
  id: uuid,
  groupId: uuid,
  description: z.string(),
  amount: z.number().int(),
  currency: z.string(),
  splitType: SplitTypeSchema,
  paidById: uuid,
  createdById: uuid,
  createdAt: z.string(),
  splits: z.array(ExpenseSplitSchema),
});
export type Expense = z.infer<typeof ExpenseSchema>;

// ─────────────────────────────────────────────────────────────
// Balances & settlements
// ─────────────────────────────────────────────────────────────

// Net position of one member in a group. Positive = is owed money.
export const BalanceSchema = z.object({
  userId: uuid,
  name: z.string().nullable(),
  net: z.number().int(),
});
export type Balance = z.infer<typeof BalanceSchema>;

// A suggested transfer to settle the group with minimal payments.
export const DebtSchema = z.object({
  fromUserId: uuid,
  toUserId: uuid,
  amount: z.number().int().positive(),
});
export type Debt = z.infer<typeof DebtSchema>;

export const GroupBalancesSchema = z.object({
  balances: z.array(BalanceSchema),
  debts: z.array(DebtSchema),
});
export type GroupBalances = z.infer<typeof GroupBalancesSchema>;

export const SettlementStatusSchema = z.enum(['PENDING', 'COMPLETED', 'CANCELLED']);

export const CreateSettlementSchema = z.object({
  toUserId: uuid,
  amount: PaiseSchema,
  note: z.string().trim().max(140).optional(),
});
export type CreateSettlement = z.infer<typeof CreateSettlementSchema>;

export const CompleteSettlementSchema = z.object({
  upiTxnRef: z.string().trim().min(1).max(64).optional(),
});
export type CompleteSettlement = z.infer<typeof CompleteSettlementSchema>;

export const SettlementSchema = z.object({
  id: uuid,
  groupId: uuid,
  fromUserId: uuid,
  toUserId: uuid,
  amount: z.number().int(),
  status: SettlementStatusSchema,
  method: z.string(),
  upiTxnRef: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: z.string(),
  settledAt: z.string().nullable(),
  // Deep link the payer can open to pay via any UPI app.
  upiIntentUrl: z.string().nullable(),
});
export type Settlement = z.infer<typeof SettlementSchema>;
