-- ===========================================================================
-- Notas de voz (PTT)
--
-- WhatsApp distingue una nota de voz de un audio adjunto: se manda como PTT
-- (push to talk) en ogg/opus y se reproduce distinto. Guardamos la marca para
-- poder mostrarla igual en la bandeja.
-- ===========================================================================

alter table public.messages
  add column is_voice boolean not null default false;
