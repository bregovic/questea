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
        <div className={styles.searchBar}>
          <Search size={18} />
          <input type="text" placeholder="Hledej úkol..." />
        </div>

        <div className={styles.actions}>
          <button onClick={() => setViewMode(viewMode === "list" ? "grid" : "list")} className={styles.iconBtn}>
            {viewMode === "list" ? <Grid size={20} /> : <ListIcon size={20} />}
          </button>
          <button onClick={() => setIsAddingTask(true)} className={styles.addBtn}>
            <Plus size={20} />
            <span>Přidat úkol</span>
          </button>
        </div>
      </header>

      {/* Quick Add Form */}
      <AnimatePresence>
        {isAddingTask && (
          <motion.form 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
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
          {tasks.length === 0 ? (
            <div className={styles.empty}>
              <h3>Vše hotovo! ✨</h3>
              <p>Zatím tu nemáš žádné úkoly k řešení.</p>
            </div>
          ) : (
            tasks.map(task => (
              <div key={task.id} className={styles.taskGroup}>
                <TaskCard 
                  task={task} 
                  onStatusChange={(id, status) => handleUpdate(id, { status })} 
                  onDelete={handleDelete}
                  onOpen={() => setSelectedTask(task)}
                />
                
                {/* Render Subtasks if in list mode */}
                {viewMode === "list" && task.subTasks && task.subTasks.length > 0 && (
                  <div className={styles.subTasks}>
                    {task.subTasks.map((sub: any) => (
                      <TaskCard 
                        key={sub.id}
                        task={sub} 
                        onStatusChange={(id, status) => handleUpdate(id, { status })} 
                        onDelete={handleDelete}
                        onOpen={() => setSelectedTask(sub)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </motion.div>
      )}
    </div>
  );
};
