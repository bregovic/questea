"use client";

import React, { useEffect, useState } from "react";
import { TaskCard } from "../TaskCard/TaskCard";
import { Plus, Filter, Search, Grid, List as ListIcon } from "lucide-react";
import styles from "./TaskList.module.css";
import { motion, AnimatePresence } from "framer-motion";

export const TaskList = () => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");

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

  const handleStatusChange = async (id: string, newStatus: string) => {
    const originalTasks = [...tasks];
    setTasks(tasks.map(t => t.id === id ? { ...t, status: newStatus } : t));

    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
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
          taskType: "TASK"
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

  return (
    <div className={styles.container}>
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
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            onSubmit={handleAddTask} 
            className={styles.addForm}
          >
            <input 
              autoFocus
              type="text" 
              placeholder="Co je třeba udělat?" 
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
              <TaskCard 
                key={task.id} 
                task={task} 
                onStatusChange={handleStatusChange} 
                onDelete={handleDelete}
              />
            ))
          )}
        </motion.div>
      )}
    </div>
  );
};
