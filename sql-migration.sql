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
