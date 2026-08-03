import { createClient } from '@supabase/supabase-js';

/** De client is vastgezet op het hitster-schema, niet op het standaard public. */
type HitsterClient = ReturnType<typeof createHitsterClient>;

/**
 * Supabase-client voor de browser.
 *
 * Let op: dit is Vite, geen Next.js — dus geen @supabase/ssr, geen cookies()
 * en geen server components. Variabelen komen uit import.meta.env en moeten
 * met VITE_ beginnen om in de build terecht te komen.
 *
 * De publishable key hoort thuis in de frontend en komt sowieso in de
 * gebundelde JavaScript terecht; geheimhouden heeft geen zin. Wat de data
 * beschermt is Row Level Security in de database, niet deze sleutel. De
 * service_role key hoort hier dus nooit.
 *
 * Alles staat in het schema `hitster`, los van andere projecten in dezelfde
 * Supabase-instantie.
 */

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://ocepvzudvnlkylcblnra.supabase.co';

const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_W7HvrBQ9Sx_zRSEUU1fLjg_enPX3tnZ';

function createHitsterClient() {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    db: { schema: 'hitster' },
    auth: {
      // Spelers loggen niet in; een kamercode is genoeg
      persistSession: false,
      autoRefreshToken: false,
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  });
}

let client: HitsterClient | null = null;

export function getSupabase(): HitsterClient | null {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return null;
  if (!client) client = createHitsterClient();
  return client;
}

export function isSupabaseConfigured(): boolean {
  return !!SUPABASE_URL && !!SUPABASE_PUBLISHABLE_KEY;
}

/** Snelle controle of het schema bereikbaar is en de migratie gedraaid is. */
export async function checkSupabaseReady(): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Supabase is niet geconfigureerd.' };

  const { error } = await sb.from('rooms').select('code').limit(1);
  if (error) {
    // 42P01 = relation does not exist → migratie nog niet gedraaid
    if (error.code === '42P01' || /does not exist|schema must be/i.test(error.message)) {
      return {
        ok: false,
        error: 'De tabellen bestaan nog niet. Draai supabase/migrations/001_hitster.sql in de SQL Editor.',
      };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
