"use client";
// EMET · AutoRefresh
// Refresca el Server Component al volver a la pestaña (visibilitychange/focus).
// Sin infra realtime: cuando una corrección se aplica en otra pestaña (admin)
// y el empleado regresa aquí, los datos del servidor se vuelven a pedir y el
// historial nunca queda con una hora vieja.
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function AutoRefresh() {
  const router = useRouter();
  const hid = useRef<number | undefined>(undefined);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      if (hid.current) window.clearTimeout(hid.current);
      hid.current = window.setTimeout(() => router.refresh(), 150);
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      if (hid.current) window.clearTimeout(hid.current);
    };
  }, [router]);

  return null;
}
