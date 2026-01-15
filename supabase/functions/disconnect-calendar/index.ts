import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validateAuthenticatedUser, isAuthError, createAuthErrorResponse } from "../_shared/auth-guard.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CALENDAR_ENCRYPTION_KEY = Deno.env.get('CALENDAR_ENCRYPTION_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;

// AES-256-GCM decryption
async function getEncryptionKey(): Promise<CryptoKey> {
  const keyData = new TextEncoder().encode(CALENDAR_ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

async function decrypt(encryptedData: string): Promise<string> {
  const key = await getEncryptionKey();
  const combined = new Uint8Array(atob(encryptedData).split('').map(c => c.charCodeAt(0)));
  
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  
  return new TextDecoder().decode(decrypted);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      SUPABASE_URL,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ============= P0: AUTH GUARD (Zombie Session Fix) =============
    const authResult = await validateAuthenticatedUser(req, { supabaseAdmin });
    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }
    const userId = authResult.userId;

    // Get current connection to revoke token
    const { data: connection } = await supabaseAdmin
      .from('google_calendar_connections')
      .select('encrypted_access_token, access_token')
      .eq('user_id', userId)
      .single();

    if (connection) {
      // Try to revoke the token with Google
      try {
        let accessToken: string;
        if (connection.encrypted_access_token) {
          accessToken = await decrypt(connection.encrypted_access_token);
        } else {
          accessToken = connection.access_token;
        }

        await fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        console.log('Token revoked successfully');
      } catch (revokeError) {
        console.warn('Token revocation failed (non-critical):', revokeError);
      }
    }

    // Delete the connection record
    const { error: deleteError } = await supabaseAdmin
      .from('google_calendar_connections')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Delete error:', deleteError);
      return new Response(JSON.stringify({ error: 'Failed to disconnect' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log(`Calendar disconnected for user ${userId}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in disconnect-calendar:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
