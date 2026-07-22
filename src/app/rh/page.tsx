import { createClient } from "@/lib/supabase/server";
import type { AttendanceRow, Schedule, Vacation } from "@/lib/types";
import type { JornadaState } from "@/lib/hours";
import RHClient from "./client";
import { todayMerida, addDays } from "@/lib/tz";

export default async function RHDashboard() {
  const supabase = await createClient();
  const since = addDays(todayMerida(), -92);
  const [{ data: team }, { data: att }, { data: scheds }, { data: vacs }, { data: hols }, { data: jornadaStates }] = await Promise.all([
    supabase.from("users").select("id, full_name, display_name, nexus_color, avatar_url, birth_date, area, vacation_balance, vacation_days_per_year, hire_date, vacation_balance_reset")
      .eq("active", true).in("role", ["admin", "empleado"]),
    supabase.from("attendance").select("*").gte("date", since).order("date").order("time"),
    supabase.from("schedules").select("*"),
    supabase.from("vacations").select("*, users(full_name, display_name, nexus_color, avatar_url, birth_date)").is("archived_at", null).order("start_date", { ascending: false }),
    supabase.from("holidays").select("date, name"),
    supabase.from("jornada_states").select("*").eq("activo", true),
  ]);
  return (
    <RHClient
      team={(team ?? []) as {
        id: string; full_name: string; display_name: string; nexus_color: string | null; avatar_url: string | null; birth_date: string | null; area: string | null;
        vacation_balance: number; vacation_days_per_year: number; hire_date: string | null; vacation_balance_reset: string | null;
      }[]}
      attendance={(att ?? []) as AttendanceRow[]}
      schedules={(scheds ?? []) as Schedule[]}
      vacations={(vacs ?? []) as unknown as Vacation[]}
      holidays={(hols ?? []) as { date: string; name: string }[]}
      states={(jornadaStates ?? []) as JornadaState[]}
    />
  );
}
