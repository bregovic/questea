"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { 
  X, User, FileText, Link as LinkIcon, Calendar, 
  Plus, Trash2, Mail, Layers, Lock, Unlock, RotateCcw, 
  Wallet, DollarSign, Building 
} from "lucide-react";
import styles from "./TaskDetail.module.css";

interface TaskDetailProps {
  task: any;
  allTasks: any[];
  onClose: () => void;
  onUpdate: (id: string, data: any) => void;
  onDelete: (id: string) => void;
  onRestore?: (id: string) => void;
}

export const TaskDetail: React.FC<TaskDetailProps> = ({ 
  task, allTasks, onClose, onUpdate, onDelete, onRestore 
}) => {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [priority, setPriority] = useState(task.priority);
  const [ownerEmail, setOwnerEmail] = useState(task.user?.email || "");
  const [parentId, setParentId] = useState(task.parentId || "");
  const [lockStatus, setLockStatus] = useState(task.lockStatus || false);
  const [taskType, setTaskType] = useState(task.taskType);
  const [amount, setAmount] = useState(task.amount || "");
  const [currency, setCurrency] = useState(task.currency || "CZK");
  const [payee, setPayee] = useState(task.payee || "");
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [payees, setPayees] = useState<any[]>([]);
  const [showPayeeSuggestions, setShowPayeeSuggestions] = useState(false);

  // Fetch payees for codelist
  React.useEffect(() => {
    fetch("/api/payees")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setPayees(data);
      });
  }, []);

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

  const handleLockStatusChange = (newLock: boolean) => {
    setLockStatus(newLock);
    onUpdate(task.id, { lockStatus: newLock });
  };

  const handleOwnerChange = () => {
    if (ownerEmail !== task.user?.email) {
      onUpdate(task.id, { ownerEmail });
    }
  };

  const handleTaskTypeChange = (newType: string) => {
    setTaskType(newType);
    onUpdate(task.id, { taskType: newType });
  };

  const handleExpenseUpdate = () => {
    onUpdate(task.id, { 
      amount: amount === "" ? null : parseFloat(amount.toString()), 
      currency, 
      payee 
    });
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
            <select 
              value={taskType}
              onChange={(e) => handleTaskTypeChange(e.target.value)}
              className={styles.typeSelect}
            >
              <option value="TASK">Úkol</option>
              <option value="BUG">Bug</option>
              <option value="IDEA">Nápad</option>
              <option value="EXPENSE">Náklady</option>
            </select>
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
          
          {task.isDeleted ? (
            <button 
              onClick={() => { onRestore?.(task.id); onClose(); }} 
              className={`${styles.actionBtn} ${styles.restoreBtn}`}
            >
              <RotateCcw size={14} /> Obnovit
            </button>
          ) : (
            <button onClick={handleDelete} className={`${styles.actionBtn} ${styles.deleteBtn}`}>
              <Trash2 size={14} /> Smazat úkol
            </button>
          )}
        </div>

        {/* Parent Selection & Lock */}
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>
             <Layers className={styles.sectionIcon} size={14} /> Hierarchie & Ochrana
          </h4>
          <div className="flex flex-col gap-3">
            <select 
              className={styles.select}
              value={parentId} 
              onChange={(e) => handleParentChange(e.target.value)}
            >
              <option value="">(Bez nadřazeného úkolu / ROOT)</option>
              {allTasks.filter(t => t.id !== task.id).map(t => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
            
            <button 
              className={`${styles.lockToggle} ${lockStatus ? styles.locked : ""}`}
              onClick={() => handleLockStatusChange(!lockStatus)}
            >
              {lockStatus ? <Lock size={14} /> : <Unlock size={14} />}
              <span>{lockStatus ? "Status uzamčen (nelze uzavřít)" : "Status volný"}</span>
            </button>
          </div>
        </section>

        {/* Expense Details (Conditional) */}
        {taskType === "EXPENSE" && (
          <section className={styles.section}>
            <h4 className={styles.sectionTitle}>
              <Wallet className={styles.sectionIcon} size={14} /> Detaily nákladů
            </h4>
            <div className={styles.expenseGrid}>
              <div className={styles.labelItem}>
                <div className={styles.labelHeader}><DollarSign size={14} /> Částka & Měna</div>
                <div className="flex gap-2 mt-1">
                  <input 
                    type="number" 
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    onBlur={handleExpenseUpdate}
                    className={styles.amountInput}
                  />
                  <input 
                    type="text" 
                    placeholder="CZK"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    onBlur={handleExpenseUpdate}
                    className={styles.currencyInput}
                  />
                </div>
              </div>
              
              <div className={styles.labelItem}>
                <div className={styles.labelHeader}><Building size={14} /> Komu se platilo (Příjemce)</div>
                <div className="relative mt-1">
                  <input 
                    type="text" 
                    placeholder="Název firmy / jméno..."
                    value={payee}
                    onChange={(e) => {
                      setPayee(e.target.value);
                      setShowPayeeSuggestions(true);
                    }}
                    onBlur={() => {
                      handleExpenseUpdate();
                      // Timeout to allow clicking a suggestion
                      setTimeout(() => setShowPayeeSuggestions(false), 200);
                    }}
                    onFocus={() => setShowPayeeSuggestions(true)}
                    className={styles.payeeInput}
                  />
                  {showPayeeSuggestions && payees.length > 0 && (
                    <div className={styles.suggestions}>
                      {payees
                        .filter(p => p.name.toLowerCase().includes(payee.toLowerCase()))
                        .slice(0, 5)
                        .map(p => (
                          <div 
                            key={p.id} 
                            className={styles.suggestionItem}
                            onMouseDown={() => {
                              setPayee(p.name);
                              setShowPayeeSuggestions(false);
                              onUpdate(task.id, { payee: p.name });
                            }}
                          >
                            {p.name}
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

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
          
          {!task.isDeleted && (
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
          )}

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
