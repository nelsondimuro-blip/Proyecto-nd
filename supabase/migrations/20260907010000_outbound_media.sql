-- ===========================================================================
-- Envio de adjuntos desde el panel
--
-- El navegador sube el archivo directamente al bucket privado, bajo
-- <org_id>/outbox/<conversation_id>/<archivo>, y despues pide al gateway que
-- lo mande. Asi el archivo no atraviesa las funciones serverless de Next.
-- ===========================================================================

create policy "miembros suben adjuntos salientes"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'whatsapp-media'
    and (storage.foldername(name))[2] = 'outbox'
    and public.is_org_member(nullif((storage.foldername(name))[1], '')::uuid)
  );
