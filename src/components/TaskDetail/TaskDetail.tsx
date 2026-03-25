"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, User, FileText, Link as LinkIcon, Calendar, Shield, CheckCircle, Plus, Trash2, Mail, Layers } from "lucide-react";
import styles from "./TaskDetail.module.css";

interface TaskDetailProps {
  task: any;
  allTasks: any[]; // New prop for parent selection
  onClose: () => void;
  onUpdate: (id: string, data: any) => void;
  onDelete: (id: string) => void;
}

export const TaskDetail: React.FC<TaskDetailProps> = ({ task, allTasks, onClose, onUpdate, onDelete }) => {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [priority, setPriority] = useState(task.priority);
  const [ownerEmail, setOwnerEmail] = useState(task.user?.email || "");
  const [parentId, setParentId] = useState(task.parentId || "");
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

  const handlePriorityChange = (newPriority: string) => {
    setPriority(newPriority);
    onUpdate(task.id, { priority: newPriority });
  };

  const handleParentChange = (newParentId: string) => {
      const pId = newParentId === "" ? null : newParentId;
      setParentId(newParentId);
      onUpdate(task.id, { parentId: pId });
  };

  const handleOwnerChange = () => {
    if (ownerEmail !== task.user?.email) {
      onUpdate(task.id, { ownerEmail });
    }
  };

  const handleDelete = () => {
    if (confirm("Opravdu chcete tento úkol smazat?")) {
      onDelete(task.id);
      onClose();
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
          priority: task.priority,
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
            <span className={styles.typeBadge}>{task.taskType}</span>
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
          </div>
        </div>
        <button onClick={onClose} className={styles.closeBtn}>
          <X size={24} />
        </button>
      </header>

      <div className={styles.content}>
        {/* Quick Actions */}
        <div className={styles.actionRow}>
          <button onClick={() => window.print()} className={styles.actionBtn}>
            <FileText size={14} /> Export
          </button>
          <button onClick={handleDelete} className={`${styles.actionBtn} ${styles.deleteBtn}`}>
            <Trash2 size={14} /> Smazat úkol
          </button>
        </div>

        {/* Parent Selection */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <Layers size={18} />
            <span>Nadřazený úkol (Hierarchie)</span>
          </div>
          <select 
            className={styles.select}
            value={parentId}
            onChange={(e) => handleParentChange(e.target.value)}
          >
            <option value="">(Bez nadřazeného úkolu - ROOT)</option>
            {allTasks
                .filter(t => t.id !== task.id) // Can't be parent of itself
                .map(t => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))
            }
          </select>
        </section>

        {/* Description Section */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <FileText size={18} />
            <span>Popis</span>
          </div>
          <textarea 
            className={styles.textarea}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleSaveDescription}
            placeholder="Detailní popis..."
          />
        </section>

        {/* Roles Section */}
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

        {/* Subtasks Section */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <LinkIcon size={18} />
            <span>Podúkolů ({task.subTasks?.length || 0})</span>
          </div>
          
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

          <div className={styles.subtaskList}>
            {task.subTasks?.map((st: any) => (
              <div key={st.id} className={styles.subtaskItem}>
                <span className={st.status === 'DONE' ? 'line-through opacity-50' : ''}>{st.title}</span>
                <span className="text-[10px] font-bold opacity-30 uppercase">{st.status}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </motion.div>
  );
};
