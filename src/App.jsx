import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  HardDrive, Files, Trash2, UploadCloud, Database, Search, CheckSquare,
  Square, Download, AlertCircle, ChevronDown, ChevronRight, Info,
  Folder as FolderIcon, File as FileIcon, ArrowLeft, Home, FileOutput,
  ChevronLeft, X, FolderOpen, Loader2, Cloud, LogOut, User,
  ShieldAlert, Key, Lock, History, Users, Menu, Clock, Laptop,
  FileSearch, AlertTriangle, Bell, BellOff, FileSpreadsheet,
  RefreshCw, Filter, Pencil, Printer, MessageCircle, BookOpen, Save
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// --- SUPABASE SETUP ---
const SUPABASE_URL = 'https://rdbbauwvwsazdqdsryjd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkYmJhdXd2d3NhemRxZHNyeWpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1OTYwNDUsImV4cCI6MjA5MTE3MjA0NX0.kLkHkXn5Kp486C6_wCPYStMKMioOG3qPcpVqT5g7F5M';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- KONSTANTA ---
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

const PAGE_SIZE = 50;
const UPLOAD_BATCH = 500;
const FIXED_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1wLg2boP1FtUoU9YPOrZxWkbMPHGxm-WHLTNOKMJuLs8/export?format=csv&gid=1175924314';

// --- UTILS ---
const formatBytes = (bytes, decimals = 2) => {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
};

