-- Weekender rental workflow. Run after supabase-schema.sql. Existing rows are preserved.
begin;
create table if not exists public.rental_requests (
  id uuid primary key default gen_random_uuid(), listing_id uuid references public.listings(id) on delete set null,
  tool_name text not null, owner_name text, renter_name text not null, renter_contact text not null,
  requested_dates text not null, message text, status text not null default 'pending', created_at timestamptz not null default now()
);
alter table public.listings add column if not exists owner_id uuid references auth.users(id);
alter table public.listings add column if not exists daily_rate numeric(10,2);
alter table public.listings add column if not exists weekend_rate numeric(10,2);
alter table public.listings add column if not exists photo_url text;
alter table public.listings add column if not exists updated_at timestamptz not null default now();
alter table public.rental_requests add column if not exists owner_id uuid references auth.users(id);
alter table public.rental_requests add column if not exists renter_id uuid references auth.users(id);
alter table public.rental_requests add column if not exists start_date date;
alter table public.rental_requests add column if not exists end_date date;
alter table public.rental_requests add column if not exists total_price numeric(10,2);
alter table public.rental_requests add column if not exists rate_label text;
alter table public.rental_requests add column if not exists payment_status text not null default 'not_paid';
alter table public.rental_requests add column if not exists status_reason text;
alter table public.rental_requests add column if not exists updated_at timestamptz not null default now();
create table if not exists public.profiles (
  id uuid primary key references auth.users(id),
  display_name text not null check (char_length(display_name) between 1 and 80),
  contact text not null check (char_length(contact) between 3 and 200)
);
create table if not exists public.tool_requests (
  id uuid primary key default gen_random_uuid(), author_id uuid not null references auth.users(id), author_name text not null,
  tool_name text not null check (char_length(tool_name) between 1 and 120), needed_date date not null,
  neighborhood text not null check (char_length(neighborhood) between 1 and 100),
  budget numeric(10,2) check (budget >= 0 and budget <= 10000), notes text check (char_length(notes) <= 2000),
  status text not null default 'open' check (status in ('open', 'closed')), created_at timestamptz not null default now()
);
alter table public.listings enable row level security;
alter table public.rental_requests enable row level security;
alter table public.profiles enable row level security;
alter table public.tool_requests enable row level security;
-- Replace the old guest-wide write and rental-contact read policies.
drop policy if exists "Anyone can read available listings" on public.listings;
drop policy if exists "Guests can create listings" on public.listings;
drop policy if exists "Anyone can read rental requests" on public.rental_requests;
drop policy if exists "Guests can create rental requests" on public.rental_requests;
drop policy if exists "Browse available or own listings" on public.listings;
create policy "Browse available or own listings" on public.listings for select using (status='available' or owner_id=(select auth.uid()));
drop policy if exists "Participants read rentals" on public.rental_requests;
create policy "Participants read rentals" on public.rental_requests for select to authenticated using (owner_id=(select auth.uid()) or renter_id=(select auth.uid()));
drop policy if exists "Own profile" on public.profiles;
create policy "Own profile" on public.profiles for all to authenticated using (id=(select auth.uid())) with check (id=(select auth.uid()));
drop policy if exists "Read tool requests" on public.tool_requests;
create policy "Read tool requests" on public.tool_requests for select using (status='open' or author_id=(select auth.uid()));
revoke all on public.listings,public.rental_requests,public.profiles,public.tool_requests from anon,authenticated;
grant select (id,tool_name,category,neighborhood,daily_price,weekend_price,deposit,description,owner_name,status,created_at,owner_id,daily_rate,weekend_rate,photo_url,updated_at) on public.listings to anon,authenticated;
grant select on public.rental_requests to authenticated;
grant select,insert,update on public.profiles to authenticated;
grant select on public.tool_requests to anon,authenticated;
create index if not exists listings_owner_idx on public.listings(owner_id);
create index if not exists rentals_owner_idx on public.rental_requests(owner_id,created_at desc);
create index if not exists rentals_renter_idx on public.rental_requests(renter_id,created_at desc);
create index if not exists rentals_booking_idx on public.rental_requests(listing_id,start_date,end_date) where status in ('approved','confirmed','active');

