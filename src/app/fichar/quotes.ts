// ══════════════════════════════════════════════════════════
//  NEXUS · Frase del día — Registro de Jornada
//  · Misma frase todo el día, para TODOS (función pura de la
//    fecha — cero llamadas extra a la DB, cero parpadeos).
//  · Selección por "momento" (inicio/durante/cierre/finalizada)
//    para que el tema tenga sentido con lo que está pasando.
//  · Sin repetir hasta agotar la colección de ese momento: se
//    recorre por índice determinista (día del año + un offset
//    fijo por momento, para que las 4 categorías no avancen en
//    "paralelo" mostrando siempre la frase #1 el mismo día).
//  · Fechas especiales sobreescriben lo anterior.
//  · categoria queda preparada para que, más adelante, cada
//    organización pueda elegir qué categorías mostrar (no
//    implementado todavía — solo la arquitectura, a propósito).
// ══════════════════════════════════════════════════════════
export type QuoteCategoria =
  | "Inspiración" | "Trabajo en equipo" | "Liderazgo" | "Servicio" | "Gratitud"
  | "Perseverancia" | "Organización" | "Descanso" | "Aprendizaje" | "Fe" | "Reflexión";

export interface Quote { texto: string; autor: string; categoria: QuoteCategoria }

// ── Inicio (primer registro del día: propósito, motivación, comenzar bien) ──
export const QUOTES_INICIO: Quote[] = [
  { texto: "El éxito no es la clave de la felicidad. La felicidad es la clave del éxito.", autor: "Albert Schweitzer", categoria: "Inspiración" },
  { texto: "Cada mañana tenemos dos opciones: seguir durmiendo con tus sueños, o levantarte y perseguirlos.", autor: "Anónimo", categoria: "Inspiración" },
  { texto: "El trabajo duro supera al talento cuando el talento no trabaja duro.", autor: "Tim Notke", categoria: "Perseverancia" },
  { texto: "No cuentes los días, haz que los días cuenten.", autor: "Muhammad Ali", categoria: "Inspiración" },
  { texto: "La única forma de hacer un gran trabajo es amar lo que haces.", autor: "Steve Jobs", categoria: "Inspiración" },
  { texto: "El secreto para salir adelante es empezar.", autor: "Mark Twain", categoria: "Inspiración" },
  { texto: "Cree que puedes y ya estás a mitad del camino.", autor: "Theodore Roosevelt", categoria: "Inspiración" },
  { texto: "Todo parece imposible hasta que se hace.", autor: "Nelson Mandela", categoria: "Perseverancia" },
  { texto: "El esfuerzo de hoy es el éxito de mañana.", autor: "Anónimo", categoria: "Perseverancia" },
  { texto: "Sé el cambio que deseas ver en el mundo.", autor: "Mahatma Gandhi", categoria: "Liderazgo" },
  { texto: "No te rindas. El comienzo siempre es lo más difícil.", autor: "Anónimo", categoria: "Perseverancia" },
  { texto: "Una meta sin un plan es solo un deseo.", autor: "Antoine de Saint-Exupéry", categoria: "Organización" },
  { texto: "Haz hoy lo que otros no harán y mañana tendrás lo que otros no tienen.", autor: "Jerry Rice", categoria: "Perseverancia" },
  { texto: "La disciplina es el puente entre metas y logros.", autor: "Jim Rohn", categoria: "Organización" },
  { texto: "Pequeños progresos diarios llevan a grandes resultados.", autor: "Satya Nadella", categoria: "Perseverancia" },
  { texto: "Tu actitud determina tu dirección.", autor: "Anónimo", categoria: "Inspiración" },
  { texto: "Cada día es una nueva oportunidad para cambiar tu vida.", autor: "Anónimo", categoria: "Inspiración" },
  { texto: "El éxito es la suma de pequeños esfuerzos repetidos día tras día.", autor: "Robert Collier", categoria: "Perseverancia" },
  { texto: "No esperes el momento perfecto, toma el momento y hazlo perfecto.", autor: "Zoey Sayward", categoria: "Inspiración" },
  { texto: "Empieza donde estás, usa lo que tienes, haz lo que puedas.", autor: "Arthur Ashe", categoria: "Inspiración" },
  { texto: "Trabaja duro en silencio. Deja que tu éxito haga el ruido.", autor: "Frank Ocean", categoria: "Perseverancia" },
  { texto: "Cada experto fue una vez un principiante.", autor: "Helen Hayes", categoria: "Aprendizaje" },
  { texto: "El mejor momento para plantar un árbol fue hace 20 años. El segundo mejor momento es ahora.", autor: "Proverbio chino", categoria: "Inspiración" },
  { texto: "La vida es 10% lo que te pasa y 90% cómo reaccionas.", autor: "Charles R. Swindoll", categoria: "Reflexión" },
  { texto: "No tienes que ser brillante para empezar, pero tienes que empezar para ser brillante.", autor: "Zig Ziglar", categoria: "Inspiración" },
  { texto: "Grandes logros requieren grandes riesgos.", autor: "Heráclito", categoria: "Inspiración" },
  { texto: "Un nuevo día es una página en blanco. Escribe algo bueno en ella.", autor: "Anónimo", categoria: "Inspiración" },
  { texto: "La mañana sabe más que la noche.", autor: "Proverbio ruso", categoria: "Reflexión" },
  { texto: "Levántate, sacúdete y vuelve a intentarlo.", autor: "Aaliyah", categoria: "Perseverancia" },
  { texto: "El propósito de la vida es una vida con propósito.", autor: "Robin Sharma", categoria: "Reflexión" },
  { texto: "Todo lo que hagan, háganlo de corazón.", autor: "Anónimo", categoria: "Fe" },
  { texto: "Hoy es un buen día para empezar bien.", autor: "Anónimo", categoria: "Inspiración" },
  { texto: "No se trata de tener tiempo, se trata de hacer tiempo.", autor: "Anónimo", categoria: "Organización" },
  { texto: "Enfócate en el progreso, no en la perfección.", autor: "Anónimo", categoria: "Aprendizaje" },
  { texto: "La actitud con la que empiezas el día casi siempre define cómo lo terminas.", autor: "Anónimo", categoria: "Reflexión" },
  { texto: "El orden es la base de la libertad.", autor: "Anónimo", categoria: "Organización" },
  { texto: "Un buen comienzo vale la mitad del trabajo.", autor: "Proverbio", categoria: "Organización" },
  { texto: "Camina con propósito, no con prisa.", autor: "Anónimo", categoria: "Reflexión" },
  { texto: "Da gracias por un día más para intentarlo de nuevo.", autor: "Anónimo", categoria: "Gratitud" },
  { texto: "Confía en el proceso. Cada día suma.", autor: "Anónimo", categoria: "Perseverancia" },
];

