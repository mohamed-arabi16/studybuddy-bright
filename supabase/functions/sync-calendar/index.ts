import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!;
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
const CALENDAR_ENCRYPTION_KEY = Deno.env.get('CALENDAR_ENCRYPTION_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

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

async function encrypt(plaintext: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedText = new TextEncoder().encode(plaintext);
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encodedText
  );
  
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: string } | null> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const data = await response.json();
    
    if (data.error) {
      console.error('Token refresh error:', data);
      return null;
    }

    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + (data.expires_in * 1000)).toISOString(),
    };
  } catch (error) {
    console.error('Failed to refresh token:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const userId = user.id;

    // Get calendar connection
    const supabaseAdmin = createClient(
      SUPABASE_URL,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: connection, error: connError } = await supabaseAdmin
      .from('google_calendar_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (connError || !connection) {
      return new Response(JSON.stringify({ error: 'Calendar not connected' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Decrypt tokens
    let accessToken: string;
    let refreshToken: string;

    try {
      if (connection.encrypted_access_token) {
        accessToken = await decrypt(connection.encrypted_access_token);
        refreshToken = connection.encrypted_refresh_token ? await decrypt(connection.encrypted_refresh_token) : '';
      } else {
        // Fallback to legacy unencrypted tokens
        accessToken = connection.access_token;
        refreshToken = connection.refresh_token;
      }
    } catch (decryptError) {
      console.error('Decryption error:', decryptError);
      return new Response(JSON.stringify({ error: 'Failed to decrypt tokens' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Check if token needs refresh
    const tokenExpiresAt = new Date(connection.token_expires_at);
    if (tokenExpiresAt <= new Date()) {
      console.log('Token expired, refreshing...');
      const refreshed = await refreshAccessToken(refreshToken);
      
      if (!refreshed) {
        // Mark connection as inactive
        await supabaseAdmin
          .from('google_calendar_connections')
          .update({ is_active: false })
          .eq('user_id', userId);
        
        return new Response(JSON.stringify({ error: 'Token refresh failed, please reconnect' }), { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      accessToken = refreshed.accessToken;
      
      // Update encrypted token
      const encryptedNewToken = await encrypt(refreshed.accessToken);
      await supabaseAdmin
        .from('google_calendar_connections')
        .update({ 
          encrypted_access_token: encryptedNewToken,
          token_expires_at: refreshed.expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
    }

    // Fetch study plan items for the next 30 days
    const today = new Date().toISOString().split('T')[0];
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data: planDays } = await supabase
      .from('study_plan_days')
      .select(`
        id,
        date,
        is_day_off,
        study_plan_items (
          id,
          hours,
          is_completed,
          course:courses(title),
          topic:topics(title)
        )
      `)
      .eq('user_id', userId)
      .gte('date', today)
      .lte('date', futureDate)
      .order('date');

    if (!planDays || planDays.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        eventsCreated: 0,
        message: 'No study plan items to sync' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let eventsCreated = 0;

    // Create calendar events for each study day
    for (const day of planDays) {
      if (day.is_day_off) continue;
      
      const items = day.study_plan_items as any[];
      if (!items || items.length === 0) continue;

      for (const item of items) {
        if (item.is_completed) continue;

        const courseName = item.course?.title || 'Study Session';
        const topicName = item.topic?.title || 'General Study';
        const hours = item.hours || 1;

        // Create event at 9 AM (adjustable)
        const startTime = new Date(`${day.date}T09:00:00`);
        const endTime = new Date(startTime.getTime() + hours * 60 * 60 * 1000);

        const event = {
          summary: `📚 ${courseName}: ${topicName}`,
          description: `Study session for ${courseName}\nTopic: ${topicName}\nDuration: ${hours} hour(s)\n\nPowered by StudyBudy`,
          start: {
            dateTime: startTime.toISOString(),
            timeZone: 'UTC',
          },
          end: {
            dateTime: endTime.toISOString(),
            timeZone: 'UTC',
          },
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'popup', minutes: 30 },
            ],
          },
        };

        try {
          const calendarId = connection.calendar_id || 'primary';
          const response = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(event),
            }
          );

          if (response.ok) {
            eventsCreated++;
          } else {
            const errorData = await response.json();
            console.error('Failed to create event:', errorData);
          }
        } catch (eventError) {
          console.error('Event creation error:', eventError);
        }
      }
    }

    // Update last sync time
    await supabaseAdmin
      .from('google_calendar_connections')
      .update({ updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    console.log(`Synced ${eventsCreated} events for user ${userId}`);

    return new Response(JSON.stringify({ 
      success: true, 
      eventsCreated 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in sync-calendar:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
