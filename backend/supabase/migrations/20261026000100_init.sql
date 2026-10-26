-- T1.1 — Schema: produtos e contribuições (quem presenteou).
-- Acesso só pela API (service_role). RLS ligado e sem policies: anon/authenticated não leem nada.

create table public.products (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  kind         text not null check (kind in ('item', 'cota')),
  room         text not null,
  name         text not null check (length(btrim(name)) > 0),
  spec         text not null default '',
  price_cents  integer not null default 0 check (price_cents >= 0), -- 0 = valor livre
  purchase_url text,
  image_path   text,                                               -- caminho no bucket "products"
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index products_sort_order_idx on public.products (sort_order);

create table public.contributions (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,
  guest_name   text not null check (length(btrim(guest_name)) between 1 and 80),
  mode         text not null check (mode in ('levar', 'pix', 'parte')),
  amount_cents integer not null check (amount_cents >= 0),
  created_at   timestamptz not null default now()
);

create index contributions_product_id_idx on public.contributions (product_id);

-- updated_at automático
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- Segurança: só a service_role (API) acessa.
alter table public.products enable row level security;
alter table public.contributions enable row level security;

revoke all on public.products, public.contributions from anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
