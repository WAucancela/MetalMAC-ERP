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

## Integración WooCommerce (tallermac.com)

Los pedidos hechos en tallermac.com llegan al ERP vía webhook y quedan en una bandeja de
revisión (`/pedidos-woocommerce`) — nunca crean una Orden de Producción automáticamente.
El staff (GERENTE/PRODUCCION) decide manualmente qué línea de qué pedido se convierte en
qué orden.

Para esta fase (solo recepción) **no hace falta** generar Consumer Key/Secret de la REST
API de WooCommerce — sólo el secreto que WooCommerce genera al crear el webhook.

### Configurar el webhook en WordPress

Una vez el ERP esté desplegado en Vercel:

1. WordPress Admin → **WooCommerce → Ajustes → Avanzado → Webhooks → Agregar webhook**
2. Crea dos webhooks (uno por cada evento):
   - **Nombre**: `MetalMAC ERP — Pedido creado` / **Tema**: `Pedido creado`
   - **Nombre**: `MetalMAC ERP — Pedido actualizado` / **Tema**: `Pedido actualizado`
3. En ambos:
   - **URL de entrega**: `https://tu-proyecto.vercel.app/api/webhooks/woocommerce`
   - **Secreto**: genera una cadena aleatoria larga (ej. `openssl rand -hex 32`) y usa
     **el mismo valor en los dos webhooks**
   - **Estado**: Activo
4. Copia ese secreto como `WOOCOMMERCE_WEBHOOK_SECRET` en Vercel (Settings → Environment
   Variables) y vuelve a desplegar para que tome efecto.

### Verificar la conexión

1. Crea un pedido de prueba en tallermac.com (o reenvía la entrega desde WooCommerce →
   Webhooks → el webhook → pestaña "Entregas" → **Reenviar**)
2. Entra a `/pedidos-woocommerce` en el ERP → el pedido debe aparecer como **Pendiente**
3. Abre el pedido, revisa sus líneas y usa **Convertir a Orden de Producción** en la
   línea que corresponda — si el SKU de WooCommerce coincide con `productos.codigo`, el
   producto viene pre-seleccionado

### Mapeo de SKU

Cada línea intenta resolverse automáticamente contra `productos.codigo` por coincidencia
exacta (sin distinguir mayúsculas). Si no hay match, la línea llega sin producto
pre-seleccionado y el staff lo elige a mano en la bandeja de revisión — asegúrate de que
los SKU en tallermac.com coincidan con los códigos de producto del ERP para aprovechar el
auto-match.

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
pedidos_woocommerce        → bandeja de revisión, cabecera de pedidos de tallermac.com
pedido_woocommerce_lineas  → líneas del pedido; producto_id resuelto por SKU, orden_produccion_id al convertir
```

Todas las tablas usan Row Level Security (`supabase/migrations/*_rls_policies.sql`); las mutaciones con reglas de negocio (stock, órdenes, proyectos, contadores) pasan por funciones RPC `SECURITY DEFINER` en vez de updates directos desde la API.
