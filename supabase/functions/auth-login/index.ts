// supabase/functions/auth-login/index.ts
// Handles login: validates credentials server-side with bcrypt, returns token.
// Uses service role — never exposes password hashes to the client.

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
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return new Response(
        JSON.stringify({ status: "error", message: "بيانات ناقصة" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Service role client — bypasses RLS entirely, runs only on the server
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch user — explicitly select only what we need (password for compare, then discard)
    const { data: user, error } = await supabase
      .from("users")
      .select("id, username, role, permissions, password, base_salary, vodafone_cash")
      .eq("username", username.trim())
      .single();

    if (error || !user) {
      return new Response(
        JSON.stringify({ status: "error", message: "بيانات خطأ" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // Server-side bcrypt comparison — password hash never leaves the server
    const valid = await bcrypt.compare(password.trim(), user.password);
    if (!valid) {
      return new Response(
        JSON.stringify({ status: "error", message: "بيانات خطأ" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // Generate secure session token
    const token = crypto.randomUUID() + "-" + Date.now();
    await supabase.from("users").update({ token }).eq("id", user.id);

    // Return safe user object — NO password, NO raw token stored in user obj
    return new Response(
      JSON.stringify({
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
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("auth-login error:", e);
    return new Response(
      JSON.stringify({ status: "error", message: "خطأ داخلي" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
