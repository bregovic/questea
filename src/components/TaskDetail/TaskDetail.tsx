"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, User, FileText, Link as LinkIcon, Image as ImageIcon, Calendar, Shield, CheckCircle } from "lucide-react";
import styles from "./TaskDetail.module.css";

interface TaskDetailProps {
  task: any;
  onClose: () => void;
  onUpdate: (id: string, data: any) => void;
}

export const TaskDetail: React.FC<TaskDetailProps> = ({ task, onClose, onUpdate }) => {
  const [description, setDescription] = useState(task.description || "");

  const handleSave = () => {
    onUpdate(task.id, { description });
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
          <span className={styles.typeBadge}>{task.taskType}</span>
          <h2 className={styles.title}>{task.title}</h2>
        </div>
        <button onClick={onClose} className={styles.closeBtn}>
          <X size={24} />
        </button>
      </header>

      <div className={styles.content}>
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
            onBlur={handleSave}
            placeholder="Zadejte detailní popis..."
          />
        </section>

        {/* Roles Section */}
        <section className={styles.labelsGrid}>
          <div className={styles.labelItem}>
            <div className={styles.labelHeader}><User size={14} /> Vlastník</div>
            <div className={styles.labelValue}>{task.user?.name || task.user?.email || "Nepřiřazeno"}</div>
          </div>
          <div className={styles.labelItem}>
            <div className={styles.labelHeader}><Shield size={14} /> Garant</div>
            <div className={styles.labelValue}>{task.guarantor?.name || "Není určen"}</div>
          </div>
          <div className={styles.labelItem}>
            <div className={styles.labelHeader}><CheckCircle size={14} /> Schvalovatel</div>
            <div className={styles.labelValue}>{task.approver?.name || "Není určen"}</div>
          </div>
          <div className={styles.labelItem}>
            <div className={styles.labelHeader}><Calendar size={14} /> Termín</div>
            <div className={styles.labelValue}>{task.dueDate ? new Date(task.dueDate).toLocaleDateString("cs-CZ") : "Bez termínu"}</div>
          </div>
        </section>

        {/* Subtasks Section */}
        {task.subTasks && task.subTasks.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <LinkIcon size={18} />
              <span>Podřízené úkoly (Subtasky)</span>
            </div>
            <div className={styles.subtaskList}>
              {task.subTasks.map((st: any) => (
                <div key={st.id} className={styles.subtaskItem}>
                  <div className={styles.subtaskStatus} style={{ background: st.status === "DONE" ? "#059669" : "#e7e5e4" }} />
                  <span>{st.title}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Attachments Section */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <ImageIcon size={18} />
            <span>Přílohy a soubory</span>
          </div>
          <div className={styles.attachmentDropzone}>
            <p>Klikněte nebo přetáhněte soubor pro nahrání</p>
          </div>
          <div className={styles.attachmentList}>
            {task.attachments?.map((att: any) => (
              <div key={att.id} className={styles.attachmentItem}>
                {att.type === 'image' ? <ImageIcon size={16} /> : <FileText size={16} />}
                <span>{att.name}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </motion.div>
  );
};
