"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { TaskCard } from "../TaskCard/TaskCard";
import { TaskDetail } from "../TaskDetail/TaskDetail";
import { QuickExpenseModal } from "../QuickExpenseModal/QuickExpenseModal";
import { LocationSelectionModal } from "../LocationSelectionModal/LocationSelectionModal";
import { LocationTracker } from "../LocationTracker/LocationTracker";
import { Search, Grid, List as ListIcon, Home, ChevronRight, Maximize2, Minimize2, Wallet, Tag, Building, X, Save, MapPin } from "lucide-react";
import styles from "./TaskList.module.css";
import { motion, AnimatePresence } from "framer-motion";

export const TaskList = () => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [selectedTask, setSelectedTask] = useState<any | null>(null);

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
  const [categories, setCategories] = useState<any[]>([]);

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
    fetchTasks();
    
    // Sync state if URL changes (back button support)
    const pId = searchParams.get("parentId");
    if (pId !== currentParentId) {
      setCurrentParentId(pId);
    }
    
    // Global event for adding task from sidebar
    const handleAddTaskEvent = () => setIsAddingTask(true);
    window.addEventListener("addTask", handleAddTaskEvent);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedTask) setSelectedTask(null);
        else if (quickActionTask) setQuickActionTask(null);
        else if (isAddingTask) setIsAddingTask(false);
        else goUp();
      }
    };

    // Quick Action listener
    const handleQuickActionEvent = (e: any) => {
      const task = e.detail.task;
      if (task.taskType === "LOCATION_HISTORY") {
        setIsSelectingLocation(true);
        // We could pass the task.id to handleLocationSelect
      } else {
        setQuickActionTask(task);
      }
    };
    window.addEventListener("quickAction", handleQuickActionEvent as any);

    window.addEventListener("keydown", handleKeyDown);
    fetchCategories();

    return () => {
      window.removeEventListener("addTask", handleAddTaskEvent);
      window.removeEventListener("quickAction", handleQuickActionEvent as any);
      window.removeEventListener("keydown", handleKeyDown);
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

  // Derived breadcrumbs (resilient even if parent is not in the list)
  const currentFolder = tasks.find(t => t.id === currentParentId);
  const isEvidenceView = currentFolder?.taskType === "EXPENSE" || currentFolder?.taskType === "LOCATION_HISTORY";

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
    if (task.subTasks && task.subTasks.length > 0) {
      const doneCount = task.subTasks.filter((st: any) => st.status === "DONE").length;
      return Math.round((doneCount / task.subTasks.length) * 100);
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

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          title: newTaskTitle,
          status: "TODO",
          priority: "MEDIUM",
          taskType: "TASK",
          parentId: currentParentId,
        }),
      });
      if (res.ok) {
        const newTask = await res.json();
        setTasks([newTask, ...tasks]);
        setNewTaskTitle("");
        setIsAddingTask(false);
      }
    } catch (error) {
      console.error("Failed to add task", error);
    }
  };

  const handleLocationSelect = async (loc: any) => {
    try {
      const taskRes = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: loc.placeName,
          description: loc.address,
          status: "DONE",
          priority: "LOW",
          taskType: "LOCATION_HISTORY",
          parentId: currentParentId,
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
          taskId: newSubtask.id,
        })
      });

      setIsSelectingLocation(false);
      fetchTasks();
    } catch (err) {
      console.error(err);
    }
  };

  const handleQuickLocation = async (task: any) => {
    // Deprecated in favor of handleLocationSelect via modal
    setIsSelectingLocation(true);
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
      // If we are inside a folder (currentParentId is set), 
      // we usually want to see all entries (even DONE ones)
      if (currentParentId) {
        return task.status !== "CANCELED";
      }
      return task.status !== "DONE" && task.status !== "CANCELED";
    }
    if (filterStatus !== "ALL" && task.status !== filterStatus) return false;
    
    return true;
  }).sort((a, b) => {
    if (sortBy === "PRIORITY") {
      const pMap: any = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return pMap[a.priority] - pMap[b.priority];
    }
    if (sortBy === "PROGRESS") return (b.progress || 0) - (a.progress || 0);
    return 0;
  });

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
        {isSelectingLocation && (
          <LocationSelectionModal 
            onClose={() => setIsSelectingLocation(false)}
            onSelect={handleLocationSelect}
          />
        )}
      </AnimatePresence>

      {!isZen ? (
        <>
          <header className={styles.header}>
            <div className={styles.breadcrumbHeader}>
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
              </div>

              <div className={styles.headerActions}>
                {currentParentId && (
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
                  </div>
                )}
                <button onClick={toggleZen} className={styles.zenToggle}>
                  <Maximize2 size={18} />
                </button>
              </div>
            </div>
          </header>

          {tasks.filter(t => t.parentId === currentParentId && !t.isDeleted).length > 0 && (
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
        </>
      ) : (
        <button onClick={toggleZen} className={styles.zenRestore}>
          <Minimize2 size={18} />
        </button>
      )}

      <AnimatePresence>
        {isAddingTask && (
          <motion.form 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleAddTask} 
            className={styles.addForm}
          >
            <input 
              autoFocus
              placeholder={currentParentId ? "Nový podúkol..." : "Nový projekt..."} 
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onBlur={() => !newTaskTitle && setIsAddingTask(false)}
            />
            <button type="submit">Přidat</button>
          </motion.form>
        )}
      </AnimatePresence>

      <main className={viewMode === "grid" ? styles.grid : styles.list}>
        {loading ? (
          <div className={styles.loading}>Načítám...</div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredTasks.length === 0 ? (
              <div className={styles.empty}>
                <h3>Prázdno ✨</h3>
                <p>Začni tím, že přidáš první položku v této úrovni.</p>
                {/* Buttons moved to header */}
              </div>
            ) : (
              filteredTasks.map(task => (
                <TaskCard 
                  key={task.id} 
                  task={{ ...task, progress: getTaskProgress(task) }}
                  onUpdate={(data: any) => handleUpdate(task.id, data)}
                  onDelete={handleDelete}
                  onOpen={() => goToFolder(task.id)}
                  onOpenDetail={() => setSelectedTask(task)}
                  isEvidence={isEvidenceView}
                />
              ))
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
