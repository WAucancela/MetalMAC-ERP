# MetalMAC ERP — Guía de Deploy: Vercel + Firebase

## Prerequisitos

- Node.js 18+
- Firebase CLI: `npm install -g firebase-tools`
- Cuenta Vercel (gratis funciona)
- Proyecto Firebase creado con Firestore, Auth y Storage habilitados

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

## Paso 3 — Configurar Firebase

### 3.1 Crear proyecto Firebase

1. Ve a [console.firebase.google.com](https://console.firebase.google.com)
2. Crea un proyecto: `metalmac-erp`
3. Activa **Firestore Database** (modo producción)
4. Activa **Authentication** → Proveedor: Email/Contraseña
5. Activa **Storage**

### 3.2 Obtener credenciales del cliente (NEXT_PUBLIC_*)

Firebase Console → Configuración del proyecto → Tus apps → Agregar app Web

Copia los valores a tu `.env.local`:

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=metalmac-erp.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=metalmac-erp
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=metalmac-erp.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

### 3.3 Obtener Service Account (Admin SDK)

Firebase Console → Configuración del proyecto → Cuentas de servicio → **Generar nueva clave privada**

Descarga el JSON y copia los campos a `.env.local`:

```env
FIREBASE_ADMIN_PROJECT_ID=metalmac-erp
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@metalmac-erp.iam.gserviceaccount.com
# La clave privada: reemplaza saltos de línea reales con \n literal
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
```

### 3.4 Actualizar .firebaserc

Edita `.firebaserc` y reemplaza `metalmac-erp` con el ID real de tu proyecto Firebase.

### 3.5 Desplegar reglas e índices

```bash
firebase login
firebase use --add   # selecciona tu proyecto
firebase deploy --only firestore:rules,firestore:indexes,storage
```

---

## Paso 4 — Seed de datos iniciales

Con `.env.local` configurado:

```bash
npm run seed
```

Esto crea en Firestore:
- **18 unidades de medida** (kg, lt, m, m², und, pza, etc.)
- **10 categorías de materiales** (aceros, insumos, pintura, etc.)

---

## Paso 5 — Crear primer usuario administrador

1. Ve a Firebase Console → Authentication → Agregar usuario
2. Crea el usuario con su email y contraseña
3. Ejecuta el script para asignarle rol GERENTE:

```bash
npm run create-admin -- gerente@metalmac.com
# Roles disponibles: GERENTE | BODEGUERO | PRODUCCION | CONTABILIDAD
npm run create-admin -- bodeguero@metalmac.com BODEGUERO
```

> ⚠️ El usuario debe cerrar sesión y volver a ingresar después de asignarle el rol.

---

## Paso 6 — Deploy en Vercel

### 6.1 Conectar repositorio

```bash
npm install -g vercel
vercel login
vercel link   # o conecta el repo desde vercel.com
```

### 6.2 Configurar variables de entorno en Vercel

En el dashboard de Vercel → Settings → Environment Variables, agrega **todas** las variables de `.env.local`:

| Variable | Entornos |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Production, Preview, Development |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Production, Preview, Development |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Production, Preview, Development |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Production, Preview, Development |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Production, Preview, Development |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Production, Preview, Development |
| `FIREBASE_ADMIN_PROJECT_ID` | Production, Preview |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Production, Preview |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Production, Preview |

> ⚠️ `FIREBASE_ADMIN_PRIVATE_KEY`: en Vercel pega el valor **con** los `\n` literales tal como está en `.env.local`. Vercel lo maneja correctamente.

### 6.3 Agregar dominio Vercel a Firebase Auth

Firebase Console → Authentication → Settings → Authorized domains → Agrega `tu-proyecto.vercel.app`

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
# Redesplegar reglas Firestore
firebase deploy --only firestore:rules

# Ver logs de funciones/API en Vercel
vercel logs

# Correr seed en staging
NEXT_PUBLIC_FIREBASE_PROJECT_ID=metalmac-erp-staging npm run seed

# Typecheck local
npm run typecheck
```

---

## Estructura de colecciones Firestore

```
unidades_medida/          → catálogo (seed)
categorias/               → catálogo (seed)
materiales/               → CRUD inventario
stock/{materialId}        → 1:1 con materiales, solo Admin SDK
movimientos_inventario/   → historial, solo Admin SDK
proveedores/              → CRUD contabilidad
  contactos/              → subcolección
tabla_equivalencias/      → mapeo proveedor ↔ material
facturas_compra/          → solo Admin SDK
bom/{productoId}          → 1:1 con productos
productos/                → catálogo producción
ordenes_produccion/       → solo Admin SDK (máquina de estados)
proyectos/                → solo Admin SDK (costoReal atómico)
gastos_proyecto/          → solo Admin SDK
_counters/                → secuencias OP-YYYY-NNNN, PRY-YYYY-NNNN
```
