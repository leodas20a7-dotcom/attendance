// Branches and Employees for Convenio Marts
export const DEFAULT_BRANCHES = [
  {
    id: 'branch-casagrand-royale',
    name: 'Casagrand Royale',
    code: 'CGR-SHL',
    location: 'Shollingnallur',
    pincode: '600119',
    address: 'Model School Rd, Extension, Sholinganallur, Chennai, Greater Chennai, Tamil Nadu 600119',
    lat: 12.892397,
    lng: 80.220769,
    geofenceRadiusMeters: 50,
    employees: [
      { id: 'emp-royale-1', name: 'Ajith Kumar' },
      { id: 'emp-royale-2', name: 'Hari Priya' },
      { id: 'emp-royale-3', name: 'Kalaiselvan' },
      { id: 'emp-royale-4', name: 'Pathma Sree' }
    ]
  },
  {
    id: 'branch-casagrand-sereno',
    name: 'Casagrand Sereno',
    code: 'CGR-OTT',
    location: 'Ottiambakkam',
    pincode: '600130',
    address: 'Casa Grand - Sereno, Karanai Main Rd, Ottiambakkam, Chennai, Sonalur, Tamil Nadu 600130',
    lat: 12.861552,
    lng: 80.200746,
    geofenceRadiusMeters: 50,
    employees: [
      { id: 'emp-sereno-1', name: 'Akash' }
    ]
  },
  {
    id: 'branch-casagrand-savoye',
    name: 'Casagrand Savoye',
    code: 'CGR-KRP',
    location: 'Thoraipakkam/Karapakkam',
    pincode: '600097',
    address: 'Kuppuswamy St, Sholinganallur, Thoraipakkam, Chennai, Tamil Nadu 600097',
    lat: 12.916164,
    lng: 80.234886,
    geofenceRadiusMeters: 50,
    employees: [
      { id: 'emp-savoye-1', name: 'Surya' },
      { id: 'emp-savoye-2', name: 'Muruma' },
      { id: 'emp-savoye-3', name: 'Thasthakeer' }
    ]
  },
  {
    id: 'branch-advaita-blossom',
    name: 'Advaita Blossom',
    code: 'ADV-KLM',
    location: 'Thaiyur',
    pincode: '603103',
    address: "Advaita Blossoms, #2/421, Market Road, Thaiyur Market Rd, A' Village, Kelambakkam, Tamil Nadu 603103",
    lat: 12.784405,
    lng: 80.211283,
    geofenceRadiusMeters: 50,
    employees: [
      { id: 'emp-blossom-1', name: 'Sathish' }
    ]
  },
  {
    id: 'branch-casagrand-woodside',
    name: 'Casagrand Woodside',
    code: 'CGR-WDS',
    location: 'Manapakkam',
    pincode: '600125',
    address: '29, Manapakkam Main Rd, Ramapuram, Dharmarajapuram, Manapakkam, Chennai, Kolapakkam, Tamil Nadu 600125',
    lat: 13.011330,
    lng: 80.160471,
    geofenceRadiusMeters: 50,
    employees: [
      { id: 'emp-woodside-1', name: 'Dhanalakshmi' },
      { id: 'emp-woodside-2', name: 'Vinitha' }
    ]
  },
  {
    id: 'branch-casagrand-utopia',
    name: 'Casagrand Utopia',
    code: 'CGR-UTP',
    location: 'Manapakkam',
    pincode: '600125',
    address: 'Ramapuram, Sriram Gardens, Indira Nagar, Manapakkam, Chennai, Tamil Nadu 600125',
    lat: 13.013737,
    lng: 80.168516,
    geofenceRadiusMeters: 50,
    employees: [
      { id: 'emp-utopia-1', name: 'Saran' }
    ]
  },
  {
    id: 'branch-kym-market',
    name: 'KYM Market',
    code: 'KYM-MKT',
    location: 'Inside Market',
    pincode: '600125',
    address: 'Inside Market, Chennai',
    lat: 13.012500,
    lng: 80.165000,
    geofenceRadiusMeters: 50,
    employees: [
      { id: 'emp-kym-1', name: 'Sakthi' },
      { id: 'emp-kym-2', name: 'Tamil Maran' },
      { id: 'emp-kym-3', name: 'Panjan' }
    ]
  },
  {
    id: 'branch-casagrand-castle',
    name: 'Casagrand Castle',
    code: 'CGR-CST',
    location: 'Manapakkam',
    pincode: '600125',
    address: 'Manapakkam Main Rd, Ramapuram, Dharmarajapuram, Manapakkam, Chennai, Kolapakkam, Tamil Nadu 600125',
    lat: 13.009525,
    lng: 80.159948,
    geofenceRadiusMeters: 50,
    employees: [
      { id: 'emp-castle-1', name: 'Suganya' },
      { id: 'emp-castle-2', name: 'Akash' }
    ]
  },
  {
    id: 'branch-casagrand-tudoor',
    name: 'Casagrand Tudoor',
    code: 'CGR-TDR',
    location: 'Mogappair',
    pincode: '600095',
    address: 'Chanakyan Main Road, Annamalai Ave, Mogappair, Chennai, Tamil Nadu 600095',
    lat: 13.073864,
    lng: 80.169518,
    geofenceRadiusMeters: 50,
    employees: [
      { id: 'emp-tudoor-1', name: 'Adhithiyan' }
    ]
  }
];

export const STORAGE_KEY_BRANCHES = 'convenio_branches_master';
export const STORAGE_KEY_RECORDS = 'convenio_attendance_records';
export const STORAGE_KEY_SELECTED_BRANCH = 'convenio_selected_branch_id';
export const STORAGE_KEY_SELECTED_EMP = 'convenio_selected_emp_id';

export function getStoredBranches() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BRANCHES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_BRANCHES, JSON.stringify(DEFAULT_BRANCHES));
      return DEFAULT_BRANCHES;
    }
    const parsed = JSON.parse(raw);
    // If old mock data from previous version exists, automatically upgrade to new Casagrand branches
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.name === 'MG Road Flagship') {
      localStorage.setItem(STORAGE_KEY_BRANCHES, JSON.stringify(DEFAULT_BRANCHES));
      localStorage.removeItem(STORAGE_KEY_SELECTED_BRANCH);
      localStorage.removeItem(STORAGE_KEY_SELECTED_EMP);
      return DEFAULT_BRANCHES;
    }
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Merge lat/lng and geofence info if not yet in stored branches
      const updated = parsed.map(branch => {
        const match = DEFAULT_BRANCHES.find(d => d.id === branch.id || d.name.toLowerCase() === branch.name?.toLowerCase());
        if (match && (!branch.lat || !branch.lng)) {
          return {
            ...branch,
            lat: match.lat,
            lng: match.lng,
            geofenceRadiusMeters: match.geofenceRadiusMeters || 50,
            location: branch.location || match.location,
            address: branch.address || match.address,
            pincode: branch.pincode || match.pincode
          };
        }
        return branch;
      });
      return updated;
    }
    localStorage.setItem(STORAGE_KEY_BRANCHES, JSON.stringify(DEFAULT_BRANCHES));
    return DEFAULT_BRANCHES;
  } catch (e) {
    console.error('Error loading branches:', e);
    return DEFAULT_BRANCHES;
  }
}

export function saveStoredBranches(branches) {
  try {
    localStorage.setItem(STORAGE_KEY_BRANCHES, JSON.stringify(branches));
  } catch (e) {
    console.error('Error saving branches:', e);
  }
}
