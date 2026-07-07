"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { TaskCard } from "../TaskCard/TaskCard";
import { TaskDetail } from "../TaskDetail/TaskDetail";
import { QuickExpenseModal } from "../QuickExpenseModal/QuickExpenseModal";
import { LocationSelectionModal } from "../LocationSelectionModal/LocationSelectionModal";
import { LocationTracker } from "../LocationTracker/LocationTracker";
import { PhotoBook } from "../PhotoBook/PhotoBook";
import { Search, Grid, List as ListIcon, Home, ChevronRight, Maximize2, Minimize2, Wallet, Tag, Building, X, Save, MapPin, Share, CheckSquare, FolderOpen, Navigation, Settings as SettingsIcon, FileUp, FileDown, Wand2, PlusCircle, LayoutGrid, FileText, Printer } from "lucide-react";
import InstallPWA from "../InstallPWA/InstallPWA";
import styles from "./TaskList.module.css";
import { motion, AnimatePresence } from "framer-motion";

export const TaskList = () => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [addingType, setAddingType] = useState<any>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  // Navigation & Filtering
  const [currentParentId, setCurrentParentId] = useState<string | null>(searchParams.get("parentId"));
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ACTIVE");
  const [sortBy, setSortBy] = useState<string>("PRIORITY");

  const [lastDeletedTask, setLastDeletedTask] = useState<any | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const [isZen, setIsZen] = useState(false);
  const [quickActionTask, setQuickActionTask] = useState<any | null>(null);
  const [isSelectingLocation, setIsSelectingLocation] = useState(false);
  const [locationModalMode, setLocationModalMode] = useState<'GPS' | 'SEARCH'>('GPS');
  const [locationTargetFolderId, setLocationTargetFolderId] = useState<string | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLookupOpen, setIsLookupOpen] = useState(false);
  const [isPrintEditorOpen, setIsPrintEditorOpen] = useState(false);
  const [printFolder, setPrintFolder] = useState<any | null>(null);
  const [lookupQuery, setLookupQuery] = useState("");

  const toggleZen = () => {
    const nextZen = !isZen;
    setIsZen(nextZen);
    window.dispatchEvent(new CustomEvent("toggleZen", { detail: nextZen }));
  };

  const fetchTasks = async () => {
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      if (Array.isArray(data)) {
        setTasks(data);
      }
    } catch (error) {
      console.error("Failed to fetch tasks", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/categories");
      const data = await res.json();
      if (Array.isArray(data)) setCategories(data);
    } catch (err) {}
  };

  const goUp = useCallback(() => {
    if (!currentParentId) return;
    const current = tasks.find(t => t.id === currentParentId);
    const pId = current?.parentId || null;
    
    const params = new URLSearchParams(searchParams);
    if (pId) params.set("parentId", pId);
    else params.delete("parentId");
    router.push(`${pathname}?${params.toString()}`);
    
    setCurrentParentId(pId);
  }, [currentParentId, tasks, router, pathname, searchParams]);

  const goToFolder = (id: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (id) params.set("parentId", id);
    else params.delete("parentId");
    router.push(`${pathname}?${params.toString()}`);
    setCurrentParentId(id);
  };

  useEffect(() => {
    console.log("TaskList: Fetching tasks...");
    fetchTasks();
    fetchCategories();
  }, []);

  // Sync state if URL changes (back button support)
  const pIdFromUrl = searchParams.get("parentId");
  if (pIdFromUrl !== currentParentId) {
    console.log("TaskList: Syncing parentId from URL", pIdFromUrl);
    setCurrentParentId(pIdFromUrl);
  }

  useEffect(() => {
    // Global event for adding task from sidebar
    const handleAddTaskEvent = () => {
      if (!currentParentId) {
        setAddingType('FOLDER');
        setIsAddingTask(true);
      } else {
        setIsAddingTask(true);
        setAddingType(null); // Show choices
      }
    };
    window.addEventListener("addTask", handleAddTaskEvent);

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsLookupOpen(true);
      }
      if (e.key === "Escape") {
        if (selectedTask) setSelectedTask(null);
        else if (quickActionTask) setQuickActionTask(null);
        else if (isAddingTask) setIsAddingTask(false);
        else if (isLookupOpen) setIsLookupOpen(false);
        else goUp();
      }
    };

    // Quick Action listener
    const handleQuickActionEvent = (e: any) => {
      const { task, action } = e.detail;
      if (task.taskType === "LOCATION_HISTORY") {
        setLocationTargetFolderId(task.id);
        setLocationModalMode(action || 'GPS');
        setIsSelectingLocation(true);
      } else {
        setQuickActionTask(task);
      }
    };
    window.addEventListener("quickAction", handleQuickActionEvent as any);

    window.addEventListener("keydown", handleGlobalKeyDown);
    fetchCategories();

    return () => {
      window.removeEventListener("addTask", handleAddTaskEvent);
      window.removeEventListener("quickAction", handleQuickActionEvent as any);
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [goUp, selectedTask, isAddingTask]);

  // Restore last parent on mount
  useEffect(() => {
    const last = localStorage.getItem("questea_last_parent");
    if (last && !searchParams.has("parentId")) {
      const params = new URLSearchParams(searchParams);
      params.set("parentId", last);
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, []);

  // Save last parent on change
  useEffect(() => {
    if (currentParentId) {
      localStorage.setItem("questea_last_parent", currentParentId);
    }
  }, [currentParentId]);

  const handleUndo = async () => {
    if (!lastDeletedTask) return;
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lastDeletedTask),
      });
      if (res.ok) {
        const restored = await res.json();
        setTasks([restored, ...tasks]);
        setShowUndo(false);
      }
    } catch (error) {
      console.error("Undo failed");
    }
  };

  const openTaskDetail = async (task: any) => {
    setIsLoadingDetail(true);
    setSelectedTask(task); // Show partial data immediately
    try {
      const res = await fetch(`/api/tasks/${task.id}`);
      if (res.ok) {
        const fullTask = await res.json();
        setSelectedTask(fullTask);
      }
    } catch (err) {
      console.error("Failed to fetch task detail", err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Derived breadcrumbs (resilient even if parent is not in the list)
  const currentFolder = tasks.find(t => t.id === currentParentId);
  const isEvidenceView = currentFolder?.taskType === "EXPENSE" || currentFolder?.taskType === "LOCATION_HISTORY";
  const isLocationHistoryFolder = currentFolder?.taskType === "LOCATION_HISTORY" || currentFolder?.title.toLowerCase().includes("místa");

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const filteredTasks = tasks.filter(task => {
    // Trash view
    if (filterStatus === "TRASH") return task.isDeleted;
    if (task.isDeleted) return false;

    // If searching, show all matches regardless of hierarchy
    if (searchQuery) {
      return task.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
             task.description?.toLowerCase().includes(searchQuery.toLowerCase());
    }
    
    // Normal drill-down navigation (must match parentId unless searching)
    if (task.parentId !== currentParentId) return false;

    // Status filter
    if (filterStatus === "ACTIVE") {
      // „Aktivní" = jen otevřené: skryj hotové i zrušené (i uvnitř složek).
      return task.status !== "DONE" && task.status !== "CANCELED";
    }
    if (filterStatus !== "ALL" && task.status !== filterStatus) return false;
    
    return true;
  }).sort((a, b) => {
    if (sortBy === "PRIORITY") {
      const pMap: any = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return (pMap[a.priority] || 2) - (pMap[b.priority] || 2);
    }
    return (b.progress || 0) - (a.progress || 0);
  });

  const getJourneyStats = () => {
    try {
      if (!isLocationHistoryFolder || !filteredTasks || filteredTasks.length < 1) return null;
      
      // Sort tasks by recordedAt (or createdAt as fallback)
      const sorted = [...filteredTasks].sort((a, b) => {
        const dateA = new Date(a.recordedAt || a.createdAt).getTime();
        const dateB = new Date(b.recordedAt || b.createdAt).getTime();
        return dateB - dateA; // DESCENDING (newest first)
      });

      let totalDist = 0;
      for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i];
        const next = sorted[i+1];
        if (next.calculatedDistance !== null && next.calculatedDistance !== undefined) {
          totalDist += next.calculatedDistance;
        } else {
          const loc1 = current.locations?.[0];
          const loc2 = next.locations?.[0];
          if (loc1 && loc2 && loc1.latitude && loc1.longitude && loc2.latitude && loc2.longitude) {
            totalDist += calculateDistance(loc1.latitude, loc1.longitude, loc2.latitude, loc2.longitude);
          }
        }
      }

      const start = sorted[0] ? new Date(sorted[0].recordedAt || sorted[0].createdAt) : new Date();
      const end = sorted[sorted.length - 1] ? new Date(sorted[sorted.length - 1].recordedAt || sorted[sorted.length - 1].createdAt) : new Date();
      
      const odometerTasks = sorted.filter(t => t.odometer !== null && t.odometer !== undefined).sort((a, b) => {
        return new Date(a.recordedAt || a.createdAt).getTime() - new Date(b.recordedAt || b.createdAt).getTime();
      });

      return {
        totalDistance: totalDist.toFixed(1),
        gpsDistance: totalDist.toFixed(1),
        timeRange: `${end.toLocaleDateString("cs-CZ")} - ${start.toLocaleDateString("cs-CZ")}`,
        sortedTasks: sorted,
        odometerPoints: odometerTasks
      };
    } catch (err) {
      console.error("Error calculating journey stats:", err);
      return null;
    }
  };

  const stats = getJourneyStats();
  
  const getSortedDisplayTasks = () => {
    if (isLocationHistoryFolder && stats) return stats.sortedTasks;
    if (isEvidenceView) {
      return [...filteredTasks].sort((a, b) => {
        const dateA = new Date(a.recordedAt || a.createdAt).getTime();
        const dateB = new Date(b.recordedAt || b.createdAt).getTime();
        return dateB - dateA; // Descending
      });
    }
    return filteredTasks;
  };

  const displayTasks = getSortedDisplayTasks();

  const breadcrumbs: any[] = [];
  let curr: any = currentFolder;
  if (!curr && currentParentId) {
    // If parent is transferred/missing, find a child that knows about it
    const sampleChild = tasks.find(t => t.parentId === currentParentId);
    if (sampleChild) curr = sampleChild.parent;
  }
  
  while (curr) {
    breadcrumbs.unshift(curr);
    const pId = curr.parentId;
    if (!pId) break;
    curr = tasks.find(t => t.id === pId) || curr.parent;
  }

  // Auto-calculate progress based on subtasks if not set manually
  const getTaskProgress = (task: any) => {
    const children = tasks.filter(t => t.parentId === task.id && !t.isDeleted);
    if (children.length > 0) {
      const doneCount = children.filter((st: any) => st.status === "DONE").length;
      return Math.round((doneCount / children.length) * 100);
    }
    return task.progress || 0;
  };

  const handleUpdate = async (id: string, data: any) => {
    const taskToUpdate = tasks.find(t => t.id === id);
    if (!taskToUpdate) return;

    // Lock check: Cannot close if lockStatus is true
    if (data.status === "DONE" && taskToUpdate.lockStatus) {
      alert("Tento úkol je uzamčený a nelze jej uzavřít.");
      return;
    }

    const originalTasks = [...tasks];
    
    // Recursive close: If marking parent as DONE, close all subtasks
    let updatedData = { ...data };
    const newTasks = tasks.map(t => {
      if (t.id === id) {
        const updated = { ...t, ...data };
        // If this is a parent being finished, recursively update children in local state
        if (data.status === "DONE" && t.subTasks) {
          // This is a bit complex for flat list, but we can do it via parentId
        }
        return updated;
      }
      // Recursive logic for flat list: if parentId matches the updated task and it's being closed
      if (data.status === "DONE" && t.parentId === id) {
        return { ...t, status: "DONE" };
      }
      return t;
    });

    setTasks(newTasks);

    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      
      // If we closed a parent, we should also update children on backend
      if (data.status === "DONE") {
         // The backend should handle recursive status update
      }

    } catch (error) {
      setTasks(originalTasks);
    }
  };

  const handleDelete = async (id: string) => {
    const taskToDelete = tasks.find(t => t.id === id);
    if (taskToDelete) {
      setLastDeletedTask(taskToDelete);
      setShowUndo(true);
      setTimeout(() => setShowUndo(false), 5000);
    }
    
    // Use SOFT DELETE
    const originalTasks = [...tasks];
    setTasks(tasks.map(t => t.id === id ? { ...t, isDeleted: true } : t));
    
    try {
      const res = await fetch(`/api/tasks/${id}`, { 
        method: "PATCH", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDeleted: true }) 
      });
      if (!res.ok) throw new Error();
    } catch (error) {
      setTasks(originalTasks);
    }
  };

  const handleRestore = async (id: string) => {
    const originalTasks = [...tasks];
    setTasks(tasks.map(t => t.id === id ? { ...t, isDeleted: false } : t));
    try {
      await fetch(`/api/tasks/${id}`, { 
        method: "PATCH", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDeleted: false }) 
      });
    } catch (error) {
      setTasks(originalTasks);
    }
  };

  const handleAddTask = async (titleOverride?: string, typeOverride?: string) => {
    const title = titleOverride || newTaskTitle;
    const type = typeOverride || addingType || "TASK";
    
    if (!title.trim()) return;
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title,
          status: "TODO",
          priority: "MEDIUM",
          taskType: type,
          parentId: currentParentId,
          // Záznamové typy dostanou rovnou aktuální datum a čas (jde změnit v detailu).
          ...(["NOTE", "EVENT", "WORKOUT"].includes(type)
            ? { recordedAt: new Date().toISOString() }
            : {}),
        }),
      });
      if (res.ok) {
        const newTask = await res.json();
        setTasks([newTask, ...tasks]);
        setNewTaskTitle("");
        setIsAddingTask(false);
        setAddingType(null);
      }
    } catch (error) {
      console.error("Failed to add task", error);
    }
  };

  const handleLocationSelect = async (loc: any) => {
    const targetId = locationTargetFolderId || currentParentId;
    if (!targetId) return;

    try {
      const taskRes = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: loc.placeName,
          description: loc.note || "",
          status: "DONE",
          priority: "LOW",
          taskType: loc.isGpsLog ? "GPS_LOG" : "LOCATION",
          parentId: targetId,
          recordedAt: new Date().toISOString()
        })
      });
      
      if (!taskRes.ok) throw new Error("Failed to create subtask");
      const newSubtask = await taskRes.json();

      await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: loc.latitude,
          longitude: loc.longitude,
          address: loc.address,
          placeName: loc.placeName,
          note: loc.note,
          taskId: newSubtask.id,
        })
      });

      setTasks([newSubtask, ...tasks]);
      setIsSelectingLocation(false);
      setLocationTargetFolderId(null);
    } catch (error) {
      console.error("Failed to add location subtask", error);
    }
  };

  const handleQuickLocation = async (task: any) => {
    // Deprecated in favor of handleLocationSelect via modal
    setIsSelectingLocation(true);
  };


  // Mobile swipe support (simple)
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.targetTouches[0].clientX);
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const distance = touchEnd - touchStart;
    if (distance > 100) goUp(); // Swipe right to go up? OR Swipe left?
    // User asked: "při svajp doleva mimo úkol taky vyskočit o úroveň ven" (swipe left outside task)
    if (distance < -100) goUp();
    setTouchStart(null);
  };

  const handleExportXml = () => {
    const currentTasks = tasks.filter(t => t.parentId === currentParentId);
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<Expedition>\n';
    currentTasks.forEach(t => {
      xml += '  <Entry>\n';
      xml += `    <Id>${t.id}</Id>\n`;
      xml += `    <Title><![CDATA[${t.title}]]></Title>\n`;
      xml += `    <Notes><![CDATA[${t.description || ''}]]></Notes>\n`;
      xml += '  </Entry>\n';
    });
    xml += '</Expedition>';

    const blob = new Blob([xml], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expedition_${currentParentId || 'root'}.xml`;
    a.click();
  };

  const handleImportXml = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, "text/xml");
      const entries = xmlDoc.getElementsByTagName("Entry");

      for (let i = 0; i < entries.length; i++) {
        const id = entries[i].getElementsByTagName("Id")[0]?.textContent;
        const notes = entries[i].getElementsByTagName("Notes")[0]?.textContent;

        if (id && notes !== undefined) {
          try {
            await fetch(`/api/tasks/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ description: notes })
            });
          } catch (err) {
            console.error(`Failed to update task ${id}`, err);
          }
        }
      }
      fetchTasks();
      alert("Import dokončen!");
    };
    reader.readAsText(file);
  };

  return (
    <div 
      className={styles.container}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <AnimatePresence>
        {selectedTask && (
          <TaskDetail 
            task={selectedTask} 
            allTasks={tasks}
            onClose={() => setSelectedTask(null)}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        )}
        {isLoadingDetail && (
           <div className="fixed top-4 right-4 z-[3000] bg-white/80 backdrop-blur-md px-4 py-2 rounded-full shadow-lg flex items-center gap-2 border border-orange-100 animate-in fade-in slide-in-from-top-4">
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-orange-600">Načítám detaily...</span>
           </div>
        )}
        {quickActionTask && (
          <QuickExpenseModal 
            task={quickActionTask} 
            categories={categories}
            onClose={() => setQuickActionTask(null)}
            onSave={async (data: any) => {
              try {
                let catId = data.categoryId;
                
                // If new category name provided, create it first
                if (!catId && data.categoryName) {
                  const catRes = await fetch("/api/categories", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: data.categoryName, color: "#3b82f6" })
                  });
                  if (catRes.ok) {
                    const newCat = await catRes.json();
                    catId = newCat.id;
                    setCategories([...categories, newCat]);
                  }
                }

                // Create a SUBTASK of type EXPENSE under the folder
                const { categoryName, ...cleanData } = data;
                const res = await fetch("/api/tasks", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    ...cleanData,
                    categoryId: catId,
                    taskType: "EXPENSE",
                    parentId: quickActionTask.id,
                    status: "DONE"
                  })
                });
                if (res.ok) {
                  fetchTasks();
                  setQuickActionTask(null);
                }
              } catch (err) {
                console.error(err);
              }
            }}
          />
        )}
        {isPrintEditorOpen && printFolder && (
          <PhotoBook
            folder={printFolder}
            onClose={() => {
              setIsPrintEditorOpen(false);
              setPrintFolder(null);
            }}
          />
        )}
        {isSelectingLocation && (
          <LocationSelectionModal 
            onClose={() => {
              setIsSelectingLocation(false);
              setLocationTargetFolderId(null);
            }}
            onSelect={handleLocationSelect}
            autoGPS={locationModalMode === 'GPS'}
          />
        )}
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-md"
              onClick={() => setIsSettingsOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-[40px] shadow-2xl overflow-hidden"
            >
               <div className="p-8 border-b border-stone-50 flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-black text-stone-950">Nastavení</h3>
                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mt-1">Konfigurace aplikace</p>
                  </div>
                  <button onClick={() => setIsSettingsOpen(false)} className="p-3 hover:bg-stone-50 rounded-2xl transition-colors">
                    <X size={20} className="text-stone-400" />
                  </button>
               </div>
               <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto no-scrollbar">
                  <section className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 ml-1">Mobilní aplikace</h4>
                    <InstallPWA />
                  </section>
                  
                  <section className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 ml-1">Rozhraní</h4>
                    <button 
                      onClick={() => { toggleZen(); setIsSettingsOpen(false); }}
                      className="w-full flex items-center justify-between px-6 py-4 bg-stone-50 rounded-2xl hover:bg-stone-100 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl transition-colors ${isZen ? 'bg-orange-100 text-orange-600' : 'bg-white text-stone-400'}`}>
                           <Maximize2 size={18} />
                        </div>
                        <span className="text-sm font-bold text-stone-600 group-hover:text-stone-950 transition-colors">Zen režim</span>
                      </div>
                      <div className={`w-10 h-6 rounded-full transition-colors relative ${isZen ? 'bg-orange-500' : 'bg-stone-200'}`}>
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${isZen ? 'left-5' : 'left-1'}`} />
                      </div>
                    </button>
                  </section>

                  <section className="pt-4 border-t border-stone-50">
                    <div className="text-center text-[10px] font-bold text-stone-300 uppercase tracking-[0.3em]">
                       Questea Life OS v2.0
                    </div>
                  </section>
               </div>
            </motion.div>
          </div>
        )}
        {isLookupOpen && (
          <div className="fixed inset-0 z-[12000] flex items-start justify-center pt-20 px-4">
             <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
               onClick={() => setIsLookupOpen(false)}
             />
             <motion.div 
               initial={{ opacity: 0, y: -20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -20, scale: 0.95 }}
               className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden border border-stone-100"
             >
                <div className="flex items-center gap-4 p-6 border-b border-stone-50">
                   <Wand2 size={20} className="text-stone-400" />
                   <input 
                     autoFocus
                     placeholder="Hledejte funkci nebo akci..."
                     className="flex-1 bg-transparent outline-none text-lg font-bold placeholder-stone-300"
                     value={lookupQuery}
                     onChange={(e) => setLookupQuery(e.target.value)}
                   />
                </div>
                <div className="max-h-[60vh] overflow-y-auto p-4 space-y-2">
                   {[
                     { id: 'add-folder', name: 'Nová složka / Projekt', icon: FolderOpen, action: () => { setAddingType('FOLDER'); setIsAddingTask(true); } },
                     { id: 'add-location', name: 'Zaznamenat polohu / Zastávku', icon: MapPin, action: () => setIsSelectingLocation(true) },
                     { id: 'add-expense', name: 'Zapsat výdaj', icon: Wallet, action: () => { if (currentParentId) { setQuickActionTask(tasks.find(t => t.id === currentParentId)); } else alert("Otevřete nejprve složku"); } },
                     { id: 'print-project', name: 'Tisk projektu / Fotokniha', icon: Printer, action: async () => { 
                       if (currentParentId) {
                         setIsLoadingDetail(true);
                         try {
                           const res = await fetch(`/api/tasks/${currentParentId}`);
                           const fullFolder = await res.json();
                           setPrintFolder(fullFolder);
                           setIsPrintEditorOpen(true);
                         } catch (err) {} finally { setIsLoadingDetail(false); }
                       } else alert("Otevřete nejprve složku projektu"); 
                     } },
                     { id: 'share-blog', name: 'Otevřít blog cesty', icon: Share, action: () => { const shareId = currentFolder?.slug || currentParentId; if (shareId) window.open(`/blog/${shareId}`, "_blank"); else alert("Otevřete složku cesty"); } },
                     { id: 'export-xml', name: 'Exportovat data (XML)', icon: FileDown, action: handleExportXml },
                     { id: 'import-xml', name: 'Importovat data (XML)', icon: FileUp, action: () => document.getElementById('global-xml-import')?.click() },
                     { id: 'zen-mode', name: 'Přepnout Zen režim', icon: Maximize2, action: toggleZen },
                     { id: 'pwa-install', name: 'Instalovat jako aplikaci', icon: LayoutGrid, action: () => setIsSettingsOpen(false) },
                   ].filter(a => a.name.toLowerCase().includes(lookupQuery.toLowerCase())).map(action => (
                     <button 
                       key={action.id}
                       onClick={() => { action.action(); setIsLookupOpen(false); setLookupQuery(""); }}
                       className="w-full flex items-center gap-4 p-4 hover:bg-stone-50 rounded-2xl transition-colors group text-left"
                     >
                        <div className="p-2.5 bg-stone-50 rounded-xl group-hover:bg-white transition-colors">
                           <action.icon size={18} className="text-stone-400 group-hover:text-orange-600" />
                        </div>
                        <span className="font-bold text-stone-600 group-hover:text-stone-950 transition-colors">{action.name}</span>
                     </button>
                   ))}
                </div>
                <input type="file" id="global-xml-import" accept=".xml" className="hidden" onChange={handleImportXml} />
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {!isZen ? (
        <>
          <header className={styles.header}>
            <div className={styles.breadcrumbHeader}>
              {currentParentId ? (
                <div className="flex items-center gap-2 overflow-hidden">
                  <button onClick={goUp} className={styles.backBtn}>
                    <ChevronRight size={22} style={{ transform: 'rotate(180deg)' }} />
                  </button>
                  <h2 className={styles.currentFolderTitle}>
                    {tasks.find(t => t.id === currentParentId)?.title || "Zpět"}
                  </h2>
                  <div className="flex items-center gap-1 ml-2 opacity-20 hover:opacity-100 transition-opacity">
                     <button onClick={() => setIsLookupOpen(true)} title="Vyhledat funkci" className="p-1 hover:text-orange-600">
                        <Wand2 size={14} />
                     </button>
                     <button onClick={handleExportXml} title="Exportovat XML" className="p-1 hover:text-orange-600">
                        <FileDown size={14} />
                     </button>
                     <label className="p-1 hover:text-orange-600 cursor-pointer">
                        <FileUp size={14} />
                        <input type="file" accept=".xml" className="hidden" onChange={handleImportXml} />
                     </label>
                  </div>
                </div>
              ) : (
                <div className={styles.breadcrumbContainer}>
                  <button onClick={() => goToFolder(null)} className={styles.pathItem}>
                    <Home size={20} className={!currentParentId ? "text-coral" : ""} />
                  </button>
                  {breadcrumbs.map((b, idx) => (
                    <React.Fragment key={b.id}>
                      <ChevronRight size={14} className={styles.pathSeparator} />
                      <button 
                        onClick={() => goToFolder(b.id)}
                        className={`${styles.pathItem} ${idx === breadcrumbs.length - 1 ? styles.activePath : ""}`}
                      >
                        {b.title}
                      </button>
                    </React.Fragment>
                  ))}
                  <button 
                    onClick={() => setIsLookupOpen(true)}
                    className="ml-auto p-2 text-stone-300 hover:text-stone-950 transition-colors"
                  >
                    <Wand2 size={20} />
                  </button>
                  <button 
                    onClick={() => setIsSettingsOpen(true)}
                    className="p-2 text-stone-300 hover:text-stone-950 transition-colors"
                  >
                    <SettingsIcon size={20} />
                  </button>
                </div>
              )}

              <div className={styles.headerActions}>
                {currentFolder?.taskType === "LOCATION_HISTORY" && (
                  <div className={styles.quickActionGroup}>
                    <button 
                      onClick={() => setIsSelectingLocation(true)} 
                      className={styles.headerActionBtn}
                      title="Zaznamenat GPS"
                    >
                      <MapPin size={18} />
                    </button>
                    <button 
                      onClick={async () => {
                        try {
                          const res = await fetch("/api/tasks", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ 
                              title: "Nové místo",
                              status: "DONE",
                              taskType: "LOCATION_HISTORY",
                              parentId: currentFolder.id,
                              recordedAt: new Date().toISOString()
                            }),
                          });
                          if (res.ok) {
                            const newTask = await res.json();
                            setTasks((prev) => [...prev, newTask]);
                            setSelectedTask(newTask);
                          }
                        } catch (err) {
                          console.error("Failed to create manual location", err);
                        }
                      }}
                      className={styles.headerActionBtn}
                      title="Přidat ručně"
                    >
                      <Search size={18} />
                    </button>
                    <button 
                      onClick={() => {
                        const shareId = currentFolder?.slug || currentParentId;
                        const url = `${window.location.origin}/blog/${shareId}`;
                        navigator.clipboard.writeText(url);
                        window.open(url, "_blank");
                      }}
                      className={styles.headerActionBtn}
                      title="Sdílet a otevřít blog"
                    >
                      <Share size={18} />
                    </button>
                  </div>
                )}
                <button onClick={toggleZen} className={styles.zenToggle}>
                  <Maximize2 size={18} />
                </button>
              </div>
            </div>
          </header>

          {(!isEvidenceView || tasks.filter(t => t.parentId === currentParentId && !t.isDeleted).length > 8) && (
            <div className={styles.filterBar}>
            <div className={styles.searchGroup}>
              <Search className={styles.searchIcon} size={16} />
              <input 
                type="text"
                placeholder="Hledat..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
            </div>
            
            {!isEvidenceView && (
              <div className={styles.filterGroup}>
                {[
                  { id: "ACTIVE", label: "Aktivní" },
                  { id: "ALL", label: "Vše" },
                  { id: "TODO", label: "K řešení" },
                  { id: "DONE", label: "Hotovo" },
                  { id: "TRASH", label: "Koš" }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setFilterStatus(f.id)}
                    className={`${styles.filterChip} ${filterStatus === f.id ? styles.chipActive : styles.chipInactive}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}

            {!isEvidenceView && (
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={styles.sortSelect}>
                <option value="PRIORITY">Priority</option>
                <option value="PROGRESS">Progress</option>
              </select>
            )}

            <button onClick={() => setViewMode(viewMode === "list" ? "grid" : "list")} className="ml-2 opacity-40 hover:opacity-100 transition-opacity">
              {viewMode === "list" ? <ListIcon size={20} /> : <Grid size={20} />}
            </button>
            </div>
          )}

          {currentParentId && !isEvidenceView && (
            <div className={styles.inlineActions}>
              <button onClick={() => { setAddingType('TASK'); setIsAddingTask(true); }} className={styles.inlineActionBtn}>
                <div className={styles.inlineIcon} style={{ color: '#f59e0b' }}><CheckSquare size={16} /></div>
                <span>Úkol</span>
              </button>
              <button onClick={() => { setAddingType('EXPENSE'); setIsAddingTask(true); }} className={styles.inlineActionBtn}>
                <div className={styles.inlineIcon} style={{ color: '#ef4444' }}><Wallet size={16} /></div>
                <span>Výdaj</span>
              </button>
              <button onClick={() => { setIsSelectingLocation(true); setIsAddingTask(false); }} className={styles.inlineActionBtn}>
                <div className={styles.inlineIcon} style={{ color: '#3b82f6' }}><MapPin size={16} /></div>
                <span>Místo</span>
              </button>
              <button onClick={() => { setAddingType('FOLDER'); setIsAddingTask(true); }} className={styles.inlineActionBtn}>
                <div className={styles.inlineIcon} style={{ color: '#737373' }}><FolderOpen size={16} /></div>
                <span>Složka</span>
              </button>
              <button onClick={() => { setAddingType('NOTE'); setIsAddingTask(true); }} className={styles.inlineActionBtn}>
                <div className={styles.inlineIcon} style={{ color: '#8b5cf6' }}><FileText size={16} /></div>
                <span>Záznam</span>
              </button>
              <button 
                onClick={() => {
                  navigator.geolocation.getCurrentPosition(async (pos) => {
                    const { latitude: lat, longitude: lng } = pos.coords;
                    await fetch('/api/tasks', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        title: `GPS Log ${new Date().toLocaleTimeString('cs-CZ')}`,
                        taskType: 'GPS_LOG',
                        parentId: currentParentId,
                        recordedAt: new Date().toISOString(),
                        locations: {
                          create: [{ latitude: lat, longitude: lng, address: `${lat.toFixed(4)}, ${lng.toFixed(4)}` }]
                        }
                      })
                    });
                    // Refresh
                    window.location.reload();
                  });
                }} 
                className={styles.inlineActionBtn}
              >
                <div className={styles.inlineIcon} style={{ color: '#0ea5e9' }}><Navigation size={16} /></div>
                <span>Zapsat GPS</span>
              </button>
            </div>
          )}
        </>
      ) : (
        <button onClick={toggleZen} className={styles.zenRestore}>
          <Minimize2 size={18} />
        </button>
      )}

      <AnimatePresence>
        {isAddingTask && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className={styles.addTypeContainer}
          >
            {(!currentParentId || addingType) ? (
              <form 
                onSubmit={(e) => { e.preventDefault(); handleAddTask(); }} 
                className={styles.addForm}
              >
                <input 
                  autoFocus
                  placeholder={addingType === 'FOLDER' ? "Název projektu/složky..." : "Zadejte název..."} 
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onBlur={() => { if(!newTaskTitle) { setIsAddingTask(false); setAddingType(null); } }}
                />
                <button type="submit">Vytvořit</button>
              </form>
            ) : (
              <div className={styles.typeSelector}>
                <button onClick={() => setAddingType('TASK')} className={styles.typeOption}>
                   <div className={styles.typeIcon} style={{ background: '#f59e0b' }}><CheckSquare size={16} /></div>
                   <span>Úkol</span>
                </button>
                <button onClick={() => setAddingType('EXPENSE')} className={styles.typeOption}>
                   <div className={styles.typeIcon} style={{ background: '#ef4444' }}><Wallet size={16} /></div>
                   <span>Výdaj</span>
                </button>
                <button onClick={() => { setIsSelectingLocation(true); setIsAddingTask(false); }} className={styles.typeOption}>
                   <div className={styles.typeIcon} style={{ background: '#3b82f6' }}><MapPin size={16} /></div>
                   <span>Místo (GPS)</span>
                </button>
                <button onClick={() => setAddingType('FOLDER')} className={styles.typeOption}>
                   <div className={styles.typeIcon} style={{ background: '#737373' }}><FolderOpen size={16} /></div>
                   <span>Podsložka</span>
                </button>
                <button onClick={() => setAddingType('NOTE')} className={styles.typeOption}>
                   <div className={styles.typeIcon} style={{ background: '#8b5cf6' }}><FileText size={16} /></div>
                   <span>Záznam</span>
                </button>
                <button onClick={() => setIsAddingTask(false)} className={styles.closeTypeSelector}>
                   <X size={18} />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <main className={viewMode === "grid" ? styles.grid : styles.list}>
        {loading ? (
          <div className={styles.loading}>Načítám...</div>
        ) : (
          <AnimatePresence mode="popLayout">
            {isLocationHistoryFolder && stats && (
              <div className={styles.journeySummary}>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>Rozmezí</span>
                  <span className={styles.summaryValue}>{stats.timeRange}</span>
                </div>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>Celkem</span>
                  <span className={styles.summaryValue}>{stats.totalDistance} km</span>
                </div>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>Bodů</span>
                  <span className={styles.summaryValue}>{stats.sortedTasks.length}</span>
                </div>
              </div>
            )}

            {displayTasks.length === 0 ? (
              <div className={styles.empty}>
                <h3>Prázdno ✨</h3>
                <p>Začni tím, že přidáš první položku v této úrovni.</p>
              </div>
            ) : (
              displayTasks.map((task, idx) => {
                const nextTask = displayTasks[idx + 1];
                let distToNext = 0;

                if (isLocationHistoryFolder && nextTask) {
                   if (nextTask.calculatedDistance !== null && nextTask.calculatedDistance !== undefined) {
                      distToNext = nextTask.calculatedDistance;
                   } else {
                      const loc1 = task.locations?.[0];
                      const loc2 = nextTask.locations?.[0];
                      if (loc1 && loc2) {
                        distToNext = calculateDistance(loc1.latitude, loc1.longitude, loc2.latitude, loc2.longitude);
                      }
                   }
                }

                return (
                  <React.Fragment key={task.id}>
                    <TaskCard 
                      task={{ ...task, progress: getTaskProgress(task) }}
                      onUpdate={(data: any) => handleUpdate(task.id, data)}
                      onDelete={handleDelete}
                      onOpen={() => goToFolder(task.id)}
                      onOpenDetail={() => openTaskDetail(task)}
                      isEvidence={isEvidenceView}
                    />
                    {isLocationHistoryFolder && nextTask && (
                      <div className={styles.timelineConnector}>
                        <div className={styles.line} />
                        {distToNext > 0.1 && (
                          <div className={styles.distanceBadge}>{distToNext.toFixed(1)} km</div>
                        )}
                        <div className={styles.line} />
                      </div>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </AnimatePresence>
        )}
      </main>

      <AnimatePresence>
        {showUndo && (
          <motion.div initial={{ y: 50 }} animate={{ y: 0 }} exit={{ y: 50 }} className={styles.undoToast}>
            <span>Smazáno</span>
            <button onClick={() => { handleUndo(); setShowUndo(false); }} className={styles.undoBtn}>UNDO</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
