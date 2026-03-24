"use client";

import React, { useEffect, useState } from "react";
import { TaskCard } from "../TaskCard/TaskCard";
import { TaskDetail } from "../TaskDetail/TaskDetail";
import { Plus, Filter, Search, Grid, List as ListIcon, Subtitles } from "lucide-react";
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
  const [showOnlyRoot, setShowOnlyRoot] = useState(false);
  const [sortBy, setSortBy] = useState<string>("PRIORITY");

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

  // Derived filtered tasks
  const filteredTasks = tasks.filter(task => {
    // Search
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    // Status
    if (filterStatus !== "ALL" && task.status !== filterStatus) return false;
    // Root only
    if (showOnlyRoot && task.parentId) return false;
    return true;
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

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleUpdate = async (id: string, data: any) => {
    const originalTasks = [...tasks];
    
    // Update local state deeply if it's a subtask or root
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
    const originalTasks = [...tasks];
    setTasks(tasks.filter(t => t.id !== id));

    try {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch (error) {
      setTasks(originalTasks);
    }
  };

  const handleAddTask = async (e: React.FormEvent, parentId?: string) => {
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
          parentId: parentId || null,
        }),
      });
      if (res.ok) {
        const newTask = await res.json();
        if (parentId) {
          setTasks(tasks.map(t => t.id === parentId ? { ...t, subTasks: [...(t.subTasks || []), newTask] } : t));
        } else {
          setTasks([newTask, ...tasks]);
        }
        setNewTaskTitle("");
        setIsAddingTask(false);
      }
    } catch (error) {
      console.error("Failed to add task", error);
    }
  };

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
          <h1 className="text-3xl font-bold text-sand-dark">Dnešní úkoly</h1>
          <div className={styles.headerActions}>
            <button 
              onClick={() => setViewMode(viewMode === "list" ? "grid" : "list")}
              className={styles.iconButton}
            >
              {viewMode === "list" ? <Grid size={20} /> : <ListIcon size={20} />}
            </button>
            <button 
              onClick={() => setIsAddingTask(true)}
              className={styles.addButton}
            >
              <Plus size={20} />
              <span>Nový úkol</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col md:flex-row gap-4 mt-4 p-4 px-6 bg-white/50 backdrop-blur-sm rounded-[32px] border border-sand/20 sticky top-4 z-40 w-full shadow-sm">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-sand-dark/40" />
            <input 
              type="text"
              placeholder="Hledat úkoly..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 p-3 bg-white border-none rounded-2xl text-sm focus:ring-2 focus:ring-coral shadow-sm shadow-sand/10"
            />
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {["ALL", "TODO", "IN_PROGRESS", "DONE"].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap ${
                  filterStatus === status 
                    ? "bg-coral text-white shadow-lg shadow-coral/20" 
                    : "bg-white text-sand-dark/60 hover:bg-sand/10 border border-sand/10"
                }`}
              >
                {status === "ALL" ? "Vše" : status === "TODO" ? "K vyřízení" : status === "IN_PROGRESS" ? "V řešení" : "Hotovo"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowOnlyRoot(!showOnlyRoot)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold border transition-all ${
                showOnlyRoot ? "bg-sand-dark text-white border-sand-dark shadow-md" : "bg-white text-sand-dark/60 border-sand/20 hover:bg-sand/5"
              }`}
            >
              <Subtitles className="w-4 h-4" /> Root
            </button>
            
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-5 py-2.5 bg-white border border-sand/20 rounded-2xl text-xs font-bold text-sand-dark/60 focus:ring-2 focus:ring-coral cursor-pointer shadow-sm"
            >
              <option value="PRIORITY">Podle priority</option>
              <option value="PROGRESS">Podle progresu</option>
            </select>
          </div>
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
              placeholder="Nový hlavní úkol (např. Dům, Auto...)" 
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onBlur={() => !newTaskTitle && setIsAddingTask(false)}
            />
            <button type="submit">Vytvořit</button>
          </motion.form>
        )}
      </AnimatePresence>

      {loading ? (
        <div className={styles.loading}>Načítám tvé úkoly...</div>
      ) : (
        <motion.div layout className={viewMode === "grid" ? styles.grid : styles.list}>
          <AnimatePresence mode="popLayout">
            {filteredTasks.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={styles.empty}
              >
                <h3>Vše hotovo! ✨</h3>
                <p>Žádné úkoly neodpovídají vybraným filtrům.</p>
              </motion.div>
            ) : (
              filteredTasks.map(task => (
                <motion.div 
                  key={task.id} 
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={styles.taskGroup}
                >
                  <TaskCard 
                    task={task} 
                    onUpdate={(data) => handleUpdate(task.id, data)}
                    onDelete={() => handleDelete(task.id)}
                    onOpen={() => setSelectedTask(task)}
                  />
                  
                  {/* Render Subtasks if in list mode and not filtering by Root only */}
                  {viewMode === "list" && !showOnlyRoot && task.subTasks && task.subTasks.length > 0 && (
                    <div className={styles.subTasks}>
                      {task.subTasks.map((sub: any) => (
                        <TaskCard 
                          key={sub.id}
                          task={sub} 
                          onUpdate={(data) => handleUpdate(sub.id, data)}
                          onDelete={() => handleDelete(sub.id)}
                          onOpen={() => setSelectedTask(sub)}
                        />
                      ))}
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
};
