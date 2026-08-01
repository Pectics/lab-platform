import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { parseConfiguredGithubUserId } from "@/lib/auth/administrator";
import { databaseConnection } from "@/infrastructure/database/singleton";
import { administrators } from "@/infrastructure/database/schema";

export async function getAdministratorSession() {
  const session = await auth();
  const githubUserId = parseConfiguredGithubUserId(process.env.GITHUB_ADMIN_USER_ID);

  if (!session?.user.id || githubUserId === null) {
    return null;
  }

  const [administrator] = await databaseConnection.db
    .select({ id: administrators.id })
    .from(administrators)
    .where(
      and(
        eq(administrators.authUserId, session.user.id),
        eq(administrators.githubUserId, githubUserId),
      ),
    )
    .limit(1);

  return administrator ? { session, administratorId: administrator.id } : null;
}
