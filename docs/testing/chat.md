# Casos de Prueba — Chat

> Casos extremos para validar la lógica del chat.  
> Última actualización: 04 Ago 2026

---

## Caso 1: Empleado elimina mensaje

**Escenario**: Samuel envía un mensaje y lo elimina a los 5 minutos.

**Validar**:
- [ ] Mensaje se marca `deleted_at` (no se borra físicamente)
- [ ] UI muestra "Mensaje eliminado"
- [ ] Otros participantes ven "Mensaje eliminado"
- [ ] Se registra en auditoría si es admin

---

## Caso 2: Empleado elimina mensaje mientras otro responde

**Escenario**: Samuel elimina un mensaje, pero Citlaly ya estaba respondiendo.

**Validar**:
- [ ] Citlaly puede enviar su respuesta
- [ ] La respuesta aparece como "Respuesta a mensaje eliminado"
- [ ] No se rompe el hilo de conversación
- [ ] Realtime funciona correctamente

---

## Caso 3: Administrador elimina empleado

**Escenario**: Jorge renuncia y se marca `active = false`.

**Validar**:
- [ ] Sus mensajes en chat se conservan
- [ ] Aparece como "Jorge (inactivo)" en la lista
- [ ] No puede enviar nuevos mensajes
- [ ] No puede iniciar sesión
- [ ] Sus chats anteriores siguen visibles para el equipo

---

## Caso 4: Empleado está escribiendo y pierde internet

**Escenario**: Citlaly está escribiendo un mensaje largo y pierde internet.

**Validar**:
- [ ] UI muestra "Sin conexión" (pill rojo)
- [ ] Indicador "escribiendo…" desaparece después de 3 segundos
- [ ] Mensaje se guarda en borrador local (localStorage)
- [ ] Cuando recupera internet, puede enviar el mensaje
- [ ] Si cierra la app, el borrador se conserva

---

## Caso 5: Recibe dos mensajes exactamente al mismo tiempo

**Escenario**: Samuel recibe dos mensajes de diferentes personas al mismo tiempo.

**Validar**:
- [ ] Ambos mensajes aparecen en tiempo real
- [ ] Contador de no-leídos se incrementa correctamente
- [ ] Notificaciones push llegan (si están activadas)
- [ ] No se pierde ningún mensaje
- [ ] Realtime maneja la concurrencia

---

## Caso 6: Empleado envía mensaje grande (imagen + texto)

**Escenario**: Samuel envía una imagen de 10MB con texto.

**Validar**:
- [ ] Imagen se sube a Supabase Storage
- [ ] Se genera thumbnail WebP
- [ ] Mensaje aparece con imagen + texto
- [ ] Progreso de subida visible
- [ ] Si falla la subida, se muestra "Error al enviar"
- [ ] Se puede reintentar

---

## Caso 7: Conversación silenciada

**Escenario**: Citlaly silencia un grupo por 8 horas.

**Validar**:
- [ ] No recibe notificaciones push del grupo
- [ ] Badge de no-leídos NO se oculta (solo se calla)
- [ ] Muestra "Silenciado hasta 6:00 PM" en la lista
- [ ] Después de 8 horas, se reactiva automáticamente
- [ ] Puede desilenciar manualmente antes

---

## Caso 8: Dos personas escriben al mismo tiempo

**Escenario**: Samuel y Citlaly escriben al mismo tiempo en un chat.

**Validar**:
- [ ] Ambos ven "Samuel está escribiendo…" y "Citlaly está escribiendo…"
- [ ] Indicadores desaparecen después de 3 segundos de inactividad
- [ ] Los mensajes llegan en orden correcto
- [ ] No se intercalan los indicadores

---

## Caso 9: Empleado edita mensaje después de 15 minutos

**Escenario**: Samuel intenta editar un mensaje que envió hace 20 minutos.

**Validar**:
- [ ] Botón "Editar" no aparece (o está deshabilitado)
- [ ] Solo puede editar dentro de los primeros 15 minutos
- [ ] Admin sí puede editar cualquier mensaje (moderación)

---

## Caso 10: Mensaje fijado

**Escenario**: Admin fija un mensaje importante en un grupo.

**Validar**:
- [ ] Mensaje aparece fijado en la parte superior
- [ ] Todos los participantes lo ven
- [ ] Se puede desfijar
- [ ] Solo admin puede fijar/desfijar

---

## Caso 11: Reacciones a mensajes

**Escenario**: Citlaly reacciona con 👍 al mensaje de Samuel.

**Validar**:
- [ ] Reacción aparece debajo del mensaje
- [ ] Samuel recibe notificación (si está activada)
- [ ] Citlaly puede quitar su reacción
- [ ] Solo se puede reaccionar a mensajes de OTROS (no propios)
- [ ] Reacciones se sincronizan en tiempo real

---

## Caso 12: Búsqueda de mensajes

**Escenario**: Samuel busca "reunión" en el chat.

**Validar**:
- [ ] Resultados aparecen en tiempo real mientras escribe
- [ ] Se puede navegar al mensaje original
- [ ] Se resaltan las coincidencias
- [ ] Funciona en todos los chats (no solo el actual)

---

## Caso 13: Forward de mensaje

**Escenario**: Citlaly reenvía un mensaje de Samuel a otro chat.

**Validar**:
- [ ] Mensaje original se conserva
- [ ] Copia aparece en el nuevo chat
- [ ] Muestra "Reenviado de Samuel"
- [ ] Si el original se elimina, la copia se conserva

---

## Caso 14: Sticker/Emoji grande

**Escenario**: Samuel envía un sticker grande (sin texto).

**Validar**:
- [ ] Sticker se muestra grande (sin burbuja)
- [ ] Se descarga desde Supabase Storage
- [ ] Aparece en tiempo real
- [ ] Si falla la descarga, se muestra placeholder

---

## Caso 15: Grabación de audio

**Escenario**: Citlaly graba un audio de 30 segundos.

**Validar**:
- [ ] Indicador "grabando audio" visible para otros
- [ ] Audio se sube a Supabase Storage
- [ ] Reproductor aparece en el mensaje
- [ ] Duración visible (0:30)
- [ ] Si cancela, no se sube
- [ ] Si pierde internet durante la grabación, se guarda localmente

---

## Checklist de Auditoría

Antes de mergear cambios en chat:

- [ ] Mensajes llegan en tiempo real (Realtime)
- [ ] Empleado puede editar sus mensajes (<15 min)
- [ ] Admin puede eliminar cualquier mensaje
- [ ] Mensaje eliminado se conserva (soft delete)
- [ ] Indicador "escribiendo…" funciona
- [ ] Indicador "grabando audio" funciona
- [ ] Silenciar por duración funciona
- [ ] Reacciones solo a mensajes de otros
- [ ] Imágenes se suben con pipeline WebP
- [ ] Audio se graba y sube correctamente
- [ ] Búsqueda funciona en tiempo real
- [ ] Forward conserva el mensaje original
- [ ] Stickers se muestran grandes
- [ ] Renuncia conserva mensajes
- [ ] Sin conexión maneja el outbox
