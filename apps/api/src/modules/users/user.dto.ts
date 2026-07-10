import type { User as PrismaUser } from '@aphno/db';
import type { User } from '@aphno/shared';

export function toUserDto(u: PrismaUser): User {
  return {
    id: u.id,
    phone: u.phone,
    email: u.email,
    name: u.name,
    upiId: u.upiId,
    avatarUrl: u.avatarUrl,
    createdAt: u.createdAt.toISOString(),
  };
}
