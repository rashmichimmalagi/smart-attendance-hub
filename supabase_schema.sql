-- ============================================================================
-- SMART ATTENDANCE HUB - COMPLETE SUPABASE DATABASE SCHEMA & MIGRATIONS
-- Compatible with PostgreSQL 15+ & Supabase Auth / Realtime
-- ============================================================================

-- Enable UUID Extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. PUBLIC PROFILES & USER ROLES
-- ==========================================

-- Trigger to auto-create profile on Auth Signup
-- This ensures matching records between Auth and Public Schemas
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    usn TEXT UNIQUE,            -- Optional for admins, required for students
    admin_id TEXT UNIQUE,      -- Optional for students, required for admins (supports custom CSE_HOD, EventAdmin, etc.)
    department TEXT,           -- Optional for admins, required for students
    account_status TEXT DEFAULT 'Pending' CHECK (account_status IN ('Pending', 'Approved', 'Rejected')) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for speedy email and unique credential lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_usn ON public.profiles(usn) WHERE usn IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_admin_id ON public.profiles(admin_id) WHERE admin_id IS NOT NULL;

-- Role tracking table (linked directly to profiles)
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('student', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_user_role UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

-- ==========================================
-- 2. SESSIONS (CLASSROOM & EVENTS)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    venue TEXT NOT NULL,
    hosted_by TEXT NOT NULL,
    resource_person TEXT NOT NULL,
    number_of_volunteers INTEGER DEFAULT 0 NOT NULL,
    status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('inactive', 'live', 'expired')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_date ON public.sessions(date DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON public.sessions(status);

-- ==========================================
-- 3. ATTENDANCE SYSTEM
-- ==========================================
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    student_usn TEXT NOT NULL,
    student_dept TEXT NOT NULL,
    check_in_time TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    method TEXT NOT NULL DEFAULT 'qr' CHECK (method IN ('qr', 'manual')),
    CONSTRAINT unique_student_session_attendance UNIQUE (session_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_session ON public.attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON public.attendance(student_id);

-- ==========================================
-- 4. ASSIGNMENTS & RESOURCES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    resources TEXT,
    attached_files JSONB DEFAULT '[]'::jsonb NOT NULL, -- Array of objects: {name, url, size}
    attached_links TEXT[] DEFAULT '{}'::text[] NOT NULL,
    deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assignments_deadline ON public.assignments(deadline ASC);

-- ==========================================
-- 5. ASSIGNMENT SUBMISSIONS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.assignment_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    student_usn TEXT NOT NULL,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    attached_files JSONB DEFAULT '[]'::jsonb NOT NULL, -- Submitted files {name, url, size}
    attached_links TEXT[] DEFAULT '{}'::text[] NOT NULL,
    CONSTRAINT unique_student_assignment_submission UNIQUE (assignment_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON public.assignment_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON public.assignment_submissions(student_id);

-- ==========================================
-- 6. SESSION SUMMARIES & REFLECTIONS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.session_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    student_usn TEXT NOT NULL,
    summary TEXT NOT NULL,                     -- Character limits managed in code (front-end counters)
    learnings TEXT NOT NULL,
    reflections TEXT NOT NULL,
    suggestions TEXT NOT NULL,
    feedback TEXT NOT NULL,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_student_session_summary UNIQUE (session_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_summaries_session ON public.session_summaries(session_id);

-- ==========================================
-- 7. NOTIFICATIONS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    role_target TEXT NOT NULL DEFAULT 'all' CHECK (role_target IN ('all', 'student', 'admin')),
    read_by UUID[] DEFAULT '{}'::uuid[] NOT NULL, -- Tracks user UUIDs that marked it read
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS across all core tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 1. Help helper functions to determine user roles
CREATE OR REPLACE FUNCTION public.is_admin(profile_id UUID) 
RETURNS BOOLEAN SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = profile_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql;

-- 2. Profiles Policies
DROP POLICY IF EXISTS "Public profiles can be viewed by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles can be viewed by everyone" ON public.profiles;
CREATE POLICY "Public profiles can be viewed by everyone" 
ON public.profiles FOR SELECT TO public USING (true);

CREATE POLICY "Users can edit their own profiles" 
ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Admins can update all profiles" 
ON public.profiles FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Allow public insert during trigger registration"
ON public.profiles FOR INSERT TO anon, authenticated WITH CHECK (true);

-- 3. User Roles Policies
CREATE POLICY "Role is viewable by authenticated users" 
ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Roles are insertable during signup" 
ON public.user_roles FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Only admins can change roles" 
ON public.user_roles FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- 4. Sessions Policies
CREATE POLICY "Sessions can be viewed by anyone authenticated" 
ON public.sessions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only admins can insert or update sessions" 
ON public.sessions FOR ALL TO authenticated 
USING (public.is_admin(auth.uid())) 
WITH CHECK (public.is_admin(auth.uid()));

-- 5. Attendance Policies
CREATE POLICY "Attendance can be selected by authenticated users" 
ON public.attendance FOR SELECT TO authenticated USING (true);

-- Students can insert their own attendance
CREATE POLICY "Students can mark their own attendance" 
ON public.attendance FOR INSERT TO authenticated 
WITH CHECK (auth.uid() = student_id AND (
    SELECT status FROM public.sessions WHERE id = session_id
) = 'live' OR public.is_admin(auth.uid()));

-- Admins can update/delete attendance manually
CREATE POLICY "Admins can manage attendance" 
ON public.attendance FOR ALL TO authenticated 
USING (public.is_admin(auth.uid())) 
WITH CHECK (public.is_admin(auth.uid()));

-- 6. Assignments Policies
CREATE POLICY "Assignments can be viewed by all authenticated users" 
ON public.assignments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only admins can edit assignments" 
ON public.assignments FOR ALL TO authenticated 
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- 7. Submissions Policies
CREATE POLICY "Submissions can be viewed by admins or the student owner" 
ON public.assignment_submissions FOR SELECT TO authenticated 
USING (auth.uid() = student_id OR public.is_admin(auth.uid()));

CREATE POLICY "Only students can write/modify their own submissions" 
ON public.assignment_submissions FOR ALL TO authenticated 
USING (auth.uid() = student_id OR public.is_admin(auth.uid()))
WITH CHECK (auth.uid() = student_id OR public.is_admin(auth.uid()));

-- 8. Session Summaries Policies
CREATE POLICY "Session summaries can be viewed by admins or the student owner" 
ON public.session_summaries FOR SELECT TO authenticated 
USING (auth.uid() = student_id OR public.is_admin(auth.uid()));

CREATE POLICY "Students can submit summaries if they checked in" 
ON public.session_summaries FOR INSERT TO authenticated 
WITH CHECK (
    auth.uid() = student_id 
    AND EXISTS (
        SELECT 1 FROM public.attendance 
        WHERE session_id = session_summaries.session_id AND student_id = auth.uid()
    )
);

CREATE POLICY "Students or admins can update reflections" 
ON public.session_summaries FOR UPDATE TO authenticated 
USING (auth.uid() = student_id OR public.is_admin(auth.uid()))
WITH CHECK (auth.uid() = student_id OR public.is_admin(auth.uid()));

-- 9. Notifications Policies
CREATE POLICY "Notifications visible to authenticated users" 
ON public.notifications FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert notifications" 
ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Only Admins can delete notifications" 
ON public.notifications FOR DELETE TO authenticated 
USING (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated users can update notifications" 
ON public.notifications FOR UPDATE TO authenticated 
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 8. STORAGE BUCKET PRE-REQUISITE PROVISIONING SCRIPTS
-- ============================================================================

-- SQL schema queries to set up public/secure storage buckets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('assignment-resources', 'assignment-resources', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('student-submissions', 'student-submissions', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for public resource lookups
CREATE POLICY "Public Access for Resources" 
ON storage.objects FOR SELECT TO authenticated 
USING (bucket_id = 'assignment-resources');

CREATE POLICY "Admins can upload resource files" 
ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'assignment-resources' AND public.is_admin(auth.uid()));

-- Policies for student assignment uploads
CREATE POLICY "Students can upload homework submissions" 
ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'student-submissions' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins / Owners can preview submissions homework" 
ON storage.objects FOR SELECT TO authenticated 
USING (bucket_id = 'student-submissions' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin(auth.uid())));

-- ============================================================================
-- 8B. SECURITY UNIQUE ATTENDANCE TOKENS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.attendance_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    attendance_token TEXT NOT NULL UNIQUE,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    is_verified BOOLEAN DEFAULT false NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attendance_tokens_session ON public.attendance_tokens(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_tokens_student ON public.attendance_tokens(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_tokens_token ON public.attendance_tokens(attendance_token);

ALTER TABLE public.attendance_tokens ENABLE ROW LEVEL SECURITY;

-- Approved students SELECT policy
DROP POLICY IF EXISTS "Only approved students can read their own attendance tokens" ON public.attendance_tokens;
CREATE POLICY "Only approved students can read their own attendance tokens"
ON public.attendance_tokens FOR SELECT TO authenticated
USING (
  student_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE public.profiles.id = auth.uid() AND public.profiles.account_status = 'Approved'
  )
);

-- Approved students INSERT policy
DROP POLICY IF EXISTS "Only approved students can insert their own attendance tokens" ON public.attendance_tokens;
CREATE POLICY "Only approved students can insert their own attendance tokens"
ON public.attendance_tokens FOR INSERT TO authenticated
WITH CHECK (
  student_id = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE public.profiles.id = auth.uid() AND public.profiles.account_status = 'Approved'
  )
);

-- Approved students UPDATE policy
DROP POLICY IF EXISTS "Only approved students can update their own attendance tokens" ON public.attendance_tokens;
CREATE POLICY "Only approved students can update their own attendance tokens"
ON public.attendance_tokens FOR UPDATE TO authenticated
USING (
  student_id = auth.uid()
)
WITH CHECK (
  student_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE public.profiles.id = auth.uid() AND public.profiles.account_status = 'Approved'
  )
);

-- Admins can view and update all attendance tokens
DROP POLICY IF EXISTS "Admins can view and update all attendance tokens" ON public.attendance_tokens;
CREATE POLICY "Admins can view and update all attendance tokens"
ON public.attendance_tokens FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- ============================================================================
-- 9. PUBLIC TRIGGER FOR AUTOMATED AUTH USER REGISTRATION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER SECURITY DEFINER AS $$
DECLARE
    usr_full_name TEXT;
    usr_usn TEXT;
    usr_admin_id TEXT;
    usr_dept TEXT;
    usr_role TEXT;
BEGIN
    -- Extract metadata supplied during supabase.auth.signUp()
    usr_full_name := COALESCE(new.raw_user_meta_data->>'full_name', 'Student User');
    usr_usn       := new.raw_user_meta_data->>'usn';
    usr_admin_id  := new.raw_user_meta_data->>'admin_id';
    usr_dept      := new.raw_user_meta_data->>'department';
    usr_role      := COALESCE(new.raw_user_meta_data->>'role', 'student');

    -- Insert profile safely
    INSERT INTO public.profiles (id, full_name, email, usn, admin_id, department, account_status, created_at)
    VALUES (
        new.id,
        usr_full_name,
        new.email,
        usr_usn,
        usr_admin_id,
        usr_dept,
        CASE WHEN usr_role = 'admin' THEN 'Approved' ELSE 'Pending' END,
        COALESCE(new.created_at, now())
    ) ON CONFLICT (id) DO UPDATE 
    SET 
        full_name = EXCLUDED.full_name, 
        usn = EXCLUDED.usn, 
        admin_id = EXCLUDED.admin_id, 
        department = EXCLUDED.department,
        account_status = EXCLUDED.account_status;

    -- Assign matching role mapping
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, usr_role::text)
    ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Bind Trigger to Auth User Created event
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- 10. REALTIME REPLICATION CONFIGURATION
-- ==========================================
-- Ensure realtime is subscribed specifically to updates of Sessions, Attendance and Assignments
begin;
  -- remove the publication if standard existed to prevent duplicate errors
  drop publication if exists supabase_realtime;
  
  -- Create publication
  create publication supabase_realtime for table 
    public.sessions, 
    public.attendance, 
    public.assignments,
    public.assignment_submissions,
    public.session_summaries,
    public.notifications;
commit;
