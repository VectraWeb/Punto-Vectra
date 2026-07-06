# Especificación de Integración para n8n (GourmetSync)

Para que n8n interactúe correctamente con el sistema, debe leer y escribir en Firestore siguiendo esta estructura.

---

## 1. Estructura de Firestore

### Colecciones y rutas

| Ruta | Propósito |
| :--- | :--- |
| `config/restaurant` | Configuración de mesas (capacidad) |
| `reservations/{YYYY-MM-DD}/items/{reservationId}` | Reservas del día |
| `reservations/{YYYY-MM-DD}/guards/{tableId}_{service}_{time}` | Lock anti-doble-booking |

### `config/restaurant` (documento único)

```json
{
  "cap2": 2,
  "cap4": 2,
  "cap5": 2,
  "cap8": 2
}
```

Cada campo indica cuántas mesas hay por capacidad. Las mesas se generan secuencialmente: `m1`(2p), `m2`(2p), `m3`(4p), `m4`(4p), `m5`(5p), `m6`(5p), `m7`(8p), `m8`(8p).

---

## 2. Modelo de Reserva (items)

### Ruta
`reservations/{YYYY-MM-DD}/items/{reservationId}`

- `{YYYY-MM-DD}`: Fecha local en formato Argentina (ej: `2024-06-18`).
- `{reservationId}`: ID único. Formato used by la app: `r{timestamp}` (ej: `r1719900000000`).

### Payload completo

```json
{
  "id": "r1719900000000",
  "customerName": "Juan Perez",
  "phone": "+54911...",
  "partySize": 4,
  "tableId": "m5",
  "time": "20:30",
  "duration": 120,
  "service": "cena",
  "notes": "Viene por un cumple",
  "liveState": null,
  "startedAt": null,
  "leftAt": null,
  "date": "2024-06-18",
  "createdAt": "2024-06-18T10:00:00.000-03:00",
  "updatedAt": "2024-06-18T10:00:00.000-03:00"
}
```

### Campos

| Campo | Tipo | Requerido | Formato / Valor |
| :--- | :--- | :--- | :--- |
| `id` | String | Sí | `r{Date.now()}` |
| `customerName` | String | Sí | Nombre del cliente |
| `phone` | String | No | Formato internacional (`+54911...`) |
| `partySize` | Number | Sí | Cantidad de personas (1-20) |
| `tableId` | String | Sí | ID de mesa: `m1`, `m2`, etc. |
| `time` | String | Sí | `"HH:mm"` (24hs) |
| `duration` | Number | Sí | Minutos (`90` mediodía, `120` cena) |
| `service` | String | Sí | `"mediodia"` o `"cena"` |
| `notes` | String | No | Notas libres |
| `liveState` | String\|null | No | Ver tabla de estados abajo. `null` = reserva nueva sin empezar |
| `startedAt` | Timestamp\|null | No | Se setea al pasar a `esperando_cliente` |
| `leftAt` | Timestamp\|null | No | Se setea al pasar a `para_limpiar` |
| `date` | String | Sí | `"YYYY-MM-DD"` |
| `createdAt` | Timestamp | Sí | `serverTimestamp()` o ISO 8601 con zona `-03:00` |
| `updatedAt` | Timestamp | Sí | `serverTimestamp()` o ISO 8601 con zona `-03:00` |

### Zona Horaria

n8n debe forzar la zona horaria de Argentina (`-03:00`) al generar timestamps. El frontend usa `serverTimestamp()` de Firestore, pero si n8n escribe directamente, debe usar strings ISO 8601.

---

## 3. Guard (Lock anti-doble-booking)

### Ruta
`reservations/{YYYY-MM-DD}/guards/{tableId}_{service}_{time}`

El `time` en el guard usa `.` en lugar de `:` (ej: `20.30`).

### Payload

```json
{
  "reservationId": "r1719900000000",
  "createdAt": "2024-06-18T10:00:00.000-03:00"
}
```

### Importancia

**n8n DEBE crear un guard al crear una reserva.** Sin el guard, no hay protección contra doble-booking. La app frontend usa transacciones de Firestore para esto. Si n8n no puede ejecutar transacciones, debe:

1. Leer el guard antes de crear la reserva
2. Verificar que no exista o que pertenezca a la misma reserva
3. Crear el guard y la reserva

**Formato del guard ID:** `{tableId}_{service}_{timeConPunto}`
Ejemplo: `m5_cena_20.30`

---

## 4. Estados de la reserva (`liveState`)

La máquina de estados del mozo:

| `liveState` | Label | Color | Descripción |
| :--- | :--- | :--- | :--- |
| `null` | — | — | Reserva nueva, cliente no llegó |
| `esperando_cliente` | Esperando | azul | Mesa asignada, esperando |
| `comiendo_entrada` | Entrada | naranja | Comiendo entrada |
| `plato_principal` | Principal | rojo oscuro | Plato principal |
| `en_postre_cafe` | Postre / Café | amarillo | Postre o café |
| `esperando_cuenta` | Cuenta | violeta | Esperando la cuenta |
| `para_limpiar` | A limpiar | naranja | Cliente se fue, a limpiar |

El flujo es lineal: `null → esperando_cliente → comiendo_entrada → plato_principal → en_postre_cafe → esperando_cuenta → para_limpiar → finalizada (eliminada)`

---

## 5. Servicios y horarios

| Servicio | Inicio | Fin | Duración default | Slots |
| :--- | :--- | :--- | :--- | :--- |
| `mediodia` | 11:30 | 15:00 | 90 min | Cada 15 min |
| `cena` | 19:30 | 01:00 | 120 min | Cada 15 min |

