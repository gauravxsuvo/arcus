insert into public.muscles (slug, name, region) values
  ('chest', 'Chest', 'torso'), ('upper-chest', 'Upper chest', 'torso'), ('lats', 'Lats', 'back'),
  ('upper-back', 'Upper back', 'back'), ('traps', 'Traps', 'back'), ('front-delts', 'Front delts', 'shoulders'),
  ('side-delts', 'Side delts', 'shoulders'), ('rear-delts', 'Rear delts', 'shoulders'), ('biceps', 'Biceps', 'arms'),
  ('triceps', 'Triceps', 'arms'), ('forearms', 'Forearms', 'arms'), ('abs', 'Abs', 'core'),
  ('obliques', 'Obliques', 'core'), ('erectors', 'Erectors', 'back'), ('quads', 'Quads', 'legs'),
  ('hamstrings', 'Hamstrings', 'legs'), ('glutes', 'Glutes', 'legs'), ('calves', 'Calves', 'legs'),
  ('adductors', 'Adductors', 'legs')
on conflict (slug) do nothing;

insert into public.exercises (name, slug, aliases, primary_muscle_id, movement_pattern, equipment, difficulty, default_rep_min, default_rep_max, default_rest_seconds, is_system_exercise)
select v.name, v.slug, v.aliases, m.id, v.pattern, v.equipment, 'beginner', 6, 12, v.rest, true
from (values
  ('Barbell Bench Press','barbell-bench-press',array['bench','flat bench'],'chest','horizontal push',array['barbell'],150),
  ('Incline Barbell Bench Press','incline-barbell-bench-press',array['incline bench'],'upper-chest','incline push',array['barbell'],150),
  ('Dumbbell Bench Press','dumbbell-bench-press',array['db bench'],'chest','horizontal push',array['dumbbell'],120),
  ('Incline Dumbbell Press','incline-dumbbell-press',array['incline db press'],'upper-chest','incline push',array['dumbbell'],120),
  ('Machine Chest Press','machine-chest-press',array[]::text[],'chest','horizontal push',array['machine'],120),
  ('Pec Deck','pec-deck',array['machine fly'],'chest','fly',array['machine'],90),
  ('Cable Fly','cable-fly',array[]::text[],'chest','fly',array['cable'],90),
  ('Push-up','push-up',array['press-up'],'chest','horizontal push',array['bodyweight'],90),
  ('Pull-up','pull-up',array[]::text[],'lats','vertical pull',array['bodyweight'],150),
  ('Chin-up','chin-up',array[]::text[],'lats','vertical pull',array['bodyweight'],150),
  ('Lat Pulldown','lat-pulldown',array['pulldown'],'lats','vertical pull',array['cable'],120),
  ('Barbell Row','barbell-row',array['bent over row'],'upper-back','horizontal pull',array['barbell'],150),
  ('Chest-Supported Row','chest-supported-row',array[]::text[],'upper-back','horizontal pull',array['machine'],120),
  ('Seated Cable Row','seated-cable-row',array['cable row'],'upper-back','horizontal pull',array['cable'],120),
  ('One-Arm Dumbbell Row','one-arm-dumbbell-row',array['single arm row'],'lats','horizontal pull',array['dumbbell'],120),
  ('Overhead Press','overhead-press',array['ohp','military press'],'front-delts','vertical push',array['barbell'],150),
  ('Dumbbell Shoulder Press','dumbbell-shoulder-press',array[]::text[],'front-delts','vertical push',array['dumbbell'],120),
  ('Machine Shoulder Press','machine-shoulder-press',array[]::text[],'front-delts','vertical push',array['machine'],120),
  ('Dumbbell Lateral Raise','lateral-raise',array['side raise'],'side-delts','shoulder isolation',array['dumbbell'],75),
  ('Cable Lateral Raise','cable-lateral-raise',array[]::text[],'side-delts','shoulder isolation',array['cable'],75),
  ('Reverse Fly','reverse-fly',array['rear delt fly'],'rear-delts','shoulder isolation',array['machine'],75),
  ('Face Pull','face-pull',array[]::text[],'rear-delts','shoulder isolation',array['cable'],75),
  ('Barbell Curl','barbell-curl',array[]::text[],'biceps','elbow flexion',array['barbell'],90),
  ('Dumbbell Curl','dumbbell-curl',array[]::text[],'biceps','elbow flexion',array['dumbbell'],75),
  ('Incline Curl','incline-curl',array[]::text[],'biceps','elbow flexion',array['dumbbell'],75),
  ('Hammer Curl','hammer-curl',array[]::text[],'biceps','elbow flexion',array['dumbbell'],75),
  ('Triceps Pushdown','triceps-pushdown',array['pushdown'],'triceps','elbow extension',array['cable'],75),
  ('Overhead Cable Extension','overhead-cable-extension',array[]::text[],'triceps','elbow extension',array['cable'],75),
  ('Skull Crusher','skull-crusher',array[]::text[],'triceps','elbow extension',array['ez bar'],90),
  ('Close-Grip Bench Press','close-grip-bench-press',array[]::text[],'triceps','horizontal push',array['barbell'],120),
  ('Back Squat','back-squat',array['squat'],'quads','squat',array['barbell'],180),
  ('Front Squat','front-squat',array[]::text[],'quads','squat',array['barbell'],180),
  ('Hack Squat','hack-squat',array[]::text[],'quads','squat',array['machine'],150),
  ('Leg Press','leg-press',array[]::text[],'quads','squat',array['machine'],150),
  ('Leg Extension','leg-extension',array[]::text[],'quads','knee extension',array['machine'],90),
  ('Romanian Deadlift','romanian-deadlift',array['rdl','stiff leg deadlift'],'hamstrings','hip hinge',array['barbell'],150),
  ('Stiff-Leg Deadlift','stiff-leg-deadlift',array[]::text[],'hamstrings','hip hinge',array['barbell'],150),
  ('Seated Leg Curl','seated-leg-curl',array['hamstring curl'],'hamstrings','knee flexion',array['machine'],90),
  ('Barbell Hip Thrust','barbell-hip-thrust',array[]::text[],'glutes','hip extension',array['barbell'],120),
  ('Standing Calf Raise','standing-calf-raise',array[]::text[],'calves','ankle extension',array['machine'],75)
) as v(name, slug, aliases, primary_muscle, pattern, equipment, rest)
join public.muscles m on m.slug = v.primary_muscle
where not exists (select 1 from public.exercises e where e.is_system_exercise and e.slug = v.slug);

