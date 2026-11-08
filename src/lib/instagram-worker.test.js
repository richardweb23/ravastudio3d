import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInstagramWorker } from '../../supabase/functions/_shared/assemble-worker.ts';

test('teste controlado reserva apenas o comentário autorizado e recusa lote misto', async () => {
  const calls = [];
  const request = async (url, init) => {
    const name = url.split('/').at(-1); calls.push(name);
    if (name === 'instagram_reservar_evento_teste') {
      assert.equal(JSON.parse(init.body).p_comentario_id, '456');
      return Response.json([{ digest: 'a', tentativa_id: 'b', payload: {} }]);
    }
    if (name === 'instagram_concluir_evento') {
      assert.equal(JSON.parse(init.body).p_estado, 'falha');
      return Response.json(true);
    }
    throw Error(`Chamada indevida: ${name}`);
  };
  const result = await runInstagramWorker({ supabaseUrl: 'https://test.supabase.co', serviceKey: 'test', token: 'test', accountId: '123', apiVersion: 'v27.0', request, testCommentId: '456',
    parse: () => [{ id: '456', mediaId: '789', authorId: '100', text: 'preço' }, { id: '457', mediaId: '789', authorId: '101', text: 'preço' }] });
  assert.equal(result, 'failed');
  assert.deepEqual(calls, ['instagram_reservar_evento_teste', 'instagram_concluir_evento']);
});

test('worker usa configuração persistida e respeita desligamento global', async () => {
  const calls = [];
  const request = async (url, init) => {
    const name = url.split('/').at(-1); calls.push(name);
    if (name === 'instagram_reservar_evento') return Response.json([{ digest: 'a', tentativa_id: 'b', payload: {} }]);
    if (name === 'instagram_contexto') return Response.json({ configuracao: { ativa: false }, monitorada: true });
    if (name === 'instagram_registrar_estado') { assert.equal(JSON.parse(init.body).p_estado, 'ignorado'); return new Response(null, { status: 204 }); }
    return Response.json(true);
  };
  const result = await runInstagramWorker({ supabaseUrl: 'https://test.supabase.co', serviceKey: 'test', token: 'test', accountId: '123', apiVersion: 'v25.0', request,
    parse: () => [{ id: '456', mediaId: '789', authorId: '100', text: 'preço' }],
    verifyComment: async () => { throw Error('não deve consultar Meta'); }, sendPublic: async () => { throw Error('não deve enviar'); } });
  assert.equal(result, 'processed'); assert.equal(calls.includes('messages'), false);
});

test('worker prepara uma resposta privada com dados atuais e só depois confirma em público', async () => {
  const calls = [];
  const request = async (url, init) => {
    const name = url.split('/').at(-1); calls.push(name);
    if (name === 'instagram_reservar_evento') return Response.json([{ digest: 'a', tentativa_id: 'b', payload: {} }]);
    if (name === 'instagram_contexto') return Response.json({ configuracao: { ativa: true, palavras_chave: ['preço'], resposta_publica: 'Enviado!', mensagem_produto: '{produtos}', mensagem_alternativa: '{catalogo} {whatsapp}', catalogo_url: 'https://example.com', whatsapp_url: 'https://wa.me/5511999999999', sem_produto: 'ignorar' }, monitorada: true });
    if (name === 'instagram_produtos_publicos') return Response.json([{ nome: 'Peça', slug: 'peca', preco_centavos: 5000, promocional_centavos: 4000 }]);
    if (name === 'instagram_registrar_estado') { calls.push(JSON.parse(init.body).p_estado); return new Response(null, { status: 204 }); }
    if (name === 'messages') { assert.match(JSON.parse(init.body).message.text, /40,00/); return Response.json({ recipient_id: '1', message_id: '2' }); }
    return Response.json(true);
  };
  const result = await runInstagramWorker({ supabaseUrl: 'https://test.supabase.co', serviceKey: 'test', token: 'test', accountId: '123', apiVersion: 'v25.0', request,
    parse: () => [{ id: '456', mediaId: '789', authorId: '100', text: 'preço' }],
    verifyComment: async () => ({ createdAt: new Date().toISOString(), mediaType: 'POST', belongsToAccount: true }),
    sendPublic: async () => { calls.push('publica'); return { status: 'confirmed' }; } });
  assert.equal(result, 'processed');
  assert.ok(calls.indexOf('envio_privado_iniciado') < calls.indexOf('messages'));
  assert.ok(calls.indexOf('envio_privado_confirmado') < calls.indexOf('publica'));
  assert.ok(calls.includes('enviado'));
});

