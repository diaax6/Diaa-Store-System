// supabase/functions/auth-save-user/index.ts
// Admin-only: create or update a user record.
// Validates that the caller is an admin before any write.
// Handles password hashing server-side with bcrypt.

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
    const { token, userData } = await req.json();

    if (!token || !userData) {
      return new Response(
        JSON.stringify({ success: false, message: "بيانات ناقصة" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify that the caller is an admin
    const { data: caller, error: callerErr } = await supabase
      .from("users")
      .select("id, role")
      .eq("token", token.trim())
      .single();

    if (callerErr || !caller || caller.role !== "admin") {
      return new Response(
        JSON.stringify({ success: false, message: "غير مصرح — فقط الأدمن يقدر يعمل هذا" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    if (userData.id) {
      // ===== UPDATE existing user =====
      const updates: Record<string, unknown> = {
        username: userData.username,
        role: userData.role || "moderator",
        permissions: userData.permissions || [],
        base_salary: userData.base_salary || 0,
        vodafone_cash: userData.vodafone_cash || "",
      };

      // Only hash & update password if a new one was provided
      if (userData.password && userData.password.trim() !== "") {
        updates.password = await bcrypt.hash(userData.password.trim());
      }

      const { error } = await supabase
        .from("users")
        .update(updates)
        .eq("id", userData.id);

      if (error) {
        console.error("Update user error:", error);
        return new Response(
          JSON.stringify({ success: false, message: "خطأ أثناء التحديث: " + error.message }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
    } else {
      // ===== CREATE new user =====
      if (!userData.password || userData.password.trim() === "") {
        return new Response(
          JSON.stringify({ success: false, message: "كلمة المرور مطلوبة لإنشاء مستخدم جديد" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      const hashedPassword = await bcrypt.hash(userData.password.trim());

      const { error } = await supabase.from("users").insert({
        username: userData.username,
        password: hashedPassword,
        role: userData.role || "moderator",
        permissions: userData.permissions || [],
        base_salary: userData.base_salary || 0,
        vodafone_cash: userData.vodafone_cash || "",
      });

      if (error) {
        console.error("Create user error:", error);
        return new Response(
          JSON.stringify({ success: false, message: "خطأ أثناء الإنشاء: " + error.message }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("auth-save-user error:", e);
    return new Response(
      JSON.stringify({ success: false, message: "خطأ داخلي" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
