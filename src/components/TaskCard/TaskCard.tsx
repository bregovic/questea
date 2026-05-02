"use client";

import React from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { Check, Clock, ChevronRight, Eye, FolderOpen, AlertCircle, MapPin, Plus, Wallet } from "lucide-react";
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
  
  // Swipe colors
  const backgroundRight = useTransform(x, [0, 100], ["rgba(255,255,255,0)", "#ecfdf5"]);
  const backgroundLeft = useTransform(x, [-100, 0], ["#fff7ed", "rgba(255,255,255,0)"]);
  
  const handleDragEnd = (event: any, info: any) => {
    if (info.offset.x > 80) {
      onUpdate({ status: task.status === "DONE" ? "TODO" : "DONE" });
    } else if (info.offset.x < -80) {
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

  // Circular progress calculation
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (task.progress / 100) * circumference;

  return (
    <div className={styles.wrapper}>
      {task.taskType === "TASK" && (
        <>
          <motion.div style={{ background: backgroundRight }} className={`${styles.actionBackground} ${styles.right}`}>
            <Check size={20} color="#059669" />
          </motion.div>
          <motion.div style={{ background: backgroundLeft }} className={`${styles.actionBackground} ${styles.left}`}>
            <Clock size={20} color="#f59e0b" />
          </motion.div>
        </>
      )}

      <motion.div
        drag={task.taskType === "TASK" ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        style={{ x }}
        onDragEnd={handleDragEnd}
        onClick={onOpen}
        className={`${styles.card} ${task.status === "DONE" && task.taskType === "TASK" ? styles.completed : ""} ${task.taskType !== "TASK" ? styles.logCard : ""}`}
      >
        <div className={styles.leftIndicator} style={{ backgroundColor: getPriorityColor(task.priority) }} />
        
        {task.taskType === "TASK" ? (
          <>
            <div className={styles.mainInfo}>
              <div className={styles.titleRow}>
                {task.subTasks?.length > 0 && <FolderOpen size={14} className="text-coral mr-1.5" />}
                <h3 className={styles.title}>{task.title}</h3>
              </div>
              <div className={styles.metaRow}>
                {task.dueDate && (
                  <span className={`${styles.dueInfo} ${new Date(task.dueDate) < new Date() ? styles.overdue : ""}`}>
                    <Clock size={12} />
                    {new Date(task.dueDate).toLocaleDateString("cs-CZ")}
                  </span>
                )}
                <span className={styles.typeBadge} data-type={task.taskType}>{task.taskType}</span>
                {task.priority === "URGENT" && (
                  <motion.span 
                    animate={{ scale: [1, 1.1, 1] }} 
                    transition={{ repeat: Infinity, duration: 2 }}
                    className={styles.urgentBadge}
                  >
                    <AlertCircle size={12} /> Naléhavé
                  </motion.span>
                )}
              </div>
            </div>

            <div className={styles.rightActions}>
              <div className={styles.gaugeWrapper}>
                <svg width="44" height="44" className={styles.gauge}>
                  <circle cx="22" cy="22" r={radius} stroke="#f5f5f4" strokeWidth="3" fill="none" />
                  <motion.circle 
                    cx="22" cy="22" r={radius} 
                    stroke={task.status === "DONE" ? "#059669" : "#ea580c"} 
                    strokeWidth="3" 
                    fill="none"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    strokeLinecap="round"
                    transform="rotate(-90 22 22)"
                  />
                </svg>
                <span className={styles.gaugeText}>{task.progress}%</span>
              </div>

              <button 
                className={styles.eyeBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDetail?.();
                }}
              >
                <Eye size={18} />
              </button>
              
              {task.subTasks?.length > 0 && <ChevronRight size={16} className="opacity-20" />}
            </div>
          </>
        ) : (
          <div className={styles.logMain}>
            <h3 className={styles.logTitle}>
              {task.taskType === "EXPENSE" && task.payee ? task.payee : task.title}
            </h3>
            {task.description && <p className={styles.logAddress}>{task.description}</p>}
            
            <div className={styles.logFooter}>
              <div className="flex gap-2">
                {task.taskType === "EXPENSE" && task.amount && (
                  <span className={styles.expenseBadge}>
                    {task.amount} {task.currency || "CZK"}
                  </span>
                )}
                <span className={styles.logTime}>
                  <Clock size={10} />
                  {new Date(task.recordedAt || task.createdAt).toLocaleDateString("cs-CZ")} {new Date(task.recordedAt || task.createdAt).toLocaleTimeString("cs-CZ", { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <div className="flex gap-2">
                <button 
                  className={styles.eyeBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDetail?.();
                  }}
                >
                  <Eye size={18} />
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
