import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const appSessionSecret = Deno.env.get("APP_SESSION_SECRET") ?? "";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const encoder = new TextEncoder();

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sanitizeUser(user: Record<string, unknown> | null) {
  if (!user) return null;
  const clone = { ...user };
  delete clone.password;
  return clone;
}

function base64UrlEncode(value: string) {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  return atob(padded);
}

async function signValue(value: string) {
  if (!appSessionSecret) throw new Error("APP_SESSION_SECRET is missing.");
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(appSessionSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  const bytes = Array.from(new Uint8Array(signature));
  return base64UrlEncode(String.fromCharCode(...bytes));
}

async function createSessionToken(user: Record<string, unknown>) {
  const payload = {
    uid: user.id,
    role: user.role,
    pwd: user.password,
    exp: Date.now() + (1000 * 60 * 60 * 12),
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = await signValue(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

async function getActor(actorToken: string) {
  const [encodedPayload, signature] = String(actorToken || "").split(".");
  if (!encodedPayload || !signature) {
    throw new Error("رمز الجلسة غير صالح أو مفقود.");
  }
  const expectedSignature = await signValue(encodedPayload);
  if (expectedSignature !== signature) {
    throw new Error("تعذر التحقق من الجلسة الحالية.");
  }
  const payload = JSON.parse(base64UrlDecode(encodedPayload));
  if (!payload?.uid || !payload?.pwd || !payload?.exp) {
    throw new Error("بيانات الجلسة ناقصة.");
  }
  if (Date.now() > Number(payload.exp)) {
    throw new Error("انتهت صلاحية الجلسة. سجل الدخول مرة أخرى.");
  }

  const { data, error } = await adminClient
    .from("users")
    .select("*")
    .eq("id", payload.uid)
    .maybeSingle();

  if (error) throw new Error(`تعذر التحقق من المنفذ: ${error.message}`);
  if (!data) throw new Error("المستخدم المنفذ غير موجود.");
  if (String(data.password || "") !== String(payload.pwd || "")) {
    throw new Error("الجلسة الحالية لم تعد صالحة. سجل الدخول مرة أخرى.");
  }
  if (!data.approved) {
    throw new Error("هذا الحساب غير مفعل ولا يمكنه تنفيذ تعديلات إدارية.");
  }

  return data;
}

async function getTargetUser(targetUserId: string | number) {
  const { data, error } = await adminClient
    .from("users")
    .select("*")
    .eq("id", targetUserId)
    .maybeSingle();

  if (error) throw new Error(`تعذر جلب الحساب المطلوب: ${error.message}`);
  if (!data) throw new Error("الحساب المطلوب غير موجود.");
  return data;
}

async function updateUser(targetUserId: string | number, patch: Record<string, unknown>) {
  const { data, error } = await adminClient
    .from("users")
    .update(patch)
    .eq("id", targetUserId)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(`فشل تحديث الحساب: ${error.message}`);
  if (!data) throw new Error("لم يتم العثور على الحساب المطلوب للتحديث.");
  return data;
}

async function insertUser(payload: Record<string, unknown>) {
  const { data, error } = await adminClient
    .from("users")
    .insert([payload])
    .select("*")
    .maybeSingle();

  if (error) throw new Error(`فشل إنشاء الحساب: ${error.message}`);
  if (!data) throw new Error("لم يتم إنشاء الحساب.");
  return data;
}

async function deleteUser(targetUserId: string | number) {
  const { data, error } = await adminClient
    .from("users")
    .delete()
    .eq("id", targetUserId)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(`فشل حذف الحساب: ${error.message}`);
  if (!data) throw new Error("لم يتم العثور على الحساب المطلوب للحذف.");
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const { action, actorToken, payload = {} } = await req.json();
    if (!action || !actorToken) {
      return json(400, { error: "Missing action or actorToken." });
    }

    const actor = await getActor(actorToken);

    switch (action) {
      case "admin_toggle_approval": {
        if (actor.role !== "admin") return json(403, { error: "هذه العملية متاحة للمدير فقط." });
        const target = await getTargetUser(payload.targetUserId);
        if (String(target.id) === String(actor.id)) {
          return json(400, { error: "لا يمكنك تعطيل أو تفعيل حسابك من هذه العملية." });
        }
        const updated = await updateUser(target.id, { approved: Boolean(payload.newStatus) });
        return json(200, { user: sanitizeUser(updated), actor: sanitizeUser(actor), sessionToken: await createSessionToken(actor) });
      }

      case "admin_list_users": {
        if (actor.role !== "admin") return json(403, { error: "هذه العملية متاحة للمدير فقط." });
        const { data, error } = await adminClient
          .from("users")
          .select("id, username, full_name, phone, email, role, approved, parent_id")
          .order("id", { ascending: false });
        if (error) throw new Error(`تعذر جلب الحسابات: ${error.message}`);
        return json(200, { users: data || [], actor: sanitizeUser(actor), sessionToken: await createSessionToken(actor) });
      }

      case "admin_change_role": {
        if (actor.role !== "admin") return json(403, { error: "هذه العملية متاحة للمدير فقط." });
        const target = await getTargetUser(payload.targetUserId);
        if (String(target.id) === String(actor.id)) {
          return json(400, { error: "لا يمكنك تغيير صلاحيتك من هذه الشاشة." });
        }
        const updated = await updateUser(target.id, { role: String(payload.newRole || "").trim() });
        return json(200, { user: sanitizeUser(updated), actor: sanitizeUser(actor), sessionToken: await createSessionToken(actor) });
      }

      case "admin_delete_user": {
        if (actor.role !== "admin") return json(403, { error: "هذه العملية متاحة للمدير فقط." });
        const target = await getTargetUser(payload.targetUserId);
        if (String(target.id) === String(actor.id)) {
          return json(400, { error: "لا يمكنك حذف حسابك من هذه الشاشة." });
        }
        const deleted = await deleteUser(target.id);
        return json(200, { user: sanitizeUser(deleted), actor: sanitizeUser(actor), sessionToken: await createSessionToken(actor) });
      }

      case "admin_upsert_user": {
        if (actor.role !== "admin") return json(403, { error: "هذه العملية متاحة للمدير فقط." });
        const nextPayload = {
          username: payload.username,
          full_name: payload.full_name ?? payload.username,
          phone: payload.phone,
          email: payload.email ?? null,
          role: payload.role,
          approved: payload.approved !== false,
          ...(payload.password ? { password: payload.password } : {}),
        };

        if (payload.targetUserId) {
          const target = await getTargetUser(payload.targetUserId);
          if (String(target.id) === String(actor.id) && nextPayload.role !== "admin") {
            return json(400, { error: "لا يمكنك إزالة صلاحية المدير من حسابك الحالي." });
          }
          const updated = await updateUser(target.id, nextPayload);
          return json(200, { user: sanitizeUser(updated), actor: sanitizeUser(actor), sessionToken: await createSessionToken(actor) });
        }

        const created = await insertUser(nextPayload);
        return json(200, { user: sanitizeUser(created), actor: sanitizeUser(actor), sessionToken: await createSessionToken(actor) });
      }

      case "subrep_toggle_approval": {
        if (actor.role !== "sub-rep") return json(403, { error: "هذه العملية متاحة للمندوب المتقدم فقط." });
        const target = await getTargetUser(payload.targetUserId);
        if (String(target.parent_id || "") !== String(actor.id)) {
          return json(403, { error: "لا يمكنك تعديل حساب لا يتبعك." });
        }
        const updated = await updateUser(target.id, { approved: Boolean(payload.newStatus) });
        return json(200, { user: sanitizeUser(updated), actor: sanitizeUser(actor), sessionToken: await createSessionToken(actor) });
      }

      case "subrep_list_users": {
        if (actor.role !== "sub-rep") return json(403, { error: "هذه العملية متاحة للمندوب المتقدم فقط." });
        const { data, error } = await adminClient
          .from("users")
          .select("id, username, full_name, phone, email, role, approved, parent_id")
          .eq("parent_id", actor.id)
          .order("id", { ascending: false });
        if (error) throw new Error(`تعذر جلب الحسابات التابعة: ${error.message}`);
        return json(200, { users: data || [], actor: sanitizeUser(actor), sessionToken: await createSessionToken(actor) });
      }

      case "subrep_delete_user": {
        if (actor.role !== "sub-rep") return json(403, { error: "هذه العملية متاحة للمندوب المتقدم فقط." });
        const target = await getTargetUser(payload.targetUserId);
        if (String(target.parent_id || "") !== String(actor.id)) {
          return json(403, { error: "لا يمكنك حذف حساب لا يتبعك." });
        }
        const deleted = await deleteUser(target.id);
        return json(200, { user: sanitizeUser(deleted), actor: sanitizeUser(actor), sessionToken: await createSessionToken(actor) });
      }

      case "subrep_update_user": {
        if (actor.role !== "sub-rep") return json(403, { error: "هذه العملية متاحة للمندوب المتقدم فقط." });
        const target = await getTargetUser(payload.targetUserId);
        if (String(target.parent_id || "") !== String(actor.id)) {
          return json(403, { error: "لا يمكنك تعديل حساب لا يتبعك." });
        }
        const updated = await updateUser(target.id, {
          username: payload.username,
          full_name: payload.full_name ?? payload.username,
          phone: payload.phone,
          ...(payload.password ? { password: payload.password } : {}),
        });
        return json(200, { user: sanitizeUser(updated), actor: sanitizeUser(actor), sessionToken: await createSessionToken(actor) });
      }

      case "subrep_create_user": {
        if (actor.role !== "sub-rep") return json(403, { error: "هذه العملية متاحة للمندوب المتقدم فقط." });
        const created = await insertUser({
          username: payload.username,
          full_name: payload.full_name ?? payload.username,
          phone: payload.phone,
          password: payload.password,
          email: payload.email ?? `${payload.phone}@delegate.local`,
          role: "rep",
          parent_id: actor.id,
          approved: true,
        });
        return json(200, { user: sanitizeUser(created), actor: sanitizeUser(actor), sessionToken: await createSessionToken(actor) });
      }

      default:
        return json(400, { error: "Unknown action." });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    return json(400, { error: message });
  }
});
