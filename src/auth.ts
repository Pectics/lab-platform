import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { isConfiguredGithubAdministrator, parseConfiguredGithubUserId } from "@/lib/auth/administrator";
import { databaseConnection } from "@/infrastructure/database/singleton";
import {
  administrators,
  authAccounts,
  authSessions,
  authUsers,
  authVerificationTokens,
} from "@/infrastructure/database/schema";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(databaseConnection.db, {
    usersTable: authUsers,
    accountsTable: authAccounts,
    sessionsTable: authSessions,
    verificationTokensTable: authVerificationTokens,
  }),
  session: { strategy: "database" },
  secret: process.env.AUTH_SECRET,
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID ?? "configuration-required",
      clientSecret: process.env.AUTH_GITHUB_SECRET ?? "configuration-required",
    }),
  ],
  callbacks: {
    signIn({ profile }) {
      return isConfiguredGithubAdministrator(profile?.id, process.env.GITHUB_ADMIN_USER_ID);
    },
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
  events: {
    async signIn({ user, profile }) {
      const githubUserId = parseConfiguredGithubUserId(String(profile?.id ?? ""));
      if (githubUserId === null || !user.id) {
        return;
      }
      const userId = user.id;

      await databaseConnection.db.transaction(async (transaction) => {
        await transaction
          .update(authUsers)
          .set({ githubUserId })
          .where(eq(authUsers.id, userId));
        await transaction
          .insert(administrators)
          .values({
            authUserId: userId,
            githubUserId,
            githubLogin: typeof profile?.login === "string" ? profile.login : null,
            displayName: user.name,
            avatarUrl: user.image,
            lastLoginAt: new Date(),
          })
          .onConflictDoUpdate({
            target: administrators.githubUserId,
            set: {
              authUserId: userId,
              githubLogin: typeof profile?.login === "string" ? profile.login : null,
              displayName: user.name,
              avatarUrl: user.image,
              lastLoginAt: new Date(),
              updatedAt: new Date(),
            },
          });
      });
    },
  },
});
