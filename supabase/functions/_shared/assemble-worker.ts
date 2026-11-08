import { createInstagramDatabaseAdapter } from './database-adapter.ts';
import { decideInstagramReply } from './instagram-rules.ts';
import { metaCommentWithinWindow, sendMetaPrivateReply } from './meta-private-reply.ts';
import { processInstagramQueueItem } from './queue-processor.ts';
import { replyToMetaComment, verifyMetaComment } from './meta-comments.ts';
import { parseMetaCommentEvents } from './meta-events.ts';
import { readMainCatalog } from './main-catalog.ts';

type Comment = { id: string; text: string; mediaId: string; authorId: string };
type Verification = { createdAt: string; mediaType: string; belongsToAccount: boolean };
type Result = { status: 'confirmed' | 'rejected' | 'unknown' };
type Settings = { ativa: boolean; palavras_chave: string[]; resposta_publica: string; mensagem_produto: string; mensagem_alternativa: string; catalogo_url: string; whatsapp_url: string; sem_produto: 'ignorar' | 'catalogo' };

/** Composition point; Meta payload, timestamps and public replies require verified adapters. */
export async function runInstagramWorker(options: {
  supabaseUrl: string; serviceKey: string; token: string; accountId: string; apiVersion: string;
  mainCatalogUrl?: string; mainCatalogKey?: string;
  testCommentId?: string;
  parse?: (payload: unknown) => Comment[];
  verifyComment?: (comment: Comment) => Promise<Verification>;
  sendPublic?: (comment: Comment, message: string) => Promise<Result>;
  request?: typeof fetch;
}) {
  if (options.testCommentId !== undefined && !/^\d+$/.test(options.testCommentId)) throw new Error('ID de teste inválido');
  const db = createInstagramDatabaseAdapter(options.supabaseUrl, options.serviceKey, options.request, options.testCommentId);
  return processInstagramQueueItem({
    ...db, ownAccountId: options.accountId, parse: payload => {
      const comments = (options.parse || (value => parseMetaCommentEvents(value, options.accountId)))(payload);
      if (options.testCommentId && (comments.length !== 1 || comments[0].id !== options.testCommentId)) throw new Error('Evento de teste não corresponde ao comentário autorizado');
      return comments;
    },
    async decide(comment) {
      const context = await db.context(comment.mediaId);
      const settings = context.configuracao as unknown as Settings;
      if (!settings.ativa || !context.monitorada) return { eligible: false, reason: 'Automação desativada' };
      const verified = await (options.verifyComment || (item => verifyMetaComment({ apiVersion: options.apiVersion, token: options.token, request: options.request }, item)))(comment);
      const products = options.mainCatalogUrl && options.mainCatalogKey
        ? await readMainCatalog({ url: options.mainCatalogUrl, publishableKey: options.mainCatalogKey, ids: await db.productIds(comment.mediaId), request: options.request })
        : await db.products(comment.mediaId);
      return decideInstagramReply({
        comment: comment.text, automationEnabled: settings.ativa, postEnabled: context.monitorada,
        metaEligible: verified.belongsToAccount && metaCommentWithinWindow(verified.createdAt, verified.mediaType),
        keywords: settings.palavras_chave, products: products.map(product => ({ ...product, disponivel: true })),
        missingProduct: settings.sem_produto, productTemplate: settings.mensagem_produto, fallbackTemplate: settings.mensagem_alternativa,
        publicReply: settings.resposta_publica, catalogUrl: settings.catalogo_url, whatsappUrl: settings.whatsapp_url, maxLength: 1000,
      });
    },
    sendPrivate: (comment, message) => sendMetaPrivateReply({ apiVersion: options.apiVersion, accountId: options.accountId, commentId: comment.id, token: options.token, message, request: options.request }),
    sendPublic: options.sendPublic || ((comment, message) => replyToMetaComment({ apiVersion: options.apiVersion, token: options.token, request: options.request }, comment, message)),
  });
}
