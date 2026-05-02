"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { 
  X, User, FileText, Link as LinkIcon, Calendar, 
  Plus, Trash2, Mail, Layers, Lock, Unlock, RotateCcw, 
  Wallet, DollarSign, Building, MapPin, Loader2, Navigation, Camera, Mic, Square, Play, Pause,
  ChevronUp, ChevronDown, Search, Clock, Eye, ChevronRight, AlertCircle, FolderOpen
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
  const [description, setDescription] = useState(task.description || "");
  const [priority, setPriority] = useState(task.priority);
  const [ownerEmail, setOwnerEmail] = useState(task.user?.email || "");
  const [parentId, setParentId] = useState(task.parentId || "");
  const [lockStatus, setLockStatus] = useState(task.lockStatus || false);
  const [taskType, setTaskType] = useState(task.taskType);
  const [amount, setAmount] = useState(task.amount || "");
  const [currency, setCurrency] = useState(task.currency || "CZK");
  const [payee, setPayee] = useState(task.payee || "");
  const [recordedAt, setRecordedAt] = useState(task.recordedAt ? new Date(task.recordedAt).toISOString().slice(0, 16) : "");
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [payees, setPayees] = useState<any[]>([]);
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
    const file = e.target.files?.[0];
    if (!file) return;

    // For now, we simulate upload by converting to base64
    // In production, you'd upload to S3/Cloudinary and get a URL
    const reader = new FileReader();
    reader.onload = async (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        const base64 = canvas.toDataURL("image/jpeg", 0.7);

        try {
          const res = await fetch(`/api/tasks/${task.id}/attachments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: file.name, url: base64, type: "image" })
          });
          if (res.ok) {
            const newAtt = await res.json();
            setAttachments([...attachments, newAtt]);
          }
        } catch (err) { console.error(err); }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
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

  const handleOwnerChange = () => {
    if (ownerEmail !== task.user?.email) {
      onUpdate(task.id, { ownerEmail });
    }
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

  const handleRecordedAtChange = (newVal: string) => {
    setRecordedAt(newVal);
    onUpdate(task.id, { recordedAt: newVal ? new Date(newVal).toISOString() : null });
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

  return (
    <motion.div 
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className={styles.sidebar}
    >
      <header className={styles.header}>
        <div className={styles.titleSection}>
          <input 
            className={styles.titleInput}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSaveTitle}
          />
          <div className="flex gap-2">
            <select 
              value={taskType}
              onChange={(e) => handleTaskTypeChange(e.target.value)}
              className={styles.typeSelect}
            >
              <option value="TASK">Úkol</option>
              <option value="BUG">Bug</option>
              <option value="IDEA">Nápad</option>
              <option value="EXPENSE">Náklady</option>
              <option value="LOCATION_HISTORY">Historie cesty</option>
            </select>
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

        {/* Custom Slug Section (Public Link) */}
        {taskType === "LOCATION_HISTORY" && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <LinkIcon size={18} />
              <span>Vlastní adresa blogu (Slug)</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs opacity-40">/blog/</span>
              <input 
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))}
                onBlur={() => onUpdate(task.id, { slug })}
                className="flex-1 p-2 bg-stone-100 border border-stone-200 rounded-xl text-sm font-bold"
                placeholder="moje-cesta-2024..."
              />
            </div>
            <p className="text-[10px] opacity-40 mt-1 italic px-1">
              Pokud vyplníte slug, blog bude dostupný na této hezké adrese.
            </p>
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

        {/* Address Section (Specific to Location History) */}
        {taskType === "LOCATION_HISTORY" && task.locations?.[0] && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <MapPin size={18} />
              <span>Zaznamenaná adresa</span>
            </div>
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-sm text-stone-600 italic">
              {task.locations[0].address}
            </div>
          </section>
        )}

        {/* Description Section */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <FileText size={18} />
            <span>{taskType === "LOCATION_HISTORY" ? "Zápisky / Deníček" : "Deníček / Poznámky"}</span>
            <button 
              className={`${styles.dictateBtn} ${isDictating ? styles.dictating : ""}`}
              onClick={isDictating ? stopDictation : startDictation}
              type="button"
            >
              <Mic size={16} />
              {isDictating && <span className={styles.pulseDot} />}
            </button>
          </div>
          <textarea 
            className={styles.textarea}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleSaveDescription}
            placeholder="Detailní popis..."
          />
        </section>

        {/* Roles Section (Hidden for Location/Expense) */}
        {taskType !== "LOCATION_HISTORY" && taskType !== "EXPENSE" && (
          <section className={styles.labelsGrid}>
            <div className={styles.labelItem}>
              <div className={styles.labelHeader}><User size={14} /> Vlastník (Email)</div>
              <div className="flex items-center gap-2 mt-1">
                <Mail size={12} className="opacity-40" />
                <input 
                  type="email"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  onBlur={handleOwnerChange}
                  className={styles.emailInput}
                  placeholder="email@example.com"
                />
              </div>
            </div>
            <div className={styles.labelItem}>
              <div className={styles.labelHeader}><Calendar size={14} /> Termín</div>
              <div className={styles.labelValue}>{task.dueDate ? new Date(task.dueDate).toLocaleDateString("cs-CZ") : "DNES"}</div>
            </div>
          </section>
        )}

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
            
            <div className={styles.attachmentGrid}>
              {attachments.map((att: any) => (
                <div key={att.id} className={styles.attachmentItem}>
                  {att.type === 'image' ? (
                    <img src={att.url} alt={att.name} />
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
                  <label className={styles.uploadBtn}>
                    <Camera size={20} />
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment" 
                      onChange={handleFileUpload}
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
          </section>
        )}
      </div>
    </motion.div>
  );
};
