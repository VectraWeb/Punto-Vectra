# Especificación de Integración para n8n (GourmetSync)

Para que n8n interactúe correctamente con el sistema, debe escribir en Firestore siguiendo esta estructura.

## 1. Ruta de la Colección
`reservations/{YYYY-MM-DD}/items/{reservationId}`

- `{YYYY-MM-DD}`: Fecha local de Argentina (ej: `2024-06-18`).
- `{reservationId}`: ID único. Si n8n crea la reserva, puede ser un UUID o un string único.

## 2. Estructura del JSON (Payload)

```json
{
  "customerName": "Juan Perez",
  "phone": "+54911...",
  "partySize": 4,
  "tableId": "m5",
  "time": "20:30",
  "duration": 90,
  "service": "cena",
  "notes": "Viene por un cumple",
  "liveState": "esperando_cliente",
  "updatedAt": "2024-06-18T20:30:00.000-03:00",
  "createdAt": "2024-06-18T10:00:00.000-03:00"
}
```

## 3. Tipos de Datos y Formatos

| Campo | Tipo | Formato / Valor |
| :--- | :--- | :--- |
| `customerName` | String | Nombre del cliente |
| `phone` | String | Formato internacional sugerido |
| `partySize` | Number | Cantidad de personas |
| `tableId` | String | Coincidir con los IDs del salón (ej: `m1`, `m2`) |
| `time` | String | "HH:mm" (24hs) |
| `duration` | Number | Minutos (ej: `90`) |
| `service` | String | `mediodia` o `cena` |
| `liveState` | String | `esperando_cliente`, `plato_principal`, `esperando_cuenta` |
| `updatedAt` | String (ISO) | `{{ $now.setZone('America/Argentina/Buenos_Aires').toISO() }}` |
| `createdAt` | String (ISO) | `{{ $now.setZone('America/Argentina/Buenos_Aires').toISO() }}` |

### Importante: Zona Horaria
n8n debe forzar la zona horaria de Argentina (`-03:00`) al generar los campos `updatedAt` y `createdAt`. El frontend de React interpretará estos strings ISO 8601 automáticamente y calculará los tiempos transcurridos de forma sincronizada con el reloj local.
