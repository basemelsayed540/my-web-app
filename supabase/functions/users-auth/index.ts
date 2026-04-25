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

async function hashPassword(password: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(String(password || "")));
  const bytes = Array.from(new Uint8Array(digest));
  return `sha256$${bytes.map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

function isHashedPassword(password: string) {
  return String(password || "").startsWith("sha256$");
}

async function verifyPassword(storedPassword: string, candidatePassword: string) {
  if (!storedPassword) return false;
  if (isHashedPassword(storedPassword)) {
    return storedPassword === await hashPassword(candidatePassword);
  }
  return storedPassword === String(candidatePassword || "");
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
  if (!appSessionSecret) {
    throw new Error("APP_SESSION_SECRET is missing.");
  }
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

async function verifySessionToken(token: string) {
  if (!token) throw new Error("جلسة المستخدم غير موجودة.");
  const [encodedPayload, signature] = String(token).split(".");
  if (!encodedPayload || !signature) throw new Error("رمز الجلسة غير صالح.");
  const expectedSignature = await signValue(encodedPayload);
  if (expectedSignature !== signature) throw new Error("تعذر التحقق من رمز الجلسة.");
  const payload = JSON.parse(base64UrlDecode(encodedPayload));
  if (!payload?.uid || !payload?.pwd || !payload?.exp) throw new Error("بيانات الجلسة ناقصة.");
  if (Date.now() > Number(payload.exp)) throw new Error("انتهت صلاحية الجلسة. سجل الدخول مرة أخرى.");

  const { data, error } = await adminClient
    .from("users")
    .select("*")
    .eq("id", payload.uid)
    .maybeSingle();

  if (error) throw new Error(`تعذر التحقق من الجلسة: ${error.message}`);
  if (!data) throw new Error("المستخدم الخاص بهذه الجلسة غير موجود.");
  if (String(data.password || "") !== String(payload.pwd || "")) {
    throw new Error("الجلسة القديمة لم تعد صالحة. سجل الدخول مرة أخرى.");
  }
  if (!data.approved) {
    throw new Error("هذا الحساب غير مفعل الآن.");
  }

  return data;
}

async function findUserByPhone(phone: string) {
  const { data, error } = await adminClient
    .from("users")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();

  if (error) throw new Error(`تعذر قراءة الحساب: ${error.message}`);
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
    const { action, sessionToken, payload = {} } = await req.json();

    switch (action) {
      case "login": {
        const phone = String(payload.phone || "").trim();
        const password = String(payload.password || "");
        if (!phone || !password) {
          return json(400, { error: "رقم الهاتف وكلمة المرور مطلوبان." });
        }

        let user = await findUserByPhone(phone);

        if (phone === "admin" && !user) {
          if (password !== "admin") {
            return json(400, { error: "بيانات الدخول غير صحيحة" });
          }
          const adminPasswordHash = await hashPassword(password);
          const { data: createdAdmin, error: createError } = await adminClient
            .from("users")
            .insert([{
              username: "المدير العام",
              full_name: "المدير العام",
              phone: "admin",
              email: "admin@admin.com",
              password: adminPasswordHash,
              role: "admin",
              approved: true,
            }])
            .select("*")
            .maybeSingle();

          if (createError || !createdAdmin) {
            throw new Error(createError?.message || "فشل إنشاء حساب المدير.");
          }
          user = createdAdmin;
        }

        if (!user || !(await verifyPassword(String(user.password || ""), password))) {
          return json(400, { error: "بيانات الدخول غير صحيحة" });
        }

        if (!isHashedPassword(String(user.password || ""))) {
          const upgradedPassword = await hashPassword(password);
          const { data: upgradedUser, error: upgradeError } = await adminClient
            .from("users")
            .update({ password: upgradedPassword })
            .eq("id", user.id)
            .select("*")
            .maybeSingle();

          if (!upgradeError && upgradedUser) {
            user = upgradedUser;
          } else {
            user.password = upgradedPassword;
          }
        }

        if (!user.approved) {
          return json(403, { error: "حسابك قيد المراجعة من قبل الإدارة. يرجى الانتظار حتى يتم تفعيله." });
        }

        const token = await createSessionToken(user);
        return json(200, { user: sanitizeUser(user), sessionToken: token });
      }

      case "signup": {
        const phone = String(payload.phone || "").trim();
        const username = String(payload.username || "").trim();
        const email = String(payload.email || "").trim() || null;
        const passwordHash = String(payload.passwordHash || "");
        const role = String(payload.role || "").trim();

        if (!phone || !username || !passwordHash || !role) {
          return json(400, { error: "بيانات إنشاء الحساب غير مكتملة." });
        }

        const existingUser = await findUserByPhone(phone);
        if (existingUser) {
          return json(400, { error: "هذا الرقم مسجل مسبقاً." });
        }

        const { data: createdUser, error: createError } = await adminClient
          .from("users")
          .insert([{
            username,
            full_name: username,
            phone,
            email,
            password: passwordHash,
            role,
            approved: false,
          }])
          .select("*")
          .maybeSingle();

        if (createError || !createdUser) {
          throw new Error(createError?.message || "تعذر إنشاء الحساب.");
        }

        return json(200, { user: sanitizeUser(createdUser) });
      }

      case "verify_password": {
        const actor = await verifySessionToken(String(sessionToken || ""));
        const password = String(payload.password || "");
        if (!password) return json(400, { error: "كلمة المرور مطلوبة." });
        const valid = await verifyPassword(String(actor.password || ""), password);
        return json(200, { valid, user: sanitizeUser(actor), sessionToken: await createSessionToken(actor) });
      }

      case "session_user": {
        const actor = await verifySessionToken(String(sessionToken || ""));
        return json(200, { user: sanitizeUser(actor), sessionToken: await createSessionToken(actor) });
      }

      case "change_password": {
        const actor = await verifySessionToken(String(sessionToken || ""));
        const oldPassword = String(payload.oldPassword || "");
        const newPasswordHash = String(payload.newPasswordHash || "");
        if (!oldPassword || !newPasswordHash) {
          return json(400, { error: "البيانات المطلوبة لتغيير كلمة المرور غير مكتملة." });
        }
        if (!(await verifyPassword(String(actor.password || ""), oldPassword))) {
          return json(400, { error: "كلمة المرور الحالية غير صحيحة." });
        }
        const { data: updated, error } = await adminClient
          .from("users")
          .update({ password: newPasswordHash })
          .eq("id", actor.id)
          .select("*")
          .maybeSingle();
        if (error || !updated) {
          throw new Error(error?.message || "فشل تحديث كلمة المرور.");
        }
        return json(200, { user: sanitizeUser(updated), sessionToken: await createSessionToken(updated) });
      }

      default:
        return json(400, { error: "Unknown action." });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown auth error";
    return json(400, { error: message });
  }
});
