import { createClient } from "@/lib/supabase/server";
import type { Vacation } from "@/lib/types";
import VacAdminClient from "./client";

export default async function VacacionesAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: vacs }, { data: team }, { data: resets }, meRes, { data: calSetting }, { data: authEmailSetting }] = await Promise.all([
    supabase.from("vacations")
      .select("*, users(full_name, display_name, nexus_color)")
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("users").select("id, display_name, vacation_balance, vacation_days_per_year, hire_date, nexus_color, vacation_balance_reset")
      .eq("active", true).in("role", ["admin", "empleado"]),
    supabase.from("vacation_resets").select("user_id, reset_at, days_granted, days_used, days_forfeited")
      .order("reset_at", { ascending: false }),
    user ? supabase.from("users").select("id").eq("auth_id", user.id).single() : Promise.resolve({ data: null }),
    supabase.from("app_settings").select("value").eq("key", "gcal_vacation_calendar_id").maybeSingle(),
    supabase.from("app_settings").select("value").eq("key", "vacation_authorization_email").maybeSingle(),
  ]);

  const lastResetByUser = new Map<string, { reset_at: string; days_granted: number; days_used: number; days_forfeited: number }>();
  for (const r of resets ?? []) {
    if (!lastResetByUser.has(r.user_id)) lastResetByUser.set(r.user_id, r);
  }
  const teamWithReset = (team ?? []).map((t) => ({ ...t, lastReset: lastResetByUser.get(t.id) ?? null }));

  return (
    <VacAdminClient
      vacations={(vacs ?? []) as unknown as Vacation[]}
      team={teamWithReset as {
        id: string; display_name: string; vacation_balance: number; vacation_days_per_year: number; hire_date: string | null; nexus_color: string | null;
        vacation_balance_reset: string | null;
        lastReset: { reset_at: string; days_granted: number; days_used: number; days_forfeited: number } | null;
      }[]}
      adminId={meRes?.data?.id ?? ""}
      vacationCalendarId={calSetting?.value ?? null}
      authorizationEmail={authEmailSetting?.value ?? ""}
    />
  );
}
