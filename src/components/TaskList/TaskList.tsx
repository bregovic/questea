"use client";

import React, { useEffect, useState } from "react";
import { TaskCard } from "../TaskCard/TaskCard";
import { TaskDetail } from "../TaskDetail/TaskDetail";
import { Plus, Search, Grid, List as ListIcon, ChevronLeft } from "lucide-react";
import styles from "./TaskList.module.css";
import { motion, AnimatePresence } from "framer-motion";

export const TaskList = () => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [selectedTask, setSelectedTask] = useState<any | null>(null);

  // Filters & Sorting
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<string>("PRIORITY");
  const [currentParentId, setCurrentParentId] = useState<string | null>(null);

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

  useEffect(() => {
    fetchTasks();
  }, []);

  // Derived breadcrumbs for drill-down
  const getBreadcrumbs = () => {
    if (!currentParentId) return [];
    const breadcrumbs: any[] = [];
    let curr: any = tasks.find(t => t.id === currentParentId);
    while (curr) {
      breadcrumbs.unshift(curr);
      curr = tasks.find(t => t.id === curr.parentId);
    }
    return breadcrumbs;
  };

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

  // Derived filtered tasks for drill-down
  const filteredTasks = tasks.filter(task => {
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterStatus !== "ALL" && task.status !== filterStatus) return false;
    return task.parentId === currentParentId;
  }).sort((a, b) => {
    if (sortBy === "PRIORITY") {
      const pMap: any = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return pMap[a.priority] - pMap[b.priority];
    }
    if (sortBy === "PROGRESS") {
      return (b.progress || 0) - (a.progress || 0);
    }
    return 0;
  });

  return (
    <div className={styles.container}>
      {/* Detail Drawer */}
      <AnimatePresence>
        {selectedTask && (
          <TaskDetail 
            task={selectedTask} 
            onClose={() => setSelectedTask(null)}
            onUpdate={handleUpdate}
          />
        )}
      </AnimatePresence>

      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsAddingTask(true)}
              className={styles.addButton}
            >
              <Plus size={20} />
              <span>Nový úkol</span>
            </button>
            
            {currentParentId && (
              <button 
                onClick={() => {
                  const parent = tasks.find(t => t.id === currentParentId);
                  setCurrentParentId(parent?.parentId || null);
                }}
                className="flex items-center gap-1 text-sm font-bold text-sand-dark opacity-40 hover:opacity-100 transition-opacity"
              >
                <ChevronLeft size={16} /> Zpět
              </button>
            )}
          </div>

          <div className="flex-1 px-4">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              <button 
                onClick={() => setCurrentParentId(null)}
                className={`text-xs font-bold uppercase tracking-wider ${!currentParentId ? 'text-coral' : 'text-sand-dark/40'}`}
              >
                Root
              </button>
              {getBreadcrumbs().map((b: any) => (
                <React.Fragment key={b.id}>
                  <span className="text-sand-dark/20">/</span>
                  <button 
                    onClick={() => setCurrentParentId(b.id)}
                    className="text-xs font-bold uppercase tracking-wider text-sand-dark/60 hover:text-coral whitespace-nowrap"
                  >
                    {b.title}
                  </button>
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className={styles.headerActions}>
            <button 
              onClick={() => setViewMode(viewMode === "list" ? "grid" : "list")}
              className={styles.iconButton}
            >
              {viewMode === "list" ? <ListIcon size={20} /> : <Grid size={20} />}
            </button>
          </div>
        </div>

        {/* Filter Bar */}
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
                {status === "ALL" ? "Vše" : status === "TODO" ? "Todo" : status === "IN_PROGRESS" ? "Progress" : "Done"}
              </button>
            ))}
          </div>

          <select 
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className={styles.sortSelect}
          >
            <option value="PRIORITY">Priority</option>
            <option value="PROGRESS">Progress</option>
          </select>
        </div>
      </header>

      {/* Quick Add Form */}
      <AnimatePresence>
        {isAddingTask && (
          <motion.form 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            onSubmit={handleAddTask} 
            className={styles.addForm}
          >
            <input 
              autoFocus
              type="text" 
              placeholder={currentParentId ? "Nový podúkol..." : "Nový projekt..."} 
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onBlur={() => !newTaskTitle && setIsAddingTask(false)}
            />
            <button type="submit">Přidat</button>
          </motion.form>
        )}
      </AnimatePresence>

      {loading ? (
        <div className={styles.loading}>Načítám...</div>
      ) : (
        <motion.div layout className={viewMode === "grid" ? styles.grid : styles.list}>
          <AnimatePresence mode="popLayout">
            {filteredTasks.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={styles.empty}
              >
                <h3>Prázdno ✨</h3>
                <p>Klikni na + přidat a vytvoř první úkol v této úrovni.</p>
              </motion.div>
            ) : (
              filteredTasks.map(task => (
                <motion.div 
                  key={task.id} 
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                >
                  <TaskCard 
                    task={task} 
                    onUpdate={(data) => handleUpdate(task.id, data)}
                    onDelete={() => handleDelete(task.id)}
                    onOpen={() => {
                      if (task.subTasks && task.subTasks.length > 0) {
                        setCurrentParentId(task.id);
                      } else {
                        setSelectedTask(task);
                      }
                    }}
                    onOpenDetail={() => setSelectedTask(task)}
                  />
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Undo Toast */}
      <AnimatePresence>
        {showUndo && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className={styles.undoToast}
          >
            <span>Smazáno</span>
            <button onClick={handleUndo} className={styles.undoBtn}>UNDO</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
