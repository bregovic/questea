"use client";

import React, { useState } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { Check, Trash2, Clock, AlertCircle, ChevronRight, MoreVertical } from "lucide-react";
import styles from "./TaskCard.module.css";

interface TaskCardProps {
  task: any;
  onUpdate: (data: any) => void;
  onDelete: (id: string) => void;
  onOpen?: () => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onUpdate, onDelete, onOpen }) => {
  const x = useMotionValue(0);
  
  // Swipe right (complete) - Green background
  const backgroundRight = useTransform(x, [0, 100], ["rgba(255,255,255,0)", "#ecfdf5"]);
  const opacityCheck = useTransform(x, [20, 80], [0, 1]);
  
  // Swipe left (delete) - Red background
  const backgroundLeft = useTransform(x, [-100, 0], ["#fef2f2", "rgba(255,255,255,0)"]);
  const opacityTrash = useTransform(x, [-80, -20], [1, 0]);

  const handleDragEnd = (event: any, info: any) => {
    if (info.offset.x > 100) {
      onUpdate({ status: task.status === "DONE" ? "TODO" : "DONE" });
    } else if (info.offset.x < -100) {
      onDelete(task.id);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "URGENT": return "#dc2626";
      case "HIGH": return "#ea580c";
      case "MEDIUM": return "#f59e0b";
      default: return "#78716c";
    }
  };

  return (
    <div className={styles.wrapper}>
      {/* Background Actions */}
      <motion.div style={{ background: backgroundRight }} className={`${styles.actionBackground} ${styles.right}`}>
        <motion.div style={{ opacity: opacityCheck }}>
          <Check size={24} color="#059669" />
        </motion.div>
      </motion.div>
      
      <motion.div style={{ background: backgroundLeft }} className={`${styles.actionBackground} ${styles.left}`}>
        <motion.div style={{ opacity: opacityTrash }}>
          <Trash2 size={24} color="#dc2626" />
        </motion.div>
      </motion.div>

      {/* Main Card Content */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        style={{ x }}
        onDragEnd={handleDragEnd}
        onClick={onOpen}
        className={`${styles.card} ${task.status === "DONE" ? styles.completed : ""}`}
      >
        <div className={styles.statusIndicator} style={{ backgroundColor: getPriorityColor(task.priority) }} />
        
        <div className={styles.content}>
          <div className={styles.header}>
            <span className={styles.typeBadge}>{task.taskType}</span>
            {task.dueDate && (
              <span className={styles.dueBadge}>
                <Clock size={12} />
                {new Date(task.dueDate).toLocaleDateString("cs-CZ")}
              </span>
            )}
          </div>
          
          <h3 className={styles.title}>{task.title}</h3>
          
          <div className={styles.footer}>
            <div className={styles.progressContainer}>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${task.progress}%` }} />
              </div>
              <span className={styles.progressText}>{task.progress}%</span>
            </div>
            
            <button className={styles.moreBtn}>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
