import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { Me } from '@takhti/contracts';
import { branches, orgs, profiles } from '@takhti/db';
import type { Ctx } from '../../kernel/context';
import { notFound } from '../../kernel/errors';
import { enabledModules } from '../../kernel/modules';

/** Who is signed in and what they may do: the one response every portal shell is built from. */
export async function getMe(ctx: Ctx): Promise<Me> {
  const { actor } = ctx;
  const [profile] = await ctx.db
    .select()
    .from(profiles)
    .where(eq(profiles.id, actor.userId))
    .limit(1);
  const [org] = await ctx.db.select().from(orgs).where(eq(orgs.id, actor.orgId)).limit(1);
  if (!profile || !org) throw notFound('Account');

  const staffWithSomeBranches = actor.kind === 'staff' && !actor.allBranches;
  const visible =
    staffWithSomeBranches && actor.branchIds.length === 0
      ? []
      : await ctx.db
          .select({
            id: branches.id,
            code: branches.code,
            name: branches.name,
            nameUr: branches.nameUr,
            status: branches.status,
          })
          .from(branches)
          .where(
            and(
              isNull(branches.deletedAt),
              staffWithSomeBranches ? inArray(branches.id, [...actor.branchIds]) : undefined,
              // A family sees the campuses that are open, by name, and nothing else about them.
              actor.kind === 'staff' ? undefined : eq(branches.status, 'active'),
            ),
          )
          .orderBy(asc(branches.name));

  return Me.parse({
    user: {
      id: profile.id,
      fullName: profile.fullName,
      email: profile.email,
      phone: profile.phone,
      avatarFileId: profile.avatarFileId,
      locale: actor.locale,
    },
    membership: {
      id: actor.membershipId,
      kind: actor.kind,
      roleKeys: [...actor.roleKeys].sort(),
      allBranches: actor.allBranches,
      staffId: actor.staffId ?? null,
      guardianId: actor.guardianId ?? null,
      studentIds: [...actor.studentIds],
    },
    org: {
      id: org.id,
      name: org.name,
      nameUr: org.nameUr,
      slug: org.slug,
      logoFileId: org.logoFileId,
      defaultLocale: org.defaultLocale,
    },
    branches: visible,
    permissions: [...actor.permissions].sort(),
    modules: [...(await enabledModules(ctx))].sort(),
  });
}
