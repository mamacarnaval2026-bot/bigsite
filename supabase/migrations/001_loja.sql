-- Cole no SQL Editor do Supabase. Execute somente uma vez por projeto.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'customer' check (role in ('customer','admin')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, full_name, role)
  values(new.id, coalesce(new.raw_user_meta_data->>'full_name',''), 'customer')
  on conflict(id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_shop_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin');
$$;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 120),
  subtitle text not null default '',
  description text not null default '',
  price_cents integer not null check(price_cents >= 100),
  compare_at_cents integer check(compare_at_cents is null or compare_at_cents>=100),
  category text not null default 'Portáteis',
  area text not null default '',
  image_url text,
  features text[] not null default '{}',
  stock integer not null default 0 check(stock>=0),
  active boolean not null default true,
  featured boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.shop_settings (
  id integer primary key default 1 check(id=1),
  shipping_flat_cents integer check(shipping_flat_cents is null or shipping_flat_cents>=0)
);
insert into public.shop_settings(id, shipping_flat_cents) values(1, null)
on conflict(id) do nothing;

create table if not exists public.orders (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 status text not null default 'created' check(status in ('created','pending','processed','failed','cancelled','refunded')),
 total_cents integer not null check(total_cents>=100),
 shipping_cents integer not null default 0 check(shipping_cents>=0),
 items jsonb not null,
 address jsonb not null,
 mp_order_id text unique,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists orders_user_created_idx on public.orders(user_id,created_at desc);

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.shop_settings enable row level security;
alter table public.orders enable row level security;

create policy "Meu perfil e perfis admin" on public.profiles for select to authenticated
using ((select auth.uid())=id or (select public.is_shop_admin()));
create policy "Catálogo ativo ou admin" on public.products for select to anon, authenticated
using (active=true or (select public.is_shop_admin()));
create policy "Admin insere produtos" on public.products for insert to authenticated
with check ((select public.is_shop_admin()));
create policy "Admin edita produtos" on public.products for update to authenticated
using ((select public.is_shop_admin())) with check ((select public.is_shop_admin()));
create policy "Frete visível publicamente" on public.shop_settings for select to anon,authenticated using(true);
create policy "Admin altera frete" on public.shop_settings for update to authenticated
using ((select public.is_shop_admin())) with check ((select public.is_shop_admin()));
create policy "Cliente vê os próprios pedidos ou admin vê todos" on public.orders for select to authenticated
using ((select auth.uid())=user_id or (select public.is_shop_admin()));

-- Atualiza estado do pedido e deduz estoque uma única vez, em transação.
-- Só a service_role pode executar (funções HTTP fazem consulta verificada ao Mercado Pago).
create or replace function public.set_payment_status(p_order_id uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_previous text; v_items jsonb; v_item jsonb;
begin
  if p_status not in ('created','pending','processed','failed','cancelled','refunded') then
    raise exception 'Invalid status';
  end if;
  select status,items into v_previous,v_items from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_previous='processed' and p_status not in ('processed','refunded') then return; end if;
  if v_previous='refunded' then return; end if;
  if v_previous<> 'processed' and p_status='processed' then
    for v_item in select value from jsonb_array_elements(v_items) loop
      update public.products set stock=greatest(stock-(v_item->>'quantity')::int,0)
      where id=(v_item->>'id')::uuid;
    end loop;
  end if;
  update public.orders set status=p_status,updated_at=now() where id=p_order_id;
end;$$;
revoke all on function public.set_payment_status(uuid,text) from public,anon,authenticated;
grant execute on function public.set_payment_status(uuid,text) to service_role;

-- Passos posteriores: 
-- 1) Definir valor fixo do frete (exemplo NÃO executável automaticamente):
-- update public.shop_settings set shipping_flat_cents=VALOR_EM_CENTAVOS where id=1;
-- 2) Após cadastrar SUA conta, marcar como admin pelo UID visto em Authentication > Users:
-- update public.profiles set role='admin' where id='UUID_REAL_DA_SUA_CONTA';
-- 3) Ajustar uma política de frete realmente compatível com a área atendida.
