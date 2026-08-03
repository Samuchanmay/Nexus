# Emet · Mobile

## Principios

1. **Mobile = nativo.** El navegador manda en scrollbar/overlays (`html { font-size: 100% }`, scrollbar nativo en iOS/Android). No se "civiliza" el scroll en móvil.
2. **Un dedo, una acción.** Target mínimo de toque 44px; FAB para la acción principal flotante.
3. **La información se jerarquiza, no se comprime.** Si una tabla no cabe, se convierte en tarjetas.

## Comportamientos específicos

| Elemento | Desktop | Mobile |
|---|---|---|
| Font-size base | 110% | 100% |
| `v6-add-act-btn` (añadir) | botón en línea | oculto → FAB |
| FAB (`v6-fab`) | oculto | visible (`bottom: 84px; right: 20px`) |
| Grid de actividades | 5 columnas | 3 columnas (`≤520px`) |
| Tablas de reporte | tabla completa | tarjetas apiladas |
| Sidebar | fija | drawer o pestañas inferiores (tab bar) |
| Chat | workspace de 2 paneles | lista ⇄ conversación (pantalla completa) |
| Sheets/adjuntos | centrados | deslizan desde abajo (nativo) |

## Reglas

1. `position: fixed` en móvil solo para FAB y tab bar; los menús usan overlay/Sheet.
2. Los pickers de fecha/hora **abren el nativo del SO** en móvil.
3. El header del shell reserva altura fija; el contenido scrollea debajo (el chat tiene su franja reservada bajo header + tab bar).
4. Gestos: swipe se soporta en chat (desde desktop con mouse también, vía `use-swipe-gesture`); nunca interferir con el scroll vertical.
5. Hover se ignora en touch: los estados de tarjeta en móvil son por selección, no por hover.
6. No más de 2 filas de acciones visibles; el resto va al menú "⋯".
7. `viewport-fit: cover` + `safe-area` para respetar las muescas en iOS (meta viewport ya configurada).

## Ver también

- `MOBILE`→`DESKTOP` son complementarios: `DESKTOP.md` describe el workspace grande.
- `modules/CHAT.md` — comportamiento del chat en ambas densidades.