const getDaysOld = (dateString) => {
  if (!dateString) return 0;
  let past = new Date(dateString).getTime();
  if (isNaN(past) && dateString.includes('/')) {
    const parts = dateString.split('/');
    if (parts.length === 3) past = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00`).getTime();
  }
  if (isNaN(past)) return 0;
  const days = Math.floor((Date.now() - past) / 86400000);
  return days > 0 ? days : 0;
};

const GENERIC_FOLDERS = new Set(['stream', 'bdmv', 'avchd', 'private', 'dcim', 'clip', 'root', 'contents', 'video', 'audio', 'm4root', 'sub', 'media']);
const isGenericCameraFolder = (name) => {
  if (!name) return false;
  const lower = name.toLowerCase().trim();
  if (GENERIC_FOLDERS.has(lower)) return true;
  if (lower.includes('mixer') || lower.includes('cam ') || lower.includes('cam_') || lower.includes('kamera ')) return true;
  if (/^[1-9]\d\d[a-z]+/i.test(lower)) return true;
  return false;
};

const parseHTML = (text) => {
  let parsedFiles = [];

  // Format 1: var dirs = [...]
  if (text.includes('"files":[')) {
    const searchStr = 'var dirs = ';
    const startIndex = text.indexOf(searchStr);
    if (startIndex !== -1) {
      let jsonStr = '';
      const scriptEnd = text.indexOf('</script>', startIndex);
      if (scriptEnd !== -1) {
        jsonStr = text.substring(startIndex + searchStr.length, scriptEnd).trim();
        if (jsonStr.endsWith(';')) jsonStr = jsonStr.slice(0, -1);
      }
      try {
        const dirs = JSON.parse(jsonStr);
        for (const dir of dirs) {
          if (dir.files && Array.isArray(dir.files)) {
            const dirPath = dir.path || '';
            for (const f of dir.files) {
              const name = f.name || f.n || '';
              const size = f.size !== undefined ? f.size : (f.s || 0);
              const date = f.date || f.d || '';
              if (name) parsedFiles.push({ path: dirPath, name: String(name), size: parseInt(size, 10) || 0, date: String(date) });
            }
          }
        }
        if (parsedFiles.length > 0) return parsedFiles;
      } catch (e) { /* continue to next parser */ }
    }
  }

  // Format 2: p([...]) format
  const pCalls = [];
  let searchIdx = 0;
  while (true) {
    const start = text.indexOf('p([', searchIdx);
    if (start === -1) break;
    let end = text.indexOf('])', start + 3);
    let found = false;
    while (end !== -1 && (end - start) < 15000000) {
      const slice = text.substring(start + 2, end + 1);
      try {
        const arr = JSON.parse(slice);
        pCalls.push(arr);
        searchIdx = end + 2;
        found = true;
        break;
      } catch (e) { end = text.indexOf('])', end + 2); }
    }
    if (!found) searchIdx = start + 3;
  }

  if (pCalls.length > 0) {
    const dirNodes = [];
    for (let i = 0; i < pCalls.length; i++) {
      const dir = pCalls[i];
      const infoStr = dir[0] !== undefined && dir[0] !== null ? String(dir[0]) : '';
      const parts = infoStr.split('*');
      dirNodes.push({ name: parts[0], parentId: dir[1], files: dir.slice(3) });
    }

    const getPath = (index) => {
      const parts = [];
      let curr = index;
      let safe = 0;
      while (curr !== undefined && curr !== null && curr !== '' && safe < 2000) {
        const node = dirNodes[curr];
        if (!node) break;
        parts.unshift(node.name);
        if (node.parentId === curr || node.parentId === '') break;
        curr = node.parentId;
        safe++;
      }
      return parts.join('\\').replace(/\\\\/g, '\\');
    };

    for (let i = 0; i < dirNodes.length; i++) {
      const node = dirNodes[i];
      const currentPath = getPath(i);
      for (let fileStr of node.files) {
        if (!fileStr) continue;
        fileStr = String(fileStr);
        const fParts = fileStr.split('*');
        const fName = fParts[0];
        let fSize = 0, fDate = '';
        if (fParts[1]) { fSize = parseInt(fParts[1], 36); if (isNaN(fSize)) fSize = 0; }
        if (fParts[2]) {
          const ts = parseInt(fParts[2], 36);
          if (!isNaN(ts)) fDate = new Date(ts * 1000).toLocaleDateString('id-ID');
        }
        parsedFiles.push({ path: currentPath, name: fName, size: fSize, date: fDate });
      }
    }
    return parsedFiles;
  }

  throw new Error("Format file Snap2HTML tidak dikenali.");
};

const writeLog = async (userEmail, action, details) => {
  try {
    await supabase.from('logs').insert({ user_email: userEmail, action, details });
  } catch (e) { console.error('Log error:', e); }
};

// ============================================================
// MAIN APP COMPONENT
// ============================================================
export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [isAuthProcessing, setIsAuthProcessing] = useState(false);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [hdds, setHdds] = useState([]);
  const [isHddsLoading, setIsHddsLoading] = useState(true);

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMsg, setProcessingMsg] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  const [uploadHddName, setUploadHddName] = useState('');
  const [uploadHddCapacity, setUploadHddCapacity] = useState(HDD_CAPACITIES[1].value);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);
  const replaceFileInputRef = useRef(null);
  const [replacingHdd, setReplacingHdd] = useState(null);
  const [editingCapacityId, setEditingCapacityId] = useState(null);
  const [editCapacityVal, setEditCapacityVal] = useState('');

  // Search (server-side)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchFolders, setSearchFolders] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchPage, setSearchPage] = useState(0);
  const [searchTotal, setSearchTotal] = useState(0);
  const searchDebounceRef = useRef(null);

  // Explorer (lazy per HDD)
  const [explorerHddId, setExplorerHddId] = useState(null);
  const [explorerPath, setExplorerPath] = useState('');
  const [explorerItems, setExplorerItems] = useState({ folders: [], files: [] });
  const [isExplorerLoading, setIsExplorerLoading] = useState(false);
  const explorerPathsCache = useRef(new Map());

  // Duplicates (server-side)
  const [duplicateGroups, setDuplicateGroups] = useState([]);
  const [duplicateWasted, setDuplicateWasted] = useState(0);
  const [duplicateTotal, setDuplicateTotal] = useState(0);
  const [isLoadingDuplicates, setIsLoadingDuplicates] = useState(false);
  const [dupPage, setDupPage] = useState(0);
  const [selectedFileIds, setSelectedFileIds] = useState(new Set());

  // Local check
  const [localScanFiles, setLocalScanFiles] = useState(null);
  const [localScanName, setLocalScanName] = useState('');
  const [localCheckResults, setLocalCheckResults] = useState(null);
  const [isCheckingLocal, setIsCheckingLocal] = useState(false);
  const localFileInputRef = useRef(null);

  // Audit
  const [auditData, setAuditData] = useState(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditFilter, setAuditFilter] = useState('All');

  // Admin
  const [usersList, setUsersList] = useState([]);
  const [logs, setLogs] = useState([]);

  // ===================== AUTH =====================
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id, session.user.email);
      else setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id, session.user.email);
      else { setProfile(null); setHdds([]); setIsLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId, email) => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (error || !data) {
        const { data: np } = await supabase.from('profiles').insert({ id: userId, email, role: 'viewer' }).select().single();
        setProfile(np || { id: userId, email, role: 'viewer' });
      } else {
        setProfile(data);
      }
    } catch (err) {
      setProfile({ id: userId, email, role: 'viewer' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthProcessing(true);
    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: authForm.email, password: authForm.password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email: authForm.email, password: authForm.password });
        if (error) throw error;
      }
    } catch (err) {
      setAuthError(err.message || 'Autentikasi gagal.');
    } finally {
      setIsAuthProcessing(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!authForm.email) { setAuthError('Masukkan email terlebih dahulu.'); return; }
    setIsAuthProcessing(true);
    try {
      await supabase.auth.resetPasswordForEmail(authForm.email);
      alert(`Link reset password dikirim ke ${authForm.email}`);
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setIsAuthProcessing(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm('Yakin ingin keluar?')) {
      await supabase.auth.signOut();
    }
  };

  // ===================== FETCH HDDs =====================
  useEffect(() => {
    if (!session) return;
    fetchHdds();
  }, [session]);

  const fetchHdds = async () => {
    setIsHddsLoading(true);
    const { data, error } = await supabase.from('hdds').select('*').order('name');
    if (!error && data) setHdds(data);
    setIsHddsLoading(false);
  };

  const totalFiles = hdds.reduce((acc, h) => acc + (h.file_count || 0), 0);
  const totalSize = hdds.reduce((acc, h) => acc + (h.total_size || 0), 0);
  const globalCapacity = hdds.reduce((acc, h) => acc + (h.capacity || HDD_CAPACITIES[1].value), 0);
  const globalFree = Math.max(globalCapacity - totalSize, 0);
  const globalUsedPercent = globalCapacity > 0 ? Math.min((totalSize / globalCapacity) * 100, 100) : 0;

  // ===================== ADMIN DATA =====================
  useEffect(() => {
    if (profile?.role !== 'admin') return;
    supabase.from('profiles').select('*').order('created_at').then(({ data }) => { if (data) setUsersList(data); });
    supabase.from('logs').select('*').order('timestamp', { ascending: false }).limit(200).then(({ data }) => { if (data) setLogs(data); });
  }, [profile?.role]);

  // ===================== HDD UPLOAD =====================
  const handleFileUpload = async (e) => {
    const uploadedFiles = Array.from(e.target.files);
    if (uploadedFiles.length === 0) return;
    setIsProcessing(true);
    setUploadError('');
    setUploadProgress(0);

    try {
      for (let fi = 0; fi < uploadedFiles.length; fi++) {
        const file = uploadedFiles[fi];
        let hddName = uploadedFiles.length > 1 || !uploadHddName.trim()
          ? file.name.replace(/\.[^/.]+$/, '')
          : uploadHddName.trim();

        const existingHdd = hdds.find(h => h.name.toLowerCase() === hddName.toLowerCase());
        if (existingHdd) {
          const confirmReplace = window.confirm(`⚠️ HDD "${existingHdd.name}" sudah ada.\n\nTimpa data lamanya?`);
          if (!confirmReplace) continue;
          setProcessingMsg(`Menghapus data lama ${existingHdd.name}...`);
          await supabase.from('files').delete().eq('hdd_id', existingHdd.id);
          await supabase.from('hdds').delete().eq('id', existingHdd.id);
        }

        setProcessingMsg(`Membaca file ${fi + 1}/${uploadedFiles.length}: ${hddName}...`);
        const text = await file.text();
        let parsed;
        try { parsed = parseHTML(text); } catch (err) { setUploadError(`Gagal parsing ${file.name}: ${err.message}`); continue; }
        if (parsed.length === 0) { setUploadError(`File ${file.name} kosong.`); continue; }

        const totalSizeBytes = parsed.reduce((acc, f) => acc + (f.size || 0), 0);
        const { data: newHdd, error: hddErr } = await supabase.from('hdds').insert({
          name: hddName,
          capacity: uploadHddCapacity,
          file_count: parsed.length,
          total_size: totalSizeBytes,
          warning_muted: false,
          date_added: new Date().toISOString(),
          last_updated: new Date().toISOString()
        }).select().single();

        if (hddErr || !newHdd) throw new Error(`Gagal membuat HDD: ${hddErr?.message}`);

        // Batch insert files
        setProcessingMsg(`Mengunggah ${parsed.length.toLocaleString()} file...`);
        const rows = parsed.map(f => ({
          hdd_id: newHdd.id,
          hdd_name: hddName,
          name: f.name,
          path: f.path || '',
          size: f.size || 0,
          date: f.date || ''
        }));

        let uploaded = 0;
        for (let i = 0; i < rows.length; i += UPLOAD_BATCH) {
          const batch = rows.slice(i, i + UPLOAD_BATCH);
          const { error: batchErr } = await supabase.from('files').insert(batch);
          if (batchErr) throw new Error(`Batch insert gagal: ${batchErr.message}`);
          uploaded += batch.length;
          setUploadProgress(Math.round((uploaded / rows.length) * 100));
        }

        await writeLog(session.user.email, 'UPLOAD_HDD', `Upload HDD baru: ${hddName} (${parsed.length.toLocaleString()} file)`);
        setUploadProgress(100);
      }
      await fetchHdds();
      setUploadHddName('');
      explorerPathsCache.current.clear();
      alert('Upload selesai!');
    } catch (err) {
      console.error(err);
      setUploadError(err.message);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => { setIsProcessing(false); setProcessingMsg(''); setUploadProgress(0); }, 800);
    }
  };

  const handleReplaceUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !replacingHdd) return;
    setIsProcessing(true);
    setProcessingMsg(`Mengganti data ${replacingHdd.name}...`);
    setUploadProgress(0);

    try {
      const text = await file.text();
      const parsed = parseHTML(text);
      if (parsed.length === 0) throw new Error('File kosong atau format tidak valid.');

      setProcessingMsg('Menghapus data lama...');
      await supabase.from('files').delete().eq('hdd_id', replacingHdd.id);
      setUploadProgress(20);

      const totalSizeBytes = parsed.reduce((acc, f) => acc + (f.size || 0), 0);
      await supabase.from('hdds').update({
        file_count: parsed.length,
        total_size: totalSizeBytes,
        last_updated: new Date().toISOString()
      }).eq('id', replacingHdd.id);

      const rows = parsed.map(f => ({
        hdd_id: replacingHdd.id,
        hdd_name: replacingHdd.name,
        name: f.name,
        path: f.path || '',
        size: f.size || 0,
        date: f.date || ''
      }));

      setProcessingMsg(`Mengunggah ${parsed.length.toLocaleString()} file baru...`);
      let uploaded = 0;
      for (let i = 0; i < rows.length; i += UPLOAD_BATCH) {
        const { error } = await supabase.from('files').insert(rows.slice(i, i + UPLOAD_BATCH));
        if (error) throw error;
        uploaded += Math.min(UPLOAD_BATCH, rows.length - i);
        setUploadProgress(20 + Math.round((uploaded / rows.length) * 80));
      }

      await writeLog(session.user.email, 'REPLACE_HDD', `Replace HDD: ${replacingHdd.name} (${parsed.length.toLocaleString()} file)`);
      explorerPathsCache.current.delete(replacingHdd.id);
      await fetchHdds();
      alert(`HDD ${replacingHdd.name} berhasil diperbarui!`);
    } catch (err) {
      alert(`Gagal: ${err.message}`);
    } finally {
      if (replaceFileInputRef.current) replaceFileInputRef.current.value = '';
      setReplacingHdd(null);
      setTimeout(() => { setIsProcessing(false); setProcessingMsg(''); setUploadProgress(0); }, 800);
    }
  };

  const removeHdd = async (hddId) => {
    const hdd = hdds.find(h => h.id === hddId);
    if (!hdd) return;
    if (!window.confirm(`Hapus HDD "${hdd.name}" secara permanen?`)) return;
    setIsProcessing(true);
    setProcessingMsg(`Menghapus ${hdd.name}...`);
    try {
      await supabase.from('files').delete().eq('hdd_id', hddId);
      await supabase.from('hdds').delete().eq('id', hddId);
      await writeLog(session.user.email, 'DELETE_HDD', `Hapus HDD: ${hdd.name}`);
      explorerPathsCache.current.delete(hddId);
      if (explorerHddId === hddId) { setExplorerHddId(null); setExplorerPath(''); }
      await fetchHdds();
    } catch (err) {
      alert(`Gagal menghapus: ${err.message}`);
    } finally {
      setIsProcessing(false); setProcessingMsg('');
    }
  };

  const toggleHddWarning = async (hdd) => {
    const newVal = !hdd.warning_muted;
    await supabase.from('hdds').update({ warning_muted: newVal }).eq('id', hdd.id);
    await writeLog(session.user.email, newVal ? 'MUTE_WARNING' : 'UNMUTE_WARNING', `${newVal ? 'Mute' : 'Unmute'} warning HDD: ${hdd.name}`);
    await fetchHdds();
  };

  const updateHddCapacity = async (hddId) => {
    if (!editCapacityVal) return;
    await supabase.from('hdds').update({ capacity: Number(editCapacityVal) }).eq('id', hddId);
    await writeLog(session.user.email, 'UPDATE_CAPACITY', `Update kapasitas HDD`);
    setEditingCapacityId(null);
    await fetchHdds();
  };

  const exportHddToHTML = async (hdd) => {
    setIsProcessing(true);
    setProcessingMsg('Mempersiapkan export...');
    try {
      const { data: files } = await supabase.from('files').select('*').eq('hdd_id', hdd.id);
      const dirsMap = {};
      (files || []).forEach(f => {
        const p = f.path || '';
        if (!dirsMap[p]) dirsMap[p] = [];
        dirsMap[p].push({ n: f.name, s: f.size, d: f.date });
      });
      const dirsArr = Object.keys(dirsMap).map(path => ({ path, files: dirsMap[path] }));
      const jsonStr = JSON.stringify(dirsArr);
      const htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Export - ${hdd.name}</title></head><body><script>var dirs = ${jsonStr};</script></body></html>`;
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `Update_${hdd.name.replace(/\s+/g, '_')}.html`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch (err) { alert('Export gagal: ' + err.message); }
    finally { setIsProcessing(false); setProcessingMsg(''); }
  };

  // ===================== SEARCH (SERVER-SIDE) =====================
  const performSearch = useCallback(async (query, page = 0) => {
    if (!query.trim()) { setSearchResults([]); setSearchFolders([]); setSearchTotal(0); return; }
    setIsSearching(true);
    try {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const [filesRes, foldersRes] = await Promise.all([
        supabase.from('files')
          .select('id, hdd_id, hdd_name, name, path, size, date', { count: 'exact' })
          .ilike('name', `%${query}%`)
          .order('name')
          .range(from, to),
        supabase.from('files')
          .select('hdd_name, path')
          .ilike('path', `%${query}%`)
          .limit(300)
      ]);

      if (page === 0) {
        const folderMap = new Map();
        (foldersRes.data || []).forEach(f => {
          if (!f.path) return;
          const parts = f.path.split('\\');
          parts.forEach((part, i) => {
            if (!part.toLowerCase().includes(query.toLowerCase())) return;
            const subPath = parts.slice(0, i + 1).join('\\');
            const key = `${f.hdd_name}|||${subPath}`;
            if (!folderMap.has(key)) {
              folderMap.set(key, { hdd_name: f.hdd_name, path: subPath, folderName: part });
            }
          });
        });
        setSearchFolders(Array.from(folderMap.values()).slice(0, 50));
      }

      if (page === 0) setSearchResults(filesRes.data || []);
      else setSearchResults(prev => [...prev, ...(filesRes.data || [])]);
      setSearchTotal(filesRes.count || 0);
    } catch (err) { console.error('Search error:', err); }
    finally { setIsSearching(false); }
  }, []);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!searchQuery.trim()) { setSearchResults([]); setSearchTotal(0); return; }
    searchDebounceRef.current = setTimeout(() => { setSearchPage(0); performSearch(searchQuery, 0); }, 400);
    return () => clearTimeout(searchDebounceRef.current);
  }, [searchQuery]);

  // ===================== EXPLORER (LAZY PER HDD) =====================
  const loadExplorerItems = useCallback(async (hddId, path) => {
    if (!hddId) return;
    setIsExplorerLoading(true);

    try {
      // Get paths for this HDD (cached)
      let allPaths = explorerPathsCache.current.get(hddId);
      if (!allPaths) {
        const { data } = await supabase.from('files').select('path').eq('hdd_id', hddId);
        allPaths = [...new Set((data || []).map(r => r.path))];
        explorerPathsCache.current.set(hddId, allPaths);
      }

      const hdd = hdds.find(h => h.id === hddId);
      const hddName = hdd?.name || '';
      const normPath = path ? path : '';
      const prefix = normPath ? normPath + '\\' : '';

      // Build folder list
      const foldersMap = new Map();
      for (const p of allPaths) {
        const vPath = normPath === '' ? p : (p === normPath || p.startsWith(prefix) ? p : null);
        if (vPath === null) continue;
        if (p === normPath) continue;
        if (normPath === '' || p.startsWith(prefix)) {
          const remaining = normPath ? p.substring(normPath.length + 1) : p;
          const nextFolder = remaining.split('\\')[0];
          if (nextFolder && !foldersMap.has(nextFolder)) {
            const fPath = normPath ? `${normPath}\\${nextFolder}` : nextFolder;
            foldersMap.set(nextFolder, fPath);
          }
        }
      }

      // Get files in current path
      const { data: filesData } = await supabase.from('files')
        .select('id, hdd_id, hdd_name, name, path, size, date')
        .eq('hdd_id', hddId)
        .eq('path', normPath)
        .order('name')
        .limit(500);

      const folders = Array.from(foldersMap.entries())
        .map(([name, path]) => ({ name, path }))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

      setExplorerItems({ folders, files: filesData || [] });
    } catch (err) {
      console.error('Explorer error:', err);
    } finally {
      setIsExplorerLoading(false);
    }
  }, [hdds]);

  useEffect(() => {
    if (activeTab === 'explorer' && explorerHddId) {
      loadExplorerItems(explorerHddId, explorerPath);
    }
  }, [explorerHddId, explorerPath, activeTab]);

  // ===================== DUPLICATES (SERVER-SIDE) =====================
  const loadDuplicates = useCallback(async (page = 0) => {
    setIsLoadingDuplicates(true);
    try {
      const from = page * PAGE_SIZE;
      const { data, error } = await supabase.rpc('get_duplicates', { p_limit: PAGE_SIZE, p_offset: from });
      if (error) throw error;

      const groups = (data || []).map(row => ({
        key: `${row.name}_${row.size}_${row.date}`,
        name: row.name,
        size: row.size,
        date: row.date,
        count: row.copy_count,
        wasted: row.wasted_bytes,
        instances: row.instances
      }));

      if (page === 0) setDuplicateGroups(groups);
      else setDuplicateGroups(prev => [...prev, ...groups]);
    } catch (err) {
      // Fallback: manual query if RPC not available
      console.warn('RPC not available, using fallback:', err.message);
      await loadDuplicatesFallback(page);
    } finally {
      setIsLoadingDuplicates(false);
    }
  }, []);

  const loadDuplicatesFallback = async (page = 0) => {
    // Since Supabase doesn't support GROUP BY directly in client,
    // we fetch a larger chunk and group client-side
    const { data } = await supabase
      .from('files')
      .select('id, hdd_id, hdd_name, name, path, size, date')
      .gt('size', 0)
      .order('name')
      .limit(50000)
      .range(page * 50000, (page + 1) * 50000 - 1);

    if (!data) return;

    const map = new Map();
    for (const file of data) {
      const key = `${file.name.toLowerCase()}|||${file.size}|||${file.date}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(file);
    }

    const groups = [];
    let totalWasted = 0;
    for (const [, files] of map.entries()) {
      if (files.length > 1) {
        const wasted = files[0].size * (files.length - 1);
        totalWasted += wasted;
        groups.push({
          key: `${files[0].name}_${files[0].size}_${files[0].date}`,
          name: files[0].name,
          size: files[0].size,
          date: files[0].date,
          count: files.length,
          wasted,
          instances: files
        });
      }
    }

    groups.sort((a, b) => b.wasted - a.wasted);
    if (page === 0) {
      setDuplicateGroups(groups);
      setDuplicateWasted(totalWasted);
      setDuplicateTotal(groups.length);
    } else {
      setDuplicateGroups(prev => [...prev, ...groups]);
    }
  };

  useEffect(() => {
    if (activeTab === 'duplicates' && duplicateGroups.length === 0 && !isLoadingDuplicates) {
      loadDuplicates(0);
    }
  }, [activeTab]);

  // Recalculate total wasted from groups
  const totalWasted = useMemo(() => duplicateGroups.reduce((acc, g) => acc + (g.wasted || 0), 0), [duplicateGroups]);

  const toggleFileSelection = (fileId) => {
    setSelectedFileIds(prev => {
      const next = new Set(prev);
      next.has(fileId) ? next.delete(fileId) : next.add(fileId);
      return next;
    });
  };

  const smartSelectDuplicates = () => {
    const next = new Set(selectedFileIds);
    duplicateGroups.forEach(group => {
      const instances = group.instances || [];
      for (let i = 1; i < instances.length; i++) next.add(instances[i].id);
    });
    setSelectedFileIds(next);
  };

  const applyDeleteDuplicates = async () => {
    if (selectedFileIds.size === 0) return;
    if (!window.confirm(`Hapus ${selectedFileIds.size} file dari database secara permanen?`)) return;
    setIsProcessing(true);
    setProcessingMsg('Menghapus file duplikat...');
    try {
      const ids = Array.from(selectedFileIds);
      // Delete in batches of 100
      for (let i = 0; i < ids.length; i += 100) {
        const { error } = await supabase.from('files').delete().in('id', ids.slice(i, i + 100));
        if (error) throw error;
      }

      // Recalculate HDD stats
      const affectedHdds = new Set(
        duplicateGroups.flatMap(g => (g.instances || []).filter(f => selectedFileIds.has(f.id)).map(f => f.hdd_id))
      );
      for (const hddId of affectedHdds) {
        const { count } = await supabase.from('files').select('*', { count: 'exact', head: true }).eq('hdd_id', hddId);
        const { data: sizeData } = await supabase.from('files').select('size').eq('hdd_id', hddId);
        const totalSz = (sizeData || []).reduce((a, r) => a + r.size, 0);
        await supabase.from('hdds').update({ file_count: count || 0, total_size: totalSz }).eq('id', hddId);
      }

      await writeLog(session.user.email, 'DELETE_DUPLICATES', `Hapus ${ids.length} file duplikat`);
      setSelectedFileIds(new Set());
      setDuplicateGroups([]);
      await fetchHdds();
      await loadDuplicates(0);
      alert('File duplikat berhasil dihapus!');
    } catch (err) {
      alert('Gagal: ' + err.message);
    } finally {
      setIsProcessing(false); setProcessingMsg('');
    }
  };

  const generateBatScript = () => {
    const filesToDelete = duplicateGroups
      .flatMap(g => (g.instances || []))
      .filter(f => selectedFileIds.has(f.id));
    if (filesToDelete.length === 0) return;

    let script = `@echo off\r\necho Breaker HDD Manager - Script Hapus Duplikat\r\npause\r\n\r\n`;
    const byHdd = {};
    filesToDelete.forEach(f => {
      if (!byHdd[f.hdd_name]) byHdd[f.hdd_name] = [];
      byHdd[f.hdd_name].push(f);
    });
    Object.entries(byHdd).forEach(([hdd, files]) => {
      script += `echo === HDD: ${hdd} ===\r\n`;
      files.forEach(f => {
        const fullPath = f.path ? `${f.path}\\${f.name}` : f.name;
        script += `del /F /Q "${fullPath.replace(/\//g, '\\')}"\r\n`;
      });
    });
    script += `echo Selesai!\r\npause\r\n`;

    const blob = new Blob([script], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'hapus_duplikat.bat';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  // ===================== LOCAL CHECK =====================
  const handleLocalScanUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsCheckingLocal(true);
    try {
      const text = await file.text();
      const parsed = parseHTML(text);
      if (parsed.length === 0) { alert('File kosong.'); return; }

      setLocalScanName(file.name);

      // Check each file against server in batches
      const results = { duplicates: [], unique: [], wastedSpace: 0 };
      const BATCH = 50;

      for (let i = 0; i < parsed.length; i += BATCH) {
        const chunk = parsed.slice(i, i + BATCH);
        const checks = await Promise.all(chunk.map(async (lf) => {
          if (!lf.size) return { local: lf, found: [] };
          const { data } = await supabase.from('files')
            .select('id, hdd_name, path, name')
            .ilike('name', lf.name)
            .eq('size', lf.size)
            .limit(3);
          return { local: lf, found: data || [] };
        }));

        checks.forEach(({ local, found }) => {
          if (found.length > 0) {
            results.duplicates.push({ local, cloud: found });
            results.wastedSpace += local.size;
          } else {
            results.unique.push(local);
          }
        });
      }

      results.duplicates.sort((a, b) => b.local.size - a.local.size);
      setLocalScanFiles(parsed);
      setLocalCheckResults(results);
    } catch (err) {
      alert('Gagal: ' + err.message);
    } finally {
      setIsCheckingLocal(false);
      if (localFileInputRef.current) localFileInputRef.current.value = '';
    }
  };

  // ===================== AUDIT SHEET =====================
  const handleAuditSheet = async () => {
    setIsAuditing(true);
    setAuditData(null);
    try {
      const res = await fetch(FIXED_SHEET_URL);
      if (!res.ok) throw new Error('Sheet tidak dapat diakses.');
      const text = await res.text();

      const rows = text.split('\n')
        .map(row => row.split(',')[0]?.replace(/"/g, '').trim())
        .filter(row => {
          if (!row || row.length < 3) return false;
          const rl = row.toLowerCase();
          if (rl === 'nama project' || rl === 'project') return false;
          if (rl.endsWith(' - breaker')) return false;
          return true;
        });

      // Get all distinct paths from DB
      const { data: pathData } = await supabase.from('files').select('path, hdd_name').limit(100000);
      const allPaths = [...new Set((pathData || []).map(r => `${r.hdd_name}\\${r.path}`))];

      const processedRows = rows.map(project => {
        const pLower = project.toLowerCase();
        let category = 'Lainnya';
        if (pLower.endsWith(' - video')) category = 'Video';
        else if (pLower.endsWith(' - von')) category = 'Visual';
        else if (pLower.endsWith(' - isadaya')) category = 'Isadaya';

        const matches = allPaths.filter(p => p.toLowerCase().includes(pLower));
        matches.sort((a, b) => a.length - b.length);
        const bestMatch = matches[0] || null;

        return { name: project, category, isFound: !!bestMatch, foundPath: bestMatch };
      });

      setAuditData(processedRows);
    } catch (err) {
      alert('Gagal: ' + err.message);
    } finally {
      setIsAuditing(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'audit' && !auditData && !isAuditing) handleAuditSheet();
  }, [activeTab]);

  const displayedAudit = useMemo(() => {
    if (!auditData) return null;
    const filtered = auditFilter === 'All' ? auditData : auditData.filter(d => d.category === auditFilter);
    const ns = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    return { missing: filtered.filter(d => !d.isFound).sort(ns), found: filtered.filter(d => d.isFound).sort(ns) };
  }, [auditData, auditFilter]);

  // ===================== USER MANAGEMENT (ADMIN) =====================
  const updateUserRole = async (targetId, targetEmail, newRole) => {
    if (!window.confirm(`Ubah role ${targetEmail} menjadi ${newRole}?`)) return;
    await supabase.from('profiles').update({ role: newRole }).eq('id', targetId);
    await writeLog(session.user.email, 'CHANGE_ROLE', `Ubah role ${targetEmail} → ${newRole}`);
    const { data } = await supabase.from('profiles').select('*').order('created_at');
    if (data) setUsersList(data);
  };

  const deleteUserProfile = async (targetId, targetEmail) => {
    if (targetId === session.user.id) { alert('Tidak bisa menghapus akun sendiri!'); return; }
    if (!window.confirm(`Hapus akses ${targetEmail}?`)) return;
    await supabase.from('profiles').delete().eq('id', targetId);
    await writeLog(session.user.email, 'DELETE_USER', `Hapus akses: ${targetEmail}`);
    const { data } = await supabase.from('profiles').select('*').order('created_at');
    if (data) setUsersList(data);
  };

  // ===================== UI HELPERS =====================
  const switchTab = (tab) => { setActiveTab(tab); setIsMobileMenuOpen(false); };

  const isAdmin = profile?.role === 'admin';
  const isEditor = profile?.role === 'admin' || profile?.role === 'editor';

  // ===================== LOADING SCREEN =====================
  if (isLoading) {
    return (
      <div className="flex h-screen w-full bg-slate-900 text-white items-center justify-center flex-col">
        <Loader2 className="animate-spin text-indigo-500 mb-4" size={64} />
        <h2 className="text-2xl font-bold tracking-widest text-indigo-100">MENGHUBUNGKAN...</h2>
        <p className="text-slate-500 text-sm mt-2 font-mono">Verifikasi Keamanan Akses</p>
      </div>
    );
  }

  // ===================== AUTH SCREEN =====================
  if (!session) {
    return (
      <div className="flex h-screen w-full bg-slate-900 text-white items-center justify-center p-4">
        <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-2xl max-w-md w-full">
          <div className="text-center mb-8">
            <img src="LOGO BRREAKER_10.png" alt="Breaker Logo" className="w-20 h-20 mx-auto mb-4 object-contain"
              onError={(e) => { e.target.onerror = null; e.target.src = "https://placehold.co/100x100/1e293b/white?text=B"; }} />
            <h1 className="text-2xl font-black tracking-widest uppercase">Breaker Cloud</h1>
            <p className="text-slate-400 text-sm mt-2">Manajemen Aset HDD Studio</p>
          </div>

          {authError && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-400 p-3 rounded-lg mb-4 text-sm flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" /><span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Email</label>
              <div className="relative">
                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type="email" required value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white text-sm focus:border-indigo-500 outline-none transition-all"
                  placeholder="email@breakercreative.com" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Kata Sandi</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type="password" required minLength={6} value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white text-sm focus:border-indigo-500 outline-none transition-all"
                  placeholder="Minimal 6 karakter" />
              </div>
              {authMode === 'login' && (
                <div className="text-right mt-1">
                  <button type="button" onClick={handleForgotPassword} className="text-xs text-indigo-400 hover:text-indigo-300">Lupa Kata Sandi?</button>
                </div>
              )}
            </div>
            <button type="submit" disabled={isAuthProcessing}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-colors text-sm disabled:opacity-50 flex items-center justify-center gap-2 mt-2">
              {isAuthProcessing && <Loader2 size={18} className="animate-spin" />}
              {authMode === 'login' ? 'Masuk ke Database' : 'Daftar Akun Baru'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError(''); }}
              className="text-sm text-slate-400 hover:text-white transition-colors">
              {authMode === 'login' ? 'Belum punya akun? Daftar di sini.' : 'Sudah punya akun? Masuk di sini.'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===================== MAIN APP =====================
  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-900 text-slate-100 overflow-hidden">

      {/* MOBILE HEADER */}
      <div className="md:hidden flex items-center justify-between bg-slate-800 p-4 border-b border-slate-700 z-30 shrink-0">
        <div className="flex items-center gap-2">
          <img src="LOGO BRREAKER_10.png" alt="Logo" className="w-8 h-8 object-contain"
            onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; }} />
          <div>
            <h1 className="text-lg font-black text-white tracking-widest uppercase leading-none">Breaker</h1>
            <p className="text-[9px] text-indigo-400 font-bold tracking-wider uppercase mt-0.5 leading-none">Cloud Database</p>
          </div>
        </div>
        <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 bg-slate-700 text-white rounded-lg">
          <Menu size={24} />
        </button>
      </div>

      {isMobileMenuOpen && <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />}

      {/* SIDEBAR */}
      <div className={`fixed md:static inset-y-0 left-0 z-50 bg-slate-800 border-r border-slate-700 flex flex-col shrink-0 transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'} ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden absolute right-4 top-6 text-slate-400 bg-slate-700 p-1.5 rounded-lg z-50"><X size={20} /></button>

        <div className={`p-6 border-b border-slate-700 flex items-center h-[88px] relative ${isSidebarOpen ? '' : 'justify-center px-0'}`}>
          {isSidebarOpen ? (
            <div className="min-w-0 animate-in fade-in duration-300 flex flex-col">
              <div className="flex items-start gap-2">
                <h1 className="text-xl font-black text-white tracking-widest uppercase leading-none">Breaker</h1>
                <span className="bg-indigo-600/20 text-indigo-400 border border-indigo-500/50 text-[9px] font-bold px-1.5 py-0.5 rounded tracking-widest mt-[-2px]">CLOUD</span>
              </div>
              <p className="text-[11px] text-indigo-400 font-bold tracking-wider uppercase mt-1 leading-none">HDD Database</p>
            </div>
          ) : (
            <img src="LOGO BRREAKER_10.png" alt="B" className="w-10 h-10 object-contain"
              onError={(e) => { e.target.onerror = null; e.target.src = "https://placehold.co/40x40/1e293b/white?text=B"; }} />
          )}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="hidden md:block absolute -right-3 top-8 bg-slate-700 hover:bg-indigo-600 text-white p-1 rounded-full border border-slate-600 z-10 transition-colors">
            {isSidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>

        <nav className={`flex-1 p-4 space-y-1 overflow-y-auto ${!isSidebarOpen && 'flex flex-col items-center px-2'}`}>
          {[
            { id: 'dashboard', icon: <Database size={20} />, label: 'Dashboard' },
            { id: 'search', icon: <Search size={20} />, label: 'Cari File' },
            { id: 'explorer', icon: <FolderIcon size={20} />, label: 'Penjelajah File' },
            { id: 'check-local', icon: <Laptop size={20} />, label: 'Cek HDD Pribadi' },
            { id: 'audit', icon: <FileSpreadsheet size={20} />, label: 'Audit Sheet' },
            { id: 'tutorial', icon: <BookOpen size={20} />, label: 'Panduan' },
          ].map(item => (
            <button key={item.id} onClick={() => switchTab(item.id)}
              className={`flex items-center rounded-xl transition-all ${isSidebarOpen ? 'w-full gap-3 px-4 py-3' : 'justify-center p-3'} ${activeTab === item.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}
              title={!isSidebarOpen ? item.label : ''}>
              {item.icon}
              {isSidebarOpen && <span className="font-medium text-sm">{item.label}</span>}
            </button>
          ))}

          {isEditor && (
            <>
              <div className="h-px bg-slate-700 my-2 mx-2" />
              {[
                { id: 'hdds', icon: <HardDrive size={20} />, label: 'Kelola HDD', badge: hdds.length > 0 ? hdds.length : null },
                { id: 'duplicates', icon: <Files size={20} />, label: 'Cari Duplikat', badge: duplicateGroups.length > 0 ? duplicateGroups.length : null, badgeColor: 'red' },
              ].map(item => (
                <button key={item.id} onClick={() => switchTab(item.id)}
                  className={`flex items-center rounded-xl transition-all relative ${isSidebarOpen ? 'w-full gap-3 px-4 py-3' : 'justify-center p-3'} ${activeTab === item.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}
                  title={!isSidebarOpen ? item.label : ''}>
                  {item.icon}
                  {isSidebarOpen && (
                    <>
                      <span className="font-medium text-sm">{item.label}</span>
                      {item.badge && (
                        <span className={`ml-auto text-xs px-2 py-0.5 rounded-md ${item.badgeColor === 'red' ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-300'}`}>{item.badge}</span>
                      )}
                    </>
                  )}
                  {!isSidebarOpen && item.badge && (
                    <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">{item.badge}</span>
                  )}
                </button>
              ))}
            </>
          )}

          {isAdmin && (
            <>
              <div className="h-px bg-slate-700 my-2 mx-2" />
              {[
                { id: 'users', icon: <Users size={20} />, label: 'Manajemen Akun' },
                { id: 'logs', icon: <History size={20} />, label: 'Riwayat Edit' },
              ].map(item => (
                <button key={item.id} onClick={() => switchTab(item.id)}
                  className={`flex items-center rounded-xl transition-all ${isSidebarOpen ? 'w-full gap-3 px-4 py-3' : 'justify-center p-3'} ${activeTab === item.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}
                  title={!isSidebarOpen ? item.label : ''}>
                  {item.icon}
                  {isSidebarOpen && <span className="font-medium text-sm">{item.label}</span>}
                </button>
              ))}
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-700 flex items-center gap-3">
          {isSidebarOpen ? (
            <>
              <div className={`p-2 rounded-full shrink-0 ${isAdmin ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-700 text-slate-300'}`}>
                {isAdmin ? <ShieldAlert size={20} /> : <User size={20} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{profile?.email}</p>
                <p className={`text-[10px] uppercase font-black tracking-wider ${isAdmin ? 'text-indigo-400' : profile?.role === 'editor' ? 'text-emerald-400' : 'text-slate-500'}`}>{profile?.role}</p>
              </div>
              <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Keluar">
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <button onClick={handleLogout} className="mx-auto p-2 text-slate-400 hover:text-red-400 rounded-lg transition-colors"><LogOut size={20} /></button>
          )}
        </div>
      </div>

      {/* OVERLAY PROCESSING */}
      {isProcessing && (
        <div className="fixed inset-0 bg-slate-900/85 backdrop-blur-sm flex items-center justify-center z-50 flex-col p-4 text-center">
          <Loader2 className="animate-spin text-indigo-500 mb-4" size={56} />
          <h2 className="text-2xl font-bold text-white mb-2">Mohon Tunggu</h2>
          <p className="text-indigo-300 text-sm font-medium max-w-xs">{processingMsg}</p>
          {uploadProgress > 0 && (
            <div className="mt-6 w-80 max-w-full">
              <div className="flex justify-between text-xs text-indigo-300 mb-1.5 font-mono">
                <span>Proses Server...</span><span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-3 border border-slate-700 overflow-hidden">
                <div className="bg-indigo-500 h-full transition-all duration-300 relative" style={{ width: `${uploadProgress}%` }}>
                  <div className="absolute inset-0 bg-white/20 animate-pulse" />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 md:p-8">

          {/* ====== DASHBOARD ====== */}
          {activeTab === 'dashboard' && (
            <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <header>
                <h2 className="text-3xl font-bold text-white mb-1">Dashboard Cloud</h2>
                <p className="text-slate-400">Analisis semua HDD yang telah diimpor ke server.</p>
              </header>

              <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
                <div className="flex justify-between items-end mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2"><Database size={20} className="text-indigo-400" /> Kapasitas Total Studio</h3>
                    <p className="text-xs text-slate-400 mt-1">{hdds.length} Hard Disk terhubung</p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold text-white">{formatBytes(totalSize)} <span className="text-slate-500 font-medium text-sm">/ {formatBytes(globalCapacity)}</span></p>
                    <p className="text-xs text-slate-400">Sisa: <span className="text-emerald-400 font-bold">{formatBytes(globalFree)}</span></p>
                  </div>
                </div>
                <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
                  <div className={`h-full transition-all duration-1000 ${globalUsedPercent > 90 ? 'bg-red-500' : globalUsedPercent > 75 ? 'bg-orange-500' : 'bg-indigo-500'}`}
                    style={{ width: `${globalUsedPercent}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { icon: <HardDrive size={28} className="text-indigo-400" />, label: 'Total HDD Cloud', value: hdds.length, sub: null },
                  { icon: <Files size={28} className="text-emerald-400" />, label: 'Total File Server', value: totalFiles.toLocaleString(), sub: `Ukuran: ${formatBytes(totalSize)}` },
                  { icon: <Search size={28} className="text-red-400" />, label: 'Ruang Terbuang', value: formatBytes(totalWasted), sub: `${duplicateGroups.length.toLocaleString()} grup duplikat`, red: true },
                ].map((card, i) => (
                  <div key={i} className={`bg-slate-800 p-6 rounded-2xl border shadow-xl ${card.red ? 'border-red-900/50' : 'border-slate-700'}`}>
                    <div className="flex items-center gap-4 mb-4">{card.icon}<h3 className="text-lg font-semibold text-slate-200">{card.label}</h3></div>
                    <p className={`text-4xl font-bold ${card.red ? 'text-red-400' : 'text-white'}`}>{card.value}</p>
                    {card.sub && <p className="text-sm text-slate-400 mt-2">{card.sub}</p>}
                  </div>
                ))}
              </div>

              {isHddsLoading && (
                <div className="flex items-center justify-center py-12 text-slate-500">
                  <Loader2 className="animate-spin mr-3" size={24} /> Memuat data HDD...
                </div>
              )}

              {!isHddsLoading && hdds.length === 0 && (
                <div className="bg-indigo-900/20 border border-indigo-800 p-8 rounded-2xl text-center">
                  <Info size={40} className="text-indigo-400 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">Belum ada data di Server</h3>
                  <p className="text-slate-400 mb-4">Mulai dengan upload scan dari Snap2HTML.</p>
                  {isEditor && <button onClick={() => switchTab('hdds')} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-medium text-sm transition-colors">Upload HDD Sekarang</button>}
                </div>
              )}

              {hdds.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-white">Daftar HDD</h3>
                  {hdds.map(hdd => {
                    const usedPct = hdd.capacity > 0 ? Math.min((hdd.total_size / hdd.capacity) * 100, 100) : 0;
                    const daysOld = getDaysOld(hdd.last_updated);
                    const isOld = daysOld > 90 && !hdd.warning_muted;
                    return (
                      <div key={hdd.id} className={`bg-slate-800 p-5 rounded-2xl border ${isOld ? 'border-yellow-600/50' : 'border-slate-700'} shadow-lg`}>
                        <div className="flex items-center justify-between mb-3 gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <HardDrive size={20} className="text-indigo-400 shrink-0" />
                            <div className="min-w-0">
                              <p className="font-bold text-white truncate">{hdd.name}</p>
                              <p className="text-xs text-slate-400">{(hdd.file_count || 0).toLocaleString()} file • {formatBytes(hdd.total_size || 0)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {isOld && <span className="text-yellow-400 text-xs font-bold bg-yellow-400/10 px-2 py-1 rounded-lg border border-yellow-400/30">{daysOld}h lalu</span>}
                            <button onClick={() => { setExplorerHddId(hdd.id); setExplorerPath(''); switchTab('explorer'); }}
                              className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors" title="Jelajahi">
                              <FolderOpen size={16} />
                            </button>
                          </div>
                        </div>
                        <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                          <div className={`h-full transition-all duration-700 ${usedPct > 90 ? 'bg-red-500' : usedPct > 75 ? 'bg-orange-500' : 'bg-indigo-500'}`}
                            style={{ width: `${usedPct}%` }} />
                        </div>
                        <div className="flex justify-between text-xs text-slate-500 mt-1">
                          <span>{usedPct.toFixed(1)}% terpakai</span>
                          <span>{formatBytes(Math.max((hdd.capacity || 0) - (hdd.total_size || 0), 0))} sisa</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ====== SEARCH ====== */}
          {activeTab === 'search' && (
            <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <header>
                <h2 className="text-3xl font-bold text-white mb-1">Cari File</h2>
                <p className="text-slate-400">Pencarian langsung ke database server — cepat & akurat.</p>
              </header>

              <div className="relative">
                <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Ketik nama file yang dicari..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-2xl py-4 pl-12 pr-12 text-white text-base focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all shadow-lg" />
                {isSearching && <Loader2 size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-500 animate-spin" />}
                {searchQuery && !isSearching && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"><X size={18} /></button>
                )}
              </div>

              {searchQuery && (
                <p className="text-sm text-slate-400">
                  {isSearching ? 'Mencari...' : `Ditemukan ${searchTotal.toLocaleString()} file${searchFolders.length > 0 ? ` • ${searchFolders.length} folder` : ''}`}
                </p>
              )}

              {/* FOLDER RESULTS */}
              {searchFolders.length > 0 && (
                <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden shadow-xl">
                  <div className="bg-slate-900/50 px-4 py-3 border-b border-slate-700 flex items-center gap-2">
                    <FolderIcon size={16} className="text-yellow-400" />
                    <span className="text-sm font-bold text-slate-300">Folder Ditemukan ({searchFolders.length})</span>
                  </div>
                  <div className="divide-y divide-slate-700/50">
                    {searchFolders.map((folder, i) => (
                      <div key={i}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-slate-700/30 cursor-pointer transition-colors group"
                        onClick={() => {
                          const hdd = hdds.find(h => h.name === folder.hdd_name);
                          if (hdd) {
                            setExplorerHddId(hdd.id);
                            setExplorerPath(folder.path);
                            switchTab('explorer');
                          }
                        }}>
                        <FolderIcon size={16} className="text-yellow-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-200 truncate">{folder.folderName}</p>
                          <p className="text-xs text-slate-500 font-mono truncate">{folder.hdd_name} \ {folder.path}</p>
                        </div>
                        <FolderOpen size={14} className="text-slate-500 group-hover:text-indigo-400 transition-colors shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-900/50 text-slate-400 uppercase text-xs">
                        <tr>
                          <th className="px-4 py-3 font-bold">Nama File</th>
                          <th className="px-4 py-3 font-bold">HDD</th>
                          <th className="px-4 py-3 font-bold">Path</th>
                          <th className="px-4 py-3 font-bold text-right">Ukuran</th>
                          <th className="px-4 py-3 font-bold">Tanggal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/50">
                        {searchResults.map(f => (
                          <tr key={f.id} className="hover:bg-slate-700/30 transition-colors">
                            <td className="px-4 py-3">
                              <span className="text-white font-medium flex items-center gap-2">
                                <FileIcon size={14} className="text-slate-500 shrink-0" />{f.name}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-indigo-400 font-medium text-xs">{f.hdd_name}</td>
                            <td className="px-4 py-3 text-slate-400 text-xs font-mono max-w-[200px] truncate">{f.path}</td>
                            <td className="px-4 py-3 text-slate-300 text-right whitespace-nowrap">{formatBytes(f.size)}</td>
                            <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{f.date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {searchResults.length < searchTotal && (
                    <div className="p-4 border-t border-slate-700 text-center">
                      <button onClick={() => { const next = searchPage + 1; setSearchPage(next); performSearch(searchQuery, next); }}
                        disabled={isSearching}
                        className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2 mx-auto">
                        {isSearching ? <Loader2 size={14} className="animate-spin" /> : null}
                        Muat {Math.min(PAGE_SIZE, searchTotal - searchResults.length)} hasil lagi
                      </button>
                    </div>
                  )}
                </div>
              )}

              {searchQuery && !isSearching && searchResults.length === 0 && (
                <div className="bg-slate-800 border border-slate-700 rounded-2xl p-12 text-center">
                  <FileSearch size={48} className="text-slate-600 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-white mb-2">File tidak ditemukan</h3>
                  <p className="text-slate-400 text-sm">Coba kata kunci yang berbeda.</p>
                </div>
              )}

              {!searchQuery && (
                <div className="bg-slate-800 border border-slate-700 rounded-2xl p-12 text-center">
                  <Search size={48} className="text-slate-600 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-white mb-2">Siap mencari</h3>
                  <p className="text-slate-400 text-sm">Ketik nama file di atas. Pencarian dilakukan langsung ke server.</p>
                </div>
              )}
            </div>
          )}

          {/* ====== EXPLORER ====== */}
          {activeTab === 'explorer' && (
            <div className="max-w-6xl mx-auto h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500 pb-8">
              <header className="mb-6">
                <h2 className="text-3xl font-bold text-white mb-1">Penjelajah File</h2>
                <p className="text-slate-400">Jelajahi isi setiap HDD secara langsung.</p>
              </header>

              {!explorerHddId ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {hdds.map(hdd => (
                    <button key={hdd.id} onClick={() => { setExplorerHddId(hdd.id); setExplorerPath(''); }}
                      className="bg-slate-800 border border-slate-700 hover:border-indigo-500 p-6 rounded-2xl text-left transition-all hover:shadow-lg hover:shadow-indigo-900/20 group">
                      <HardDrive size={32} className="text-indigo-400 mb-3 group-hover:scale-110 transition-transform" />
                      <h3 className="font-bold text-white text-lg mb-1">{hdd.name}</h3>
                      <p className="text-slate-400 text-sm">{(hdd.file_count || 0).toLocaleString()} file • {formatBytes(hdd.total_size || 0)}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex-1 bg-slate-800 border border-slate-700 rounded-2xl flex flex-col overflow-hidden shadow-xl">
                  {/* Toolbar */}
                  <div className="bg-slate-900/50 border-b border-slate-700 p-3 flex items-center gap-3">
                    <button onClick={() => { setExplorerHddId(null); setExplorerPath(''); setExplorerItems({ folders: [], files: [] }); }}
                      className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg border border-slate-600 transition-colors shrink-0">
                      <ArrowLeft size={16} />
                    </button>
                    <button onClick={() => {
                      const parts = explorerPath.split('\\').filter(Boolean);
                      parts.pop();
                      setExplorerPath(parts.join('\\'));
                    }}
                      disabled={!explorerPath}
                      className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg border border-slate-600 transition-colors disabled:opacity-40 shrink-0">
                      <ChevronLeft size={16} />
                    </button>

                    <div className="flex-1 bg-slate-800 border border-slate-600 rounded-lg flex items-center px-3 py-2 gap-1 overflow-x-auto whitespace-nowrap">
                      <button onClick={() => setExplorerPath('')} className="text-slate-400 hover:text-white shrink-0"><Home size={16} /></button>
                      <span className="text-slate-600 mx-1">/</span>
                      <span className="text-indigo-400 font-medium text-sm">{hdds.find(h => h.id === explorerHddId)?.name}</span>
                      {explorerPath.split('\\').filter(Boolean).map((part, idx, arr) => {
                        const partialPath = arr.slice(0, idx + 1).join('\\');
                        return (
                          <React.Fragment key={idx}>
                            <span className="text-slate-600 mx-1">\</span>
                            <button onClick={() => setExplorerPath(partialPath)} className="text-sm text-indigo-400 hover:text-indigo-300">{part}</button>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 overflow-y-auto p-4">
                    {isExplorerLoading ? (
                      <div className="flex items-center justify-center py-16 text-slate-500">
                        <Loader2 className="animate-spin mr-3" size={24} /> Memuat...
                      </div>
                    ) : (
                      <>
                        {explorerItems.folders.length === 0 && explorerItems.files.length === 0 && (
                          <div className="text-center py-12 text-slate-500">
                            <FolderOpen size={48} className="mx-auto mb-3 opacity-50" />
                            <p>Folder kosong</p>
                          </div>
                        )}
                        {explorerItems.folders.map(folder => (
                          <div key={folder.path} onClick={() => setExplorerPath(folder.path)}
                            className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-700 cursor-pointer transition-colors mb-1">
                            <FolderIcon size={18} className="text-yellow-400 shrink-0" />
                            <span className="text-slate-200 font-medium text-sm">{folder.name}</span>
                            <ChevronRight size={14} className="ml-auto text-slate-500" />
                          </div>
                        ))}
                        {explorerItems.files.map(f => (
                          <div key={f.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-700/50 transition-colors mb-1">
                            <FileIcon size={16} className="text-slate-500 shrink-0" />
                            <span className="text-slate-300 text-sm flex-1 truncate">{f.name}</span>
                            <span className="text-slate-500 text-xs">{formatBytes(f.size)}</span>
                            <span className="text-slate-600 text-xs ml-2">{f.date}</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ====== KELOLA HDD ====== */}
          {activeTab === 'hdds' && isEditor && (
            <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <header>
                <h2 className="text-3xl font-bold text-white mb-1">Kelola HDD</h2>
                <p className="text-slate-400">Upload dan kelola data HDD dari Snap2HTML.</p>
              </header>

              {/* Upload Form */}
              <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><UploadCloud size={20} className="text-indigo-400" /> Upload HDD Baru</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="md:col-span-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Label HDD</label>
                    <input type="text" value={uploadHddName} onChange={e => setUploadHddName(e.target.value)}
                      placeholder="Otomatis dari nama file"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 px-4 text-white text-sm focus:border-indigo-500 outline-none" />
                  </div>
                  <div className="md:col-span-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Kapasitas Fisik</label>
                    <select value={uploadHddCapacity} onChange={e => setUploadHddCapacity(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 px-4 text-white text-sm focus:border-indigo-500 outline-none">
                      {HDD_CAPACITIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-1 flex flex-col">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">File Snap2HTML</label>
                    <button onClick={() => fileInputRef.current?.click()}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors">
                      <UploadCloud size={18} /> Pilih File (.html)
                    </button>
                    <input ref={fileInputRef} type="file" accept=".html,.htm" multiple onChange={handleFileUpload} className="hidden" />
                  </div>
                </div>
                {uploadError && <p className="text-red-400 text-sm flex items-center gap-2"><AlertCircle size={16} />{uploadError}</p>}
              </div>

              {/* HDD List */}
              <div className="space-y-3">
                {hdds.map(hdd => {
                  const usedPct = hdd.capacity > 0 ? Math.min((hdd.total_size / hdd.capacity) * 100, 100) : 0;
                  const daysOld = getDaysOld(hdd.last_updated);
                  const isOld = daysOld > 90 && !hdd.warning_muted;
                  return (
                    <div key={hdd.id} className={`bg-slate-800 p-5 rounded-2xl border ${isOld ? 'border-yellow-600/40' : 'border-slate-700'} shadow-lg`}>
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <HardDrive size={22} className="text-indigo-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-bold text-white">{hdd.name}</p>
                            <p className="text-xs text-slate-400">{(hdd.file_count || 0).toLocaleString()} file • Update: {hdd.last_updated ? new Date(hdd.last_updated).toLocaleDateString('id-ID') : '-'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                          <button onClick={() => toggleHddWarning(hdd)} title={hdd.warning_muted ? 'Aktifkan Peringatan' : 'Matikan Peringatan'}
                            className={`p-2 rounded-lg transition-colors ${hdd.warning_muted ? 'text-slate-500 hover:text-yellow-400' : 'text-yellow-400 hover:text-slate-400'}`}>
                            {hdd.warning_muted ? <BellOff size={16} /> : <Bell size={16} />}
                          </button>
                          <button onClick={() => exportHddToHTML(hdd)} className="p-2 text-slate-400 hover:text-emerald-400 rounded-lg transition-colors" title="Export HTML">
                            <FileOutput size={16} />
                          </button>
                          <button onClick={() => { setReplacingHdd(hdd); setTimeout(() => replaceFileInputRef.current?.click(), 100); }}
                            className="p-2 text-slate-400 hover:text-indigo-400 rounded-lg transition-colors" title="Ganti Data">
                            <RefreshCw size={16} />
                          </button>
                          <button onClick={() => removeHdd(hdd.id)} className="p-2 text-slate-400 hover:text-red-400 rounded-lg transition-colors" title="Hapus HDD">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      
                      {/* Capacity row */}
                      <div className="flex items-center gap-3">
                        {editingCapacityId === hdd.id ? (
                          <div className="flex items-center gap-2 flex-1">
                            <select value={editCapacityVal} onChange={e => setEditCapacityVal(e.target.value)}
                              className="flex-1 bg-slate-900 border border-indigo-500 rounded-lg py-1.5 px-2 text-white text-xs">
                              {HDD_CAPACITIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                            </select>
                            <button onClick={() => updateHddCapacity(hdd.id)} className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg"><Save size={14} /></button>
                            <button onClick={() => setEditingCapacityId(null)} className="p-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"><X size={14} /></button>
                          </div>
                        ) : (
                          <div className="flex-1">
                            <div className="flex justify-between text-xs text-slate-500 mb-1">
                              <span>{formatBytes(hdd.total_size || 0)} / {formatBytes(hdd.capacity || HDD_CAPACITIES[1].value)}</span>
                              <button onClick={() => { setEditingCapacityId(hdd.id); setEditCapacityVal(hdd.capacity || HDD_CAPACITIES[1].value); }}
                                className="text-slate-500 hover:text-slate-300 transition-colors"><Pencil size={12} /></button>
                            </div>
                            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                              <div className={`h-full transition-all ${usedPct > 90 ? 'bg-red-500' : usedPct > 75 ? 'bg-orange-500' : 'bg-indigo-500'}`}
                                style={{ width: `${usedPct}%` }} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <input ref={replaceFileInputRef} type="file" accept=".html,.htm" onChange={handleReplaceUpload} className="hidden" />
            </div>
          )}

          {/* ====== DUPLICATES ====== */}
          {activeTab === 'duplicates' && isEditor && (
            <div className="max-w-6xl mx-auto flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
              <header className="mb-6">
                <h2 className="text-3xl font-bold text-white mb-1">Deteksi Duplikat</h2>
                <p className="text-slate-400">Duplikat dideteksi berdasarkan nama file + ukuran + tanggal modifikasi. Lebih akurat untuk file kamera.</p>
              </header>

              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 mb-4 flex flex-wrap items-center gap-4 justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-2xl font-bold text-red-400">{formatBytes(totalWasted)}</p>
                    <p className="text-xs text-slate-400">Ruang terbuang dari {duplicateGroups.length} grup</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedFileIds.size > 0 && (
                    <span className="text-sm text-white bg-slate-700 px-3 py-1.5 rounded-lg">{selectedFileIds.size} dipilih</span>
                  )}
                  <button onClick={() => setSelectedFileIds(new Set())} disabled={selectedFileIds.size === 0}
                    className="px-3 py-1.5 text-sm text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-40">Batal Pilih</button>
                  <button onClick={smartSelectDuplicates}
                    className="px-3 py-1.5 text-sm text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors">Pilih Otomatis</button>
                  <button onClick={() => { setDuplicateGroups([]); setSelectedFileIds(new Set()); loadDuplicates(0); }}
                    className="p-2 text-slate-400 hover:text-white bg-slate-700 rounded-lg transition-colors"><RefreshCw size={16} /></button>
                </div>
              </div>

              {isLoadingDuplicates && duplicateGroups.length === 0 ? (
                <div className="flex-1 flex items-center justify-center py-16 text-slate-500">
                  <Loader2 className="animate-spin mr-3" size={24} /> Menganalisis duplikat dari server...
                </div>
              ) : duplicateGroups.length === 0 ? (
                <div className="bg-slate-800 border border-emerald-500/30 rounded-2xl p-12 text-center">
                  <CheckSquare size={48} className="text-emerald-400 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">Tidak ada duplikat!</h3>
                  <p className="text-slate-400">Database bersih.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {duplicateGroups.map((group) => (
                    <DuplicateGroupItem key={group.key} group={group} selectedFileIds={selectedFileIds} onToggle={toggleFileSelection} />
                  ))}
                  {isLoadingDuplicates && (
                    <div className="text-center py-4 text-slate-500"><Loader2 className="animate-spin mx-auto" size={24} /></div>
                  )}
                </div>
              )}

              {selectedFileIds.size > 0 && (
                <div className="fixed bottom-0 right-0 left-0 md:left-auto bg-slate-800 border-t border-slate-700 p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-20">
                  <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-lg font-bold text-white">{selectedFileIds.size} file terpilih</h4>
                      <p className="text-sm text-slate-400">Pilih aksi yang akan dilakukan.</p>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={generateBatScript}
                        className="bg-red-600 hover:bg-red-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all hover:scale-105">
                        <Download size={16} /> Script (.bat)
                      </button>
                      <button onClick={applyDeleteDuplicates} disabled={isProcessing}
                        className="bg-orange-600 hover:bg-orange-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all hover:scale-105 disabled:opacity-50">
                        <Cloud size={16} /> Hapus DB
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ====== CEK HDD PRIBADI ====== */}
          {activeTab === 'check-local' && (
            <div className="max-w-6xl mx-auto flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500 pb-8 space-y-6">
              <header>
                <h2 className="text-3xl font-bold text-white mb-1">Cek HDD Pribadi</h2>
                <p className="text-slate-400">Upload file scan Snap2HTML dari HDD pribadi untuk dicek apakah sudah ada di server. <span className="text-indigo-400 font-medium">Data tidak disimpan ke cloud.</span></p>
              </header>

              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
                <input ref={localFileInputRef} type="file" accept=".html,.htm" onChange={handleLocalScanUpload} className="hidden" />
                <button onClick={() => localFileInputRef.current?.click()} disabled={isCheckingLocal}
                  className="w-full border-2 border-dashed border-slate-600 hover:border-indigo-500 rounded-xl py-10 flex flex-col items-center gap-3 transition-colors group cursor-pointer disabled:opacity-50">
                  {isCheckingLocal ? <Loader2 className="animate-spin text-indigo-400" size={40} /> : <UploadCloud size={40} className="text-slate-500 group-hover:text-indigo-400 transition-colors" />}
                  <p className="font-bold text-slate-300 group-hover:text-white transition-colors">{isCheckingLocal ? 'Menganalisis...' : 'Pilih file Snap2HTML'}</p>
                  <p className="text-slate-500 text-sm">Format: .html dari Snap2HTML</p>
                </button>
              </div>

              {localCheckResults && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: 'Total File Lokal', value: (localScanFiles || []).length.toLocaleString(), color: 'text-white' },
                      { label: 'Sudah di Server', value: localCheckResults.duplicates.length.toLocaleString(), color: 'text-emerald-400' },
                      { label: 'Belum di Server', value: localCheckResults.unique.length.toLocaleString(), color: 'text-orange-400' },
                    ].map((s, i) => (
                      <div key={i} className="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center">
                        <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                        <p className="text-xs text-slate-400 mt-1">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  <p className="text-sm text-slate-400">Nama file: <span className="font-bold text-white">{localScanName}</span></p>

                  {localCheckResults.duplicates.length > 0 && (
                    <div className="bg-slate-800 border border-emerald-500/30 rounded-2xl overflow-hidden">
                      <div className="bg-emerald-500/10 p-4 border-b border-emerald-500/20">
                        <h3 className="text-emerald-400 font-bold flex items-center gap-2"><CheckSquare size={18} /> Sudah ada di Server ({localCheckResults.duplicates.length})</h3>
                      </div>
                      <div className="overflow-x-auto max-h-64 overflow-y-auto">
                        <table className="w-full text-sm">
                          <tbody className="divide-y divide-slate-700/50">
                            {localCheckResults.duplicates.slice(0, 100).map((item, i) => (
                              <tr key={i} className="hover:bg-slate-700/30">
                                <td className="px-4 py-2 text-slate-300 font-medium">{item.local.name}</td>
                                <td className="px-4 py-2 text-emerald-400 text-xs">{item.cloud[0]?.hdd_name}</td>
                                <td className="px-4 py-2 text-slate-400 text-xs">{formatBytes(item.local.size)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {localCheckResults.unique.length > 0 && (
                    <div className="bg-slate-800 border border-orange-500/30 rounded-2xl overflow-hidden">
                      <div className="bg-orange-500/10 p-4 border-b border-orange-500/20">
                        <h3 className="text-orange-400 font-bold flex items-center gap-2"><AlertTriangle size={18} /> Belum ada di Server ({localCheckResults.unique.length})</h3>
                      </div>
                      <div className="overflow-x-auto max-h-64 overflow-y-auto">
                        <table className="w-full text-sm">
                          <tbody className="divide-y divide-slate-700/50">
                            {localCheckResults.unique.slice(0, 100).map((f, i) => (
                              <tr key={i} className="hover:bg-slate-700/30">
                                <td className="px-4 py-2 text-slate-300">{f.name}</td>
                                <td className="px-4 py-2 text-slate-400 text-xs">{f.path}</td>
                                <td className="px-4 py-2 text-slate-500 text-xs">{formatBytes(f.size)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ====== AUDIT SHEET ====== */}
          {activeTab === 'audit' && (
            <div className="max-w-6xl mx-auto h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500 pb-8">
              <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-1">Audit Sheet</h2>
                  <p className="text-slate-400">Cocokkan project di Google Sheets dengan data di server.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {auditData && (
                    <>
                      <button onClick={() => {
                        if (!displayedAudit) return;
                        const text = `*AUDIT BREAKER HDD*\n📊 Total: ${auditData.length}\n✅ Aman: ${displayedAudit.found.length}\n❌ Tidak Ditemukan: ${displayedAudit.missing.length}\n\n*MISSING:*\n${displayedAudit.missing.slice(0, 20).map((p, i) => `${i + 1}. ${p.name}`).join('\n')}`;
                        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                      }} className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded-xl text-sm flex items-center gap-2">
                        <MessageCircle size={16} /> WA
                      </button>
                      <button onClick={() => {
                        if (!displayedAudit) return;
                        const html = `<html><head><title>Audit Report</title><style>body{font-family:Arial,sans-serif;padding:30px;}table{width:100%;border-collapse:collapse;}th,td{border:1px solid #e2e8f0;padding:8px 12px;text-align:left;}th{background:#f1f5f9;}</style></head><body><h1>Laporan Audit Proyek Breaker</h1><p>Total: ${auditData.length} | Aman: ${displayedAudit.found.length} | Missing: ${displayedAudit.missing.length}</p><h2>Tidak Ditemukan</h2><table><thead><tr><th>No</th><th>Nama Proyek</th><th>Kategori</th></tr></thead><tbody>${displayedAudit.missing.map((p, i) => `<tr><td>${i + 1}</td><td>${p.name}</td><td>${p.category}</td></tr>`).join('')}</tbody></table><h2>Aman</h2><table><thead><tr><th>No</th><th>Nama Proyek</th><th>Kategori</th><th>Lokasi</th></tr></thead><tbody>${displayedAudit.found.map((p, i) => `<tr><td>${i + 1}</td><td>${p.name}</td><td>${p.category}</td><td style="font-size:11px;color:#64748b">${p.foundPath}</td></tr>`).join('')}</tbody></table><script>window.onload=()=>window.print();</script></body></html>`;
                        const w = window.open('', '_blank');
                        if (w) { w.document.write(html); w.document.close(); }
                      }} className="bg-rose-600 hover:bg-rose-500 text-white font-bold py-2 px-4 rounded-xl text-sm flex items-center gap-2">
                        <Printer size={16} /> PDF
                      </button>
                    </>
                  )}
                  <button onClick={handleAuditSheet} disabled={isAuditing}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-xl text-sm flex items-center gap-2 disabled:opacity-50">
                    {isAuditing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Refresh
                  </button>
                </div>
              </header>

              {isAuditing ? (
                <div className="flex-1 bg-slate-800 border border-slate-700 rounded-2xl flex items-center justify-center flex-col gap-3 p-8 text-center">
                  <Loader2 size={48} className="animate-spin text-emerald-500" />
                  <h3 className="text-xl font-bold text-white">Menganalisis Sheet...</h3>
                  <p className="text-slate-400 text-sm">Mencocokkan data spreadsheet dengan folder di semua HDD.</p>
                </div>
              ) : auditData && (
                <div className="flex-1 min-h-0 flex flex-col gap-4">
                  <div className="bg-slate-800 border border-slate-700 rounded-xl p-2 flex flex-wrap gap-2">
                    <div className="px-3 py-1.5 text-slate-500 flex items-center gap-2 text-sm font-bold border-r border-slate-700"><Filter size={16} /> Kategori</div>
                    {['All', 'Video', 'Visual', 'Isadaya', 'Lainnya'].map(cat => (
                      <button key={cat} onClick={() => setAuditFilter(cat)}
                        className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${auditFilter === cat ? 'bg-indigo-600 text-white' : 'bg-slate-900/50 text-slate-400 hover:text-white hover:bg-slate-700'}`}>
                        {cat === 'All' ? 'Semua' : cat}
                      </button>
                    ))}
                  </div>

                  <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">
                    <div className="flex-1 bg-slate-800 border border-red-500/30 rounded-2xl flex flex-col overflow-hidden">
                      <div className="bg-red-500/10 p-4 border-b border-red-500/20 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-red-400 font-bold"><AlertTriangle size={18} /> Tidak Ditemukan</div>
                        <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-md">{displayedAudit?.missing.length || 0}</span>
                      </div>
                      <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {displayedAudit?.missing.map((proj, idx) => (
                          <div key={idx} className="bg-slate-900 border border-slate-700 p-3 rounded-lg flex items-center gap-3">
                            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <span className="text-sm font-medium text-slate-200 block truncate">{proj.name}</span>
                              <span className="text-[10px] text-slate-500 uppercase">{proj.category}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex-1 bg-slate-800 border border-emerald-500/30 rounded-2xl flex flex-col overflow-hidden">
                      <div className="bg-emerald-500/10 p-4 border-b border-emerald-500/20 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-emerald-400 font-bold"><CheckSquare size={18} /> Ter-Backup</div>
                        <span className="bg-emerald-500 text-white text-xs font-bold px-2.5 py-1 rounded-md">{displayedAudit?.found.length || 0}</span>
                      </div>
                      <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {displayedAudit?.found.map((proj, idx) => (
                          <div key={idx} className="bg-slate-900 border border-slate-700 p-3 rounded-lg flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <span className="text-sm font-medium text-slate-300 block truncate">{proj.name}</span>
                                <span className="text-[10px] text-slate-500 uppercase">{proj.category}</span>
                              </div>
                            </div>
                            <button onClick={() => { setExplorerHddId(null); setExplorerPath(''); switchTab('explorer'); }}
                              className="p-2 bg-slate-800 hover:bg-indigo-500 text-slate-400 hover:text-white border border-slate-600 rounded-lg transition-all shrink-0">
                              <FolderOpen size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ====== USERS (ADMIN) ====== */}
          {activeTab === 'users' && isAdmin && (
            <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-8">
              <header className="mb-6">
                <h2 className="text-3xl font-bold text-white mb-1">Manajemen Akun</h2>
                <p className="text-slate-400">Kelola role pengguna. Untuk menambah admin pertama, ubah role di Supabase Table Editor.</p>
              </header>
              <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden shadow-xl">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-900/50 text-slate-400 uppercase text-xs">
                    <tr>
                      <th className="px-6 py-4 font-bold">Email</th>
                      <th className="px-6 py-4 font-bold">Role</th>
                      <th className="px-6 py-4 font-bold">Bergabung</th>
                      <th className="px-6 py-4 font-bold text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {usersList.map(u => (
                      <tr key={u.id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="px-6 py-4 font-medium text-white">{u.email}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase ${u.role === 'admin' ? 'bg-indigo-500/20 text-indigo-400' : u.role === 'editor' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>{u.role}</span>
                        </td>
                        <td className="px-6 py-4 text-slate-400 text-xs">{u.created_at ? new Date(u.created_at).toLocaleDateString('id-ID') : '-'}</td>
                        <td className="px-6 py-4 text-right">
                          {u.id !== session.user.id && (
                            <div className="flex items-center gap-2 justify-end">
                              {['viewer', 'editor', 'admin'].filter(r => r !== u.role).map(r => (
                                <button key={r} onClick={() => updateUserRole(u.id, u.email, r)}
                                  className="text-xs px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg transition-colors">
                                  → {r}
                                </button>
                              ))}
                              <button onClick={() => deleteUserProfile(u.id, u.email)}
                                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ====== LOGS (ADMIN) ====== */}
          {activeTab === 'logs' && isAdmin && (
            <div className="max-w-6xl mx-auto flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500 pb-8">
              <header className="mb-6">
                <h2 className="text-3xl font-bold text-white mb-1">Riwayat Aktivitas</h2>
                <p className="text-slate-400">Pantau semua perubahan pada database.</p>
              </header>
              <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-900/50 text-slate-400 uppercase text-xs sticky top-0 backdrop-blur-sm">
                      <tr>
                        <th className="px-6 py-4 font-bold">Waktu</th>
                        <th className="px-6 py-4 font-bold">Pengguna</th>
                        <th className="px-6 py-4 font-bold">Aktivitas</th>
                        <th className="px-6 py-4 font-bold w-1/2">Detail</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {logs.length === 0 ? (
                        <tr><td colSpan="4" className="px-6 py-12 text-center text-slate-500">Belum ada riwayat.</td></tr>
                      ) : (
                        logs.map(log => (
                          <tr key={log.id} className="hover:bg-slate-700/30 transition-colors">
                            <td className="px-6 py-4 text-slate-400 text-xs">{new Date(log.timestamp).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</td>
                            <td className="px-6 py-4 font-medium text-slate-300 text-sm">{log.user_email}</td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${log.action?.includes('DELETE') ? 'bg-red-500/20 text-red-400' : log.action?.includes('UPLOAD') ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                {log.action?.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-300 text-sm whitespace-normal">{log.details}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ====== PANDUAN ====== */}
          {activeTab === 'tutorial' && (
            <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-8 space-y-6">
              <header>
                <h2 className="text-3xl font-bold text-white mb-1">Panduan Penggunaan</h2>
                <p className="text-slate-400">Cara menggunakan Breaker HDD Manager.</p>
              </header>
              {[
                { icon: <HardDrive className="text-indigo-400" size={22} />, title: '1. Scan HDD dengan Snap2HTML', body: 'Download Snap2HTML di snap2html.se. Jalankan, pilih drive HDD kamu, lalu export sebagai file .html. File ini berisi seluruh daftar file di HDD tersebut.' },
                { icon: <UploadCloud className="text-emerald-400" size={22} />, title: '2. Upload ke Server', body: 'Buka tab Kelola HDD, masukkan label HDD, pilih kapasitas fisik, lalu pilih file .html hasil scan. File akan diproses dan disimpan ke cloud database.' },
                { icon: <Search className="text-yellow-400" size={22} />, title: '3. Cari File', body: 'Gunakan tab Cari File untuk mencari file berdasarkan nama. Pencarian dilakukan langsung ke server sehingga cepat meski data jutaan file.' },
                { icon: <Files className="text-red-400" size={22} />, title: '4. Deteksi Duplikat', body: 'Tab Cari Duplikat mendeteksi file yang sama menggunakan kombinasi nama + ukuran + tanggal modifikasi. Lebih akurat untuk file kamera yang memiliki nama sama tapi isi berbeda.' },
                { icon: <Laptop className="text-purple-400" size={22} />, title: '5. Cek HDD Pribadi', body: 'Upload scan dari HDD atau laptop pribadi untuk mengecek apakah file-file di dalamnya sudah ada di server atau belum. Cocok sebelum hapus data lokal.' },
                { icon: <FileSpreadsheet className="text-cyan-400" size={22} />, title: '6. Audit Sheet', body: 'Cocokkan daftar project di Google Sheets dengan data di server. Langsung ketahui project mana yang belum ter-backup.' },
              ].map((item, i) => (
                <div key={i} className="bg-slate-800 border border-slate-700 rounded-2xl p-5 flex gap-4">
                  <div className="mt-0.5 shrink-0">{item.icon}</div>
                  <div>
                    <h3 className="font-bold text-white mb-1">{item.title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ============================================================
// DUPLICATE GROUP ITEM COMPONENT
// ============================================================
function DuplicateGroupItem({ group, selectedFileIds, onToggle }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const instances = group.instances || [];
  const selectedCount = instances.filter(f => selectedFileIds.has(f.id)).length;

  return (
    <div className={`border rounded-xl transition-colors ${isExpanded ? 'bg-slate-800/80 border-slate-600' : 'bg-slate-900/30 border-slate-700/50 hover:border-slate-600'}`}>
      <div className="p-4 grid grid-cols-12 gap-4 items-center cursor-pointer select-none" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="col-span-7 md:col-span-6 flex items-center gap-3">
          {isExpanded ? <ChevronDown size={16} className="text-slate-500 shrink-0" /> : <ChevronRight size={16} className="text-slate-500 shrink-0" />}
          <Files size={16} className="text-indigo-400 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white truncate">{group.name}</p>
            <p className="text-xs text-slate-400">{formatBytes(group.size)} • {group.count} copy</p>
          </div>
        </div>
        <div className="hidden md:flex md:col-span-4 flex-wrap gap-1 justify-center">
          {[...new Set(instances.map(f => f.hdd_name))].map(hdd => (
            <span key={hdd} className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded border border-slate-600 truncate max-w-[100px]">{hdd}</span>
          ))}
        </div>
        <div className="col-span-5 md:col-span-2 text-right flex flex-col items-end gap-1">
          <span className="text-sm font-bold text-red-400">{formatBytes(group.wasted)}</span>
          {selectedCount > 0 && <span className="text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">{selectedCount} ditandai</span>}
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-slate-700/50 bg-slate-900/50 p-2 space-y-1 rounded-b-xl">
          {instances.map(file => {
            const isSelected = selectedFileIds.has(file.id);
            return (
              <div key={file.id}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer ${isSelected ? 'bg-red-500/10 border border-red-500/30' : 'hover:bg-slate-800 border border-transparent'}`}
                onClick={() => onToggle(file.id)}>
                <div className="shrink-0 text-slate-400">
                  {isSelected ? <CheckSquare size={16} className="text-red-500" /> : <Square size={16} />}
                </div>
                <div className="px-2 py-0.5 bg-slate-800 rounded text-xs font-bold text-indigo-300 border border-slate-700 shrink-0 max-w-[80px] truncate">{file.hdd_name}</div>
                <div className="flex-1 min-w-0 text-sm text-slate-300 truncate">
                  <span className="text-slate-500 hidden sm:inline">{file.path} \ </span>
                  <span className={isSelected ? 'text-red-300 line-through opacity-70' : 'text-slate-200'}>{file.name}</span>
                </div>
                <div className="text-xs text-slate-500 shrink-0 hidden sm:block">{file.date}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}