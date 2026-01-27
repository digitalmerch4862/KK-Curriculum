
-- 1. FORCE SEARCH PATH
-- This ensures that whenever the API roles connect, they look in public first.
ALTER ROLE anon SET search_path TO public;
ALTER ROLE authenticated SET search_path TO public;
ALTER ROLE authenticator SET search_path TO public;
ALTER ROLE service_role SET search_path TO public;

-- 2. ENSURE TABLES EXIST
CREATE TABLE IF NOT EXISTS public.lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    summary TEXT,
    content TEXT,
    category TEXT,
    series TEXT,
    grade_min INT DEFAULT 1,
    grade_max INT DEFAULT 5,
    tags TEXT[],
    status TEXT DEFAULT 'draft',
    published_at TIMESTAMPTZ,
    created_by UUID,
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.planner_configs (
    category TEXT PRIMARY KEY,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    frequency TEXT NOT NULL DEFAULT 'MONTHLY',
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.planner_occurrences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    scheduled_date DATE NOT NULL,
    lesson_id UUID NULL REFERENCES public.lessons(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'SCHEDULED',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (category, scheduled_date)
);

-- 3. NUCLEAR PERMISSION RESET
-- Sometimes the 'anon' role loses permission to the schema itself.
GRANT USAGE ON SCHEMA public TO anon, authenticated, authenticator, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, authenticator, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, authenticator, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, authenticator, service_role;

-- 4. CACHE BUMPING
-- Modifying the table structure slightly forces PostgREST to invalidate its cache.
DO $$ 
BEGIN 
    ALTER TABLE public.planner_occurrences ADD COLUMN IF NOT EXISTS _last_sync_at TIMESTAMPTZ DEFAULT now();
    ALTER TABLE public.planner_configs ADD COLUMN IF NOT EXISTS _last_sync_at TIMESTAMPTZ DEFAULT now();
END $$;

-- 5. RELOAD SIGNAL
NOTIFY pgrst, 'reload schema';

-- 6. VERIFICATION COMMENT
COMMENT ON TABLE public.planner_occurrences IS 'System Verified at ' || now();
