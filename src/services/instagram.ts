import { requireSupabase } from '../supabase.js';
const base = import.meta.env.VITE_INSTAGRAM_SUPABASE_URL;
const key = import.meta.env.VITE_INSTAGRAM_SUPABASE_PUBLISHABLE_KEY;
export async function instagramRequest<T>(action: string, data: Record<string, unknown> = {}, endpoint = 'instagram-admin'): Promise<T> {
  if (!base || !key) throw new Error('O projeto do Instagram ainda não foi configurado.');
  const url = new URL(base);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Endereço do projeto Instagram inválido.');
  const { data: session, error } = await requireSupabase().auth.getSession();
  if (error || !session.session?.access_token) throw new Error('Sessão expirada. Entre novamente.');
  const response = await fetch(`${url.origin}/functions/v1/${endpoint}`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${session.session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action, data }) });
  if (!response.ok) throw new Error('Não foi possível acessar o módulo Instagram.');
  return response.json() as Promise<T>;
}
