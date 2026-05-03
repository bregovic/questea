"use client";

import React, { useState } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { Check, Clock, ChevronRight, Eye, FolderOpen, AlertCircle, MapPin, Plus, Wallet, Search, Bug, Lightbulb, Navigation, CheckSquare } from "lucide-react";
import styles from "./TaskCard.module.css";

interface TaskCardProps {
  task: any;
  onUpdate: (data: any) => void;
  onDelete: (id: string) => void;
  onOpen?: () => void;
  onOpenDetail?: () => void;
  isEvidence?: boolean;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onUpdate, onDelete, onOpen, onOpenDetail, isEvidence }) => {
  const x = useMotionValue(0);
  const [actionSuccess, setActionSuccess] = useState(false);
  
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

  let isLogRecord = isEvidence && task.taskType !== "TASK";
  if (!isEvidence) {
    if (task.taskType === "EXPENSE" && task.amount !== null && task.amount !== undefined) {
      isLogRecord = true;
    } else if (task.taskType === "LOCATION_HISTORY" && task.description) {
      isLogRecord = true;
    }
  }

  return (
    <div className={styles.wrapper}>
      {!isLogRecord && task.taskType === "TASK" && (
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
        drag={!isLogRecord && task.taskType === "TASK" ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        style={{ x }}
        onDragEnd={handleDragEnd}
        onClick={() => {
          if (task.taskType === "LOCATION_HISTORY" || task.subTasks?.length > 0) {
            onOpen?.();
          } else {
            onOpenDetail?.();
          }
        }}
        className={`${styles.card} ${task.status === "DONE" && task.taskType === "TASK" ? styles.completed : ""} ${isLogRecord ? styles.logCard : ""}`}
      >
        <div className={styles.leftIndicator} style={{ backgroundColor: getPriorityColor(task.priority) }} />
        
        {!isLogRecord ? (
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
                <span className={styles.typeBadge} data-type={task.taskType}>
                  {task.taskType === 'BUG' && <Bug size={14} />}
                  {task.taskType === 'IDEA' && <Lightbulb size={14} />}
                  {task.taskType === 'EXPENSE' && <Wallet size={14} />}
                  {task.taskType === 'LOCATION_HISTORY' && <Navigation size={14} />}
                  {task.taskType === 'LOCATION' && <MapPin size={14} />}
                  {(task.taskType === 'TASK' || !['BUG','IDEA','EXPENSE','LOCATION_HISTORY','LOCATION'].includes(task.taskType)) && <CheckSquare size={14} />}
                </span>
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
              {(task.taskType === "LOCATION_HISTORY" || task.title.toLowerCase().includes("místa")) ? (
                <div className="flex gap-2">
                  <button 
                    className={styles.cardActionBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      (window as any).dispatchEvent(new CustomEvent("quickAction", { 
                        detail: { task: { ...task, taskType: 'LOCATION_HISTORY' }, action: 'GPS' } 
                      }));
                    }}
                  >
                    <MapPin size={18} />
                  </button>
                  <button 
                    className={styles.cardActionBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      (window as any).dispatchEvent(new CustomEvent("quickAction", { 
                        detail: { task: { ...task, taskType: 'LOCATION_HISTORY' }, action: 'SEARCH' } 
                      }));
                    }}
                  >
                    <Search size={18} />
                  </button>
                </div>
              ) : task.taskType === "EXPENSE" ? (
                <button 
                  className={styles.quickActionBtn}
                  data-type={task.taskType}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActionSuccess(true);
                    setTimeout(() => setActionSuccess(false), 1500);
                    (window as any).dispatchEvent(new CustomEvent("quickAction", { 
                      detail: { task } 
                    }));
                  }}
                >
                  {actionSuccess ? (
                    <Check size={18} color="#16a34a" />
                  ) : (
                    <Plus size={18} />
                  )}
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  {task.subTasks?.length > 0 && (
                    <button 
                      className={styles.cardActionBtn}
                      style={{ background: '#f5f5f4', borderColor: '#e5e5e4', color: '#737373' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        (window as any).dispatchEvent(new CustomEvent("addTask", { detail: { parentId: task.id } }));
                      }}
                    >
                      <Plus size={16} />
                    </button>
                  )}
                  {task.subTasks?.length > 0 && (
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
                  )}
                </div>
              )}

              <button 
                className={styles.detailArrowBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDetail?.();
                }}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </>
        ) : (
          <div className={styles.logMain}>
            <h3 className={styles.logTitle}>
              {task.taskType === "EXPENSE" && task.payee ? task.payee : task.title}
            </h3>
            
            {task.taskType === "LOCATION_HISTORY" && task.locations?.[0] && (
              <p className={styles.logAddress}>{task.locations[0].address}</p>
            )}

            {task.description && task.taskType !== "LOCATION_HISTORY" && (!task.subTasks || task.subTasks.length === 0) && (
              <p className={styles.logAddress}>{task.description}</p>
            )}
            
            <div className={styles.logFooter}>
              <div className="flex gap-2 items-center">
                {(task.recordedAt || task.createdAt) && (
                  <span className="text-[10px] opacity-40 font-bold flex items-center gap-1">
                    <Clock size={10} />
                    {new Date(task.recordedAt || task.createdAt).toLocaleTimeString("cs-CZ", { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                {task.taskType === "EXPENSE" && task.amount && (
                  <span className={styles.expenseBadge}>
                    {task.amount} {task.currency || "CZK"}
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                {/* Removed eye button from log items as well */}
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
