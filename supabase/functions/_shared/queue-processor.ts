import { processInstagramComment } from './comment-processor.ts';

type Comment = { id: string; text: string; mediaId: string; authorId: string };
type Event = { digest: string; tentativa_id: string; payload: unknown };
type Decision = { eligible: boolean; reason?: string; message?: string; publicReply?: string };
type SendResult = { status: 'confirmed' | 'rejected' | 'unknown' };
type Adapters = {
  claim: () => Promise<Event | null>;
  finish: (event: Event, state: 'concluido' | 'falha') => Promise<boolean>;
  parse: (payload: unknown) => Comment[];
  ownAccountId: string;
  reserve: (comment: Comment) => Promise<boolean>;
  record: (comment: Comment, state: string, detail?: string) => Promise<void>;
  decide: (comment: Comment) => Promise<Decision>;
  sendPrivate: (comment: Comment, message: string) => Promise<SendResult>;
  sendPublic: (comment: Comment, message: string) => Promise<SendResult>;
};

/** Process one leased batch; adapters are responsible for Meta payload validation. */
export async function processInstagramQueueItem(adapters: Adapters): Promise<'empty' | 'processed' | 'failed' | 'lease_lost'> {
  const event = await adapters.claim();
  if (!event) return 'empty';
  try {
    for (const comment of adapters.parse(event.payload)) {
      await processInstagramComment(comment, {
        ownAccountId: adapters.ownAccountId,
        store: { reserve: () => adapters.reserve(comment), record: (_id, state, detail) => adapters.record(comment, state, detail) },
        decide: adapters.decide, sendPrivate: adapters.sendPrivate, sendPublic: adapters.sendPublic,
      });
    }
    return await adapters.finish(event, 'concluido') ? 'processed' : 'lease_lost';
  } catch {
    return await adapters.finish(event, 'falha') ? 'failed' : 'lease_lost';
  }
}
