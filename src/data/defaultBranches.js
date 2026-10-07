// Branches and Employees for Convenio Marts
export const DEFAULT_BRANCHES = [
  {
    id: 'branch-casagrand-royale',
    name: 'Casagrand Royale',
    code: 'CGR-SHL',
    address: 'Sholinganallur',
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
    address: 'Ottiyapakkam',
    employees: [
      { id: 'emp-sereno-1', name: 'Akash' }
    ]
  },
  {
    id: 'branch-casagrand-savoye',
    name: 'Casagrand Savoye',
    code: 'CGR-KRP',
    address: 'Karapakkam',
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
    address: 'Kelambakkam',
    employees: [
      { id: 'emp-blossom-1', name: 'Sathish' }
    ]
  },
  {
    id: 'branch-casagrand-woodside',
    name: 'Casagrand Woodside',
    code: 'CGR-WDS',
    address: 'Manapakkam',
    employees: [
      { id: 'emp-woodside-1', name: 'Dhanalakshmi' },
      { id: 'emp-woodside-2', name: 'Vinitha' }
    ]
  },
  {
    id: 'branch-casagrand-utopia',
    name: 'Casagrand Utopia',
    code: 'CGR-UTP',
    address: 'Manapakkam',
    employees: [
      { id: 'emp-utopia-1', name: 'Saran' }
    ]
  },
  {
    id: 'branch-kym-market',
    name: 'KYM Market',
    code: 'KYM-MKT',
    address: 'Inside Market',
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
    address: 'Manapakkam',
    employees: [
      { id: 'emp-castle-1', name: 'Suganya' },
      { id: 'emp-castle-2', name: 'Akash' }
    ]
  },
  {
    id: 'branch-casagrand-tudoor',
    name: 'Casagrand Tudoor',
    code: 'CGR-TDR',
    address: 'Mogappair',
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
      return parsed;
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
