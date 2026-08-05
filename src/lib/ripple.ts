/**
 * Micro-interacción ripple (FASE 3 del design review de chat).
 *
 * Un solo listener delegado a nivel de documento: cualquier `pointerdown`
 * sobre un elemento (o descendiente de un elemento) con el atributo
 * `data-ripple` — o con cualquiera de las clases de botón del sistema
 * (btn-primary / btn-secondary / btn-tertiary / btn-ok) — siembra una
 * mancha de tinta que se expande y se desvanece con el color del propio
 * botón (currentColor → acento en el CTA, neutro en el resto), sin que
 * cada componente tenga que montar su propio nodo.
 *
 * Se inicializa una sola vez desde AppShell (cubre toda la app, no solo
 * el chat). Los estilos viven en globals.css (.nx-ripple / nx-ripple-grow).
 *
 * Robustez (2026-08-05):
 *  - position:relative solo si el host es estático (no pisa absolute/fixed).
 *  - overflow:hidden solo si hace falta (un host fixed/absolute con
 *    overflow visible no debe recortarse).
 *  - Respeta prefers-reduced-motion (sin animación).
 *  - Solo responde al botón izquierdo del ratón.
 *  - Ignora hosts deshabilitados.
 *  - También responde a Enter/Espacio en hosts de botón (paridad de
 *    accesibilidad con el clic).
 */
let bound = false;

const HOST_SELECTOR = [
  "[data-ripple]",
  ".btn-primary", ".btn-secondary", ".btn-tertiary", ".btn-ok",
].join(", ");

export function initRipple(): void {
  if (bound || typeof window === "undefined") return;
  bound = true;
  document.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    if (!(e.target instanceof Element)) return;
    const host = (e.target as Element).closest(HOST_SELECTOR) as HTMLElement | null;
    if (!host) return;
    if (host.hasAttribute("disabled") || host.getAttribute("aria-disabled") === "true") return;
    spawnRipple(host, e.clientX, e.clientY);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    if (!(e.target instanceof HTMLElement)) return;
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) return;
    const host = e.target.closest(HOST_SELECTOR) as HTMLElement | null;
    if (!host) return;
    if (host.hasAttribute("disabled") || host.getAttribute("aria-disabled") === "true") return;
    const rect = host.getBoundingClientRect();
    spawnRipple(host, rect.left + rect.width / 2, rect.top + rect.height / 2);
  });
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function spawnRipple(host: HTMLElement, clientX: number, clientY: number): void {
  if (prefersReducedMotion()) return;
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
  // Solo la primera vez, y solo si el CSS actual no lo necesita de otra
  // forma: nunca pisar position:absolute/fixed ni un overflow intencional.
  const cs = getComputedStyle(host);
  if (cs.position === "static") host.style.position = "relative";
  if (cs.overflowX === "visible" && cs.overflowY === "visible") host.style.overflow = "hidden";

  host.appendChild(span);
  span.addEventListener("animationend", () => span.remove());
}
