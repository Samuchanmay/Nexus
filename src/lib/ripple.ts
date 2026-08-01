/**
 * Micro-interacción ripple (FASE 3 del design review de chat).
 *
 * Un solo listener delegado a nivel de documento: cualquier `pointerdown`
 * sobre un elemento (o descendiente de un elemento) con el atributo
 * `data-ripple` siembra una mancha de tinta que se expande y se desvanece
 * con el color del propio botón (currentColor → acento en el CTA, neutro
 * en el resto), sin que cada componente tenga que montar su propio nodo.
 *
 * Se inicializa una sola vez desde AppShell (cubre toda la app, no solo
 * el chat). Los estilos viven en globals.css (.nx-ripple / nx-ripple-grow).
 */
let bound = false;

export function initRipple(): void {
  if (bound || typeof window === "undefined") return;
  bound = true;
  document.addEventListener("pointerdown", (e) => {
    if (!(e.target instanceof Element)) return;
    const host = (e.target as Element).closest("[data-ripple]") as HTMLElement | null;
    if (!host) return;
    spawnRipple(host, e.clientX, e.clientY);
  });
}

function spawnRipple(host: HTMLElement, clientX: number, clientY: number): void {
  const rect = host.getBoundingClientRect();
  // Botón circular → lado completo; botón ancho → diagonal, para que la
  // mancha nunca se quede corta en los extremos.
  const size = Math.max(rect.width, rect.height) * 1.2;
  const span = document.createElement("span");
  span.className = "nx-ripple";
  span.style.width = span.style.height = `${size}px`;
  span.style.left = `${clientX - rect.left - size / 2}px`;
  span.style.top = `${clientY - rect.top - size / 2}px`;
  // El host debe ser relative + overflow hidden para contener la mancha.
  // Solo la primera vez — re-aplicar es idempotente.
  host.style.position = "relative";
  host.style.overflow = "hidden";
  host.appendChild(span);
  span.addEventListener("animationend", () => span.remove());
}
