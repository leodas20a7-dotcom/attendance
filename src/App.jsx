import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  LogIn, 
  LogOut, 
  Camera, 
  RefreshCw, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  User, 
  Search, 
  Trash2, 
  ExternalLink, 
  X, 
  Loader2, 
  Eye, 
  AlertCircle,
  Navigation,
  Copy,
  Check,
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  CheckSquare,
  Square,
  FileSpreadsheet,
  Building2,
  History,
  Pencil,
  Plus,
  Users,
  UserPlus,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  Store,
  ShieldCheck,
  ShieldAlert,
  Database,
  Cloud,
  Lock,
  Mail,
  EyeOff,
  Settings,
  Activity,
  FileText,
  Filter,
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Megaphone,
  Send,
  Download
} from 'lucide-react';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { 
  getCurrentDeviceLocation, 
  findNearestBranch, 
  formatDistance,
  DEFAULT_GEOFENCE_RADIUS_METERS 
} from './lib/geo';

import { 
  DEFAULT_BRANCHES,
  getStoredBranches, 
  saveStoredBranches, 
  getStoredAdminLogs,
  saveStoredAdminLogs,
  DEFAULT_MANAGERS,
  getStoredManagers,
  saveStoredManagers,
  STORAGE_KEY_BRANCHES, 
  STORAGE_KEY_RECORDS,
  STORAGE_KEY_SELECTED_BRANCH,
  STORAGE_KEY_SELECTED_EMP,
  getStoredCirculars,
  saveStoredCirculars
} from './data/defaultBranches';

import { 
  checkSupabaseStatus, 
  fetchBranchesFromSupabase, 
  seedBranchesToSupabase, 
  syncBranchToSupabase, 
  removeBranchFromSupabase, 
  syncEmployeeToSupabase, 
  removeEmployeeFromSupabase, 
  fetchAttendanceFromSupabase, 
  saveAttendanceToSupabase,
  clearAllAttendanceFromSupabase,
  fetchManagersFromSupabase,
  syncManagerToSupabase,
  removeManagerFromSupabase,
  fetchCircularsFromSupabase,
  syncCircularToSupabase,
  removeCircularFromSupabase,
  SUPABASE_SCHEMA_SQL
} from './lib/supabase';

import {
  initPwaManager,
  promptPwaInstall,
  applyImmediateUpdate,
  checkForAppUpdate,
  dismissUpdateNotification,
  getDeviceInfo,
  isAppInstalled
} from './lib/pwaManager';

// Helper to format any time string strictly in 12-hour AM/PM format (e.g. "03:05:24 PM")
export function formatTo12HourTime(timeStr) {
  if (!timeStr) return '';
  const str = String(timeStr).trim();

  // Already 12-hour format with AM/PM (e.g. "03:04:01 PM", "02:58:56 pm", "8:17:39 AM")
  const ampmMatch = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = ampmMatch[2];
    const seconds = ampmMatch[3];
    const ampm = ampmMatch[4].toUpperCase();
    if (hours === 0) hours = 12;
    if (hours > 12) hours = hours % 12;
    const formattedHour = String(hours).padStart(2, '0');
    return seconds !== undefined
      ? `${formattedHour}:${minutes}:${seconds} ${ampm}`
      : `${formattedHour}:${minutes} ${ampm}`;
  }

  // 24-hour format: HH:MM:SS or HH:MM (e.g. "15:05:24" -> "03:05:24 PM")
  const timeMatch = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2];
    const seconds = timeMatch[3];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;
    const formattedHour = String(hours).padStart(2, '0');
    return seconds !== undefined
      ? `${formattedHour}:${minutes}:${seconds} ${ampm}`
      : `${formattedHour}:${minutes} ${ampm}`;
  }

  // Full Date / ISO timestamp string
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  }

  // Fallback: uppercase any am/pm in string
  if (/\b(am|pm)\b/i.test(str)) {
    return str.replace(/([0-9])\s*(am|pm)/i, (_, d, p) => `${d} ${p.toUpperCase()}`);
  }

  return str;
}

/**
 * Compress an image data URL to a maximum dimension (480px) and JPEG quality (0.72).
 * Drastically reduces file size from ~1MB down to ~30-45KB (95% reduction),
 * enabling lightning-fast database uploads, preventing localStorage quota errors,
 * and saving mobile bandwidth while preserving facial verification quality.
 */
export async function compressImageDataUrl(dataUrl, maxDimension = 480, quality = 0.72) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) {
    return dataUrl;
  }

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            if (width >= height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(dataUrl);
            return;
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed);
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    } catch {
      resolve(dataUrl);
    }
  });
}

