import { createClient } from "@/lib/supabase/server";
import type { CommRequest, UserProfile, ActivityType } from "@/lib/types";
import { isBirthdayToday, todayISO } from "@/lib/birthday";
import type { ContextHeaderInput } from "@/lib/context-header";
import CoordinadorClient from "./client";

export default async function Coordinador() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users").select("*, departments(id, nombre, tipo)").eq("auth_id", user!.id).single();
  const [{ data: reqs }, { data: actTypes }] = await Promise.all([
    supabase.from("requests").select("*, projects(status)").eq("requester_id", profile!.id)
      .order("created_at", { ascending: false }),
    supabase.from("activity_types").select("*").eq("activo", true).order("orden"),
  ]);

  // Señales reales para el motor de saludo/subtítulo (FASE H/G) — mismo
  // catálogo que admin/empleado, adaptado: el coordinador no ficha ni tiene
  // vacaciones administradas aquí, así que esos campos van neutros.
  const now = new Date();
  const hourStr = now.toLocaleTimeString("es-MX", { hour: "2-digit", hour12: false, timeZone: "America/Merida" });
  const dow = new Date(todayISO() + "T12:00:00").getDay();
  const pendingCount = (reqs ?? []).filter((r) => r.status === "solicitada").length;
  const contextInput: ContextHeaderInput = {
    role: "coordinador",
    name: (profile!.display_name as string).split(" ")[0],
    hour: Number(hourStr),
    dow,
    todayISO: todayISO(),
    isBirthdayToday: isBirthdayToday(profile!.birth_date ?? null, todayISO()),
    vacation: { today: false, soonDays: null, returnedRecently: false },
    pendingCount,
    teamAllIn: null,
    othersBirthdayToday: [],
    allDone: pendingCount === 0,
    isHoliday: false,
  };

  return (
    <CoordinadorClient
      profile={profile as UserProfile}
      requests={(reqs ?? []) as unknown as CommRequest[]}
      activityTypes={(actTypes ?? []) as ActivityType[]}
      contextInput={contextInput}
    />
  );
}
