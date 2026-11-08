/** Verify the existing user's session and active profile against the main project. */
export async function authorizeMainUser(options: { url: string; publishableKey: string; authorization: string; request?: typeof fetch }): Promise<boolean> {
  const base = new URL(options.url);
  if (base.protocol !== 'https:' || base.username || base.password || !options.publishableKey) throw new Error('Autenticação principal não configurada');
  if (!/^Bearer\s+\S+$/i.test(options.authorization)) return false;
  const request = options.request || fetch;
  const headers = { apikey: options.publishableKey, Authorization: options.authorization };
  const userResponse = await request(`${base.origin}/auth/v1/user`, { headers });
  if (userResponse.status === 401 || userResponse.status === 403) return false;
  if (!userResponse.ok) throw new Error('Autenticação principal indisponível');
  const user = await userResponse.json() as { id?: unknown };
  if (typeof user.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id)) return false;
  const profileResponse = await request(`${base.origin}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=ativo`, { headers });
  if (profileResponse.status === 401 || profileResponse.status === 403) return false;
  if (!profileResponse.ok) throw new Error('Perfil principal indisponível');
  const profiles = await profileResponse.json() as unknown;
  return Array.isArray(profiles) && profiles.length === 1 && profiles[0]?.ativo === true;
}
