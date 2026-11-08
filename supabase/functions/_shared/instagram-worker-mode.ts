/** Unknown and missing modes fail closed, even when the send gate is enabled. */
export function instagramWorkerMode(mode: string | undefined, commentId: string | undefined) {
  if (mode === 'continuous') return { ready: true, testCommentId: undefined };
  if (mode === 'test' && commentId && /^\d+$/.test(commentId)) return { ready: true, testCommentId: commentId };
  return { ready: false, testCommentId: undefined };
}
