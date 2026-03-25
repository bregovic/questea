"use client";

import React, { useState } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { Check, Clock, ChevronRight, Eye, Home } from "lucide-react";
import styles from "./TaskCard.module.css";

interface TaskCardProps {
  task: any;
  onUpdate: (data: any) => void;
  onDelete: (id: string) => void;
  onOpen?: () => void;
  onOpenDetail?: () => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onUpdate, onDelete, onOpen, onOpenDetail }) => {
  const x = useMotionValue(0);
  
  // Swipe right (complete) - Green background
  const backgroundRight = useTransform(x, [0, 100], ["rgba(255,255,255,0)", "#ecfdf5"]);
  const opacityCheck = useTransform(x, [20, 80], [0, 1]);
  
  // Swipe left (postpone) - Sand background
  const backgroundLeft = useTransform(x, [-100, 0], ["#fff7ed", "rgba(255,255,255,0)"]);
  const opacityClock = useTransform(x, [-80, -20], [1, 0]);

  const handleDragEnd = (event: any, info: any) => {
    if (info.offset.x > 100) {
      onUpdate({ status: task.status === "DONE" ? "TODO" : "DONE" });
    } else if (info.offset.x < -100) {
      // Postpone: set priority to LOW or update dueDate
      onUpdate({ priority: "LOW" });
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
        <motion.div style={{ opacity: opacityClock }}>
          <Clock size={24} color="#f59e0b" />
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
              {task.subTasks?.length > 0 && (
                <span className="text-[10px] bg-sand/20 px-2 py-0.5 rounded-full font-bold text-sand-dark mr-2">FOLDER</span>
              )}
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${task.progress}%` }} />
              </div>
              <span className={styles.progressText}>{task.progress}%</span>
            </div>
            
            <div className="flex items-center gap-1">
              <button 
                className={styles.moreBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDetail?.();
                }}
                title="Zobrazit detail"
              >
                <Eye size={18} />
              </button>
              {task.subTasks?.length > 0 && <ChevronRight size={14} className="opacity-30" />}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
