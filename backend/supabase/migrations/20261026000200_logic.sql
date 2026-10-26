-- T1.2 — Lista pública (sem contribuidores) e reserva atômica.

-- Status calculado: item fica "escolhido" com uma contribuição levar/pix. Vales nunca fecham.
create view public.public_products
with (security_invoker = true) as
select
  p.id,
  p.slug,
  p.kind,
  p.room,
  p.name,
  p.spec,
  p.price_cents,
  p.purchase_url,
  p.image_path,
  p.sort_order,
  case
    when p.kind = 'item' and exists (
      select 1 from public.contributions c
      where c.product_id = p.id and c.mode in ('levar', 'pix')
    ) then 'escolhido'
    else 'livre'
  end as status
from public.products p;

revoke all on public.public_products from anon, authenticated;

-- Reserva: trava o produto e valida as regras do design numa única transação.
-- Erros usam SQLSTATE PTxxx, que o PostgREST converte no status HTTP correspondente.
create function public.create_contribution(
  p_slug         text,
  p_guest_name   text,
  p_mode         text,
  p_amount_cents integer default null
)
returns public.contributions
language plpgsql
set search_path = ''
as $$
declare
  parte_min_cents constant integer := 60000; -- itens a partir de R$ 600 aceitam "parte"
  v_product public.products;
  v_amount  integer;
  v_row     public.contributions;
begin
  select * into v_product from public.products where slug = p_slug for update;
  if not found then
    raise exception 'product_not_found' using errcode = 'PT404';
  end if;

  if p_mode is null or p_mode not in ('levar', 'pix', 'parte') then
    raise exception 'invalid_mode' using errcode = 'PT400';
  end if;

  if v_product.kind = 'cota' then
    -- vale: só Pix, repetível; preço 0 = valor livre
    if p_mode <> 'pix' then
      raise exception 'cota_only_pix' using errcode = 'PT400';
    end if;
    v_amount := case when v_product.price_cents > 0 then v_product.price_cents else p_amount_cents end;
  else
    if exists (
      select 1 from public.contributions
      where product_id = v_product.id and mode in ('levar', 'pix')
    ) then
      raise exception 'already_chosen' using errcode = 'PT409';
    end if;

    if p_mode = 'parte' then
      if v_product.price_cents < parte_min_cents then
        raise exception 'parte_not_allowed' using errcode = 'PT400';
      end if;
      v_amount := p_amount_cents;
    else
      v_amount := v_product.price_cents;
    end if;
  end if;

  if p_mode <> 'levar' and (v_amount is null or v_amount <= 0) then
    raise exception 'invalid_amount' using errcode = 'PT400';
  end if;

  insert into public.contributions (product_id, guest_name, mode, amount_cents)
  values (v_product.id, btrim(p_guest_name), p_mode, coalesce(v_amount, 0))
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.create_contribution(text, text, text, integer) from public, anon, authenticated;
grant execute on function public.create_contribution(text, text, text, integer) to service_role;
