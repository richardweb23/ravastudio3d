type Comment = { id: string; text: string; mediaId: string; authorId: string };
type Decision = { eligible: boolean; reason?: string; message?: string; publicReply?: string };
type SendResult = { status: 'confirmed' | 'rejected' | 'unknown'; detail?: string };
type Store = {
  // Must be atomic and permanent for a comment ID. No external call precedes it.
  reserve: (id: string) => Promise<boolean>;
  record: (id: string, status: string, detail?: string) => Promise<void>;
};
type Dependencies = {
  ownAccountId: string;
  store: Store;
  decide: (comment: Comment) => Promise<Decision>;
  sendPrivate: (comment: Comment, message: string) => Promise<SendResult>;
  sendPublic: (comment: Comment, message: string) => Promise<SendResult>;
};

/** Core orchestration only. API eligibility and atomic persistence are supplied by adapters. */
export async function processInstagramComment(comment: Comment, deps: Dependencies): Promise<string> {
  if (!comment.id || !comment.mediaId || !comment.authorId || !deps.ownAccountId) return 'invalid';
  if (comment.authorId === deps.ownAccountId) return 'own_comment';
  if (!await deps.store.reserve(comment.id)) return 'duplicate';
  let decision: Decision;
  try { decision = await deps.decide(comment); }
  catch { await deps.store.record(comment.id, 'falha', 'Falha ao avaliar comentário'); return 'failed'; }
  if (!decision.eligible || !decision.message) {
    await deps.store.record(comment.id, 'ignorado', decision.reason || 'Comentário não elegível');
    return 'ignored';
  }
  // Persist before calling the provider. A crash after this point is uncertain
  // and must never automatically invoke another private reply.
  await deps.store.record(comment.id, 'envio_privado_iniciado');
  let privateResult: SendResult;
  try { privateResult = await deps.sendPrivate(comment, decision.message); }
  catch { privateResult = { status: 'unknown' }; }
  if (privateResult.status !== 'confirmed') {
    await deps.store.record(comment.id, privateResult.status === 'unknown' ? 'envio_privado_incerto' : 'envio_privado_recusado');
    return privateResult.status;
  }
  await deps.store.record(comment.id, 'envio_privado_confirmado');
  if (!decision.publicReply) return 'confirmed';
  await deps.store.record(comment.id, 'resposta_publica_iniciada');
  let publicResult: SendResult;
  try { publicResult = await deps.sendPublic(comment, decision.publicReply); }
  catch { publicResult = { status: 'unknown' }; }
  await deps.store.record(comment.id, publicResult.status === 'confirmed' ? 'enviado' : publicResult.status === 'unknown' ? 'resposta_publica_incerta' : 'resposta_publica_recusada');
  return publicResult.status;
}
