type Comment = { id: string; text: string; mediaId: string; authorId: string };
type ObjectValue = Record<string, unknown>;
function object(value: unknown): ObjectValue | null { return value && typeof value === 'object' && !Array.isArray(value) ? value as ObjectValue : null; }

/** Unified Login comment webhook. Reject malformed batches instead of silently losing events. */
export function parseMetaCommentEvents(payload: unknown, accountId: string): Comment[] {
  const roots = Array.isArray(payload) ? payload : [payload];
  const result: Comment[] = [];
  if (!/^\d+$/.test(accountId) || !roots.length) throw new Error('Configuração ou evento inválido');
  for (const rootValue of roots) {
    const root = object(rootValue);
    if (root?.object !== 'instagram' || !Array.isArray(root.entry)) throw new Error('Evento inválido');
    for (const entryValue of root.entry) {
      const entry = object(entryValue);
      if (!entry || entry.id !== accountId || !Array.isArray(entry.changes)) throw new Error('Conta ou evento inválido');
      for (const changeValue of entry.changes) {
        const change = object(changeValue);
        if (!change || typeof change.field !== 'string') throw new Error('Alteração inválida');
        if (change.field !== 'comments') continue;
        const value = object(change.value), from = object(value?.from), media = object(value?.media);
        const id = value?.comment_id ?? value?.id;
        if (value?.comment_id != null && value?.id != null && value.comment_id !== value.id) throw new Error('IDs de comentário conflitantes');
        if (typeof id !== 'string' || !/^\d+$/.test(id) || typeof from?.id !== 'string' || !/^\d+$/.test(from.id) || typeof media?.id !== 'string' || !/^\d+$/.test(media.id) || (value?.text !== undefined && typeof value.text !== 'string')) throw new Error('Comentário inválido');
        result.push({ id, mediaId: media.id, authorId: from.id, text: typeof value?.text === 'string' ? value.text : '' });
      }
    }
  }
  return result;
}
