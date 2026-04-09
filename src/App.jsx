import React, { useState, useMemo, useRef, useEffect, useDeferredValue } from 'react';
import { 
  HardDrive, Files, Trash2, UploadCloud, Database, Search, CheckSquare, 
  Square, Download, AlertCircle, ChevronDown, ChevronRight, Info,
  Folder as FolderIcon, File as FileIcon, ArrowLeft, Home, FileOutput,
  ChevronLeft, X, FolderOpen, Loader2, Cloud, LogOut, User,
  ShieldAlert, Key, Lock, History, Users, Menu, Clock, Laptop,
  FileSearch, AlertTriangle, Bell, BellOff, FileSpreadsheet,
  RefreshCw, Filter, Pencil, Printer, MessageCircle, BookOpen,
  LayoutDashboard
} from 'lucide-react';

// ============================================================================
// KONFIGURASI SUPABASE (VERSI PRODUKSI VITE / NETLIFY)
// ============================================================================
import { createClient } from '@supabase/supabase-js';

// Menggunakan import.meta.env untuk Vite, dengan fallback hardcode ke kredensial Anda 
// agar mencegah blank screen jika lupa setting Environment Variable di Netlify.
const supabaseUrl = "https://rdbbauwvwsazdqdsryjd.supabase.co";
const supabaseAnonKey = "sb_secret_VtrmkX0W8fnZL_QK7pXV4Q_6wZPzLe2";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============================================================================
// KONSTANTA & FUNGSI UTILITAS (PURE FUNCTIONS)
// ============================================================================
const HDD_CAPACITIES = [
  { label: '500 GB (~465 GB Usable)', value: 500 * Math.pow(1000, 3) },
  { label: '1 TB (~931 GB Usable)', value: 1 * Math.pow(1000, 4) },
  { label: '2 TB (~1.81 TB Usable)', value: 2 * Math.pow(1000, 4) },
  { label: '4 TB (~3.63 TB Usable)', value: 4 * Math.pow(1000, 4) },
  { label: '5 TB (~4.54 TB Usable)', value: 5 * Math.pow(1000, 4) },
  { label: '8 TB (~7.27 TB Usable)', value: 8 * Math.pow(1000, 4) },
  { label: '10 TB (~9.09 TB Usable)', value: 10 * Math.pow(1000, 4) },
  { label: '12 TB (~10.9 TB Usable)', value: 12 * Math.pow(1000, 4) },
  { label: '14 TB (~12.7 TB Usable)', value: 14 * Math.pow(1000, 4) },
  { label: '16 TB (~14.5 TB Usable)', value: 16 * Math.pow(1000, 4) },
  { label: '20 TB (~18.1 TB Usable)', value: 20 * Math.pow(1000, 4) }
];

const FIXED_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1wLg2boP1FtUoU9YPOrZxWkbMPHGxm-WHLTNOKMJuLs8/export?format=csv&gid=1175924314';
const GENERIC_FOLDERS = new Set(['stream', 'bdmv', 'avchd', 'private', 'dcim', 'clip', 'root', 'contents', 'video', 'audio', 'm4root', 'sub', 'media']);

const formatBytes = (bytes, decimals = 2) => {
  if (!+bytes) return '0 Bytes';
  const k = 1024, dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

const generateId = () => crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);

const getVirtualPath = (path, hddName) => {
  if (!path) return hddName;
  return `${hddName}\\${path.replace(/\\/g, '\\').replace(/\\\\$/, '').replace(/^[a-zA-Z]:\\?/, '')}`;
};

