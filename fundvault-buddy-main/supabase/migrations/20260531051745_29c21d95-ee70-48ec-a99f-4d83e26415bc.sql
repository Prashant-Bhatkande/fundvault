
-- =========== ENUMS ===========
create type public.app_role as enum ('super_admin', 'admin', 'member');
create type public.loan_request_status as enum ('pending', 'approved', 'rejected', 'disbursed');
create type public.loan_status as enum ('active', 'closed', 'defaulted');
create type public.interest_status as enum ('due', 'paid', 'overdue');

-- =========== PROFILES ===========
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text not null unique,
  joined_at timestamptz not null default now(),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- =========== USER ROLES ===========
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_admin(_user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role in ('admin', 'super_admin'))
$$;

-- =========== SETTINGS (singleton row) ===========
create table public.settings (
  id int primary key default 1,
  weekly_contribution numeric(12,2) not null default 50,
  contribution_day smallint not null default 0, -- 0=Sunday
  missed_contribution_penalty numeric(12,2) not null default 10,
  interest_rate_monthly numeric(5,4) not null default 0.05, -- 5%
  late_interest_penalty_rate numeric(5,4) not null default 0.10, -- ₹10 per ₹100 unpaid
  reserve_fund numeric(12,2) not null default 0,
  max_loan_duration_months int not null default 12,
  currency text not null default 'INR',
  currency_symbol text not null default '₹',
  updated_at timestamptz not null default now(),
  constraint settings_singleton check (id = 1)
);
insert into public.settings (id) values (1);
grant select on public.settings to authenticated;
grant all on public.settings to service_role;
alter table public.settings enable row level security;

-- =========== CONTRIBUTIONS ===========
create table public.contributions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null,
  week_of date not null, -- the Sunday this covers
  paid_on date not null default current_date,
  recorded_by uuid references auth.users(id),
  note text,
  created_at timestamptz not null default now(),
  unique (member_id, week_of)
);
create index on public.contributions(member_id);
create index on public.contributions(week_of);
grant select, insert, update on public.contributions to authenticated;
grant all on public.contributions to service_role;
alter table public.contributions enable row level security;

-- =========== MISSED CONTRIBUTIONS (penalties) ===========
create table public.missed_contributions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  week_of date not null,
  penalty numeric(12,2) not null,
  resolved boolean not null default false,
  resolved_on date,
  created_at timestamptz not null default now(),
  unique (member_id, week_of)
);
create index on public.missed_contributions(member_id);
grant select, insert, update on public.missed_contributions to authenticated;
grant all on public.missed_contributions to service_role;
alter table public.missed_contributions enable row level security;

-- =========== LOAN REQUESTS ===========
create table public.loan_requests (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null,
  required_date date not null,
  purpose text not null,
  status loan_request_status not null default 'pending',
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now()
);
create index on public.loan_requests(member_id);
create index on public.loan_requests(status);
grant select, insert, update on public.loan_requests to authenticated;
grant all on public.loan_requests to service_role;
alter table public.loan_requests enable row level security;

-- =========== LOANS ===========
create table public.loans (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.loan_requests(id),
  member_id uuid not null references public.profiles(id) on delete cascade,
  principal numeric(12,2) not null,
  interest_rate_monthly numeric(5,4) not null,
  issued_on date not null default current_date,
  due_on date not null,
  status loan_status not null default 'active',
  closed_on date,
  created_at timestamptz not null default now()
);
create index on public.loans(member_id);
create index on public.loans(status);
grant select, insert, update on public.loans to authenticated;
grant all on public.loans to service_role;
alter table public.loans enable row level security;

-- =========== INTEREST PAYMENTS ===========
create table public.interest_payments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  due_on date not null,
  interest_amount numeric(12,2) not null,
  paid_amount numeric(12,2) not null default 0,
  penalty numeric(12,2) not null default 0,
  paid_on date,
  status interest_status not null default 'due',
  created_at timestamptz not null default now()
);
create index on public.interest_payments(loan_id);
create index on public.interest_payments(member_id);
grant select, insert, update on public.interest_payments to authenticated;
grant all on public.interest_payments to service_role;
alter table public.interest_payments enable row level security;

