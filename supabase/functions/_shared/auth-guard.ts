/**
 * P0 SECURITY: Shared Auth Guard for Edge Functions
 * 
 * This module provides:
 * - JWT validation
 * - Disabled user check (zombie session fix)
 * - Optional admin role verification
 * 
 * MUST be used by ALL authenticated edge functions.
 */

import { createClient, User } from 'https://esm.sh/@supabase/supabase-js@2';

export interface AuthResult {
  user: User;
  userId: string;
  isAdmin: boolean;
}

export interface AuthError {
  error: string;
  status: number;
}

export type AuthGuardResult = AuthResult | AuthError;

export function isAuthError(result: AuthGuardResult): result is AuthError {
  return 'error' in result;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Create an error response with CORS headers
 */
export function createAuthErrorResponse(error: AuthError): Response {
  return new Response(
    JSON.stringify({ error: error.error }),
    { 
      status: error.status, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

/**
 * Validates an authenticated request.
 * 
 * Checks:
 * 1. Authorization header present and valid
 * 2. User exists and token is valid
 * 3. User is NOT disabled (profiles.is_disabled)
 * 4. (Optional) User has admin role
 * 
 * @param req - The incoming Request object
 * @param options - Optional settings for the guard
 * @returns AuthResult on success, AuthError on failure
 */
export async function validateAuthenticatedUser(
  req: Request,
  options?: { 
    requireAdmin?: boolean;
    supabaseAdmin?: any; // Accept any Supabase client to avoid version conflicts
  }
): Promise<AuthGuardResult> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  // 1. Validate Authorization header
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'Missing or invalid authorization header', status: 401 };
  }

  const token = authHeader.replace('Bearer ', '');

  // 2. Validate token and get user
  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);

  if (authError || !user) {
    console.log('[auth-guard] Invalid token or user not found:', authError?.message);
    return { error: 'Invalid or expired token', status: 401 };
  }

  // 3. Check if user is disabled (CRITICAL: Zombie session fix)
  const supabaseAdmin = options?.supabaseAdmin || createClient(supabaseUrl, supabaseServiceKey);
  
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('is_disabled')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error('[auth-guard] Error fetching profile:', profileError);
    // Don't block on profile fetch error, but log it
  }

  if (profile?.is_disabled === true) {
    console.log(`[auth-guard] Blocked disabled user: ${user.id}`);
    return { error: 'Account disabled', status: 403 };
  }

  // 4. Check admin role if required
  let isAdmin = false;
  if (options?.requireAdmin) {
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError) {
      console.error('[auth-guard] Error checking admin role:', roleError);
    }

    isAdmin = !!roleData;

    if (!isAdmin) {
      console.log(`[auth-guard] Admin access denied for user: ${user.id}`);
      return { error: 'Admin access required', status: 403 };
    }
  }

  return {
    user,
    userId: user.id,
    isAdmin,
  };
}

/**
 * Quick helper to get user ID from auth header using service role
 * Use this when you need just the user ID for ownership checks
 */
export async function getUserIdFromAuth(authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return null;
  }

  return user.id;
}