// ── Durante (mientras trabaja: equipo, servicio, aprendizaje) ──
export const QUOTES_DURANTE: Quote[] = [
  { texto: "El talento gana partidos, pero el trabajo en equipo gana campeonatos.", autor: "Michael Jordan", categoria: "Trabajo en equipo" },
  { texto: "Solos vamos más rápido, juntos llegamos más lejos.", autor: "Proverbio africano", categoria: "Trabajo en equipo" },
  { texto: "Ninguno de nosotros es tan bueno como todos nosotros juntos.", autor: "Ray Kroc", categoria: "Trabajo en equipo" },
  { texto: "La calidad nunca es un accidente; siempre es el resultado de un esfuerzo inteligente.", autor: "John Ruskin", categoria: "Aprendizaje" },
  { texto: "Servir a los demás es la renta que pagamos por el espacio que ocupamos en este mundo.", autor: "Muhammad Ali", categoria: "Servicio" },
  { texto: "No hay acto de bondad, por pequeño que sea, que se desperdicie.", autor: "Esopo", categoria: "Servicio" },
  { texto: "El buen liderazgo consiste en repartir la responsabilidad, no la culpa.", autor: "Anónimo", categoria: "Liderazgo" },
  { texto: "Un líder es alguien que sabe el camino, sigue el camino y muestra el camino.", autor: "John C. Maxwell", categoria: "Liderazgo" },
  { texto: "La comunicación clara evita el 90% de los problemas de un equipo.", autor: "Anónimo", categoria: "Trabajo en equipo" },
  { texto: "Ordena tu espacio y tu mente seguirá el mismo camino.", autor: "Anónimo", categoria: "Organización" },
  { texto: "Cada tarea bien hecha, por pequeña que sea, construye confianza.", autor: "Anónimo", categoria: "Perseverancia" },
  { texto: "Aprende algo nuevo cada día, aunque sea pequeño.", autor: "Anónimo", categoria: "Aprendizaje" },
  { texto: "El detalle no es un detalle: es lo que hace el diseño.", autor: "Charles Eames", categoria: "Aprendizaje" },
  { texto: "La paciencia es también una forma de acción.", autor: "Auguste Rodin", categoria: "Perseverancia" },
  { texto: "El respeto se construye en los momentos pequeños, no solo en los grandes.", autor: "Anónimo", categoria: "Liderazgo" },
  { texto: "Ayudar a alguien hoy no cuesta nada y vale mucho.", autor: "Anónimo", categoria: "Servicio" },
  { texto: "Un equipo que se escucha, se corrige a tiempo.", autor: "Anónimo", categoria: "Trabajo en equipo" },
  { texto: "La excelencia no es un acto, es un hábito.", autor: "Aristóteles", categoria: "Perseverancia" },
  { texto: "Haz cada trabajo como si fuera para ti mismo.", autor: "Anónimo", categoria: "Servicio" },
  { texto: "Ordenar antes de actuar ahorra el doble de tiempo después.", autor: "Anónimo", categoria: "Organización" },
  { texto: "Nadie recuerda cuánto corriste, sino qué tan bien terminaste.", autor: "Anónimo", categoria: "Perseverancia" },
  { texto: "Escuchar es el primer paso para servir bien.", autor: "Anónimo", categoria: "Servicio" },
  { texto: "El buen trabajo en equipo empieza por confiar en la parte que no ves.", autor: "Anónimo", categoria: "Trabajo en equipo" },
  { texto: "Todo lo que hagas, hazlo con excelencia, como para un propósito mayor.", autor: "Anónimo", categoria: "Fe" },
  { texto: "Una pausa breve y bien tomada rinde más que una hora sin enfoque.", autor: "Anónimo", categoria: "Organización" },
  { texto: "El progreso, no la perfección, es lo que mueve al equipo hacia adelante.", autor: "Anónimo", categoria: "Perseverancia" },
  { texto: "Cuida los detalles pequeños; ahí vive la reputación del equipo.", autor: "Anónimo", categoria: "Trabajo en equipo" },
  { texto: "La mejor manera de aprender algo es enseñárselo a alguien más.", autor: "Anónimo", categoria: "Aprendizaje" },
  { texto: "Un problema compartido a tiempo es un problema resuelto a tiempo.", autor: "Anónimo", categoria: "Trabajo en equipo" },
  { texto: "La organización de hoy es la tranquilidad de mañana.", autor: "Anónimo", categoria: "Organización" },
  { texto: "El buen servicio se nota más en lo que no se ve.", autor: "Anónimo", categoria: "Servicio" },
  { texto: "Cada compañero que ayudas hoy, te ayuda a ti sin saberlo mañana.", autor: "Anónimo", categoria: "Trabajo en equipo" },
  { texto: "La calma resuelve más pendientes que la prisa.", autor: "Anónimo", categoria: "Organización" },
  { texto: "Un buen equipo se reconoce por cómo trata los errores, no solo los aciertos.", autor: "Anónimo", categoria: "Liderazgo" },
  { texto: "Lo que haces con dedicación, aunque sea pequeño, siempre se nota.", autor: "Anónimo", categoria: "Perseverancia" },
];

