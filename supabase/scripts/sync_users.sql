-- Fix missing profiles by syncing existing auth users into the new public.profiles table

INSERT INTO public.profiles (id, first_name, last_name)
SELECT id, raw_user_meta_data->>'first_name', raw_user_meta_data->>'last_name'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles);

-- Also sync the user_progress table which is required by our new schema
INSERT INTO public.user_progress (user_id)
SELECT id FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_progress);
