# Especificación de Integración para n8n (GourmetSync)

Para que n8n interactúe correctamente con el sistema, debe leer y escribir en Firestore siguiendo esta estructura.

---

## 1. Estructura de Firestore

### Colecciones y rutas

| Ruta | Propósito |
| :--- | :--- |
| `config/restaurant` | Configuración de mesas (capacidad) |
| `reservations/{YYYY-MM-DD}/items/{reservationId}` | Reservas del día (app principal) |
| `reservations/{YYYY-MM-DD}/guards/{tableId}_{service}_{time}` | Lock anti-doble-booking |
| **`allReservations/{reservationId}`** | **Colección plana para n8n (lectura/escritura)** |

> **IMPORTANTE:** La app escribe en ambas colecciones (`reservations/.../items/` y `allReservations/`) simultáneamente. n8n **debe** usar `allReservations` para leer y escribir reservas, ya que la colección anidada `reservations/.../items/` no puede ser consultada directamente por el nodo Firestore de n8n.

### `config/restaurant` (documento único)

```json
{
  "cap2": 34,
  "cap4": 0,
  "cap5": 5,
  "cap8": 2
}
```

Cada campo indica cuántas mesas hay por capacidad. Las mesas se generan secuencialmente: `m1`(2p), `m2`(2p), ... `m34`(2p), `m35`(5p), `m36`(5p), `m37`(5p), `m38`(5p), `m39`(5p), `m40`(8p), `m41`(8p).

---

## 2. Modelo de Reserva (items)

### Ruta (app principal — NO usar para n8n)
`reservations/{YYYY-MM-DD}/items/{reservationId}`

### Ruta plana (para n8n — LECTURA Y ESCRITURA)
`allReservations/{reservationId}`

- `{YYYY-MM-DD}`: Fecha local en formato Argentina (ej: `2024-06-18`).
- `{reservationId}`: ID único. Formato used by la app: `r{timestamp}` (ej: `r1719900000000`).

### Payload completo (allReservations)

```json
{
  "id": "r1719900000000",
  "customerName": "Juan Perez",
  "phone": "+54911...",
  "partySize": 4,
  "tableId": "m5",
  "mesa_id": "m5",
  "time": "20:30",
  "duration": 120,
  "service": "cena",
  "notes": "Viene por un cumple",
  "liveState": null,
  "startedAt": null,
  "leftAt": null,
  "date": "2024-06-18",
  "estado": "confirmada",
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
| `tableId` | String | Sí | ID de mesa: `m1`, `m2`, etc. (`null` si pendiente) |
| `mesa_id` | String | Sí | Igual que `tableId` (`null` si pendiente) |
| `time` | String | Sí | `"HH:mm"` (24hs) |
| `duration` | Number | Sí | Minutos (`90` mediodía, `120` cena) |
| `service` | String | Sí | `"mediodia"` o `"cena"` |
| `notes` | String | No | Notas libres |
| `liveState` | String\|null | No | Ver tabla de estados abajo. `null` = reserva nueva sin empezar |
| `startedAt` | Timestamp\|null | No | Se setea al pasar a `esperando_cliente` |
| `leftAt` | Timestamp\|null | No | Se setea al pasar a `para_limpiar` |
| `date` | String | Sí | `"YYYY-MM-DD"` |
| `estado` | String | No | `"pendiente"` (sin mesa) o `"confirmada"` (con mesa) |
| `createdAt` | Timestamp | Sí | ISO 8601 con zona `-03:00` |
| `updatedAt` | Timestamp | Sí | ISO 8601 con zona `-03:00` |

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

**Recomendación:** Usar la colección plana `allReservations` para todo. La app ya escribe en ambas colecciones simultáneamente. n8n puede:
- Leer: `getAll` en `allReservations` con filtro por `date` y `service`
- Escribir: `create`/`update` en `allReservations` → la app se sincroniza vía la colección anidada (o manualmente)

---

## 10. Checklist de integración

- [x] App dual-writes to `allReservations` flat collection (n8n-readable)
- [x] `config/restaurant` updated with real table counts (41 tables)
- [ ] Configurar webhook de Meta Cloud API → n8n
- [ ] Crear workflow n8n: recibir mensaje WhatsApp → máquina de estados → responder
- [ ] Crear workflow n8n: leer `config/restaurant` para generar lista de mesas
- [ ] Crear workflow n8n: leer `allReservations` para disponibilidad del día (filtro por `date` + `service`)
- [ ] Crear workflow n8n: calcular disponibilidad (`total_mesas - reservas_existentes`)
- [ ] Crear workflow n8n: crear reserva en `allReservations` + crear guard en `reservations/{date}/guards/`
- [ ] Crear workflow n8n: recibir notificación de reserva creada desde la app
- [ ] Crear workflow n8n: recibir notificación de reserva finalizada desde la app
- [ ] Configurar `VITE_N8N_WEBHOOK_URL` en `.env` con la URL del webhook de n8n
- [ ] Persistir sesiones de conversación en Redis (las sesiones en memoria se pierden al reiniciar)

---

## 11. Flujo del workflow AndiMeet1 en n8n

### Estructura de nodos

| Nodo | Tipo | Función |
| :--- | :--- | :--- |
| Webhook | `webhook` | Recibe mensajes de WhatsApp vía Meta Cloud API |
| Parse WhatsApp | `code` | Extrae el mensaje del usuario del payload de WhatsApp |
| AI Agent | `langchain.agent` | Gestiona la conversación con el usuario |
| Get Time + Parse | `code` | Parsea hora y servicio del mensaje del usuario |
| Get Restaurant Config | `googleFirestore` | Lee `config/restaurant` para saber cantidad de mesas |
| **Get Day Reservations** | `googleFirestore` | **Lee `allReservations` filtrando por `date` y `service`** |
| **Calc Availability** | `code` | **Calcula mesas libres: total - reservas existentes** |
| Create Reservation | `googleFirestore` | Crea reserva en `allReservations` + guard en `reservations/{date}/guards/` |
| Send WhatsApp | `httpRequest` | Responde al usuario por WhatsApp |

### Nodo "Get Day Reservations" (IMPORTANTE)

- **Colección:** `allReservations`
- **Operación:** getAll
- **Filtros:** 
  - `date` == fecha seleccionada por el usuario
  - `service` == servicio detectado (mediodia/cena)
  - Opcionalmente: `tableId` is not null (solo reservas confirmadas)

### Nodo "Calc Availability" (NODO CODE — reemplaza el Manual Mapping)

**Tipo:** Code node (JavaScript)
**Inputs:** `Get Restaurant Config`, `Get Day Reservations`, `Parse Time & Service`

```javascript
// ── Inputs ──────────────────────────────────────────────────────────────────
const config = $('Get Restaurant Config').item.json;
const reservationsRaw = $('Get Day Reservations').item.json;
const parse = $('Parse Time & Service').item.json;

