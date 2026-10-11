-- New writes must be plain text. Historical comments are preserved for review.
do $$ begin
  if not exists(select 1 from pg_constraint where conname='arcus_comment_plain_text' and conrelid='public.arcus_workout_comments'::regclass) then
    alter table public.arcus_workout_comments add constraint arcus_comment_plain_text
      check(char_length(btrim(body)) between 1 and 500 and body !~ '[<>]') not valid;
  end if;
end $$;
create index if not exists arcus_social_recent_idx
  on public.arcus_workouts(updated_at desc,id desc,account_id desc)
  where is_public=true and payload->>'status'='completed';
create index if not exists arcus_social_comments_recent_idx
  on public.arcus_workout_comments(workout_owner_id,workout_id,created_at desc,id desc);
