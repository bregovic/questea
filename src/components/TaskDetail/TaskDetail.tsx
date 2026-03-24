"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, User, FileText, Link as LinkIcon, Image as ImageIcon, Calendar, Shield, CheckCircle, Plus } from "lucide-react";
import styles from "./TaskDetail.module.css";

interface TaskDetailProps {
  task: any;
  onClose: () => void;
  onUpdate: (id: string, data: any) => void;
}

export const TaskDetail: React.FC<TaskDetailProps> = ({ task, onClose, onUpdate }) => {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");

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

  const handleSubtaskAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          title: newSubtaskTitle,
          status: "TODO",
          priority: "MEDIUM",
          taskType: "TASK",
          parentId: task.id,
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

  const handleSplitTask = async () => {
    const lines = description.split('\n').filter((l: string) => l.trim());
    if (lines.length <= 1) return;

    const confirmSplit = confirm(`Rozdělit popis na ${lines.length} nových podúkolů?`);
    if (!confirmSplit) return;

    for (const line of lines) {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          title: line.substring(0, 50),
          description: line,
          status: "TODO",
          priority: task.priority,
          parentId: task.id,
        }),
      });
    }
    // Refresh task to show new subtasks (parent keeps state)
    window.location.reload(); 
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
          {task.parent && (
            <div className={styles.breadcrumbs}>
              <span>{task.parent.title}</span>
              <span className={styles.breadcrumbSeparator}>/</span>
            </div>
          )}
          <input 
            className={styles.titleInput}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSaveTitle}
          />
          <div className="flex gap-2">
            <span className={styles.typeBadge}>{task.taskType}</span>
            <span className={styles.typeBadge} style={{ background: task.priority === 'URGENT' ? '#fee2e2' : '#f5f5f4' }}>
              {task.priority}
            </span>
          </div>
        </div>
        <button onClick={onClose} className={styles.closeBtn}>
          <X size={24} />
        </button>
      </header>

      <div className={styles.content}>
        {/* Quick Actions */}
        <div className={styles.actionRow}>
          <button onClick={handleSplitTask} className={`${styles.actionBtn} ${styles.splitBtn}`}>
            <Shield size={14} /> Rozdělit úkol
          </button>
          <button onClick={() => window.print()} className={styles.actionBtn}>
            <FileText size={14} /> Export
          </button>
        </div>

        {/* Description Section */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <FileText size={18} />
            <span>Popis požadavku</span>
          </div>
          <textarea 
            className={styles.textarea}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleSaveDescription}
            placeholder="Zadejte detailní popis... Tip: Každý řádek může být nový úkol!"
          />
        </section>

        {/* Subtasks Section */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <LinkIcon size={18} />
            <span>Struktura a podúkoly</span>
          </div>
          
          <form onSubmit={handleSubtaskAdd} className="flex gap-2 mb-2">
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

          <div className={styles.subtaskList}>
            {task.subTasks?.map((st: any) => (
              <div key={st.id} className={styles.subtaskItem}>
                <span className={st.status === 'DONE' ? 'line-through opacity-50' : ''}>{st.title}</span>
                <span className="text-[10px] font-bold opacity-30 uppercase">{st.status}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Roles Section */}
        <section className={styles.labelsGrid}>
          <div className={styles.labelItem}>
            <div className={styles.labelHeader}><User size={14} /> Vlastník</div>
            <div className={styles.labelValue}>{task.user?.name || "Já"}</div>
          </div>
          <div className={styles.labelItem}>
            <div className={styles.labelHeader}><Calendar size={14} /> Termín</div>
            <div className={styles.labelValue}>{task.dueDate ? new Date(task.dueDate).toLocaleDateString("cs-CZ") : "DNES"}</div>
          </div>
        </section>
      </div>
    </motion.div>
  );
};
