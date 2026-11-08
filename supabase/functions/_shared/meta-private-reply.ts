type Result = { status: 'confirmed' | 'rejected' | 'unknown' };

/** Unified Login Private Replies. Unknown outcomes must never be retried automatically. */
export async function sendMetaPrivateReply(options: {
  apiVersion: string; accountId: string; commentId: string; token: string; message: string;
  request?: typeof fetch;
}): Promise<Result> {
  const { apiVersion, accountId, commentId, token, message } = options;
  if (!/^v\d+\.\d+$/.test(apiVersion) || !/^\d+$/.test(accountId) || !/^\d+$/.test(commentId) || !token || !message.trim()) throw new Error('Configuração da Meta inválida');
  try {
    const response = await (options.request || fetch)(`https://graph.facebook.com/${apiVersion}/${accountId}/messages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ recipient: { comment_id: commentId }, message: { text: message } }),
    });
    // 5xx and malformed success are uncertain: Meta may have accepted the send.
    if (response.status >= 500 || response.status === 429) return { status: 'unknown' };
    if (!response.ok) return { status: 'rejected' };
    const data = await response.json() as { recipient_id?: unknown; message_id?: unknown };
    return typeof data.recipient_id === 'string' && typeof data.message_id === 'string' && !!data.recipient_id && !!data.message_id ? { status: 'confirmed' } : { status: 'unknown' };
  } catch { return { status: 'unknown' }; }
}

/** Conservative precheck for posts and reels; Live requires separate validation. */
export function metaCommentWithinWindow(createdAt: string, mediaType: string, now = Date.now()) {
  if (!['POST', 'REEL'].includes(mediaType)) return false;
  const created = Date.parse(createdAt);
  return Number.isFinite(created) && created <= now && now - created < 7 * 24 * 60 * 60 * 1000;
}
