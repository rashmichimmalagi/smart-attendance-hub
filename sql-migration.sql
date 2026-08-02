-- ============================================================================
-- SQL Migration - Secure Student/Admin Login Lookup RPC
-- ============================================================================

-- Create a custom composite type or return a table structure.
-- This function is SECURITY DEFINER, meaning it bypasses Row Level Security (RLS)
-- on the public.profiles and public.user_roles tables to resolve the login credentials
-- (email, role, account status) for any given identifier (Email, USN, or Admin ID).
-- Only non-sensitive public identifiers are returned to defend against exploitation or data harvesting.

CREATE OR REPLACE FUNCTION public.lookup_login_identity(input_value text)
RETURNS TABLE (
  email text,
  role text,
  account_status text
) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.email::text,
    r.role::text,
    p.account_status::text
  FROM public.profiles p
  LEFT JOIN public.user_roles r ON r.user_id = p.id
  WHERE 
    p.email ILIKE input_value
    OR p.usn ILIKE input_value
    OR p.admin_id ILIKE input_value
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Grant execution rights explicitly to unauthenticated (anon) and authenticated roles.
-- This allows the login flow to execute this function prior to logging in.
GRANT EXECUTE ON FUNCTION public.lookup_login_identity(text) TO anon;
GRANT EXECUTE ON FUNCTION public.lookup_login_identity(text) TO authenticated;

-- ============================================================================
-- Migration: Session Ownership, Authorized Admins, and Session Extensions
-- ============================================================================

ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS session_owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS authorized_admin_ids UUID[] DEFAULT '{}'::uuid[];

ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS original_end_time TIME;

ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS extended_end_time TIME;

ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS extension_history JSONB DEFAULT '[]'::jsonb;

-- Populate original_end_time and extended_end_time for existing records
UPDATE public.sessions 
SET original_end_time = end_time 
WHERE original_end_time IS NULL;

UPDATE public.sessions 
SET extended_end_time = end_time 
WHERE extended_end_time IS NULL;

-- Automatically assign the first admin profile as the creator/owner for legacy sessions
UPDATE public.sessions 
SET session_owner_id = (SELECT user_id FROM public.user_roles WHERE role = 'admin' LIMIT 1)
WHERE session_owner_id IS NULL;


-- ============================================================================
-- Migration: Admin/Faculty Authentication Code System
-- ============================================================================

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS authentication_code TEXT UNIQUE;

-- Populate authentication code for existing Admin/Faculty accounts
DO $$
DECLARE
    rec RECORD;
    dept_abbr TEXT;
    name_abbr TEXT;
    random_dig INT;
    new_code TEXT;
    is_unique BOOLEAN;
BEGIN
    FOR rec IN 
        SELECT p.id, p.full_name, p.department 
        FROM public.profiles p
        JOIN public.user_roles u ON p.id = u.user_id
        WHERE u.role = 'admin' AND p.authentication_code IS NULL
    LOOP
        -- Determine department abbreviation
        CASE 
            WHEN rec.department ILIKE '%Computer%' THEN dept_abbr := 'CSE';
            WHEN rec.department ILIKE '%Information%' THEN dept_abbr := 'ISE';
            WHEN rec.department ILIKE '%Electronics%Communication%' THEN dept_abbr := 'ECE';
            WHEN rec.department ILIKE '%Electrical%' THEN dept_abbr := 'EEE';
            WHEN rec.department ILIKE '%Mechanical%' THEN dept_abbr := 'ME';
            WHEN rec.department ILIKE '%Civil%' THEN dept_abbr := 'CIVIL';
            WHEN rec.department ILIKE '%Intelligence%' OR rec.department ILIKE '%AIML%' THEN dept_abbr := 'AIML';
            WHEN rec.department ILIKE '%Biotech%' THEN dept_abbr := 'BT';
            WHEN rec.department ILIKE '%Automobile%' THEN dept_abbr := 'AU';
            WHEN rec.department ILIKE '%Aero%' THEN dept_abbr := 'AE';
            WHEN rec.department ILIKE '%MBA%' THEN dept_abbr := 'MBA';
            ELSE dept_abbr := 'CSE';
        END CASE;

        -- Extract name part (uppercase, a-z only, 3 letters)
        name_abbr := UPPER(REGEXP_REPLACE(rec.full_name, '[^a-zA-Z]', '', 'g'));
        name_abbr := SUBSTRING(name_abbr FROM 1 FOR 3);
        IF LENGTH(name_abbr) < 3 THEN
            name_abbr := name_abbr || RPAD('', 3 - LENGTH(name_abbr), 'X');
        END IF;

        IF name_abbr = '' OR name_abbr IS NULL THEN
            name_abbr := 'ADM';
        END IF;

        is_unique := FALSE;
        WHILE NOT is_unique LOOP
            random_dig := FLOOR(RANDOM() * (999 - 100 + 1) + 100)::INT;
            new_code := dept_abbr || '-' || name_abbr || '-' || random_dig::text;
            
            IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE authentication_code = new_code) THEN
                is_unique := TRUE;
            END IF;
        END LOOP;

        UPDATE public.profiles 
        SET authentication_code = new_code 
        WHERE id = rec.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- Migration: Restrict 'Students can mark their own attendance' Policy To Remove Admin Bypass
