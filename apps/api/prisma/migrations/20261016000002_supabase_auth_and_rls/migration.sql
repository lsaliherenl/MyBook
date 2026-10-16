-- Supabase integration: profiles for Auth users, row level security, storage buckets.

-- ─── Profiles follow auth.users ───────────────────────────────────────────────

ALTER TABLE "public"."profiles"
  ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users" ("id") ON DELETE CASCADE;

-- Creates the profile when someone signs up. Only harmless fields are read from the sign-up
-- metadata; the role always starts as MEMBER and can only be raised by an admin through the API.
CREATE OR REPLACE FUNCTION "public"."handle_new_user"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO "public"."profiles" ("id", "email", "full_name", "student_number", "faculty", "member_type", "locale", "updated_at")
  VALUES (
    NEW.id,
    NEW.email,
    coalesce(nullif(trim(NEW.raw_user_meta_data ->> 'full_name'), ''), split_part(NEW.email, '@', 1)),
    nullif(trim(NEW.raw_user_meta_data ->> 'student_number'), ''),
    nullif(trim(NEW.raw_user_meta_data ->> 'faculty'), ''),
    CASE NEW.raw_user_meta_data ->> 'member_type'
      WHEN 'ACADEMIC' THEN 'ACADEMIC'::"public"."MemberType"
      WHEN 'STAFF' THEN 'STAFF'::"public"."MemberType"
      ELSE 'STUDENT'::"public"."MemberType"
    END,
    CASE NEW.raw_user_meta_data ->> 'locale' WHEN 'en' THEN 'en'::"public"."Locale" ELSE 'tr'::"public"."Locale" END,
    now()
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER "on_auth_user_created"
  AFTER INSERT ON "auth"."users"
  FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();

-- Keeps profiles.email in sync when a user changes their e-mail address.
CREATE OR REPLACE FUNCTION "public"."handle_user_email_change"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE "public"."profiles" SET "email" = NEW.email, "updated_at" = now() WHERE "id" = NEW.id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "on_auth_user_email_changed"
  AFTER UPDATE OF "email" ON "auth"."users"
  FOR EACH ROW WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION "public"."handle_user_email_change"();

REVOKE EXECUTE ON FUNCTION "public"."handle_new_user"() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION "public"."handle_user_email_change"() FROM PUBLIC, anon, authenticated;

-- ─── Row level security ──────────────────────────────────────────────────────
-- All data access goes through the NestJS API, which connects as the database owner and is not
-- affected by RLS. Enabling RLS without any policies makes Supabase's public Data API
-- (anon / authenticated keys) unable to read or write these tables.

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END;
$$;

REVOKE USAGE, SELECT ON SEQUENCE "public"."card_number_seq" FROM anon, authenticated;

-- ─── Storage ─────────────────────────────────────────────────────────────────
-- Public-read buckets; only the API (secret key) uploads.

INSERT INTO "storage"."buckets" ("id", "name", "public", "file_size_limit", "allowed_mime_types")
VALUES
  ('covers', 'covers', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('events', 'events', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT ("id") DO NOTHING;