**Atención:** Cena cruza medianoche. `01:00` de la cena es el día siguiente. El sistema usa minutos relativos para manejar esto (ej: `01:00` = 25*60 = 1500 min).

---

## 6. Configuración de mesas (`buildTables`)

Las mesas se generan desde `config/restaurant`:

```
cap2: 2 → m1(2p), m2(2p)
cap4: 2 → m3(4p), m4(4p)
cap5: 2 → m5(5p), m6(5p)
cap8: 2 → m7(8p), m8(8p)
```

Total: 8 mesas, 40 lugares.

Para buscar mesa disponible, n8n debe:
1. Leer `config/restaurant`
2. Generar la lista de mesas con capacidad
3. Filtrar mesas con capacidad >= partySize
4. Verificar conflictos de horario contra reservas existentes

---

## 7. Notificaciones del Frontend → n8n

El frontend envía webhooks a n8n en dos eventos. n8n debe tener workflows que los reciban.

### 7.1 Reserva creada

**Cuando:** Se crea una reserva desde la app (mozo o QR).

```json
{
  "evento": "reserva_creada",
  "cliente_nombre": "Juan Perez",
  "telefono": "+54911...",
  "cantidad_personas": 4,
  "mesa": "m5",
  "servicio": "cena",
  "duracion_minutos": 120,
  "fecha": "2024-06-18",
  "hora": "20:30",
  "notas": "Viene por un cumple"
}
```

**URL:** Configurar en `VITE_N8N_WEBHOOK_URL` (variable de entorno). Si no está configurada, no se envía nada.

### 7.2 Reserva finalizada

**Cuando:** El mozo finaliza una reserva (la elimina del sistema).

```json
{
  "evento": "reserva_finalizada",
  "cliente_nombre": "Juan Perez",
  "mesa": "M5",
  "mesa_id": "m5",
  "servicio": "cena",
  "duracion_total_minutos": 95
}
```

---

## 8. Flujo del bot de WhatsApp (lo que n8n debe implementar)

La lógica actual está en `functions/webhook.js`. n8n debe replicar esta máquina de estados:

### Pasos del flujo

| Paso | Input del usuario | Validación | Siguiente paso |
| :--- | :--- | :--- | :--- |
| 1. Nombre | Texto libre | >= 2 caracteres | → 2 |
| 2. Cantidad | Número | 1-20 | → 3 |
| 3. Fecha | `hoy`, `mañana`, `dd/mm` | Fecha válida | → 4 |
| 4. Hora | `HH:mm`, `HHhs` | Dentro de horarios | → 5 |
| 5. Confirmar | `si` / `no` | — | → Crear reserva o cancelar |

### Disparadores de reinicio

El flujo se reinicia con: `hola`, `reservar`, `empezar`, `nueva reserva`, `inicio`

### Búsqueda de mesa disponible

n8n debe:
1. Calcular ventana de tiempo: `newStart` = time en minutos, `newEnd` = newStart + duration
2. Cargar reservas existentes del día desde Firestore
3. Filtrar mesas con capacidad >= partySize
4. Para cada candidata, verificar que no haya conflicto de horario (misma mesa, mismo servicio, solapamiento de tiempo)
5. Si no hay mesa disponible, informar al cliente

### Respuestas del bot

El bot debe responder con formato WhatsApp (negritas con `*`). Ejemplo de confirmación:

```
✅ *¡Reserva confirmada!*

📍 Mesa: *M5*
👤 Juan Perez · 4 personas
📅 lunes 18 de junio a las 20:30

Te esperamos en *Andi*. ¡Hasta pronto! 🍽️
```

---

## 9. Seguridad de Firestore

### Reglas actuales (firestore.rules)

| Colección | Lectura | Escritura |
| :--- | :--- | :--- |
| `config/restaurant` | Pública | Solo autenticado |
| `reservations/{date}/items/{id}` | Solo autenticado | Create: público / Update+Delete: autenticado |
| `reservations/{date}/guards/{id}` | No definido | No definido |

**Problema:** Las reglas no cubren `guards/`. Si n8n usa el Admin SDK (bypass rules), no hay problema. Si usa client SDK, necesitará auth o reglas adicionales.

### Opciones para n8n

1. **Admin SDK (recomendado):** n8n usa credenciales de service account → bypass rules
2. **Reglas permisivas:** Agregar reglas para que n8n autenticado pueda escribir
3. **Cloud Function proxy:** Mantener `webhook.js` como intermediario

---

## 10. Checklist de integración

- [ ] Configurar webhook de Meta Cloud API → n8n
- [ ] Crear workflow n8n: recibir mensaje WhatsApp → máquina de estados → responder
- [ ] Crear workflow n8n: leer `config/restaurant` para generar lista de mesas
- [ ] Crear workflow n8n: buscar disponibilidad (leer reservas del día + verificar conflictos)
- [ ] Crear workflow n8n: crear reserva + guard en Firestore (con transacción si es posible)
- [ ] Crear workflow n8n: recibir notificación de reserva creada desde la app
- [ ] Crear workflow n8n: recibir notificación de reserva finalizada desde la app
- [ ] Configurar `VITE_N8N_WEBHOOK_URL` en `.env` con la URL del webhook de n8n
- [ ] Decidir: mantener Cloud Function como proxy o migrar todo a n8n
- [ ] Persistir sesiones de conversación en Firestore/Redis (las sesiones en memoria se pierden al reiniciar)
