import { createClient } from "@/lib/supabase/server";
import type { AttendanceRow, Schedule, Vacation } from "@/lib/types";
import RHClient from "./client";
import { todayMerida, addDays } from "@/lib/tz";

export default async function RHDashboard() {
  const supabase = await createClient();
  const since = addDays(todayMerida(), -92);
  const [{ data: team }, { data: att }, { data: scheds }, { data: vacs }, { data: hols }] = await Promise.all([
    supabase.from("users").select("id, full_name, display_name, nexus_color, area")
      .eq("active", true).in("role", ["admin", "empleado"]),
    supabase.from("attendance").select("*").gte("date", since).order("date").order("time"),
    supabase.from("schedules").select("*").is("valid_until", null),
    supabase.from("vacations").select("*, users(full_name, display_name, nexus_color)").eq("status", "Aprobada"),
    supabase.from("holidays").select("date, name"),
  ]);
  return (
    <RHClient
      team={(team ?? []) as { id: string; full_name: string; display_name: string; nexus_color: string | null; area: string | null }[]}
      attendance={(att ?? []) as AttendanceRow[]}
      schedules={(scheds ?? []) as Schedule[]}
      vacations={(vacs ?? []) as unknown as Vacation[]}
      holidays={(hols ?? []) as { date: string; name: string }[]}
    />
  );
}