// ── Cierre (cuando la acción sugerida es Finalizar jornada: descanso, equilibrio) ──
export const QUOTES_CIERRE: Quote[] = [
  { texto: "Al final del día puedes estar satisfecho de lo que lograste hoy.", autor: "Anónimo", categoria: "Gratitud" },
  { texto: "El descanso no es ociosidad. Es necesario para que la mente y el cuerpo recarguen fuerzas.", autor: "John Lubbock", categoria: "Descanso" },
  { texto: "Cuídate bien. Eres la única persona que cargará tu cuerpo toda la vida.", autor: "Anónimo", categoria: "Descanso" },
  { texto: "La familia es lo más importante. Disfruta cada momento con ellos.", autor: "Anónimo", categoria: "Reflexión" },
  { texto: "Un buen descanso es parte del trabajo bien hecho.", autor: "Anónimo", categoria: "Descanso" },
  { texto: "El equilibrio entre trabajo y vida personal no es un lujo, es una necesidad.", autor: "Anónimo", categoria: "Descanso" },
  { texto: "Termina el día con gratitud. Siempre hubo algo bueno en él.", autor: "Zig Ziglar", categoria: "Gratitud" },
  { texto: "Recarga energías. Mañana es otro día lleno de posibilidades.", autor: "Anónimo", categoria: "Descanso" },
  { texto: "Hoy diste lo mejor de ti. Eso siempre es suficiente.", autor: "Anónimo", categoria: "Gratitud" },
  { texto: "El descanso y la alegría son el combustible del mañana.", autor: "Anónimo", categoria: "Descanso" },
  { texto: "Lo que hagas hoy puede mejorar todos tus mañanas.", autor: "Ralph Marston", categoria: "Reflexión" },
  { texto: "Cuida tu cuerpo. Es el único lugar que tienes para vivir.", autor: "Jim Rohn", categoria: "Descanso" },
  { texto: "La felicidad no se encuentra al final del camino. Está en el camino mismo.", autor: "Anónimo", categoria: "Reflexión" },
  { texto: "Cada paso cuenta. Celebra lo que lograste hoy.", autor: "Anónimo", categoria: "Gratitud" },
  { texto: "El tiempo con tu familia es sagrado. Valóralo.", autor: "Anónimo", categoria: "Reflexión" },
  { texto: "No importa qué tan lento vayas, siempre y cuando no te detengas.", autor: "Confucio", categoria: "Perseverancia" },
  { texto: "El éxito es disfrutar el camino, no solo llegar a la meta.", autor: "Anónimo", categoria: "Reflexión" },
  { texto: "Mañana es otra oportunidad para hacerlo mejor.", autor: "Anónimo", categoria: "Inspiración" },
  { texto: "La gratitud convierte lo que tenemos en suficiente.", autor: "Melody Beattie", categoria: "Gratitud" },
  { texto: "Vive cada día como si fuera una segunda oportunidad.", autor: "Anónimo", categoria: "Reflexión" },
  { texto: "El hogar es donde está el corazón.", autor: "Plinio el Viejo", categoria: "Reflexión" },
  { texto: "Respira profundo. Hoy fue un buen día.", autor: "Anónimo", categoria: "Descanso" },
  { texto: "Ríe mucho, ama mucho y deja el resto al tiempo.", autor: "Anónimo", categoria: "Reflexión" },
  { texto: "El momento presente siempre será.", autor: "Eckhart Tolle", categoria: "Reflexión" },
  { texto: "Sé amable contigo mismo. Eres parte de algo más grande.", autor: "Anónimo", categoria: "Reflexión" },
  { texto: "La vida es demasiado corta para no disfrutar cada momento.", autor: "Anónimo", categoria: "Reflexión" },
  { texto: "Haz del descanso un hábito, no una recompensa.", autor: "Anónimo", categoria: "Descanso" },
  { texto: "Lo mejor está por venir. Descansa y prepárate para recibirlo.", autor: "Anónimo", categoria: "Descanso" },
  { texto: "Antes de irte, agradece por lo que sí salió bien hoy.", autor: "Anónimo", categoria: "Gratitud" },
  { texto: "El trabajo se queda aquí. Llévate solo lo bueno del día.", autor: "Anónimo", categoria: "Descanso" },
  { texto: "Un día bien cerrado es la mejor manera de empezar el siguiente.", autor: "Anónimo", categoria: "Organización" },
];

