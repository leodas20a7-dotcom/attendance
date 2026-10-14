import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ykdhjkzrprafzivvguhh.supabase.co';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrZGhqa3pycHJhZnppdnZndWhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNjk2OTYsImV4cCI6MjEwNjk0NTY5Nn0.EgQv8vIGqBzlHZJuGTQi3Ej8TPfmrgasAmXsKU7pNuM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * SQL script needed to create the tables in Supabase SQL Editor
 */
export const SUPABASE_SCHEMA_SQL = `-- 1. Branches Table
CREATE TABLE IF NOT EXISTS public.branches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Employees Table
CREATE TABLE IF NOT EXISTS public.employees (
  id TEXT PRIMARY KEY,
  branch_id TEXT REFERENCES public.branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Attendance Records Table
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

-- 4. Managers Table (Admin Created Store Managers)
CREATE TABLE IF NOT EXISTS public.managers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.managers ENABLE ROW LEVEL SECURITY;

-- 6. Allow Public (anon) Read/Write Access
DROP POLICY IF EXISTS "Public full access to branches" ON public.branches;
CREATE POLICY "Public full access to branches" ON public.branches FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access to employees" ON public.employees;
CREATE POLICY "Public full access to employees" ON public.employees FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access to attendance_records" ON public.attendance_records;
CREATE POLICY "Public full access to attendance_records" ON public.attendance_records FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access to managers" ON public.managers;
CREATE POLICY "Public full access to managers" ON public.managers FOR ALL USING (true) WITH CHECK (true);

-- 5. Circulars Table
CREATE TABLE IF NOT EXISTS public.circulars (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  sender TEXT DEFAULT 'Admin',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.circulars ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public full access to circulars" ON public.circulars;
CREATE POLICY "Public full access to circulars" ON public.circulars FOR ALL USING (true) WITH CHECK (true);
`;

/**
 * Check if Supabase tables exist and connection is live
 */
export async function checkSupabaseStatus() {
  try {
    const { data, error } = await supabase.from('branches').select('id').limit(1);
    if (error) {
      if (error.code === 'PGRST205' || error.message?.includes('not find')) {
        return { connected: true, tablesReady: false, message: 'Tables not yet created in Supabase.' };
      }
      return { connected: false, tablesReady: false, message: error.message };
    }
    return { connected: true, tablesReady: true, message: 'Connected to Supabase' };
  } catch (err) {
    return { connected: false, tablesReady: false, message: err.message };
  }
}

/**
 * Fetch all branches along with their employees from Supabase
 */
export async function fetchBranchesFromSupabase() {
  try {
    const { data: branchRows, error: branchErr } = await supabase
      .from('branches')
      .select('*')
      .order('created_at', { ascending: true });

    if (branchErr || !branchRows) return null;

    const { data: empRows, error: empErr } = await supabase
      .from('employees')
      .select('*')
      .order('created_at', { ascending: true });

    if (empErr) return null;

    // Group employees by branch
    const branchesWithEmps = branchRows.map(b => ({
      id: b.id,
      name: b.name,
      code: b.code || '',
      address: b.address || '',
      employees: (empRows || [])
        .filter(e => e.branch_id === b.id)
        .map(e => ({
          id: e.id,
          name: e.name,
          role: e.role || ''
        }))
    }));

    return branchesWithEmps;
  } catch (err) {
    console.error('Error fetching branches from Supabase:', err);
    return null;
  }
}

/**
 * Seed initial branches and employees to Supabase if tables exist but are empty
 */
export async function seedBranchesToSupabase(defaultBranches) {
  try {
    const { count } = await supabase.from('branches').select('*', { count: 'exact', head: true });
    if (count && count > 0) return false;

    // Insert branches
    for (const b of defaultBranches) {
      await supabase.from('branches').upsert({
        id: b.id,
        name: b.name,
        code: b.code || '',
        address: b.address || ''
      });

      if (b.employees && b.employees.length > 0) {
        for (const emp of b.employees) {
          await supabase.from('employees').upsert({
            id: emp.id,
            branch_id: b.id,
            name: emp.name,
            role: emp.role || ''
          });
        }
      }
    }
    return true;
  } catch (err) {
    console.error('Error seeding data to Supabase:', err);
    return false;
  }
}

/**
 * Insert or update a branch in Supabase
 */
export async function syncBranchToSupabase(branch) {
  try {
    await supabase.from('branches').upsert({
      id: branch.id,
      name: branch.name,
      code: branch.code || '',
      address: branch.address || ''
    });
  } catch (err) {
    console.warn('Failed to sync branch to Supabase:', err);
  }
}

/**
 * Delete a branch from Supabase
 */
export async function removeBranchFromSupabase(branchId) {
  try {
    await supabase.from('branches').delete().eq('id', branchId);
  } catch (err) {
    console.warn('Failed to delete branch from Supabase:', err);
  }
}

