"use client";
import { useEffect, useState, type ReactNode } from "react";

/** Envuelve el contenido de un loading.tsx para que el skeleton SOLO
 * aparezca si la carga real tarda más de `delay` ms. Si la página está
 * lista antes de eso, este componente se desmonta sin haber pintado
 * nada — el usuario nunca ve el esqueleto en cargas rápidas, que es el
 * caso común aquí. Sin este delay, el flash de skeleton en cargas
 * rápidas se siente como un paso extra, más lento que no tener nada. */
export function DelayedFallback({ children, delay = 350 }: { children: ReactNode; delay?: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  if (!show) return null;
  return <>{children}</>;
}