test('worker registra resultado privado incerto sem publicar confirmação', async () => {
  const states = []; let publicCalls = 0;
  const request = async (url, init) => {
    const name = url.split('/').at(-1);
    if (name === 'instagram_reservar_evento') return Response.json([{ digest: 'a', tentativa_id: 'b', payload: {} }]);
    if (name === 'instagram_contexto') return Response.json({ configuracao: { ativa: true, palavras_chave: ['valor'], resposta_publica: 'Enviado!', mensagem_produto: '{produtos}', mensagem_alternativa: '{catalogo} {whatsapp}', catalogo_url: 'https://example.com', whatsapp_url: 'https://wa.me/5511999999999', sem_produto: 'ignorar' }, monitorada: true });
    if (name === 'instagram_produtos_publicos') return Response.json([{ nome: 'Peça', slug: 'peca', preco_centavos: 5000, promocional_centavos: null }]);
    if (name === 'instagram_registrar_estado') { states.push(JSON.parse(init.body).p_estado); return new Response(null, { status: 204 }); }
    if (name === 'messages') throw Error('timeout');
    return Response.json(true);
  };
  assert.equal(await runInstagramWorker({ supabaseUrl: 'https://test.supabase.co', serviceKey: 'test', token: 'test', accountId: '123', apiVersion: 'v25.0', request,
    parse: () => [{ id: '456', mediaId: '789', authorId: '100', text: 'valor?' }],
    verifyComment: async () => ({ createdAt: new Date().toISOString(), mediaType: 'REEL', belongsToAccount: true }),
    sendPublic: async () => { publicCalls++; return { status: 'confirmed' }; } }), 'processed');
  assert.deepEqual(states, ['envio_privado_iniciado', 'envio_privado_incerto']); assert.equal(publicCalls, 0);
});

test('worker separado busca vínculos no Instagram e preços no catálogo principal', async () => {
  const calls = [];
  const id = '10000000-0000-4000-8000-000000000001';
  const request = async (url, init) => {
    const target = new URL(url), name = target.pathname.split('/').at(-1); calls.push([target.hostname, name]);
    if (name === 'instagram_reservar_evento') return Response.json([{ digest: 'a', tentativa_id: 'b', payload: {} }]);
    if (name === 'instagram_contexto') return Response.json({ configuracao: { ativa: true, palavras_chave: ['preço'], resposta_publica: 'Enviado!', mensagem_produto: '{produtos}', mensagem_alternativa: '{catalogo} {whatsapp}', catalogo_url: 'https://example.com', whatsapp_url: 'https://wa.me/5511999999999', sem_produto: 'ignorar' }, monitorada: true });
    if (name === 'instagram_vinculos') return Response.json([{ material_id: id }]);
    if (name === 'catalogo_publico') return Response.json({ total: 1, produtos: [{ id, nome: 'Peça', slug: 'peca', preco_centavos: 3500, promocional_centavos: null }] });
    if (name === 'instagram_registrar_estado') return new Response(null, { status: 204 });
    if (name === 'messages') { assert.match(JSON.parse(init.body).message.text, /35,00/); return Response.json({ recipient_id: '1', message_id: '2' }); }
    return Response.json(true);
  };
  assert.equal(await runInstagramWorker({ supabaseUrl: 'https://instagram.supabase.co', serviceKey: 'test', mainCatalogUrl: 'https://principal.supabase.co', mainCatalogKey: 'publica', token: 'test', accountId: '123', apiVersion: 'v25.0', request,
    parse: () => [{ id: '456', mediaId: '789', authorId: '100', text: 'preço' }],
    verifyComment: async () => ({ createdAt: new Date().toISOString(), mediaType: 'POST', belongsToAccount: true }),
    sendPublic: async () => ({ status: 'confirmed' }) }), 'processed');
  assert.ok(calls.some(([host, name]) => host === 'instagram.supabase.co' && name === 'instagram_vinculos'));
  assert.ok(calls.some(([host, name]) => host === 'principal.supabase.co' && name === 'catalogo_publico'));
});
