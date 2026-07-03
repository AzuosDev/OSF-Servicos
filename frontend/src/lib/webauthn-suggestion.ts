export const WEBAUTHN_DISMISSED_KEY = "contacerta_webauthn_dismissed_at";
export const WEBAUTHN_TRIED_KEY = "contacerta_webauthn_suggest";
export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export type SuggestionCheckResult =
  | { shouldCheck: false }
  | { shouldCheck: true; isForm1: boolean };

/** Pure: decides whether to fetch credentials and show the suggestion. */
export function resolveSuggestionCheck(params: {
  browserSupports: boolean;
  triedFlag: string | null;
  dismissedAt: string | null;
  now?: number;
}): SuggestionCheckResult {
  const { browserSupports, triedFlag, dismissedAt, now = Date.now() } = params;

  if (!browserSupports) return { shouldCheck: false };

  // Forma 1 has priority and bypasses the cooldown
  if (triedFlag === "tried") return { shouldCheck: true, isForm1: true };

  if (dismissedAt !== null) {
    const elapsed = now - Number(dismissedAt);
    if (elapsed < SEVEN_DAYS_MS) return { shouldCheck: false };
  }

  return { shouldCheck: true, isForm1: false };
}

/** Pure: given credential count, decides whether to show the modal. */
export function resolveShowModal(
  checkResult: SuggestionCheckResult,
  credentialCount: number,
): boolean {
  return checkResult.shouldCheck && credentialCount === 0;
}