create or replace function public.save_listing(p_id uuid,p_name text,p_category text,p_neighborhood text,p_daily numeric,p_weekend numeric,p_description text,p_photo text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare person public.profiles; item public.listings;
begin
  select * into person from public.profiles where id=auth.uid();
  if person.id is null then raise exception 'Add your guest name and contact first.'; end if;
  if p_id is null or coalesce(length(trim(p_name)),0) not between 1 and 120
    or coalesce(length(trim(p_neighborhood)),0) not between 1 and 100 or coalesce(length(trim(p_description)),0) not between 1 and 2000
    or p_category is null or p_category not in ('Power tools','Ladders','Lawn & garden','Painting & drywall','Moving & hauling','Specialty','Auto')
    or p_daily is null or p_daily<=0 or p_daily>10000 or p_daily<>round(p_daily,2)
    or (p_weekend is not null and (p_weekend<=0 or p_weekend>30000 or p_weekend<>round(p_weekend,2)))
    then raise exception 'Check the tool name, location, description, and prices.'; end if;
  if p_photo is not null and p_photo not like 'https://gduefgyrvlreemgbwqwz.supabase.co/storage/v1/object/public/tool-photos/' || auth.uid()::text || '/%'
    then raise exception 'Choose a photo uploaded by your guest account.'; end if;
  select * into item from public.listings where id=p_id for update;
  if found and item.owner_id is distinct from auth.uid() then raise exception 'Only the owner can edit this tool.'; end if;
  insert into public.listings(id,tool_name,category,neighborhood,daily_price,weekend_price,daily_rate,weekend_rate,description,owner_id,owner_name,owner_contact,photo_url)
  values(p_id,trim(p_name),p_category,trim(p_neighborhood),'$' || p_daily || '/day',case when p_weekend is null then null else '$' || p_weekend || '/weekend' end,p_daily,p_weekend,trim(p_description),person.id,person.display_name,person.contact,p_photo)
  on conflict(id) do update set tool_name=excluded.tool_name,category=excluded.category,neighborhood=excluded.neighborhood,daily_price=excluded.daily_price,weekend_price=excluded.weekend_price,daily_rate=excluded.daily_rate,weekend_rate=excluded.weekend_rate,description=excluded.description,owner_name=excluded.owner_name,owner_contact=excluded.owner_contact,photo_url=excluded.photo_url,updated_at=now() where public.listings.owner_id=auth.uid();
  if not found then raise exception 'Only the owner can edit this tool.'; end if;
  return p_id;
end $$;

create or replace function public.set_listing_status(p_id uuid,p_status text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_status not in ('available','paused') or p_status is null then raise exception 'Invalid listing status.'; end if;
  update public.listings set status=p_status,updated_at=now() where id=p_id and owner_id=auth.uid();
  if not found then raise exception 'Only the owner can change this listing.'; end if;
end $$;

create or replace function public.request_rental(p_id uuid,p_listing uuid,p_start date,p_end date,p_message text default '')
returns uuid language plpgsql security definer set search_path='' as $$
declare item public.listings; person public.profiles; days integer; total numeric; label text; existing public.rental_requests;
begin
  select * into person from public.profiles where id=auth.uid();
  if person.id is null then raise exception 'Add your guest name and contact first.'; end if;
  select * into item from public.listings where id=p_listing for update;
  if item.id is null or item.owner_id is null or item.daily_rate is null or item.status<>'available' then raise exception 'This tool is not accepting rental requests.'; end if;
  if item.owner_id=auth.uid() then raise exception 'You cannot rent your own tool.'; end if;
  if p_id is null or p_start is null or p_end is null or p_start<(now() at time zone 'America/Detroit')::date or p_end<p_start or p_end-p_start>=30
    then raise exception 'Choose a rental of 1 to 30 days, starting today or later.'; end if;
  if length(coalesce(p_message,''))>2000 then raise exception 'Keep your note under 2000 characters.'; end if;
  select * into existing from public.rental_requests where id=p_id;
  if found then
    if existing.renter_id=auth.uid() and existing.listing_id=p_listing and existing.start_date=p_start and existing.end_date=p_end then return existing.id; end if;
    raise exception 'This request identifier has already been used.';
  end if;
  if exists(select 1 from public.rental_requests where listing_id=p_listing and status in ('approved','confirmed','active') and start_date<=p_end and end_date>=p_start)
    then raise exception 'Those dates are already booked. Choose other dates.'; end if;
  select * into existing from public.rental_requests where listing_id=p_listing and renter_id=auth.uid() and start_date=p_start and end_date=p_end and status='pending';
  if found then return existing.id; end if;
  days:=p_end-p_start+1; total:=item.daily_rate*days; label:=days || ' day(s) at $' || item.daily_rate || '/day';
  if days=3 and extract(isodow from p_start)=5 and item.weekend_rate is not null and item.weekend_rate<total then total:=item.weekend_rate; label:='Friday-Sunday rate'; end if;
  insert into public.rental_requests(id,listing_id,tool_name,owner_id,owner_name,renter_id,renter_name,renter_contact,requested_dates,start_date,end_date,total_price,rate_label,message)
  values(p_id,item.id,item.tool_name,item.owner_id,item.owner_name,person.id,person.display_name,person.contact,p_start || ' to ' || p_end,p_start,p_end,total,label,trim(coalesce(p_message,'')));
  return p_id;
end $$;

-- Lock the listing before the request in every operation to serialize approvals.
create or replace function public.rental_action(p_id uuid,p_action text)
returns text language plpgsql security definer set search_path='' as $$
declare rental public.rental_requests; listing uuid; next_status text; is_owner boolean; is_renter boolean;
begin
  select listing_id into listing from public.rental_requests where id=p_id and (owner_id=auth.uid() or renter_id=auth.uid());
  if listing is null then raise exception 'This rental is not available to your guest account.'; end if;
  perform 1 from public.listings where id=listing for update;
  select * into rental from public.rental_requests where id=p_id for update;
  is_owner:=rental.owner_id=auth.uid(); is_renter:=rental.renter_id=auth.uid();
  if p_action='approve' and is_owner and rental.status='pending' then
    if rental.start_date<(now() at time zone 'America/Detroit')::date then raise exception 'The pickup date has passed. Ask the renter to choose new dates.'; end if;
    if exists(select 1 from public.rental_requests where listing_id=listing and id<>p_id and status in ('approved','confirmed','active') and start_date<=rental.end_date and end_date>=rental.start_date)
      then raise exception 'Another booking already covers these dates.'; end if;
    next_status:='approved';
    update public.rental_requests set status='declined',status_reason='Another rental was approved for these dates.',updated_at=now()
    where listing_id=listing and id<>p_id and status='pending' and start_date<=rental.end_date and end_date>=rental.start_date;
  elsif p_action='decline' and is_owner and rental.status='pending' then next_status:='declined';
  elsif p_action='confirm' and is_renter and rental.status='approved' then next_status:='confirmed';
  elsif p_action='pickup' and is_owner and rental.status='confirmed' then next_status:='active';
  elsif p_action='complete' and is_owner and rental.status='active' then next_status:='completed';
  elsif p_action='cancel' and (is_owner or is_renter) and rental.status in ('pending','approved','confirmed') then next_status:='cancelled';
  else raise exception 'This action is no longer available. Refresh your rentals.';
  end if;
  update public.rental_requests set status=next_status,updated_at=now(),
    payment_status=case when next_status='confirmed' then 'simulated' when next_status='cancelled' and payment_status='simulated' then 'simulated_refund' else payment_status end,
    status_reason=case when next_status='cancelled' then case when is_owner then 'Cancelled by owner.' else 'Cancelled by renter.' end else status_reason end where id=p_id;
  return next_status;
end $$;

create or replace function public.get_my_activity()
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'listings',coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at desc) from public.listings l where l.owner_id=auth.uid()),'[]'::jsonb),
    'rentals',coalesce((select jsonb_agg(to_jsonb(r) || jsonb_build_object('owner_contact',l.owner_contact,'neighborhood',l.neighborhood,'photo_url',l.photo_url) order by r.created_at desc) from public.rental_requests r join public.listings l on l.id=r.listing_id where r.owner_id=auth.uid() or r.renter_id=auth.uid()),'[]'::jsonb)
  );
