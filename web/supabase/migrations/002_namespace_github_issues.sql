begin;

alter table public.content
  add column if not exists github_repository text;

alter table public.moderation_events
  add column if not exists github_repository text;

-- Existing issue-backed content came from the original public repository.
-- Curated and Feishu imports have no GitHub issue number and remain unscoped.
update public.content
set github_repository = 'luffy0x/lastfe'
where github_issue_number is not null
  and github_repository is null;

alter table public.content
  drop constraint if exists content_github_issue_number_key;

alter table public.content
  add constraint content_github_source_pair_check check (
    (github_repository is null and github_issue_number is null)
    or (github_repository is not null and github_issue_number is not null)
  );

alter table public.content
  add constraint content_github_repository_issue_key
  unique (github_repository, github_issue_number);

create index if not exists moderation_events_repository_issue_idx
  on public.moderation_events (
    github_repository,
    github_issue_number,
    applied_at desc
  );

commit;
