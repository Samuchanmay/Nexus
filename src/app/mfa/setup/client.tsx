"use client";
// ══════════════════════════════════════════════════════════
//  MFA · Alta de autenticador (TOTP) — obligatoria para Admin/RH
//  (ver middleware.ts). Flujo oficial de Supabase Auth: enroll()
//  entrega QR + secreto → challenge()+verify() confirman que la
//  persona sí lo dio de alta en su app antes de activarlo.
//  Al terminar, se generan 8 códigos de respaldo de un solo uso
//  (nx_mfa_generate_recovery_codes) — la única forma de recuperar
//  el acceso si pierde el teléfono, ya que nada puede forzar la
//  sesión a aal2 salvo el propio reto de Supabase Auth.
// ══════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/os/icons";

export default function MfaSetupClient({ displayName, redirectTo }: { displayName: string; redirectTo: string }) {
  const router = useRouter();
  const [factorId, setFactorId] = useState("");
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data, error: err } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Emet — ${displayName}`,
      });
      if (err) { setError("No se pudo iniciar el alta. Intenta de nuevo en unos minutos."); setLoading(false); return; }
      setFactorId(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirm = async () => {
    if (code.trim().length !== 6) return;
    setBusy(true);
    setError("");
    const supabase = createClient();
    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error) { setError("No se pudo verificar — intenta de nuevo."); setBusy(false); return; }
    const verify = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code: code.trim() });
    if (verify.error) { setError("Código incorrecto. Revisa la hora de tu teléfono e intenta de nuevo."); setBusy(false); return; }

    const { data: codes } = await supabase.rpc("nx_mfa_generate_recovery_codes");
    setBusy(false);
    if (codes && codes.length > 0) { setRecoveryCodes(codes as string[]); return; }
    router.push(redirectTo);
    router.refresh();
  };

  const finish = () => {
    router.push(redirectTo);
    router.refresh();
  };

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (recoveryCodes) {
    return (
      <main className="mesh min-h-screen flex items-center justify-center p-5" data-mesh="admin">
        <div className="card relative z-[1] w-full max-w-[440px] p-8">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center text-white"
            style={{ background: "linear-gradient(150deg,#34C759,#28A745)", boxShadow: "0 8px 24px rgba(52,199,89,.35)" }}>
            <Icon name="check" size={26} />
          </div>
          <h1 className="text-[22px] font-bold tracking-tight text-center mb-1">Verificación activada</h1>
          <p className="text-[13.5px] text-center mb-5" style={{ color: "var(--text-2)" }}>
            Guarda estos 8 códigos de respaldo en un lugar seguro. Cada uno funciona una sola vez si
            alguna vez pierdes tu teléfono — es la única forma de recuperar tu cuenta.
          </p>
          <div className="grid grid-cols-2 gap-2 p-4 rounded-xl font-mono text-[13.5px]" style={{ background: "var(--surface-2)" }}>
            {recoveryCodes.map((c) => <span key={c}>{c}</span>)}
          </div>
          <button className="btn-primary w-full py-3 text-[14px] mt-5" onClick={finish}>
            Ya los guardé — continuar
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mesh min-h-screen flex items-center justify-center p-5" data-mesh="admin">
      <div className="card relative z-[1] w-full max-w-[440px] p-8">
        <div className="w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center text-white"
          style={{ background: "linear-gradient(150deg,#7B7AFF,#5856D6)", boxShadow: "0 8px 24px rgba(88,86,214,.35)" }}>
          <Icon name="lock" size={26} />
        </div>
        <h1 className="text-[22px] font-bold tracking-tight text-center mb-1">Protege tu cuenta</h1>
        <p className="text-[13.5px] text-center mb-6" style={{ color: "var(--text-2)" }}>
          Tu rol tiene acceso a información sensible del equipo — Emet requiere un segundo paso de verificación.
        </p>

        {loading ? (
          <p className="text-[13px] text-center" style={{ color: "var(--text-3)" }}>Preparando…</p>
        ) : error && !qr ? (
          <p className="text-[13px] text-center" style={{ color: "var(--danger)" }}>{error}</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-[12px] font-semibold mb-2" style={{ color: "var(--text-2)" }}>
                1. Escanea este código con Google Authenticator, Authy o similar
              </p>
              <div className="flex justify-center p-3 rounded-xl" style={{ background: "#fff" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {qr && <img src={qr} alt="Código QR para autenticador" width={176} height={176} />}
              </div>
              <p className="text-[11px] text-center mt-2 break-all" style={{ color: "var(--text-3)" }}>
                ¿No puedes escanear? Escribe este código manualmente: <span className="font-mono">{secret}</span>
              </p>
            </div>

            <div>
              <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>
                2. Escribe el código de 6 dígitos que te dio la app
              </label>
              <input
                className="field-input text-center tracking-[0.3em] font-mono text-[18px]"
                inputMode="numeric" maxLength={6} placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => e.key === "Enter" && confirm()}
              />
            </div>

            {error && <p className="text-[12.5px]" style={{ color: "var(--danger)" }}>{error}</p>}

            <button className="btn-primary w-full py-3 text-[14px]" disabled={busy || code.length !== 6} onClick={confirm}>
              {busy ? "Verificando…" : "Activar verificación"}
            </button>
          </div>
        )}

        <button onClick={signOut} className="w-full mt-4 text-[12.5px] font-semibold text-center" style={{ color: "var(--text-3)" }}>
          Cerrar sesión — no tengo mi teléfono ahora
        </button>
      </div>
    </main>
  );
}