$$;
create or replace function public.listing_bookings(p_listing uuid)
returns table(start_date date,end_date date) language sql stable security definer set search_path='' as $$
  select r.start_date,r.end_date from public.rental_requests r join public.listings l on l.id=r.listing_id
  where r.listing_id=p_listing and l.status='available' and r.status in ('approved','confirmed','active') and r.end_date>=(now() at time zone 'America/Detroit')::date order by r.start_date;
$$;
create or replace function public.post_tool_request(p_id uuid,p_tool text,p_date date,p_neighborhood text,p_budget numeric,p_notes text)
returns uuid language plpgsql security definer set search_path='' as $$
declare person public.profiles;
begin
  select * into person from public.profiles where id=auth.uid();
  if person.id is null then raise exception 'Add your guest name and contact first.'; end if;
  if p_id is null or p_date is null or p_date<(now() at time zone 'America/Detroit')::date then raise exception 'Choose today or a future date.'; end if;
  if coalesce(length(trim(p_tool)),0) not between 1 and 120 or coalesce(length(trim(p_neighborhood)),0) not between 1 and 100 then raise exception 'Add the tool name and neighborhood.'; end if;
  if exists(select 1 from public.tool_requests where id=p_id and author_id<>auth.uid()) then raise exception 'This request identifier has already been used.'; end if;
  insert into public.tool_requests(id,author_id,author_name,tool_name,needed_date,neighborhood,budget,notes)
  values(p_id,person.id,person.display_name,trim(p_tool),p_date,trim(p_neighborhood),p_budget,trim(coalesce(p_notes,''))) on conflict(id) do nothing;
  return p_id;
