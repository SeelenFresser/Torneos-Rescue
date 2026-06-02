# ⚔️ Torneo Manager

App web para torneos locales de **Magic Commander**, **Standard Bo3** y **Beyblade Bo3**.  
Multi-usuario en tiempo real · Login con Supabase · Deploy en Vercel.

---

## 🚀 Cómo hacer el deploy (paso a paso)

### 1. Crear el proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) → **New project**
2. Elige nombre, contraseña y región (US East o el más cercano)
3. Espera que termine de crear (~2 min)

### 2. Crear las tablas

1. En tu proyecto Supabase → **SQL Editor** → **New Query**
2. Copia y pega todo el contenido de **`schema.sql`**
3. Haz clic en **Run**

### 3. Habilitar Realtime

1. Ve a **Database → Replication**
2. En la sección "Supabase Realtime", habilita las tablas:
   - `tournaments`
   - `players`
   - `matches`

### 4. Deshabilitar confirmación de email (para facilidad)

1. Ve a **Authentication → Providers → Email**
2. Desactiva **Confirm email**
3. Guarda

### 5. Configurar tu URL y ANON KEY

1. En Supabase → **Settings → API**
2. Copia el **Project URL** y el **anon public** key
3. Abre el archivo **`js/supabase.js`** y reemplaza:

```js
const SUPABASE_URL = 'https://TU_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'TU_ANON_KEY';
```

### 6. Agregar dominio de Vercel a Supabase

*(Haz esto después de hacer deploy en Vercel)*

1. En Supabase → **Authentication → URL Configuration**
2. En **Site URL**: pon tu URL de Vercel (ej: `https://torneo-manager.vercel.app`)
3. En **Redirect URLs**: agrega la misma URL

### 7. Deploy en Vercel

**Opción A — Desde GitHub (recomendado):**
1. Sube la carpeta a un repositorio de GitHub
2. Ve a [vercel.com](https://vercel.com) → **New Project**
3. Importa tu repositorio
4. Haz clic en **Deploy** (sin cambiar nada)

**Opción B — Desde Vercel CLI:**
```bash
npm i -g vercel
cd torneo-app
vercel
```

---

## 🎮 Cómo usar la app

### Commander (Pods)
- Agrega de **2 a 32 jugadores**
- Genera pods automáticamente (mesas de 4, con ajuste si sobran)
- Asigna el lugar de cada jugador (1°, 2°, 3°, 4°)
- Los puntos se calculan: **1° = 10 · 2° = 6 · 3° = 3 · 4° = 1**
- Pods de 3: 7/4/1 · Pods de 2: 5/1
- Guarda los resultados → avanza de ronda automáticamente

### Standard Bo3
- **Swiss**: todos juegan, se emparejan por puntos. V=3pts, E=1pt
- **Eliminación directa**: el que pierde sale
- Marca el resultado en formato Bo3 (ej: 2-0 o 2-1)
- La app detecta automáticamente el ganador

### Beyblade Bo3
- Igual que Standard pero con campo para el nombre del Beyblade
- Funciona con Swiss o Eliminación directa

### Tiempo real
- Varios usuarios pueden estar en el mismo torneo
- Los resultados se actualizan al instante para todos
- El organizador controla quién puede modificar (solo el creador puede editar)

---

## 📁 Estructura de archivos

```
torneo-app/
├── index.html          # App principal
├── vercel.json         # Config de Vercel
├── schema.sql          # Tablas y RLS de Supabase
├── css/
│   └── style.css       # Estilos dark gaming
└── js/
    ├── supabase.js     # ← PON AQUÍ TU URL Y KEY
    ├── auth.js         # Login / registro / logout
    ├── dashboard.js    # Lista y creación de torneos
    ├── tournament.js   # Carga y lógica base del torneo
    ├── commander.js    # Pods Commander
    ├── swiss.js        # Sistema Swiss
    ├── elimination.js  # Eliminación directa
    ├── realtime.js     # Suscripciones en tiempo real
    └── app.js          # Utilidades e inicialización
```
