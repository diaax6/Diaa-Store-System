// supabase/functions/auth-save-user/index.ts
// Uses bcryptjs (pure JS) — works in Supabase Edge Function runtime

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import bcrypt from "https://esm.sh/bcryptjs@2.4.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { token, userData } = await req.json();

    if (!token || !userData) {
      return ok({ success: false, message: "بيانات ناقصة" });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: caller, error: callerErr } = await supabase
      .from("users")
      .select("id, role")
      .eq("token", token.trim())
      .single();

    if (callerErr || !caller || (caller.role !== "admin" && caller.role !== "owner")) {
      return ok({ success: false, message: "غير مصرح — فقط الأدمن يقدر يعمل هذا" });
    }

    if (userData.id) {
      // UPDATE existing user
      const updates: Record<string, unknown> = {
        username: userData.username,
        role: userData.role || "moderator",
        permissions: userData.permissions || [],
        base_salary: userData.base_salary || 0,
        vodafone_cash: userData.vodafone_cash || "",
      };

      if (userData.password && userData.password.trim() !== "") {
        updates.password = bcrypt.hashSync(userData.password.trim(), 10);
      }

      const { error } = await supabase
        .from("users").update(updates).eq("id", userData.id);

      if (error) {
        return ok({ success: false, message: "خطأ أثناء التحديث: " + error.message });
      }
    } else {
      // CREATE new user
      if (!userData.password || userData.password.trim() === "") {
        return ok({ success: false, message: "كلمة المرور مطلوبة لإنشاء مستخدم جديد" });
      }

      const { error } = await supabase.from("users").insert({
        username: userData.username,
        password: bcrypt.hashSync(userData.password.trim(), 10),
        role: userData.role || "moderator",
        permissions: userData.permissions || [],
        base_salary: userData.base_salary || 0,
        vodafone_cash: userData.vodafone_cash || "",
      });

      if (error) {
        return ok({ success: false, message: "خطأ أثناء الإنشاء: " + error.message });
      }
    }

    return ok({ success: true });
  } catch (e) {
    console.error("auth-save-user error:", e);
    return ok({ success: false, message: "خطأ داخلي: " + String(e) });
  }
});