const requestedPartySize = parse.partySize || 2;
const requestedDate = parse.date;
const requestedService = parse.service;
const requestedTime = parse.time; // "HH:mm"

// Get Day Reservations puede devolver array directo o { items: [...] }
const reservations = Array.isArray(reservationsRaw)
  ? reservationsRaw
  : (reservationsRaw.items || reservationsRaw.allReservations || []);

// ── 1. Generar lista de mesas desde config ──────────────────────────────────
const groups = [
  { cap: config.cap2 || 0, capacity: 2 },
  { cap: config.cap4 || 0, capacity: 4 },
  { cap: config.cap5 || 0, capacity: 5 },
  { cap: config.cap8 || 0, capacity: 8 },
];

const allTables = [];
let n = 1;
for (const { cap, capacity } of groups) {
  for (let i = 0; i < cap; i++) {
    allTables.push({ id: `m${n}`, name: `M${n}`, capacity });
    n++;
  }
}

const totalTables = allTables.length;

// ── 2. Mesas ocupadas (reservas existentes del mismo servicio) ──────────────
const occupiedTableIds = new Set(
  reservations
    .filter(r => r.tableId && r.service === requestedService)
    .map(r => r.tableId)
);

// ── 3. Filtrar mesas con capacidad suficiente que estén libres ──────────────
const suitableTables = allTables
  .filter(t => t.capacity >= requestedPartySize && !occupiedTableIds.has(t.id))
  .sort((a, b) => a.capacity - b.capacity); //preferir la más chica que alcance

const hasAvailability = suitableTables.length > 0;
const assignedTable = hasAvailability ? suitableTables[0] : null;
const availableCount = suitableTables.length;

// ── 4. Output ──────────────────────────────────────────────────────────────
return {
  total_tables: totalTables,
  reserved_count: occupiedTableIds.size,
  available_tables: availableCount,
  assigned_table: assignedTable ? assignedTable.id : null,
  assigned_table_name: assignedTable ? assignedTable.name : null,
  assigned_table_capacity: assignedTable ? assignedTable.capacity : null,
  reservation_estado: hasAvailability ? 'confirmada' : 'pendiente',
  requested_date: requestedDate,
  requested_service: requestedService,
  requested_time: requestedTime,
  requested_party_size: requestedPartySize,
};
```

### Nodo "Create Reservation" (IMPORTANTE)

**Tipo:** Code node (JavaScript) — mejor que Firestore node porque necesita crear 2 documentos

```javascript
const data = $('Calc Availability').item.json;

if (data.reservation_estado !== 'confirmada') {
  // No hay mesa disponible, solo devolver el mensaje
  return { success: false, message: 'No hay mesas disponibles para esa fecha y horario.' };
}

const id = `r${Date.now()}`;
const now = new Date().toISOString();
const guardTime = data.requested_time.replace(':', '.');

const flatDoc = {
  id,
  customerName: $('Parse Time & Service').item.json.customerName || '',
  phone: $('Parse Time & Service').item.json.phone || '',
  partySize: data.requested_party_size,
  tableId: data.assigned_table,
  mesa_id: data.assigned_table,
  time: data.requested_time,
  duration: data.requested_service === 'cena' ? 120 : 90,
  service: data.requested_service,
  notes: '',
  liveState: null,
  date: data.requested_date,
  estado: 'confirmada',
  createdAt: now,
  updatedAt: now,
};

const guardDoc = {
  reservationId: id,
  createdAt: now,
};

return {
  success: true,
  reservation_id: id,
  flat_doc: flatDoc,
  guard_doc: guardDoc,
  guard_id: `${data.assigned_table}_${data.requested_service}_${guardTime}`,
  guard_collection: `reservations/${data.requested_date}/guards`,
};
```

Luego usás dos nodos **Firestore** secuenciales:
1. **Create flat doc** — operación `create`, colección `allReservations`, document ID = `{{ $json.reservation_id }}`, data = `{{ $json.flat_doc }}`
2. **Create guard** — operación `create`, colección `{{ $json.guard_collection }}`, document ID = `{{ $json.guard_id }}`, data = `{{ $json.guard_doc }}`
