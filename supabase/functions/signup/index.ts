// Self-serve signup without email confirmation round-trips.
// Creates the auth user pre-confirmed via the service role; the database
// trigger (handle_new_user) decides pending vs active vs bootstrap admin.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const { email, password, full_name, callsign, invite_code } = await req.json();
    const cleanEmail = String(email ?? "").trim().toLowerCase();
    const cleanCallsign = String(callsign ?? "").trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
      return json({ error: "Enter a valid email address." }, 400);
    }
    if (String(password ?? "").length < 8) {
      return json({ error: "Password must be at least 8 characters." }, 400);
    }
    if (cleanCallsign.length < 2 || cleanCallsign.length > 24) {
      return json({ error: "Callsign must be 2-24 characters." }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { error } = await admin.auth.admin.createUser({
      email: cleanEmail,
      password: String(password),
      email_confirm: true,
      user_metadata: {
        full_name: String(full_name ?? "").trim().slice(0, 80),
        callsign: cleanCallsign,
        invite_code: String(invite_code ?? "").trim(),
      },
    });
    if (error) {
      const msg = /already/i.test(error.message)
        ? "An account with that email already exists."
        : error.message;
      return json({ error: msg }, 400);
    }
    return json({ ok: true });
  } catch {
    return json({ error: "Bad request" }, 400);
  }
});
