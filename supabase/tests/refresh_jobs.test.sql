begin;

select plan(19);

select has_table('public', 'refresh_jobs', 'refresh_jobs table exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.refresh_jobs'::regclass),
  'refresh_jobs has RLS enabled'
);
select ok(not has_table_privilege('anon', 'public.refresh_jobs', 'select,insert,update,delete'), 'anon has no queue access');
select ok(not has_table_privilege('authenticated', 'public.refresh_jobs', 'select,insert,update,delete'), 'authenticated has no queue access');
select ok(has_table_privilege('service_role', 'public.refresh_jobs', 'select,insert,update,delete'), 'service role manages the queue');
select ok(not has_function_privilege('anon', 'public.enqueue_refresh_jobs(text,text[],uuid)', 'execute'), 'anon cannot enqueue by RPC');
select ok(not has_function_privilege('authenticated', 'public.enqueue_refresh_jobs(text,text[],uuid)', 'execute'), 'authenticated cannot enqueue by RPC');
select ok(has_function_privilege('service_role', 'public.enqueue_refresh_jobs(text,text[],uuid)', 'execute'), 'service role can enqueue');

insert into public.stocks (symbol, company_name, sector, exchange)
values ('QTEST', 'Queue Test', 'Technology', 'HOSE');

set local role service_role;

select throws_ok(
  $$select * from public.enqueue_refresh_jobs('QTEST', array['unsupported'], null)$$,
  '22023',
  'unsupported refresh data type',
  'unsupported data type is rejected'
);
select throws_ok(
  $$select * from public.claim_refresh_jobs(null, 1, 900)$$,
  '22023',
  'invalid worker id',
  'claim requires a worker id'
);

select lives_ok(
  $$select * from public.enqueue_refresh_jobs('QTEST', array['market'], null)$$,
  'first enqueue succeeds'
);
select lives_ok(
  $$select * from public.enqueue_refresh_jobs('QTEST', array['market'], null)$$,
  'duplicate enqueue returns the active job'
);
select is(
  (select count(*) from public.refresh_jobs where symbol = 'QTEST' and data_type = 'market' and status in ('queued', 'running')),
  1::bigint,
  'duplicate requests collapse to one active job'
);

select lives_ok(
  $$select * from public.claim_refresh_jobs('test-worker', 1, 900)$$,
  'worker claims a queued job'
);
select is(
  (select status from public.refresh_jobs where symbol = 'QTEST' and data_type = 'market'),
  'running',
  'claimed job is marked running'
);

select throws_ok(
  $$select public.complete_refresh_job(
      (select id from public.refresh_jobs where symbol = 'QTEST' and data_type = 'market'),
      'other-worker',
      true,
      null
    )$$,
  '55000',
  'refresh job is not owned by this worker',
  'only the lock owner can complete a job'
);

select lives_ok(
  $$select public.complete_refresh_job(
      (select id from public.refresh_jobs where symbol = 'QTEST' and data_type = 'market'),
      'test-worker',
      false,
      'temporary provider failure'
    )$$,
  'failed attempt is scheduled for retry'
);
select is(
  (select status from public.refresh_jobs where symbol = 'QTEST' and data_type = 'market'),
  'queued',
  'retry returns the job to queued state'
);
select ok(
  (select available_at > now() from public.refresh_jobs where symbol = 'QTEST' and data_type = 'market'),
  'retry uses a future exponential-backoff time'
);

select * from finish();
rollback;
