"use client";
// ══════════════════════════════════════════════════════════
//  MFA · Reto de sesión — la persona ya dio de alta su
//  autenticador antes; esta pantalla solo confirma que sigue
//  teniéndolo, una vez por sesión (challenge + verify). Incluye
//  la salida de emergencia con código de respaldo si perdió el
//  teléfono (ver /api/mfa/recover).
// ══════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/os/icons";

export default function MfaVerifyClient({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [factorId, setFactorId] = useState("");
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"totp" | "recovery">("totp");
  const [recoveryCode, setRecoveryCode] = useState("");

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data, error: err } = await supabase.auth.mfa.listFactors();
      if (err || !data.totp[0]) { setError("No se encontró tu autenticador. Contacta a un administrador."); setLoading(false); return; }
      setFactorId(data.totp[0].id);
      setLoading(false);
    })();
  }, []);

  const confirm = async () => {
    if (code.trim().length !== 6 || !factorId) return;
    setBusy(true);
    setError("");
    const supabase = createClient();
    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error) { setError("No se pudo verificar — intenta de nuevo."); setBusy(false); return; }
    const verify = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code: code.trim() });
    if (verify.error) { setError("Código incorrecto. Revisa la hora de tu teléfono e intenta de nuevo."); setBusy(false); setCode(""); return; }
    router.push(redirectTo);
    router.refresh();
  };

  const confirmRecovery = async () => {
    if (recoveryCode.trim().length < 4) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/mfa/recover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: recoveryCode.trim() }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(json.error ?? "Código incorrecto."); return; }
    // Sin factor: la siguiente carga entra a /mfa/setup a dar de alta uno nuevo.
    router.push(`/mfa/setup?next=${encodeURIComponent(redirectTo)}`);
    router.refresh();
  };

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <main className="mesh min-h-screen flex items-center justify-center p-5" data-mesh="admin">
      <div className="card relative z-[1] w-full max-w-[400px] p-8">
        <div className="w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center text-white"
          style={{ background: "linear-gradient(150deg,#7B7AFF,#5856D6)", boxShadow: "0 8px 24px rgba(88,86,214,.35)" }}>
          <Icon name="lock" size={26} />
        </div>
        <h1 className="text-[22px] font-bold tracking-tight text-center mb-1">Verifica tu identidad</h1>
        <p className="text-[13.5px] text-center mb-6" style={{ color: "var(--text-2)" }}>
          {mode === "totp" ? "Escribe el código de tu app de autenticación." : "Escribe uno de tus códigos de respaldo."}
        </p>

        {loading ? (
          <p className="text-[13px] text-center" style={{ color: "var(--text-3)" }}>Cargando…</p>
        ) : mode === "totp" ? (
          <div className="flex flex-col gap-4">
            <input
              className="field-input text-center tracking-[0.3em] font-mono text-[18px]"
              inputMode="numeric" maxLength={6} placeholder="000000" autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => e.key === "Enter" && confirm()}
            />
            {error && <p className="text-[12.5px]" style={{ color: "var(--danger)" }}>{error}</p>}
            <button className="btn-primary w-full py-3 text-[14px]" disabled={busy || code.length !== 6 || !factorId} onClick={confirm}>
              {busy ? "Verificando…" : "Entrar"}
            </button>
            <button
              onClick={() => { setMode("recovery"); setError(""); }}
              className="text-[12.5px] font-semibold text-center"
              style={{ color: "var(--accent)" }}
            >
              Perdí mi teléfono — usar código de respaldo
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <input
              className="field-input text-center tracking-[0.15em] font-mono text-[16px] uppercase"
              placeholder="XXXX-XXXX" autoFocus
              value={recoveryCode}
              onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && confirmRecovery()}
            />
            <p className="text-[11.5px]" style={{ color: "var(--text-3)" }}>
              Al usarlo, tu autenticador actual queda desactivado y tendrás que dar de alta uno nuevo.
            </p>
            {error && <p className="text-[12.5px]" style={{ color: "var(--danger)" }}>{error}</p>}
            <button className="btn-primary w-full py-3 text-[14px]" disabled={busy || recoveryCode.trim().length < 4} onClick={confirmRecovery}>
              {busy ? "Verificando…" : "Usar código de respaldo"}
            </button>
            <button
              onClick={() => { setMode("totp"); setError(""); }}
              className="text-[12.5px] font-semibold text-center"
              style={{ color: "var(--text-3)" }}
            >
              Volver a código de autenticador
            </button>
          </div>
        )}

        <button onClick={signOut} className="w-full mt-4 text-[12.5px] font-semibold text-center" style={{ color: "var(--text-3)" }}>
          Cerrar sesión
        </button>
      </div>
    </main>
  );
}
