/** Verify the X-Hub-Signature-256 header against the exact request bytes. */
export async function verifyMetaSignature(body: Uint8Array, header: string | null, appSecret: string): Promise<boolean> {
  if (!appSecret || !header || !/^sha256=[0-9a-f]{64}$/i.test(header)) return false;
  const signature = new Uint8Array(header.slice(7).match(/.{2}/g)!.map(value => Number.parseInt(value, 16)));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(appSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', key, signature, Uint8Array.from(body));
}