/**
 * Insert or update an employee in Supabase
 */
export async function syncEmployeeToSupabase(emp, branchId) {
  try {
    await supabase.from('employees').upsert({
      id: emp.id,
      branch_id: branchId,
      name: emp.name,
      role: emp.role || ''
    });
  } catch (err) {
    console.warn('Failed to sync employee to Supabase:', err);
  }
}

/**
 * Delete an employee from Supabase
 */
export async function removeEmployeeFromSupabase(empId) {
  try {
    await supabase.from('employees').delete().eq('id', empId);
  } catch (err) {
    console.warn('Failed to delete employee from Supabase:', err);
  }
}

/**
 * Fetch all attendance logs from Supabase
 */
export async function fetchAttendanceFromSupabase() {
  try {
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) return null;

    return data.map(r => ({
      id: r.id,
      employeeName: r.employee_name,
      employeeRole: r.employee_role || '',
      branchName: r.branch_name,
      type: r.type,
      date: r.date,
      time: r.time,
      shortTime: r.short_time,
      photo: r.photo,
      location: {
        lat: r.lat,
        lng: r.lng,
        placeName: r.place_name || ''
      }
    }));
  } catch (err) {
    console.error('Error fetching attendance from Supabase:', err);
    return null;
  }
}

/**
 * Save an attendance record to Supabase
 */
export async function saveAttendanceToSupabase(record) {
  try {
    const { error } = await supabase.from('attendance_records').insert({
      id: record.id,
      employee_name: record.employeeName,
      employee_role: record.employeeRole || '',
      branch_name: record.branchName,
      type: record.type,
      date: record.date,
      time: record.time,
      short_time: record.shortTime,
      photo: record.photo,
      lat: record.location?.lat,
      lng: record.location?.lng,
      place_name: record.location?.placeName || ''
    });
    if (error) {
      console.warn('Failed to insert attendance into Supabase:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Error saving attendance to Supabase:', err);
    return false;
  }
}

/**
 * Clear all attendance records from Supabase
 */
export async function clearAllAttendanceFromSupabase() {
  try {
    const { error } = await supabase.from('attendance_records').delete().neq('id', 'placeholder-none');
    if (error) {
      console.warn('Failed to clear attendance from Supabase:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Error clearing attendance from Supabase:', err);
    return false;
  }
}

/**
 * Fetch all managers from Supabase
 */
export async function fetchManagersFromSupabase() {
  try {
    const { data, error } = await supabase
      .from('managers')
      .select('*')
      .order('created_at', { ascending: true });

    if (error || !data) return null;

    return data.map(m => ({
      id: m.id,
      name: m.name,
      role: m.role || 'Store Manager',
      username: m.username,
      password: m.password,
      email: m.email || ''
    }));
  } catch (err) {
    console.warn('Error fetching managers from Supabase:', err);
    return null;
  }
}

/**
 * Insert or update a manager in Supabase
 */
export async function syncManagerToSupabase(manager) {
  try {
    await supabase.from('managers').upsert({
      id: manager.id,
      name: manager.name,
      role: manager.role || 'Store Manager',
      username: manager.username,
      password: manager.password,
      email: manager.email || ''
    });
  } catch (err) {
    console.warn('Failed to sync manager to Supabase:', err);
  }
}

/**
 * Delete a manager from Supabase
 */
export async function removeManagerFromSupabase(managerId) {
  try {
    await supabase.from('managers').delete().eq('id', managerId);
  } catch (err) {
    console.warn('Failed to delete manager from Supabase:', err);
  }
}

/**
 * Fetch all circulars from Supabase
 */
export async function fetchCircularsFromSupabase() {
  try {
    const { data, error } = await supabase
      .from('circulars')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) return null;

    return data.map(c => ({
      id: c.id,
      title: c.title,
      message: c.message,
      date: c.date,
      time: c.time,
      sender: c.sender || 'Admin',
      timestamp: c.created_at ? new Date(c.created_at).getTime() : Date.now()
    }));
  } catch (err) {
    console.warn('Error fetching circulars from Supabase:', err);
    return null;
  }
}

/**
 * Insert or update a circular in Supabase
 */
export async function syncCircularToSupabase(circular) {
  try {
    await supabase.from('circulars').upsert({
      id: circular.id,
      title: circular.title,
      message: circular.message,
      date: circular.date,
      time: circular.time,
      sender: circular.sender || 'Admin'
    });
  } catch (err) {
    console.warn('Failed to sync circular to Supabase:', err);
  }
}

/**
 * Delete a circular from Supabase
 */
export async function removeCircularFromSupabase(circularId) {
  try {
    await supabase.from('circulars').delete().eq('id', circularId);
  } catch (err) {
    console.warn('Failed to delete circular from Supabase:', err);
  }
}