// ── Finalizada (ya cerró su jornada — mensaje breve de despedida) ──
export const QUOTES_FINALIZADA: Quote[] = [
  { texto: "Descansa. Dios también descansó el séptimo día.", autor: "Anónimo", categoria: "Fe" },
  { texto: "Buen trabajo hoy. Nos vemos mañana.", autor: "Anónimo", categoria: "Gratitud" },
  { texto: "Tu jornada terminó — ahora es momento de ti.", autor: "Anónimo", categoria: "Descanso" },
  { texto: "El día se cerró bien. Disfruta lo que sigue.", autor: "Anónimo", categoria: "Descanso" },
  { texto: "Que tu descanso sea tan bueno como tu esfuerzo de hoy.", autor: "Anónimo", categoria: "Descanso" },
  { texto: "Vete tranquilo: hiciste lo que tenías que hacer.", autor: "Anónimo", categoria: "Gratitud" },
  { texto: "Hasta mañana. El equipo sigue contigo.", autor: "Anónimo", categoria: "Trabajo en equipo" },
  { texto: "Suelta el día. Ya cumpliste tu parte.", autor: "Anónimo", categoria: "Descanso" },
  { texto: "El descanso de hoy es la energía de mañana.", autor: "Anónimo", categoria: "Descanso" },
  { texto: "Que la noche te encuentre en paz.", autor: "Anónimo", categoria: "Reflexión" },
  { texto: "Gracias por tu trabajo hoy. Nos vemos pronto.", autor: "Anónimo", categoria: "Gratitud" },
  { texto: "Cierra la puerta del trabajo y abre la de tu tiempo.", autor: "Anónimo", categoria: "Descanso" },
  { texto: "Lo diste todo. Ahora, a descansar de verdad.", autor: "Anónimo", categoria: "Descanso" },
  { texto: "Un buen cierre de día también es un logro.", autor: "Anónimo", categoria: "Gratitud" },
  { texto: "Nos vemos mañana con energías nuevas.", autor: "Anónimo", categoria: "Inspiración" },
];

