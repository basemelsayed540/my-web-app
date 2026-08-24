import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decode, verify } from 'https://deno.land/x/djwt@v2.8/mod.ts';

interface ApiRequest {
  method: string;
  params: Record<string, unknown>;
  sessionToken?: string;
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

async function verifyToken(token: string, supabaseUrl: string, anonKey: string) {
  try {
    const { data, error } = await createClient(supabaseUrl, anonKey).auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

async function extractUser(req: Request, supabaseUrl: string, anonKey: string) {
  const auth = req.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '');
  if (!token) return null;
  return await verifyToken(token, supabaseUrl, anonKey);
}

serve(async (req: Request) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const table = Deno.env.get('SHIPMENTS_TABLE') || 'invoices';

  if (!supabaseUrl || !serviceKey) {
    return errorResponse('Server config error: missing credentials', 500);
  }

  const user = await extractUser(req, supabaseUrl, anonKey);
  if (!user) return errorResponse('Unauthorized', 401);

  const serviceClient = createClient(supabaseUrl, serviceKey);
  const body: ApiRequest = await req.json();
  const { method, params } = body;
  const userId = user.id;

  try {
    switch (method) {
      // ===== SHIPMENTS =====
      case 'getShipments': {
        let query = serviceClient.from(table).select('*');
        const filters = params.filters as Record<string, string> | undefined;
        if (filters) {
          Object.entries(filters).forEach(([key, val]) => {
            if (val !== undefined && val !== null && val !== '') {
              query = query.eq(key, val);
            }
          });
        }
        if (params.orderBy) {
          query = query.order(params.orderBy as string, { ascending: params.ascending as boolean ?? false });
        }
        if (params.range) {
          const { from, to } = params.range as { from: number; to: number };
          query = query.range(from, to);
        }
        if (params.limit) {
          query = query.limit(params.limit as number);
        }
        const { data, error } = await query;
        if (error) return errorResponse(error.message, 500);
        return jsonResponse({ data });
      }

      case 'getShipmentsMinimal': {
        const { data, error } = await serviceClient
          .from(table)
          .select(params.select as string || 'id,الحالة,اسم العميل,كود الشحنة')
          .eq(params.filterKey as string, params.filterValue as string);
        if (error) return errorResponse(error.message, 500);
        return jsonResponse({ data });
      }

      case 'updateShipment': {
        const { id, payload } = params as { id: string | number; payload: Record<string, unknown> };
        const { data, error } = await serviceClient.from(table).update(payload).eq('id', id);
        if (error) return errorResponse(error.message, 500);
        if (params.returnData) {
          const { data: updated } = await serviceClient.from(table).select('*').eq('id', id).single();
          return jsonResponse({ data: updated });
        }
        return jsonResponse({ success: true });
      }

      case 'bulkUpdateShipments': {
        const { ids, payload } = params as { ids: (string | number)[]; payload: Record<string, unknown> };
        const { data, error } = await serviceClient.from(table).update(payload).in('id', ids);
        if (error) return errorResponse(error.message, 500);
        return jsonResponse({ data, success: true });
      }

      case 'deleteShipments': {
        const { ids } = params as { ids: (string | number)[] };
        const { data, error } = await serviceClient.from(table).delete().in('id', ids);
        if (error) return errorResponse(error.message, 500);
        return jsonResponse({ data, success: true });
      }

      case 'upsertShipments': {
        const { payloads, onConflict } = params as { payloads: Record<string, unknown>[]; onConflict?: string };
        const upsertOpts = onConflict ? { onConflict } : {};
        const { data, error } = await serviceClient.from(table).upsert(payloads, upsertOpts);
        if (error) return errorResponse(error.message, 500);
        return jsonResponse({ data, success: true });
      }

      // ===== USERS =====
      case 'listUsers': {
        const { data, error } = await serviceClient.from('users').select('*').order('id', { ascending: false });
        if (error) return errorResponse(error.message, 500);
        return jsonResponse({ users: data });
      }

      case 'updateUser': {
        const { id, payload } = params as { id: string | number; payload: Record<string, unknown> };
        const { data, error } = await serviceClient.from('users').update(payload).eq('id', id).select().single();
        if (error) return errorResponse(error.message, 500);
        return jsonResponse({ user: data });
      }

      case 'deleteUser': {
        const { id } = params as { id: string | number };
        const { data, error } = await serviceClient.from('users').delete().eq('id', id).select().single();
        if (error) return errorResponse(error.message, 500);
        return jsonResponse({ user: data });
      }

      case 'createUser': {
        const { payload } = params as { payload: Record<string, unknown> };
        const { data, error } = await serviceClient.from('users').insert([payload]).select().single();
        if (error) return errorResponse(error.message, 500);
        return jsonResponse({ user: data });
      }

      case 'getUsersByParent': {
        const { parentId } = params as { parentId: string | number };
        const { data, error } = await serviceClient.from('users').select('*').eq('parent_id', parentId).order('id', { ascending: false });
        if (error) return errorResponse(error.message, 500);
        return jsonResponse({ users: data });
      }

      // ===== REP LOCATIONS =====
      case 'getRepLocations': {
        const { data, error } = await serviceClient.from('rep_locations').select('*').order('timestamp', { ascending: false });
        if (error) return errorResponse(error.message, 500);
        return jsonResponse({ data });
      }

      // ===== SHIPMENT STATS =====
      case 'getShipmentStats': {
        const { repName } = params as { repName?: string };
        let q = serviceClient.from(table).select('المبلغ,الحالة,السعر بعد التعديل');
        if (repName) q = q.eq('المندوب', repName);
        const { data, error } = await q;
        if (error) return errorResponse(error.message, 500);
        return jsonResponse({ data });
      }

      default:
        return errorResponse(`Unknown method: ${method}`, 400);
    }
  } catch (err) {
    console.error('Edge function error:', err);
    return errorResponse(err instanceof Error ? err.message : 'Internal error', 500);
  }
});
