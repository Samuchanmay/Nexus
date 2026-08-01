"use client";
import { useState } from "react";
import { EmetMark } from "@/components/emet-mark";

export default function ContactPage() {
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [mensaje, setMensaje] = useState("");

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    const asunto = encodeURIComponent(`Contacto EMET — ${nombre || "sin nombre"}`);
    const cuerpo = encodeURIComponent(`${mensaje}\n\n—\n${nombre} <${correo}>`);
    window.location.href = `mailto:samuel.chan@cert.edu.mx?subject=${asunto}&body=${cuerpo}`;
  };

  return (
    <main className="mesh min-h-screen p-5 sm:p-10 flex items-center justify-center" data-mesh="admin">
      <div className="relative z-[1] w-full max-w-[520px] py-8">
        <div className="flex items-center gap-3 mb-6 justify-center">
          <EmetMark size={36} />
          <p className="text-[13px] font-semibold" style={{ color: "var(--text-2)" }}>EMET</p>
        </div>

        <div className="card p-6 sm:p-8">
          <h1 className="text-[24px] sm:text-[28px] font-bold tracking-tight mb-1.5 text-center">Contacto</h1>
          <p className="text-[13.5px] mb-7 text-center" style={{ color: "var(--text-2)" }}>
            ¿Preguntas sobre EMET? Escríbenos y te respondemos lo antes posible.
          </p>

          <p className="text-[13px] mb-6 text-center rounded-sm px-4 py-3" style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>
            Correo directo:{" "}
            <a href="mailto:samuel.chan@cert.edu.mx" style={{ color: "var(--accent)" }}>
              samuel.chan@cert.edu.mx
            </a>
          </p>

          <form onSubmit={enviar} className="flex flex-col gap-4">
            <label className="block">
              <span className="block text-[12px] font-semibold mb-1.5" style={{ color: "var(--text-2)" }}>Nombre</span>
              <input
                required value={nombre} onChange={(e) => setNombre(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-sm text-[14px]"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-1)" }}
              />
            </label>
            <label className="block">
              <span className="block text-[12px] font-semibold mb-1.5" style={{ color: "var(--text-2)" }}>Correo</span>
              <input
                required type="email" value={correo} onChange={(e) => setCorreo(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-sm text-[14px]"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-1)" }}
              />
            </label>
            <label className="block">
              <span className="block text-[12px] font-semibold mb-1.5" style={{ color: "var(--text-2)" }}>Mensaje</span>
              <textarea
                required rows={4} value={mensaje} onChange={(e) => setMensaje(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-sm text-[14px] resize-none"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-1)" }}
              />
            </label>
            <button type="submit" className="btn-primary w-full py-3 text-[14.5px] font-semibold">
              Enviar mensaje
            </button>
          </form>

          <p className="text-[11.5px] mt-5 text-center" style={{ color: "var(--text-2)" }}>
            Al enviar, se abrirá tu cliente de correo con el mensaje ya redactado.
          </p>
        </div>
      </div>
    </main>
  );
}