-- ============================================================================

DROP POLICY IF EXISTS "Students can mark their own attendance" ON public.attendance;

CREATE POLICY "Students can mark their own attendance" 
ON public.attendance FOR INSERT TO authenticated 
WITH CHECK (auth.uid() = student_id AND (
    SELECT status FROM public.sessions WHERE id = session_id
) = 'live');


-- ============================================================================
-- Migration: Assignment and Multi-Version Submission Support with Deadline Validation
-- ============================================================================

-- 1. Add versioning tracking and update timestamps to assignments
ALTER TABLE public.assignments 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;

ALTER TABLE public.assignments 
ADD COLUMN IF NOT EXISTS last_modified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;


-- 2. Add versioning tracking and update timestamps to assignment submissions
ALTER TABLE public.assignment_submissions 
ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;

ALTER TABLE public.assignment_submissions 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1 NOT NULL;


-- 3. Database Trigger to enforce submission deadline at database level
CREATE OR REPLACE FUNCTION public.check_submission_deadline()
RETURNS TRIGGER AS $
DECLARE
    assign_record RECORD;
BEGIN
    SELECT * INTO assign_record FROM public.assignments WHERE id = NEW.assignment_id;
    IF assign_record IS NULL THEN
        RAISE EXCEPTION 'Assignment not found';
    END IF;
    
    IF timezone('utc'::text, now()) > assign_record.deadline THEN
        RAISE EXCEPTION 'Submission Closed: Deadline has already passed.';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_submission_deadline ON public.assignment_submissions;
CREATE TRIGGER trg_check_submission_deadline
    BEFORE INSERT OR UPDATE ON public.assignment_submissions
    FOR EACH ROW EXECUTE FUNCTION public.check_submission_deadline();


-- ============================================================================
-- Migration: Assignment and Submission Deadline RLS Multi-Version Verification Policies
-- ============================================================================

DROP POLICY IF EXISTS "Only admins can edit assignments" ON public.assignments;
DROP POLICY IF EXISTS "Only admins can insert assignments" ON public.assignments;
DROP POLICY IF EXISTS "Only admins can update assignments before deadline" ON public.assignments;
DROP POLICY IF EXISTS "Only admins can delete assignments" ON public.assignments;

CREATE POLICY "Only admins can insert assignments" 
ON public.assignments FOR INSERT TO authenticated 
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Only admins can update assignments before deadline" 
ON public.assignments FOR UPDATE TO authenticated 
USING (public.is_admin(auth.uid()) AND timezone('utc'::text, now()) <= deadline)
WITH CHECK (public.is_admin(auth.uid()) AND timezone('utc'::text, now()) <= deadline);

CREATE POLICY "Only admins can delete assignments" 
ON public.assignments FOR DELETE TO authenticated 
USING (public.is_admin(auth.uid()));


DROP POLICY IF EXISTS "Only students can write/modify their own submissions" ON public.assignment_submissions;
DROP POLICY IF EXISTS "Only students can write/modify their own submissions before deadline" ON public.assignment_submissions;

CREATE POLICY "Only students can write/modify their own submissions before deadline" 
ON public.assignment_submissions FOR ALL TO authenticated 
USING (
  (auth.uid() = student_id AND (
    SELECT deadline FROM public.assignments WHERE id = assignment_id
  ) >= timezone('utc'::text, now()))
  OR public.is_admin(auth.uid())
)
WITH CHECK (
  (auth.uid() = student_id AND (
    SELECT deadline FROM public.assignments WHERE id = assignment_id
  ) >= timezone('utc'::text, now()))
  OR public.is_admin(auth.uid())
);


-- ============================================================================
-- Migration: Add Scan Audit Columns to Attendance Table
-- ============================================================================

ALTER TABLE public.attendance 
ADD COLUMN IF NOT EXISTS scanning_admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.attendance 
ADD COLUMN IF NOT EXISTS scanning_admin_name TEXT;


-- ============================================================================
-- Migration: Add created_by Column to Assignments Table
-- ============================================================================

ALTER TABLE public.assignments
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.assignments
ADD COLUMN IF NOT EXISTS created_by_user_id UUID;

ALTER TABLE public.assignments
ADD COLUMN IF NOT EXISTS created_by_name TEXT;

ALTER TABLE public.assignments
ADD COLUMN IF NOT EXISTS last_modified_by_name TEXT;