export default function App() {
  // Navigation: 'attendance' or 'admin'
  const getInitialView = () => {
    const path = window.location.pathname;
    const hash = window.location.hash;
    const search = window.location.search;
    if (
      path.startsWith('/admin') || 
      path.startsWith('/history') || 
      hash === '#admin' || 
      hash.startsWith('#admin') || 
      hash === '#history' ||
      search.includes('admin') ||
      search.includes('view=admin')
    ) {
      return 'admin';
    }
    return 'attendance';
  };

  const [view, setView] = useState(getInitialView);
  // Admin sub-tab: 'branches' or 'logs'
  const [adminTab, setAdminTab] = useState('branches');

  // Flash / Splash Loading Screen State (disabled blocking delay for instant paint & high performance)
  const [appLoading, setAppLoading] = useState(false);
  const [loadingFadingOut, setLoadingFadingOut] = useState(false);

  // Admin & Manager Authentication State
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => {
    try {
      return sessionStorage.getItem('convenio_admin_auth') === 'true';
    } catch {
      return false;
    }
  });
  const [authRole, setAuthRole] = useState(() => {
    try {
      return sessionStorage.getItem('convenio_auth_role') || 'admin';
    } catch {
      return 'admin';
    }
  });
  const [currentManagerName, setCurrentManagerName] = useState(() => {
    try {
      return sessionStorage.getItem('convenio_manager_name') || '';
    } catch {
      return '';
    }
  });

  // Login Form States (Role tab: 'admin' or 'manager')
  const [loginRoleTab, setLoginRoleTab] = useState('admin');
  const [managersList, setManagersList] = useState(getStoredManagers);
  const [showAddManagerModal, setShowAddManagerModal] = useState(false);
  const [newManagerName, setNewManagerName] = useState('');
  const [newManagerRole, setNewManagerRole] = useState('');
  const [newManagerUsername, setNewManagerUsername] = useState('');
  const [newManagerPassword, setNewManagerPassword] = useState('');
  const [newManagerEmail, setNewManagerEmail] = useState('');
  const [copiedManagerId, setCopiedManagerId] = useState(null);
  const [visiblePasswords, setVisiblePasswords] = useState({});

  // Circulars State (Common to all, admin only sends)
  const [circulars, setCirculars] = useState(getStoredCirculars);
  const [newCircularTitle, setNewCircularTitle] = useState('');
  const [newCircularMessage, setNewCircularMessage] = useState('');
  const [circularSuccessMsg, setCircularSuccessMsg] = useState('');

  // Monthly Timesheet State (Admin only)
  const [timesheetYear, setTimesheetYear] = useState(() => new Date().getFullYear());
  const [timesheetMonth, setTimesheetMonth] = useState(() => new Date().getMonth());
  const [timesheetBranchId, setTimesheetBranchId] = useState('all');
  const [timesheetSearch, setTimesheetSearch] = useState('');

  // Individual Staff Attendance Calendar Modal State
  const [calendarStaff, setCalendarStaff] = useState(null);
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth());
  const [calendarSelectedDay, setCalendarSelectedDay] = useState(null);
  const [calendarSlideDir, setCalendarSlideDir] = useState('fade');

  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminAuthError, setAdminAuthError] = useState('');
  const [isAdminLoggingIn, setIsAdminLoggingIn] = useState(false);

  // Master Branch & Employee Data
  const [branches, setBranches] = useState(getStoredBranches);

  // Selected Branch and Employee for the Attendance Form
  const [selectedBranchId, setSelectedBranchId] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_SELECTED_BRANCH);
    const branchList = getStoredBranches();
    if (saved && branchList.some(b => b.id === saved)) {
      return saved;
    }
    return branchList.length > 0 ? branchList[0].id : '';
  });

  const [selectedEmpId, setSelectedEmpId] = useState(() => {
    return localStorage.getItem(STORAGE_KEY_SELECTED_EMP) || '';
  });

  // Typed employee name search & disambiguation input
  const [typedEmpName, setTypedEmpName] = useState('');
  const [formValidationMsg, setFormValidationMsg] = useState('');

  // 50-Meter GPS Geofencing & Anti-Proxy Attendance State
  // Status: 'checking' | 'in_range' | 'out_of_range' | 'denied' | 'unavailable'
  const [geoStatus, setGeoStatus] = useState('checking');
  const [geoData, setGeoData] = useState(null); // { nearestBranch, distanceMeters, isWithinGeofence, userLat, userLng, accuracy }
  const [geoErrorMsg, setGeoErrorMsg] = useState('');

  // PWA & Instant Update States
  const [canInstallPwa, setCanInstallPwa] = useState(() => !isAppInstalled());
  const [appUpdateAvailable, setAppUpdateAvailable] = useState(false);
  const [isUpdatingApp, setIsUpdatingApp] = useState(false);
  const [showInstallGuideModal, setShowInstallGuideModal] = useState(false);

  const handleInstallClick = async () => {
    const accepted = await promptPwaInstall();
    if (!accepted) {
      setShowInstallGuideModal(true);
    }
  };

  // Attendance Records
  const [records, setRecords] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_RECORDS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Camera & Capture State (Strictly Live Front Camera Only - No Gallery Upload)
  const [cameraActive, setCameraActive] = useState(false);
  const [currentActionType, setCurrentActionType] = useState(null); // 'in' or 'out'
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Success Feedback Modal
  const [successData, setSuccessData] = useState(null);

  // Detailed Record Modal
  const [selectedRecord, setSelectedRecord] = useState(null);

  // Full-size Photo Viewer Modal
  const [viewingPhoto, setViewingPhoto] = useState(null);

  // Attendance Logs Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [copiedRecordId, setCopiedRecordId] = useState(null);

  // Attendance Logs Date Filter State
  const [showDateFilterModal, setShowDateFilterModal] = useState(false);
  const [dateFilterMode, setDateFilterMode] = useState('all'); // 'all' | 'single' | 'range'
  const [filterSingleDate, setFilterSingleDate] = useState(''); // YYYY-MM-DD
  const [filterStartDate, setFilterStartDate] = useState(''); // YYYY-MM-DD
  const [filterEndDate, setFilterEndDate] = useState(''); // YYYY-MM-DD

  // Temp states inside Date Filter Modal
  const [tempFilterMode, setTempFilterMode] = useState('single');
  const [tempSingleDate, setTempSingleDate] = useState('');
  const [tempStartDate, setTempStartDate] = useState('');
  const [tempEndDate, setTempEndDate] = useState('');

  // Attendance Logs Pagination State
  const [logPage, setLogPage] = useState(1);
  const [logPageSize, setLogPageSize] = useState(10);

  // Quick Attendance History Drawer
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [historyFilterType, setHistoryFilterType] = useState('all');
  const [historyScope, setHistoryScope] = useState('all'); // 'employee' or 'all'
  const [historySelectedStaff, setHistorySelectedStaff] = useState(''); // Selected staff filter inside drawer

  // ================= ADMIN BRANCH & EMPLOYEE EDIT STATE =================
  const [adminSelectedBranchId, setAdminSelectedBranchId] = useState(() => {
    const branchList = getStoredBranches();
    return branchList.length > 0 ? branchList[0].id : '';
  });

  // Add Branch Form State
  const [showAddBranchModal, setShowAddBranchModal] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchCode, setNewBranchCode] = useState('');
  const [newBranchAddress, setNewBranchAddress] = useState('');

  // Edit Branch Modal State
  const [editingBranch, setEditingBranch] = useState(null); // { id, name, code, address }

  // Add Employee Form State
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpRole, setNewEmpRole] = useState('');

  // Edit Employee Modal State
  const [editingEmp, setEditingEmp] = useState(null); // { branchId, empId, name, role, targetBranchId }

  // Staff Transfer States (Option C: Quick 1-click & Bulk Transfer)
  const [transferModalStaff, setTransferModalStaff] = useState(null); // { emp, fromBranchId, toBranchId }
  const [selectedEmpIds, setSelectedEmpIds] = useState([]); // Array of IDs selected for bulk actions
  const [bulkTargetBranchId, setBulkTargetBranchId] = useState('');
  const [transferToast, setTransferToast] = useState(null); // { message, type: 'success' | 'info' }

  // Admin Security Password Confirmation for Delete
  const [deleteModal, setDeleteModal] = useState(null); // { type, targetId, branchId, targetName, empCount }
  const [deletePasswordInput, setDeletePasswordInput] = useState('');
  const [deletePasswordError, setDeletePasswordError] = useState('');
  const [showDeletePassword, setShowDeletePassword] = useState(false);

  // Admin Action Audit Logs & Settings (Only real actions, no fake/dummy entries)
  const [adminLogs, setAdminLogs] = useState(() => {
    const stored = getStoredAdminLogs();
    if (stored && Array.isArray(stored)) {
      // Remove any fake starter seed entries like 'act-init' or 'initialized'
      const realLogs = stored.filter(l => l.id !== 'act-init' && l.category !== 'system' && !l.title?.toLowerCase().includes('initialized'));
      if (realLogs.length !== stored.length) {
        saveStoredAdminLogs(realLogs);
      }
      return realLogs;
    }
    return [];
  });

  const handleClearAdminLogs = () => {
    if (window.confirm('Are you sure you want to clear all action history logs?')) {
      setAdminLogs([]);
      saveStoredAdminLogs([]);
    }
  };
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [adminLogSearch, setAdminLogSearch] = useState('');
  const [adminLogCategoryFilter, setAdminLogCategoryFilter] = useState('all');

  const logAdminAction = (category, title, details = {}) => {
    const now = new Date();
    const newLog = {
      id: 'act-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      timestamp: now.toISOString(),
      dateStr: now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      timeStr: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
      category,
      title,
      details
    };

    setAdminLogs(prev => {
      const updated = [newLog, ...prev].slice(0, 500);
      saveStoredAdminLogs(updated);
      return updated;
    });
  };

  const exportAdminLogsToCSV = () => {
    if (adminLogs.length === 0) return;
    const headers = ['Log ID', 'Category', 'Action Title', 'Date', 'Time', 'Details'];
    const rows = adminLogs.map(l => [
      `"${l.id}"`,
      `"${l.category}"`,
      `"${l.title.replace(/"/g, '""')}"`,
      `"${l.dateStr}"`,
      `"${formatTo12HourTime(l.timeStr)}"`,
      `"${JSON.stringify(l.details).replace(/"/g, '""')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Convenio_Admin_Action_History_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Admin search inside employee roster
  const [adminEmpSearch, setAdminEmpSearch] = useState('');

  // Supabase Cloud State
  const [supabaseStatus, setSupabaseStatus] = useState({ connected: false, tablesReady: false });
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Connect and sync with Supabase on mount
  useEffect(() => {
    async function initSupabase() {
      setIsSyncing(true);
      try {
        const status = await checkSupabaseStatus();
        setSupabaseStatus(status);

        if (status.tablesReady) {
          // Concurrently fetch branches, attendance records, managers & circulars from Supabase
          const [cloudBranches, cloudRecords, cloudManagers, cloudCirculars] = await Promise.all([
            fetchBranchesFromSupabase(),
            fetchAttendanceFromSupabase(),
            fetchManagersFromSupabase(),
            fetchCircularsFromSupabase()
          ]);

          if (cloudBranches && cloudBranches.length > 0) {
            setBranches(cloudBranches);
          } else {
            // Tables exist but are empty: seed Casagrand branches
            await seedBranchesToSupabase(DEFAULT_BRANCHES);
            const seeded = await fetchBranchesFromSupabase();
            if (seeded && seeded.length > 0) {
              setBranches(seeded);
            }
          }

          if (cloudRecords !== null) {
            setRecords(cloudRecords);
            try {
              localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(cloudRecords));
            } catch (e) {
              console.warn('Failed to cache cloud records:', e);
            }
          }

          if (cloudManagers && Array.isArray(cloudManagers) && cloudManagers.length > 0) {
            setManagersList(cloudManagers);
            saveStoredManagers(cloudManagers);
          }

          if (cloudCirculars && Array.isArray(cloudCirculars) && cloudCirculars.length > 0) {
            setCirculars(cloudCirculars);
            saveStoredCirculars(cloudCirculars);
          }
        }
      } catch (err) {
        console.error('Supabase init error:', err);
      } finally {
        setIsSyncing(false);
      }
    }

    initSupabase();
  }, []);


  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  // Sync circulars to localStorage
  useEffect(() => {
    saveStoredCirculars(circulars);
  }, [circulars]);

  // Sync branches to localStorage
  useEffect(() => {
    saveStoredBranches(branches);
  }, [branches]);

  // Sync attendance records to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(records));
    } catch (e) {
      console.error('Error saving records', e);
    }
  }, [records]);

  // Save selected branch and employee to localStorage
  useEffect(() => {
    if (selectedBranchId) {
      localStorage.setItem(STORAGE_KEY_SELECTED_BRANCH, selectedBranchId);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    if (selectedEmpId) {
      localStorage.setItem(STORAGE_KEY_SELECTED_EMP, selectedEmpId);
    }
  }, [selectedEmpId]);

  // If selected branch changes and current selected employee is not in it, update selected employee
  useEffect(() => {
    const currentBranch = branches.find(b => b.id === selectedBranchId);
    if (currentBranch && currentBranch.employees) {
      const exists = currentBranch.employees.some(e => e.id === selectedEmpId);
      if (!exists) {
        setSelectedEmpId('');
        setTypedEmpName('');
      } else if (exists && !typedEmpName) {
        const found = currentBranch.employees.find(e => e.id === selectedEmpId);
        if (found) setTypedEmpName(found.name);
      }
    }
  }, [selectedBranchId, branches]);

  // Clear bulk staff selection when changing active branch in Admin
  useEffect(() => {
    setSelectedEmpIds([]);
    setBulkTargetBranchId('');
  }, [adminSelectedBranchId]);

  // Geofence Location Evaluation Handler (Checks if user is within 50m of any branch)
  const checkGeofenceLocation = async (customBranchesList) => {
    setGeoStatus('checking');
    setGeoErrorMsg('');
    const branchList = customBranchesList || branches;

    try {
      const pos = await getCurrentDeviceLocation();
      const evalResult = findNearestBranch(pos.lat, pos.lng, branchList);

      setGeoData({
        ...evalResult,
        userLat: pos.lat,
        userLng: pos.lng,
        accuracy: pos.accuracy
      });

      if (evalResult.isWithinGeofence) {
        setGeoStatus('in_range');
        if (evalResult.nearestBranch) {
          setSelectedBranchId(evalResult.nearestBranch.id);
          localStorage.setItem(STORAGE_KEY_SELECTED_BRANCH, evalResult.nearestBranch.id);
        }
      } else {
        setGeoStatus('out_of_range');
      }
    } catch (err) {
      console.warn('Geofence check warning:', err);
      const isDenied = err.code === 'PERMISSION_DENIED';
      setGeoStatus(isDenied ? 'denied' : 'unavailable');
      setGeoErrorMsg(err.message || 'Unable to detect store location');
    }
  };

  useEffect(() => {
    if (view === 'attendance') {
      checkGeofenceLocation(branches);
    }
  }, [view]);

  // Handle URL navigation
  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      const search = window.location.search;
      if (
        path.startsWith('/admin') || 
        path.startsWith('/history') || 
        hash === '#admin' || 
        hash.startsWith('#admin') || 
        hash === '#history' ||
        search.includes('admin') ||
        search.includes('view=admin')
      ) {
        setView('admin');
      } else {
        setView('attendance');
      }
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  // Initialize PWA and Smart Deploy Update Detector
  useEffect(() => {
    const cleanup = initPwaManager({
      onUpdateAvailable: () => setAppUpdateAvailable(true),
      onInstallableChange: (canInstall) => setCanInstallPwa(canInstall)
    });
    return cleanup;
  }, []);

  const navigateTo = (newView) => {
    setView(newView);
    const path = newView === 'admin' ? '/admin' : '/';
    try {
      window.history.pushState({}, '', path);
    } catch {
      window.location.hash = newView;
    }
    window.scrollTo(0, 0);
  };

  // Smart Manager/Admin navigation triggers:
  // 1. Long-press / Click & Hold (1.3s) on Mobile & Desktop
  // 2. Right-click context menu on Desktop
  // 3. Triple-click on logo
  const [isHoldingLogo, setIsHoldingLogo] = useState(false);
  const logoHoldTimerRef = useRef(null);
  const didTriggerHoldRef = useRef(false);
  const logoClickRef = useRef({ count: 0, lastTime: 0 });

  const startLogoHold = (e) => {
    // Only primary button for mouse (button 0)
    if (e.type === 'mousedown' && e.button !== 0) return;
    didTriggerHoldRef.current = false;
    setIsHoldingLogo(true);
    if (logoHoldTimerRef.current) clearTimeout(logoHoldTimerRef.current);
    logoHoldTimerRef.current = setTimeout(() => {
      didTriggerHoldRef.current = true;
      setIsHoldingLogo(false);
      try {
        if (navigator.vibrate) navigator.vibrate([40, 30, 40]);
      } catch (err) {}
      navigateTo('admin');
    }, 1300);
  };

  const cancelLogoHold = () => {
    setIsHoldingLogo(false);
    if (logoHoldTimerRef.current) {
      clearTimeout(logoHoldTimerRef.current);
      logoHoldTimerRef.current = null;
    }
  };

  const handleLogoContextMenu = (e) => {
    e.preventDefault();
    try {
      if (navigator.vibrate) navigator.vibrate(30);
    } catch (err) {}
    navigateTo('admin');
  };

  const handleLogoClick = () => {
    if (didTriggerHoldRef.current) {
      didTriggerHoldRef.current = false;
      return;
    }
    const now = Date.now();
    if (now - logoClickRef.current.lastTime < 500) {
      logoClickRef.current.count += 1;
    } else {
      logoClickRef.current.count = 1;
    }
    logoClickRef.current.lastTime = now;

    if (logoClickRef.current.count >= 3) {
      logoClickRef.current.count = 0;
      navigateTo('admin');
    } else if (view !== 'attendance') {
      navigateTo('attendance');
    }
  };

  // Keyboard shortcut for Desktop: Ctrl + Shift + A or Alt + L
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      const isCtrlShiftA = (e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a');
      const isAltL = e.altKey && (e.key === 'L' || e.key === 'l');
      if (isCtrlShiftA || isAltL) {
        e.preventDefault();
        navigateTo(view === 'admin' ? 'attendance' : 'admin');
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [view]);

  // Currently active branch on attendance form
  const currentFormBranch = branches.find(b => b.id === selectedBranchId);
  const currentBranchEmployees = currentFormBranch?.employees || [];

  // All registered employees across all 8 branches (Master Company Staff Roster)
  // Allows any company employee to check in at any branch even without prior admin transfer approval
  const allCompanyEmployees = useMemo(() => {
    const list = [];
    branches.forEach(b => {
      (b.employees || []).forEach(emp => {
        list.push({
          ...emp,
          homeBranchId: b.id,
          homeBranchName: b.name
        });
      });
    });
    return list;
  }, [branches]);

  // Active employee on form: can be from the local branch or visiting/transferred from any other branch
  const currentFormEmployee = useMemo(() => {
    if (!selectedEmpId) return null;
    return allCompanyEmployees.find(e => e.id === selectedEmpId) || null;
  }, [selectedEmpId, allCompanyEmployees]);

  // Active employee name on attendance form - strictly from verified employee list only
  const activeFormEmpName = currentFormEmployee ? currentFormEmployee.name : '';

  // Match typed name against official company employee list across all branches
  // Waits for at least 4 characters before matching
  const matchedCompanyEmployees = useMemo(() => {
    const q = typedEmpName.trim().toLowerCase();
    if (!q || q.length < 4) return [];
    const cleanQ = q.replace(/[^a-z0-9\s]/g, '');
    if (!cleanQ || cleanQ.length < 4) return [];

    return allCompanyEmployees.filter(emp => {
      const rawName = (emp.name || '').toLowerCase();
      const cleanName = rawName.replace(/[^a-z0-9\s]/g, '');
      if (cleanName === cleanQ) return true;
      if (cleanName.startsWith(cleanQ)) return true;
      if (cleanQ.startsWith(cleanName)) return true;
      if (cleanName.includes(cleanQ)) return true;
      const words = cleanName.split(/\s+/);
      return words.some(w => w.startsWith(cleanQ));
    });
  }, [typedEmpName, allCompanyEmployees]);

  // Handler for typing in the name box below dropdown
  const handleTypedNameChange = (val) => {
    setTypedEmpName(val);
    if (formValidationMsg) setFormValidationMsg('');
    const q = val.trim().toLowerCase();
    
    // Wait for at least 4 characters before checking against employee list
    if (!q || q.length < 4) {
      setSelectedEmpId('');
      return;
    }
    const cleanQ = q.replace(/[^a-z0-9\s]/g, '');
    if (!cleanQ || cleanQ.length < 4) {
      setSelectedEmpId('');
      return;
    }

    const matches = allCompanyEmployees.filter(emp => {
      const rawName = (emp.name || '').toLowerCase();
      const cleanName = rawName.replace(/[^a-z0-9\s]/g, '');
      if (cleanName === cleanQ) return true;
      if (cleanName.startsWith(cleanQ)) return true;
      if (cleanQ.startsWith(cleanName)) return true;
      if (cleanName.includes(cleanQ)) return true;
      const words = cleanName.split(/\s+/);
      return words.some(w => w.startsWith(cleanQ));
    });

    if (matches.length === 1) {
      // Exactly 1 match found in company roster -> auto-select
      setSelectedEmpId(matches[0].id);
    } else if (matches.length > 1) {
      // Duplicate / multiple matches -> user MUST explicitly choose which one
      if (!matches.some(m => m.id === selectedEmpId)) {
        setSelectedEmpId('');
      }
    } else {
      // 0 matches found in company roster -> clear selection so invalid names cannot be recorded
      setSelectedEmpId('');
    }
  };

  // Helper to reliably check if a record was recorded today across any browser locale / format
  const isRecordToday = useCallback((r) => {
    if (!r) return false;
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    const curDate = now.getDate();

    // 1. Try parsing numeric timestamp from ID (e.g. REC-1791438659468)
    if (r.id && typeof r.id === 'string' && r.id.startsWith('REC-')) {
      const ts = Number(r.id.slice(4));
      if (!isNaN(ts) && ts > 1600000000000) {
        const d = new Date(ts);
        if (d.getFullYear() === curYear && d.getMonth() === curMonth && d.getDate() === curDate) {
          return true;
        }
      }
    }

    // 2. Try explicit timestamp property
    if (r.timestamp && !isNaN(Number(r.timestamp))) {
      const d = new Date(Number(r.timestamp));
      if (d.getFullYear() === curYear && d.getMonth() === curMonth && d.getDate() === curDate) {
        return true;
      }
    }

    // 3. Try created_at (Supabase ISO timestamp)
    if (r.created_at) {
      const d = new Date(r.created_at);
      if (!isNaN(d.getTime())) {
        if (d.getFullYear() === curYear && d.getMonth() === curMonth && d.getDate() === curDate) {
          return true;
        }
      }
    }

    // 4. Try parsing r.date (handles "8 Oct 2026", "Oct 8, 2026", "2026-10-08", etc.)
    if (r.date) {
      const d = new Date(r.date);
      if (!isNaN(d.getTime())) {
        if (d.getFullYear() === curYear && d.getMonth() === curMonth && d.getDate() === curDate) {
          return true;
        }
      }

      // 5. String component matching (handles non-standard locale formatting)
      const dateStr = String(r.date).toLowerCase();
      const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const curMonthName = monthNames[curMonth];
      const curDateStr = String(curDate);
      const curYearStr = String(curYear);

      if (
        dateStr.includes(curMonthName) &&
        dateStr.includes(curYearStr) &&
        (dateStr.includes(curDateStr) || dateStr.includes(curDateStr.padStart(2, '0')))
      ) {
        return true;
      }
    }

    return false;
  }, []);

  // Helper to check if a record is marked as a missed checkout
  const isMissedCheckoutRecord = useCallback((r) => {
    return Boolean(r && (r.missedCheckout || r.isAutoCheckout || r.id?.includes('AUTO') || r.shortTime?.includes('Missed')));
  }, []);

  // Auto-Checkout: automatically mark check-out for staff who forgot to check out after 11:30 PM
  const checkAndApplyMissedCheckouts = useCallback((currentRecords) => {
    if (!Array.isArray(currentRecords) || currentRecords.length === 0) return currentRecords;

    const now = new Date();
    // After 11:30 PM check (23:30 or later)
    const isPast1130PMToday = now.getHours() > 23 || (now.getHours() === 23 && now.getMinutes() >= 30);

    // Group records by employeeName and date
    const empDateMap = new Map();

    currentRecords.forEach(r => {
      const empName = (r.employeeName || r.name || '').trim();
      const date = (r.date || '').trim();
      if (!empName || !date) return;

      const key = `${empName.toLowerCase()}___${date.toLowerCase()}`;
      if (!empDateMap.has(key)) {
        empDateMap.set(key, { empName, date, punches: [] });
      }
      empDateMap.get(key).punches.push(r);
    });

    const newAutoRecords = [];

    empDateMap.forEach(({ empName, date, punches }) => {
      // Sort punches chronologically (oldest to newest)
      const sorted = [...punches].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      const lastPunch = sorted[sorted.length - 1];

      // If the latest punch on that date is an unclosed 'in'
      if (lastPunch && lastPunch.type === 'in') {
        const isToday = isRecordToday(lastPunch);
        const isEligible = isToday ? isPast1130PMToday : true;

        if (isEligible) {
          const autoId = `REC-AUTO-${empName.toLowerCase().replace(/[^a-z0-9]/g, '')}-${date.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
          const alreadyExists = currentRecords.some(r => 
            r.id === autoId || 
            (r.employeeName?.toLowerCase() === empName.toLowerCase() && 
             r.date?.toLowerCase() === date.toLowerCase() && 
             r.type === 'out')
          );

          if (!alreadyExists) {
            const autoRecord = {
              id: autoId,
              timestamp: (lastPunch.timestamp || Date.now()) + 3600000,
              employeeName: empName,
              employeeRole: lastPunch.employeeRole || 'Staff',
              branchName: lastPunch.branchName || 'Convenio Mart',
              type: 'out',
              date: lastPunch.date || date,
              time: '11:30:00 PM',
              shortTime: '11:30 PM',
              photo: lastPunch.photo || null,
              geofenceVerified: false,
              missedCheckout: true,
              isAutoCheckout: true,
              location: {
                lat: null,
                lng: null,
                placeName: 'Auto Check-Out (Missed Checkout after 11:30 PM)'
              }
            };
            newAutoRecords.push(autoRecord);
          }
        }
      }
    });

    if (newAutoRecords.length > 0) {
      newAutoRecords.forEach(rec => {
        saveAttendanceToSupabase(rec);
      });
      const updated = [...newAutoRecords, ...currentRecords];
      try {
        localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save auto-records to storage:', e);
      }
      return updated;
    }

    return currentRecords;
  }, [isRecordToday]);

  // Periodic check for 11:30 PM cutoff and initial missed checkouts
  useEffect(() => {
    setRecords(prev => checkAndApplyMissedCheckouts(prev));

    const timer = setInterval(() => {
      setRecords(prev => checkAndApplyMissedCheckouts(prev));
    }, 60000);

    return () => clearInterval(timer);
  }, [checkAndApplyMissedCheckouts]);

  // Memoized Today's Check Ins count
  const todayCheckInsCount = useMemo(() => {
    return records.filter(r => r.type === 'in' && isRecordToday(r)).length;
  }, [records, isRecordToday]);

  // Smart Status Detection: Find latest attendance record for this employee today
  const latestTodayRecord = activeFormEmpName 
    ? records.find(r => {
        const empName = (r.employeeName || r.name || '').trim().toLowerCase();
        const targetName = activeFormEmpName.trim().toLowerCase();
        const matchesEmp = empName === targetName || empName.includes(targetName) || targetName.includes(empName);
        return matchesEmp && isRecordToday(r);
      })
    : null;

  // All today's attendance records across all staff
  const todayRecords = useMemo(() => {
    return records.filter(isRecordToday);
  }, [records, isRecordToday]);

  // List of distinct staff members who punched today with their counts
  const todayStaffList = useMemo(() => {
    const map = new Map();
    todayRecords.forEach(r => {
      const name = (r.employeeName || r.name || '').trim();
      if (name) {
        map.set(name, (map.get(name) || 0) + 1);
      }
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [todayRecords]);

  // Is employee actively verified and selected in the on-site form right now
  const isEmpActivelyOnSite = geoStatus === 'in_range' && Boolean(activeFormEmpName);

  // Today's attendance records for the currently selected employee
  const currentEmployeeTodayRecords = useMemo(() => {
    if (!activeFormEmpName) return [];
    const targetName = activeFormEmpName.trim().toLowerCase();
    return todayRecords.filter(r => {
      const empName = (r.employeeName || r.name || '').trim().toLowerCase();
      return empName === targetName || empName.includes(targetName) || targetName.includes(empName);
    });
  }, [todayRecords, activeFormEmpName]);

  const handleOpenHistoryDrawer = () => {
    // If user is verified on-site and actively selected an employee on the form, pre-filter to their name.
    // Otherwise (e.g. outside geofence), show All Staff Today without falsely assuming stale localStorage!
    if (isEmpActivelyOnSite) {
      setHistorySelectedStaff(activeFormEmpName);
    } else {
      setHistorySelectedStaff('');
    }
    setHistorySearchTerm('');
    setHistoryFilterType('all');
    setShowHistoryDrawer(true);
  };

  // Active branch in Admin Management
  const currentAdminBranch = branches.find(b => b.id === adminSelectedBranchId) || branches[0];

  // ================= ADMIN & MANAGER AUTHENTICATION HANDLERS =================
  const handleAdminLogin = (e) => {
    e.preventDefault();
    setAdminAuthError('');
    setIsAdminLoggingIn(true);

    setTimeout(() => {
      if (loginRoleTab === 'admin') {
        const inputUser = adminUsername.trim().toLowerCase();
        const inputPass = adminPassword;

        if (inputUser === 'hr@lordsandkings.co' && inputPass === 'lak@2018') {
          setIsAdminAuthenticated(true);
          setAuthRole('admin');
          setCurrentManagerName('');
          try {
            sessionStorage.setItem('convenio_admin_auth', 'true');
            sessionStorage.setItem('convenio_auth_role', 'admin');
            sessionStorage.removeItem('convenio_manager_name');
          } catch {
            // ignore
          }
          setAdminPassword('');
          setAdminAuthError('');
        } else {
          setAdminAuthError('Invalid administrator credentials. Please check your username and password.');
        }
      } else {
        // Store Manager Login with assigned Username and Password
        const inputUser = adminUsername.trim().toLowerCase();
        const inputPass = adminPassword.trim();

        if (!inputUser || !inputPass) {
          setAdminAuthError('Please enter both your manager username and password.');
          setIsAdminLoggingIn(false);
          return;
        }

        const matchedMgr = managersList.find(m => 
          (m.username?.toLowerCase() === inputUser || m.name?.toLowerCase() === inputUser) && 
          (m.password === inputPass || inputPass === 'lak@2018')
        );

        if (matchedMgr) {
          setIsAdminAuthenticated(true);
          setAuthRole('manager');
          setCurrentManagerName(matchedMgr.name);
          try {
            sessionStorage.setItem('convenio_admin_auth', 'true');
            sessionStorage.setItem('convenio_auth_role', 'manager');
            sessionStorage.setItem('convenio_manager_name', matchedMgr.name);
          } catch {
            // ignore
          }
          setAdminUsername('');
          setAdminPassword('');
          setAdminAuthError('');
        } else {
          setAdminAuthError('Invalid manager username or password. Please check the credentials given by your administrator.');
        }
      }
      setIsAdminLoggingIn(false);
    }, 300);
  };

  const handleAdminLogout = () => {
    setIsAdminAuthenticated(false);
    setAuthRole('admin');
    setCurrentManagerName('');
    try {
      sessionStorage.removeItem('convenio_admin_auth');
      sessionStorage.removeItem('convenio_auth_role');
      sessionStorage.removeItem('convenio_manager_name');
    } catch {
      // ignore
    }
    setAdminUsername('');
    setAdminPassword('');
    setAdminAuthError('');
    navigateTo('attendance');
  };

  const handleAddManager = (e) => {
    e.preventDefault();
    if (!newManagerName.trim()) return;

    const autoUser = newManagerName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const username = newManagerUsername.trim().toLowerCase() || autoUser;
    const password = newManagerPassword.trim() || `mgr@${autoUser}`;

    const newMgr = {
      id: 'mgr-' + Date.now(),
      name: newManagerName.trim(),
      role: newManagerRole.trim() || 'Store Manager',
      username,
      password,
      email: newManagerEmail.trim() || `${username}@convenio.com`
    };
    const updated = [...managersList, newMgr];
    setManagersList(updated);
    saveStoredManagers(updated);
    syncManagerToSupabase(newMgr);
    setNewManagerName('');
    setNewManagerRole('');
    setNewManagerUsername('');
    setNewManagerPassword('');
    setNewManagerEmail('');
    setShowAddManagerModal(false);

    logAdminAction('manager_added', `Added new manager "${newMgr.name}" with username "${newMgr.username}"`, {
      managerName: newMgr.name,
      username: newMgr.username,
      role: newMgr.role
    });
    setTransferToast({
      message: `Manager "${newMgr.name}" created! Username: ${newMgr.username}`,
      type: 'success'
    });
    setTimeout(() => setTransferToast(null), 4000);
  };

  const handleRemoveManager = (mgrId) => {
    const mgr = managersList.find(m => m.id === mgrId);
    if (!mgr) return;
    if (window.confirm(`Are you sure you want to remove manager "${mgr.name}"?`)) {
      const updated = managersList.filter(m => m.id !== mgrId);
      setManagersList(updated);
      saveStoredManagers(updated);
      removeManagerFromSupabase(mgrId);
      logAdminAction('manager_removed', `Removed manager "${mgr.name}"`, {
        managerName: mgr.name
      });
      setTransferToast({
        message: `Manager "${mgr.name}" removed.`,
        type: 'info'
      });
      setTimeout(() => setTransferToast(null), 4000);
    }
  };

  // ================= CIRCULAR HANDLERS (ADMIN ONLY, BROADCAST TO ALL) =================
  const handleSendCircular = async (e) => {
    if (e) e.preventDefault();
    if (authRole !== 'admin') {
      alert('Only administrators can send circulars.');
      return;
    }
    if (!newCircularTitle.trim() || !newCircularMessage.trim()) return;

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const newCirc = {
      id: `circ-${Date.now()}`,
      title: newCircularTitle.trim(),
      message: newCircularMessage.trim(),
      date: dateStr,
      time: timeStr,
      timestamp: Date.now(),
      sender: 'Admin'
    };

    const updated = [newCirc, ...circulars];
    setCirculars(updated);
    saveStoredCirculars(updated);
    syncCircularToSupabase(newCirc);

    setNewCircularTitle('');
    setNewCircularMessage('');
    setCircularSuccessMsg('Circular published and sent to all branches successfully!');
    logAdminAction('circular_sent', `Sent circular "${newCirc.title}" to all branches`, {
      title: newCirc.title
    });
    setTimeout(() => setCircularSuccessMsg(''), 4000);
  };

  const handleDeleteCircular = async (circularId) => {
    if (authRole !== 'admin') return;
    const circ = circulars.find(c => c.id === circularId);
    if (!circ) return;
    if (window.confirm(`Are you sure you want to delete circular "${circ.title}"?`)) {
      const updated = circulars.filter(c => c.id !== circularId);
      setCirculars(updated);
      saveStoredCirculars(updated);
      removeCircularFromSupabase(circularId);
      logAdminAction('circular_deleted', `Deleted circular "${circ.title}"`, {
        title: circ.title
      });
    }
  };

  // ================= MONTHLY TIMESHEET / ATTENDANCE GRID (HR & PAYROLL) =================
  const timesheetMonthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePrevTimesheetMonth = () => {
    if (timesheetMonth === 0) {
      setTimesheetMonth(11);
      setTimesheetYear(y => y - 1);
    } else {
      setTimesheetMonth(m => m - 1);
    }
  };

  const handleNextTimesheetMonth = () => {
    if (timesheetMonth === 11) {
      setTimesheetMonth(0);
      setTimesheetYear(y => y + 1);
    } else {
      setTimesheetMonth(m => m + 1);
    }
  };

  const handleCurrentTimesheetMonth = () => {
    const now = new Date();
    setTimesheetYear(now.getFullYear());
    setTimesheetMonth(now.getMonth());
  };

  const timesheetDaysInMonth = useMemo(() => {
    return new Date(timesheetYear, timesheetMonth + 1, 0).getDate();
  }, [timesheetYear, timesheetMonth]);

  const timesheetDaysArray = useMemo(() => {
    return Array.from({ length: timesheetDaysInMonth }, (_, i) => i + 1);
  }, [timesheetDaysInMonth]);

  const isDaySunday = useCallback((day) => {
    const d = new Date(timesheetYear, timesheetMonth, day);
    return d.getDay() === 0;
  }, [timesheetYear, timesheetMonth]);

  const getDayShortName = useCallback((day) => {
    const d = new Date(timesheetYear, timesheetMonth, day);
    return d.toLocaleDateString('en-US', { weekday: 'narrow' });
  }, [timesheetYear, timesheetMonth]);

  // Master list of all staff across branches and records
  const allTimesheetEmployees = useMemo(() => {
    const list = [];
    const seen = new Set();

    branches.forEach(branch => {
      if (Array.isArray(branch.employees)) {
        branch.employees.forEach(emp => {
          const empName = (typeof emp === 'string' ? emp : emp.name || '').trim();
          if (empName && !seen.has(empName.toLowerCase())) {
            seen.add(empName.toLowerCase());
            list.push({
              id: emp.id || `emp-${empName.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
              name: empName,
              role: emp.role || 'Staff',
              branchId: branch.id,
              branchName: branch.name
            });
          }
        });
      }
    });

    records.forEach(r => {
      const empName = (r.employeeName || r.name || '').trim();
      if (empName && !seen.has(empName.toLowerCase())) {
        seen.add(empName.toLowerCase());
        list.push({
          id: `rec-emp-${empName.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
          name: empName,
          role: r.employeeRole || 'Staff',
          branchId: 'other',
          branchName: r.branchName || 'Convenio Mart'
        });
      }
    });

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [branches, records]);

  // Filtered employees for timesheet grid
  const filteredTimesheetEmployees = useMemo(() => {
    return allTimesheetEmployees.filter(emp => {
      if (timesheetBranchId !== 'all' && emp.branchId !== timesheetBranchId) {
        return false;
      }
      if (timesheetSearch.trim()) {
        const query = timesheetSearch.toLowerCase().trim();
        const matchesName = emp.name.toLowerCase().includes(query);
        const matchesRole = emp.role.toLowerCase().includes(query);
        const matchesBranch = emp.branchName.toLowerCase().includes(query);
        if (!matchesName && !matchesRole && !matchesBranch) return false;
      }
      return true;
    });
  }, [allTimesheetEmployees, timesheetBranchId, timesheetSearch]);

  // Helper to extract year, month, day from a record
  const getRecordDateComponents = useCallback((r) => {
    if (!r) return null;
    if (r.timestamp && !isNaN(Number(r.timestamp))) {
      const d = new Date(Number(r.timestamp));
      if (!isNaN(d.getTime())) {
        return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
      }
    }
    if (r.id && typeof r.id === 'string' && r.id.startsWith('REC-')) {
      const rawTs = r.id.slice(4).split('-')[0];
      const ts = Number(rawTs);
      if (!isNaN(ts) && ts > 1600000000000) {
        const d = new Date(ts);
        if (!isNaN(d.getTime())) {
          return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
        }
      }
    }
    if (r.created_at) {
      const d = new Date(r.created_at);
      if (!isNaN(d.getTime())) {
        return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
      }
    }
    if (r.date) {
      const d = new Date(r.date);
      if (!isNaN(d.getTime())) {
        return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
      }
      const parts = String(r.date).trim().split(/[\s,/-]+/);
      if (parts.length >= 3) {
        const monthMap = {
          jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
          jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
        };
        let y = null, m = null, dayNum = null;
        parts.forEach(p => {
          const pLower = p.toLowerCase().slice(0, 3);
          if (monthMap[pLower] !== undefined) {
            m = monthMap[pLower];
          } else if (/^\d{4}$/.test(p)) {
            y = parseInt(p, 10);
          } else if (/^\d{1,2}$/.test(p)) {
            const num = parseInt(p, 10);
            if (dayNum === null && num <= 31) {
              dayNum = num;
            }
          }
        });
        if (y !== null && m !== null && dayNum !== null) {
          return { year: y, month: m, day: dayNum };
        }
      }
    }
    return null;
  }, []);

  // Pre-indexed map of records for the active timesheet month
  const timesheetMonthRecordsMap = useMemo(() => {
    const map = new Map();
    records.forEach(r => {
      const empName = (r.employeeName || r.name || '').trim().toLowerCase();
      if (!empName) return;

      const comp = getRecordDateComponents(r);
      if (!comp) return;

      if (comp.year === timesheetYear && comp.month === timesheetMonth) {
        if (!map.has(empName)) {
          map.set(empName, {});
        }
        const empDays = map.get(empName);
        if (!empDays[comp.day]) {
          empDays[comp.day] = [];
        }
        empDays[comp.day].push(r);
      }
    });
    return map;
  }, [records, timesheetYear, timesheetMonth, getRecordDateComponents]);

  // Determine status of an employee on a specific day
  const getTimesheetDayStatus = useCallback((empName, day) => {
    const empKey = empName.toLowerCase().trim();
    const empDays = timesheetMonthRecordsMap.get(empKey);
    const dayPunches = empDays ? empDays[day] : null;

    if (!dayPunches || dayPunches.length === 0) {
      return { status: 'none', code: '-', label: 'Absent / Off', punches: [] };
    }

    const hasMissed = dayPunches.some(p => isMissedCheckoutRecord(p));
    const hasIn = dayPunches.some(p => p.type === 'in');
    const hasOut = dayPunches.some(p => p.type === 'out' && !isMissedCheckoutRecord(p));

    if (hasMissed) {
      return {
        status: 'missed',
        code: 'M',
        label: 'Missed Checkout (11:30 PM)',
        punches: dayPunches
      };
    }

    if (hasIn || hasOut) {
      return {
        status: 'present',
        code: 'P',
        label: 'Present',
        punches: dayPunches
      };
    }

    return { status: 'none', code: '-', label: 'Absent / Off', punches: [] };
  }, [timesheetMonthRecordsMap, isMissedCheckoutRecord]);

  // Employee monthly totals calculation
  const getEmployeeTimesheetTotals = useCallback((empName) => {
    let presentCount = 0;
    let missedCount = 0;

    for (let day = 1; day <= timesheetDaysInMonth; day++) {
      const cell = getTimesheetDayStatus(empName, day);
      if (cell.status === 'present') {
        presentCount++;
      } else if (cell.status === 'missed') {
        presentCount++;
        missedCount++;
      }
    }

    return { presentCount, missedCount };
  }, [timesheetDaysInMonth, getTimesheetDayStatus]);

  // Export Timesheet CSV for HR & Payroll
  const handleExportTimesheetCSV = () => {
    if (filteredTimesheetEmployees.length === 0) {
      alert('No employee data available to export for the selected filter.');
      return;
    }

    const monthStr = timesheetMonthNames[timesheetMonth];
    const headerDays = timesheetDaysArray.map(d => `Day ${d} (${d}/${timesheetMonth + 1})`);
    const csvHeaders = ['Employee Name', 'Branch', 'Role', 'Total Present Days', 'Missed Checkouts', ...headerDays];

    const csvRows = filteredTimesheetEmployees.map(emp => {
      const totals = getEmployeeTimesheetTotals(emp.name);
      const dayValues = timesheetDaysArray.map(d => {
        const cell = getTimesheetDayStatus(emp.name, d);
        return cell.code;
      });

      const row = [
        `"${emp.name.replace(/"/g, '""')}"`,
        `"${emp.branchName.replace(/"/g, '""')}"`,
        `"${emp.role.replace(/"/g, '""')}"`,
        totals.presentCount,
        totals.missedCount,
        ...dayValues
      ];
      return row.join(',');
    });

    const csvContent = [csvHeaders.join(','), ...csvRows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Convenio_Timesheet_${monthStr}_${timesheetYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Download Timesheet as PDF (HR & Payroll Grid)
  const handleExportTimesheetPDF = () => {
    if (filteredTimesheetEmployees.length === 0) {
      alert('No employee data available to export for the selected filter.');
      return;
    }

    const monthStr = timesheetMonthNames[timesheetMonth];
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

    // Document Branding Header
    doc.setFontSize(15);
    doc.setTextColor(15, 23, 42);
    doc.text('Convenio Mart - Monthly Attendance & Timesheet Report', 28, 30);

    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    const branchLabel = timesheetBranchId === 'all' 
      ? `All Branches (${branches.length})` 
      : (branches.find(b => b.id === timesheetBranchId)?.name || 'Branch');
    doc.text(`Month: ${monthStr} ${timesheetYear}   |   Branch: ${branchLabel}   |   Total Staff: ${filteredTimesheetEmployees.length}   |   Exported: ${new Date().toLocaleDateString('en-GB')}`, 28, 44);

    // Days headers: number and short weekday (e.g. "1\nTh")
    const headerDays = timesheetDaysArray.map(d => `${d}\n${getDayShortName(d)}`);
    const headRow = ['#', 'Staff Member', 'Branch', 'P', 'M', ...headerDays];

    const bodyRows = filteredTimesheetEmployees.map((emp, idx) => {
      const totals = getEmployeeTimesheetTotals(emp.name);
      const dayStatuses = timesheetDaysArray.map(d => {
        const cell = getTimesheetDayStatus(emp.name, d);
        return cell.code;
      });
      return [
        idx + 1,
        emp.name,
        emp.branchName,
        totals.presentCount,
        totals.missedCount,
        ...dayStatuses
      ];
    });

    autoTable(doc, {
      head: [headRow],
      body: bodyRows,
      startY: 52,
      theme: 'grid',
      styles: {
        fontSize: 6.5,
        cellPadding: 2,
        halign: 'center',
        valign: 'middle',
        textColor: [51, 65, 85],
        lineColor: [226, 232, 240],
        lineWidth: 0.5,
      },
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontStyle: 'bold',
        fontSize: 6,
        halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: 16, halign: 'center' },
        1: { cellWidth: 85, halign: 'left', fontStyle: 'bold' },
        2: { cellWidth: 75, halign: 'left', textColor: [100, 116, 139] },
        3: { cellWidth: 18, halign: 'center', fontStyle: 'bold', textColor: [21, 128, 61], fillColor: [240, 253, 244] },
        4: { cellWidth: 18, halign: 'center', fontStyle: 'bold', textColor: [180, 83, 9], fillColor: [254, 252, 232] },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index >= 5) {
          if (data.cell.raw === 'P') {
            data.cell.styles.fillColor = [220, 252, 231];
            data.cell.styles.textColor = [21, 128, 61];
            data.cell.styles.fontStyle = 'bold';
          } else if (data.cell.raw === 'M') {
            data.cell.styles.fillColor = [254, 243, 199];
            data.cell.styles.textColor = [180, 83, 9];
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [203, 213, 225];
          }
        }
      },
      margin: { left: 28, right: 28, bottom: 20 },
    });

    doc.save(`Convenio_Timesheet_${monthStr}_${timesheetYear}.pdf`);
  };

  // ================= INDIVIDUAL STAFF ATTENDANCE CALENDAR MODAL =================
  const calendarDaysInMonth = useMemo(() => {
    return new Date(calendarYear, calendarMonth + 1, 0).getDate();
  }, [calendarYear, calendarMonth]);

  const calendarFirstDayOfWeek = useMemo(() => {
    return new Date(calendarYear, calendarMonth, 1).getDay(); // 0 = Sunday, 1 = Monday, etc.
  }, [calendarYear, calendarMonth]);

  const handleOpenStaffCalendar = (emp) => {
    setCalendarStaff(emp);
    setCalendarYear(timesheetYear);
    setCalendarMonth(timesheetMonth);
    setCalendarSelectedDay(null);
    setCalendarSlideDir('fade');
  };

  const handleCloseStaffCalendar = () => {
    setCalendarStaff(null);
    setCalendarSelectedDay(null);
  };

  const handlePrevCalendarMonth = () => {
    setCalendarSlideDir('right');
    setCalendarSelectedDay(null);
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear(y => y - 1);
    } else {
      setCalendarMonth(m => m - 1);
    }
  };

  const handleNextCalendarMonth = () => {
    setCalendarSlideDir('left');
    setCalendarSelectedDay(null);
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear(y => y + 1);
    } else {
      setCalendarMonth(m => m + 1);
    }
  };

  const getCalendarDayInfo = useCallback((day) => {
    if (!calendarStaff || !calendarStaff.name) {
      return { status: 'none', label: 'No Data', punches: [] };
    }

    const empTarget = calendarStaff.name.toLowerCase().trim();
    const dayPunches = records.filter(r => {
      const empName = (r.employeeName || r.name || '').toLowerCase().trim();
      if (empName !== empTarget && !empName.includes(empTarget) && !empTarget.includes(empName)) {
        return false;
      }
      const comp = getRecordDateComponents(r);
      return comp && comp.year === calendarYear && comp.month === calendarMonth && comp.day === day;
    });

    if (dayPunches.length > 0) {
      const hasMissed = dayPunches.some(p => isMissedCheckoutRecord(p));
      const hasIn = dayPunches.some(p => p.type === 'in');
      const hasOut = dayPunches.some(p => p.type === 'out' && !isMissedCheckoutRecord(p));

      if (hasMissed) {
        return {
          status: 'leave', // matches yellow Leave / Missed
          label: 'Missed Checkout (11:30 PM)',
          punches: dayPunches
        };
      }
      if (hasIn || hasOut) {
        return {
          status: 'present', // matches green Present
          label: 'Present',
          punches: dayPunches
        };
      }
    }

    // No punches recorded: evaluate date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(calendarYear, calendarMonth, day);
    targetDate.setHours(0, 0, 0, 0);

    if (targetDate.getTime() === today.getTime()) {
      return { status: 'today', label: 'No punches today yet', punches: [] };
    } else if (targetDate < today) {
      if (targetDate.getDay() === 0) {
        return { status: 'off', label: 'Sunday Weekly Off', punches: [] };
      }
      return { status: 'absent', label: 'Absent', punches: [] };
    } else {
      return { status: 'future', label: 'Upcoming', punches: [] };
    }
  }, [calendarStaff, calendarYear, calendarMonth, records, getRecordDateComponents, isMissedCheckoutRecord]);

  // Download Individual Staff Monthly Attendance Report as PDF
  const handleDownloadStaffMonthlyPDF = () => {
    if (!calendarStaff || !calendarStaff.name) return;

    const monthName = timesheetMonthNames[calendarMonth];
    const totalDays = new Date(calendarYear, calendarMonth + 1, 0).getDate();

    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

    // Header Red Bar Branding
    doc.setFillColor(225, 29, 36);
    doc.rect(0, 0, 595, 8, 'F');

    // Title & Info
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text('Convenio Marts', 36, 38);

    doc.setFontSize(11);
    doc.setTextColor(225, 29, 36);
    doc.text('Monthly Staff Attendance Report', 36, 54);

    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`, 36, 68);

    // Staff Details Box
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(36, 80, 523, 50, 6, 6, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(36, 80, 523, 50, 6, 6, 'D');

    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(`${calendarStaff.name}`, 48, 100);

    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    const staffBranch = calendarStaff.branchName || 'Convenio Mart';
    const staffRole = calendarStaff.role || 'Staff Member';
    doc.text(`Store: ${staffBranch}    |    Period: ${monthName} ${calendarYear}    |    Role: ${staffRole}`, 48, 116);

    // Compute month totals & daily log rows
    let presentCount = 0;
    let leaveCount = 0;
    let absentCount = 0;
    let offCount = 0;

    const rows = [];
    for (let day = 1; day <= totalDays; day++) {
      const info = getCalendarDayInfo(day);
      const dateObj = new Date(calendarYear, calendarMonth, day);
      const dateStr = `${String(day).padStart(2, '0')} ${monthName.slice(0, 3)} ${calendarYear}`;
      const weekdayStr = dateObj.toLocaleDateString('en-US', { weekday: 'short' });

      let inTime = '-';
      let outTime = '-';
      let branch = staffBranch;

      if (info.punches && info.punches.length > 0) {
        const inPunches = info.punches.filter(p => p.type === 'in');
        const outPunches = info.punches.filter(p => p.type === 'out');
        if (inPunches.length > 0) {
          inTime = formatTo12HourTime(inPunches[0].shortTime || inPunches[0].time);
          if (inPunches[0].branchName) branch = inPunches[0].branchName;
        }
        if (outPunches.length > 0) {
          const lastOut = outPunches[outPunches.length - 1];
          outTime = isMissedCheckoutRecord(lastOut) ? 'Missed Out' : formatTo12HourTime(lastOut.shortTime || lastOut.time);
        }
      }

      if (info.status === 'present') presentCount++;
      else if (info.status === 'leave') leaveCount++;
      else if (info.status === 'absent') absentCount++;
      else if (info.status === 'off') offCount++;

      rows.push([
        dateStr,
        weekdayStr,
        info.label,
        inTime,
        outTime,
        branch
      ]);
    }

    // Mini Summary Stat Badges above table
    doc.setFontSize(9);
    doc.setTextColor(21, 128, 61);
    doc.text(`Present: ${presentCount} Days`, 48, 146);
    doc.setTextColor(180, 83, 9);
    doc.text(`Leave / Missed: ${leaveCount} Days`, 160, 146);
    doc.setTextColor(220, 38, 38);
    doc.text(`Absent: ${absentCount} Days`, 310, 146);
    doc.setTextColor(100, 116, 139);
    doc.text(`Weekly Offs: ${offCount} Days`, 425, 146);

    // AutoTable for daily breakdown
    autoTable(doc, {
      head: [['Date', 'Day', 'Status', 'Check In', 'Check Out', 'Store / Branch']],
      body: rows,
      startY: 156,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 3.5,
        halign: 'center',
        valign: 'middle',
        textColor: [51, 65, 85],
        lineColor: [226, 232, 240],
        lineWidth: 0.5,
      },
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: 75, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: 45, halign: 'center' },
        2: { cellWidth: 110, halign: 'center' },
        3: { cellWidth: 80, halign: 'center' },
        4: { cellWidth: 85, halign: 'center' },
        5: { cellWidth: 128, halign: 'left' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 2) {
          const val = String(data.cell.raw).toLowerCase();
          if (val.includes('present')) {
            data.cell.styles.textColor = [21, 128, 61];
            data.cell.styles.fontStyle = 'bold';
          } else if (val.includes('missed') || val.includes('leave')) {
            data.cell.styles.textColor = [180, 83, 9];
            data.cell.styles.fontStyle = 'bold';
          } else if (val.includes('absent')) {
            data.cell.styles.textColor = [220, 38, 38];
          } else if (val.includes('off')) {
            data.cell.styles.textColor = [100, 116, 139];
          }
        }
      }
    });

    const safeName = calendarStaff.name.replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`Attendance_${safeName}_${monthName}_${calendarYear}.pdf`);
  };

  // ================= BRANCH MANAGEMENT HANDLERS =================
  const handleAddBranch = (e) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;

    const newBranch = {
      id: 'branch-' + Date.now(),
      name: newBranchName.trim(),
      code: newBranchCode.trim() || `CM-${branches.length + 1}`,
      address: newBranchAddress.trim() || 'Convenio Mart Branch',
      employees: []
    };

    const updated = [...branches, newBranch];
    setBranches(updated);
    syncBranchToSupabase(newBranch);
    logAdminAction('add_branch', `Created new branch "${newBranch.name}" (${newBranch.code})`, { branchName: newBranch.name, code: newBranch.code });
    setNewBranchName('');
    setNewBranchCode('');
    setNewBranchAddress('');
    setShowAddBranchModal(false);
    setAdminSelectedBranchId(newBranch.id);
  };

  const handleUpdateBranch = (e) => {
    e.preventDefault();
    if (!editingBranch || !editingBranch.name.trim()) return;

    const updatedBranch = {
      ...editingBranch,
      name: editingBranch.name.trim(),
      code: editingBranch.code?.trim() || '',
      address: editingBranch.address?.trim() || ''
    };

    setBranches(prev => prev.map(b => {
      if (b.id === editingBranch.id) {
        return {
          ...b,
          ...updatedBranch
        };
      }
      return b;
    }));

    syncBranchToSupabase(updatedBranch);
    logAdminAction('edit_branch', `Updated branch details for "${updatedBranch.name}"`, { branchName: updatedBranch.name, code: updatedBranch.code });
    setEditingBranch(null);
  };

  const promptDeleteBranch = (branchId) => {
    const branchToDelete = branches.find(b => b.id === branchId);
    if (!branchToDelete) return;
    setDeletePasswordInput('');
    setDeletePasswordError('');
    setShowDeletePassword(false);
    setDeleteModal({
      type: 'branch',
      targetId: branchId,
      targetName: branchToDelete.name,
      empCount: branchToDelete.employees?.length || 0
    });
  };

  // ================= EMPLOYEE MANAGEMENT HANDLERS =================
  const handleAddEmployee = (e) => {
    e.preventDefault();
    if (!newEmpName.trim() || !adminSelectedBranchId) return;

    const newEmp = {
      id: 'emp-' + Date.now(),
      name: newEmpName.trim(),
      ...(newEmpRole.trim() ? { role: newEmpRole.trim() } : {})
    };

    setBranches(prev => prev.map(b => {
      if (b.id === adminSelectedBranchId) {
        return {
          ...b,
          employees: [...(b.employees || []), newEmp]
        };
      }
      return b;
    }));

    syncEmployeeToSupabase(newEmp, adminSelectedBranchId);
    const targetBranch = branches.find(b => b.id === adminSelectedBranchId);
    logAdminAction('add_staff', `Added new staff member "${newEmp.name}" to ${targetBranch?.name || 'branch'}`, {
      staffName: newEmp.name,
      branchName: targetBranch?.name,
      role: newEmp.role || 'Staff Member'
    });
    setNewEmpName('');
    setNewEmpRole('');
  };

  // ================= STAFF BRANCH TRANSFER HANDLER (SINGLE & BULK) =================
  const handleTransferEmployees = (empIds, fromBranchId, toBranchId) => {
    if (!empIds || empIds.length === 0 || !fromBranchId || !toBranchId || fromBranchId === toBranchId) return;

    const fromBranch = branches.find(b => b.id === fromBranchId);
    const toBranch = branches.find(b => b.id === toBranchId);
    if (!fromBranch || !toBranch) return;

    const employeesToMove = (fromBranch.employees || []).filter(e => empIds.includes(e.id));
    if (employeesToMove.length === 0) return;

    const performer = authRole === 'manager'
      ? `Manager ${currentManagerName || 'Store Manager'}`
      : 'Super Admin';

    const employeesWithMeta = employeesToMove.map(emp => ({
      ...emp,
      lastTransferredBy: performer,
      lastTransferredAt: new Date().toLocaleDateString([], { day: 'numeric', month: 'short' })
    }));

    setBranches(prev => prev.map(b => {
      if (b.id === fromBranchId) {
        return {
          ...b,
          employees: (b.employees || []).filter(e => !empIds.includes(e.id))
        };
      }
      if (b.id === toBranchId) {
        return {
          ...b,
          employees: [...(b.employees || []), ...employeesWithMeta]
        };
      }
      return b;
    }));

    // Sync each transferred employee to Supabase under target branch
    employeesToMove.forEach(emp => {
      syncEmployeeToSupabase(emp, toBranchId);
    });

    const label = employeesToMove.length === 1 
      ? `"${employeesToMove[0].name}"` 
      : `${employeesToMove.length} staff members`;

    logAdminAction(
      'transfer',
      employeesToMove.length === 1
        ? `Transferred staff member "${employeesToMove[0].name}" from ${fromBranch.name} to ${toBranch.name} by ${performer}`
        : `Bulk transferred ${employeesToMove.length} staff members from ${fromBranch.name} to ${toBranch.name} by ${performer}`,
      {
        transferredBy: performer,
        role: authRole,
        managerName: currentManagerName || 'Super Admin',
        count: employeesToMove.length,
        staffNames: employeesToMove.map(e => e.name),
        fromBranch: fromBranch.name,
        toBranch: toBranch.name
      }
    );

    setTransferToast({
      message: `${label} transferred to ${toBranch.name} by ${performer}.`,
      type: 'success'
    });
    setTimeout(() => setTransferToast(null), 4500);

    setSelectedEmpIds([]);
    setBulkTargetBranchId('');
    setTransferModalStaff(null);
  };

  const handleUpdateEmployee = (e) => {
    e.preventDefault();
    if (!editingEmp || !editingEmp.name.trim()) return;

    const targetBranchId = editingEmp.targetBranchId || editingEmp.branchId;
    const isBranchChanged = targetBranchId !== editingEmp.branchId;

    const updatedEmp = {
      id: editingEmp.empId,
      name: editingEmp.name.trim(),
      role: editingEmp.role?.trim() || ''
    };

    setBranches(prev => prev.map(b => {
      if (isBranchChanged) {
        if (b.id === editingEmp.branchId) {
          return {
            ...b,
            employees: (b.employees || []).filter(emp => emp.id !== editingEmp.empId)
          };
        }
        if (b.id === targetBranchId) {
          return {
            ...b,
            employees: [...(b.employees || []), updatedEmp]
          };
        }
        return b;
      } else {
        if (b.id === editingEmp.branchId) {
          return {
            ...b,
            employees: (b.employees || []).map(emp => {
              if (emp.id === editingEmp.empId) {
                return {
                  ...emp,
                  ...updatedEmp
                };
              }
              return emp;
            })
          };
        }
        return b;
      }
    }));

    syncEmployeeToSupabase(updatedEmp, targetBranchId);

    if (isBranchChanged) {
      const fromBranch = branches.find(b => b.id === editingEmp.branchId);
      const toBranch = branches.find(b => b.id === targetBranchId);
      logAdminAction('transfer', `Transferred & updated "${updatedEmp.name}" from ${fromBranch?.name || 'old branch'} to ${toBranch?.name || 'new branch'}`, {
        staffName: updatedEmp.name,
        fromBranch: fromBranch?.name,
        toBranch: toBranch?.name
      });
      setTransferToast({
        message: `"${updatedEmp.name}" updated & reassigned to ${toBranch?.name || 'new branch'}.`,
        type: 'success'
      });
      setTimeout(() => setTransferToast(null), 4500);
    } else {
      logAdminAction('edit_staff', `Updated staff details for "${updatedEmp.name}"`, {
        staffName: updatedEmp.name
      });
    }

    setEditingEmp(null);
  };

  const promptDeleteEmployee = (branchId, emp) => {
    const branch = branches.find(b => b.id === branchId);
    setDeletePasswordInput('');
    setDeletePasswordError('');
    setShowDeletePassword(false);
    setDeleteModal({
      type: 'employee',
      branchId,
      targetId: emp.id,
      targetName: emp.name,
      branchName: branch?.name || 'this branch'
    });
  };

  const promptClearAllRecords = () => {
    if (records.length === 0) return;
    setDeletePasswordInput('');
    setDeletePasswordError('');
    setShowDeletePassword(false);
    setDeleteModal({
      type: 'logs',
      targetName: 'All Attendance Logs',
      count: records.length
    });
  };

  const handleConfirmDelete = (e) => {
    if (e) e.preventDefault();
    if (!deleteModal) return;

    if (deletePasswordInput !== 'lak@2018') {
      setDeletePasswordError('Incorrect admin password. Please try again.');
      return;
    }

    if (deleteModal.type === 'employee') {
      const { branchId, targetId, targetName } = deleteModal;
      setBranches(prev => prev.map(b => {
        if (b.id === branchId) {
          return {
            ...b,
            employees: (b.employees || []).filter(emp => emp.id !== targetId)
          };
        }
        return b;
      }));

      removeEmployeeFromSupabase(targetId);

      if (selectedEmpId === targetId) {
        setSelectedEmpId('');
      }
      setSelectedEmpIds(prev => prev.filter(id => id !== targetId));

      logAdminAction('delete_staff', `Deleted staff member "${targetName}" from ${deleteModal.branchName}`, {
        staffName: targetName,
        branchName: deleteModal.branchName
      });

      setTransferToast({
        message: `Staff member "${targetName}" deleted successfully.`,
        type: 'success'
      });
      setTimeout(() => setTransferToast(null), 4000);
    } else if (deleteModal.type === 'branch') {
      const { targetId, targetName } = deleteModal;
      const updated = branches.filter(b => b.id !== targetId);
      setBranches(updated);
      removeBranchFromSupabase(targetId);

      if (adminSelectedBranchId === targetId && updated.length > 0) {
        setAdminSelectedBranchId(updated[0].id);
      }
      if (selectedBranchId === targetId && updated.length > 0) {
        setSelectedBranchId(updated[0].id);
      }

      logAdminAction('delete_branch', `Deleted branch "${targetName}" and its staff`, {
        branchName: targetName
      });

      setTransferToast({
        message: `Branch "${targetName}" deleted successfully.`,
        type: 'success'
      });
      setTimeout(() => setTransferToast(null), 4000);
    } else if (deleteModal.type === 'logs') {
      setRecords([]);
      try {
        localStorage.removeItem(STORAGE_KEY_RECORDS);
      } catch (err) {
        console.warn('Failed to clear records:', err);
      }
      setSelectedRecord(null);
      if (supabaseStatus?.tablesReady) {
        clearAllAttendanceFromSupabase();
      }

      logAdminAction('clear_logs', 'Cleared all attendance logs from system', {
        count: records.length
      });

      setTransferToast({
        message: 'All attendance records successfully cleared.',
        type: 'success'
      });
      setTimeout(() => setTransferToast(null), 4000);
    }

    setDeleteModal(null);
    setDeletePasswordInput('');
    setDeletePasswordError('');
  };

  // ================= ATTENDANCE CHECK IN / OUT ACTION =================
  const handleActionClick = (actionType) => {
    if (geoStatus !== 'in_range') {
      setFormValidationMsg('You must be within 50 meters of a Convenio Mart branch to mark attendance.');
      return;
    }

    if (!selectedBranchId) {
      setFormValidationMsg('Please select your Branch first.');
      return;
    }

    if (!currentFormEmployee) {
      const trimmed = typedEmpName.trim();
      if (trimmed.length > 0 && trimmed.length < 4) {
        setFormValidationMsg('Please enter at least 4 characters to verify your name.');
      } else if (trimmed.length >= 4 && matchedCompanyEmployees.length > 1) {
        setFormValidationMsg(`Multiple employees match "${trimmed}". Please select which one you are before marking attendance.`);
      } else if (trimmed.length >= 4) {
        setFormValidationMsg(`"${trimmed}" is not in our employee list. Only registered Convenio Marts employees can mark attendance.`);
      } else {
        setFormValidationMsg('Please select or verify your registered name from our employee list.');
      }
      return;
    }

    const empName = currentFormEmployee.name;

    // Guardrail: Cannot Check Out if not checked in yet
    if (actionType === 'out' && latestTodayRecord?.type !== 'in') {
      setFormValidationMsg('Check In is required first before you can Check Out.');
      return;
    }

    // Guardrail: Cannot Check In if already checked in
    if (actionType === 'in' && latestTodayRecord?.type === 'in') {
      setFormValidationMsg(`${empName} is already checked in today at ${formatTo12HourTime(latestTodayRecord.shortTime || latestTodayRecord.time)}. Tap Check Out when leaving.`);
      return;
    }

    setFormValidationMsg('');
    startCamera(actionType);
  };

  // Keep live stream connected to the video element whenever active
  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current && !capturedPhoto) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
      videoRef.current.play().catch(console.warn);
    }
  }, [cameraActive, capturedPhoto, isCameraLoading]);

  // Start Front Camera Stream (with universal fallbacks for mobile, laptop & desktop webcams)
  const startCamera = async (actionType) => {
    setCurrentActionType(actionType);
    setCapturedPhoto(null);
    setCameraError('');
    setCameraActive(true);
    setIsCameraLoading(true);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Try camera constraints with graceful progressive fallbacks:
    // 1. Front selfie camera with ideal resolution
    // 2. Front camera without strict resolution
    // 3. Any available camera (crucial for laptops/desktops where facingMode throws error)
    const constraintsList = [
      { video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
      { video: { facingMode: 'user' }, audio: false },
      { video: true, audio: false }
    ];

    let acquiredStream = null;

    for (const constraint of constraintsList) {
      try {
        acquiredStream = await navigator.mediaDevices.getUserMedia(constraint);
        if (acquiredStream) break;
      } catch (err) {
        console.warn('Camera constraint attempt failed:', constraint, err);
      }
    }

    if (!acquiredStream) {
      setIsCameraLoading(false);
      setCameraError('Permission required: Please allow camera access in your browser to verify attendance.');
      return;
    }

    streamRef.current = acquiredStream;

    // Attach stream to video element and start playback
    const tryAttach = (retries = 10) => {
      if (videoRef.current) {
        videoRef.current.srcObject = acquiredStream;
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play().catch(console.warn);
          }
        };
        videoRef.current.play().catch(console.warn);
        setIsCameraLoading(false);
      } else if (retries > 0) {
        setTimeout(() => tryAttach(retries - 1), 50);
      } else {
        setIsCameraLoading(false);
      }
    };

    tryAttach();
  };

  // Stop camera stream
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setIsCameraLoading(false);
    setCapturedPhoto(null);
    setCameraError('');
  };

  // Capture frame from video stream (Capped to 480px, high quality downscale, JPEG 0.72 for 95% storage saving)
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const rawSize = Math.min(video.videoWidth, video.videoHeight) || 640;

    // Direct scale-down to 480px for instant light memory preview and small payload
    const targetSize = Math.min(rawSize, 480);
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Natural mirror transformation for front selfie camera
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);

    const startX = (video.videoWidth - rawSize) / 2;
    const startY = (video.videoHeight - rawSize) / 2;

    ctx.drawImage(video, startX, startY, rawSize, rawSize, 0, 0, targetSize, targetSize);
    const photoDataUrl = canvas.toDataURL('image/jpeg', 0.72);
    setCapturedPhoto(photoDataUrl);
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
  };

  // Submit attendance with live selfie & push with map location
  const submitAttendance = async () => {
    if (!capturedPhoto) return;
    setIsProcessing(true);

    // Safeguard: compress photo before storing in state, localStorage, or Supabase
    const finalPhoto = await compressImageDataUrl(capturedPhoto, 480, 0.72);

    const now = new Date();
    const formattedDate = now.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    const formattedTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    const shortTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    if (!currentFormEmployee) {
      setFormValidationMsg('Only registered employees in our employee list can record attendance.');
      setIsProcessing(false);
      return;
    }

    const activeEmpName = currentFormEmployee.name;
    const activeBranchName = currentFormBranch ? currentFormBranch.name : 'Main Mart';
    const activeEmpRole = currentFormEmployee?.role || 'Staff';

    const finishRecord = (locationData) => {
      const isGeofenceOk = geoStatus === 'in_range';
      const verifiedDistance = geoData?.distanceMeters != null ? geoData.distanceMeters : null;

      const newRecord = {
        id: 'REC-' + Date.now(),
        timestamp: now.getTime(),
        employeeName: activeEmpName,
        employeeRole: activeEmpRole,
        branchName: activeBranchName,
        type: currentActionType,
        date: formattedDate,
        time: formattedTime,
        shortTime,
        photo: finalPhoto || capturedPhoto,
        geofenceVerified: isGeofenceOk,
        distanceMeters: verifiedDistance,
        location: locationData
      };

      setRecords((prev) => [newRecord, ...prev]);
      saveAttendanceToSupabase(newRecord);
      setIsProcessing(false);
      stopCamera();

      setSuccessData({
        type: currentActionType,
        shortTime,
        formattedDate,
        lat: locationData.lat,
        lng: locationData.lng,
        placeName: locationData.placeName,
        mapUrl: locationData.lat ? `https://www.google.com/maps?q=${locationData.lat},${locationData.lng}` : null,
        photo: finalPhoto || capturedPhoto,
        name: activeEmpName,
        branch: activeBranchName,
        role: activeEmpRole,
        geofenceVerified: isGeofenceOk,
        distanceMeters: verifiedDistance
      });
    };

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          let placeName = '';

          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
              headers: { 'Accept-Language': 'en' }
            });
            if (res.ok) {
              const data = await res.json();
              if (data && data.display_name) {
                placeName = data.display_name.split(',').slice(0, 3).join(', ').trim();
              }
            }
          } catch {
            // fallback
          }

          finishRecord({
            lat: Number(lat.toFixed(6)),
            lng: Number(lng.toFixed(6)),
            placeName: placeName || 'Live GPS Captured'
          });
        },
        () => {
          finishRecord({ lat: null, lng: null, placeName: 'GPS permission unavailable' });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      finishRecord({ lat: null, lng: null, placeName: 'Geolocation not supported' });
    }
  };

  // Helper to format Date into YYYY-MM-DD
  const toYMD = (d) => {
    if (!d || isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const getYesterdayYMD = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toYMD(d);
  };

  const formatDatePretty = (isoStr) => {
    if (!isoStr) return '';
    const parts = isoStr.split('-').map(Number);
    if (parts.length !== 3) return isoStr;
    const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
    return dateObj.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Robust extractor for record date in YYYY-MM-DD format
  const getRecordISODate = (r) => {
    if (!r) return '';
    if (r.timestamp && !isNaN(Number(r.timestamp))) {
      const d = new Date(Number(r.timestamp));
      if (!isNaN(d.getTime())) return toYMD(d);
    }
    if (r.id && typeof r.id === 'string' && r.id.startsWith('REC-')) {
      const ts = Number(r.id.slice(4));
      if (!isNaN(ts) && ts > 1600000000000) {
        const d = new Date(ts);
        if (!isNaN(d.getTime())) return toYMD(d);
      }
    }
    if (r.created_at) {
      const d = new Date(r.created_at);
      if (!isNaN(d.getTime())) return toYMD(d);
    }
    if (r.date) {
      const d = new Date(r.date);
      if (!isNaN(d.getTime())) return toYMD(d);
    }
    return '';
  };

  const isDateFilterActive = dateFilterMode !== 'all' && (
    (dateFilterMode === 'single' && !!filterSingleDate) ||
    (dateFilterMode === 'range' && (!!filterStartDate || !!filterEndDate))
  );

  const dateFilterLabel = useMemo(() => {
    if (dateFilterMode === 'single' && filterSingleDate) {
      return formatDatePretty(filterSingleDate);
    }
    if (dateFilterMode === 'range') {
      if (filterStartDate && filterEndDate) {
        if (filterStartDate === filterEndDate) return formatDatePretty(filterStartDate);
        return `${formatDatePretty(filterStartDate)} – ${formatDatePretty(filterEndDate)}`;
      }
      if (filterStartDate) return `From ${formatDatePretty(filterStartDate)}`;
      if (filterEndDate) return `Until ${formatDatePretty(filterEndDate)}`;
    }
    return 'Filter by Date';
  }, [dateFilterMode, filterSingleDate, filterStartDate, filterEndDate]);

  const handleClearDateFilter = () => {
    setDateFilterMode('all');
    setFilterSingleDate('');
    setFilterStartDate('');
    setFilterEndDate('');
    setTempSingleDate('');
    setTempStartDate('');
    setTempEndDate('');
    setLogPage(1);
  };

  const handleApplyDateFilter = () => {
    if (tempFilterMode === 'single') {
      if (!tempSingleDate) {
        alert('Please select a date.');
        return;
      }
      setDateFilterMode('single');
      setFilterSingleDate(tempSingleDate);
    } else if (tempFilterMode === 'range') {
      if (!tempStartDate && !tempEndDate) {
        alert('Please select at least a start or end date.');
        return;
      }
      if (tempStartDate && tempEndDate && tempStartDate > tempEndDate) {
        alert('Start date cannot be after end date.');
        return;
      }
      setDateFilterMode('range');
      setFilterStartDate(tempStartDate);
      setFilterEndDate(tempEndDate);
    }
    setLogPage(1);
    setShowDateFilterModal(false);
  };

  // Export records to CSV
  const exportToCSV = () => {
    const recordsToExport = filteredRecords.length > 0 ? filteredRecords : records;
    if (recordsToExport.length === 0) return;
    const headers = ['Record ID', 'Employee Name', 'Role', 'Branch Name', 'Action', 'Date', 'Time', 'Geofence Verified', 'Distance (Meters)', 'Latitude', 'Longitude', 'Place Name', 'Google Maps URL'];
    const rows = recordsToExport.map((r) => [
      `"${r.id}"`,
      `"${r.employeeName}"`,
      `"${r.employeeRole || '-'}"`,
      `"${r.branchName || '-'}"`,
      `"${r.type === 'in' ? 'Check In' : 'Check Out'}"`,
      `"${r.date}"`,
      `"${formatTo12HourTime(r.time || r.shortTime)}"`,
      `"${r.geofenceVerified ? 'Yes (On-Site)' : 'No'}"`,
      `"${r.distanceMeters != null ? r.distanceMeters + 'm' : '-'}"`,
      `"${r.location?.lat ?? ''}"`,
      `"${r.location?.lng ?? ''}"`,
      `"${r.location?.placeName || ''}"`,
      `"${r.location?.lat ? `https://www.google.com/maps?q=${r.location.lat},${r.location.lng}` : ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const dateSuffix = isDateFilterActive ? `_${dateFilterLabel.replace(/[^a-zA-Z0-9]/g, '_')}` : `_${new Date().toISOString().slice(0, 10)}`;
    link.setAttribute('download', `Convenio_Attendance_Logs${dateSuffix}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearAllRecords = async () => {
    if (window.confirm('Are you sure you want to clear all attendance logs? This will delete logs from both the cloud database and local memory.')) {
      setRecords([]);
      localStorage.removeItem(STORAGE_KEY_RECORDS);
      setSelectedRecord(null);
      if (supabaseStatus?.tablesReady) {
        await clearAllAttendanceFromSupabase();
      }
    }
  };

  const handlePurgeCache = async () => {
    if (window.confirm('Clear all local browser cache memory and re-sync freshly from the live database?')) {
      await applyImmediateUpdate();
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    }
  };

  const copyRecordDetails = (record) => {
    const text = `Convenio Marts Attendance Record\nID: ${record.id}\nEmployee: ${record.employeeName} (${record.employeeRole || 'Staff'})\nBranch: ${record.branchName || '-'}\nType: ${record.type === 'in' ? 'Check In' : 'Check Out'}\nDate & Time: ${record.date} at ${formatTo12HourTime(record.time || record.shortTime)}\nCoordinates: ${record.location?.lat ? `${record.location.lat}, ${record.location.lng}` : 'N/A'}\nLocation: ${record.location?.placeName || 'N/A'}\nGoogle Maps: ${record.location?.lat ? `https://www.google.com/maps?q=${record.location.lat},${record.location.lng}` : 'N/A'}`;
    navigator.clipboard.writeText(text);
    setCopiedRecordId(record.id);
    setTimeout(() => setCopiedRecordId(null), 2000);
  };

  // Attendance Records Filtered
  const filteredRecords = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return records.filter((r) => {
      const matchesSearch = 
        !search ||
        r.employeeName.toLowerCase().includes(search) ||
        (r.branchName && r.branchName.toLowerCase().includes(search)) ||
        (r.location?.placeName && r.location.placeName.toLowerCase().includes(search)) ||
        (r.location?.lat && String(r.location.lat).includes(search)) ||
        (r.location?.lng && String(r.location.lng).includes(search));
      
      const matchesType = filterType === 'all' || r.type === filterType;
      if (!matchesSearch || !matchesType) return false;

      // Date Filtering
      if (dateFilterMode === 'single' && filterSingleDate) {
        const recordDate = getRecordISODate(r);
        if (recordDate !== filterSingleDate) return false;
      } else if (dateFilterMode === 'range') {
        const recordDate = getRecordISODate(r);
        if (filterStartDate && recordDate && recordDate < filterStartDate) return false;
        if (filterEndDate && recordDate && recordDate > filterEndDate) return false;
      }

      return true;
    });
  }, [records, searchTerm, filterType, dateFilterMode, filterSingleDate, filterStartDate, filterEndDate]);

  // Reset page to 1 when any filter changes
  useEffect(() => {
    setLogPage(1);
  }, [searchTerm, filterType, dateFilterMode, filterSingleDate, filterStartDate, filterEndDate]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / logPageSize));
  const validLogPage = Math.min(Math.max(logPage, 1), totalPages);
  const startIndex = (validLogPage - 1) * logPageSize;
  const endIndex = Math.min(startIndex + logPageSize, filteredRecords.length);

  const paginatedRecords = useMemo(() => {
    return filteredRecords.slice(startIndex, endIndex);
  }, [filteredRecords, startIndex, endIndex]);

  const totalEmployeesCount = useMemo(() => {
    return branches.reduce((acc, b) => acc + (b.employees ? b.employees.length : 0), 0);
  }, [branches]);

  return (
    <div className="page-wrapper">
      {/* Flash Simple Smooth Loading Screen */}
      {appLoading && (
        <div className={`splash-screen ${loadingFadingOut ? 'fade-out' : ''}`} aria-hidden={loadingFadingOut}>
          <div className="splash-content">
            <div className="splash-logo-card">
              <svg className="splash-logo-svg" viewBox="0 0 160 50" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 14H18M2 20H15M6 26H17" stroke="#e11d24" strokeWidth="3" strokeLinecap="round"/>
                <path d="M19 12H35L33 28H21L19 12Z" fill="#e11d24"/>
                <circle cx="27" cy="20" r="4.5" fill="white"/>
                <path d="M28.5 18C28.5 18 26.5 17.5 25.5 19C24.5 20.5 25.5 22 27 22C28.5 22 28.5 21 28.5 21" stroke="#e11d24" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
                <circle cx="22" cy="33" r="2.5" fill="#e11d24"/>
                <circle cx="32" cy="33" r="2.5" fill="#e11d24"/>
                <text x="43" y="27" fontFamily="'Plus Jakarta Sans', serif, sans-serif" fontWeight="800" fontSize="23" fill="#182238">Convenio</text>
                <text x="73" y="42" fontFamily="'Plus Jakarta Sans', sans-serif" fontWeight="800" fontSize="13" fill="#e11d24" letterSpacing="1">Mart</text>
              </svg>
              <span className="splash-tagline">Staff Attendance Portal</span>
              <div className="splash-loader-track">
                <div className="splash-loader-bar"></div>
              </div>
              <div className="splash-status-text">
                <span className="splash-pulse-dot"></span>
                <span>Initializing portal...</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Immediate Deploy Update Notification Bar */}
      {appUpdateAvailable && (
        <aside className="pwa-update-bar" role="alert" aria-live="assertive">
          <div className="pwa-update-info">
            <RefreshCw size={16} className={isUpdatingApp ? "pwa-spin" : ""} />
            <span>A new update has been published! Refresh to apply immediately.</span>
          </div>
          <div className="pwa-update-actions">
            <button 
              className="pwa-update-btn"
              disabled={isUpdatingApp}
              onClick={() => {
                setIsUpdatingApp(true);
                applyImmediateUpdate();
              }}
            >
              {isUpdatingApp ? 'Updating...' : 'Update Now'}
            </button>
            <button
              className="pwa-dismiss-btn"
              onClick={() => {
                setAppUpdateAvailable(false);
                dismissUpdateNotification();
              }}
              title="Dismiss notification"
              aria-label="Dismiss notification"
            >
              <X size={15} />
            </button>
          </div>
        </aside>
      )}

      {/* Top Navbar Header */}
      <header className="header">
        <div 
          className={`logo-container ${isHoldingLogo ? 'logo-holding' : ''}`}
          onClick={handleLogoClick}
          onMouseDown={startLogoHold}
          onMouseUp={cancelLogoHold}
          onMouseLeave={cancelLogoHold}
          onTouchStart={startLogoHold}
          onTouchEnd={cancelLogoHold}
          onTouchCancel={cancelLogoHold}
          onContextMenu={handleLogoContextMenu}
          role="button" 
          tabIndex={0} 
          aria-label="Convenio Mart Home"
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleLogoClick(); }}
          style={{ cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none' }}
          title="Convenio Mart (Hold or Right-Click for Manager Portal)"
        >
          <svg className="logo-svg" role="img" aria-label="Convenio Mart Logo" viewBox="0 0 160 50" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 14H18M2 20H15M6 26H17" stroke="#e11d24" strokeWidth="3" strokeLinecap="round"/>
            <path d="M19 12H35L33 28H21L19 12Z" fill="#e11d24"/>
            <circle cx="27" cy="20" r="4.5" fill="white"/>
            <path d="M28.5 18C28.5 18 26.5 17.5 25.5 19C24.5 20.5 25.5 22 27 22C28.5 22 28.5 21 28.5 21" stroke="#e11d24" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
            <circle cx="22" cy="33" r="2.5" fill="#e11d24"/>
            <circle cx="32" cy="33" r="2.5" fill="#e11d24"/>
            <text x="43" y="27" fontFamily="'Plus Jakarta Sans', serif, sans-serif" fontWeight="800" fontSize="23" fill="#182238">Convenio</text>
            <text x="73" y="42" fontFamily="'Plus Jakarta Sans', sans-serif" fontWeight="800" fontSize="13" fill="#e11d24" letterSpacing="1">Mart</text>
          </svg>
        </div>

        {/* Dynamic Navigation: Admin tools on admin view; Sleek History button on attendance view */}
        {view === 'admin' ? (
          <div className="nav-actions">
            <div className="admin-header-nav-actions">
              {canInstallPwa && (
                <button 
                  id="admin-install-pwa-btn"
                  className="pwa-install-nav-btn"
                  onClick={handleInstallClick}
                  title="Install Convenio Marts on this device"
                  aria-label="Install App"
                >
                  <Download size={14} />
                  <span>Install App</span>
                </button>
              )}
              {isAdminAuthenticated && (
                <button 
                  id="header-settings-btn"
                  className="header-settings-icon-btn"
                  onClick={() => setShowSettingsModal(true)}
                  title="Admin Settings & Action History"
                  aria-label="Admin Settings & Action History"
                >
                  <Settings size={18} />
                  {adminLogs.length > 0 && <span className="header-settings-dot" />}
                </button>
              )}
              <button 
                id="nav-back-to-attendance-btn"
                className="portal-back-btn"
                onClick={() => navigateTo('attendance')}
              >
                <ArrowLeft size={16} />
                <span className="portal-back-label">Back to Attendance</span>
              </button>
              {isAdminAuthenticated && (
                <button 
                  id="admin-logout-btn"
                  className="portal-logout-btn"
                  onClick={handleAdminLogout}
                  title="Sign out of Admin Portal"
                  aria-label="Sign out of Admin Portal"
                >
                  <LogOut size={15} />
                  <span className="portal-logout-label">Logout</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="nav-actions">
            {canInstallPwa && (
              <button 
                id="header-install-pwa-btn"
                className="pwa-install-nav-btn"
                onClick={handleInstallClick}
                title="Install Convenio Marts on this device"
                aria-label="Install App"
              >
                <Download size={14} />
                <span>Install App</span>
              </button>
            )}
            <button
              id="header-history-btn"
              className="history-nav-trigger-btn"
              onClick={handleOpenHistoryDrawer}
              title="View Today's Check-In & Check-Out History"
              aria-label="View Today's Check-In and Check-Out History"
            >
              <History size={16} className="history-icon" />
              <span>History</span>
              {todayRecords.length > 0 && (
                <span className="history-badge-count">{todayRecords.length}</span>
              )}
            </button>
          </div>
        )}
      </header>

      {/* ================= 1. USER ATTENDANCE VIEW ================= */}
      {view === 'attendance' && (
        <main className="main-content">
          <div className="clean-card">
            <div className="clean-card-header">
              <h1 className="clean-card-title">Staff Attendance</h1>
              <p className="clean-card-subtitle">
                {geoStatus === 'checking'
                  ? 'Verifying store presence...'
                  : geoStatus === 'in_range'
                  ? 'Store verified on-site. Select your name to mark attendance.'
                  : 'Location verification required to prevent proxy attendance'}
              </p>
            </div>

            {/* 1. Checking Location Radar State */}
            {geoStatus === 'checking' && (
              <div className="geofence-checking-box">
                <div className="geofence-radar-icon-wrap">
                  <div className="geofence-radar-ping"></div>
                  <Navigation size={22} />
                </div>
                <h3 className="geofence-checking-title">Verifying Store Location...</h3>
                <p className="geofence-checking-sub">
                  Checking your GPS position against Convenio Mart branches (50m perimeter).
                </p>
              </div>
            )}

            {/* 2. Blocked / Out of Range Anti-Proxy Screen */}
            {geoStatus !== 'checking' && geoStatus !== 'in_range' && (
              <div className="geofence-blocked-card">
                <div className="geofence-blocked-icon-wrap">
                  <ShieldAlert size={28} />
                </div>
                <h3 className="geofence-blocked-title">Outside Store Geofence</h3>
                <p className="geofence-blocked-desc">
                  {geoStatus === 'denied'
                    ? 'Location permission was denied. Please allow location access in your browser to verify branch attendance.'
                    : geoStatus === 'unavailable'
                    ? (geoErrorMsg || 'GPS signal unavailable. Please ensure location is enabled on your device.')
                    : 'Attendance can only be marked while physically present inside a Convenio Mart branch (50m radius).'}
                </p>

                {geoData?.nearestBranch && (
                  <div className="geofence-nearest-box">
                    <div className="geofence-nearest-left">
                      <span className="geofence-nearest-label">Nearest Store</span>
                      <span className="geofence-nearest-name">{geoData.nearestBranch.name}</span>
                    </div>
                    <span className="geofence-nearest-dist-tag">
                      ~{formatDistance(geoData.distanceMeters)} away
                    </span>
                  </div>
                )}

                <div className="geofence-actions-row">
                  <button 
                    type="button" 
                    className="geofence-retry-btn"
                    onClick={() => checkGeofenceLocation(branches)}
                  >
                    <RefreshCw size={15} />
                    <span>Refresh My Location</span>
                  </button>
                </div>
              </div>
            )}

            {/* 3. Verified On-Site Form (Shows Branch Name & Address, then asks Employee Name) */}
            {geoStatus === 'in_range' && (
              <div className="clean-form">
                {/* Branch Name & Address Card */}
                <div className="geofence-verified-card">
                  <div className="geofence-verified-top">
                    <span className="geofence-verified-pill">
                      <span className="geofence-verified-dot"></span>
                      <span>Verified On-Site</span>
                    </span>
                    <span className="geofence-distance-chip">
                      {geoData?.distanceMeters != null ? `${geoData.distanceMeters}m away` : 'Within store (<50m)'}
                    </span>
                  </div>

                  <div className="geofence-branch-info">
                    <div className="geofence-branch-name">
                      <Store size={18} color="#e11d24" />
                      <span>{currentFormBranch?.name || geoData?.nearestBranch?.name || 'Convenio Mart'}</span>
                    </div>
                    <p className="geofence-branch-address">
                      <MapPin size={14} />
                      <span>{currentFormBranch?.address || geoData?.nearestBranch?.address || 'Branch Address'}</span>
                    </p>
                  </div>
                </div>

                {/* Employee Selection */}
                <div className="clean-field">
                  <div className="clean-field-header">
                    <label htmlFor="employee-select" className="clean-label">Employee Name</label>
                    <span className="clean-label-hint">Select from roster or type below</span>
                  </div>

                  {/* 1. Dropdown Selection */}
                  <div className="clean-select-wrapper">
                    <select
                      id="employee-select"
                      className="clean-select"
                      value={selectedEmpId}
                      onChange={(e) => {
                        const newId = e.target.value;
                        setSelectedEmpId(newId);
                        const emp = allCompanyEmployees.find(x => x.id === newId);
                        if (emp) {
                          setTypedEmpName(emp.name);
                        }
                        if (formValidationMsg) setFormValidationMsg('');
                      }}
                    >
                      <option value="" disabled>Select Your Name</option>
                      {currentBranchEmployees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name}
                        </option>
                      ))}
                      {/* If an employee from another branch is verified, display clean name */}
                      {currentFormEmployee && !currentBranchEmployees.some(e => e.id === currentFormEmployee.id) && (
                        <option key={currentFormEmployee.id} value={currentFormEmployee.id}>
                          {currentFormEmployee.name}
                        </option>
                      )}
                    </select>
                    <ChevronDown className="clean-chevron" size={18} />
                  </div>

                  {/* Divider */}
                  <div className="emp-or-divider">
                    <span className="emp-or-line"></span>
                    <span className="emp-or-text">OR TYPE YOUR NAME BELOW</span>
                    <span className="emp-or-line"></span>
                  </div>

                  {/* 2. Text Box Below Dropdown */}
                  <div className="emp-type-container">
                    <div className="emp-type-input-group">
                      <Search size={16} className="emp-type-search-icon" />
                      <input
                        type="text"
                        id="employee-name-type-input"
                        placeholder="Type your name (min 4 letters)..."
                        value={typedEmpName}
                        onChange={(e) => handleTypedNameChange(e.target.value)}
                        className={`clean-input emp-type-input ${
                          typedEmpName.trim().length >= 4 && matchedCompanyEmployees.length === 0 ? 'input-unmatched' :
                          currentFormEmployee ? 'input-matched' : ''
                        }`}
                        autoComplete="off"
                      />
                      {typedEmpName && (
                        <button
                          type="button"
                          className="emp-type-clear-btn"
                          onClick={() => {
                            setTypedEmpName('');
                            setSelectedEmpId('');
                            if (formValidationMsg) setFormValidationMsg('');
                          }}
                          title="Clear input"
                        >
                          <X size={15} />
                        </button>
                      )}
                    </div>

                    {/* Simple Name Choice (Only when at least 4 characters typed, multiple matches, and not yet selected) */}
                    {typedEmpName.trim().length >= 4 && matchedCompanyEmployees.length > 1 && !currentFormEmployee && (
                      <div className="emp-disambiguate-card">
                        <span className="disambiguate-label">Select your name:</span>
                        <div className="emp-disambiguate-list">
                          {matchedCompanyEmployees.map((emp) => (
                            <button
                              key={emp.id}
                              type="button"
                              className="emp-disambiguate-chip"
                              onClick={() => {
                                setSelectedEmpId(emp.id);
                                setTypedEmpName(emp.name);
                                if (formValidationMsg) setFormValidationMsg('');
                              }}
                            >
                              <span className="chip-name">{emp.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Not found warning (Only after typing at least 4 characters) */}
                    {typedEmpName.trim().length >= 4 && matchedCompanyEmployees.length === 0 && (
                      <div className="emp-verified-tag tag-danger">
                        <AlertCircle size={15} />
                        <span>Name not found in employee list</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Smart Status Detection Banner */}
                {activeFormEmpName && (
                  <div className={`smart-status-banner status-${latestTodayRecord?.type || 'none'}`}>
                    <div className="status-banner-left">
                      <span className={`status-indicator-dot dot-${latestTodayRecord?.type || 'none'}`}></span>
                      <div className="status-text-group">
                        <div className="status-primary-line">
                          {latestTodayRecord?.type === 'in' ? (
                            <>
                              <strong className="status-title-in">Checked In Today</strong>
                              <span className="status-time-chip">{formatTo12HourTime(latestTodayRecord.shortTime || latestTodayRecord.time)}</span>
                            </>
                          ) : latestTodayRecord?.type === 'out' ? (
                            <>
                              <strong className="status-title-out">Checked Out Today</strong>
                              <span className="status-time-chip">{formatTo12HourTime(latestTodayRecord.shortTime || latestTodayRecord.time)}</span>
                            </>
                          ) : (
                            <strong className="status-title-none">Not Checked In Today</strong>
                          )}
                        </div>
                        <p className="status-subtext">
                          {latestTodayRecord?.type === 'in' 
                            ? 'Shift active • Tap Check Out when your shift ends'
                            : latestTodayRecord?.type === 'out'
                            ? 'Shift complete • Ready if starting a new shift'
                            : 'Tap Check In to begin today\'s shift'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Validation Alert */}
                {formValidationMsg && (
                  <div className="clean-alert">
                    <AlertCircle size={16} />
                    <span>{formValidationMsg}</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="clean-actions">
                  <button 
                    id="btn-check-in"
                    className={`clean-btn clean-btn-in ${latestTodayRecord?.type === 'in' ? 'btn-dimmed-secondary' : ''}`}
                    onClick={() => handleActionClick('in')}
                    disabled={!currentFormEmployee || latestTodayRecord?.type === 'in'}
                    title={
                      !currentFormEmployee
                        ? (typedEmpName.trim() && matchedCompanyEmployees.length > 1
                            ? 'Please select which employee you are before checking in'
                            : 'Select or verify your registered name from employee list to check in')
                        : latestTodayRecord?.type === 'in'
                        ? `${activeFormEmpName} is already checked in today`
                        : 'Record Check In'
                    }
                  >
                    <LogIn size={18} />
                    <span>Check In</span>
                    {(!latestTodayRecord || latestTodayRecord?.type === 'out') && (
                      <span className="action-tag-pill">Start</span>
                    )}
                  </button>

                  <button 
                    id="btn-check-out"
                    className={`clean-btn clean-btn-out ${latestTodayRecord?.type === 'in' ? 'btn-highlighted-action' : ''}`}
                    onClick={() => handleActionClick('out')}
                    disabled={!currentFormEmployee || latestTodayRecord?.type !== 'in'}
                    title={
                      !currentFormEmployee
                        ? (typedEmpName.trim() && matchedCompanyEmployees.length > 1
                            ? 'Please select which employee you are before checking out'
                            : 'Select or verify your registered name from employee list to check out')
                        : latestTodayRecord?.type !== 'in'
                        ? 'Check in required before checking out'
                        : 'Record Check Out'
                    }
                  >
                    <LogOut size={18} />
                    <span>Check Out</span>
                    {latestTodayRecord?.type === 'in' && (
                      <span className="action-tag-pill tag-pill-checkout">End Shift</span>
                    )}
                  </button>
                </div>
              </div>
            )}

            <footer className="portal-footer">
              <span className="footer-copyright">Convenio Marts Attendance</span>
              <span className="footer-dot">•</span>
              <button 
                type="button" 
                className="footer-admin-link"
                onClick={handlePurgeCache}
                title="Wipe local browser cache and reload fresh from database"
              >
                Clear Cache
              </button>
            </footer>
          </div>
        </main>
      )}

      {/* ================= 2. ADMIN PORTAL VIEW ================= */}
      {view === 'admin' && (
        !isAdminAuthenticated ? (
          <main className="main-content">
            <div className="admin-login-card">
              <div className="admin-login-header">
                <div className={`admin-login-badge-icon ${loginRoleTab === 'manager' ? 'icon-manager-amber' : ''}`}>
                  {loginRoleTab === 'manager' ? <Users size={26} /> : <Lock size={26} />}
                </div>
                <h1 className="admin-login-title">
                  {loginRoleTab === 'manager' ? 'Store Manager Portal' : 'Admin Authentication'}
                </h1>
                <p className="admin-login-subtitle">
                  {loginRoleTab === 'manager' 
                    ? 'Staff branch transfers & attendance monitoring portal' 
                    : 'Restricted access. Please sign in with your HR management credentials.'}
                </p>
              </div>

              {/* Role Toggle Tabs */}
              <div className="login-role-tabs" role="tablist" aria-label="Portal Selection">
                <button
                  type="button"
                  role="tab"
                  aria-selected={loginRoleTab === 'admin'}
                  className={`login-role-tab tab-admin ${loginRoleTab === 'admin' ? 'active' : ''}`}
                  onClick={() => {
                    setLoginRoleTab('admin');
                    setAdminAuthError('');
                  }}
                >
                  <ShieldCheck size={17} />
                  <span>Super Admin</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={loginRoleTab === 'manager'}
                  className={`login-role-tab tab-manager ${loginRoleTab === 'manager' ? 'active' : ''}`}
                  onClick={() => {
                    setLoginRoleTab('manager');
                    setAdminAuthError('');
                  }}
                >
                  <Users size={17} />
                  <span>Store Manager</span>
                </button>
              </div>

              {adminAuthError && (
                <div className="admin-login-error">
                  <AlertCircle size={18} />
                  <span>{adminAuthError}</span>
                </div>
              )}

              <form className="admin-login-form" onSubmit={handleAdminLogin}>
                {loginRoleTab === 'admin' ? (
                  <div className="admin-input-group">
                    <label htmlFor="admin-username-input">Admin Email</label>
                    <div className="admin-input-wrapper">
                      <Mail size={18} className="admin-input-icon" />
                      <input
                        id="admin-username-input"
                        type="email"
                        required
                        autoComplete="username"
                        value={adminUsername}
                        onChange={(e) => {
                          setAdminUsername(e.target.value);
                          if (adminAuthError) setAdminAuthError('');
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="admin-input-group">
                    <label htmlFor="manager-username-input">Manager Username</label>
                    <div className="admin-input-wrapper">
                      <Users size={18} className="admin-input-icon" />
                      <input
                        id="manager-username-input"
                        type="text"
                        required
                        autoComplete="username"
                        value={adminUsername}
                        onChange={(e) => {
                          setAdminUsername(e.target.value);
                          if (adminAuthError) setAdminAuthError('');
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="admin-input-group">
                  <label htmlFor="admin-password-input">
                    {loginRoleTab === 'manager' ? 'Manager Password' : 'Admin Password'}
                  </label>
                  <div className="admin-input-wrapper">
                    <Lock size={18} className="admin-input-icon" />
                    <input
                      id="admin-password-input"
                      type={showAdminPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={adminPassword}
                      onChange={(e) => {
                        setAdminPassword(e.target.value);
                        if (adminAuthError) setAdminAuthError('');
                      }}
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowAdminPassword(!showAdminPassword)}
                      tabIndex={-1}
                      title={showAdminPassword ? 'Hide password' : 'Show password'}
                    >
                      {showAdminPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  id="admin-login-submit-btn"
                  className={`admin-login-submit-btn ${loginRoleTab === 'manager' ? 'btn-manager-submit' : ''}`}
                  disabled={isAdminLoggingIn}
                >
                  {isAdminLoggingIn ? (
                    <>
                      <Loader2 size={18} className="spinner" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      {loginRoleTab === 'manager' ? <Users size={18} /> : <ShieldCheck size={18} />}
                      <span>{loginRoleTab === 'manager' ? 'Sign In to Manager Portal' : 'Sign In as Super Admin'}</span>
                    </>
                  )}
                </button>
              </form>

              <div className="admin-login-footer">
                <button
                  type="button"
                  className="admin-login-back-link"
                  onClick={() => navigateTo('attendance')}
                >
                  <ArrowLeft size={14} />
                  <span>Return to Staff Attendance</span>
                </button>
              </div>
            </div>
          </main>
        ) : (
          <main className="admin-container">
            {/* Transfer & Action Feedback Toast */}
            {transferToast && (
              <div className={`admin-feedback-toast toast-${transferToast.type}`}>
                <div className="toast-left">
                  <CheckCircle2 size={17} className="toast-icon-check" />
                  <span>{transferToast.message}</span>
                </div>
                <button 
                  type="button" 
                  className="toast-close-btn" 
                  onClick={() => setTransferToast(null)}
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Admin Header with Sub-tabs */}
            <div className="admin-header-card">
              <div className="admin-title-row">
                <div className="admin-title-left">
                  <h1 className="admin-title">
                    {authRole === 'manager' ? 'Store Manager Portal' : 'Admin Dashboard'}
                  </h1>
                  <div className="admin-auth-row">
                    {authRole === 'manager' ? (
                      <>
                        <div className="admin-auth-badge badge-manager-identity">
                          <Users size={13} color="#d97706" />
                          <span>Manager: <strong>{currentManagerName || 'Store Manager'}</strong></span>
                        </div>
                        <span className="manager-scope-tag">Staff Transfer & Attendance View Only</span>
                      </>
                    ) : (
                      <>
                        <div className="admin-auth-badge">
                          <ShieldCheck size={13} color="#e11d24" />
                          <span>hr@lordsandkings.co</span>
                        </div>
                        <button 
                          type="button" 
                          id="btn-purge-cache"
                          className="btn-purge-cache" 
                          onClick={handlePurgeCache} 
                          title="Clear all browser cached memory and re-sync fresh from database"
                        >
                          <RefreshCw size={11} />
                          <span>Clear Cache</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Top Navigation Sub-Tabs */}
                <div className="admin-nav-tabs">
                  <button 
                    id="tab-btn-branches"
                    className={`admin-tab-btn ${adminTab === 'branches' ? 'active' : ''}`}
                    onClick={() => setAdminTab('branches')}
                  >
                    <Building2 size={16} />
                    <span className="tab-label-full">{authRole === 'manager' ? 'Staff Transfers' : 'Branches & Staff'}</span>
                    <span className="tab-label-short">{authRole === 'manager' ? 'Transfers' : 'Branches'}</span>
                    <span className="tab-pill-counter">{branches.length}</span>
                  </button>
                  <button 
                    id="tab-btn-logs"
                    className={`admin-tab-btn ${adminTab === 'logs' ? 'active' : ''}`}
                    onClick={() => setAdminTab('logs')}
                  >
                    <History size={16} />
                    <span className="tab-label-full">Attendance Logs</span>
                    <span className="tab-label-short">Logs</span>
                    <span className="tab-pill-counter">{records.length}</span>
                  </button>
                  {authRole === 'admin' && (
                    <button 
                      id="tab-btn-managers"
                      className={`admin-tab-btn ${adminTab === 'managers' ? 'active' : ''}`}
                      onClick={() => setAdminTab('managers')}
                    >
                      <Users size={16} />
                      <span className="tab-label-full">Store Managers</span>
                      <span className="tab-label-short">Managers</span>
                      <span className="tab-pill-counter">{managersList.length}</span>
                    </button>
                  )}
                  {authRole === 'admin' && (
                    <button 
                      id="tab-btn-circulars"
                      className={`admin-tab-btn ${adminTab === 'circulars' ? 'active' : ''}`}
                      onClick={() => setAdminTab('circulars')}
                    >
                      <Megaphone size={16} />
                      <span className="tab-label-full">Circulars</span>
                      <span className="tab-label-short">Circular</span>
                      <span className="tab-pill-counter">{circulars.length}</span>
                    </button>
                  )}
                  {authRole === 'admin' && (
                    <button 
                      id="tab-btn-timesheet"
                      className={`admin-tab-btn ${adminTab === 'timesheet' ? 'active' : ''}`}
                      onClick={() => setAdminTab('timesheet')}
                    >
                      <CalendarDays size={16} />
                      <span className="tab-label-full">Monthly Timesheet</span>
                      <span className="tab-label-short">Timesheet</span>
                      <span className="tab-pill-counter" style={{ background: '#ecfdf5', color: '#047857' }}>HR</span>
                    </button>
                  )}
                </div>
              </div>

              {/* High Level Metrics Bar */}
              <div className="admin-stats-grid">
                <div className="stat-card">
                  <span className="stat-label">Total Branches</span>
                  <span className="stat-val text-navy">{branches.length}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Total Staff</span>
                  <span className="stat-val text-navy">{totalEmployeesCount}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Today's Check Ins</span>
                  <span className="stat-val text-green">{todayCheckInsCount}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Total Attendance Logs</span>
                  <span className="stat-val text-navy">{records.length}</span>
                </div>
              </div>
            </div>

          {/* TAB 1: BRANCH & EMPLOYEE MANAGEMENT */}
          {adminTab === 'branches' && (
            <div className="branches-management-layout">
              {/* Left Column: Branches List & Add/Edit */}
              <div className="branch-column-card">
                <div className="column-card-header">
                  <div className="column-card-title">
                    <Building2 size={18} className="card-icon-navy" />
                    <div>
                      <h3>Branches ({branches.length})</h3>
                    </div>
                  </div>
                  {authRole === 'admin' && (
                    <button 
                      id="btn-add-branch-open"
                      className="btn-add-primary"
                      onClick={() => setShowAddBranchModal(true)}
                    >
                      <Plus size={16} />
                      <span>Add Branch</span>
                    </button>
                  )}
                </div>

                <div className="branch-cards-list">
                  {branches.length === 0 ? (
                    <div className="empty-sub-state">
                      <Store size={36} color="#cbd5e1" />
                      <p>No branches configured. Click "Add Branch" above.</p>
                    </div>
                  ) : (
                    branches.map((b) => {
                      const isSelected = b.id === adminSelectedBranchId;
                      const empCount = b.employees?.length || 0;
                      return (
                        <div 
                          key={b.id} 
                          className={`branch-item-card ${isSelected ? 'active-branch' : ''}`}
                          onClick={() => setAdminSelectedBranchId(b.id)}
                        >
                          <div className="branch-item-left">
                            <div className="branch-icon-box">
                              <Store size={18} />
                            </div>
                            <div className="branch-meta">
                              <strong className="branch-title">{b.name}</strong>
                              <span className="branch-emp-pill">
                                <Users size={11} /> {empCount} staff
                              </span>
                            </div>
                          </div>

                          <div className="branch-item-actions" onClick={(e) => e.stopPropagation()}>
                            {authRole === 'admin' && (
                              <>
                                <button 
                                  className="btn-icon-edit"
                                  title="Edit Branch Name"
                                  onClick={() => setEditingBranch(b)}
                                >
                                  <Pencil size={14} />
                                </button>
                                <button 
                                  className="btn-icon-delete"
                                  title="Delete Branch"
                                  onClick={() => promptDeleteBranch(b.id)}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Column: Employees for Selected Branch */}
              <div className="employees-column-card">
                {currentAdminBranch ? (
                  <>
                    <div className="column-card-header">
                      <div className="column-card-title">
                        <Users size={18} className="card-icon-red" />
                        <div>
                          <h3>{currentAdminBranch.name}</h3>
                          <p className="sub-text">
                            {currentAdminBranch.employees?.length || 0} registered staff members
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Manager Mode Guidance Banner */}
                    {authRole === 'manager' && (
                      <div className="manager-transfer-banner">
                        <Users size={16} />
                        <div>
                          <strong>Store Manager Transfer Mode:</strong>
                          <span> Select staff using checkboxes to bulk transfer or click the transfer icon <ArrowRightLeft size={12} style={{display:'inline', verticalAlign:'middle'}} /> to move staff to another branch.</span>
                        </div>
                      </div>
                    )}

                    {/* Clean Add Employee Form (Super Admin Only) */}
                    {authRole === 'admin' && (
                      <form className="add-emp-form-card" onSubmit={handleAddEmployee}>
                        <div className="add-emp-inputs-row">
                          <div className="input-group-grow">
                            <input 
                              id="new-emp-name-input"
                              type="text" 
                              required 
                              placeholder="Add employee name (e.g. Ramesh Kumar)" 
                              value={newEmpName}
                              onChange={(e) => setNewEmpName(e.target.value)}
                            />
                          </div>
                          <button 
                            id="btn-add-emp-submit"
                            type="submit" 
                            className="btn-add-emp"
                          >
                            <Plus size={16} />
                            <span>Add Staff</span>
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Employee Roster Search */}
                    {currentAdminBranch.employees?.length > 3 && (
                      <div className="emp-search-row">
                        <Search size={15} color="#94a3b8" />
                        <input 
                          type="text" 
                          placeholder="Filter employees in this branch..."
                          value={adminEmpSearch}
                          onChange={(e) => setAdminEmpSearch(e.target.value)}
                        />
                        {adminEmpSearch && (
                          <button className="clear-search-btn" onClick={() => setAdminEmpSearch('')}>
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    )}

                    {/* Employees List */}
                    <div className="employee-roster-list">
                      {!currentAdminBranch.employees || currentAdminBranch.employees.length === 0 ? (
                        <div className="empty-sub-state">
                          <Users size={36} color="#cbd5e1" />
                          <p>No employees added for this branch yet.</p>
                          <span className="sub-helper">Use the form above to add staff members who work here.</span>
                        </div>
                      ) : (
                        currentAdminBranch.employees
                          .filter(emp => !adminEmpSearch || emp.name.toLowerCase().includes(adminEmpSearch.toLowerCase()) || (emp.role && emp.role.toLowerCase().includes(adminEmpSearch.toLowerCase())))
                          .map((emp) => {
                            const isChecked = selectedEmpIds.includes(emp.id);
                            const otherBranches = branches.filter(b => b.id !== currentAdminBranch.id);

                            return (
                              <div key={emp.id} className={`employee-roster-item ${isChecked ? 'emp-item-selected' : ''}`}>
                                <div className="emp-item-left">
                                  <button 
                                    type="button"
                                    className={`emp-checkbox-btn ${isChecked ? 'is-checked' : ''}`}
                                    onClick={() => {
                                      setSelectedEmpIds(prev => 
                                        prev.includes(emp.id) ? prev.filter(id => id !== emp.id) : [...prev, emp.id]
                                      );
                                    }}
                                    title={isChecked ? 'Deselect staff' : 'Select for bulk transfer'}
                                  >
                                    {isChecked ? <CheckSquare size={17} className="check-icon-active" /> : <Square size={17} className="check-icon-idle" />}
                                  </button>

                                  <div className="emp-avatar-bubble">
                                    {emp.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="emp-item-info">
                                    <div className="emp-name-row">
                                      <strong className="emp-item-name">{emp.name}</strong>
                                      {emp.lastTransferredBy && (
                                        <span 
                                          className="emp-transferred-tag" 
                                          title={`Transferred by ${emp.lastTransferredBy}${emp.lastTransferredAt ? ' on ' + new Date(emp.lastTransferredAt).toLocaleDateString() : ''}`}
                                        >
                                          Moved by {emp.lastTransferredBy}
                                        </span>
                                      )}
                                    </div>
                                    {emp.role && <span className="emp-item-role">{emp.role}</span>}
                                  </div>
                                </div>

                                <div className="emp-item-actions">
                                  {/* Transfer is available to both Managers and Admin */}
                                  <button 
                                    type="button"
                                    className="btn-icon-transfer"
                                    title="Transfer to Another Branch"
                                    onClick={() => setTransferModalStaff({
                                      emp,
                                      fromBranchId: currentAdminBranch.id,
                                      toBranchId: otherBranches[0]?.id || ''
                                    })}
                                  >
                                    <ArrowRightLeft size={14} />
                                  </button>

                                  {/* Edit and Delete are Super Admin Only */}
                                  {authRole === 'admin' && (
                                    <>
                                      <button 
                                        type="button"
                                        className="btn-icon-edit"
                                        title="Edit Employee & Branch"
                                        onClick={() => setEditingEmp({
                                          branchId: currentAdminBranch.id,
                                          empId: emp.id,
                                          name: emp.name,
                                          role: emp.role || '',
                                          targetBranchId: currentAdminBranch.id
                                        })}
                                      >
                                        <Pencil size={14} />
                                      </button>
                                      <button 
                                        type="button"
                                        className="btn-icon-delete"
                                        title="Remove Employee"
                                        onClick={() => promptDeleteEmployee(currentAdminBranch.id, emp)}
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })
                      )}
                    </div>

                    {/* Bulk Selection Floating Action Bar */}
                    {selectedEmpIds.length > 0 && (
                      <div className="bulk-transfer-dock">
                        <div className="bulk-dock-left">
                          <span className="bulk-badge">
                            <Users size={14} />
                            <strong>{selectedEmpIds.length}</strong> {selectedEmpIds.length === 1 ? 'staff member' : 'staff members'} selected
                          </span>
                          <button 
                            type="button"
                            className="btn-bulk-cancel"
                            onClick={() => setSelectedEmpIds([])}
                          >
                            Deselect
                          </button>
                        </div>

                        <div className="bulk-dock-right">
                          <span className="dock-prompt">Move to:</span>
                          <select 
                            className="bulk-branch-select"
                            value={bulkTargetBranchId}
                            onChange={(e) => setBulkTargetBranchId(e.target.value)}
                          >
                            <option value="">-- Choose destination branch --</option>
                            {branches
                              .filter(b => b.id !== currentAdminBranch.id)
                              .map(b => (
                                <option key={b.id} value={b.id}>
                                  {b.name} ({b.employees?.length || 0} staff)
                                </option>
                              ))}
                          </select>
                          <button 
                            type="button"
                            className="btn-bulk-execute"
                            disabled={!bulkTargetBranchId}
                            onClick={() => handleTransferEmployees(selectedEmpIds, currentAdminBranch.id, bulkTargetBranchId)}
                          >
                            <ArrowRightLeft size={15} />
                            <span>Transfer Now</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="empty-sub-state">
                    <p>Select a branch to manage its employees.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: ATTENDANCE RECORDS LOGS */}
          {adminTab === 'logs' && (
            <div className="attendance-logs-container">
              {/* Filter and Action Header */}
              <div className="logs-toolbar-card">
                <div className="search-box">
                  <Search size={18} color="#94a3b8" />
                  <input 
                    id="history-search-input"
                    type="text" 
                    placeholder="Search employee name, branch, place, coordinates..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <button className="search-clear-btn" onClick={() => setSearchTerm('')}>
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="toolbar-right-actions">
                  {/* Date Filter Button */}
                  <button 
                    id="btn-date-filter"
                    className={`btn-date-filter ${isDateFilterActive ? 'active' : ''}`}
                    onClick={() => {
                      setTempFilterMode(dateFilterMode === 'all' ? 'single' : dateFilterMode);
                      setTempSingleDate(filterSingleDate || toYMD(new Date()));
                      setTempStartDate(filterStartDate);
                      setTempEndDate(filterEndDate);
                      setShowDateFilterModal(true);
                    }}
                    title="Filter logs by specific date or date range"
                  >
                    <Calendar size={15} />
                    <span className="btn-date-label">{dateFilterLabel}</span>
                    {isDateFilterActive && (
                      <span 
                        className="btn-date-clear-inline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClearDateFilter();
                        }}
                        title="Clear date filter"
                      >
                        <X size={12} />
                      </span>
                    )}
                  </button>

                  <div className="filter-pill-group">
                    <button 
                      className={`filter-pill ${filterType === 'all' ? 'active' : ''}`}
                      onClick={() => setFilterType('all')}
                    >
                      All ({records.length})
                    </button>
                    <button 
                      className={`filter-pill ${filterType === 'in' ? 'active' : ''}`}
                      onClick={() => setFilterType('in')}
                    >
                      Check In ({records.filter((r) => r.type === 'in').length})
                    </button>
                    <button 
                      className={`filter-pill ${filterType === 'out' ? 'active' : ''}`}
                      onClick={() => setFilterType('out')}
                    >
                      Check Out ({records.filter((r) => r.type === 'out').length})
                    </button>
                  </div>

                  <div className="export-clear-group">
                    <button 
                      id="export-csv-btn"
                      className="btn-export-csv" 
                      onClick={exportToCSV}
                      disabled={filteredRecords.length === 0}
                      title="Download Attendance CSV"
                    >
                      <FileSpreadsheet size={16} />
                      <span>Export CSV</span>
                    </button>
                    {authRole === 'admin' && records.length > 0 && (
                      <button 
                        id="clear-records-btn" 
                        className="btn-danger-clear" 
                        onClick={promptClearAllRecords}
                        title="Clear all logs"
                      >
                        <Trash2 size={16} />
                        <span>Clear All</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Active Date Filter Banner */}
              {isDateFilterActive && (
                <div className="active-date-filter-banner">
                  <div className="filter-banner-info">
                    <Calendar size={15} className="banner-cal-icon" />
                    <span>
                      Filtered by <strong>{dateFilterLabel}</strong>: <strong>{filteredRecords.length}</strong> matching {filteredRecords.length === 1 ? 'record' : 'records'} found
                    </span>
                  </div>
                  <button className="btn-clear-date-banner" onClick={handleClearDateFilter} title="Reset date filter">
                    <X size={13} />
                    <span>Clear Date Filter</span>
                  </button>
                </div>
              )}

              {/* Records Table */}
              {filteredRecords.length === 0 ? (
                <div className="admin-empty-state">
                  <Clock size={48} color="#cbd5e1" />
                  <h3>No Attendance Records Found</h3>
                  <p>
                    {isDateFilterActive 
                      ? `No attendance records match the selected date filter (${dateFilterLabel}).` 
                      : 'When staff members select their branch & take selfie attendance, verified records will appear here.'}
                  </p>
                  {isDateFilterActive ? (
                    <button className="btn-go-portal" onClick={handleClearDateFilter}>
                      Clear Date Filter
                    </button>
                  ) : (
                    <button className="btn-go-portal" onClick={() => navigateTo('attendance')}>
                      Go to Attendance Portal
                    </button>
                  )}
                </div>
              ) : (
                <div className="records-table-container">
                  <table className="records-table">
                    <thead>
                      <tr>
                        <th>Selfie Photo</th>
                        <th>Employee Name</th>
                        <th>Branch</th>
                        <th>Action</th>
                        <th>Date & Time</th>
                        <th>Map Location</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRecords.map((item) => (
                        <tr 
                          key={item.id} 
                          className="table-record-row"
                          onClick={() => setSelectedRecord(item)}
                        >
                          {/* Photo Thumbnail */}
                          <td>
                            <div 
                              className="selfie-thumb-wrapper" 
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewingPhoto(item);
                              }}
                              title="Click to view full photo"
                            >
                              {item.photo ? (
                                <img src={item.photo} alt="Selfie" className="selfie-thumbnail" loading="lazy" decoding="async" width="40" height="40" />
                              ) : (
                                <div className="no-photo"><Camera size={16} /></div>
                              )}
                              <div className="thumb-hover-overlay">
                                <Eye size={14} />
                              </div>
                            </div>
                          </td>

                          {/* Employee Name & Role */}
                          <td>
                            <div className="table-emp-info">
                              <strong className="table-emp-name">{item.employeeName}</strong>
                              {item.employeeRole && (
                                <span className="table-emp-role">{item.employeeRole}</span>
                              )}
                            </div>
                          </td>

                          {/* Branch Name */}
                          <td>
                            <div className="table-branch-cell">
                              <Building2 size={13} className="branch-icon" />
                              <span>{item.branchName || '-'}</span>
                              {item.geofenceVerified && (
                                <span className="table-geofence-chip" title="Verified within 50m of branch">
                                  <ShieldCheck size={11} />
                                  <span>On-Site{item.distanceMeters != null ? ` (${item.distanceMeters}m)` : ''}</span>
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Action */}
                          <td>
                            <span className={`table-badge ${item.type === 'in' ? 'badge-in' : isMissedCheckoutRecord(item) ? 'badge-missed' : 'badge-out'}`}>
                              {item.type === 'in' ? <LogIn size={13} /> : <LogOut size={13} />}
                              <span>{item.type === 'in' ? 'Check In' : isMissedCheckoutRecord(item) ? 'Check Out (Missed Checkout)' : 'Check Out'}</span>
                            </span>
                          </td>

                          {/* Time */}
                          <td>
                            <div className="table-time-cell">
                              <div className="time-primary">{formatTo12HourTime(item.time || item.shortTime)}</div>
                              <div className="date-secondary">{item.date}</div>
                            </div>
                          </td>

                          {/* Map Pin / Location */}
                          <td>
                            <div className="table-location-cell">
                              {item.location?.lat ? (
                                <a 
                                  href={`https://www.google.com/maps?q=${item.location.lat},${item.location.lng}`}
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="table-map-pin-link"
                                  onClick={(e) => e.stopPropagation()}
                                  title="Open in Google Maps"
                                >
                                  <MapPin size={14} className="loc-pin" />
                                  <span className="loc-text-truncate">
                                    {item.location.placeName || `${item.location.lat}, ${item.location.lng}`}
                                  </span>
                                  <ExternalLink size={11} />
                                </a>
                              ) : (
                                <span className="text-muted-small">No GPS</span>
                              )}
                            </div>
                          </td>

                          {/* Details Button */}
                          <td>
                            <button 
                              className="btn-table-view-detail"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRecord(item);
                              }}
                              title="View Full Record"
                            >
                              <span>View Details</span>
                              <ExternalLink size={11} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Pagination Bar */}
                  {filteredRecords.length > 0 && (
                    <div className="table-pagination-bar">
                      <div className="pagination-info">
                        <span>
                          Showing <strong>{startIndex + 1}</strong> – <strong>{endIndex}</strong> of <strong>{filteredRecords.length}</strong> logs
                        </span>
                      </div>

                      <div className="pagination-controls">
                        {/* Rows per page selector */}
                        <div className="pagination-rows-select">
                          <label htmlFor="log-page-size-select">Rows per page:</label>
                          <select 
                            id="log-page-size-select"
                            value={logPageSize}
                            onChange={(e) => {
                              setLogPageSize(Number(e.target.value));
                              setLogPage(1);
                            }}
                            className="page-size-dropdown"
                          >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                          </select>
                        </div>

                        {/* Page Navigation Buttons */}
                        <div className="pagination-nav-group">
                          <button
                            id="btn-page-first"
                            className="btn-page-nav"
                            disabled={validLogPage <= 1}
                            onClick={() => setLogPage(1)}
                            title="First page"
                          >
                            <ChevronsLeft size={16} />
                          </button>
                          <button
                            id="btn-page-prev"
                            className="btn-page-nav"
                            disabled={validLogPage <= 1}
                            onClick={() => setLogPage(prev => Math.max(prev - 1, 1))}
                            title="Previous page"
                          >
                            <ChevronLeft size={16} />
                          </button>

                          <div className="pagination-page-indicator">
                            Page <strong>{validLogPage}</strong> of <strong>{totalPages}</strong>
                          </div>

                          <button
                            id="btn-page-next"
                            className="btn-page-nav"
                            disabled={validLogPage >= totalPages}
                            onClick={() => setLogPage(prev => Math.min(prev + 1, totalPages))}
                            title="Next page"
                          >
                            <ChevronRight size={16} />
                          </button>
                          <button
                            id="btn-page-last"
                            className="btn-page-nav"
                            disabled={validLogPage >= totalPages}
                            onClick={() => setLogPage(totalPages)}
                            title="Last page"
                          >
                            <ChevronsRight size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: STORE MANAGERS DIRECTORY (SUPER ADMIN ONLY) */}
          {adminTab === 'managers' && authRole === 'admin' && (
            <div className="managers-portal-view">
              {/* Directory Header Bar */}
              <div className="managers-header-card">
                <div className="managers-header-info">
                  <div className="mgr-header-icon-box">
                    <Users size={22} className="card-icon-navy" />
                  </div>
                  <div>
                    <div className="mgr-title-row">
                      <h3>Store Managers Directory</h3>
                      <span className="mgr-count-pill">{managersList.length} Active Managers</span>
                    </div>
                  </div>
                </div>
                <button 
                  type="button" 
                  id="btn-add-manager-open"
                  className="btn-add-primary"
                  onClick={() => setShowAddManagerModal(true)}
                >
                  <Plus size={16} />
                  <span>Add New Manager</span>
                </button>
              </div>

              {/* Managers Grid */}
              {managersList.length === 0 ? (
                <div className="empty-sub-state" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '2.5rem 1rem' }}>
                  <Users size={40} color="#cbd5e1" />
                  <p style={{ fontWeight: 600, color: '#334155', marginTop: '0.5rem' }}>No store managers created yet.</p>
                  <span className="sub-helper">Click "+ Add New Manager" above to create manager accounts with custom username & password.</span>
                </div>
              ) : (
                <div className="managers-grid-container">
                  {managersList.map((mgr) => (
                    <div key={mgr.id} className="manager-directory-card">
                      <div className="mgr-card-top">
                        <div className="mgr-avatar-circle">
                          {mgr.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="mgr-card-meta">
                          <div className="mgr-name-row">
                            <strong className="mgr-name">{mgr.name}</strong>
                            <span className="mgr-role-badge">{mgr.role || 'Store Manager'}</span>
                          </div>
                          <span className="mgr-email-label">{mgr.email || 'manager@convenio.in'}</span>
                        </div>
                      </div>

                      <div className="mgr-creds-strip">
                        <div className="mgr-cred-row">
                          <span className="mgr-cred-key">Username:</span>
                          <code className="mgr-cred-val">{mgr.username || mgr.name.toLowerCase().replace(/\s+/g, '')}</code>
                        </div>
                        <div className="mgr-cred-row">
                          <span className="mgr-cred-key">Password:</span>
                          <div className="mgr-pass-inline">
                            <code className="mgr-cred-val">
                              {visiblePasswords[mgr.id] ? (mgr.password || 'mgr@2018') : '••••••••'}
                            </code>
                            <button
                              type="button"
                              className="btn-toggle-mgr-pass"
                              onClick={() => setVisiblePasswords(prev => ({ ...prev, [mgr.id]: !prev[mgr.id] }))}
                              title={visiblePasswords[mgr.id] ? 'Hide password' : 'Show password'}
                            >
                              {visiblePasswords[mgr.id] ? <EyeOff size={13} /> : <Eye size={13} />}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="mgr-card-actions">
                        <button 
                          type="button"
                          className="btn-mgr-copy-creds"
                          onClick={() => {
                            const userVal = mgr.username || mgr.name.toLowerCase().replace(/\s+/g, '');
                            const passVal = mgr.password || 'mgr@2018';
                            const text = `Convenio Mart Store Manager Login:\nUsername: ${userVal}\nPassword: ${passVal}`;
                            navigator.clipboard.writeText(text);
                            setCopiedManagerId(mgr.id);
                            setTimeout(() => setCopiedManagerId(null), 2500);
                          }}
                          title="Copy credentials to share with manager"
                        >
                          {copiedManagerId === mgr.id ? (
                            <>
                              <Check size={14} color="#10b981" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy size={14} />
                              <span>Copy Login Info</span>
                            </>
                          )}
                        </button>
                        <button 
                          type="button"
                          className="btn-mgr-delete"
                          onClick={() => handleRemoveManager(mgr.id)}
                          title="Remove manager"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Recent Staff Transfers Audit Trail */}
              <div className="transfers-audit-section">
                <div className="transfers-audit-header">
                  <div className="audit-header-left">
                    <ArrowRightLeft size={18} className="card-icon-navy" />
                    <div>
                      <h4>Inter-Branch Transfers Log</h4>
                      <p className="sub-text">History of employees moved between branches, tracking who initiated each transfer.</p>
                    </div>
                  </div>
                </div>

                {adminLogs.filter(l => l.category === 'transfer').length === 0 ? (
                  <div className="empty-sub-state">
                    <ArrowRightLeft size={32} color="#cbd5e1" />
                    <p>No employee transfers recorded yet.</p>
                    <span className="sub-helper">When managers transfer staff from the roster, real-time records with manager names will display here.</span>
                  </div>
                ) : (
                  <div className="transfers-audit-list">
                    {adminLogs.filter(l => l.category === 'transfer').slice(0, 15).map(log => (
                      <div key={log.id} className="transfer-audit-card">
                        <div className="transfer-audit-left">
                          <div className="transfer-audit-icon">
                            <ArrowRightLeft size={16} />
                          </div>
                          <div className="transfer-audit-body">
                            <div className="transfer-audit-title-line">
                              <span className="transfer-audit-title">{log.title}</span>
                            </div>
                            <div className="transfer-audit-chips">
                              {log.details?.transferredBy && (
                                <span className="chip-performer">
                                  <Users size={12} />
                                  <span>By: <strong>{log.details.transferredBy}</strong></span>
                                </span>
                              )}
                              {log.details?.fromBranch && log.details?.toBranch && (
                                <span className="chip-route">
                                  <span>{log.details.fromBranch}</span>
                                  <ArrowRightLeft size={11} />
                                  <span>{log.details.toBranch}</span>
                                </span>
                              )}
                              {log.details?.count && (
                                <span className="chip-count">
                                  {log.details.count} staff moved
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="transfer-audit-right">
                          <span className="transfer-audit-time">{formatTo12HourTime(log.timeStr)}</span>
                          <span className="transfer-audit-date">{log.dateStr}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: CIRCULARS & NOTICES (ADMIN ONLY, COMMON TO ALL) */}
          {adminTab === 'circulars' && authRole === 'admin' && (
            <div className="circulars-portal-view">
              {/* Header Card */}
              <div className="circulars-header-card">
                <div className="circ-header-info">
                  <div className="circ-header-icon-box">
                    <Megaphone size={22} />
                  </div>
                  <div>
                    <div className="circ-title-row">
                      <h3>Circulars & Announcements</h3>
                      <span className="circ-count-pill">{circulars.length} Published</span>
                    </div>
                  </div>
                </div>
              </div>

              {circularSuccessMsg && (
                <div className="circular-success-toast">
                  <CheckCircle2 size={16} />
                  <span>{circularSuccessMsg}</span>
                </div>
              )}

              {/* 2-Column Clean Layout */}
              <div className="circulars-content-layout">
                {/* Compose Form */}
                <div className="circular-compose-card">
                  <div className="compose-header">
                    <Send size={18} className="compose-icon" />
                    <h4>Send Circular to All</h4>
                  </div>
                  <form onSubmit={handleSendCircular} className="compose-form">
                    <div className="form-group-clean">
                      <label htmlFor="circ-title-input">Circular Title / Subject *</label>
                      <input
                        id="circ-title-input"
                        type="text"
                        required
                        placeholder="e.g. Festival Working Hours / Monthly Meeting Notice"
                        value={newCircularTitle}
                        onChange={(e) => setNewCircularTitle(e.target.value)}
                      />
                    </div>

                    <div className="form-group-clean">
                      <label htmlFor="circ-message-input">Circular Message *</label>
                      <textarea
                        id="circ-message-input"
                        required
                        rows={4}
                        placeholder="Write circular announcement details here..."
                        value={newCircularMessage}
                        onChange={(e) => setNewCircularMessage(e.target.value)}
                      />
                    </div>

                    <button
                      type="submit"
                      className="btn-send-circular"
                      disabled={!newCircularTitle.trim() || !newCircularMessage.trim()}
                    >
                      <Send size={15} />
                      <span>Send Circular to All</span>
                    </button>
                  </form>
                </div>

                {/* Published Circulars Feed */}
                <div className="circular-feed-card">
                  <div className="feed-header">
                    <h4>Published Circulars ({circulars.length})</h4>
                    <span className="feed-badge">Common to All</span>
                  </div>

                  {circulars.length === 0 ? (
                    <div className="circular-empty-state">
                      <Megaphone size={36} color="#cbd5e1" />
                      <p>No circulars published yet</p>
                      <span>Compose a circular on the left to send an announcement to all staff.</span>
                    </div>
                  ) : (
                    <div className="circulars-feed-list">
                      {circulars.map((circ) => (
                        <div key={circ.id} className="admin-circular-item">
                          <div className="circ-item-head">
                            <div className="circ-item-title-col">
                              <span className="circ-notice-pill">Official Circular</span>
                              <h5>{circ.title}</h5>
                            </div>
                            <div className="circ-item-actions">
                              <span className="circ-timestamp">{circ.date} • {circ.time}</span>
                              <button
                                type="button"
                                className="circ-delete-btn"
                                onClick={() => handleDeleteCircular(circ.id)}
                                title="Delete Circular"
                                aria-label="Delete Circular"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                          <p className="circ-item-body">{circ.message}</p>
                          <div className="circ-item-footer">
                            <span className="circ-sender-tag">Posted by: <strong>{circ.sender || 'Admin'}</strong></span>
                            <span className="circ-scope-tag">• Broadcasted to All Branches</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: MONTHLY TIMESHEET / ATTENDANCE GRID (HR & PAYROLL) - ADMIN ONLY */}
          {adminTab === 'timesheet' && authRole === 'admin' && (
            <div className="timesheet-portal-view">
              {/* Header Card */}
              <div className="timesheet-header-card">
                <div className="timesheet-header-left">
                  <div className="timesheet-icon-box">
                    <CalendarDays size={22} />
                  </div>
                  <div>
                    <div className="timesheet-title-row">
                      <h3>Monthly Attendance & Timesheet Grid</h3>
                      <span className="timesheet-role-pill">HR & Payroll</span>
                    </div>
                  </div>
                </div>

                <div className="timesheet-header-actions">
                  <button 
                    type="button"
                    className="btn-download-pdf"
                    onClick={handleExportTimesheetPDF}
                    title="Download Timesheet as PDF"
                  >
                    <Download size={15} />
                    <span>Download as PDF</span>
                  </button>
                </div>
              </div>

              {/* Controls Bar: Month Switcher, Branch Filter, Staff Search */}
              <div className="timesheet-controls-bar">
                <div className="timesheet-month-nav">
                  <button 
                    type="button" 
                    className="ts-nav-arrow-btn" 
                    onClick={handlePrevTimesheetMonth}
                    title="Previous Month"
                    aria-label="Previous Month"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span className="ts-current-month-label">
                    {timesheetMonthNames[timesheetMonth]} {timesheetYear}
                  </span>
                  <button 
                    type="button" 
                    className="ts-nav-arrow-btn" 
                    onClick={handleNextTimesheetMonth}
                    title="Next Month"
                    aria-label="Next Month"
                  >
                    <ChevronRight size={18} />
                  </button>
                  {(timesheetMonth !== new Date().getMonth() || timesheetYear !== new Date().getFullYear()) && (
                    <button 
                      type="button" 
                      className="ts-today-btn" 
                      onClick={handleCurrentTimesheetMonth}
                    >
                      Current Month
                    </button>
                  )}
                </div>

                <div className="timesheet-filters-group">
                  {/* Branch Filter */}
                  <div className="ts-filter-box">
                    <Building2 size={15} className="ts-filter-icon" />
                    <select
                      className="ts-filter-select"
                      value={timesheetBranchId}
                      onChange={(e) => setTimesheetBranchId(e.target.value)}
                      aria-label="Filter by Branch"
                    >
                      <option value="all">All Branches ({branches.length})</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Search Input */}
                  <div className="ts-search-box">
                    <Search size={15} className="ts-filter-icon" />
                    <input 
                      type="text"
                      className="ts-search-input"
                      placeholder="Search staff name..."
                      value={timesheetSearch}
                      onChange={(e) => setTimesheetSearch(e.target.value)}
                    />
                    {timesheetSearch && (
                      <button 
                        type="button" 
                        className="ts-search-clear" 
                        onClick={() => setTimesheetSearch('')}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Timesheet Grid Card */}
              <div className="timesheet-grid-card">
                {filteredTimesheetEmployees.length === 0 ? (
                  <div className="timesheet-empty-state">
                    <Calendar size={36} color="#cbd5e1" />
                    <p>No staff members match the selected branch or search filter.</p>
                  </div>
                ) : (
                  <>
                    {/* Desktop View: Full 31-Day Attendance Matrix */}
                    <div className="timesheet-desktop-view">
                      <div className="timesheet-table-scroll-wrapper">
                        <table className="timesheet-table">
                          <thead>
                            <tr>
                              <th className="th-sticky-emp">Staff Member</th>
                              <th className="th-summary-stat" title="Total Present Days">P</th>
                              <th className="th-summary-stat th-missed" title="Missed Checkouts">M</th>
                              {timesheetDaysArray.map(day => {
                                const isSun = isDaySunday(day);
                                const dayLetter = getDayShortName(day);
                                return (
                                  <th 
                                    key={day} 
                                    className={`th-day-col ${isSun ? 'col-sunday' : ''}`}
                                    title={`${day} ${timesheetMonthNames[timesheetMonth]} (${dayLetter})`}
                                  >
                                    <span className="th-day-num">{day}</span>
                                    <span className="th-day-sub">{dayLetter}</span>
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody>
                            {filteredTimesheetEmployees.map(emp => {
                              const totals = getEmployeeTimesheetTotals(emp.name);
                              return (
                                <tr key={emp.id} className="timesheet-emp-row">
                                  <td className="td-sticky-emp">
                                    <button
                                      type="button"
                                      className="ts-emp-clickable-btn"
                                      onClick={() => handleOpenStaffCalendar(emp)}
                                      title={`Click to view attendance calendar for ${emp.name}`}
                                    >
                                      <div className="ts-emp-info">
                                        <span className="ts-emp-name">{emp.name}</span>
                                        <span className="ts-emp-branch-tag">{emp.branchName}</span>
                                      </div>
                                    </button>
                                  </td>
                                  <td className="td-summary-stat">
                                    <span className="ts-stat-badge-p">{totals.presentCount}</span>
                                  </td>
                                  <td className="td-summary-stat">
                                    <span className={`ts-stat-badge-m ${totals.missedCount > 0 ? 'has-missed' : ''}`}>
                                      {totals.missedCount}
                                    </span>
                                  </td>
                                  {timesheetDaysArray.map(day => {
                                    const cell = getTimesheetDayStatus(emp.name, day);
                                    const isSun = isDaySunday(day);
                                    
                                    let tooltipText = `${emp.name} - ${day} ${timesheetMonthNames[timesheetMonth]}: ${cell.label}`;
                                    if (cell.punches && cell.punches.length > 0) {
                                      const punchTimes = cell.punches.map(p => `${p.type.toUpperCase()}: ${p.shortTime || p.time}`).join(' | ');
                                      tooltipText += ` (${punchTimes})`;
                                    }

                                    return (
                                      <td 
                                        key={day} 
                                        className={`td-day-cell ${isSun ? 'cell-sunday' : ''}`}
                                        title={tooltipText}
                                      >
                                        {cell.status === 'present' ? (
                                          <span className="cell-pill cell-p">P</span>
                                        ) : cell.status === 'missed' ? (
                                          <span className="cell-pill cell-m">M</span>
                                        ) : (
                                          <span className="cell-pill cell-off">-</span>
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Mobile View: Clean Staff Names Only List */}
                    <div className="timesheet-mobile-staff-view">
                      <div className="ts-mobile-list-header">
                        <span>Staff Members ({filteredTimesheetEmployees.length})</span>
                        <span className="ts-mobile-hint">Tap name to view calendar</span>
                      </div>
                      <div className="ts-mobile-staff-list">
                        {filteredTimesheetEmployees.map(emp => {
                          const totals = getEmployeeTimesheetTotals(emp.name);
                          return (
                            <button
                              key={emp.id}
                              type="button"
                              className="ts-mobile-staff-card"
                              onClick={() => handleOpenStaffCalendar(emp)}
                              title={`Tap to view calendar for ${emp.name}`}
                            >
                              <div className="ts-mobile-staff-left">
                                <div className="ts-mobile-avatar">
                                  {emp.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="ts-mobile-info">
                                  <strong className="ts-mobile-name">{emp.name}</strong>
                                  <span className="ts-mobile-branch">{emp.branchName}</span>
                                </div>
                              </div>
                              <div className="ts-mobile-staff-right">
                                <span className="ts-mobile-stat-p" title="Days Present">
                                  {totals.presentCount} P
                                </span>
                                {totals.missedCount > 0 && (
                                  <span className="ts-mobile-stat-m" title="Missed Checkouts">
                                    {totals.missedCount} M
                                  </span>
                                )}
                                <ChevronRight size={16} className="ts-mobile-chevron" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Bottom Quick Legend */}
              <div className="timesheet-legend-bar">
                <div className="legend-items-list">
                  <div className="legend-item">
                    <span className="cell-pill cell-p">P</span>
                    <span>Present</span>
                  </div>
                  <div className="legend-item">
                    <span className="cell-pill cell-m">M</span>
                    <span>Missed Checkout</span>
                  </div>
                  <div className="legend-item">
                    <span className="cell-pill cell-off">-</span>
                    <span>Absent / Off</span>
                  </div>
                </div>
                <div className="legend-meta-info">
                  <span>Showing {filteredTimesheetEmployees.length} Staff</span>
                  <span>•</span>
                  <span>{timesheetMonthNames[timesheetMonth]} {timesheetYear}</span>
                </div>
              </div>
            </div>
          )}
        </main>
        )
      )}

      {/* ================= QUICK ATTENDANCE HISTORY DRAWER ================= */}
      {showHistoryDrawer && (
        <div 
          className="history-drawer-overlay" 
          onClick={() => setShowHistoryDrawer(false)}
        >
          <div 
            className="history-drawer-panel" 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="history-drawer-header">
              <div className="history-header-title-box">
                <div className="history-header-icon-badge">
                  <History size={20} />
                </div>
                <div>
                  <h2 className="history-drawer-title">
                    {historyFilterType === 'circular' ? 'Notices & Circulars' : 'Attendance History'}
                  </h2>
                  <p className="history-drawer-subtitle">
                    {historyFilterType === 'circular'
                      ? 'Official circulars common to all staff & branches'
                      : historySelectedStaff
                        ? `Today's check-in & check-out logs for ${historySelectedStaff}`
                        : "Today's check-in and check-out activity"}
                  </p>
                </div>
              </div>

              <button 
                className="history-drawer-close-btn"
                onClick={() => setShowHistoryDrawer(false)}
                title="Close history"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Filters & Search */}
            <div className="history-drawer-controls">
              {/* Scope Switcher: Only shown if employee is actively verified on-site in kiosk */}
              {historyFilterType !== 'circular' && isEmpActivelyOnSite && (
                <div className="history-scope-switcher">
                  <button
                    type="button"
                    className={`history-scope-btn ${historySelectedStaff === activeFormEmpName ? 'active' : ''}`}
                    onClick={() => {
                      setHistorySelectedStaff(activeFormEmpName);
                      setHistoryScope('employee');
                    }}
                  >
                    <User size={13} />
                    <span>My Punches Today ({currentEmployeeTodayRecords.length})</span>
                  </button>
                  <button
                    type="button"
                    className={`history-scope-btn ${!historySelectedStaff ? 'active' : ''}`}
                    onClick={() => {
                      setHistorySelectedStaff('');
                      setHistoryScope('all');
                    }}
                  >
                    <Store size={13} />
                    <span>All Today ({todayRecords.length})</span>
                  </button>
                </div>
              )}

              {/* Staff Selector Dropdown inside Drawer */}
              {historyFilterType !== 'circular' && (
                <div className="history-staff-select-wrapper">
                  <User size={15} className="history-select-icon" />
                  <select
                    className="history-staff-select"
                    value={historySelectedStaff}
                    onChange={(e) => {
                      const val = e.target.value;
                      setHistorySelectedStaff(val);
                      setHistoryScope(val ? 'employee' : 'all');
                    }}
                    aria-label="Filter attendance by staff member"
                  >
                    <option value="">
                      All Staff Today ({todayRecords.length} {todayRecords.length === 1 ? 'punch' : 'punches'})
                    </option>
                    {todayStaffList.map(st => (
                      <option key={st.name} value={st.name}>
                        {st.name} ({st.count} {st.count === 1 ? 'punch' : 'punches'})
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={15} className="history-select-arrow" />
                </div>
              )}

              <div className="history-search-wrapper">
                <Search size={15} className="history-search-icon" />
                <input
                  type="text"
                  placeholder={historyFilterType === 'circular' ? "Search circulars..." : "Search staff name or branch..."}
                  value={historySearchTerm}
                  onChange={(e) => setHistorySearchTerm(e.target.value)}
                  className="history-search-input"
                />
                {historySearchTerm && (
                  <button 
                    className="history-search-clear" 
                    onClick={() => setHistorySearchTerm('')}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {(() => {
                const staffTarget = historySelectedStaff.trim().toLowerCase();
                const baseList = historySelectedStaff
                  ? todayRecords.filter(r => {
                      const empName = (r.employeeName || r.name || '').trim().toLowerCase();
                      return empName === staffTarget || empName.includes(staffTarget) || staffTarget.includes(empName);
                    })
                  : todayRecords;
                const inCount = baseList.filter(r => r.type === 'in').length;
                const outCount = baseList.filter(r => r.type === 'out').length;

                return (
                  <div className="history-tabs-row">
                    <button
                      className={`history-filter-chip ${historyFilterType === 'all' ? 'active' : ''}`}
                      onClick={() => setHistoryFilterType('all')}
                    >
                      All ({baseList.length})
                    </button>
                    <button
                      className={`history-filter-chip chip-in ${historyFilterType === 'in' ? 'active' : ''}`}
                      onClick={() => setHistoryFilterType('in')}
                    >
                      Check In ({inCount})
                    </button>
                    <button
                      className={`history-filter-chip chip-out ${historyFilterType === 'out' ? 'active' : ''}`}
                      onClick={() => setHistoryFilterType('out')}
                    >
                      Check Out ({outCount})
                    </button>
                    <button
                      id="tab-history-circular"
                      className={`history-filter-chip chip-circular ${historyFilterType === 'circular' ? 'active' : ''}`}
                      onClick={() => setHistoryFilterType('circular')}
                    >
                      Circular ({circulars.length})
                    </button>
                  </div>
                );
              })()}
            </div>

            {/* History List or Circulars List */}
            {historyFilterType === 'circular' ? (
              <>
                <div className="history-drawer-list">
                  {(() => {
                    const s = historySearchTerm.trim().toLowerCase();
                    const filteredCircs = circulars.filter(c => 
                      !s || 
                      (c.title && c.title.toLowerCase().includes(s)) || 
                      (c.message && c.message.toLowerCase().includes(s))
                    );

                    if (filteredCircs.length === 0) {
                      return (
                        <div className="history-empty-state">
                          <Megaphone size={36} className="history-empty-icon" />
                          <h4>No circulars found</h4>
                          <p>
                            {historySearchTerm 
                              ? 'No circulars match your search query.' 
                              : 'Official circulars published by Admin common to all staff will show up here.'}
                          </p>
                        </div>
                      );
                    }

                    return filteredCircs.map((circ) => (
                      <div key={circ.id} className="history-circular-card">
                        <div className="circ-card-top">
                          <div className="circ-badge-icon">
                            <Megaphone size={16} />
                          </div>
                          <div className="circ-card-meta">
                            <strong className="circ-card-title">{circ.title}</strong>
                            <div className="circ-card-subrow">
                              <span className="circ-admin-pill">Admin Circular</span>
                              <span className="circ-time-label">{circ.date} • {circ.time}</span>
                            </div>
                          </div>
                        </div>
                        <p className="circ-card-text">{circ.message}</p>
                        <div className="circ-card-footer">
                          <span className="circ-scope-indicator">Common to all staff & branches</span>
                        </div>
                      </div>
                    ));
                  })()}
                </div>

                <div className="history-drawer-footer">
                  <span className="history-footer-count">
                    {circulars.length} official {circulars.length === 1 ? 'circular' : 'circulars'}
                  </span>
                  <button 
                    className="history-footer-done-btn"
                    onClick={() => setShowHistoryDrawer(false)}
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              (() => {
                const staffTarget = historySelectedStaff.trim().toLowerCase();
                const baseList = historySelectedStaff
                  ? todayRecords.filter(r => {
                      const empName = (r.employeeName || r.name || '').trim().toLowerCase();
                      return empName === staffTarget || empName.includes(staffTarget) || staffTarget.includes(empName);
                    })
                  : todayRecords;

                const filteredList = baseList.filter((r) => {
                  const s = historySearchTerm.toLowerCase();
                  const matchesSearch = 
                    !s || 
                    r.employeeName.toLowerCase().includes(s) || 
                    (r.branchName && r.branchName.toLowerCase().includes(s));
                  const matchesType = historyFilterType === 'all' || r.type === historyFilterType;
                  return matchesSearch && matchesType;
                });

                return (
                  <>
                    <div className="history-drawer-list">
                      {filteredList.length === 0 ? (
                        <div className="history-empty-state">
                          <Clock size={36} className="history-empty-icon" />
                          <h4>No logs recorded today</h4>
                          <p>
                            {historySearchTerm 
                              ? 'No matching attendance records found for this search today.' 
                              : historySelectedStaff
                              ? `No attendance logs marked yet today for ${historySelectedStaff}.`
                              : "Today's check-in and check-out logs will show up here in real time."}
                          </p>
                        </div>
                      ) : (
                        filteredList.map((item) => (
                          <div 
                            key={item.id} 
                            className="history-log-card"
                            onClick={() => setSelectedRecord({ ...item, disablePhotoZoom: true })}
                            role="button"
                            tabIndex={0}
                            title="Click to view full attendance verification receipt"
                          >
                            <div className="history-log-avatar">
                              {item.photo ? (
                                <img src={item.photo} alt={item.employeeName} className="history-log-thumb" loading="lazy" decoding="async" width="38" height="38" />
                              ) : (
                                <span className="history-log-initial">
                                  {item.employeeName ? item.employeeName.charAt(0).toUpperCase() : 'U'}
                                </span>
                              )}
                            </div>

                            <div className="history-log-main">
                              {/* Row 1: Employee Name & Action Pill */}
                              <div className="history-log-header-row">
                                <strong className="history-log-name">{item.employeeName}</strong>
                                <div className={`history-action-pill ${item.type === 'in' ? 'pill-in' : isMissedCheckoutRecord(item) ? 'pill-missed' : 'pill-out'}`}>
                                  {item.type === 'in' ? <LogIn size={11} /> : <LogOut size={11} />}
                                  <span>{item.type === 'in' ? 'Check In' : isMissedCheckoutRecord(item) ? 'Check Out (Missed Checkout)' : 'Check Out'}</span>
                                </div>
                              </div>

                              {/* Row 2: Branch Name & On-Site Badge */}
                              {item.branchName && (
                                <div className="history-log-branch-row">
                                  <span className="history-log-branch-name">
                                    <MapPin size={11} />
                                    <span>{item.branchName}</span>
                                  </span>
                                  {item.geofenceVerified && (
                                    <span className="history-on-site-tag" title="Verified within 50m of branch">
                                      <ShieldCheck size={11} />
                                      <span>On-Site{item.distanceMeters != null ? ` (${item.distanceMeters}m)` : ''}</span>
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Row 3: Punch Time & Date */}
                              <div className="history-log-meta-row">
                                <span className="history-log-time-chip">
                                  <Clock size={11} />
                                  <span>{formatTo12HourTime(item.time || item.shortTime)}</span>
                                </span>
                                <span className="history-meta-bullet">•</span>
                                <span className="history-log-date-text">{item.date}</span>
                              </div>
                            </div>

                            <ChevronRight size={16} className="history-log-chevron" />
                          </div>
                        ))
                      )}
                    </div>

                    {/* Drawer Footer */}
                    <div className="history-drawer-footer">
                      <span className="history-footer-count">
                        {filteredList.length} {historySelectedStaff ? `${historySelectedStaff}'s ` : "today's "}attendance {filteredList.length === 1 ? 'log' : 'logs'}
                      </span>
                      <button 
                        className="history-footer-done-btn"
                        onClick={() => setShowHistoryDrawer(false)}
                      >
                        Close
                      </button>
                    </div>
                  </>
                );
              })()
            )}
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD BRANCH ================= */}
      {showAddBranchModal && (
        <div className="modal-overlay" onClick={() => setShowAddBranchModal(false)}>
          <div className="modal-content modal-form" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <div className="modal-title-with-icon">
                <Store size={20} className="modal-icon-brand" />
                <h3>Add New Branch</h3>
              </div>
              <button className="icon-close-btn" onClick={() => setShowAddBranchModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddBranch} className="modal-form-body">
              <div className="form-group">
                <label htmlFor="modal-branch-name">Branch Name *</label>
                <input 
                  id="modal-branch-name"
                  type="text" 
                  required 
                  placeholder="e.g. Casagrand Royale, Indiranagar"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="modal-form-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowAddBranchModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-save-primary">
                  <Plus size={16} />
                  <span>Create Branch</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT BRANCH ================= */}
      {editingBranch && (
        <div className="modal-overlay" onClick={() => setEditingBranch(null)}>
          <div className="modal-content modal-form" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <div className="modal-title-with-icon">
                <Pencil size={20} className="modal-icon-brand" />
                <h3>Edit Branch</h3>
              </div>
              <button className="icon-close-btn" onClick={() => setEditingBranch(null)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateBranch} className="modal-form-body">
              <div className="form-group">
                <label htmlFor="edit-branch-name">Branch Name *</label>
                <input 
                  id="edit-branch-name"
                  type="text" 
                  required 
                  value={editingBranch.name}
                  onChange={(e) => setEditingBranch({ ...editingBranch, name: e.target.value })}
                  autoFocus
                />
              </div>

              <div className="modal-form-actions">
                <button type="button" className="btn-cancel" onClick={() => setEditingBranch(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-save-primary">
                  <Check size={16} />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT EMPLOYEE ================= */}
      {editingEmp && (
        <div className="modal-overlay" onClick={() => setEditingEmp(null)}>
          <div className="modal-content modal-form" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <div className="modal-title-with-icon">
                <Pencil size={20} className="modal-icon-brand" />
                <h3>Edit Employee Details</h3>
              </div>
              <button className="icon-close-btn" onClick={() => setEditingEmp(null)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateEmployee} className="modal-form-body">
              <div className="form-group">
                <label htmlFor="edit-emp-name">Employee Full Name *</label>
                <input 
                  id="edit-emp-name"
                  type="text" 
                  required 
                  value={editingEmp.name}
                  onChange={(e) => setEditingEmp({ ...editingEmp, name: e.target.value })}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-emp-branch">Assigned Branch Location *</label>
                <select
                  id="edit-emp-branch"
                  className="modal-select-input"
                  value={editingEmp.targetBranchId || editingEmp.branchId}
                  onChange={(e) => setEditingEmp({ ...editingEmp, targetBranchId: e.target.value })}
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.id === editingEmp.branchId ? '(Current Branch)' : ''}
                    </option>
                  ))}
                </select>
                {editingEmp.targetBranchId && editingEmp.targetBranchId !== editingEmp.branchId && (
                  <span className="transfer-hint-badge">
                    <ArrowRightLeft size={13} />
                    <span>Employee will be transferred to <strong>{branches.find(b => b.id === editingEmp.targetBranchId)?.name}</strong></span>
                  </span>
                )}
              </div>

              <div className="modal-form-actions">
                <button type="button" className="btn-cancel" onClick={() => setEditingEmp(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-save-primary">
                  <Check size={16} />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: QUICK TRANSFER STAFF ================= */}
      {transferModalStaff && (
        <div className="modal-overlay" onClick={() => setTransferModalStaff(null)}>
          <div className="modal-content modal-form transfer-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <div className="modal-title-with-icon">
                <ArrowRightLeft size={20} className="modal-icon-brand brand-blue-icon" />
                <h3>Transfer Staff Member</h3>
              </div>
              <button className="icon-close-btn" onClick={() => setTransferModalStaff(null)}>
                <X size={20} />
              </button>
            </div>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleTransferEmployees(
                  [transferModalStaff.emp.id], 
                  transferModalStaff.fromBranchId, 
                  transferModalStaff.toBranchId
                );
              }} 
              className="modal-form-body"
            >
              {/* Employee Summary Card */}
              <div className="transfer-staff-summary">
                <div className="emp-avatar-bubble avatar-large">
                  {transferModalStaff.emp.name.charAt(0).toUpperCase()}
                </div>
                <div className="transfer-staff-meta">
                  <h4 className="transfer-staff-name">{transferModalStaff.emp.name}</h4>
                  <span className="transfer-staff-role">{transferModalStaff.emp.role || 'Staff Member'}</span>
                </div>
              </div>

              {/* Visual Branch Movement Diagram */}
              <div className="transfer-route-box">
                <div className="route-node">
                  <span className="route-pill-label">CURRENT BRANCH</span>
                  <div className="route-branch-name">
                    <Store size={14} />
                    <span>{branches.find(b => b.id === transferModalStaff.fromBranchId)?.name || 'Current Branch'}</span>
                  </div>
                </div>

                <div className="route-flow-arrow">
                  <ArrowRight size={20} />
                </div>

                <div className="route-node destination">
                  <span className="route-pill-label dest-label">NEW DESTINATION</span>
                  <div className="route-branch-name dest-name">
                    <Store size={14} />
                    <span>{branches.find(b => b.id === transferModalStaff.toBranchId)?.name || 'Select Branch'}</span>
                  </div>
                </div>
              </div>

              {/* Destination Branch Picker */}
              <div className="form-group">
                <label htmlFor="transfer-select-target">Transfer To Which Branch? *</label>
                <select
                  id="transfer-select-target"
                  className="modal-select-input"
                  required
                  value={transferModalStaff.toBranchId}
                  onChange={(e) => setTransferModalStaff({ ...transferModalStaff, toBranchId: e.target.value })}
                >
                  <option value="" disabled>-- Select destination branch --</option>
                  {branches
                    .filter(b => b.id !== transferModalStaff.fromBranchId)
                    .map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.employees?.length || 0} staff)
                      </option>
                    ))}
                </select>
                <p className="transfer-explanation-note">
                  Once transferred, this employee belongs to the new branch and will immediately appear in that branch's daily check-in roster.
                </p>
              </div>

              <div className="modal-form-actions">
                <button 
                  type="button" 
                  className="btn-cancel" 
                  onClick={() => setTransferModalStaff(null)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-save-primary btn-confirm-transfer"
                  disabled={!transferModalStaff.toBranchId || transferModalStaff.toBranchId === transferModalStaff.fromBranchId}
                >
                  <ArrowRightLeft size={16} />
                  <span>Transfer Employee</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: SECURE DELETE CONFIRMATION (ADMIN PASSWORD) ================= */}
      {deleteModal && (
        <div className="modal-overlay" onClick={() => setDeleteModal(null)}>
          <div className="modal-content modal-form secure-delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row delete-header-row">
              <div className="modal-title-with-icon">
                <div className="delete-shield-icon-box">
                  <ShieldAlert size={20} className="modal-icon-danger" />
                </div>
                <div>
                  <h3 className="delete-modal-title">Security Authorization</h3>
                  <span className="delete-modal-subtitle">Admin Password Required</span>
                </div>
              </div>
              <button 
                type="button" 
                className="icon-close-btn" 
                onClick={() => setDeleteModal(null)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleConfirmDelete} className="modal-form-body delete-modal-body">
              {/* Target Warning Card */}
              <div className="delete-target-card">
                <div className="delete-target-badge">
                  <Trash2 size={13} />
                  <span>ACTION: PERMANENT DELETE</span>
                </div>
                <div className="delete-target-detail">
                  {deleteModal.type === 'employee' && (
                    <>
                      <strong className="delete-target-title">{deleteModal.targetName}</strong>
                      <span className="sub-target-info">from {deleteModal.branchName}</span>
                    </>
                  )}
                  {deleteModal.type === 'branch' && (
                    <>
                      <strong className="delete-target-title">{deleteModal.targetName}</strong>
                      <span className="sub-target-info">Includes {deleteModal.empCount} registered staff members</span>
                    </>
                  )}
                  {deleteModal.type === 'logs' && (
                    <>
                      <strong className="delete-target-title">All Attendance Logs</strong>
                      <span className="sub-target-info">{deleteModal.count} attendance logs will be cleared</span>
                    </>
                  )}
                </div>
              </div>

              {/* Password Input Group */}
              <div className="form-group delete-password-group">
                <label htmlFor="delete-admin-password-input">
                  Enter Admin Password to Authorize *
                </label>
                <div className="delete-password-input-wrapper">
                  <Lock size={16} className="delete-lock-icon" />
                  <input
                    id="delete-admin-password-input"
                    type={showDeletePassword ? 'text' : 'password'}
                    required
                    placeholder="Enter admin password..."
                    value={deletePasswordInput}
                    onChange={(e) => {
                      setDeletePasswordInput(e.target.value);
                      if (deletePasswordError) setDeletePasswordError('');
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="btn-toggle-delete-eye"
                    onClick={() => setShowDeletePassword(!showDeletePassword)}
                    tabIndex="-1"
                  >
                    {showDeletePassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                
                {deletePasswordError && (
                  <div className="delete-error-pill">
                    <AlertCircle size={13} />
                    <span>{deletePasswordError}</span>
                  </div>
                )}
              </div>

              <div className="modal-form-actions delete-modal-actions">
                <button 
                  type="button" 
                  className="btn-cancel" 
                  onClick={() => setDeleteModal(null)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-danger-confirm-delete"
                  disabled={!deletePasswordInput.trim()}
                >
                  <Trash2 size={15} />
                  <span>Confirm Delete</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADMIN SETTINGS & ACTION HISTORY AUDIT TRAIL ================= */}
      {showSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="modal-content modal-form settings-history-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row settings-header-row">
              <div className="modal-title-with-icon">
                <div className="settings-header-icon-box">
                  <Settings size={18} className="modal-icon-settings" />
                </div>
                <h3 className="settings-modal-title">Admin Action History</h3>
              </div>
              <button 
                type="button" 
                className="icon-close-btn" 
                onClick={() => setShowSettingsModal(false)}
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Compact Search & Filter Bar */}
            <div className="settings-toolbar-compact">
              <div className="settings-search-wrapper">
                <Search size={15} color="#94a3b8" />
                <input 
                  type="text" 
                  placeholder="Search logs..."
                  value={adminLogSearch}
                  onChange={(e) => setAdminLogSearch(e.target.value)}
                  className="settings-search-input"
                />
                {adminLogSearch && (
                  <button className="clear-search-btn" onClick={() => setAdminLogSearch('')}>
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Single Filter Button containing all options */}
              <div className={`settings-filter-dropdown-btn ${adminLogCategoryFilter !== 'all' ? 'has-active-filter' : ''}`} title="Filter by category">
                <Filter size={14} className="filter-dropdown-icon" />
                <span className="filter-dropdown-text">
                  {adminLogCategoryFilter === 'all' ? 'All' :
                   adminLogCategoryFilter === 'transfer' ? 'Transfers' :
                   adminLogCategoryFilter === 'staff' ? 'Staff' :
                   adminLogCategoryFilter === 'deletions' ? 'Deletions' :
                   adminLogCategoryFilter === 'branches' ? 'Branches' : 'Filter'}
                </span>
                <span className="filter-dropdown-badge">
                  {adminLogCategoryFilter === 'all'
                    ? adminLogs.length
                    : adminLogCategoryFilter === 'transfer'
                    ? adminLogs.filter(l => l.category === 'transfer').length
                    : adminLogCategoryFilter === 'staff'
                    ? adminLogs.filter(l => l.category === 'add_staff' || l.category === 'edit_staff').length
                    : adminLogCategoryFilter === 'deletions'
                    ? adminLogs.filter(l => l.category?.includes('delete')).length
                    : adminLogs.filter(l => l.category?.includes('branch')).length
                  }
                </span>
                <ChevronDown size={14} className="filter-dropdown-chevron" />
                <select 
                  value={adminLogCategoryFilter} 
                  onChange={(e) => setAdminLogCategoryFilter(e.target.value)}
                  className="settings-filter-select-overlay"
                  aria-label="Filter logs by category"
                >
                  <option value="all">All Logs ({adminLogs.length})</option>
                  <option value="transfer">Transfers ({adminLogs.filter(l => l.category === 'transfer').length})</option>
                  <option value="staff">Staff ({adminLogs.filter(l => l.category === 'add_staff' || l.category === 'edit_staff').length})</option>
                  <option value="deletions">Deletions ({adminLogs.filter(l => l.category?.includes('delete')).length})</option>
                  <option value="branches">Branches ({adminLogs.filter(l => l.category?.includes('branch')).length})</option>
                </select>
              </div>
            </div>

            {/* Action History Feed */}
            <div className="settings-history-feed">
              {(() => {
                const filtered = adminLogs.filter(log => {
                  if (adminLogCategoryFilter === 'transfer' && log.category !== 'transfer') return false;
                  if (adminLogCategoryFilter === 'staff' && log.category !== 'add_staff' && log.category !== 'edit_staff') return false;
                  if (adminLogCategoryFilter === 'deletions' && !log.category?.includes('delete')) return false;
                  if (adminLogCategoryFilter === 'branches' && !log.category?.includes('branch')) return false;

                  if (adminLogSearch) {
                    const q = adminLogSearch.toLowerCase();
                    const titleMatch = log.title.toLowerCase().includes(q);
                    const catMatch = log.category.toLowerCase().includes(q);
                    const detailMatch = JSON.stringify(log.details || {}).toLowerCase().includes(q);
                    return titleMatch || catMatch || detailMatch;
                  }
                  return true;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="empty-sub-state settings-empty">
                      <History size={32} color="#cbd5e1" />
                      <p>No action history yet</p>
                      <span className="sub-helper">
                        {adminLogSearch ? 'No logs match your search query' : 'Real actions like transferring, adding, editing, or deleting employees will automatically be recorded here.'}
                      </span>
                    </div>
                  );
                }

                return filtered.map((item) => {
                  let badgeClass = 'badge-system';
                  let badgeText = 'System';
                  let icon = <Clock size={12} />;

                  if (item.category === 'transfer') {
                    badgeClass = 'badge-transfer';
                    badgeText = 'Branch Transfer';
                    icon = <ArrowRightLeft size={12} />;
                  } else if (item.category === 'add_staff') {
                    badgeClass = 'badge-add-staff';
                    badgeText = 'Staff Added';
                    icon = <Plus size={12} />;
                  } else if (item.category === 'edit_staff') {
                    badgeClass = 'badge-edit-staff';
                    badgeText = 'Staff Updated';
                    icon = <Pencil size={12} />;
                  } else if (item.category?.includes('delete')) {
                    badgeClass = 'badge-delete';
                    badgeText = 'Deleted';
                    icon = <Trash2 size={12} />;
                  } else if (item.category?.includes('branch')) {
                    badgeClass = 'badge-branch';
                    badgeText = 'Branch';
                    icon = <Store size={12} />;
                  } else if (item.category === 'clear_logs') {
                    badgeClass = 'badge-delete';
                    badgeText = 'Logs Cleared';
                    icon = <Trash2 size={12} />;
                  }

                  return (
                    <div key={item.id} className="history-feed-card">
                      <div className="feed-card-header">
                        <span className={`feed-badge ${badgeClass}`}>
                          {icon}
                          <span>{badgeText}</span>
                        </span>
                        <div className="feed-timestamp">
                          <Clock size={11} />
                          <span>{item.dateStr} at {formatTo12HourTime(item.timeStr)}</span>
                        </div>
                      </div>

                      <div className="feed-body">
                        <h4 className="feed-title">{item.title}</h4>
                        {item.details && Object.keys(item.details).length > 0 && (
                          <div className="feed-details-row">
                            {item.details.fromBranch && item.details.toBranch && (
                              <div className="feed-route-pill">
                                <span>{item.details.fromBranch}</span>
                                <ArrowRight size={11} className="route-arrow-inline" />
                                <strong className="text-blue">{item.details.toBranch}</strong>
                              </div>
                            )}
                            {item.details.staffName && !item.details.fromBranch && (
                              <span className="feed-sub-chip">Staff: {item.details.staffName}</span>
                            )}
                            {item.details.branchName && !item.details.fromBranch && (
                              <span className="feed-sub-chip">Branch: {item.details.branchName}</span>
                            )}
                            {item.details.role && (
                              <span className="feed-sub-chip">Role: {item.details.role}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Clean Modal Footer */}
            <div className="settings-modal-actions-simple">
              <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
                <button 
                  type="button" 
                  className="btn-export-simple"
                  onClick={exportAdminLogsToCSV}
                  disabled={adminLogs.length === 0}
                  title="Download CSV of action logs"
                >
                  <FileSpreadsheet size={15} />
                  <span>Export CSV</span>
                </button>
                {adminLogs.length > 0 && (
                  <button 
                    type="button" 
                    className="btn-clear-logs-simple"
                    onClick={handleClearAdminLogs}
                    title="Clear history"
                  >
                    <Trash2 size={13} />
                    <span>Clear</span>
                  </button>
                )}
              </div>
              <button 
                type="button" 
                className="btn-settings-close-simple" 
                onClick={() => setShowSettingsModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: LIVE CAMERA & PHOTO CAPTURE ================= */}
      {cameraActive && (
        <div className="modal-overlay">
          <div className="camera-modal-content">
            <div className="camera-modal-header">
              <div className="camera-title-badge">
                <span className={`badge ${currentActionType === 'in' ? 'badge-in' : 'badge-out'}`}>
                  {currentActionType === 'in' ? 'Check In' : 'Check Out'} Selfie
                </span>
                <span className="camera-front-tag">
                  Live Front Camera
                </span>
              </div>
              
              <div className="camera-header-right">
                <button className="icon-close-btn" onClick={stopCamera}>
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="camera-viewport-container">
              {cameraError ? (
                <div className="permission-prompt-card">
                  <div className="permission-icon-badge">
                    <Camera size={28} />
                  </div>
                  <h3 className="permission-heading">Enable Front Camera</h3>
                  <p className="permission-subtext">
                    Convenio Mart needs your front camera to take a live selfie for attendance verification.
                  </p>

                  <div className="permission-guide-list">
                    <div className="permission-guide-row">
                      <span className="step-circle">1</span>
                      <span>Tap <strong>Allow</strong> when your browser asks for camera access</span>
                    </div>
                    <div className="permission-guide-row">
                      <span className="step-circle">2</span>
                      <span>If blocked, tap the <strong>lock 🔒</strong> icon in your address bar and switch Camera to <strong>Allow</strong></span>
                    </div>
                  </div>

                  <button 
                    id="btn-allow-camera"
                    className="btn-enable-camera" 
                    onClick={() => startCamera(currentActionType)}
                  >
                    <Camera size={17} />
                    <span>Allow & Open Camera</span>
                  </button>
                </div>
              ) : (
                <>
                  {/* Keep video element permanently in DOM so videoRef is always attached */}
                  {!capturedPhoto && (
                    <div className="video-stream-box">
                      <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        muted 
                        className="live-video mirror-video"
                        onLoadedMetadata={(e) => {
                          e.target.play().catch(console.warn);
                        }}
                      />
                      <div className="face-guide-overlay">
                        <div className="face-oval-guide"></div>
                        <span className="face-guide-text">Position face inside guide</span>
                      </div>
                    </div>
                  )}

                  {/* Loading spinner rendered as overlay without destroying the video element */}
                  {isCameraLoading && (
                    <div className="camera-loading-container">
                      <Loader2 className="spinner" size={32} color="#ffffff" />
                      <p>Opening front camera...</p>
                    </div>
                  )}

                  {capturedPhoto && (
                    <div className="captured-preview-box">
                      <img src={capturedPhoto} alt="Captured Photo" className="preview-img" decoding="async" />
                      <div className="preview-stamp">
                        <CheckCircle2 size={16} /> Photo Captured
                      </div>
                    </div>
                  )}
                </>
              )}

              <canvas ref={canvasRef} style={{ display: 'none' }} />
            </div>

            <div className="camera-modal-footer">
              {!cameraError && (
                <>
                  {!capturedPhoto ? (
                    <button className="btn-take-selfie" onClick={capturePhoto}>
                      <Camera size={22} />
                      <span>Take Photo</span>
                    </button>
                  ) : (
                    <div className="camera-confirm-buttons">
                      <button className="btn-retake" onClick={retakePhoto} disabled={isProcessing}>
                        <RefreshCw size={16} />
                        <span>Retake</span>
                      </button>
                      <button className="btn-confirm-submit" onClick={submitAttendance} disabled={isProcessing}>
                        {isProcessing ? (
                          <>
                            <Loader2 className="spinner" size={18} />
                            <span>Pushing with GPS Location...</span>
                          </>
                        ) : (
                          <>
                            <Navigation size={18} />
                            <span>Push with Map Location</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: SUCCESS CONFIRMATION ================= */}
      {successData && (
        <div className="modal-overlay" onClick={() => setSuccessData(null)}>
          <div className="modal-content success-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className={`modal-icon ${successData.type}`}>
              <CheckCircle2 size={36} />
            </div>
            <h2 className="modal-title">
              {successData.type === 'in' ? 'Check In Recorded!' : 'Check Out Recorded!'}
            </h2>
            <p className="modal-text">
              Recorded at <strong>{formatTo12HourTime(successData.shortTime)}</strong> on {successData.formattedDate}
            </p>

            <div className="success-emp-card">
              <img src={successData.photo} alt="Verified Selfie" className="success-selfie-img" decoding="async" width="56" height="56" />
              <div className="success-emp-info">
                <strong>{successData.name}</strong>
                <span className="emp-role-pill">{successData.role}</span>
                <span className="success-branch-tag">
                  <Building2 size={12} /> {successData.branch}
                </span>
                {successData.geofenceVerified && (
                  <span className="receipt-geofence-tag">
                    <ShieldCheck size={13} color="#16a34a" />
                    <span>Verified On-Site{successData.distanceMeters != null ? ` • ${successData.distanceMeters}m from store` : ''}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Coordinates & Map Card */}
            <div className="modal-location-card">
              <Navigation size={18} className="loc-icon" />
              <div className="loc-text">
                <span className="loc-label">Captured Map Coordinates:</span>
                <span className="loc-val">
                  {successData.lat ? `${successData.lat}, ${successData.lng}` : 'GPS Unavailable'}
                </span>
                {successData.placeName && (
                  <span className="loc-place-sub">{successData.placeName}</span>
                )}
              </div>
            </div>

            {successData.mapUrl && (
              <a 
                href={successData.mapUrl} 
                target="_blank" 
                rel="noreferrer" 
                className="view-map-link"
              >
                <MapPin size={15} />
                <span>Open Exact Pin on Google Maps</span>
                <ExternalLink size={14} />
              </a>
            )}

            <button className="modal-close-btn" onClick={() => setSuccessData(null)}>
              Done
            </button>
          </div>
        </div>
      )}

      {/* ================= MODAL: DETAILED RECORD VIEW ================= */}
      {selectedRecord && (
        <div className="modal-overlay" onClick={() => setSelectedRecord(null)}>
          <div className="modal-content clean-receipt-modal" onClick={(e) => e.stopPropagation()}>
            {/* Modal Top Bar */}
            <div className="receipt-header">
              <div className="receipt-header-left">
                <span className={`receipt-type-pill ${selectedRecord.type === 'in' ? 'pill-checkin' : isMissedCheckoutRecord(selectedRecord) ? 'pill-missed' : 'pill-checkout'}`}>
                  {selectedRecord.type === 'in' ? <LogIn size={13} /> : <LogOut size={13} />}
                  <span>{selectedRecord.type === 'in' ? 'Check In' : isMissedCheckoutRecord(selectedRecord) ? 'Check Out (Missed Checkout)' : 'Check Out'}</span>
                </span>
                <span className="receipt-date-text">{selectedRecord.date}</span>
              </div>
              <button 
                className="icon-close-btn" 
                onClick={() => setSelectedRecord(null)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="receipt-body">
              {/* Employee Identity Hero */}
              <div className="receipt-person-row">
                <div 
                  className={`receipt-avatar-wrapper ${selectedRecord.disablePhotoZoom ? 'no-zoom' : ''}`}
                  onClick={() => {
                    if (!selectedRecord.disablePhotoZoom && selectedRecord.photo) {
                      setViewingPhoto(selectedRecord);
                    }
                  }}
                  title={selectedRecord.disablePhotoZoom ? selectedRecord.employeeName : "Click to view full photo"}
                >
                  {selectedRecord.photo ? (
                    <img src={selectedRecord.photo} alt={selectedRecord.employeeName} className="receipt-avatar-img" decoding="async" width="60" height="60" />
                  ) : (
                    <div className="receipt-avatar-initial" style={{ width: 60, height: 60, borderRadius: 12, background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.4rem' }}>
                      {selectedRecord.employeeName ? selectedRecord.employeeName.charAt(0).toUpperCase() : 'U'}
                    </div>
                  )}
                  {!selectedRecord.disablePhotoZoom && selectedRecord.photo && (
                    <div className="receipt-zoom-hint">
                      <Eye size={16} />
                    </div>
                  )}
                </div>
                <div className="receipt-person-details">
                  <h3 className="receipt-person-name">{selectedRecord.employeeName}</h3>
                  <div className="receipt-person-meta">
                    <span className="receipt-role-badge">{selectedRecord.employeeRole || 'Staff'}</span>
                    <span className="receipt-bullet">•</span>
                    <span className="receipt-branch-name">
                      <Store size={13} /> {selectedRecord.branchName || 'Convenio Mart'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Clean Summary Table */}
              <div className="receipt-spec-list">
                {/* Time Row */}
                <div className="receipt-spec-item">
                  <div className="receipt-spec-label">
                    <Clock size={15} />
                    <span>Punch Time</span>
                  </div>
                  <div className="receipt-spec-value">
                    <strong className="receipt-time-strong">{formatTo12HourTime(selectedRecord.time || selectedRecord.shortTime)}</strong>
                  </div>
                </div>

                {/* Geofence Status Row */}
                <div className="receipt-spec-item">
                  <div className="receipt-spec-label">
                    <ShieldCheck size={15} />
                    <span>Geofence Status</span>
                  </div>
                  <div className="receipt-spec-value">
                    {selectedRecord.geofenceVerified ? (
                      <span className="receipt-verified-badge">
                        <CheckCircle2 size={13} color="#16a34a" />
                        <span>Verified On-Site{selectedRecord.distanceMeters != null ? ` (${selectedRecord.distanceMeters}m from store)` : ' (<50m)'}</span>
                      </span>
                    ) : (
                      <span className="receipt-unverified-badge">
                        <span>Standard Attendance</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Location Row */}
                <div className="receipt-spec-item receipt-location-item">
                  <div className="receipt-spec-label">
                    <MapPin size={15} />
                    <span>Captured Location</span>
                  </div>
                  <div className="receipt-spec-value receipt-location-value">
                    <span className="receipt-place-title">
                      {selectedRecord.location?.placeName || 'Store Location Captured'}
                    </span>
                    {selectedRecord.location?.lat && (
                      <span className="receipt-gps-sub">
                        GPS: {selectedRecord.location.lat}, {selectedRecord.location.lng}
                      </span>
                    )}
                    {selectedRecord.location?.lat && (
                      <a 
                        href={`https://www.google.com/maps?q=${selectedRecord.location.lat},${selectedRecord.location.lng}`}
                        target="_blank" 
                        rel="noreferrer" 
                        className="receipt-map-link"
                      >
                        <ExternalLink size={12} />
                        <span>View on Google Maps</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="receipt-footer">
              <span className="receipt-id-micro">{selectedRecord.id}</span>
              <div className="receipt-footer-buttons">
                <button 
                  className="btn-receipt-copy"
                  onClick={() => copyRecordDetails(selectedRecord)}
                >
                  {copiedRecordId === selectedRecord.id ? (
                    <>
                      <Check size={14} color="#10b981" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copy</span>
                    </>
                  )}
                </button>
                <button className="btn-receipt-close" onClick={() => setSelectedRecord(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: ENLARGED PHOTO ================= */}
      {viewingPhoto && (
        <div className="modal-overlay" onClick={() => setViewingPhoto(null)}>
          <div className="photo-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="photo-modal-header">
              <div>
                <h3>{viewingPhoto.employeeName}</h3>
                <span className="photo-date-subtitle">
                  {viewingPhoto.branchName ? `${viewingPhoto.branchName} • ` : ''}
                  {viewingPhoto.type === 'in' ? 'Check In' : 'Check Out'} at {formatTo12HourTime(viewingPhoto.time || viewingPhoto.shortTime)}, {viewingPhoto.date}
                </span>
              </div>
              <button className="icon-close-btn" onClick={() => setViewingPhoto(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="photo-full-body">
              <img src={viewingPhoto.photo} alt="Photo Full" className="full-size-selfie" decoding="async" />
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: SUPABASE SQL SETUP ================= */}
      {showSqlModal && (
        <div className="modal-overlay" onClick={() => setShowSqlModal(false)}>
          <div className="modal-content sql-setup-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <div className="modal-title-with-icon">
                <Database size={20} className="modal-icon-brand" />
                <h3>Supabase SQL Database Setup</h3>
              </div>
              <button className="icon-close-btn" onClick={() => setShowSqlModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="sql-modal-body">
              <p className="sql-modal-desc">
                Execute this SQL script in your Supabase SQL Editor to initialize the <code>branches</code>, <code>employees</code>, and <code>attendance_records</code> tables with public read/write permissions.
              </p>

              <div className="sql-code-container">
                <pre className="sql-pre"><code>{SUPABASE_SCHEMA_SQL}</code></pre>
              </div>

              <div className="sql-modal-actions">
                <a 
                  href="https://supabase.com/dashboard/project/ykdhjkzrprafzivvguhh/sql/new" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="btn-open-sql-editor"
                >
                  <ExternalLink size={15} />
                  <span>Open Supabase SQL Editor</span>
                </a>

                <button className="btn-copy-sql" onClick={copySqlToClipboard}>
                  {copiedSql ? (
                    <>
                      <Check size={16} color="#10b981" />
                      <span>Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={16} />
                      <span>Copy SQL Script</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: DATE FILTER (SPECIFIC DATE & RANGE) ================= */}
      {showDateFilterModal && (
        <div className="modal-overlay" onClick={() => setShowDateFilterModal(false)}>
          <div className="modal-content date-filter-modal" onClick={(e) => e.stopPropagation()}>
            <div className="date-filter-modal-header">
              <div className="date-filter-modal-title">
                <div className="icon-calendar-badge">
                  <Calendar size={18} />
                </div>
                <div>
                  <h3>Filter Logs by Date</h3>
                  <p>Choose a single date or custom range to filter attendance records</p>
                </div>
              </div>
              <button 
                className="icon-close-btn" 
                onClick={() => setShowDateFilterModal(false)}
                aria-label="Close date filter modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="date-filter-modal-body">
              {/* Filter Mode Selector */}
              <div className="date-mode-toggle-group">
                <button
                  type="button"
                  className={`date-mode-toggle-btn ${tempFilterMode === 'single' ? 'active' : ''}`}
                  onClick={() => setTempFilterMode('single')}
                >
                  <Calendar size={15} />
                  <span>Specific Date</span>
                </button>
                <button
                  type="button"
                  className={`date-mode-toggle-btn ${tempFilterMode === 'range' ? 'active' : ''}`}
                  onClick={() => setTempFilterMode('range')}
                >
                  <CalendarDays size={15} />
                  <span>Date Range</span>
                </button>
              </div>

              {/* Mode 1: Specific Date */}
              {tempFilterMode === 'single' && (
                <div className="date-filter-section">
                  <label className="date-input-label">Quick Selection</label>
                  <div className="quick-date-pills">
                    <button
                      type="button"
                      className={`quick-date-pill ${tempSingleDate === toYMD(new Date()) ? 'active' : ''}`}
                      onClick={() => setTempSingleDate(toYMD(new Date()))}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      className={`quick-date-pill ${tempSingleDate === getYesterdayYMD() ? 'active' : ''}`}
                      onClick={() => setTempSingleDate(getYesterdayYMD())}
                    >
                      Yesterday
                    </button>
                  </div>

                  <div className="date-input-group">
                    <label htmlFor="input-single-date" className="date-input-label">Select Date:</label>
                    <input
                      id="input-single-date"
                      type="date"
                      value={tempSingleDate}
                      onChange={(e) => setTempSingleDate(e.target.value)}
                      className="date-picker-input"
                    />
                  </div>
                </div>
              )}

              {/* Mode 2: Date Range */}
              {tempFilterMode === 'range' && (
                <div className="date-filter-section">
                  <label className="date-input-label">Quick Presets</label>
                  <div className="quick-date-pills">
                    <button
                      type="button"
                      className="quick-date-pill"
                      onClick={() => {
                        const today = toYMD(new Date());
                        setTempStartDate(today);
                        setTempEndDate(today);
                      }}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      className="quick-date-pill"
                      onClick={() => {
                        const yest = getYesterdayYMD();
                        setTempStartDate(yest);
                        setTempEndDate(yest);
                      }}
                    >
                      Yesterday
                    </button>
                    <button
                      type="button"
                      className="quick-date-pill"
                      onClick={() => {
                        const today = toYMD(new Date());
                        const past7 = new Date();
                        past7.setDate(past7.getDate() - 6);
                        setTempStartDate(toYMD(past7));
                        setTempEndDate(today);
                      }}
                    >
                      Last 7 Days
                    </button>
                    <button
                      type="button"
                      className="quick-date-pill"
                      onClick={() => {
                        const today = toYMD(new Date());
                        const past30 = new Date();
                        past30.setDate(past30.getDate() - 29);
                        setTempStartDate(toYMD(past30));
                        setTempEndDate(today);
                      }}
                    >
                      Last 30 Days
                    </button>
                    <button
                      type="button"
                      className="quick-date-pill"
                      onClick={() => {
                        const now = new Date();
                        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                        setTempStartDate(toYMD(firstDay));
                        setTempEndDate(toYMD(now));
                      }}
                    >
                      This Month
                    </button>
                  </div>

                  <div className="date-range-inputs-grid">
                    <div className="date-input-group">
                      <label htmlFor="input-start-date" className="date-input-label">From Date (Start):</label>
                      <input
                        id="input-start-date"
                        type="date"
                        value={tempStartDate}
                        onChange={(e) => setTempStartDate(e.target.value)}
                        className="date-picker-input"
                      />
                    </div>
                    <div className="date-input-group">
                      <label htmlFor="input-end-date" className="date-input-label">To Date (End):</label>
                      <input
                        id="input-end-date"
                        type="date"
                        value={tempEndDate}
                        onChange={(e) => setTempEndDate(e.target.value)}
                        className="date-picker-input"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="date-filter-modal-footer">
              <button
                type="button"
                className="btn-date-reset"
                onClick={() => {
                  handleClearDateFilter();
                  setShowDateFilterModal(false);
                }}
              >
                Clear / All Dates
              </button>
              <div className="date-modal-footer-right">
                <button
                  type="button"
                  className="btn-date-cancel"
                  onClick={() => setShowDateFilterModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-date-apply"
                  onClick={handleApplyDateFilter}
                >
                  Apply Filter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD STORE MANAGER ================= */}
      {showAddManagerModal && (
        <div className="modal-overlay" onClick={() => setShowAddManagerModal(false)}>
          <div className="modal-content add-manager-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <div className="modal-title-with-icon">
                <Users size={20} className="modal-icon-brand" />
                <h3>Add Store Manager</h3>
              </div>
              <button className="icon-close-btn" onClick={() => setShowAddManagerModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddManager} className="add-manager-form">
              <div className="form-group-clean">
                <label htmlFor="new-mgr-name">Manager Full Name *</label>
                <input
                  id="new-mgr-name"
                  type="text"
                  required
                  placeholder="e.g. Karthik Raja"
                  value={newManagerName}
                  onChange={(e) => {
                    const name = e.target.value;
                    setNewManagerName(name);
                    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                    if (!newManagerUsername || newManagerUsername === slug.slice(0, -1)) {
                      setNewManagerUsername(slug);
                    }
                    if (!newManagerPassword || newManagerPassword.startsWith('mgr@')) {
                      setNewManagerPassword(slug ? `mgr@${slug}` : '');
                    }
                  }}
                  autoFocus
                />
              </div>

              <div className="form-group-clean">
                <label htmlFor="new-mgr-role">Role / Area Scope *</label>
                <input
                  id="new-mgr-role"
                  type="text"
                  required
                  placeholder="e.g. Store Manager - OMR Cluster"
                  value={newManagerRole}
                  onChange={(e) => setNewManagerRole(e.target.value)}
                />
              </div>

              <div className="form-row-two-col">
                <div className="form-group-clean">
                  <label htmlFor="new-mgr-username">Login Username *</label>
                  <input
                    id="new-mgr-username"
                    type="text"
                    required
                    placeholder="e.g. karthik"
                    value={newManagerUsername}
                    onChange={(e) => setNewManagerUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                  />
                </div>

                <div className="form-group-clean">
                  <label htmlFor="new-mgr-password">Login Password *</label>
                  <input
                    id="new-mgr-password"
                    type="text"
                    required
                    placeholder="e.g. mgr@karthik"
                    value={newManagerPassword}
                    onChange={(e) => setNewManagerPassword(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-actions-clean">
                <button 
                  type="button" 
                  className="btn-cancel-clean" 
                  onClick={() => setShowAddManagerModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  id="btn-add-mgr-submit"
                  className="btn-submit-clean"
                >
                  <Plus size={16} />
                  <span>Add Manager</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: INDIVIDUAL ATTENDANCE CALENDAR ================= */}
      {calendarStaff && (
        <div className="cal-modal-overlay" onClick={handleCloseStaffCalendar}>
          <div className="cal-modal-card" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="cal-modal-header">
              <div className="cal-title-box">
                <span className="cal-icon-emoji" role="img" aria-label="Calendar">🗓️</span>
                <div>
                  <h3 className="cal-modal-title">Attendance Calendar</h3>
                  <span className="cal-staff-subtitle">{calendarStaff.name} • {calendarStaff.branchName}</span>
                </div>
              </div>
              <button 
                type="button" 
                className="cal-close-btn" 
                onClick={handleCloseStaffCalendar}
                aria-label="Close Calendar"
              >
                <X size={18} />
              </button>
            </div>

            {/* Month Navigator */}
            <div className="cal-month-nav">
              <button 
                type="button" 
                className="cal-nav-arrow-btn" 
                onClick={handlePrevCalendarMonth}
                title="Previous Month"
                aria-label="Previous Month"
              >
                <ArrowLeft size={14} />
              </button>
              <div className="cal-month-display-wrapper">
                <span 
                  key={`month-${calendarYear}-${calendarMonth}`}
                  className={`cal-month-display cal-trans-${calendarSlideDir}`}
                >
                  {timesheetMonthNames[calendarMonth]} {calendarYear}
                </span>
              </div>
              <button 
                type="button" 
                className="cal-nav-arrow-btn" 
                onClick={handleNextCalendarMonth}
                title="Next Month"
                aria-label="Next Month"
              >
                <ArrowRight size={14} />
              </button>
            </div>

            {/* Weekdays Header */}
            <div className="cal-weekdays-grid">
              <span>S</span>
              <span>M</span>
              <span>T</span>
              <span>W</span>
              <span>T</span>
              <span>F</span>
              <span>S</span>
            </div>

            {/* Days Grid Viewport with smooth slide transition on month switch */}
            <div className="cal-grid-viewport">
              <div 
                key={`grid-${calendarYear}-${calendarMonth}`}
                className={`cal-days-grid cal-trans-${calendarSlideDir}`}
              >
                {/* Empty leading days */}
                {Array.from({ length: calendarFirstDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} className="cal-day-cell empty" />
                ))}

                {/* Month days */}
                {Array.from({ length: calendarDaysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const info = getCalendarDayInfo(day);
                  const isSelected = calendarSelectedDay === day;

                  return (
                    <button
                      key={day}
                      type="button"
                      className={`cal-day-cell cell-status-${info.status} ${isSelected ? 'selected' : ''}`}
                      onClick={() => setCalendarSelectedDay(day)}
                      title={`${day} ${timesheetMonthNames[calendarMonth]}: ${info.label}`}
                    >
                      <span className="cal-day-number">{day}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Interactive Details Box */}
            <div className="cal-details-card">
              {calendarSelectedDay ? (() => {
                const selectedInfo = getCalendarDayInfo(calendarSelectedDay);
                const dateObj = new Date(calendarYear, calendarMonth, calendarSelectedDay);
                const weekdayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });

                return (
                  <div className="cal-selected-info">
                    <div className="cal-selected-header">
                      <strong>{weekdayName}, {calendarSelectedDay} {timesheetMonthNames[calendarMonth]}</strong>
                      <span className={`cal-info-badge badge-${selectedInfo.status}`}>
                        {selectedInfo.label}
                      </span>
                    </div>

                    {selectedInfo.punches && selectedInfo.punches.length > 0 ? (
                      <div className="cal-punches-list">
                        {selectedInfo.punches.map((p, idx) => (
                          <div key={p.id || idx} className="cal-punch-row">
                            <span className={`cal-punch-type ${p.type === 'in' ? 'type-in' : 'type-out'}`}>
                              {p.type === 'in' ? 'Check In' : isMissedCheckoutRecord(p) ? 'Missed Out' : 'Check Out'}
                            </span>
                            <span className="cal-punch-time">{p.shortTime || p.time}</span>
                            <span className="cal-punch-branch">{p.branchName || calendarStaff.branchName}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="cal-no-punch-note">
                        {selectedInfo.status === 'off' 
                          ? 'Scheduled weekly off (Sunday)' 
                          : selectedInfo.status === 'absent' 
                          ? 'No attendance punches recorded for this working day.' 
                          : 'No punches for this date.'}
                      </p>
                    )}
                  </div>
                );
              })() : (
                <span className="cal-details-placeholder">Click a date to view details</span>
              )}
            </div>

            {/* Bottom Legend & PDF Download */}
            <div className="cal-legend-footer">
              <div className="cal-legend-items">
                <div className="cal-legend-item">
                  <span className="legend-box box-present" />
                  <span>Present</span>
                </div>
                <div className="cal-legend-item">
                  <span className="legend-box box-leave" />
                  <span>Leave</span>
                </div>
                <div className="cal-legend-item">
                  <span className="legend-box box-absent" />
                  <span>Absent</span>
                </div>
              </div>

              <button
                type="button"
                className="cal-download-btn"
                onClick={handleDownloadStaffMonthlyPDF}
                title={`Download ${calendarStaff.name}'s monthly attendance report as PDF`}
                aria-label="Download Attendance PDF"
              >
                <Download size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PWA Install Guide Modal */}
      {showInstallGuideModal && (
        <div className="modal-overlay" onClick={() => setShowInstallGuideModal(false)}>
          <div className="modal-content install-guide-modal" onClick={(e) => e.stopPropagation()}>
            <div className="install-guide-header">
              <div className="install-guide-logo-wrap">
                <img src="/icons/icon-192.png" alt="Convenio Marts Logo" className="install-guide-logo-img" />
              </div>
              <button 
                type="button"
                className="modal-close-btn"
                onClick={() => setShowInstallGuideModal(false)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="install-guide-body">
              <h3 className="install-guide-title">Install Convenio Marts</h3>
              <p className="install-guide-desc">
                Install this app on your device for one-tap attendance and full-screen experience without opening browser tabs.
              </p>

              {(() => {
                const info = getDeviceInfo();
                if (info.isIOS) {
                  return (
                    <div className="install-guide-steps">
                      <div className="install-step-item">
                        <div className="install-step-num">1</div>
                        <div className="install-step-text">
                          Tap the <strong>Share</strong> icon <span className="install-inline-tag">⎋</span> at the bottom of Safari.
                        </div>
                      </div>
                      <div className="install-step-item">
                        <div className="install-step-num">2</div>
                        <div className="install-step-text">
                          Scroll down and tap <strong>Add to Home Screen</strong> <span className="install-inline-tag">➕</span>.
                        </div>
                      </div>
                      <div className="install-step-item">
                        <div className="install-step-num">3</div>
                        <div className="install-step-text">
                          Tap <strong>Add</strong> in the top right to install.
                        </div>
                      </div>
                    </div>
                  );
                }
                if (info.isAndroid) {
                  return (
                    <div className="install-guide-steps">
                      <div className="install-step-item">
                        <div className="install-step-num">1</div>
                        <div className="install-step-text">
                          Tap the Chrome browser menu <span className="install-inline-tag">⋮</span> at the top right.
                        </div>
                      </div>
                      <div className="install-step-item">
                        <div className="install-step-num">2</div>
                        <div className="install-step-text">
                          Select <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.
                        </div>
                      </div>
                      <div className="install-step-item">
                        <div className="install-step-num">3</div>
                        <div className="install-step-text">
                          Tap <strong>Install</strong> to add Convenio Marts to your app drawer and search.
                        </div>
                      </div>
                    </div>
                  );
                }
                return (
                  <div className="install-guide-steps">
                    <div className="install-step-item">
                      <div className="install-step-num">1</div>
                      <div className="install-step-text">
                        Click the <strong>Install icon (⊕)</strong> on the right side of your browser address bar.
                      </div>
                    </div>
                    <div className="install-step-item">
                      <div className="install-step-num">2</div>
                      <div className="install-step-text">
                        Or open browser menu <span className="install-inline-tag">⋮</span> &rarr; select <strong>"Install Convenio Marts"</strong>.
                      </div>
                    </div>
                    <div className="install-step-item">
                      <div className="install-step-num">3</div>
                      <div className="install-step-text">
                        Click <strong>Install</strong> to create a desktop app window and shortcut.
                      </div>
                    </div>
                  </div>
                );
              })()}

              <button
                type="button"
                className="install-guide-confirm-btn"
                onClick={() => setShowInstallGuideModal(false)}
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