end $$;
create or replace function public.close_tool_request(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  update public.tool_requests set status='closed' where id=p_id and author_id=auth.uid();
  if not found then raise exception 'Only the author can close this request.'; end if;
end $$;
revoke all on function public.save_listing(uuid,text,text,text,numeric,numeric,text,text),public.set_listing_status(uuid,text),public.request_rental(uuid,uuid,date,date,text),public.rental_action(uuid,text),public.get_my_activity(),public.listing_bookings(uuid),public.post_tool_request(uuid,text,date,text,numeric,text),public.close_tool_request(uuid) from public,anon,authenticated;
grant execute on function public.save_listing(uuid,text,text,text,numeric,numeric,text,text),public.set_listing_status(uuid,text),public.request_rental(uuid,uuid,date,date,text),public.rental_action(uuid,text),public.get_my_activity(),public.post_tool_request(uuid,text,date,text,numeric,text),public.close_tool_request(uuid) to authenticated;
grant execute on function public.listing_bookings(uuid) to anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('tool-photos','tool-photos',true,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
drop policy if exists "Guests upload own tool photos" on storage.objects;
create policy "Guests upload own tool photos" on storage.objects for insert to authenticated with check (bucket_id='tool-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "Guests remove own tool photos" on storage.objects;
create policy "Guests remove own tool photos" on storage.objects for delete to authenticated using (bucket_id='tool-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "Guests read own tool photo objects" on storage.objects;
create policy "Guests read own tool photo objects" on storage.objects for select to authenticated using (bucket_id='tool-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
notify pgrst,'reload schema';
commit;
