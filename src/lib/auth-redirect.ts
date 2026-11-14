/** Absolute URL for Supabase email redirects (confirm / recovery). */
export function authCallbackUrl() {
  return new URL(
    'auth/callback',
    `${window.location.origin}${import.meta.env.BASE_URL}`,
  ).href
}
