
-- 1. HARD RESET SESSION
SET search_path TO public;

-- 2. ENSURE ROLES HAVE ACCESS TO PUBLIC SCHEMA
CREATE SCHEMA IF NOT EXISTS public;
GRANT USAGE ON SCHEMA public TO anon, authenticated, authenticator, service_role;

-- 3. ENSURE TABLES EXIST (WITH EXPLICIT DEFAULTS)
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

CREATE TABLE IF NOT EXISTS public.lesson_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL,
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    UNIQUE (lesson_id, teacher_id)
);

-- 4. THE CACHE BUSTER (NUCLEAR VERSION)
-- Adding and dropping a column is the most reliable way to force PostgREST to refresh its cache.
DO $$ 
BEGIN 
    -- Refresh planner_configs
    ALTER TABLE public.planner_configs ADD COLUMN IF NOT EXISTS _api_sync_v2 BOOLEAN DEFAULT TRUE;
    ALTER TABLE public.planner_configs DROP COLUMN IF EXISTS _api_sync_v2;
    
    -- Refresh planner_occurrences
    ALTER TABLE public.planner_occurrences ADD COLUMN IF NOT EXISTS _api_sync_v2 BOOLEAN DEFAULT TRUE;
    ALTER TABLE public.planner_occurrences DROP COLUMN IF EXISTS _api_sync_v2;

    -- Refresh lessons
    ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS _api_sync_v2 BOOLEAN DEFAULT TRUE;
    ALTER TABLE public.lessons DROP COLUMN IF EXISTS _api_sync_v2;
END $$;

-- 5. EXPLICIT ROLE PERMISSIONS (Targeting the 'authenticator' role specifically)
ALTER ROLE anon SET search_path TO public;
ALTER ROLE authenticated SET search_path TO public;
ALTER ROLE authenticator SET search_path TO public;
ALTER ROLE service_role SET search_path TO public;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, authenticator, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, authenticator, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, authenticator, service_role;

-- 6. NOTIFY API GATEWAY
NOTIFY pgrst, 'reload schema';

-- 7. VERIFICATION
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'planner_occurrences') THEN
    RAISE EXCEPTION 'CRITICAL ERROR: Table planner_occurrences still not visible in information_schema.';
  END IF;
END $$;