const getDaysOld = (dateString) => {
  if (!dateString) return 0;
  let past = new Date(dateString).getTime();
  if (isNaN(past) && dateString.includes('/')) {
    const parts = dateString.split('/');
    if (parts.length === 3) past = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00`).getTime();
  }
  if (isNaN(past)) return 0;
  const diff = Date.now() - past;
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
};

const isGenericCameraFolder = (name) => {
  if (!name) return false;
  const lower = name.toLowerCase().trim();
  if (GENERIC_FOLDERS.has(lower)) return true;
  if (lower.includes('mixer') || lower.includes('cam ') || lower.includes('cam_') || lower.includes('kamera ')) return true;
  return /^[1-9]\d\d[a-z]+/i.test(lower);
};

// Parser Struktur Snap2HTML
const parseHTML = (text) => {
  let parsedFiles = [];
  
  if (text.includes('"files":[')) {
    const start = text.indexOf('var dirs = ');
    if (start !== -1) {
      let jsonStr = text.substring(start + 11, text.indexOf('</script>', start)).trim();
      if (jsonStr.endsWith(';')) jsonStr = jsonStr.slice(0, -1);
      try {
        JSON.parse(jsonStr).forEach(dir => {
          (dir.files || []).forEach(f => {
            if (f.name || f.n) parsedFiles.push({
              id: generateId(), path: dir.path || '', name: String(f.name || f.n),
              size: parseInt(f.size ?? f.s ?? 0, 10), date: String(f.date || f.d || '')
            });
          });
        });
        if (parsedFiles.length) return parsedFiles;
      } catch(e) {}
    }
  }

  const pCalls = [];
  let searchIdx = 0;
  while (true) {
    const start = text.indexOf('p([', searchIdx);
    if (start === -1) break;
    let end = text.indexOf('])', start + 3);
    let found = false;
    while (end !== -1 && (end - start) < 15000000) { 
      try {
        pCalls.push(JSON.parse(text.substring(start + 2, end + 1)));
        searchIdx = end + 2; found = true; break;
      } catch(e) { end = text.indexOf('])', end + 2); }
    }
    if (!found) searchIdx = start + 3;
  }

  if (pCalls.length) {
    const dirNodes = pCalls.map(dir => ({
      name: String(dir[0] ?? '').split('*')[0], parentId: dir[1], files: dir.slice(3) 
    }));

    const getPath = (index) => {
      const parts = []; let curr = index; let loop = 0;
      while (curr !== undefined && curr !== null && curr !== '' && loop++ < 2000) {
        if (!dirNodes[curr]) break;
        parts.unshift(dirNodes[curr].name);
        if (dirNodes[curr].parentId === curr || dirNodes[curr].parentId === '') break;
        curr = dirNodes[curr].parentId;
      }
      return parts.join('\\');
    };

    dirNodes.forEach((node, i) => {
      const currentPath = getPath(i);
      node.files.forEach(fileStr => {
        if (!fileStr) return;
        const fParts = String(fileStr).split('*');
        parsedFiles.push({
          id: generateId(), path: currentPath, name: fParts[0],
          size: fParts[1] ? (parseInt(fParts[1], 36) || 0) : 0,
          date: fParts[2] ? new Date(parseInt(fParts[2], 36) * 1000).toLocaleDateString() : ''
        });
      });
    });
    return parsedFiles;
  }
  throw new Error("Format Snap2HTML tidak valid.");
};

// ============================================================================
// KOMPONEN UTAMA APLIKASI
// ============================================================================
export default function App() {
  // --- STATE: AUTH & CORE ---
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null); 
  const [isDbLoading, setIsDbLoading] = useState(true);
  
  // --- STATE: UI ---
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMsg, setProcessingMsg] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0); 
  
  // --- STATE: DB DATA ---
  const [hdds, setHdds] = useState([]); 
  const [usersList, setUsersList] = useState([]);
  const [logs, setLogs] = useState([]);
  
  // --- STATE: FILES MEMORY MANAGEMENT ---
  const [isFilesSyncing, setIsFilesSyncing] = useState(true); 
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });
  const loadedChunksRef = useRef(new Map()); 
  const filesRef = useRef([]);
  const [filesTrigger, setFilesTrigger] = useState(0); 

  // --- SUB-STATES: FEATURES ---
  const [searchQuery, setSearchQuery] = useState('');
  const [explorerPath, setExplorerPath] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery); 
  const [authMode, setAuthMode] = useState('login'); 
  const [authForm, setAuthForm] = useState({ email: '', password: '', adminKey: '' });
  const [authError, setAuthError] = useState('');
  const [isAuthProcessing, setIsAuthProcessing] = useState(false);
  const [uploadData, setUploadData] = useState({ name: '', capacity: HDD_CAPACITIES[1].value, error: '' });
  const [replacingHdd, setReplacingHdd] = useState(null);
  const [localScan, setLocalScan] = useState({ files: null, name: '' });
  const [auditState, setAuditState] = useState({ data: null, isAuditing: false, filter: 'All' });
  const [duplicates, setDuplicates] = useState({ data: { groups: [], wasted: 0 }, isCalculating: false, selected: new Set() });
  const [editingCapacityId, setEditingCapacityId] = useState(null);
  
  // Refs untuk File Input
  const fileInputRef = useRef(null);
  const replaceFileInputRef = useRef(null);
  const localFileInputRef = useRef(null);

  // ============================================================================
  // EFFECTS: SUPABASE SUBSCRIPTIONS & AUTH
  // ============================================================================
  useEffect(() => {
    const fetchRole = async (userId) => {
      try {
        const { data } = await supabase.from('users').select('role').eq('id', userId).single();
        setUserRole(data?.role || 'viewer');
      } catch (err) { setUserRole('viewer'); }
      finally { setIsDbLoading(false); }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchRole(session.user.id);
      else setIsDbLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchRole(session.user.id);
      else setIsDbLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const fetchHdds = async () => { const { data } = await supabase.from('hdds').select('*'); if (data) setHdds(data); };
    fetchHdds();
    const sub = supabase.channel('hdds_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'hdds' }, fetchHdds).subscribe();
    return () => supabase.removeChannel(sub);
  }, [user]);

  useEffect(() => {
    if (userRole !== 'admin') return;
    const fetchAdminData = async () => {
      const [{ data: u }, { data: l }] = await Promise.all([
        supabase.from('users').select('*'),
        supabase.from('logs').select('*').order('timestamp', { ascending: false })
      ]);
      if (u) setUsersList(u); if (l) setLogs(l);
    };
    fetchAdminData();
    const uSub = supabase.channel('users_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchAdminData).subscribe();
    const lSub = supabase.channel('logs_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'logs' }, fetchAdminData).subscribe();
    return () => { supabase.removeChannel(uSub); supabase.removeChannel(lSub); };
  }, [userRole]);

  // CHUNK SYNCHRONIZER (Optimasi RAM)
  useEffect(() => {
    if (!user) return;
    if (!hdds.length) {
      if (filesRef.current.length) { filesRef.current = []; loadedChunksRef.current.clear(); setFilesTrigger(p => p + 1); }
      setIsFilesSyncing(false); return;
    }

    let isMounted = true;
    const sync = async () => {
      const required = new Set(hdds.flatMap(h => h.chunkIds || []));
      let hasChanges = false;
      
      for (const [id] of loadedChunksRef.current.entries()) {
        if (!required.has(id)) { loadedChunksRef.current.delete(id); hasChanges = true; }
      }

      const missing = [...required].filter(id => !loadedChunksRef.current.has(id));
      if (missing.length > 0) {
        setIsFilesSyncing(true); setDownloadProgress({ current: 0, total: missing.length });
        let done = 0;
        for (let i = 0; i < missing.length; i += 25) {
          if (!isMounted) return;
          const batch = missing.slice(i, i + 25);
          const { data } = await supabase.from('file_chunks').select('*').in('id', batch);
          if (data) data.forEach(c => loadedChunksRef.current.set(c.id, c.files || []));
          done += batch.length;
          if (isMounted) setDownloadProgress({ current: done, total: missing.length });
        }
        hasChanges = true;
      }

      if (hasChanges && isMounted) {
        filesRef.current = Array.from(loadedChunksRef.current.values()).flat();
        setFilesTrigger(p => p + 1);
      }
      if (isMounted) setIsFilesSyncing(false);
    };
    sync();
    return () => { isMounted = false; };
  }, [hdds, user]);

  // HITUNG DUPLIKAT BACKGROUND
  useEffect(() => {
    if (isFilesSyncing || !filesRef.current.length) {
      if (!filesRef.current.length && duplicates.data.groups.length) setDuplicates(p => ({ ...p, data: { groups: [], wasted: 0 }}));
      return;
    }
    
    let cancelled = false;
    setDuplicates(p => ({ ...p, isCalculating: true }));
    
    const calc = async () => {
      await new Promise(r => setTimeout(r, 300));
      const map = new Map(), cache = new Map(), CHUNK = 20000;
      
      for (let i = 0; i < filesRef.current.length; i += CHUNK) {
        if (cancelled) return;
        const end = Math.min(i + CHUNK, filesRef.current.length);
        for (let j = i; j < end; j++) {
          const f = filesRef.current[j];
          if (f.size === 0) continue;
          
          let context = cache.get(f.vPath);
          if (!context) {
            const parts = (f.vPath||'').split('\\').filter(Boolean);
            context = 'root';
            for (let k = parts.length - 1; k >= 0; k--) {
              if (!isGenericCameraFolder(parts[k])) { context = parts[k].toLowerCase().trim(); break; }
            }
            if (context === 'root' && parts.length) context = parts[0].toLowerCase().trim();
            cache.set(f.vPath, context);
          }
          
          const key = `${f.name.toLowerCase()}_${f.size}_${context}`;
          if (!map.has(key)) map.set(key, []);
          map.get(key).push(f);
        }
        await new Promise(r => setTimeout(r, 5));
      }
      
      if (cancelled) return;
      const groups = [], wasted = [];
      for (const files of map.values()) {
        if (files.length > 1) { groups.push(files); wasted.push(files[0].size * (files.length - 1)); }
      }
      groups.sort((a, b) => (b[0].size * (b.length - 1)) - (a[0].size * (a.length - 1)));
      setDuplicates(p => ({ ...p, isCalculating: false, data: { groups, wasted: wasted.reduce((a,b)=>a+b,0) } }));
    };
    calc();
    return () => { cancelled = true; };
  }, [filesTrigger, isFilesSyncing]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthProcessing(true);

    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: authForm.email,
          password: authForm.password
        });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: authForm.email,
          password: authForm.password
        });
        if (error) throw error;

        const role = authForm.adminKey === 'BREAKER2026' ? 'admin' : 'viewer';
        
        if (data?.user) {
          await supabase.from('users').insert({
            id: data.user.id,
            email: authForm.email,
            role: role,
            createdAt: new Date().toISOString()
          });
          setUserRole(role);
        }
      }
    } catch (err) {
      setAuthError("Autentikasi gagal: " + (err.message || "Pastikan kredensial benar."));
    } finally {
      setIsAuthProcessing(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!authForm.email) {
      setAuthError("Masukkan email Anda terlebih dahulu untuk memulihkan kata sandi.");
      return;
    }
    setIsAuthProcessing(true);
    setAuthError('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(authForm.email);
      if (error) throw error;
      alert(`Tautan pemulihan kata sandi telah dikirim ke ${authForm.email}. Silakan periksa Kotak Masuk (Inbox) atau folder Spam Anda.`);
    } catch (err) {
      setAuthError("Gagal mengirim email pemulihan: " + (err.message || "Error server"));
    } finally {
      setIsAuthProcessing(false);
    }
  };

  // ============================================================================
  // GLOBAL METRICS & COMPUTATIONS
  // ============================================================================
  const globalStats = useMemo(() => {
    const totalFiles = hdds.reduce((a, h) => a + (Number(h.fileCount) || 0), 0);
    const totalSize = hdds.reduce((a, h) => a + (Number(h.totalSize) || 0), 0);
    const cap = hdds.reduce((a, h) => a + (Number(h.capacity) || HDD_CAPACITIES[1].value), 0);
    return { files: totalFiles, size: totalSize, capacity: cap, free: Math.max(cap - totalSize, 0), percent: cap ? Math.min((totalSize/cap)*100,100) : 0 };
  }, [hdds]);

  const explorerData = useMemo(() => {
    if (!filesRef.current.length) return { folders: [], files: [] };
    const query = deferredSearchQuery.trim().toLowerCase();
    
    if (query) {
      const mFiles = [], mFolders = new Map();
      for (let i = 0; i < filesRef.current.length; i++) {
        const f = filesRef.current[i];
        if (f.name.toLowerCase().includes(query) && mFiles.length < 500) mFiles.push(f);
        if (f.vPath && mFolders.size < 200 && f.vPath.toLowerCase().includes(query)) {
          const parts = f.vPath.split('\\'); let acc = '';
          for (let p of parts) { if(!p)continue; acc = acc ? `${acc}\\${p}` : p; if(p.toLowerCase().includes(query)) mFolders.set(acc, p); }
        }
      }
      return { folders: Array.from(mFolders.entries()).map(([path, name]) => ({ path, name })), files: mFiles };
    }

    const map = new Map(), mFiles = [], norm = explorerPath.replace(/\\/g, '\\').replace(/\\\\$/, '');
    const prefix = norm ? norm + '\\' : '';
    
    for (let i = 0; i < filesRef.current.length; i++) {
      const f = filesRef.current[i], v = f.vPath || '';
      if (v === norm) { if (mFiles.length < 2000) mFiles.push(f); }
      else if (!prefix || v.startsWith(prefix)) {
        const next = (norm ? v.substring(norm.length + 1) : v).split('\\')[0];
        if (next && !map.has(next)) map.set(next, norm ? `${norm}\\${next}` : next);
      }
    }
    return { folders: Array.from(map.entries()).map(([name, path]) => ({ name, path })), files: mFiles };
  }, [filesTrigger, deferredSearchQuery, explorerPath]);

  // ============================================================================
  // HANDLERS: CLOUD, UPLOAD & ACTIONS
  // ============================================================================
  const processUpload = async (filesArray, replaceExisting = null) => {
    if (!filesArray.length) return;
    setIsProcessing(true); setUploadProgress(0); setUploadData(p => ({...p, error: ''}));
    
    try {
      for (let fi = 0; fi < filesArray.length; fi++) {
        const file = filesArray[fi];
        let hddName = replaceExisting ? replaceExisting.name : (uploadData.name.trim() || file.name.replace(/\.[^/.]+$/, ""));
        
        if (!replaceExisting) {
          const exists = hdds.find(h => h.name.toLowerCase() === hddName.toLowerCase());
          if (exists) {
            if (!window.confirm(`HDD "${exists.name}" sudah ada. Timpa (Replace)?`)) continue;
            replaceExisting = exists;
          }
        }

        if (replaceExisting) {
          setProcessingMsg(`Menghapus data lama ${replaceExisting.name}...`);
          const toDel = replaceExisting.chunkIds || [];
          for (let i = 0; i < toDel.length; i += 15) {
            const b = toDel.slice(i, i + 15);
            await supabase.from('file_chunks').delete().in('id', b);
            b.forEach(id => loadedChunksRef.current.delete(id));
          }
        }

        setProcessingMsg(`Memproses file ${fi + 1}/${filesArray.length}: ${hddName}...`);
        setUploadProgress(40);
        
        const parsed = parseHTML(await file.text());
        if (!parsed.length) continue;

        const hddId = replaceExisting ? replaceExisting.id : generateId();
        const newHdd = {
          id: hddId, name: hddName, capacity: replaceExisting?.capacity || uploadData.capacity,
          fileCount: parsed.length, totalSize: parsed.reduce((a, f) => a + f.size, 0),
          dateAdded: replaceExisting?.dateAdded || new Date().toLocaleDateString(),
          lastUpdated: new Date().toISOString(), warningMuted: replaceExisting?.warningMuted || false
        };

        const chunks = []; const chunkIds = [];
        for (let i = 0; i < parsed.length; i += 800) {
          const cid = generateId(); chunkIds.push(cid);
          chunks.push({ id: cid, hddId, files: parsed.slice(i, i + 800).map(f => ({ ...f, hddId, hddName, vPath: getVirtualPath(f.path, hddName), chunkId: cid })) });
        }

        let done = 0;
        for (let i = 0; i < chunks.length; i += 15) {
          const b = chunks.slice(i, i + 15);
          const { error } = await supabase.from('file_chunks').insert(b);
          if (error) throw error;
          done += b.length; setUploadProgress(40 + Math.round((done / chunks.length) * 50));
        }

        await supabase.from('hdds').upsert({ ...newHdd, chunkIds });
        await supabase.from('logs').insert({
          id: generateId(), userId: user.id, userEmail: user.email, action: replaceExisting ? 'REPLACE_HDD' : 'UPLOAD_HDD',
          details: `${replaceExisting ? 'Memperbarui' : 'Menambah'} HDD: ${hddName} (${parsed.length} file)`, timestamp: new Date().toISOString()
        });
        setUploadProgress(100); replaceExisting = null; // reset for next file
      }
      setUploadData(p => ({...p, name: ''}));
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (replaceFileInputRef.current) replaceFileInputRef.current.value = '';
      setTimeout(() => { setIsProcessing(false); setActiveTab('dashboard'); }, 1000);
    } catch (err) {
      setUploadData(p => ({...p, error: String(err)})); setIsProcessing(false);
    }
  };

  const handleAudit = async () => {
    setAuditState(p => ({ ...p, isAuditing: true }));
    try {
      const res = await fetch(FIXED_SHEET_URL);
      if (!res.ok) throw new Error("Link Sheet gagal diakses.");
      const rows = (await res.text()).split('\n').map(r => r.split(',')[0]?.replace(/"/g, '').trim())
        .filter(r => r && r.length > 2 && !['nama project', 'project'].includes(r.toLowerCase()) && !r.toLowerCase().endsWith(' - breaker'));

      const map = new Map();
      filesRef.current.forEach(f => { if (f.vPath) map.set(f.vPath.toLowerCase(), f.vPath); });
      const allPaths = Array.from(map.entries());

      const data = rows.map(p => {
        const lower = p.toLowerCase();
        let cat = lower.endsWith(' - video') ? 'Video' : lower.endsWith(' - von') ? 'Visual' : lower.endsWith(' - isadaya') ? 'Isadaya' : 'Lainnya';
        const matches = allPaths.filter(([lp]) => lp.includes(lower)).sort((a,b) => a[0].length - b[0].length);
        return { name: p, category: cat, isFound: matches.length > 0, foundPath: matches[0]?.[1] || null };
      });
      setAuditState({ data, isAuditing: false, filter: auditState.filter });
    } catch (e) { alert(e.message); setAuditState(p => ({ ...p, isAuditing: false })); }
  };

  const handleLocalCheck = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setIsProcessing(true); setProcessingMsg("Mencocokkan file...");
    try {
      const parsed = parseHTML(await file.text());
      setLocalScan({ files: parsed, name: file.name });
    } catch (e) { alert("File tidak valid."); }
    finally { setIsProcessing(false); if (localFileInputRef.current) localFileInputRef.current.value = ''; }
  };

  const executeDeleteDuplicates = async () => {
    if (!window.confirm(`Hapus ${duplicates.selected.size} file ini secara permanen dari Cloud?`)) return;
    setIsProcessing(true); setProcessingMsg("Menghapus duplikat dari server...");
    try {
      const toDel = filesRef.current.filter(f => duplicates.selected.has(f.id));
      const chunksMap = new Map();
      toDel.forEach(f => { if (!chunksMap.has(f.chunkId)) chunksMap.set(f.chunkId, new Set()); chunksMap.get(f.chunkId).add(f.id); });

      let done = 0;
      for (const [cId, ids] of chunksMap.entries()) {
        const fresh = filesRef.current.filter(f => f.chunkId === cId && !ids.has(f.id));
        loadedChunksRef.current.set(cId, fresh);
        await supabase.from('file_chunks').update({ files: fresh }).eq('id', cId);
        setUploadProgress(Math.round((++done / chunksMap.size) * 100));
      }

      const affectedHdds = new Set(toDel.map(f => f.hddId));
      for (const hId of affectedHdds) {
        const fresh = filesRef.current.filter(f => f.hddId === hId && !duplicates.selected.has(f.id));
        await supabase.from('hdds').update({ fileCount: fresh.length, totalSize: fresh.reduce((a,f)=>a+f.size,0) }).eq('id', hId);
      }

      await supabase.from('logs').insert({ id: generateId(), userId: user.id, userEmail: user.email, action: 'DELETE_DUPLICATES', details: `Menghapus ${toDel.length} duplikat`, timestamp: new Date().toISOString() });
      
      filesRef.current = Array.from(loadedChunksRef.current.values()).flat();
      setFilesTrigger(p => p + 1); setDuplicates(p => ({ ...p, selected: new Set() }));
      alert("Duplikat berhasil dihapus!");
    } catch (e) { alert("Gagal sinkronisasi penghapusan."); }
    finally { setIsProcessing(false); }
  };

  const toggleHddWarning = async (hdd) => {
    try {
      const newMutedState = !hdd.warningMuted;
      await supabase.from('hdds').update({ warningMuted: newMutedState }).eq('id', hdd.id);
      await supabase.from('logs').insert({ id: generateId(), userId: user.id, userEmail: user.email, action: newMutedState ? 'MUTE_WARNING' : 'UNMUTE_WARNING', details: `${newMutedState ? 'Mematikan' : 'Menyalakan'} peringatan usang untuk HDD: ${hdd.name}`, timestamp: new Date().toISOString() });
    } catch (err) { alert("Gagal mengubah status peringatan."); }
  };

  const updateHddCapacity = async (hddId, newCapacity) => {
    try {
      await supabase.from('hdds').update({ capacity: Number(newCapacity) }).eq('id', hddId);
      await supabase.from('logs').insert({ id: generateId(), userId: user.id, userEmail: user.email, action: 'UPDATE_CAPACITY', details: `Mengubah limit ukuran kapasitas fisik HDD.`, timestamp: new Date().toISOString() });
    } catch (err) { alert("Gagal mengupdate kapasitas HDD."); } 
    finally { setEditingCapacityId(null); }
  };

  const removeHdd = async (hddId) => {
    if(!window.confirm("Apakah Anda yakin ingin menghapus HDD ini secara permanen dari CLOUD?")) return;
    setIsProcessing(true); setProcessingMsg("Menghapus dari server..."); setUploadProgress(0);
    try {
      const hddToDelete = hdds.find(h => h.id === hddId);
      const chunkIdsToDelete = hddToDelete?.chunkIds || [];
      
      let processed = 0;
      for (let i = 0; i < chunkIdsToDelete.length; i += 20) {
        const batchIds = chunkIdsToDelete.slice(i, i + 20);
        await supabase.from('file_chunks').delete().in('id', batchIds);
        batchIds.forEach(cid => loadedChunksRef.current.delete(cid));
        processed += batchIds.length;
        setUploadProgress(Math.round((processed / chunkIdsToDelete.length) * 100));
      }
      
      await supabase.from('hdds').delete().eq('id', hddId);
      await supabase.from('logs').insert({ id: generateId(), userId: user.id, userEmail: user.email, action: 'DELETE_HDD', details: `Menghapus HDD: ${hddToDelete?.name}`, timestamp: new Date().toISOString() });
      
      filesRef.current = Array.from(loadedChunksRef.current.values()).flat();
      setFilesTrigger(p => p + 1); setUploadProgress(100);
    } catch (error) { alert(`Gagal menghapus HDD: ${error.message}`); } 
    finally { setIsProcessing(false); setProcessingMsg(''); setUploadProgress(0); }
  };

  const exportHddToHTML = (hdd) => {
    const hddFiles = filesRef.current.filter(f => f.hddId === hdd.id);
    const dirsMap = {};
    hddFiles.forEach(f => {
      const path = f.path.replace(/\\/g, '\\');
      if(!dirsMap[path]) dirsMap[path] = [];
      dirsMap[path].push({ n: f.name, s: f.size, d: f.date });
    });
    const dirsArr = Object.keys(dirsMap).map(path => ({ path, files: dirsMap[path] }));
    const jsonStr = JSON.stringify(dirsArr);
    
    const htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Breaker HDD Manager Export - ${hdd.name}</title><style>body{font-family:sans-serif; padding:40px; background:#f0f2f5;} .box{background:#fff; padding:20px; border-radius:8px; box-shadow:0 2px 4px rgba(0,0,0,0.1);}</style></head><body><div class="box"><h2>Database HDD: ${hdd.name}</h2><p>File ini telah diperbarui dan diekspor oleh Breaker HDD Manager.</p></div><script>var dirs = ${jsonStr};</script></body></html>`;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `Update_${hdd.name.replace(/\s+/g, '_')}.html`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const updateUserRole = async (targetUid, targetEmail, newRole) => {
    if (userRole !== 'admin') return;
    if (!window.confirm(`Ubah role untuk ${targetEmail} menjadi ${newRole.toUpperCase()}?`)) return;
    try {
      await supabase.from('users').update({ role: newRole }).eq('id', targetUid);
      await supabase.from('logs').insert({ id: generateId(), userId: user.id, userEmail: user.email, action: 'CHANGE_ROLE', details: `Mengubah akses ${targetEmail} menjadi ${newRole}`, timestamp: new Date().toISOString() });
      alert('Role berhasil diperbarui!');
    } catch (err) { alert('Terjadi kesalahan saat mengubah role.'); }
  };

  const deleteUserAccount = async (targetUid, targetEmail) => {
    if (userRole !== 'admin') return;
    if (targetUid === user.id) { alert("Anda tidak dapat menghapus akun Anda sendiri!"); return; }
    if (!window.confirm(`PERINGATAN: Apakah Anda yakin ingin mencabut akses sistem untuk ${targetEmail}?`)) return;
    try {
      await supabase.from('users').delete().eq('id', targetUid);
      await supabase.from('logs').insert({ id: generateId(), userId: user.id, userEmail: user.email, action: 'DELETE_USER', details: `Menghapus akses pengguna: ${targetEmail}`, timestamp: new Date().toISOString() });
      alert('Akses pengguna berhasil dicabut dari sistem!');
    } catch (err) { alert('Terjadi kesalahan saat menghapus pengguna.'); }
  };

  const smartSelectDuplicates = () => {
    const newSet = new Set(duplicates.selected);
    duplicates.data.groups.forEach(group => { for (let i = 1; i < group.length; i++) newSet.add(group[i].id); });
    setDuplicates(p => ({ ...p, selected: newSet }));
  };

  const generateBatScript = () => {
    if (duplicates.selected.size === 0) return;
    let scriptContent = `@echo off\r\necho Peringatan: Script ini akan menghapus ${duplicates.selected.size} file.\r\npause\r\n\r\n`;
    const filesToDelete = filesRef.current.filter(f => duplicates.selected.has(f.id));
    const byHdd = {};
    filesToDelete.forEach(f => { if(!byHdd[f.hddName]) byHdd[f.hddName] = []; byHdd[f.hddName].push(f); });

    Object.keys(byHdd).forEach(hdd => {
      scriptContent += `echo Menghapus dari HDD: ${hdd}...\r\n`;
      byHdd[hdd].forEach(file => {
        let fullPath = file.path.endsWith('\\') || file.path.endsWith('/') ? `${file.path}${file.name}` : `${file.path}\\${file.name}`;
        scriptContent += `del /F /Q "${fullPath.replace(/\//g, '\\')}"\r\n`;
      });
      scriptContent += `echo.\r\n`;
    });
    scriptContent += `echo Selesai!\r\npause\r\n`;

    const blob = new Blob([scriptContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'hapus_duplikat.bat';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  // Local Check Helpers
  const getDuplicateKey = (f) => `${f.name.toLowerCase()}_${f.size}`;
  const localCheckResults = useMemo(() => {
    if (!localScan.files) return null;
    const cloudMap = new Map();
    filesRef.current.forEach(f => { if (f.size === 0) return; const key = getDuplicateKey(f); if (!cloudMap.has(key)) cloudMap.set(key, []); cloudMap.get(key).push(f); });

    const dups = [], uniq = []; let wasted = 0;
    localScan.files.forEach(lf => {
      if (lf.size === 0) return;
      const key = getDuplicateKey(lf);
      if (cloudMap.has(key)) { dups.push({ local: lf, cloud: cloudMap.get(key) }); wasted += lf.size; } 
      else { uniq.push(lf); }
    });
    dups.sort((a, b) => b.local.size - a.local.size);
    return { duplicates: dups, unique: uniq, wastedSpace: wasted };
  }, [localScan.files, filesTrigger]);

  const displayedAudit = useMemo(() => {
    if (!auditState.data) return null;
    const filtered = auditState.filter === 'All' ? auditState.data : auditState.data.filter(d => d.category === auditState.filter);
    const naturalSort = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    return { missing: filtered.filter(d => !d.isFound).sort(naturalSort), found: filtered.filter(d => d.isFound).sort(naturalSort) };
  }, [auditState.data, auditState.filter]);


  // ============================================================================
  // RENDERERS UNTUK HALAMAN (TABS)
  // ============================================================================
  const renderDashboard = () => (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <header><h2 className="text-3xl font-bold text-white">Dashboard Cloud</h2><p className="text-slate-400">Ringkasan analitik seluruh aset HDD Studio.</p></header>
      
      <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
        <div className="flex justify-between items-end mb-3">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2"><Database size={20} className="text-indigo-400"/> Kapasitas Total Studio</h3>
            <p className="text-xs text-slate-400 mt-1">{hdds.length} Hard Disk terhubung ke Cloud</p>
          </div>
          <div className="text-right">
            <p className="font-bold text-white">{formatBytes(globalStats.size)} <span className="text-slate-500 font-medium text-sm">/ {formatBytes(globalStats.capacity)}</span></p>
            <p className="text-xs text-slate-400">Sisa Kosong: <span className="text-emerald-400 font-bold">{formatBytes(globalStats.free)}</span></p>
          </div>
        </div>
        <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden shadow-inner border border-slate-800">
          <div className={`h-full transition-all duration-1000 ${globalStats.percent > 90 ? 'bg-red-500' : globalStats.percent > 75 ? 'bg-orange-500' : 'bg-indigo-500'}`} style={{width: `${globalStats.percent}%`}} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg">
          <div className="flex items-center gap-3 text-indigo-400 mb-3"><HardDrive size={24} /><h3 className="font-semibold text-slate-200">Total HDD</h3></div>
          <p className="text-4xl font-bold text-white">{hdds.length}</p>
        </div>
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg">
          <div className="flex items-center gap-3 text-emerald-400 mb-3"><Files size={24} /><h3 className="font-semibold text-slate-200">Total File</h3></div>
          <p className="text-4xl font-bold text-white">{globalStats.files.toLocaleString()}</p>
        </div>
        <div className="bg-slate-800 p-6 rounded-2xl border border-red-900/50 shadow-lg relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-red-500/20 rounded-full blur-3xl"></div>
          <div className="flex items-center gap-3 text-red-400 mb-3 relative z-10"><Trash2 size={24} /><h3 className="font-semibold text-slate-200">Ruang Terbuang</h3></div>
          <p className="text-4xl font-bold text-red-400 relative z-10">{isFilesSyncing ? <Loader2 size={28} className="animate-spin" /> : formatBytes(duplicates.data.wasted)}</p>
        </div>
      </div>
      {hdds.length === 0 && !isFilesSyncing && (
        <div className="bg-indigo-900/20 border border-indigo-800 p-8 rounded-2xl text-center">
          <Info size={48} className="text-indigo-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Cloud Kosong</h3>
          <p className="text-slate-400 mb-6">Mulai unggah data HTML Snap2HTML ke dalam sistem ini.</p>
          {(userRole === 'admin' || userRole === 'editor') && <button onClick={() => setActiveTab('hdds')} className="bg-indigo-600 hover:bg-indigo-500 px-6 py-2 rounded-lg text-white font-bold transition-colors">Kelola HDD</button>}
        </div>
      )}
    </div>
  );

  const renderExplorer = () => (
    <div className="max-w-6xl mx-auto h-full flex flex-col animate-in fade-in slide-in-from-bottom-4">
      <header className="mb-6"><h2 className="text-3xl font-bold text-white mb-2">Penjelajah Global</h2><p className="text-slate-400">Cari dan jelajahi semua file dari seluruh HDD.</p></header>
      <div className="flex-1 bg-slate-800 border border-slate-700 rounded-2xl flex flex-col overflow-hidden shadow-xl">
        <div className="bg-slate-900/50 border-b border-slate-700 p-4 flex flex-col md:flex-row items-center gap-4">
          <div className="flex w-full md:w-auto items-center gap-2 overflow-hidden">
            <button onClick={() => setExplorerPath(explorerPath.split('\\').slice(0, -1).join('\\'))} disabled={!explorerPath || !!searchQuery} className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-600 disabled:opacity-50"><ArrowLeft size={16} /></button>
            <div className="flex-1 bg-slate-800 border border-slate-600 rounded-lg flex items-center px-3 py-2 gap-2 overflow-x-auto whitespace-nowrap scrollbar-hide">
              {searchQuery ? <span className="text-sm text-slate-400 italic">Pencarian: "{searchQuery}"</span> : (
                <><button onClick={() => setExplorerPath('')} className="text-slate-400 hover:text-white"><Home size={16} /></button><span className="text-slate-600">/</span>
                  {explorerPath.split('\\').filter(Boolean).map((p, i, a) => (
                    <React.Fragment key={i}><button onClick={() => setExplorerPath(a.slice(0, i+1).join('\\'))} className="text-sm font-medium text-indigo-400 hover:text-indigo-300">{p}</button>{i < a.length -1 && <span className="text-slate-600">\</span>}</React.Fragment>
                  ))}
                </>
              )}
            </div>
          </div>
          <div className="relative w-full md:w-64"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Cari file global..." className="w-full pl-9 pr-8 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white focus:ring-indigo-500 focus:border-indigo-500" />{searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 bg-slate-700 rounded-full p-0.5"><X size={12} /></button>}</div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {isFilesSyncing ? <div className="h-full flex flex-col items-center justify-center text-indigo-400"><Loader2 size={48} className="animate-spin mb-4" /><p>Sinkronisasi Server...</p></div> : 
           !explorerData.folders.length && !explorerData.files.length ? <div className="h-full flex flex-col items-center justify-center text-slate-500"><FolderIcon size={48} className="mb-4 opacity-50" /><p>Kosong</p></div> :
           <div className="grid grid-cols-1 md:grid-cols-3 gap-3 content-start">
             {explorerData.folders.map(f => <div key={`f-${f.path}`} onClick={() => { setExplorerPath(f.path); setSearchQuery(''); }} className="flex items-center gap-3 p-3 bg-slate-800 border border-slate-700 hover:border-indigo-500 rounded-xl cursor-pointer group"><FolderIcon size={24} className="text-indigo-400 group-hover:scale-110 transition-transform" /><div className="flex-1 min-w-0"><span className="text-sm font-medium text-slate-200 truncate block">{f.name}</span></div></div>)}
             {explorerData.files.map(f => <div key={f.id} className="flex items-center gap-3 p-3 bg-slate-800/50 border border-slate-700/50 rounded-xl"><FileIcon size={24} className="text-slate-500 shrink-0" /><div className="flex-1 min-w-0"><div className="flex items-center gap-2"><p className="text-sm font-medium text-slate-300 truncate">{f.name}</p><span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-1.5 rounded">{f.hddName}</span></div><p className="text-[11px] text-slate-500">{formatBytes(f.size)}</p></div>{searchQuery && <button onClick={() => { setExplorerPath(f.vPath); setSearchQuery(''); }} className="p-2 text-slate-400 hover:text-indigo-400"><FolderOpen size={18} /></button>}</div>)}
           </div>
          }
        </div>
      </div>
    </div>
  );

  const renderManageHDDs = () => (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <header><h2 className="text-3xl font-bold text-white mb-2">Kelola Hard Disk</h2><p className="text-slate-400">Sinkronkan struktur HDD fisik Anda ke Cloud.</p></header>
      <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><UploadCloud className="text-indigo-400"/> Upload File Snap2HTML</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div><label className="block text-sm text-slate-400 mb-1">Label (Opsional)</label><input type="text" value={uploadData.name} onChange={e => setUploadData(p => ({...p, name: e.target.value}))} placeholder="Otomatis dari nama file..." className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white" /></div>
          <div><label className="block text-sm text-slate-400 mb-1">Kapasitas Fisik</label><select value={uploadData.capacity} onChange={e => setUploadData(p => ({...p, capacity: Number(e.target.value)}))} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white">{HDD_CAPACITIES.map(c => <option key={c.label} value={c.value}>{c.label}</option>)}</select></div>
        </div>
        <div className="border-2 border-dashed border-slate-600 hover:border-indigo-500 bg-slate-900/50 rounded-xl p-8 text-center cursor-pointer group" onClick={() => fileInputRef.current?.click()}>
          <input type="file" multiple accept=".html,.htm" className="hidden" ref={fileInputRef} onChange={e => processUpload(Array.from(e.target.files))} />
          <Cloud size={40} className="mx-auto text-slate-500 group-hover:text-indigo-400 mb-3" />
          <p className="text-slate-300 font-medium">Klik untuk memilih file HTML (Bisa Multi-upload)</p>
        </div>
        {uploadData.error && <div className="mt-4 bg-red-900/30 p-3 text-red-400 text-sm rounded-lg flex items-center gap-2"><AlertCircle size={16}/> {uploadData.error}</div>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input type="file" accept=".html,.htm" className="hidden" ref={replaceFileInputRef} onChange={e => processUpload([e.target.files[0]], replacingHdd)} />
        {hdds.map(hdd => {
          const daysOld = getDaysOld(hdd.lastUpdated || hdd.dateAdded);
          const usedP = Math.min((hdd.totalSize / (hdd.capacity||1)) * 100, 100);
          return (
            <div key={hdd.id} className="bg-slate-800 border border-slate-700 p-5 rounded-xl group hover:border-slate-500">
              <div className="flex items-center gap-4 mb-3">
                <div className={`p-3 rounded-lg ${daysOld >= 7 && !hdd.warningMuted ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-700 text-indigo-400'}`}><HardDrive size={24} /></div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-white flex items-center gap-2">{hdd.name} {daysOld >= 7 && !hdd.warningMuted && <span className="bg-orange-500/20 text-orange-400 text-[10px] px-1.5 rounded flex items-center"><AlertTriangle size={10}/> Usang</span>}</h4>
                  <p className="text-xs text-slate-400">{Number(hdd.fileCount).toLocaleString()} file | Diupdate: {new Date(hdd.lastUpdated || hdd.dateAdded).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-1">
                  {daysOld >= 7 && <button onClick={() => toggleHddWarning(hdd)} className="p-2 text-slate-400 hover:text-orange-400">{hdd.warningMuted ? <BellOff size={16}/> : <Bell size={16}/>}</button>}
                  <button onClick={() => { setReplacingHdd(hdd); replaceFileInputRef.current?.click(); }} className="p-2 text-slate-400 hover:text-emerald-400"><RefreshCw size={16}/></button>
                  <button onClick={() => exportHddToHTML(hdd)} className="p-2 text-slate-400 hover:text-indigo-400"><FileOutput size={16}/></button>
                  <button onClick={() => removeHdd(hdd.id)} className="p-2 text-slate-400 hover:text-red-400"><Trash2 size={16}/></button>
                </div>
              </div>
              <div className="bg-slate-900/50 p-3 rounded-lg">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>{formatBytes(hdd.totalSize)} Terpakai</span>
                  {editingCapacityId === hdd.id ? <select autoFocus onBlur={()=>setEditingCapacityId(null)} onChange={e=>updateHddCapacity(hdd.id, e.target.value)} defaultValue={hdd.capacity} className="bg-slate-800 text-white rounded px-1">{HDD_CAPACITIES.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select> : <span onClick={()=>setEditingCapacityId(hdd.id)} className="cursor-pointer hover:text-white flex items-center gap-1">Max: {formatBytes(hdd.capacity||0)} <Pencil size={10}/></span>}
                </div>
                <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden"><div className={`h-full ${usedP>90?'bg-red-500':'bg-indigo-500'}`} style={{width:`${usedP}%`}}/></div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );

  const renderAuditSheet = () => (
    <div className="max-w-6xl mx-auto flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 pb-8">
      <header className="mb-6 flex justify-between items-end">
        <div><h2 className="text-3xl font-bold text-white mb-2">Audit Project</h2><p className="text-slate-400">Sinkronisasi otomatis Sheet Master dengan Cloud.</p></div>
        <div className="flex gap-2">
          {auditState.data && (
            <button onClick={() => {
              const html = `<html><head><title>Laporan Audit</title><style>body{font-family:sans-serif;padding:20px;}</style></head><body><h1>Laporan Audit (${auditState.filter})</h1><p>Aman: ${displayedAudit.found.length} | Hilang: ${displayedAudit.missing.length}</p></body></html>`;
              const w = window.open(); w.document.write(html); w.print();
            }} className="bg-rose-600 hover:bg-rose-500 px-4 py-2 rounded-lg text-white font-bold flex items-center gap-2"><Printer size={16}/> PDF</button>
          )}
          <button onClick={handleAudit} disabled={auditState.isAuditing || isFilesSyncing} className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg text-white font-bold flex items-center gap-2">{auditState.isAuditing ? <Loader2 className="animate-spin"/> : <RefreshCw/>} Refresh</button>
        </div>
      </header>
      {!auditState.data ? (
        <div className="flex-1 bg-slate-800 rounded-2xl flex items-center justify-center text-slate-500"><FileSpreadsheet size={48} className="opacity-50 mb-4"/><p>Klik Refresh untuk memulai audit.</p></div>
      ) : (
        <div className="flex-1 flex flex-col gap-6 min-h-0">
          <div className="flex gap-2 bg-slate-800 p-2 rounded-xl shrink-0">{['All', 'Video', 'Visual', 'Isadaya', 'Lainnya'].map(c => <button key={c} onClick={() => setAuditState(p=>({...p, filter: c}))} className={`px-4 py-1.5 rounded-lg text-sm font-bold ${auditState.filter===c?'bg-indigo-600 text-white':'text-slate-400 hover:bg-slate-700'}`}>{c}</button>)}</div>
          <div className="flex-1 flex gap-6 min-h-0">
            <div className="flex-1 bg-slate-800 border border-red-500/30 rounded-2xl flex flex-col">
              <div className="p-4 border-b border-red-500/20 bg-red-500/10 flex justify-between font-bold text-red-400"><span className="flex items-center gap-2"><AlertTriangle/> Hilang</span> <span className="bg-red-500 text-white px-2 py-0.5 rounded">{displayedAudit?.missing.length}</span></div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">{displayedAudit?.missing.map((p,i) => <div key={i} className="bg-slate-900 p-3 rounded-lg"><p className="text-white text-sm font-medium">{p.name}</p><p className="text-[10px] text-slate-500 uppercase">{p.category}</p></div>)}</div>
            </div>
            <div className="flex-1 bg-slate-800 border border-emerald-500/30 rounded-2xl flex flex-col">
              <div className="p-4 border-b border-emerald-500/20 bg-emerald-500/10 flex justify-between font-bold text-emerald-400"><span className="flex items-center gap-2"><CheckSquare/> Ter-Backup</span> <span className="bg-emerald-500 text-white px-2 py-0.5 rounded">{displayedAudit?.found.length}</span></div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">{displayedAudit?.found.map((p,i) => <div key={i} className="bg-slate-900 p-3 rounded-lg flex justify-between items-center group"><div className="flex-1 min-w-0"><p className="text-white text-sm font-medium truncate">{p.name}</p><p className="text-[10px] text-emerald-500 font-mono mt-1 truncate">{p.foundPath}</p></div><button onClick={()=>{setExplorerPath(p.foundPath);setActiveTab('explorer');}} className="p-2 bg-slate-800 hover:bg-indigo-500 text-slate-400 hover:text-white rounded"><FolderOpen size={16}/></button></div>)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderDuplicates = () => (
    <div className="max-w-6xl mx-auto flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 pb-24">
      <header className="mb-6 flex justify-between items-end">
        <div><h2 className="text-3xl font-bold text-white mb-1">Pencari Duplikat</h2><p className="text-slate-400">Potensi Hemat: <span className="text-red-400">{formatBytes(duplicates.data.wasted)}</span></p></div>
        <div className="flex gap-2"><button onClick={() => setDuplicates(p=>({...p, selected: new Set()}))} className="px-4 py-2 bg-slate-800 rounded-lg text-sm text-slate-300">Batal</button><button onClick={smartSelectDuplicates} className="px-4 py-2 bg-indigo-600 rounded-lg text-sm text-white font-bold flex items-center gap-2"><CheckSquare size={16}/> Pilih Pintar</button></div>
      </header>
      <div className="flex-1 bg-slate-800 rounded-2xl flex flex-col overflow-hidden">
        {duplicates.isCalculating ? <div className="flex-1 flex flex-col items-center justify-center text-indigo-400"><Loader2 size={48} className="animate-spin mb-4"/><p>Menghitung data...</p></div> : 
         !duplicates.data.groups.length ? <div className="flex-1 flex flex-col items-center justify-center text-slate-500"><Search size={48} className="mb-4 opacity-50"/><p>Bersih! Tidak ada duplikat.</p></div> : 
         <div className="flex-1 overflow-y-auto p-4 space-y-3">
           {duplicates.data.groups.slice(0, 200).map((g, i) => (
             <DuplicateGroupItem key={i} group={g} wasted={g[0].size*(g.length-1)} hddsInvolved={[...new Set(g.map(f=>f.hddName))]} selectedFileIds={duplicates.selected} onToggle={id => setDuplicates(p => { const s = new Set(p.selected); s.has(id)?s.delete(id):s.add(id); return {...p, selected: s} })} />
           ))}
         </div>
        }
      </div>
      {duplicates.selected.size > 0 && (
        <div className="absolute bottom-0 right-0 left-64 bg-slate-800 p-4 border-t border-slate-700 flex justify-between items-center z-20">
          <p className="text-white font-bold">{duplicates.selected.size} File Dipilih</p>
          <div className="flex gap-3">
            <button onClick={generateBatScript} className="bg-red-600 hover:bg-red-500 px-6 py-2 rounded-xl text-white font-bold flex items-center gap-2"><Download size={16}/> Script .BAT</button>
            <button onClick={executeDeleteDuplicates} disabled={isProcessing} className="bg-orange-600 hover:bg-orange-500 px-6 py-2 rounded-xl text-white font-bold flex items-center gap-2"><Cloud size={16}/> Hapus DB</button>
          </div>
        </div>
      )}
    </div>
  );

  const renderTutorial = () => (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 pb-12">
      <header>
        <h2 className="text-3xl font-bold text-white mb-2">Panduan Setup & Pembuatan Aplikasi</h2>
        <p className="text-slate-400">Langkah demi langkah untuk pemula mem-publish aplikasi ini dari nol hingga online ke Netlify.</p>
      </header>

      <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl shadow-xl">
        <h3 className="text-xl font-bold text-indigo-400 mb-4 flex items-center gap-2"><Database size={24}/> Tahap 1: Setup Database Supabase</h3>
        <ol className="list-decimal ml-5 space-y-3 text-slate-300 text-sm">
          <li>Buka <a href="https://supabase.com" target="_blank" className="text-indigo-400 hover:underline">Supabase.com</a>, buat akun dan buat <b>New Project</b> (misal: Breaker Cloud).</li>
          <li>Di Dashboard Supabase, masuk ke menu <b>SQL Editor</b> (ikon <code>{"</>"}</code> di kiri).</li>
          <li>Klik <b>New Query</b>, lalu <i>copy-paste</i> kode di bawah ini dan klik <b>Run</b>:</li>
        </ol>
        <pre className="bg-slate-900 p-4 rounded-xl text-xs text-emerald-400 overflow-x-auto mt-4 border border-slate-700">
{`-- Buat Tabel Users
CREATE TABLE users ( id UUID REFERENCES auth.users NOT NULL PRIMARY KEY, email TEXT, role TEXT, "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) );
-- Buat Tabel HDDs
CREATE TABLE hdds ( id TEXT PRIMARY KEY, name TEXT, capacity NUMERIC, "fileCount" NUMERIC, "totalSize" NUMERIC, "dateAdded" TEXT, "lastUpdated" TIMESTAMP WITH TIME ZONE, "warningMuted" BOOLEAN, "chunkIds" JSONB );
-- Buat Tabel File Chunks
CREATE TABLE file_chunks ( id TEXT PRIMARY KEY, "hddId" TEXT, files JSONB );
-- Buat Tabel Logs
CREATE TABLE logs ( id TEXT PRIMARY KEY, "userId" UUID, "userEmail" TEXT, action TEXT, details TEXT, timestamp TIMESTAMP WITH TIME ZONE );

-- Aktifkan Realtime
alter publication supabase_realtime add table hdds;
alter publication supabase_realtime add table users;
alter publication supabase_realtime add table logs;`}
        </pre>
      </div>

      <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl shadow-xl">
        <h3 className="text-xl font-bold text-emerald-400 mb-4 flex items-center gap-2"><Laptop size={24}/> Tahap 2: Siapkan Kode di Komputer</h3>
        <ol className="list-decimal ml-5 space-y-3 text-slate-300 text-sm">
          <li>Pastikan sudah menginstal <b>Node.js</b> dari <a href="https://nodejs.org" target="_blank" className="text-emerald-400 hover:underline">nodejs.org</a>.</li>
          <li>Buka <b>Terminal</b> atau <b>Command Prompt (CMD)</b>, lalu ketik perintah berikut satu per satu (tekan Enter per baris):</li>
        </ol>
        <pre className="bg-slate-900 p-4 rounded-xl text-xs text-sky-300 overflow-x-auto mt-4 border border-slate-700">
{`npm create vite@latest breaker-cloud -- --template react
cd breaker-cloud
npm install
npm install @supabase/supabase-js lucide-react
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p`}
        </pre>
      </div>

      <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl shadow-xl">
        <h3 className="text-xl font-bold text-orange-400 mb-4 flex items-center gap-2"><Files size={24}/> Tahap 3: Pemasangan Kode</h3>
        <ol className="list-decimal ml-5 space-y-3 text-slate-300 text-sm">
          <li>Buka folder <code>breaker-cloud</code> menggunakan <b>Visual Studio Code</b>.</li>
          <li>Buka file <code>tailwind.config.js</code>, dan ganti isinya dengan:</li>
          <pre className="bg-slate-900 p-3 rounded-lg text-xs text-slate-400 my-2">
{`export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
}`}
          </pre>
          <li>Buka <code>src/index.css</code>, hapus semua isinya, ganti dengan:</li>
          <pre className="bg-slate-900 p-3 rounded-lg text-xs text-slate-400 my-2">
{`@tailwind base;
@tailwind components;
@tailwind utilities;`}
          </pre>
          <li>Buka <code>src/App.jsx</code>, hapus isinya dan <b>paste SEMUA kode aplikasi React ini</b> ke dalamnya.</li>
          <li><b>PENTING:</b> Buat file baru bernama <code>.env</code> di luar folder <code>src</code> (sejajar dengan package.json), lalu isi dengan kredensial Supabase Anda:</li>
          <pre className="bg-slate-900 p-3 rounded-lg text-xs text-orange-300 my-2">
{`VITE_SUPABASE_URL=https://rdbbauwvwsazdqdsryjd.supabase.co
VITE_SUPABASE_ANON_KEY=sb_secret_VtrmkX0W8fnZL_QK7pXV4...`}
          </pre>
        </ol>
      </div>

      <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl shadow-xl">
        <h3 className="text-xl font-bold text-rose-400 mb-4 flex items-center gap-2"><Cloud size={24}/> Tahap 4: Upload ke GitHub & Netlify</h3>
        <ol className="list-decimal ml-5 space-y-3 text-slate-300 text-sm">
          <li>Buat repositori baru di <b>GitHub.com</b>.</li>
          <li>Kembali ke Terminal (pastikan masih di dalam folder breaker-cloud), lalu jalankan:</li>
          <pre className="bg-slate-900 p-3 rounded-lg text-xs text-slate-400 my-2">
{`git init
git add .
git commit -m "Versi 1.0"
git branch -M main
git remote add origin https://github.com/USERNAME_ANDA/breaker-cloud.git
git push -u origin main`}
          </pre>
          <li>Buka <b>Netlify.com</b>, login pakai GitHub.</li>
          <li>Pilih <b>Add new site</b> {"->"} <b>Import an existing project</b> {"->"} Pilih repository <code>breaker-cloud</code>.</li>
          <li>Di halaman Site Settings (sebelum klik Deploy), cari tombol <b>Environment Variables</b>. Masukkan Key dan Value persis seperti isi file <code>.env</code> Anda di Tahap 3.</li>
          <li>Klik <b>Deploy Site</b> dan tunggu 1 menit. Aplikasi Anda akan online!</li>
        </ol>
      </div>
    </div>
  );

  const renderUsers = () => (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <header><h2 className="text-3xl font-bold text-white mb-2">Manajemen Pengguna</h2><p className="text-slate-400">Atur peran tim Anda.</p></header>
      <div className="bg-slate-800 rounded-2xl overflow-hidden shadow-xl border border-slate-700">
        <table className="w-full text-left text-sm"><thead className="bg-slate-900/50 text-slate-400 uppercase text-xs"><tr><th className="px-6 py-4">Email</th><th className="px-6 py-4">Role</th><th className="px-6 py-4 text-right">Aksi</th></tr></thead><tbody className="divide-y divide-slate-700/50">
          {usersList.map(u => (
            <tr key={u.id} className="hover:bg-slate-700/30"><td className="px-6 py-4 font-medium text-white"><div className="flex items-center gap-2"><User size={16} className="text-slate-400"/>{u.email}</div></td><td className="px-6 py-4 uppercase text-[10px] font-bold text-indigo-400">{u.role}</td><td className="px-6 py-4 text-right flex justify-end gap-2">
              <select disabled={u.id===user.id} value={u.role||'viewer'} onChange={e=>updateUserRole(u.id,u.email,e.target.value)} className="bg-slate-900 border-slate-600 rounded p-1.5"><option value="viewer">Viewer</option><option value="editor">Editor</option><option value="admin">Admin</option></select>
              <button disabled={u.id===user.id} onClick={()=>deleteUserAccount(u.id,u.email)} className="p-1.5 text-slate-500 hover:text-red-400"><Trash2 size={16}/></button>
            </td></tr>
          ))}
        </tbody></table>
      </div>
    </div>
  );

  const renderLogs = () => (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <header><h2 className="text-3xl font-bold text-white mb-2">Riwayat Sistem</h2><p className="text-slate-400">Log jejak aktivitas di Cloud.</p></header>
      <div className="bg-slate-800 rounded-2xl overflow-hidden shadow-xl border border-slate-700 h-[600px] overflow-y-auto">
        <table className="w-full text-left text-sm"><thead className="bg-slate-900/50 text-slate-400 uppercase text-xs sticky top-0"><tr><th className="px-6 py-4">Waktu</th><th className="px-6 py-4">User</th><th className="px-6 py-4">Aktivitas</th></tr></thead><tbody className="divide-y divide-slate-700/50">
          {logs.map(l => (
            <tr key={l.id} className="hover:bg-slate-700/30"><td className="px-6 py-4 text-slate-400">{new Date(l.timestamp).toLocaleString('id-ID')}</td><td className="px-6 py-4 text-white">{l.userEmail}</td><td className="px-6 py-4 text-slate-300"><b>{l.action}</b><br/><span className="text-xs text-slate-500">{l.details}</span></td></tr>
          ))}
        </tbody></table>
      </div>
    </div>
  );

  const renderLocalCheck = () => (
    <div className="max-w-6xl mx-auto h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 pb-8">
      <header className="mb-6"><h2 className="text-3xl font-bold text-white mb-2">Cek HDD Pribadi (Lokal)</h2><p className="text-slate-400">Pastikan file di HDD Anda sudah ter-backup sebelum dihapus.</p></header>
      {!localScan.files ? (
        <div className="bg-slate-800 p-8 rounded-2xl text-center border-2 border-dashed border-slate-600 hover:border-indigo-500 cursor-pointer" onClick={() => localFileInputRef.current?.click()}>
          <input type="file" accept=".html,.htm" className="hidden" ref={localFileInputRef} onChange={handleLocalCheck} />
          <Laptop size={48} className="mx-auto text-slate-500 mb-4"/>
          <h3 className="text-xl font-bold text-white mb-2">Pilih File Snap2HTML</h3><p className="text-slate-400">File tidak akan diupload ke server, hanya untuk perbandingan lokal.</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="grid grid-cols-4 gap-4 mb-4 shrink-0">
            <div className="bg-slate-800 p-4 rounded-xl"><p className="text-xs text-slate-400">File</p><p className="text-lg font-bold text-white truncate">{localScan.name}</p></div>
            <div className="bg-slate-800 border border-emerald-500/30 p-4 rounded-xl"><p className="text-xs text-emerald-400">File Unik (Baru)</p><p className="text-2xl font-bold text-white">{localCheckResults.unique.length}</p></div>
            <div className="bg-slate-800 border border-red-500/30 p-4 rounded-xl"><p className="text-xs text-red-400">Sudah di Server</p><p className="text-2xl font-bold text-white">{localCheckResults.duplicates.length}</p></div>
            <button onClick={()=>setLocalScan({files:null,name:''})} className="bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold">Reset Cek</button>
          </div>
          <div className="flex-1 bg-slate-800 rounded-xl overflow-hidden flex flex-col">
            <div className="p-3 bg-slate-900/50 border-b border-slate-700 text-sm font-bold text-white">Detail Duplikat (Aman Dihapus)</div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {localCheckResults.duplicates.slice(0,300).map((d,i) => (
                <div key={i} className="bg-slate-900/50 p-3 rounded-lg flex items-center justify-between"><div className="min-w-0"><p className="text-white text-sm font-bold truncate">{d.local.name}</p><p className="text-xs text-slate-500 truncate">{d.local.path}</p></div><div className="text-right shrink-0 ml-4"><p className="text-xs text-emerald-400 font-bold mb-1">Tersimpan di:</p>{d.cloud.map((c,ci)=><div key={ci} className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded inline-block ml-1">{c.hddName}</div>)}</div></div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 font-sans overflow-hidden">
      <div className={`fixed md:static inset-y-0 left-0 z-50 bg-slate-800 border-r border-slate-700 flex flex-col shrink-0 transition-all duration-300 w-64 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-6 border-b border-slate-700 flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-900/50">B</div>
          <div><h1 className="font-black text-white tracking-widest uppercase">Breaker</h1><p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Cloud 2.0</p></div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'explorer', icon: FolderIcon, label: 'Penjelajah' },
            { id: 'check-local', icon: Laptop, label: 'Cek HDD Pribadi' },
            { id: 'audit', icon: FileSpreadsheet, label: 'Audit Project' },
            { id: 'tutorial', icon: BookOpen, label: 'Panduan Setup' },
          ].map(t => (
            <button key={t.id} onClick={() => { setActiveTab(t.id); setIsMobileMenuOpen(false); }} className={`flex w-full items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${activeTab === t.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}>
              <t.icon size={20} /> {t.label}
            </button>
          ))}
          
          {(userRole === 'admin' || userRole === 'editor') && (
            <>
              <div className="h-px bg-slate-700 my-4 mx-2"></div>
              {[
                { id: 'hdds', icon: HardDrive, label: 'Kelola HDD' },
                { id: 'duplicates', icon: Files, label: 'Cari Duplikat' },
              ].map(t => (
                <button key={t.id} onClick={() => { setActiveTab(t.id); setIsMobileMenuOpen(false); }} className={`flex w-full items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${activeTab === t.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}>
                  <t.icon size={20} /> {t.label}
                </button>
              ))}
            </>
          )}

          {userRole === 'admin' && (
            <>
              <div className="h-px bg-slate-700 my-4 mx-2"></div>
              <button onClick={() => { setActiveTab('users'); setIsMobileMenuOpen(false); }} className={`flex w-full items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'users' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}><Users size={20} /> Manajemen Akun</button>
              <button onClick={() => { setActiveTab('logs'); setIsMobileMenuOpen(false); }} className={`flex w-full items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'logs' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}><History size={20} /> Riwayat Aktivitas</button>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-700 bg-slate-900/30 flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-full"><User size={20} /></div>
          <div className="flex-1 min-w-0"><p className="text-xs font-bold text-white truncate">{user.email}</p><p className="text-[10px] uppercase font-black text-indigo-400">{userRole}</p></div>
          <button onClick={() => window.supabase.auth.signOut()} className="p-2 text-slate-400 hover:text-red-400"><LogOut size={18} /></button>
        </div>
      </div>

      {isProcessing && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center z-[100]">
          <Loader2 className="animate-spin text-indigo-500 mb-4" size={64} /><h2 className="text-2xl font-bold text-white mb-2">Mohon Tunggu</h2><p className="text-indigo-300">{processingMsg}</p>
          {uploadProgress > 0 && <div className="mt-6 w-96 bg-slate-800 rounded-full h-3 overflow-hidden"><div className="bg-indigo-500 h-full transition-all" style={{width: `${uploadProgress}%`}}/></div>}
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden bg-slate-900/50">
        <div className="md:hidden flex items-center justify-between bg-slate-800 p-4 border-b border-slate-700 z-30">
          <div className="font-black text-white tracking-widest uppercase">Breaker Cloud</div>
          <button onClick={() => setIsMobileMenuOpen(true)}><Menu size={24}/></button>
        </div>
        
        <main className="flex-1 overflow-y-auto p-4 md:p-8 relative">
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'explorer' && renderExplorer()}
          {activeTab === 'check-local' && renderLocalCheck()}
          {activeTab === 'hdds' && renderManageHDDs()}
          {activeTab === 'audit' && renderAuditSheet()}
          {activeTab === 'duplicates' && renderDuplicates()}
          {activeTab === 'tutorial' && renderTutorial()}
          {activeTab === 'users' && renderUsers()}
          {activeTab === 'logs' && renderLogs()}
        </main>
      </div>
    </div>
  );
}

// KOMPONEN DUKUNGAN (MURNI UI)
const DuplicateGroupItem = ({ group, wasted, hddsInvolved, selectedFileIds, onToggle }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const selCount = group.filter(f => selectedFileIds.has(f.id)).length;
  
  return (
    <div className={`border rounded-xl transition-colors ${isExpanded ? 'bg-slate-800/80 border-slate-600' : 'bg-slate-900/30 border-slate-700/50'}`}>
      <div className="p-4 grid grid-cols-12 gap-4 items-center cursor-pointer select-none" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="col-span-6 flex items-center gap-3">
          {isExpanded ? <ChevronDown size={16} className="text-slate-500 shrink-0"/> : <ChevronRight size={16} className="text-slate-500 shrink-0"/>}
          <Files size={16} className="text-indigo-400 shrink-0"/>
          <div className="min-w-0 flex-1"><p className="text-sm font-bold text-white truncate">{group[0].name}</p><p className="text-xs text-slate-400">{formatBytes(group[0].size)} • {group.length} copy</p></div>
        </div>
        <div className="col-span-4 flex flex-wrap gap-1 justify-center">{hddsInvolved.map(h => <span key={h} className="text-[10px] bg-slate-700 text-slate-300 px-2 py-1 rounded border border-slate-600">{h}</span>)}</div>
        <div className="col-span-2 text-right flex flex-col items-end gap-1"><span className="text-sm font-bold text-red-400">{formatBytes(wasted)}</span>{selCount > 0 && <span className="text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">{selCount} ditandai</span>}</div>
      </div>
      {isExpanded && (
        <div className="border-t border-slate-700/50 bg-slate-900/50 p-2 space-y-1 rounded-b-xl">
          {group.map(f => {
            const sel = selectedFileIds.has(f.id);
            return (
              <div key={f.id} className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer ${sel ? 'bg-red-500/10 border-red-500/30' : 'hover:bg-slate-800 border-transparent'} border`} onClick={() => onToggle(f.id)}>
                {sel ? <CheckSquare size={16} className="text-red-500"/> : <Square size={16} className="text-slate-400"/>}
                <div className="px-2 py-1 bg-slate-800 rounded text-xs font-bold text-indigo-300 shrink-0">{f.hddName}</div>
                <div className="flex-1 text-sm text-slate-300 truncate"><span className="text-slate-500">{f.vPath} \ </span><span className={sel ? 'text-red-300 line-through opacity-70' : 'text-slate-200'}>{f.name}</span></div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};