// supabase/functions/auth-check/index.ts
// Validates a session token. Returns safe user object (no password/token fields).
// Called on every app load to restore session.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { token } = await req.json();

    if (!token || typeof token !== "string" || token.trim() === "") {
      return new Response(JSON.stringify(null), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch user by token — only safe fields, no password
    const { data: user, error } = await supabase
      .from("users")
      .select("id, username, role, permissions, base_salary, vodafone_cash")
      .eq("token", token.trim())
      .single();

    if (error || !user) {
      return new Response(JSON.stringify(null), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(user), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("auth-check error:", e);
    return new Response(JSON.stringify(null), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
