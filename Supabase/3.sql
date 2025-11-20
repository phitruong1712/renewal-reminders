create table public.customers (
  id bigint generated always as identity primary key,
  company_name text,
  contact_name text,
  primary_email text not null,
  cc_emails text[],
  plan_name text,
  renew_link text,
  expires_on date,
  paused boolean default false,
  last_reminder_status text,
  last_reminder_sent_at timestamptz
);

create table public.reminders (
  id bigint generated always as identity primary key,
  customer_id bigint references public.customers(id) on delete cascade,
  offset_days integer,
  scheduled_at timestamptz,
  sent_at timestamptz,
  status text default 'pending',
  provider_message_id text
);

create table public.send_logs (
  id bigint generated always as identity primary key,
  reminder_id bigint references public.reminders(id) on delete cascade,
  customer_id bigint references public.customers(id) on delete cascade,
  status text,
  error text,
  sent_at timestamptz default now()
);
