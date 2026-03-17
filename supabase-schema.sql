create extension if not exists pgcrypto;

create table if not exists public.executive_actions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  owner text not null,
  initiator text,
  due_date date not null,
  priority text not null check (priority in ('High', 'Medium', 'Low')),
  status text not null check (
    status in (
      'Draft',
      'In Review',
      'Sent Back',
      'Approved',
      'Rejected',
      'Completed',
      'Not Started',
      'In Progress',
      'At Risk'
    )
  ),
  notes text not null default '',
  memo_body text,
  memo_background text,
  memo_analysis text,
  memo_recommendation text,
  attachment_name text,
  external_implication boolean not null default false,
  institutional_implication boolean not null default false,
  mode text check (mode in ('Light', 'Standard', 'Strict')),
  workflow_steps jsonb not null default '[]'::jsonb,
  current_step_index integer not null default 0,
  approval_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.executive_actions add column if not exists initiator text;
alter table public.executive_actions add column if not exists memo_body text;
alter table public.executive_actions add column if not exists memo_background text;
alter table public.executive_actions add column if not exists memo_analysis text;
alter table public.executive_actions add column if not exists memo_recommendation text;
alter table public.executive_actions add column if not exists attachment_name text;
alter table public.executive_actions add column if not exists external_implication boolean not null default false;
alter table public.executive_actions add column if not exists institutional_implication boolean not null default false;
alter table public.executive_actions add column if not exists mode text;
alter table public.executive_actions add column if not exists workflow_steps jsonb not null default '[]'::jsonb;
alter table public.executive_actions add column if not exists current_step_index integer not null default 0;
alter table public.executive_actions add column if not exists approval_history jsonb not null default '[]'::jsonb;

alter table public.executive_actions enable row level security;

drop policy if exists "Allow anon select" on public.executive_actions;
drop policy if exists "Allow anon insert" on public.executive_actions;
drop policy if exists "Allow anon update" on public.executive_actions;

create policy "Allow anon select"
on public.executive_actions
for select
to anon
using (true);

create policy "Allow anon insert"
on public.executive_actions
for insert
to anon
with check (true);

create policy "Allow anon update"
on public.executive_actions
for update
to anon
using (true)
with check (true);

insert into public.executive_actions (title, owner, initiator, due_date, priority, status, notes, memo_body, memo_background, memo_analysis, memo_recommendation, attachment_name, external_implication, institutional_implication, mode)
values
  ('Finalize ministerial briefing packet', 'Rahul Jha', 'Rahul Jha', '2026-03-21', 'High', 'In Review', 'Need legal and finance annexes before final review.', 'Memo requests SG endorsement for ministerial packet distribution and protocol brief.', 'Council timeline requires final packet readiness.', 'Legal and finance annexes are pending and risk delay.', 'Approve packet after annex validation.', 'ministerial-packet-v3.pdf', true, true, 'Strict'),
  ('Confirm bilateral meeting slots with 6 delegations', 'Fatima Protocol', 'Fatima Protocol', '2026-03-19', 'High', 'Sent Back', 'Two delegations still pending timezone confirmation.', 'Memo asks for final schedule sign-off with conditional alternates.', 'Six bilateral slots require final timezone lock.', null, 'Return to protocol for timezone confirmation before sign-off.', 'bilateral-schedule-draft.xlsx', true, false, 'Standard'),
  ('Prepare one-page partnership proposition', 'Lina Partnerships', 'Lina Partnerships', '2026-03-25', 'Medium', 'Draft', 'Use updated KPIs from latest outreach tracker.', 'Concept memo for partnership proposition and target outreach track.', 'Partnership engagement window is active before council review.', 'Interest is high but value proposition is not yet segmented.', 'Approve one-page proposition with segmented offers.', null, false, false, 'Light'),
  ('Publish weekly executive action dashboard', 'Ari Finance', 'Ari Finance', '2026-03-18', 'Low', 'Completed', 'Shared with leadership and country focal points.', 'Execution item completed and distributed.', 'Dashboard cycle completed this week.', null, 'No further action required.', null, false, false, 'Light')
on conflict do nothing;
