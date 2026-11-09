-- Apply only to the isolated Instagram project after explicit authorization.
-- Reserve only an event containing the exact approved comment. Other queued
-- events are left untouched. The worker also checks the parsed batch.
create function public.instagram_reservar_evento_teste(p_comentario_id text)
returns setof public.instagram_eventos_brutos
language sql security definer set search_path = '' as $$
 update public.instagram_eventos_brutos e
 set estado='processando', bloqueado_ate=now()+interval '5 minutes',
     tentativa_id=gen_random_uuid(), tentativas=e.tentativas+1
 where e.digest=(select q.digest from public.instagram_eventos_brutos q
   where p_comentario_id ~ '^[0-9]+$'
     and (q.estado='pendente' or (q.estado='processando' and q.bloqueado_ate < now()))
     and jsonb_path_exists(q.payload,
       '$.entry[*].changes[*] ? (@.field == "comments" && (@.value.id == $id || @.value.comment_id == $id))',
       jsonb_build_object('id', p_comentario_id))
   order by q.recebido_em, q.digest for update skip locked limit 1)
 returning e.*;
$$;
revoke all on function public.instagram_reservar_evento_teste(text) from public, anon, authenticated;
grant execute on function public.instagram_reservar_evento_teste(text) to service_role;
