"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { 
  X, User, FileText, Link as LinkIcon, Calendar, 
  Plus, Trash2, Mail, Layers, Lock, Unlock, RotateCcw, 
  Wallet, DollarSign, Building, MapPin, Loader2, Navigation, Camera, Mic, Square, Play, Pause,
  ChevronUp, ChevronDown, Search, Clock, Eye, ChevronRight, AlertCircle, FolderOpen,
  Bug, Lightbulb, CheckSquare, Video, Save, Maximize2
} from "lucide-react";
import styles from "./TaskDetail.module.css";

interface TaskDetailProps {
  task: any;
  allTasks: any[];
  onClose: () => void;
  onUpdate: (id: string, data: any) => void;
  onDelete: (id: string) => void;
  onRestore?: (id: string) => void;
}

export const TaskDetail: React.FC<TaskDetailProps> = ({ 
  task, allTasks, onClose, onUpdate, onDelete, onRestore 
}) => {
  const [title, setTitle] = useState(task.title);
  const [slug, setSlug] = useState(task.slug || "");
  const [blogTemplate, setBlogTemplate] = useState(task.blogTemplate || "MODERN");
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingClip, setIsGeneratingClip] = useState(false);
  const [description, setDescription] = useState(task.description || "");
  const [priority, setPriority] = useState(task.priority);
  const [parentId, setParentId] = useState(task.parentId || "");
  const [lockStatus, setLockStatus] = useState(task.lockStatus || false);
  const [taskType, setTaskType] = useState(task.taskType);
  const [amount, setAmount] = useState(task.amount || "");
  const [currency, setCurrency] = useState(task.currency || "CZK");
  const [payee, setPayee] = useState(task.payee || "");
  const [recordedAt, setRecordedAt] = useState(task.recordedAt ? new Date(task.recordedAt).toISOString().slice(0, 16) : "");
  const [odometer, setOdometer] = useState(task.odometer || "");
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [payees, setPayees] = useState<any[]>([]);
  const isLocationHistory = taskType === "LOCATION_HISTORY";
  const isLocation = taskType === "LOCATION";
  const isExpense = taskType === "EXPENSE";
  const [categories, setCategories] = useState<any[]>([]);
  const [categoryId, setCategoryId] = useState(task.categoryId || "");
  const [showPayeeSuggestions, setShowPayeeSuggestions] = useState(false);

  // Location logic in task
  const [loadingLoc, setLoadingLoc] = useState(false);
  const [currentLoc, setCurrentLoc] = useState<any>(null);
  const [locNote, setLocNote] = useState("");
  const [locSearch, setLocSearch] = useState("");
  const [locSuggestions, setLocSuggestions] = useState<any[]>([]);
  const [locHistory, setLocHistory] = useState(task.locations || []);

  // Attachments logic
  const [attachments, setAttachments] = useState(task.attachments || []);
  const [isRecording, setIsRecording] = useState(false);
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isDictating, setIsDictating] = useState(false);
  const [nearbyPlaces, setNearbyPlaces] = useState<any[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(false);

  // Fetch payees & categories for codelist
  React.useEffect(() => {
    fetch("/api/payees")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setPayees(data);
      });
    
    fetch("/api/categories")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setCategories(data);
      });
  }, []);

  // Synchronize state when task changes
  React.useEffect(() => {
    setTitle(task.title);
    setSlug(task.slug || "");
    setBlogTemplate(task.blogTemplate || "MODERN");
    setDescription(task.description || "");
    setPriority(task.priority);
    setParentId(task.parentId || "");
    setLockStatus(task.lockStatus || false);
    setTaskType(task.taskType);
    setAmount(task.amount || "");
    setCurrency(task.currency || "CZK");
    setPayee(task.payee || "");
    setRecordedAt(task.recordedAt ? new Date(task.recordedAt).toISOString().slice(0, 16) : "");
    setOdometer(task.odometer || "");
    setCategoryId(task.categoryId || "");
    setLocHistory(task.locations || []);
    setAttachments(task.attachments || []);
  }, [task]);

  const getGPS = () => {
    setLoadingLoc(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`, { headers: { "Accept-Language": "cs" } });
          const data = await res.json();
          setCurrentLoc({ lat: latitude, lng: longitude, address: data.display_name, placeName: data.address.amenity || data.address.shop || data.address.road });
        } catch (err) {
          setCurrentLoc({ lat: latitude, lng: longitude, address: `${latitude}, ${longitude}`, placeName: "Neznámé místo" });
        } finally { setLoadingLoc(false); }
      },
      () => { alert("Povolte prosím GPS."); setLoadingLoc(false); },
      { enableHighAccuracy: true }
    );
  };

  const handleSaveLoc = async () => {
    if (!currentLoc) return;
    try {
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: task.id,
          latitude: currentLoc.lat,
          longitude: currentLoc.lng,
          address: currentLoc.address,
          placeName: currentLoc.placeName,
          note: locNote,
          recordedAt: recordedAt ? new Date(recordedAt).toISOString() : new Date().toISOString()
        }),
      });
      if (res.ok) {
        const saved = await res.json();
        setLocHistory([saved, ...locHistory]);
        setCurrentLoc(null);
        setLocNote("");
      }
    } catch (err) { console.error(err); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    for (const file of files) {
      try {
        let finalUrl = "";
        let type = "file";

        if (file.type.startsWith("image/")) {
          type = "image";
          finalUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
              const img = new Image();
              img.onload = () => {
                const canvas = document.createElement("canvas");
                const MAX_WIDTH = 1600;
                const MAX_HEIGHT = 1600;
                let width = img.width;
                let height = img.height;
                if (width > height) {
                  if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                } else {
                  if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx?.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL("image/jpeg", 0.8));
              };
              img.onerror = () => reject(new Error("Image load error"));
              img.src = event.target?.result as string;
            };
            reader.onerror = () => reject(new Error("File read error"));
            reader.readAsDataURL(file);
          });
        } else if (file.type.startsWith("video/")) {
          type = "video";
          if (file.size > 20 * 1024 * 1024) {
            alert("Video je příliš velké (max 20MB).");
            continue;
          }
          finalUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.readAsDataURL(file);
          });
        } else {
          finalUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.readAsDataURL(file);
          });
        }

        const res = await fetch(`/api/tasks/${task.id}/attachments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: file.name, url: finalUrl, type })
        });
        if (res.ok) {
          const newAtt = await res.json();
          setAttachments((prev: any) => [...prev, newAtt]);
        }
      } catch (err) {
        console.error("Upload failed for:", file.name, err);
      }
    }
    setIsUploading(false);
    if (e.target) e.target.value = "";
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result as string;
          try {
            const res = await fetch(`/api/tasks/${task.id}/attachments`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: `Hlasová poznámka ${new Date().toLocaleTimeString()}`, url: base64, type: "audio" })
            });
            if (res.ok) {
              const newAtt = await res.json();
              setAttachments([...attachments, newAtt]);
            }
          } catch (err) { console.error(err); }
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setRecorder(mediaRecorder);
      setIsRecording(true);
      
      const timer = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
      (mediaRecorder as any)._timer = timer;

    } catch (err) {
      alert("Nepodařilo se přistoupit k mikrofonu.");
    }
  };

  const stopRecording = () => {
    if (recorder) {
      recorder.stop();
      clearInterval((recorder as any)._timer);
      setIsRecording(false);
      setRecordingTime(0);
    }
  };

  const startDictation = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Hlasový vstup není v tomto prohlížeči podporován.");

    const recognition = new SpeechRecognition();
    recognition.lang = 'cs-CZ';
    recognition.continuous = false; // Stop after a pause for better UX
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        const newDesc = description + (description ? " " : "") + transcript;
        setDescription(newDesc);
        onUpdate(task.id, { description: newDesc });
      }
    };

    recognition.onstart = () => setIsDictating(true);
    recognition.onend = () => setIsDictating(false);
    recognition.onerror = () => setIsDictating(false);

    recognition.start();
    (window as any)._recognition = recognition;
  };

  const stopDictation = () => {
    if ((window as any)._recognition) {
      (window as any)._recognition.stop();
    }
  };

  const handleDeleteAttachment = async (attId: string) => {
    if (!confirm("Smazat tuto přílohu?")) return;
    try {
      const res = await fetch(`/api/tasks/${task.id}/attachments/${attId}`, { method: "DELETE" });
      if (res.ok) {
        setAttachments(attachments.filter((a: any) => a.id !== attId));
      }
    } catch (err) { console.error(err); }
  };

  const handleSaveDescription = () => {
    if (description !== task.description) {
      onUpdate(task.id, { description });
    }
  };

  const handleSaveTitle = () => {
    if (title !== task.title) {
      onUpdate(task.id, { title });
    }
  };

  const handlePriorityChange = (newPriority: string) => {
    setPriority(newPriority);
    onUpdate(task.id, { priority: newPriority });
  };

  const handleParentChange = (newParentId: string) => {
      const pId = newParentId === "" ? null : newParentId;
      setParentId(newParentId);
      onUpdate(task.id, { parentId: pId });
  };

  const handleLockStatusChange = (newLock: boolean) => {
    setLockStatus(newLock);
    onUpdate(task.id, { lockStatus: newLock });
  };

  const handleTaskTypeChange = (newType: string) => {
    setTaskType(newType);
    onUpdate(task.id, { taskType: newType });
  };

  const handleExpenseUpdate = () => {
    onUpdate(task.id, { 
      amount: amount === "" ? null : parseFloat(amount.toString()), 
      currency, 
      payee 
    });
  };

  const handleRecordedAtChange = (val: string) => {
    setRecordedAt(val);
    onUpdate(task.id, { recordedAt: val ? new Date(val).toISOString() : null });
  };

  const handleOdometerChange = (val: string) => {
    setOdometer(val);
  };

  const handleOdometerBlur = () => {
    const val = odometer === "" ? null : parseFloat(odometer);
    onUpdate(task.id, { odometer: val });
  };

  const handleDelete = () => {
    if (confirm("Opravdu chcete tento úkol smazat?")) {
      onDelete(task.id);
      onClose();
    }
  };

  const handleMoveSubtask = async (stId: string, direction: 'up' | 'down') => {
    const subtasks = [...(task.subTasks || [])].sort((a, b) => a.orderIndex - b.orderIndex);
    const idx = subtasks.findIndex(s => s.id === stId);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === subtasks.length - 1) return;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const temp = subtasks[idx].orderIndex;
    subtasks[idx].orderIndex = subtasks[targetIdx].orderIndex;
    subtasks[targetIdx].orderIndex = temp;

    // Persist changes
    try {
      await Promise.all([
        fetch(`/api/tasks/${subtasks[idx].id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderIndex: subtasks[idx].orderIndex }) }),
        fetch(`/api/tasks/${subtasks[targetIdx].id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderIndex: subtasks[targetIdx].orderIndex }) })
      ]);
      onUpdate(task.id, { subTasks: subtasks });
    } catch (err) {}
  };

  const searchLocations = async (query: string) => {
    if (query.length < 3) return;
    setLoadingLoc(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5`, { headers: { "Accept-Language": "cs" } });
      const data = await res.json();
      setLocSuggestions(data.map((d: any) => ({
        lat: parseFloat(d.lat),
        lng: parseFloat(d.lon),
        address: d.display_name,
        placeName: d.address.road || d.address.suburb || d.address.city || d.display_name.split(',')[0]
      })));
    } catch (err) {} finally { setLoadingLoc(false); }
  };

  const fetchNearbyPlaces = async (lat: number, lon: number) => {
    setLoadingNearby(true);
    try {
      const query = `[out:json];node(around:150,${lat},${lon})[name];out 10;`;
      const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.elements) {
        setNearbyPlaces(data.elements.map((e: any) => ({
          name: e.tags.name,
          lat: e.lat,
          lon: e.lon
        })));
      }
    } catch (err) {
      console.error("Failed to fetch nearby places", err);
    } finally {
      setLoadingNearby(false);
    }
  };

  const handleGenerateClip = async () => {
    if (!confirm("Vytvořit krátký sestřih z nahraných videí? (Z každého videa vybereme nejlepší vteřiny a spojíme je do jednoho klipu)")) return;
    
    setIsGeneratingClip(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/generate-clip`, { method: "POST" });
      if (res.ok) {
        const newAtt = await res.json();
        setAttachments((prev: any) => [...prev, newAtt]);
        alert("Film byl úspěšně vygenerován a přidán do příloh!");
      } else {
        const err = await res.json();
        alert(`Chyba při generování filmu: ${err.error || "Neznámá chyba"}`);
      }
    } catch (err) {
      alert("Nepodařilo se spustit generování filmu.");
    } finally {
      setIsGeneratingClip(false);
    }
  };

  const handleSubtaskAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;

    try {
      const nextOrder = (task.subTasks?.length || 0);
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          title: newSubtaskTitle,
          status: "TODO",
          priority: task.priority,
          taskType: "TASK",
          parentId: task.id,
          orderIndex: nextOrder
        }),
      });
      if (res.ok) {
        const newTask = await res.json();
        onUpdate(task.id, { subTasks: [...(task.subTasks || []), newTask] });
        setNewSubtaskTitle("");
      }
    } catch (error) {
      console.error("Failed to add subtask", error);
    }
  };

  const [isNotesFullScreen, setIsNotesFullScreen] = useState(false);

  return (
    <motion.div 
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className={styles.sidebar}
    >
      {isNotesFullScreen && (
        <div className="fixed inset-0 z-[3000] bg-white flex flex-col p-6 animate-in slide-in-from-bottom duration-300">
           <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-stone-950 uppercase tracking-widest">Deníček</h3>
              <button 
                onClick={() => {
                  setIsNotesFullScreen(false);
                  handleSaveDescription();
                }} 
                className="p-3 bg-stone-100 rounded-2xl active:scale-95 transition-transform"
              >
                <Save size={24} className="text-stone-950" />
              </button>
           </div>
           <textarea 
              className="flex-1 w-full p-6 text-lg leading-relaxed bg-stone-50 rounded-[40px] outline-none border-2 border-stone-100 focus:border-stone-200 transition-colors"
              value={description}
              autoFocus
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Pište své zážitky..."
           />
        </div>
      )}

      <header className={styles.header}>
        <div className={styles.titleSection}>
          <input 
            className={styles.titleInput}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSaveTitle}
          />
          <div className="flex gap-2">
            <div className="flex items-center gap-2">
              <div className={styles.typeIconBadge}>
                {taskType === 'BUG' && <Bug size={14} />}
                {taskType === 'IDEA' && <Lightbulb size={14} />}
                {taskType === 'EXPENSE' && <Wallet size={14} />}
                {taskType === 'LOCATION_HISTORY' && <Navigation size={14} />}
                {taskType === 'LOCATION' && <MapPin size={14} />}
                {taskType === 'FOLDER' && <FolderOpen size={14} />}
                {taskType === 'GPS_LOG' && <Navigation size={14} />}
                {(taskType === 'TASK' || !['BUG','IDEA','EXPENSE','LOCATION_HISTORY','LOCATION','FOLDER','GPS_LOG'].includes(taskType)) && <CheckSquare size={14} />}
              </div>
              <select 
                value={taskType}
                onChange={(e) => handleTaskTypeChange(e.target.value)}
                className={styles.typeSelectMinimal}
              >
                <option value="TASK">Úkol</option>
                <option value="BUG">Bug</option>
                <option value="IDEA">Nápad</option>
                <option value="EXPENSE">Náklady</option>
                <option value="LOCATION_HISTORY">Cesta (Složka)</option>
                <option value="LOCATION">Zastávka</option>
                <option value="FOLDER">Projekt (Složka)</option>
                <option value="GPS_LOG">Zápis trasy (Map-only)</option>
              </select>
            </div>
            {taskType !== "LOCATION_HISTORY" && (
              <select 
                value={priority}
                onChange={(e) => handlePriorityChange(e.target.value)}
                className={styles.prioritySelect}
                style={{ color: priority === 'URGENT' ? '#dc2626' : 'inherit' }}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
             <Clock size={12} className="opacity-40" />
              <input 
                type="datetime-local" 
                className={styles.recordedAtInput}
                value={recordedAt}
                onChange={(e) => handleRecordedAtChange(e.target.value)}
              />
           </div>
           {isLocation && (
             <div className="flex items-center gap-2 mt-1">
                <Navigation size={12} className="opacity-40" />
                <input 
                  type="number"
                  placeholder="Stav km (tachometr)..."
                  className={styles.odometerInput}
                  value={odometer}
                  onChange={(e) => handleOdometerChange(e.target.value)}
                  onBlur={handleOdometerBlur}
                />
                <span className="text-[10px] opacity-40 font-bold">KM</span>
             </div>
           )}
        </div>
        <button onClick={onClose} className={styles.closeBtn}>
          <X size={24} />
        </button>
      </header>

      <div className={styles.content}>
        {/* Quick Actions */}
        <div className={styles.actionRow}>
          <button onClick={() => window.print()} className={`${styles.actionBtn} ${styles.exportBtn}`}>
            <FileText size={16} /> Export do PDF
          </button>
          
          {task.isDeleted ? (
            <button 
              onClick={() => { onRestore?.(task.id); onClose(); }} 
              className={`${styles.actionBtn} ${styles.restoreBtn}`}
            >
              <RotateCcw size={14} /> Obnovit
            </button>
          ) : (
            <button onClick={handleDelete} className={`${styles.actionBtn} ${styles.deleteBtn}`}>
              <Trash2 size={14} /> Smazat úkol
            </button>
          )}
        </div>

        {/* Custom Slug Section (Public Link) - ONLY for the main trip folder */}
        {isLocationHistory && !task.parentId && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <LinkIcon size={18} />
              <span>Nastavení veřejného blogu</span>
            </div>
            <div className="space-y-4 mt-2">
              <div className="flex items-center gap-2">
                <span className="text-xs opacity-40 w-12 text-right">Adresa:</span>
                <input 
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))}
                  onBlur={() => onUpdate(task.id, { slug })}
                  className="flex-1 p-2 bg-stone-100 border border-stone-200 rounded-xl text-sm font-bold"
                  placeholder="moje-cesta-2024..."
                />
              </div>
              <div className="flex flex-col gap-3">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1">Vyberte styl deníku</span>
                <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar -mx-2 px-2">
                  {[
                    { id: 'MODERN', name: 'Moderní', bg: '#fafaf9', accent: '#ea580c', text: '#1c1917', font: 'sans' },
                    { id: 'ADVENTURE', name: 'Deník', bg: '#f4f1ea', accent: '#a68a64', text: '#4a3728', font: 'serif' },
                    { id: 'ELEGANT', name: 'Elegant', bg: '#ffffff', accent: '#c5a059', text: '#1a1a1a', font: 'serif' },
                    { id: 'DARK', name: 'Dark', bg: '#0a0a0a', accent: '#ffffff', text: '#ffffff', font: 'sans' },
                    { id: 'MINIMAL', name: 'Čistý', bg: '#ffffff', accent: '#e5e7eb', text: '#000000', font: 'sans' }
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setBlogTemplate(t.id);
                        onUpdate(task.id, { blogTemplate: t.id });
                      }}
                      className={`flex-shrink-0 w-32 group transition-all ${blogTemplate === t.id ? 'scale-105' : 'opacity-70 grayscale-[0.5] hover:opacity-100 hover:grayscale-0'}`}
                    >
                      <div 
                        className={`h-40 w-full rounded-2xl border-2 mb-2 overflow-hidden flex flex-col p-3 transition-all ${blogTemplate === t.id ? 'border-[#ea580c] shadow-lg' : 'border-stone-100'}`}
                        style={{ backgroundColor: t.bg, color: t.text }}
                      >
                        <div className="h-1.5 w-8 rounded-full mb-4" style={{ backgroundColor: t.accent }} />
                        <div className={`text-[10px] font-black leading-none mb-1 ${t.font === 'serif' ? 'font-serif italic' : ''}`}>Title</div>
                        <div className="h-0.5 w-12 bg-current opacity-10 mb-4" />
                        <div className="flex-1 rounded-lg border border-current opacity-10 flex items-center justify-center">
                          <Camera size={16} />
                        </div>
                        <div className="h-1 w-full bg-current opacity-5 mt-4 rounded-full" />
                        <div className="h-1 w-2/3 bg-current opacity-5 mt-1 rounded-full" />
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-widest ${blogTemplate === t.id ? 'text-[#ea580c]' : 'text-stone-400'}`}>
                        {t.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Parent Selection & Lock (Hidden for Location) */}
        {taskType !== "LOCATION_HISTORY" && (
          <section className={styles.section}>
            <h4 className={styles.sectionTitle}>
               <Layers className={styles.sectionIcon} size={14} /> Hierarchie & Ochrana
            </h4>
            <div className="flex flex-col gap-3">
              <select 
                className={styles.select}
                value={parentId} 
                onChange={(e) => handleParentChange(e.target.value)}
              >
                <option value="">(Bez nadřazeného úkolu / ROOT)</option>
                {allTasks.filter(t => t.id !== task.id).map(t => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
              
              <button 
                className={`${styles.lockToggle} ${lockStatus ? styles.locked : ""}`}
                onClick={() => handleLockStatusChange(!lockStatus)}
              >
                {lockStatus ? <Lock size={14} /> : <Unlock size={14} />}
                <span>{lockStatus ? "Status uzamčen (nelze uzavřít)" : "Status volný"}</span>
              </button>
            </div>
          </section>
        )}

        {/* Expense Details (Conditional) */}
        {taskType === "EXPENSE" && (
          <section className={styles.section}>
            <h4 className={styles.sectionTitle}>
              <Wallet className={styles.sectionIcon} size={14} /> Detaily nákladů
            </h4>
            <div className={styles.expenseGrid}>
              <div className={styles.labelItem}>
                <div className={styles.labelHeader}><DollarSign size={14} /> Částka & Měna</div>
                <div className="flex gap-2 mt-1">
                  <input 
                    type="number" 
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    onBlur={handleExpenseUpdate}
                    className={styles.amountInput}
                  />
                  <input 
                    type="text" 
                    placeholder="CZK"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    onBlur={handleExpenseUpdate}
                    className={styles.currencyInput}
                  />
                </div>
              </div>

              <div className={styles.labelItem}>
                <div className={styles.labelHeader}><Layers size={14} /> Kategorie výdaje</div>
                <select 
                  className={styles.select}
                  value={categoryId} 
                  onChange={(e) => {
                    const cid = e.target.value;
                    setCategoryId(cid);
                    onUpdate(task.id, { categoryId: cid });
                  }}
                >
                  <option value="">(Bez kategorie)</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              
              <div className={styles.labelItem}>
                <div className={styles.labelHeader}><Building size={14} /> Komu se platilo (Příjemce)</div>
                <div className="relative mt-1">
                  <input 
                    type="text" 
                    placeholder="Název firmy / jméno..."
                    value={payee}
                    onChange={(e) => {
                      setPayee(e.target.value);
                      setShowPayeeSuggestions(true);
                    }}
                    onBlur={() => {
                      handleExpenseUpdate();
                      // Timeout to allow clicking a suggestion
                      setTimeout(() => setShowPayeeSuggestions(false), 200);
                    }}
                    onFocus={() => setShowPayeeSuggestions(true)}
                    className={styles.payeeInput}
                  />
                  {showPayeeSuggestions && payees.length > 0 && (
                    <div className={styles.suggestions}>
                      {payees
                        .filter(p => p.name.toLowerCase().includes(payee.toLowerCase()))
                        .slice(0, 5)
                        .map(p => (
                          <div 
                            key={p.id} 
                            className={styles.suggestionItem}
                            onMouseDown={() => {
                              setPayee(p.name);
                              setShowPayeeSuggestions(false);
                              onUpdate(task.id, { payee: p.name });
                            }}
                          >
                            {p.name}
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Location History & Notes Section */}
        {(isLocation || isLocationHistory) && locHistory.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <Navigation size={18} />
              <span>Historie míst & Zápisky</span>
            </div>
            <div className={styles.locHistoryList}>
              {locHistory.map((loc: any) => (
                <div key={loc.id} className={styles.locHistoryItem}>
                  <div className={styles.locDot} />
                  <div className={styles.locContent}>
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[10px] font-black text-brand-400 uppercase tracking-widest">
                        {new Date(loc.createdAt).toLocaleString("cs-CZ", { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {loc.mileage && (
                        <span className="text-[10px] font-black text-coral bg-coral/5 px-2 py-0.5 rounded-md border border-coral/10">
                          {loc.mileage} km
                        </span>
                      )}
                    </div>
                    {loc.placeName && <div className="text-sm font-black text-brand-950 mb-0.5">{loc.placeName}</div>}
                    <div className="text-xs text-brand-500 mb-2 leading-relaxed">{loc.address}</div>
                    {loc.note && (
                      <div className="p-3 bg-brand-50 rounded-xl border border-brand-100 text-sm text-brand-800 font-medium italic shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-brand-200" />
                        {loc.note}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Description Section */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <FileText size={18} />
            <span>{taskType === "LOCATION_HISTORY" ? "Zápisky / Deníček" : "Deníček / Poznámky"}</span>
            <div className="flex items-center gap-2 ml-auto">
              <button 
                className={styles.dictateBtn}
                onClick={() => setIsNotesFullScreen(true)}
                title="Celá obrazovka"
              >
                <Maximize2 size={16} />
              </button>
              <button 
                className={`${styles.dictateBtn} ${isDictating ? styles.dictating : ""}`}
                onClick={isDictating ? stopDictation : startDictation}
                type="button"
              >
                <Mic size={16} />
                {isDictating && <span className={styles.pulseDot} />}
              </button>
            </div>
          </div>
          <textarea 
            className={styles.textarea}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleSaveDescription}
            onFocus={() => {
              if (window.innerWidth < 768) setIsNotesFullScreen(true);
            }}
            onDoubleClick={() => setIsNotesFullScreen(true)}
            placeholder="Detailní popis..."
          />
        </section>

        <section className={styles.labelsGrid}>
          <div className={styles.labelItem}>
            <div className={styles.labelHeader}><Calendar size={14} /> Termín</div>
            <div className={styles.labelValue}>{task.dueDate ? new Date(task.dueDate).toLocaleDateString("cs-CZ") : "DNES"}</div>
          </div>
        </section>

        {/* Subtasks Section */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <LinkIcon size={18} />
            <span>Podúkolů ({task.subTasks?.length || 0})</span>
          </div>
          
          {!task.isDeleted && (
            <form onSubmit={handleSubtaskAdd} className="flex gap-2 mb-4">
              <input 
                type="text"
                placeholder="Nový podúkol..."
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                className="flex-1 p-2 bg-sand/5 border border-sand/20 rounded-xl text-sm"
              />
              <button type="submit" className="p-2 bg-coral text-white rounded-xl">
                <Plus size={16} />
              </button>
            </form>
          )}

          <div className={styles.subtaskList}>
            {(task.subTasks || []).sort((a: any, b: any) => a.orderIndex - b.orderIndex).map((st: any) => (
              <div key={st.id} className={styles.subtaskItem}>
                <div className={styles.reorderBtns}>
                  <button onClick={() => handleMoveSubtask(st.id, 'up')}><ChevronUp size={12} /></button>
                  <button onClick={() => handleMoveSubtask(st.id, 'down')}><ChevronDown size={12} /></button>
                </div>
                <div className="flex flex-col flex-1">
                  <span className={st.status === 'DONE' && st.taskType === 'TASK' ? 'line-through opacity-50 font-medium' : 'font-medium'}>{st.title}</span>
                  {st.taskType === 'EXPENSE' && st.amount && (
                    <span className="text-[11px] font-extrabold text-green-600 mt-0.5">
                      {st.amount.toLocaleString("cs-CZ")} {st.currency}
                    </span>
                  )}
                  {st.description && <span className="text-[10px] opacity-40 truncate max-w-[200px]">{st.description}</span>}
                </div>
                <span className="text-[10px] font-bold opacity-30 uppercase">{st.status}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Location History Tracker (HIDDEN for individual location detail) */}
        {/* We keep it only for general tasks if needed, but for HISTORY type it is now strictly a record */}

        {/* Photos / Attachments Section */}
        {taskType !== "EXPENSE" && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <Camera size={18} />
              <span>Přílohy & Účtenky</span>
            </div>
            
            <div className={styles.attachmentGrid} data-count={attachments.length}>
              {attachments.map((att: any) => (
                <div key={att.id} className={styles.attachmentItem}>
                  {att.type === 'image' ? (
                    <img src={att.url} alt={att.name} />
                  ) : att.type === 'video' ? (
                    <div className="relative w-full h-full bg-black rounded-xl overflow-hidden">
                      <video src={att.url} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <Play size={20} className="text-white opacity-50" />
                      </div>
                    </div>
                  ) : (
                    <div className={styles.audioPlaceholder}>
                      <Mic size={20} className="text-coral" />
                      <audio src={att.url} controls className={styles.audioControl} />
                    </div>
                  )}
                  <button onClick={() => handleDeleteAttachment(att.id)} className={styles.attDelete}>
                    <X size={10} />
                  </button>
                </div>
              ))}
              
              {!isRecording ? (
                <div className="flex gap-2">
                  <label className={`${styles.uploadBtn} ${isUploading ? 'opacity-50 animate-pulse' : ''}`}>
                    {isUploading ? <Loader2 className="animate-spin" size={20} /> : <Camera size={20} />}
                    <input 
                      type="file" 
                      accept="image/*,video/*" 
                      multiple
                      onChange={handleFileUpload}
                      disabled={isUploading}
                      hidden 
                    />
                  </label>
                  <button onClick={startRecording} className={styles.uploadBtn}>
                    <Mic size={20} />
                  </button>
                </div>
              ) : (
                <button onClick={stopRecording} className={`${styles.uploadBtn} ${styles.recording}`}>
                  <Square size={20} fill="currentColor" />
                  <span className={styles.recordTimer}>{Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}</span>
                </button>
              )}
            </div>

            {attachments.some((a: any) => a.type === 'video') && (
              <div className="mt-4">
                <button 
                  onClick={handleGenerateClip}
                  disabled={isGeneratingClip}
                  className="w-full flex items-center justify-center gap-3 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale"
                >
                  {isGeneratingClip ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Stříhám film...
                    </>
                  ) : (
                    <>
                      <Video size={16} />
                      Vytvořit automatický sestřih
                    </>
                  )}
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </motion.div>
  );
};
