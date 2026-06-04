// supabase/functions/auth-change-password/index.ts
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
    const { token, oldPassword, newPassword } = await req.json();

    if (!token || !oldPassword || !newPassword) {
      return ok({ success: false, message: "بيانات ناقصة" });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: user, error } = await supabase
      .from("users")
      .select("id, password")
      .eq("token", token.trim())
      .single();

    if (error || !user) {
      return ok({ success: false, message: "جلسة غير صالحة" });
    }

    const valid = bcrypt.compareSync(oldPassword.trim(), user.password);
    if (!valid) {
      return ok({ success: false, message: "كلمة المرور القديمة غلط" });
    }

    const hashedPassword = bcrypt.hashSync(newPassword.trim(), 10);
    const { error: updateError } = await supabase
      .from("users")
      .update({ password: hashedPassword })
      .eq("id", user.id);

    if (updateError) {
      return ok({ success: false, message: "خطأ أثناء التحديث" });
    }

    return ok({ success: true });
  } catch (e) {
    console.error("auth-change-password error:", e);
    return ok({ success: false, message: "خطأ داخلي: " + String(e) });
  }
});
