export function parseConfiguredGithubUserId(value: string | undefined): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && String(parsed) === value ? parsed : null;
}

export function isConfiguredGithubAdministrator(
  profileId: unknown,
  configuredUserId: string | undefined,
): boolean {
  const configured = parseConfiguredGithubUserId(configuredUserId);
  return (
    configured !== null &&
    (typeof profileId === "string" || typeof profileId === "number") &&
    String(profileId) === String(configured)
  );
}
