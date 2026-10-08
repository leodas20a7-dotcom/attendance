import React, { useState, useEffect, useRef } from 'react';
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
  FileSpreadsheet,
  Building2,
  History,
  Pencil,
  Plus,
  Users,
  UserPlus,
  SlidersHorizontal,
  ChevronDown,
  Store,
  ShieldCheck,
  Database,
  Cloud
} from 'lucide-react';

import { 
  DEFAULT_BRANCHES,
  getStoredBranches, 
  saveStoredBranches, 
  STORAGE_KEY_BRANCHES, 
  STORAGE_KEY_RECORDS,
  STORAGE_KEY_SELECTED_BRANCH,
  STORAGE_KEY_SELECTED_EMP 
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
  SUPABASE_SCHEMA_SQL
} from './lib/supabase';

export default function App() {
  // Navigation: 'attendance' or 'admin'
  const getInitialView = () => {
    const path = window.location.pathname;
    const hash = window.location.hash;
    if (path.startsWith('/admin') || path.startsWith('/history') || hash === '#admin' || hash === '#history') {
      return 'admin';
    }
    return 'attendance';
  };

  const [view, setView] = useState(getInitialView);
  // Admin sub-tab: 'branches' or 'logs'
  const [adminTab, setAdminTab] = useState('branches');

  // Flash / Splash Loading Screen State
  const [appLoading, setAppLoading] = useState(true);
  const [loadingFadingOut, setLoadingFadingOut] = useState(false);

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

  // Manual fallback name if needed
  const [customEmployeeName, setCustomEmployeeName] = useState('');
  const [formValidationMsg, setFormValidationMsg] = useState('');

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
  const [editingEmp, setEditingEmp] = useState(null); // { branchId, empId, name, role }

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
          // Try fetching branches from Supabase
          const cloudBranches = await fetchBranchesFromSupabase();
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

          // Try fetching attendance records from Supabase
          const cloudRecords = await fetchAttendanceFromSupabase();
          if (cloudRecords && cloudRecords.length > 0) {
            setRecords(prev => {
              const cloudIds = new Set(cloudRecords.map(r => r.id));
              const uniqueLocal = prev.filter(r => !cloudIds.has(r.id));
              return [...cloudRecords, ...uniqueLocal];
            });
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

  // Flash / Splash Loading Screen Timer (smooth fade-out)
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoadingFadingOut(true);
      const closeTimer = setTimeout(() => {
        setAppLoading(false);
      }, 500);
      return () => clearTimeout(closeTimer);
    }, 1100);

    return () => clearTimeout(timer);
  }, []);

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

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
      if (!exists && currentBranch.employees.length > 0) {
        setSelectedEmpId(currentBranch.employees[0].id);
      } else if (!exists) {
        setSelectedEmpId('');
      }
    }
  }, [selectedBranchId, branches]);

  // Handle URL navigation
  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      if (path.startsWith('/admin') || path.startsWith('/history') || hash === '#admin' || hash === '#history') {
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

  // Currently active branch on attendance form
  const currentFormBranch = branches.find(b => b.id === selectedBranchId);
  const currentBranchEmployees = currentFormBranch?.employees || [];
  const currentFormEmployee = currentBranchEmployees.find(e => e.id === selectedEmpId);

  // Active branch in Admin Management
  const currentAdminBranch = branches.find(b => b.id === adminSelectedBranchId) || branches[0];

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
    setEditingBranch(null);
  };

  const handleDeleteBranch = (branchId) => {
    const branchToDelete = branches.find(b => b.id === branchId);
    if (!branchToDelete) return;

    const confirmMsg = branchToDelete.employees?.length > 0 
      ? `Are you sure you want to delete "${branchToDelete.name}" and its ${branchToDelete.employees.length} employees?`
      : `Are you sure you want to delete "${branchToDelete.name}"?`;

    if (window.confirm(confirmMsg)) {
      const updated = branches.filter(b => b.id !== branchId);
      setBranches(updated);
      removeBranchFromSupabase(branchId);
      if (adminSelectedBranchId === branchId && updated.length > 0) {
        setAdminSelectedBranchId(updated[0].id);
      }
      if (selectedBranchId === branchId && updated.length > 0) {
        setSelectedBranchId(updated[0].id);
      }
    }
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
    setNewEmpName('');
    setNewEmpRole('');
  };

  const handleUpdateEmployee = (e) => {
    e.preventDefault();
    if (!editingEmp || !editingEmp.name.trim()) return;

    const updatedEmp = {
      id: editingEmp.empId,
      name: editingEmp.name.trim(),
      role: editingEmp.role?.trim() || ''
    };

    setBranches(prev => prev.map(b => {
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
    }));

    syncEmployeeToSupabase(updatedEmp, editingEmp.branchId);
    setEditingEmp(null);
  };

  const handleDeleteEmployee = (branchId, empId) => {
    if (window.confirm('Are you sure you want to remove this employee?')) {
      setBranches(prev => prev.map(b => {
        if (b.id === branchId) {
          return {
            ...b,
            employees: (b.employees || []).filter(emp => emp.id !== empId)
          };
        }
        return b;
      }));

      removeEmployeeFromSupabase(empId);

      if (selectedEmpId === empId) {
        setSelectedEmpId('');
      }
    }
  };

  // ================= ATTENDANCE CHECK IN / OUT ACTION =================
  const handleActionClick = (actionType) => {
    if (!selectedBranchId) {
      setFormValidationMsg('Please select your Branch first.');
      return;
    }

    const empName = currentFormEmployee ? currentFormEmployee.name : customEmployeeName.trim();
    if (!empName) {
      setFormValidationMsg('Please select your Employee Name.');
      return;
    }

    setFormValidationMsg('');
    startCamera(actionType);
  };

  // Start Front Camera Stream (Strictly Front Camera Only)
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

    try {
      // Strictly front selfie camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'user' },
          width: { ideal: 1280 },
          height: { ideal: 1280 }
        },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraLoading(false);
    } catch (err) {
      console.error('Front camera access error:', err);
      // Fallback request explicitly for front camera
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'user' }, 
          audio: false 
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setIsCameraLoading(false);
      } catch (fallbackErr) {
        setIsCameraLoading(false);
        setCameraError('Permission required: Please allow camera access in your browser to verify attendance.');
      }
    }
  };

  // Stop camera stream
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setCapturedPhoto(null);
    setCameraError('');
  };

  // Capture frame from video stream (Always mirrors for natural front selfie)
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const size = Math.min(video.videoWidth, video.videoHeight) || 640;

    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Natural mirror transformation for front selfie camera
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);

    const startX = (video.videoWidth - size) / 2;
    const startY = (video.videoHeight - size) / 2;

    ctx.drawImage(video, startX, startY, size, size, 0, 0, size, size);
    const photoDataUrl = canvas.toDataURL('image/jpeg', 0.88);
    setCapturedPhoto(photoDataUrl);
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
  };

  // Submit attendance with live selfie & push with map location
  const submitAttendance = () => {
    if (!capturedPhoto) return;
    setIsProcessing(true);

    const now = new Date();
    const formattedDate = now.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const shortTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const activeEmpName = currentFormEmployee ? currentFormEmployee.name : (customEmployeeName.trim() || 'Employee');
    const activeBranchName = currentFormBranch ? currentFormBranch.name : 'Main Mart';
    const activeEmpRole = currentFormEmployee?.role || 'Staff';

    const finishRecord = (locationData) => {
      const newRecord = {
        id: 'REC-' + Date.now(),
        employeeName: activeEmpName,
        employeeRole: activeEmpRole,
        branchName: activeBranchName,
        type: currentActionType,
        date: formattedDate,
        time: formattedTime,
        shortTime,
        photo: capturedPhoto,
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
        photo: capturedPhoto,
        name: activeEmpName,
        branch: activeBranchName,
        role: activeEmpRole
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

  // Export records to CSV
  const exportToCSV = () => {
    if (records.length === 0) return;
    const headers = ['Record ID', 'Employee Name', 'Role', 'Branch Name', 'Action', 'Date', 'Time', 'Latitude', 'Longitude', 'Place Name', 'Google Maps URL'];
    const rows = records.map((r) => [
      `"${r.id}"`,
      `"${r.employeeName}"`,
      `"${r.employeeRole || '-'}"`,
      `"${r.branchName || '-'}"`,
      `"${r.type === 'in' ? 'Check In' : 'Check Out'}"`,
      `"${r.date}"`,
      `"${r.time || r.shortTime}"`,
      `"${r.location?.lat ?? ''}"`,
      `"${r.location?.lng ?? ''}"`,
      `"${r.location?.placeName || ''}"`,
      `"${r.location?.lat ? `https://www.google.com/maps?q=${r.location.lat},${r.location.lng}` : ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Convenio_Attendance_Logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearAllRecords = () => {
    if (window.confirm('Are you sure you want to clear all attendance logs? This cannot be undone.')) {
      setRecords([]);
      localStorage.removeItem(STORAGE_KEY_RECORDS);
      setSelectedRecord(null);
    }
  };

  const copyRecordDetails = (record) => {
    const text = `Convenio Marts Attendance Record\nID: ${record.id}\nEmployee: ${record.employeeName} (${record.employeeRole || 'Staff'})\nBranch: ${record.branchName || '-'}\nType: ${record.type === 'in' ? 'Check In' : 'Check Out'}\nDate & Time: ${record.date} at ${record.time || record.shortTime}\nCoordinates: ${record.location?.lat ? `${record.location.lat}, ${record.location.lng}` : 'N/A'}\nLocation: ${record.location?.placeName || 'N/A'}\nGoogle Maps: ${record.location?.lat ? `https://www.google.com/maps?q=${record.location.lat},${record.location.lng}` : 'N/A'}`;
    navigator.clipboard.writeText(text);
    setCopiedRecordId(record.id);
    setTimeout(() => setCopiedRecordId(null), 2000);
  };

  const filteredRecords = records.filter((r) => {
    const search = searchTerm.toLowerCase();
    const matchesSearch = 
      r.employeeName.toLowerCase().includes(search) ||
      (r.branchName && r.branchName.toLowerCase().includes(search)) ||
      (r.location?.placeName && r.location.placeName.toLowerCase().includes(search)) ||
      (r.location?.lat && String(r.location.lat).includes(search)) ||
      (r.location?.lng && String(r.location.lng).includes(search));
    const matchesType = filterType === 'all' || r.type === filterType;
    return matchesSearch && matchesType;
  });

  const totalEmployeesCount = branches.reduce((acc, b) => acc + (b.employees ? b.employees.length : 0), 0);

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

      {/* Top Navbar Header */}
      <header className="header">
        <div 
          className="logo-container" 
          onClick={() => navigateTo('attendance')} 
          role="button" 
          tabIndex={0} 
          style={{ cursor: 'pointer' }}
        >
          <svg className="logo-svg" viewBox="0 0 160 50" fill="none" xmlns="http://www.w3.org/2000/svg">
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

        {/* Dynamic Navigation Button & Supabase Status */}
        <div className="nav-actions">
          {supabaseStatus.tablesReady ? (
            <div className="supabase-status-pill live" title="Supabase Cloud Database Connected">
              <span className="live-dot green"></span>
              <span>Cloud Connected</span>
            </div>
          ) : (
            <button 
              className="supabase-status-pill setup" 
              onClick={() => setShowSqlModal(true)}
              title="Click to view Supabase database setup SQL"
            >
              <Database size={13} />
              <span>Supabase Setup</span>
            </button>
          )}

          {view === 'attendance' ? (
            <button 
              id="nav-to-admin-btn"
              className="history-switch-btn admin-nav-btn"
              onClick={() => navigateTo('admin')}
              title="Open Admin Portal to Manage Branches, Employees & Records"
            >
              <ShieldCheck size={18} className="admin-nav-icon" />
              <span>Admin Portal</span>
            </button>
          ) : (
            <button 
              id="nav-back-to-attendance-btn"
              className="portal-back-btn"
              onClick={() => navigateTo('attendance')}
            >
              <ArrowLeft size={16} />
              <span>Back to Attendance</span>
            </button>
          )}
        </div>
      </header>

      {/* ================= 1. USER ATTENDANCE VIEW ================= */}
      {view === 'attendance' && (
        <main className="main-content">
          <div className="clean-card">
            <div className="clean-card-header">
              <h1 className="clean-card-title">Staff Attendance</h1>
              <p className="clean-card-subtitle">Select your branch and name to check in or out</p>
            </div>

            <div className="clean-form">
              {/* Branch Selection */}
              <div className="clean-field">
                <label htmlFor="branch-select" className="clean-label">Branch</label>
                <div className="clean-select-wrapper">
                  <select
                    id="branch-select"
                    className="clean-select"
                    value={selectedBranchId}
                    onChange={(e) => {
                      setSelectedBranchId(e.target.value);
                      if (formValidationMsg) setFormValidationMsg('');
                    }}
                  >
                    <option value="" disabled>Select Branch</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="clean-chevron" size={18} />
                </div>
              </div>

              {/* Employee Selection */}
              <div className="clean-field">
                <label htmlFor="employee-select" className="clean-label">Employee Name</label>
                {currentBranchEmployees.length > 0 ? (
                  <div className="clean-select-wrapper">
                    <select
                      id="employee-select"
                      className="clean-select"
                      disabled={!selectedBranchId}
                      value={selectedEmpId}
                      onChange={(e) => {
                        setSelectedEmpId(e.target.value);
                        if (formValidationMsg) setFormValidationMsg('');
                      }}
                    >
                      <option value="" disabled>
                        {!selectedBranchId ? 'Select a branch first' : 'Select Employee'}
                      </option>
                      {currentBranchEmployees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="clean-chevron" size={18} />
                  </div>
                ) : (
                  <input
                    type="text"
                    id="employee-select"
                    placeholder="Enter Employee Name"
                    value={customEmployeeName}
                    onChange={(e) => setCustomEmployeeName(e.target.value)}
                    className="clean-input"
                  />
                )}
              </div>

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
                  className="clean-btn clean-btn-in"
                  onClick={() => handleActionClick('in')}
                >
                  <LogIn size={18} />
                  <span>Check In</span>
                </button>

                <button 
                  id="btn-check-out"
                  className="clean-btn clean-btn-out"
                  onClick={() => handleActionClick('out')}
                >
                  <LogOut size={18} />
                  <span>Check Out</span>
                </button>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ================= 2. ADMIN PORTAL VIEW ================= */}
      {view === 'admin' && (
        <main className="admin-container">
          {/* Admin Header with Sub-tabs */}
          <div className="admin-header-card">
            <div className="admin-title-row">
              <div>
                <h1 className="admin-title">Admin Dashboard</h1>
                <p className="admin-subtitle">Manage branch locations, staff members, and attendance records</p>
              </div>

              {/* Top Navigation Sub-Tabs */}
              <div className="admin-nav-tabs">
                <button 
                  id="tab-btn-branches"
                  className={`admin-tab-btn ${adminTab === 'branches' ? 'active' : ''}`}
                  onClick={() => setAdminTab('branches')}
                >
                  <Building2 size={16} />
                  <span>Branches & Staff</span>
                  <span className="tab-pill-counter">{branches.length}</span>
                </button>
                <button 
                  id="tab-btn-logs"
                  className={`admin-tab-btn ${adminTab === 'logs' ? 'active' : ''}`}
                  onClick={() => setAdminTab('logs')}
                >
                  <History size={16} />
                  <span>Attendance Logs</span>
                  <span className="tab-pill-counter">{records.length}</span>
                </button>
              </div>
            </div>

            {/* Supabase Cloud Database Status Card */}
            <div className="supabase-admin-card">
              <div className="supabase-card-left">
                <div className={`supabase-icon-box ${supabaseStatus.tablesReady ? 'connected' : 'setup'}`}>
                  <Database size={18} />
                </div>
                <div className="supabase-card-info">
                  <div className="supabase-card-title-row">
                    <strong>Supabase Cloud Database</strong>
                    <span className={`supabase-badge ${supabaseStatus.tablesReady ? 'ready' : 'pending'}`}>
                      {supabaseStatus.tablesReady ? '● Connected' : 'Setup Required'}
                    </span>
                  </div>
                  <p className="supabase-card-sub">
                    Project: <code>ykdhjkzrprafzivvguhh</code>
                    {supabaseStatus.tablesReady 
                      ? ' • All branches, employees and selfie attendance logs are synchronized with Supabase.' 
                      : ' • Run the SQL script once in your Supabase SQL editor to enable cloud syncing.'}
                  </p>
                </div>
              </div>

              <button className="btn-setup-supabase" onClick={() => setShowSqlModal(true)}>
                <Database size={14} />
                <span>{supabaseStatus.tablesReady ? 'View SQL Schema' : 'Setup SQL Schema'}</span>
              </button>
            </div>

            {/* High Level Metrics Bar */}
            <div className="admin-stats-grid">
              <div className="stat-card">
                <span className="stat-label">Total Branches</span>
                <span className="stat-val text-navy">{branches.length}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Total Employees</span>
                <span className="stat-val text-red">{totalEmployeesCount}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Today's Check Ins</span>
                <span className="stat-val text-green">{records.filter(r => r.type === 'in').length}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Total Attendance Logs</span>
                <span className="stat-val">{records.length}</span>
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
                      <p className="sub-text">Select branch to view/edit employees</p>
                    </div>
                  </div>
                  <button 
                    id="btn-add-branch-open"
                    className="btn-add-primary"
                    onClick={() => setShowAddBranchModal(true)}
                  >
                    <Plus size={16} />
                    <span>Add Branch</span>
                  </button>
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
                              <div className="branch-name-line">
                                <strong className="branch-title">{b.name}</strong>
                                {b.code && <span className="branch-code-badge">{b.code}</span>}
                              </div>
                              <div className="branch-sub-line">
                                <span className="branch-loc-text">{b.address || 'Bengaluru'}</span>
                                <span className="branch-dot">•</span>
                                <span className="branch-emp-count">
                                  <Users size={12} /> {empCount} {empCount === 1 ? 'Employee' : 'Employees'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="branch-item-actions" onClick={(e) => e.stopPropagation()}>
                            <button 
                              className="btn-icon-edit"
                              title="Edit Branch Name & Details"
                              onClick={() => setEditingBranch(b)}
                            >
                              <Pencil size={15} />
                            </button>
                            <button 
                              className="btn-icon-delete"
                              title="Delete Branch"
                              onClick={() => handleDeleteBranch(b.id)}
                            >
                              <Trash2 size={15} />
                            </button>
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
                          <h3>Employees for "{currentAdminBranch.name}"</h3>
                          <p className="sub-text">
                            {currentAdminBranch.employees?.length || 0} registered staff members
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Quick Add Employee Form for this Branch */}
                    <form className="add-emp-form-card" onSubmit={handleAddEmployee}>
                      <div className="form-sub-header">
                        <UserPlus size={16} />
                        <span>Add New Employee to {currentAdminBranch.name}</span>
                      </div>
                      <div className="add-emp-inputs-row">
                        <div className="input-group-grow">
                          <input 
                            id="new-emp-name-input"
                            type="text" 
                            required 
                            placeholder="Employee Full Name (e.g. Ramesh Kumar)" 
                            value={newEmpName}
                            onChange={(e) => setNewEmpName(e.target.value)}
                          />
                        </div>
                        <div className="input-group-role">
                          <input 
                            id="new-emp-role-input"
                            type="text" 
                            placeholder="Role / Designation (e.g. Cashier, Store Manager)" 
                            value={newEmpRole}
                            onChange={(e) => setNewEmpRole(e.target.value)}
                          />
                        </div>
                        <button 
                          id="btn-add-emp-submit"
                          type="submit" 
                          className="btn-add-emp"
                        >
                          <Plus size={16} />
                          <span>Add</span>
                        </button>
                      </div>
                    </form>

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
                          .map((emp) => (
                            <div key={emp.id} className="employee-roster-item">
                              <div className="emp-item-left">
                                <div className="emp-avatar-bubble">
                                  {emp.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="emp-item-info">
                                  <strong className="emp-item-name">{emp.name}</strong>
                                  {emp.role && <span className="emp-item-role">{emp.role}</span>}
                                </div>
                              </div>

                              <div className="emp-item-actions">
                                <button 
                                  className="btn-icon-edit"
                                  title="Edit Employee Name / Role"
                                  onClick={() => setEditingEmp({
                                    branchId: currentAdminBranch.id,
                                    empId: emp.id,
                                    name: emp.name,
                                    role: emp.role || ''
                                  })}
                                >
                                  <Pencil size={14} />
                                </button>
                                <button 
                                  className="btn-icon-delete"
                                  title="Remove Employee"
                                  onClick={() => handleDeleteEmployee(currentAdminBranch.id, emp.id)}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))
                      )}
                    </div>
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
                      disabled={records.length === 0}
                      title="Download Attendance CSV"
                    >
                      <FileSpreadsheet size={16} />
                      <span>Export CSV</span>
                    </button>
                    {records.length > 0 && (
                      <button 
                        id="clear-records-btn" 
                        className="btn-danger-clear" 
                        onClick={clearAllRecords}
                        title="Clear all logs"
                      >
                        <Trash2 size={16} />
                        <span>Clear All</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Records Table */}
              {filteredRecords.length === 0 ? (
                <div className="admin-empty-state">
                  <Clock size={48} color="#cbd5e1" />
                  <h3>No Attendance Records Found</h3>
                  <p>When staff members select their branch & take selfie attendance, verified records will appear here.</p>
                  <button className="btn-go-portal" onClick={() => navigateTo('attendance')}>
                    Go to Attendance Portal
                  </button>
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
                      {filteredRecords.map((item) => (
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
                                <img src={item.photo} alt="Selfie" className="selfie-thumbnail" />
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
                            </div>
                          </td>

                          {/* Action */}
                          <td>
                            <span className={`table-badge ${item.type === 'in' ? 'badge-in' : 'badge-out'}`}>
                              {item.type === 'in' ? <LogIn size={13} /> : <LogOut size={13} />}
                              <span>{item.type === 'in' ? 'Check In' : 'Check Out'}</span>
                            </span>
                          </td>

                          {/* Time */}
                          <td>
                            <div className="table-time-cell">
                              <div className="time-primary">{item.time || item.shortTime}</div>
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
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </main>
      )}

      {/* ================= MODAL: ADD BRANCH ================= */}
      {showAddBranchModal && (
        <div className="modal-overlay" onClick={() => setShowAddBranchModal(false)}>
          <div className="modal-content modal-form" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <div className="modal-title-with-icon">
                <Store size={20} className="modal-icon-brand" />
                <h3>Add New Branch Location</h3>
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
                  placeholder="e.g. Indiranagar Flagship, Koramangala 4th Block"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label htmlFor="modal-branch-code">Branch Code (Optional)</label>
                <input 
                  id="modal-branch-code"
                  type="text" 
                  placeholder="e.g. CM-BLR-06"
                  value={newBranchCode}
                  onChange={(e) => setNewBranchCode(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="modal-branch-address">Location / Address (Optional)</label>
                <input 
                  id="modal-branch-address"
                  type="text" 
                  placeholder="e.g. 100ft Road, Bengaluru"
                  value={newBranchAddress}
                  onChange={(e) => setNewBranchAddress(e.target.value)}
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
                <h3>Edit Branch Name</h3>
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

              <div className="form-group">
                <label htmlFor="edit-branch-code">Branch Code</label>
                <input 
                  id="edit-branch-code"
                  type="text" 
                  value={editingBranch.code || ''}
                  onChange={(e) => setEditingBranch({ ...editingBranch, code: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-branch-address">Location / Address</label>
                <input 
                  id="edit-branch-address"
                  type="text" 
                  value={editingBranch.address || ''}
                  onChange={(e) => setEditingBranch({ ...editingBranch, address: e.target.value })}
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
                <label htmlFor="edit-emp-role">Role / Designation</label>
                <input 
                  id="edit-emp-role"
                  type="text" 
                  value={editingEmp.role}
                  onChange={(e) => setEditingEmp({ ...editingEmp, role: e.target.value })}
                />
              </div>

              <div className="modal-form-actions">
                <button type="button" className="btn-cancel" onClick={() => setEditingEmp(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-save-primary">
                  <Check size={16} />
                  <span>Save Employee</span>
                </button>
              </div>
            </form>
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
              ) : isCameraLoading ? (
                <div className="camera-loading-container">
                  <Loader2 className="spinner" size={32} color="#ffffff" />
                  <p>Opening front camera...</p>
                </div>
              ) : !capturedPhoto ? (
                <div className="video-stream-box">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="live-video mirror-video"
                  />
                  <div className="face-guide-overlay">
                    <div className="face-oval-guide"></div>
                    <span className="face-guide-text">Position face inside guide</span>
                  </div>
                </div>
              ) : (
                <div className="captured-preview-box">
                  <img src={capturedPhoto} alt="Captured Photo" className="preview-img" />
                  <div className="preview-stamp">
                    <CheckCircle2 size={16} /> Photo Captured
                  </div>
                </div>
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
              Recorded at <strong>{successData.shortTime}</strong> on {successData.formattedDate}
            </p>

            <div className="success-emp-card">
              <img src={successData.photo} alt="Verified Selfie" className="success-selfie-img" />
              <div className="success-emp-info">
                <strong>{successData.name}</strong>
                <span className="emp-role-pill">{successData.role}</span>
                <span className="success-branch-tag">
                  <Building2 size={12} /> {successData.branch}
                </span>
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
          <div className="modal-content record-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="detail-modal-header">
              <div className="detail-modal-title-box">
                <span className={`table-badge ${selectedRecord.type === 'in' ? 'badge-in' : 'badge-out'}`}>
                  {selectedRecord.type === 'in' ? <LogIn size={14} /> : <LogOut size={14} />}
                  <span>{selectedRecord.type === 'in' ? 'Check In Record' : 'Check Out Record'}</span>
                </span>
                <span className="detail-record-id">{selectedRecord.id}</span>
              </div>
              <button className="icon-close-btn" onClick={() => setSelectedRecord(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="detail-modal-body">
              <div className="detail-profile-hero">
                <div 
                  className="detail-photo-wrapper" 
                  onClick={() => setViewingPhoto(selectedRecord)}
                  title="Click to view full screen"
                >
                  <img src={selectedRecord.photo} alt="Live Capture" className="detail-selfie-img" />
                  <div className="detail-photo-zoom-tag">
                    <Eye size={12} /> Full Size
                  </div>
                </div>
                <div className="detail-profile-info">
                  <h3>{selectedRecord.employeeName}</h3>
                  {selectedRecord.employeeRole && (
                    <span className="emp-role-pill">{selectedRecord.employeeRole}</span>
                  )}
                  <div className="detail-branch-badge">
                    <Building2 size={14} />
                    <span>Branch: <strong>{selectedRecord.branchName || '-'}</strong></span>
                  </div>
                  <div className="detail-verified-pill">
                    <CheckCircle2 size={13} />
                    <span>Verified Live Photo & GPS Pin</span>
                  </div>
                </div>
              </div>

              <div className="detail-info-grid">
                <div className="detail-info-card">
                  <span className="info-card-label">Timestamp</span>
                  <div className="info-card-val-group">
                    <Clock size={16} className="info-card-icon" />
                    <strong>{selectedRecord.time || selectedRecord.shortTime}</strong>
                  </div>
                  <span className="info-card-sub">{selectedRecord.date}</span>
                </div>

                <div className="detail-info-card">
                  <span className="info-card-label">Action Type</span>
                  <div className="info-card-val-group">
                    {selectedRecord.type === 'in' ? (
                      <strong className="text-red">Check In (Entry)</strong>
                    ) : (
                      <strong className="text-navy">Check Out (Exit)</strong>
                    )}
                  </div>
                  <span className="info-card-sub">Convenio Mart Attendance</span>
                </div>
              </div>

              <div className="detail-location-section">
                <div className="detail-location-header">
                  <MapPin size={16} className="loc-icon" />
                  <h4>Captured Geolocation Details</h4>
                </div>

                <div className="detail-coords-box">
                  <div className="coord-field">
                    <span className="coord-field-label">Latitude & Longitude</span>
                    <span className="coord-field-value">
                      {selectedRecord.location?.lat ? `${selectedRecord.location.lat}, ${selectedRecord.location.lng}` : 'GPS Data Not Available'}
                    </span>
                  </div>
                  {selectedRecord.location?.placeName && (
                    <div className="coord-field">
                      <span className="coord-field-label">Resolved Location / Area</span>
                      <span className="coord-field-value place-text">
                        {selectedRecord.location.placeName}
                      </span>
                    </div>
                  )}
                </div>

                {selectedRecord.location?.lat && (
                  <div className="detail-location-actions">
                    <a 
                      href={`https://www.google.com/maps?q=${selectedRecord.location.lat},${selectedRecord.location.lng}`}
                      target="_blank" 
                      rel="noreferrer" 
                      className="btn-open-gmaps"
                    >
                      <MapPin size={15} />
                      <span>Open Exact Pin in Google Maps</span>
                      <ExternalLink size={14} />
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div className="detail-modal-footer">
              <button 
                className="btn-copy-record"
                onClick={() => copyRecordDetails(selectedRecord)}
              >
                {copiedRecordId === selectedRecord.id ? (
                  <>
                    <Check size={16} color="#10b981" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    <span>Copy Details</span>
                  </>
                )}
              </button>
              <button className="modal-close-btn" onClick={() => setSelectedRecord(null)}>
                Close
              </button>
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
                  {viewingPhoto.type === 'in' ? 'Check In' : 'Check Out'} at {viewingPhoto.time || viewingPhoto.shortTime}, {viewingPhoto.date}
                </span>
              </div>
              <button className="icon-close-btn" onClick={() => setViewingPhoto(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="photo-full-body">
              <img src={viewingPhoto.photo} alt="Photo Full" className="full-size-selfie" />
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
    </div>
  );
}
