import { DomainInvariantError } from "./errors";
import type { ExpiringLifecycleState, LifecycleState } from "./types";

export function isActive(resource: LifecycleState): boolean {
  return resource.enabled && resource.archivedAt === null;
}

export function isSubscriptionTokenActive(
  token: ExpiringLifecycleState,
  now: Date,
): boolean {
  return isActive(token) && (token.expiresAt === null || token.expiresAt.getTime() > now.getTime());
}

export function assertCanCreateAssociation(
  resources: ReadonlyArray<{ kind: string; state: LifecycleState }>,
): void {
  const unavailable = resources.find(({ state }) => !isActive(state));

  if (unavailable) {
    throw new DomainInvariantError(
      "association_target_inactive",
      `Cannot associate inactive or archived ${unavailable.kind}`,
    );
  }
}

export function archiveResource<T extends LifecycleState>(resource: T, archivedAt: Date): T {
  if (resource.archivedAt !== null) {
    return resource;
  }

  return {
    ...resource,
    enabled: false,
    archivedAt,
  };
}
