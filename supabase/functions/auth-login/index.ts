// supabase/functions/auth-login/index.ts
// Uses bcryptjs (pure JS) instead of deno.land/x/bcrypt which requires Deno.run

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
    const { username, password } = await req.json();

    if (!username || !password) {
      return ok({ status: "error", message: "بيانات ناقصة" });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: user, error } = await supabase
      .from("users")
      .select("id, username, role, permissions, password, base_salary, vodafone_cash")
      .eq("username", username.trim())
      .single();

    if (error || !user) {
      return ok({ status: "error", message: "بيانات خطأ" });
    }

    const valid = bcrypt.compareSync(password.trim(), user.password);
    if (!valid) {
      return ok({ status: "error", message: "بيانات خطأ" });
    }

    const token = crypto.randomUUID() + "-" + Date.now();
    await supabase.from("users").update({ token }).eq("id", user.id);

    return ok({
      status: "success",
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        permissions: user.permissions || [],
        base_salary: user.base_salary,
        vodafone_cash: user.vodafone_cash,
      },
    });
  } catch (e) {
    console.error("auth-login error:", e);
    return ok({ status: "error", message: "خطأ داخلي: " + String(e) });
  }
});