-- ============================================================================
-- Migration: Add 'Suspended' to account_status Check Constraint in Profiles Table
-- ============================================================================

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_account_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_account_status_check CHECK (account_status IN ('Pending', 'Approved', 'Suspended', 'Rejected'));


-- ============================================================================
-- Migration: Add Deadline Extension Audit Columns to Assignments Table
-- ============================================================================

ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS original_deadline TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS extended_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS extended_by_name TEXT;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS extended_at TIMESTAMP WITH TIME ZONE;



-- ============================================================================
-- Migration: Relax Session Update Policy for Admins and Authorized Admins
-- ============================================================================

DROP POLICY IF EXISTS "Only session owners can update or delete sessions" ON public.sessions;
DROP POLICY IF EXISTS "Admins or session owners can update or delete sessions" ON public.sessions;

CREATE POLICY "Admins or session owners can update or delete sessions" 
ON public.sessions FOR ALL TO authenticated 
USING (auth.uid() = session_owner_id OR public.is_admin(auth.uid()) OR auth.uid() = ANY(authorized_admin_ids)) 
WITH CHECK (auth.uid() = session_owner_id OR public.is_admin(auth.uid()) OR auth.uid() = ANY(authorized_admin_ids));


-- ============================================================================
-- Migration: Add Absence Requests System Table, Policies, and Storage Setup
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.absence_requests (
    request_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    student_usn TEXT NOT NULL,
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    session_name TEXT NOT NULL,
    reason TEXT NOT NULL,
    attachment_url TEXT,
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
    admin_remarks TEXT,
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_by_name TEXT,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_absence_requests_student ON public.absence_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_absence_requests_session ON public.absence_requests(session_id);
CREATE INDEX IF NOT EXISTS idx_absence_requests_status ON public.absence_requests(status);

ALTER TABLE public.absence_requests ENABLE ROW LEVEL SECURITY;

-- Students can insert their own requests
DROP POLICY IF EXISTS "Students can insert their own requests" ON public.absence_requests;
CREATE POLICY "Students can insert their own requests"
ON public.absence_requests FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = student_id
);

-- Students can read their own requests
DROP POLICY IF EXISTS "Students can read their own requests" ON public.absence_requests;
CREATE POLICY "Students can read their own requests"
ON public.absence_requests FOR SELECT TO authenticated
USING (
  auth.uid() = student_id
);

-- Admins have full access on absence requests
DROP POLICY IF EXISTS "Admins have full access on absence requests" ON public.absence_requests;
CREATE POLICY "Admins have full access on absence requests"
ON public.absence_requests FOR ALL TO authenticated
USING (
  public.is_admin(auth.uid())
)
WITH CHECK (
  public.is_admin(auth.uid())
);

-- Storage bucket reference mapping for attachments:
-- Suggestion: Create a public storage bucket named 'absence-attachments' in Supabase dashboard.
-- Allow insert objects to authenticated users:
-- CREATE POLICY "Allow authenticated users to upload attachments" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'absence-attachments');
-- CREATE POLICY "Allow anyone to read attachments" ON storage.objects FOR SELECT TO public USING (bucket_id = 'absence-attachments');

-- ============================================================================
-- Migration: Duplicate Prevention & Withdrawal Deletion Control policies
-- ============================================================================

-- 1. Ensure attendance uniqueness per student-session
ALTER TABLE public.attendance 
ADD CONSTRAINT uq_attendance_session_student UNIQUE (session_id, student_id);

-- 2. Ensure absence request uniqueness per student-session
ALTER TABLE public.absence_requests 
ADD CONSTRAINT uq_absence_requests_student_session UNIQUE (student_id, session_id);

-- 3. Policy to let students delete (withdraw) their own pending absence requests from database
DROP POLICY IF EXISTS "Students can delete their own pending requests" ON public.absence_requests;
CREATE POLICY "Students can delete their own pending requests"
ON public.absence_requests FOR DELETE TO authenticated
USING (
  auth.uid() = student_id AND status = 'Pending'
);

-- 4. Policy to let students delete their own uploaded proof documents from storage bucket
DROP POLICY IF EXISTS "Students can delete their own uploaded absence attachments" ON storage.objects;
CREATE POLICY "Students can delete their own uploaded absence attachments"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'absence-attachments' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================================================
-- Migration: Allow All Authenticated Users to View Session Summaries to Count Total Responses
-- ============================================================================
DROP POLICY IF EXISTS "Session summaries can be viewed by admins or the student owner" ON public.session_summaries;
DROP POLICY IF EXISTS "Session summaries can be viewed by authenticated users" ON public.session_summaries;

CREATE POLICY "Session summaries can be viewed by authenticated users" 
ON public.session_summaries FOR SELECT TO authenticated 
USING (true);