insert into public.exercise_muscles (exercise_id, muscle_id, contribution_weight)
select e.id, m.id, v.weight
from (values
  ('barbell-bench-press','chest',1.0), ('barbell-bench-press','front-delts',0.5), ('barbell-bench-press','triceps',0.5),
  ('incline-barbell-bench-press','upper-chest',1.0), ('incline-barbell-bench-press','front-delts',0.5), ('incline-barbell-bench-press','triceps',0.4),
  ('dumbbell-bench-press','chest',1.0), ('dumbbell-bench-press','front-delts',0.4), ('dumbbell-bench-press','triceps',0.4),
  ('pull-up','lats',1.0), ('pull-up','biceps',0.4), ('pull-up','upper-back',0.3),
  ('lat-pulldown','lats',1.0), ('lat-pulldown','biceps',0.4), ('lat-pulldown','upper-back',0.3),
  ('barbell-row','upper-back',1.0), ('barbell-row','lats',0.7), ('barbell-row','biceps',0.4), ('barbell-row','erectors',0.3),
  ('overhead-press','front-delts',1.0), ('overhead-press','side-delts',0.4), ('overhead-press','triceps',0.5),
  ('lateral-raise','side-delts',1.0), ('reverse-fly','rear-delts',1.0), ('reverse-fly','upper-back',0.4),
  ('back-squat','quads',1.0), ('back-squat','glutes',0.7), ('back-squat','adductors',0.3), ('back-squat','erectors',0.3),
  ('romanian-deadlift','hamstrings',1.0), ('romanian-deadlift','glutes',0.7), ('romanian-deadlift','erectors',0.4),
  ('leg-press','quads',1.0), ('leg-press','glutes',0.5), ('barbell-hip-thrust','glutes',1.0), ('standing-calf-raise','calves',1.0)
) as v(exercise_slug, muscle_slug, weight)
join public.exercises e on e.slug = v.exercise_slug and e.is_system_exercise
join public.muscles m on m.slug = v.muscle_slug
on conflict (exercise_id, muscle_id) do update set contribution_weight = excluded.contribution_weight;
