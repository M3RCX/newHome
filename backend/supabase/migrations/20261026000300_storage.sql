-- T0.2 — Bucket público das fotos dos produtos.
-- Leitura pública pela URL; upload/remoção só pela API (service_role ignora RLS).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('products', 'products', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