-- =========== REPAYMENTS ===========
create table public.repayments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null,
  paid_on date not null default current_date,
  recorded_by uuid references auth.users(id),
  note text,
  created_at timestamptz not null default now()
);
create index on public.repayments(loan_id);
grant select, insert, update on public.repayments to authenticated;
grant all on public.repayments to service_role;
alter table public.repayments enable row level security;

-- =========== NOTIFICATIONS ===========
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.notifications(user_id);
grant select, insert, update on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;

-- =========== AUDIT LOGS ===========
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,
  entity text not null,
  entity_id uuid,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz not null default now()
);
create index on public.audit_logs(actor_id);
create index on public.audit_logs(entity);
grant select, insert on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;

-- =========== RLS POLICIES ===========

-- profiles: everyone authed can read (transparency requires names); only self or admin can update
create policy "profiles_read_all" on public.profiles for select to authenticated using (true);
create policy "profiles_update_self_or_admin" on public.profiles for update to authenticated
  using (auth.uid() = id or public.is_admin(auth.uid()));
create policy "profiles_insert_self_or_admin" on public.profiles for insert to authenticated
  with check (auth.uid() = id or public.is_admin(auth.uid()));

-- user_roles: read own + admin reads all; only super_admin writes
create policy "roles_read_self_or_admin" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()));
create policy "roles_super_admin_all" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

-- settings: read all, only super_admin writes
create policy "settings_read_all" on public.settings for select to authenticated using (true);
create policy "settings_super_admin_write" on public.settings for update to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

-- contributions: read all (transparency), only admin writes
create policy "contrib_read_all" on public.contributions for select to authenticated using (true);
create policy "contrib_admin_write" on public.contributions for insert to authenticated
  with check (public.is_admin(auth.uid()));
create policy "contrib_admin_update" on public.contributions for update to authenticated
  using (public.is_admin(auth.uid()));

-- missed_contributions
create policy "missed_read_all" on public.missed_contributions for select to authenticated using (true);
create policy "missed_admin_write" on public.missed_contributions for insert to authenticated
  with check (public.is_admin(auth.uid()));
create policy "missed_admin_update" on public.missed_contributions for update to authenticated
  using (public.is_admin(auth.uid()));

-- loan_requests: members create own, all read (transparency on loans), admin updates
create policy "lr_read_all" on public.loan_requests for select to authenticated using (true);
create policy "lr_member_create" on public.loan_requests for insert to authenticated
  with check (member_id = auth.uid());
create policy "lr_admin_update" on public.loan_requests for update to authenticated
  using (public.is_admin(auth.uid()));

-- loans
create policy "loans_read_all" on public.loans for select to authenticated using (true);
create policy "loans_admin_write" on public.loans for insert to authenticated
  with check (public.is_admin(auth.uid()));
create policy "loans_admin_update" on public.loans for update to authenticated
  using (public.is_admin(auth.uid()));

-- interest payments
create policy "ip_read_all" on public.interest_payments for select to authenticated using (true);
create policy "ip_admin_write" on public.interest_payments for insert to authenticated
  with check (public.is_admin(auth.uid()));
create policy "ip_admin_update" on public.interest_payments for update to authenticated
  using (public.is_admin(auth.uid()));

-- repayments
create policy "rep_read_all" on public.repayments for select to authenticated using (true);
create policy "rep_admin_write" on public.repayments for insert to authenticated
  with check (public.is_admin(auth.uid()));

-- notifications: own
create policy "notif_read_own" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "notif_update_own" on public.notifications for update to authenticated using (user_id = auth.uid());
create policy "notif_admin_insert" on public.notifications for insert to authenticated
  with check (public.is_admin(auth.uid()) or user_id = auth.uid());

-- audit logs: admin reads, anyone authed inserts
create policy "audit_read_admin" on public.audit_logs for select to authenticated
  using (public.is_admin(auth.uid()));
create policy "audit_insert_any" on public.audit_logs for insert to authenticated
  with check (actor_id = auth.uid() or actor_id is null);

-- =========== AUTO-CREATE PROFILE TRIGGER ===========
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_role app_role := 'member';
  v_count int;
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Member'),
    coalesce(new.raw_user_meta_data->>'phone', new.email)
  );

  -- First user becomes super_admin
  select count(*) into v_count from public.user_roles;
  if v_count = 0 then
    v_role := 'super_admin';
  end if;

  insert into public.user_roles (user_id, role) values (new.id, v_role);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