// ── Fechas especiales — sobreescriben la selección normal ese día ──
// Formato de clave: "MM-DD".
export const QUOTES_ESPECIALES: Record<string, Quote> = {
  "01-01": { texto: "Un año nuevo, una página en blanco. Que este sea de los buenos.", autor: "Anónimo", categoria: "Inspiración" },
  "05-10": { texto: "Hoy es un buen día para llamar a mamá. El trabajo puede esperar un mensaje.", autor: "Anónimo", categoria: "Reflexión" },
  "05-15": { texto: "Gracias a quienes enseñan — dentro y fuera del salón de clases.", autor: "Anónimo", categoria: "Gratitud" },
  "09-16": { texto: "Hoy celebramos lo que somos como país. Feliz día de la Independencia.", autor: "Anónimo", categoria: "Gratitud" },
  "12-24": { texto: "Que esta noche esté llena de lo que de verdad importa.", autor: "Anónimo", categoria: "Fe" },
  "12-25": { texto: "Feliz Navidad. Que el descanso de hoy sea especialmente merecido.", autor: "Anónimo", categoria: "Fe" },
};

const BUCKETS: Record<"inicio" | "durante" | "cierre" | "finalizada", Quote[]> = {
  inicio: QUOTES_INICIO, durante: QUOTES_DURANTE, cierre: QUOTES_CIERRE, finalizada: QUOTES_FINALIZADA,
};

// Un offset fijo y distinto por momento (no depende del reloj — es solo
// para que las 4 categorías no muestren siempre el mismo índice el mismo
// día, y así la sensación sea menos "sincronizada"/predecible).
const OFFSET_POR_MOMENTO: Record<string, number> = { inicio: 0, durante: 11, cierre: 23, finalizada: 7 };

const diaDelAnio = (d: Date) => Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000);

/** Frase del día para un momento dado — determinista, misma frase para
 *  todos durante todo el día, sin repetir hasta agotar la colección. */
export function fraseDelDia(momento: "inicio" | "durante" | "cierre" | "finalizada", now: Date = new Date()): Quote {
  const mmdd = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const especial = QUOTES_ESPECIALES[mmdd];
  if (especial) return especial;

  const lista = BUCKETS[momento];
  const idx = (diaDelAnio(now) + OFFSET_POR_MOMENTO[momento]) % lista.length;
  return lista[idx];
}
