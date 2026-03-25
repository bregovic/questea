"use client";

import React, { useEffect, useState, useCallback } from "react";
import { TaskCard } from "../TaskCard/TaskCard";
import { TaskDetail } from "../TaskDetail/TaskDetail";
import { Search, Grid, List as ListIcon, Home, ChevronRight } from "lucide-react";
import styles from "./TaskList.module.css";
import { motion, AnimatePresence } from "framer-motion";

export const TaskList = () => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [selectedTask, setSelectedTask] = useState<any | null>(null);

  // Navigation & Filtering
  const [currentParentId, setCurrentParentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<string>("PRIORITY");

  const [lastDeletedTask, setLastDeletedTask] = useState<any | null>(null);
  const [showUndo, setShowUndo] = useState(false);

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

  const goUp = useCallback(() => {
    if (!currentParentId) return;
    const current = tasks.find(t => t.id === currentParentId);
    setCurrentParentId(current?.parentId || null);
  }, [currentParentId, tasks]);

  useEffect(() => {
    fetchTasks();
    
    // Global event for adding task from sidebar
    const handleAddTaskEvent = () => setIsAddingTask(true);
    window.addEventListener("addTask", handleAddTaskEvent);

    // Keyboard navigation (ESC to go up)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedTask) setSelectedTask(null);
        else if (isAddingTask) setIsAddingTask(false);
        else goUp();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("addTask", handleAddTaskEvent);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [goUp, selectedTask, isAddingTask]);

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

  // Derived breadcrumbs
  const breadcrumbs: any[] = [];
  let curr: any = tasks.find(t => t.id === currentParentId);
  while (curr) {
    breadcrumbs.unshift(curr);
    curr = tasks.find(t => t.id === curr.parentId);
  }

  const handleUpdate = async (id: string, data: any) => {
    const originalTasks = [...tasks];
    const updateTasksRecursively = (taskList: any[]): any[] => {
      return taskList.map(t => {
        if (t.id === id) return { ...t, ...data };
        if (t.subTasks) return { ...t, subTasks: updateTasksRecursively(t.subTasks) };
        return t;
      });
    };
    setTasks(updateTasksRecursively(tasks));
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
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
    const originalTasks = [...tasks];
    setTasks(tasks.filter(t => t.id !== id));
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
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

  const filteredTasks = tasks.filter(task => {
    // If searching, show all matches regardless of hierarchy
    if (searchQuery) {
      return task.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
             task.description?.toLowerCase().includes(searchQuery.toLowerCase());
    }
    
    // Status filter (always applied)
    if (filterStatus !== "ALL" && task.status !== filterStatus) return false;
    
    // Normal drill-down navigation
    return task.parentId === currentParentId;
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
            onClose={() => setSelectedTask(null)}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        )}
      </AnimatePresence>

      <header className={styles.header}>
        <div className={styles.breadcrumbContainer}>
          <button onClick={() => setCurrentParentId(null)} className={styles.pathItem}>
            <Home size={20} className={!currentParentId ? "text-coral" : ""} />
          </button>
          {breadcrumbs.map((b, idx) => (
            <React.Fragment key={b.id}>
              <ChevronRight size={14} className={styles.pathSeparator} />
              <button 
                onClick={() => setCurrentParentId(b.id)}
                className={`${styles.pathItem} ${idx === breadcrumbs.length - 1 ? styles.activePath : ""}`}
              >
                {b.title}
              </button>
            </React.Fragment>
          ))}
        </div>

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
          
          <div className={styles.filterGroup}>
            {["ALL", "TODO", "IN_PROGRESS", "DONE"].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`${styles.filterChip} ${filterStatus === status ? styles.chipActive : styles.chipInactive}`}
              >
                {status === "ALL" ? "Vše" : status}
              </button>
            ))}
          </div>

          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={styles.sortSelect}>
            <option value="PRIORITY">Priority</option>
            <option value="PROGRESS">Progress</option>
          </select>

          <button onClick={() => setViewMode(viewMode === "list" ? "grid" : "list")} className="ml-auto opacity-40 hover:opacity-100 transition-opacity">
            {viewMode === "list" ? <ListIcon size={20} /> : <Grid size={20} />}
          </button>
        </div>
      </header>

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
              </div>
            ) : (
              filteredTasks.map(task => (
                <TaskCard 
                  key={task.id} 
                  task={task} 
                  onUpdate={(data) => handleUpdate(task.id, data)}
                  onDelete={() => handleDelete(task.id)}
                  onOpen={() => {
                    if (task.subTasks?.length > 0) setCurrentParentId(task.id);
                    else setSelectedTask(task);
                  }}
                  onOpenDetail={() => setSelectedTask(task)}
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
