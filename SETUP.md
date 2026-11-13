# MetalMAC ERP — Guía de Deploy: Vercel + Supabase

## Prerequisitos

- Node.js 18+
- Supabase CLI: `npm install -g supabase`
- Cuenta Vercel (gratis funciona)
- Cuenta Supabase con un proyecto creado (Postgres + Auth)

---

## Paso 1 — Clonar e instalar dependencias

```bash
git clone <tu-repo> metalmac-erp
cd metalmac-erp
npm install
```

---

## Paso 2 — Instalar componentes shadcn/ui

```bash
npx shadcn-ui@latest add button badge input label select skeleton table sheet dialog textarea
```

Esto genera los archivos en `components/ui/` que todo el código importa.

---

## Paso 3 — Configurar Supabase

### 3.1 Crear proyecto Supabase

1. Ve a [app.supabase.com](https://app.supabase.com) → **New project**
2. Nombre: `metalmac-erp`, elige región y contraseña de la base de datos
3. Habilita **Email/Password** en Authentication → Providers (activado por defecto)

### 3.2 Vincular el proyecto local

```bash
supabase login
supabase link --project-ref <tu-project-ref>   # ver en supabase/config.toml o el dashboard
```

### 3.3 Obtener credenciales

Supabase Dashboard → Project Settings → API. Copia los valores a tu `.env.local`:

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://<tu-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` salta todas las políticas RLS — solo se usa server-side (`lib/supabase/admin.ts`, scripts). Nunca exponerla con el prefijo `NEXT_PUBLIC_`.

Para desarrollo local con Supabase corriendo en Docker (`supabase start`), usa los valores que imprime el CLI en su lugar (ver `supabase/config.toml`).

### 3.4 Aplicar el schema (migraciones)

Las migraciones en `supabase/migrations/` crean las tablas, RLS policies y funciones RPC:

```bash
supabase db push
```

Esto aplica, en orden: schema de catálogos/inventario, proveedores/productos, proyectos/órdenes, políticas RLS, funciones RPC (BOM/stock), contadores/triggers, y grants de permisos.

---

## Paso 4 — Seed de datos iniciales

Con `.env.local` configurado:

```bash
npm run seed
```

Esto inserta en Postgres (idempotente, por `nombre`):
- **18 unidades de medida** (kg, lt, m, m², und, pza, etc.)
- **10 categorías de materiales** (aceros, insumos, pintura, etc.)

---

## Paso 5 — Crear primer usuario administrador

1. Ve a Supabase Studio → Authentication → Users → **Add user** (o que el usuario se registre)
2. Ejecuta el script para asignarle rol GERENTE:

```bash
npm run create-admin -- gerente@metalmac.com
# Roles disponibles: GERENTE | BODEGUERO | PRODUCCION | CONTABILIDAD
npm run create-admin -- bodeguero@metalmac.com BODEGUERO
```

Esto asigna el rol tanto en `app_metadata` del usuario (usado por el JWT) como en la tabla `perfiles` (espejo legible).

> ⚠️ El usuario debe cerrar sesión y volver a ingresar después de asignarle el rol, para que el nuevo rol tome efecto en el token JWT.

---

## Paso 6 — Deploy en Vercel

### 6.1 Conectar repositorio

```bash
npm install -g vercel
vercel login
vercel link   # o conecta el repo desde vercel.com
```

### 6.2 Configurar variables de entorno en Vercel

En el dashboard de Vercel → Settings → Environment Variables, agrega las variables de `.env.local`:

| Variable | Entornos |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | Production, Preview |
| `WOOCOMMERCE_WEBHOOK_SECRET` | Production, Preview |

### 6.3 Configurar Site URL en Supabase Auth

Supabase Dashboard → Authentication → URL Configuration → **Site URL**: agrega `https://tu-proyecto.vercel.app` (y los dominios de preview si los usas). Esto controla los links que Supabase genera en emails de recuperación de contraseña, etc.

### 6.4 Primer deploy

```bash
vercel --prod
```

O simplemente haz push al branch `main` si conectaste el repositorio desde vercel.com.

---

## Paso 7 — Verificar el deploy

1. Accede a `https://tu-proyecto.vercel.app` → debe redirigir a `/login`
2. Ingresa con el usuario GERENTE creado en el Paso 5
3. Verifica que el Dashboard carga sin errores
4. Crea un material de prueba en Inventario → Nuevo material

---

## Sitio público (tallermac-web)

tallermac.com ya no corre en WordPress/WooCommerce — es un proyecto Next.js aparte
(`tallermac-web`) que lee y escribe directo contra esta misma base de Supabase. No hay
webhook ni sincronización intermediaria: el sitio público consulta `productos_tienda_publica`
para el catálogo, e inserta directo en `solicitudes_contacto` (formulario de contacto) y
`pedidos_tienda` (carrito) — ambas con RLS que solo permite `INSERT` al rol `anon`.

### Publicar un producto en el sitio

El botón **Publicar en Sitio** (en el detalle de un producto, `/productos/[id]`) solo
aparece para productos `PRODUCTO_TERMINADO` y activos; un semielaborado no se vende suelto.
Alternarlo escribe `productos.publicado_sitio`, que junto con `activo = true` es la única
condición de la vista `productos_tienda_publica` que lee tallermac-web. Sin ninguna imagen
(`productos.imagen_urls` vacío) el producto de todas formas queda visible, solo que sin
foto — subí una desde Editar → Imágenes (se guarda en el bucket público `productos-imagenes`
de Supabase Storage) o pegá la URL de una ya publicada en otro lado.

### Leads y pedidos del sitio

- `/solicitudes-contacto` — bandeja de leads del formulario de contacto (GERENTE/PRODUCCION).
- `/pedidos-tienda` — bandeja de pedidos del carrito (GERENTE/PRODUCCION).

Ambos disparan una confirmación instantánea por WhatsApp al cliente desde tallermac-web
mismo, y un cron en este ERP (`seguimiento-leads-tienda`, cada 4 horas) avisa por email
interno si un lead/pedido queda sin atender más de 4 horas.

---

## Roles del sistema

| Rol | Acceso |
|---|---|
| `GERENTE` | Todo — equivale a superadmin |
| `BODEGUERO` | Inventario: materiales, stock, movimientos |
| `PRODUCCION` | BOM, productos, órdenes de producción |
| `CONTABILIDAD` | Proveedores, facturas de compra |

Asignar con: `npm run create-admin -- email@empresa.com ROL`

---

## Rate limiting (Vercel Firewall)

El ERP no tiene ningún rate limiting propio — un endpoint es alcanzable sin login
y vale la pena proteger a nivel de plataforma (gratis en cualquier plan, no
consume cuota de la función):

- `GET /api/clientes/consultar-identificacion` — pega contra un endpoint no
  oficial del SRI (`srienlinea.sri.gob.ec`); un abuso acá puede hacer que el SRI
  nos banee la IP de salida de Vercel para todo el proyecto.

Requiere `npm i -g vercel`, `vercel login` y `vercel link` (una vez). Los cambios
quedan en borrador hasta `vercel firewall publish --yes` — revisar con
`vercel firewall diff` antes de publicar.

```bash
vercel firewall rules add "Rate limit consulta SRI" \
  --condition '{"type":"path","op":"eq","value":"/api/clientes/consultar-identificacion"}' \
  --action rate_limit \
  --rate-limit-window 60 \
  --rate-limit-requests 20 \
  --rate-limit-keys ip \
  --rate-limit-action deny \
  --yes

vercel firewall diff
vercel firewall publish --yes
```

El límite de arriba es un punto de partida generoso (tráfico legítimo real de
un taller nunca se acerca a 20 consultas/min desde una sola IP) — si el dashboard
de Firewall muestra falsos positivos, subirlo.

---

## Backups / recuperación ante desastres

Supabase hace backups diarios automáticos en todos los planes, pero **Point-in-Time
Recovery (PITR)** — poder restaurar a un minuto específico, no solo al snapshot
de la noche anterior — requiere el add-on pago de PITR (Pro plan en adelante).
Sin PITR, perder datos entre el último backup diario y un `DELETE`/migración mal
corrida es un riesgo real para datos de facturación/inventario reales.

Antes de depender de esto en producción: confirmar en Supabase Dashboard →
Project Settings → Add-ons cuál es el plan/retención actual del proyecto
`metalmac-erp`, y si hace falta subir de plan para tener PITR.

---

## Comandos útiles post-deploy

```bash
# Aplicar nuevas migraciones
supabase db push

# Ver diff entre schema local y remoto
supabase db diff

# Ver logs de funciones/API en Vercel
vercel logs

# Correr seed contra otro proyecto (staging)
NEXT_PUBLIC_SUPABASE_URL=https://<staging-ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=... npm run seed

# Typecheck local
npm run typecheck
```

---

## Estructura de tablas (Postgres)

```
unidades_medida            → catálogo (seed)
categorias                 → catálogo (seed)
materiales                 → CRUD inventario
stock                      → 1:1 con materiales, mutada solo vía RPC
movimientos_inventario     → historial, insertado solo vía RPC (registrar_movimiento_inventario)
proveedores                → CRUD contabilidad
proveedores_contactos      → tabla hija de proveedores
tabla_equivalencias        → mapeo proveedor ↔ material
facturas_compra            → cabecera, mutada solo vía RPC
factura_compra_lineas      → líneas de factura de compra
factura_compra_retenciones → retenciones asociadas
productos                  → catálogo producción
boms                       → 1:1 con productos
bom_lineas                 → materiales del BOM
bom_operaciones            → operaciones del BOM
ordenes_produccion         → máquina de estados, mutada solo vía RPC (crear/reservar/consumir/liberar)
orden_materiales_reservados → reservas de materiales por orden
proyectos                  → costoReal atómico, mutado solo vía RPC (crear_proyecto)
gastos_proyecto             → mutado solo vía RPC (gastos_proyecto_aplicar_delta)
facturas_venta             → cabecera de venta
factura_venta_lineas       → líneas de factura de venta
perfiles                   → espejo legible de app_metadata.rol (Auth)
contadores_anuales         → secuencias OP-YYYY-NNNN, PRY-YYYY-NNNN (siguiente_secuencia_anual)
solicitudes_contacto       → leads del formulario de contacto de tallermac-web
pedidos_tienda             → pedidos del carrito de tallermac-web
```

Todas las tablas usan Row Level Security (`supabase/migrations/*_rls_policies.sql`); las mutaciones con reglas de negocio (stock, órdenes, proyectos, contadores) pasan por funciones RPC `SECURITY DEFINER` en vez de updates directos desde la API.
