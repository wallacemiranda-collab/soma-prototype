-- Optional demo data.
-- 1. Create a user in Supabase Auth first.
-- 2. Replace the email below with that user's email.
-- 3. Run this file in the Supabase SQL Editor.

do $$
declare
  demo_user_id uuid;
begin
  select id
    into demo_user_id
    from auth.users
    where email = 'marina@soma.app'
    limit 1;

  if demo_user_id is null then
    raise notice 'Demo user not found. Create marina@soma.app in Authentication > Users first.';
    return;
  end if;

  update public.profiles
     set full_name = 'Marina',
         goal_weight = 88,
         weekly_exercise_goal = 150,
         sleep_goal_hours = 7
   where id = demo_user_id;

  insert into public.metabolic_entries (
    user_id,
    entry_date,
    weight_kg,
    waist_cm,
    sleep_minutes,
    activity_minutes,
    water_liters,
    mood_score,
    nutrition_adherence
  )
  values
    (demo_user_id, current_date - interval '5 days', 92.0, 104, 390, 15, 1.4, 7, 62),
    (demo_user_id, current_date - interval '4 days', 91.8, 104, 410, 20, 1.6, 7, 68),
    (demo_user_id, current_date - interval '3 days', 91.2, 103, 425, 30, 1.8, 8, 72),
    (demo_user_id, current_date - interval '2 days', 90.9, 103, 435, 32, 1.9, 8, 74),
    (demo_user_id, current_date - interval '1 day', 90.1, 102, 444, 35, 2.0, 8, 78),
    (demo_user_id, current_date, 89.8, 102, 448, 40, 1.9, 8, 82)
  on conflict (user_id, entry_date) do update
    set weight_kg = excluded.weight_kg,
        waist_cm = excluded.waist_cm,
        sleep_minutes = excluded.sleep_minutes,
        activity_minutes = excluded.activity_minutes,
        water_liters = excluded.water_liters,
        mood_score = excluded.mood_score,
        nutrition_adherence = excluded.nutrition_adherence;

  insert into public.habit_logs (user_id, logged_at, habit_key, value, notes)
  values
    (demo_user_id, current_date, 'sleep', 78, 'Regularidade melhorando'),
    (demo_user_id, current_date, 'activity', 64, 'Caminhada leve planejada'),
    (demo_user_id, current_date, 'adherence', 82, 'Boa adesão à rotina'),
    (demo_user_id, current_date, 'water', 1.9, 'Média diária')
  on conflict (user_id, logged_at, habit_key) do update
    set value = excluded.value,
        notes = excluded.notes;
end $$;
