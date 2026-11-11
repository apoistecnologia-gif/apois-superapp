-- APOIS Corridas / QA195, additive. Preview ONLY for an offered ride.
-- No generic RLS changes, no changes to payment/Entregas and no public photo bucket.
BEGIN;
CREATE FUNCTION public.apois_driver_offer_passenger(p_ride_id uuid)
RETURNS TABLE(name text, avatar_url text, average_rating numeric, total_ratings integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $fn$
 SELECT NULLIF(split_part(btrim(u.name),' ',1),'') AS name,
   u.avatar_url,u.average_rating,u.total_ratings
 FROM public.rides r JOIN public.users u ON u.id=r.passenger_id
 WHERE r.id=p_ride_id AND p_ride_id IS NOT NULL
   AND (SELECT auth.uid()) IS NOT NULL
   AND r.status='procurar_motorista'
   AND r.driver_id IS NULL AND r.accepted_driver_id IS NULL
   AND (SELECT public.mobility_user_id()) = ANY(COALESCE(r.offered_driver_ids,'{}'::uuid[]))
   AND NOT ((SELECT public.mobility_user_id()) = ANY(COALESCE(r.rejected_driver_ids,'{}'::uuid[])))
   AND (r.request_expires_at IS NULL OR r.request_expires_at>now())
   AND u.deleted_at IS NULL
 LIMIT 1
$fn$;
REVOKE ALL ON FUNCTION public.apois_driver_offer_passenger(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apois_driver_offer_passenger(uuid) TO authenticated;
COMMENT ON FUNCTION public.apois_driver_offer_passenger(uuid) IS
 'Apenas primeiro nome, foto e avaliacao para motorista que recebeu oferta valida.';
-- Bucket stays private. Only the exact, current avatar for assigned/offered ride.
CREATE FUNCTION public.apois_driver_may_view_passenger_avatar(p_object_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $fn$
 SELECT (SELECT auth.uid()) IS NOT NULL
  AND p_object_name IS NOT NULL AND length(p_object_name) BETWEEN 1 AND 512
  AND EXISTS (
   SELECT 1 FROM public.users u
   JOIN public.rides r ON r.passenger_id=u.id
   JOIN public.drivers d ON d.user_id=(SELECT public.mobility_user_id())
   WHERE u.avatar_url=p_object_name
     AND split_part(p_object_name,'/',1)=u.auth_user_id::text
     AND u.deleted_at IS NULL
     AND (
      (r.status IN ('motorista_a_caminho','motorista_chegou','em_viagem')
       AND d.id=COALESCE(r.accepted_driver_id,r.driver_id))
      OR
      (r.status='procurar_motorista' AND r.driver_id IS NULL
       AND r.accepted_driver_id IS NULL
       AND d.user_id=ANY(COALESCE(r.offered_driver_ids,'{}'::uuid[]))
       AND NOT (d.user_id=ANY(COALESCE(r.rejected_driver_ids,'{}'::uuid[])))
       AND (r.request_expires_at IS NULL OR r.request_expires_at>now()))
     )
   LIMIT 1
  )
$fn$;
REVOKE ALL ON FUNCTION public.apois_driver_may_view_passenger_avatar(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apois_driver_may_view_passenger_avatar(text) TO authenticated;
CREATE POLICY apois_driver_assigned_or_offered_passenger_avatar_qa195
 ON storage.objects FOR SELECT TO authenticated
 USING (bucket_id = 'profile-photos' AND public.apois_driver_may_view_passenger_avatar(name));
COMMENT ON FUNCTION public.apois_driver_may_view_passenger_avatar(text) IS
 'Autoriza somente foto exata do passageiro associado a oferta ou corrida do motorista, sem listagem publica.';
COMMIT;
