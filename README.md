# Convenio Marts - Employee Attendance System

A clean, modern, and mobile-friendly Attendance & Branch Management web application with live front-camera verification, geolocation capture, and Supabase cloud persistence.

---

## Features

- **Front-Camera Only Capture**: Direct live selfie verification. No gallery upload bypass.
- **GPS Location Detection**: High-accuracy latitude, longitude, and reverse-geocoded place names.
- **Multi-Branch & Employee Roster**:
  - Casagrand Royale (Sholinganallur)
  - Casagrand Sereno (Ottiyapakkam)
  - Casagrand Savoye (Karapakkam)
  - Advaita Blossom (Kelambakkam)
  - Casagrand Woodside (Manapakkam)
  - Casagrand Utopia (Manapakkam)
  - KYM Market (Inside Market)
  - Casagrand Castle (Manapakkam)
  - Casagrand Tudoor (Mogappair)
- **Supabase Cloud Database**: Real-time sync for branches, employees, and check-in/check-out logs.
- **Offline & Fallback Resilient**: Local storage caching ensures seamless attendance even during network drops.
- **Admin Management Console**: Add/edit branch names, manage staff rosters, and inspect attendance records with photos.

---

## Tech Stack

- **React 18** + **Vite**
- **Lucide Icons**
- **Supabase JS Client** (`@supabase/supabase-js`)
- **Vanilla CSS** with responsive design

---

## Setup & Running Locally

1. **Clone the repository**:
   ```bash
   git clone https://github.com/leodas20a7-dotcom/attendance.git
   cd attendance
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file with your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=https://ykdhjkzrprafzivvguhh.supabase.co
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Start the Development Server**:
   ```bash
   npm run dev
   ```

5. **Build for Production**:
   ```bash
   npm run build
   ```

---

## Database Schema (Supabase)

Run the following SQL in your Supabase SQL Editor if creating a new project:

```sql
CREATE TABLE IF NOT EXISTS public.branches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.employees (
  id TEXT PRIMARY KEY,
  branch_id TEXT REFERENCES public.branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id TEXT PRIMARY KEY,
  employee_name TEXT NOT NULL,
  employee_role TEXT,
  branch_name TEXT NOT NULL,
  type TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  short_time TEXT,
  photo TEXT,
  lat NUMERIC,
  lng NUMERIC,
  place_name TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public full access to branches" ON public.branches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access to employees" ON public.employees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access to attendance_records" ON public.attendance_records FOR ALL USING (true) WITH CHECK (true);
```
