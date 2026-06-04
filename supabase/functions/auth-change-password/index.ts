// supabase/functions/auth-change-password/index.ts
// Changes a user's password after validating the current session token and old password.
// Uses service role + server-side bcrypt. No password hash ever reaches the client.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { token, oldPassword, newPassword } = await req.json();

    if (!token || !oldPassword || !newPassword) {
      return new Response(
        JSON.stringify({ success: false, message: "بيانات ناقصة" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find the user by token — fetch password only for comparison
    const { data: user, error } = await supabase
      .from("users")
      .select("id, password")
      .eq("token", token.trim())
      .single();

    if (error || !user) {
      return new Response(
        JSON.stringify({ success: false, message: "غير مصرح — يرجى تسجيل الدخول مجدداً" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // Verify old password server-side
    const valid = await bcrypt.compare(oldPassword, user.password);
    if (!valid) {
      return new Response(
        JSON.stringify({ success: false, message: "كلمة المرور الحالية غير صحيحة" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // Hash new password server-side and save
    const hashed = await bcrypt.hash(newPassword);
    const { error: updateErr } = await supabase
      .from("users")
      .update({ password: hashed })
      .eq("id", user.id);

    if (updateErr) {
      return new Response(
        JSON.stringify({ success: false, message: "حدث خطأ أثناء التحديث" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "تم تغيير كلمة المرور بنجاح" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("auth-change-password error:", e);
    return new Response(
      JSON.stringify({ success: false, message: "خطأ داخلي" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
