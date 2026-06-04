// supabase/functions/telegram-send/index.ts
// Secure Telegram API proxy — bot token lives in Supabase secrets, never in the browser bundle.
// Validates session token before sending to prevent unauthorized use.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-user-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // ── 1. Validate session ───────────────────────────────────────────────────
    // x-user-token is injected automatically by the supabase client (see src/lib/supabase.js)
    const userToken = req.headers.get("x-user-token") || "";
    if (!userToken) return json({ ok: false, error: "غير مصرح" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("token", userToken.trim())
      .maybeSingle();

    if (!user) return json({ ok: false, error: "غير مصرح" }, 401);

    // ── 2. Validate bot token is configured ──────────────────────────────────
    const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!BOT_TOKEN) {
      console.warn("telegram-send: TELEGRAM_BOT_TOKEN secret not set");
      return json({ ok: false, error: "bot not configured" }, 503);
    }

    // ── 3. Parse request ─────────────────────────────────────────────────────
    const { action, chatId, text, messageId } = await req.json();

    if (!chatId || !action) return json({ ok: false, error: "missing params" }, 400);

    // ── 4. Forward to Telegram API ───────────────────────────────────────────
    let url: string;
    let body: Record<string, unknown>;

    if (action === "send") {
      url  = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
      body = {
        chat_id: String(chatId),
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      };
    } else if (action === "delete") {
      url  = `https://api.telegram.org/bot${BOT_TOKEN}/deleteMessage`;
      body = { chat_id: String(chatId), message_id: messageId };
    } else if (action === "edit") {
      url  = `https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`;
      body = {
        chat_id: String(chatId),
        message_id: messageId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      };
    } else {
      return json({ ok: false, error: "unknown action" }, 400);
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return json(data);

  } catch (e) {
    console.error("telegram-send error:", e);
    return json({ ok: false }, 500);
  }
});
