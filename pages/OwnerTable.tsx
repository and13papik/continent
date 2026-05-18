
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppState, OwnerTask, TaskPriority, TaskStatus, TaskAssignee, TaskType, RecurrenceCycle, TaskAuditEntry } from '../types';
import { ICONS } from '../constants';
import PeriodBadge from '../components/PeriodBadge';

const TG_TOKEN = '8497961851:AAEmwmEgJNV6KwyQjdcG62GY3IdX8zz6YV4';
const DEFAULT_CHAT_ID = '-1003748692600';

// --- HELPER COMPONENTS ---

function StrategyInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void, placeholder?: string }) {
  return (
    <div className="space-y-1">
      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">{label}</label>
      <input 
        type="text" 
        className="modern-input" 
        placeholder={placeholder}
        value={value} 
        onChange={e => onChange(e.target.value)} 
      />
    </div>
  );
}

interface OwnerTableProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const OwnerTable: React.FC<OwnerTableProps> = ({ state, updateState }) => {
  const [activeTab, setActiveTab] = useState<'manager' | 'notebook'>('notebook');
  const [currentOwner, setCurrentOwner] = useState<'Andrey' | 'Anton' | 'Owners'>('Andrey');
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isSendingToTg, setIsSendingToTg] = useState<string | null>(null);

  const [activeMode, setActiveMode] = useState<TaskType>('directive');
  const [secondaryFilter, setSecondaryFilter] = useState<'all' | 'critical' | 'process' | 'review'>('all');

  const editorRef = React.useRef<HTMLDivElement>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    if (editorRef.current) {
        const html = editorRef.current.innerHTML;
        updateState(prev => ({ ...prev, ownerDocument: html }));
    }
  };

  const handleEditorInput = () => {
    if (editorRef.current) {
        const html = editorRef.current.innerHTML;
        updateState(prev => ({ ...prev, ownerDocument: html }));
    }
  };

  const insertNextTask = () => {
    const separator = `<div class="task-separator" contenteditable="false"></div><div><br></div>`;
    exec('insertHTML', separator);
  };

  const completeCurrentTask = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    const parts = html.split('<div class="task-separator" contenteditable="false"></div>');
    
    if (parts.length > 0) {
      const completedPart = parts[0].trim();
      if (!completedPart || completedPart === '<div><br></div>' || completedPart === '<br>') {
          alert('Нечего завершать!');
          return;
      }

      const timestamp = `<div style="font-size: 10px; color: #475569; margin-bottom: 10px; font-weight: bold;">ЗАВЕРШЕНО: ${new Date().toLocaleString()}</div>`;
      const archivedContent = `<div class="archived-task" style="border-left: 2px solid #10b981; padding-left: 15px; margin-bottom: 30px; opacity: 0.8;">${timestamp}${completedPart}</div>`;
      
      const newRemaining = parts.slice(1).join('<div class="task-separator" contenteditable="false"></div>');
      
      updateState(prev => ({
        ...prev,
        ownerDocument: newRemaining || '<div><br></div>',
        completedDocument: archivedContent + (prev.completedDocument || '')
      }));
      
      editorRef.current.innerHTML = newRemaining || '<div><br></div>';
      alert('Задача перенесена в архив!');
    }
  };

  React.useEffect(() => {
    if (editorRef.current && state.ownerDocument !== undefined) {
        if (editorRef.current.innerHTML !== state.ownerDocument) {
            if (document.activeElement !== editorRef.current) {
                editorRef.current.innerHTML = state.ownerDocument || '';
            }
        }
    }
  }, [state.ownerDocument]);

  const PRIORITY_META: Record<TaskPriority, { label: string; color: string; bg: string; emoji: string }> = {
    urgent: { label: 'КРИТИЧЕСКИЙ', color: 'text-rose-500', bg: 'bg-rose-500/10', emoji: '☢️' },
    high: { label: 'ВЫСОКИЙ', color: 'text-amber-500', bg: 'bg-amber-500/10', emoji: '🔥' },
    medium: { label: 'СРЕДНИЙ', color: 'text-sky-500', bg: 'bg-sky-500/10', emoji: '⚡️' },
    low: { label: 'НИЗКИЙ', color: 'text-slate-400', bg: 'bg-slate-500/10', emoji: '☕️' }
  };

  const STATUS_META: Record<TaskStatus, { label: string; color: string; step: number }> = {
    idea: { label: 'Идея', color: 'text-indigo-400', step: 1 },
    in_progress: { label: 'В процессе', color: 'text-sky-400', step: 2 },
    review: { label: 'НУЖНО ПРОВЕРИТЬ', color: 'text-amber-500', step: 4 },
    completed: { label: 'Выполнено', color: 'text-emerald-500', step: 5 },
    blocked: { label: 'Заблокировано', color: 'text-rose-500', step: 3 },
    waiting_external: { label: 'Ожидание', color: 'text-slate-400', step: 3 }
  };

  const TYPE_META: Record<TaskType, { label: string, color: string, bg: string, icon: any, desc: string }> = {
    directive: { label: 'Директива', color: 'text-amber-500', bg: 'bg-amber-500/10', icon: ICONS.Crown, desc: 'Прямые указания от штаба' },
    regular: { label: 'Задача', color: 'text-sky-400', bg: 'bg-sky-400/10', icon: ICONS.Reports, desc: 'Операционные задачи админам' },
    recurring: { label: 'Регламент', color: 'text-indigo-400', bg: 'bg-indigo-400/10', icon: ICONS.RotateCcw, desc: 'Повторяющиеся процессы' }
  };

  const ASSIGNEE_LABELS: Record<TaskAssignee, string> = {
    Andrey: 'Андрей', Anton: 'Антон', Owners: 'Общее (Владельцы)', 
    Rector: 'Admin Rector', Mentor: 'Admin Mentor', Admins: 'Админы (Общие)', All: 'Весь состав'
  };

  const [editingTask, setEditingTask] = useState<OwnerTask | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('medium');
  const [newTaskAssigned, setNewTaskAssigned] = useState<TaskAssignee>('Admins');
  const [newTaskType, setNewTaskType] = useState<TaskType>('directive');
  const [newTaskCycle, setNewTaskCycle] = useState<RecurrenceCycle>('daily');
  const [newTaskGoal, setNewTaskGoal] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskTarget, setNewTaskTarget] = useState<'owner' | 'admin'>('admin');

  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const logAudit = (action: string, actor: string): TaskAuditEntry => ({
    id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    action, actor, timestamp: new Date().toISOString()
  });

  const deleteTask = (id: string) => {
    if (!confirm('Вы уверены, что хотите безвозвратно удалить эту задачу?')) return;
    updateState(prev => ({
      ...prev,
      deletedIds: [...(prev.deletedIds || []), id],
      ownerTasks: (prev.ownerTasks || []).filter(t => t.id !== id)
    }));
  };

  const sendTaskToTelegram = async (task: OwnerTask) => {
    setIsSendingToTg(task.id);
    let mentionTags = '';
    let headerAddon = '';
    if (task.assignedTo === 'Mentor') { mentionTags = '<a href="tg://user?id=7475447497">@adm_mentr</a>'; headerAddon = ' (@adm_mentr)'; }
    else if (task.assignedTo === 'Rector') { mentionTags = '<a href="tg://user?id=6537516111">@adm_rctr</a>'; headerAddon = ' (@adm_rctr)'; }
    else if (task.assignedTo === 'Admins' || task.assignedTo === 'All') { mentionTags = '<a href="tg://user?id=7475447497">@adm_mentr</a> и <a href="tg://user?id=6537516111">@adm_rctr</a>'; headerAddon = ' (@adm_mentr, @adm_rctr)'; }
    else mentionTags = '@continental_agency';

    const typeLabel = TYPE_META[task.taskType]?.label || 'Задача';
    const prioLabel = PRIORITY_META[task.priority]?.label || 'Средний';
    const prioEmoji = PRIORITY_META[task.priority]?.emoji || '⚡️';

    let message = `🚨 <b>CORE${headerAddon}: Новая задача</b>\n\n`;
    message += `<b>Тип:</b> ${typeLabel}\n`;
    message += `<b>Приоритет:</b> ${prioEmoji} ${prioLabel}\n`;
    if (task.dueDate) message += `<b>Дедлайн:</b> ${new Date(task.dueDate).toLocaleDateString()}\n`;
    message += `\n<b>Задача:</b> ${task.title}\n\n`;
    message += `<b>Исполнитель:</b> ${mentionTags}`;

    try {
      const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: DEFAULT_CHAT_ID, text: message, parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [[{ text: "➡️ Перейти к задаче", url: "https://continental.monster/#/admin-table" }]] }
        })
      });
      if (res.ok) alert('Уведомление отправлено');
      else { const err = await res.json(); alert(`Ошибка: ${err.description}`); }
    } catch (e) { alert('Сбой сети при отправке в TG'); }
    finally { setIsSendingToTg(null); }
  };

  const saveTask = () => {
    if (!newTaskTitle.trim()) return;
    const finalAssigned = newTaskTarget === 'owner' ? currentOwner : newTaskAssigned;
    if (editingTask) {
        updateState(prev => ({ ...prev,
            ownerTasks: (prev.ownerTasks || []).map(t => t.id === editingTask.id ? { ...t,
                title: newTaskTitle, description: newTaskDesc, priority: newTaskPriority,
                assignedTo: finalAssigned as TaskAssignee, taskType: newTaskType,
                dueDate: newTaskDueDate || undefined,
                recurrenceCycle: newTaskType === 'recurring' ? newTaskCycle : undefined,
                strategyData: { goal: newTaskGoal, reason: '', effect: '' },
                auditLog: [...(t.auditLog || []), logAudit('Изменено владельцем', currentOwner)],
                updatedAt: new Date().toISOString()
            } : t)
        }));
        setEditingTask(null);
    } else {
        const task: OwnerTask = { id: `task-${Date.now()}`, title: newTaskTitle, description: newTaskDesc, status: 'idea',
            priority: newTaskPriority, taskType: newTaskType, assignedTo: finalAssigned as TaskAssignee,
            dueDate: newTaskDueDate || undefined, recurrenceCycle: newTaskType === 'recurring' ? newTaskCycle : undefined,
            tags: [], strategyData: { goal: newTaskGoal, reason: '', effect: '' },
            notes: [], auditLog: [logAudit('Создано владельцем', currentOwner)],
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            periodId: state.selectedPeriodId
        };
        updateState(prev => ({ ...prev, ownerTasks: [task, ...(prev.ownerTasks || [])] }));
    }
    setNewTaskTitle(''); setNewTaskDesc(''); setNewTaskGoal(''); setNewTaskDueDate('');
  };

  const startEditing = (task: OwnerTask) => {
    setEditingTask(task);
    setNewTaskTitle(task.title); setNewTaskDesc(task.description);
    setNewTaskPriority(task.priority); setNewTaskAssigned(task.assignedTo);
    setNewTaskType(task.taskType || 'regular'); setNewTaskCycle(task.recurrenceCycle || 'daily');
    setNewTaskGoal(task.strategyData?.goal || '');
    setNewTaskDueDate(task.dueDate || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filteredTasks = useMemo(() => {
    let list = (state.ownerTasks || []).map(t => {
      if (!t.taskType) { if (t.isRoutine) t.taskType = 'recurring'; else if (t.id.startsWith('admin-task')) t.taskType = 'regular'; else t.taskType = 'directive'; }
      return t;
    });
    list = list.filter(t => t.taskType === activeMode);
    list = list.filter(t => {
      const isForMe = t.assignedTo === currentOwner || t.assignedTo === 'Owners' || t.assignedTo === 'All';
      const isDelegatedToAdmin = t.assignedTo === 'Rector' || t.assignedTo === 'Mentor' || t.assignedTo === 'Admins';
      const isVisibleDelegation = isDelegatedToAdmin && (!t.id.startsWith('admin-task') || t.status === 'review');
      const matchesPeriod = t.periodId === state.selectedPeriodId;
      return (isForMe || isVisibleDelegation) && matchesPeriod;
    });
    if (secondaryFilter === 'critical') list = list.filter(t => t.priority === 'urgent' || t.priority === 'high');
    if (secondaryFilter === 'process') list = list.filter(t => t.status === 'in_progress');
    if (secondaryFilter === 'review') list = list.filter(t => t.status === 'review');

    return list.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const prioOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      return (prioOrder[a.priority] ?? 2) - (prioOrder[b.priority] ?? 2);
    });
  }, [state.ownerTasks, activeMode, secondaryFilter, currentOwner]);

  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } } as const;
  const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } } as const;

  return (
    <motion.div initial="hidden" animate="visible" variants={containerVariants} className="space-y-12 pb-24 max-w-7xl mx-auto">
      {/* HEADER SECTION */}
      <motion.header variants={itemVariants} className="flex flex-col md:flex-row md:items-end justify-between gap-10 pt-4">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 shadow-inner">
               <ICONS.Crown size={20} />
            </div>
            <div className="flex flex-col">
               <span className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-500/60 leading-none">Центр управления</span>
               <div className="h-px w-8 bg-indigo-500/30 mt-1.5"></div>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <h1 className="text-5xl font-black font-outfit text-white tracking-tight">Ядро Управления</h1>
            <PeriodBadge state={state} />
          </div>
        </div>
        
        <div className="flex flex-col gap-6 items-end">
           <div className="flex bg-slate-900/50 p-1.5 rounded-2xl border border-white/5 shadow-2xl">
            <button onClick={() => setActiveTab('notebook')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'notebook' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-300'}`}>Блокнот</button>
            <button onClick={() => setActiveTab('manager')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'manager' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-300'}`}>Задачи</button>
          </div>
          <div className="flex gap-2 p-1 bg-slate-950/60 rounded-xl border border-white/5 shadow-inner">
            {['Andrey', 'Anton', 'Owners'].map(id => (
              <button key={id} onClick={() => setCurrentOwner(id as any)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all ${currentOwner === id ? 'bg-white/10 text-white shadow-lg' : 'text-slate-600 hover:text-slate-400'}`}>
                {ASSIGNEE_LABELS[id as TaskAssignee]}
              </button>
            ))}
          </div>
        </div>
      </motion.header>

      {activeTab === 'manager' ? (
        <motion.div variants={containerVariants} className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
           {/* MODE TABS */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {['directive', 'regular', 'recurring'].map((mode) => (
                <button 
                  key={mode} 
                  onClick={() => { setActiveMode(mode as any); setSecondaryFilter('all'); }} 
                  className={`glass-card p-6 rounded-[2rem] border transition-all text-left relative overflow-hidden group ${activeMode === mode ? `border-${TYPE_META[mode as TaskType].color.split('-')[1]}-500/50 bg-${TYPE_META[mode as TaskType].color.split('-')[1]}-500/[0.05]` : 'border-slate-800 hover:border-slate-700'}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${TYPE_META[mode as TaskType].bg} ${TYPE_META[mode as TaskType].color} border border-white/5`}>
                     {React.createElement(TYPE_META[mode as TaskType].icon, { size: 20 })}
                  </div>
                  <h4 className="text-lg font-black font-outfit text-white leading-none">{TYPE_META[mode as TaskType].label}</h4>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2">{TYPE_META[mode as TaskType].desc}</p>
                  {activeMode === mode && <div className={`absolute top-0 right-0 w-2 h-full ${TYPE_META[mode as TaskType].color.replace('text-', 'bg-')}`}></div>}
                </button>
              ))}
           </div>

           {/* FILTER BAR */}
           <div className="flex gap-4 p-2 bg-slate-950/40 rounded-full border border-white/5 overflow-x-auto no-scrollbar">
              {['all', 'critical', 'process', 'review'].map(f => (
                <button key={f} onClick={() => setSecondaryFilter(f as any)} className={`flex-1 min-w-[120px] py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${secondaryFilter === f ? 'bg-white text-black shadow-xl' : 'text-slate-600 hover:text-slate-300'}`}>
                  {f === 'review' ? 'НУЖНО ПРОВЕРИТЬ' : (f === 'all' ? 'ВСЕ ОБЪЕКТЫ' : f === 'critical' ? 'КРИТИЧЕСКИЕ' : 'В ПРОЦЕССЕ')}
                </button>
              ))}
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
             {/* LEFT SIDE: CREATION FORM */}
             <motion.div variants={itemVariants} className="lg:col-span-4 glass-card p-10 rounded-[3rem] border-slate-800 bg-slate-950/20 shadow-2xl space-y-8 sticky top-24">
                <div className="flex justify-between items-center">
                   <h2 className="text-2xl font-black font-outfit text-white tracking-tight">{editingTask ? 'Изменить намерение' : 'Новое указание'}</h2>
                   <div className="p-1 bg-slate-900 rounded-xl border border-white/5 flex gap-1">
                      <button onClick={() => setNewTaskTarget('admin')} className={`p-2 rounded-lg transition-all ${newTaskTarget === 'admin' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-white'}`} title="Для Админов"><ICONS.User size={14} /></button>
                      <button onClick={() => setNewTaskTarget('owner')} className={`p-2 rounded-lg transition-all ${newTaskTarget === 'owner' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:text-white'}`} title="Личное"><ICONS.Owner size={14} /></button>
                   </div>
                </div>

                <div className="space-y-6">
                   <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Заголовок Инициативы</label>
                      <input type="text" className="modern-input font-bold" placeholder="Краткая суть..." value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} />
                   </div>
                   
                   <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Детализированный Контекст</label>
                      <textarea className="modern-input min-h-[100px] text-xs leading-relaxed" placeholder="Почему это важно?.." value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)} />
                   </div>
                   
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Приоритетность</label>
                         <select className="modern-input font-black uppercase text-[10px]" value={newTaskPriority} onChange={e => setNewTaskPriority(e.target.value as any)}>
                            {Object.entries(PRIORITY_META).map(([val, m]) => <option key={val} value={val}>{m.emoji} {m.label}</option>)}
                         </select>
                      </div>
                      <div className="space-y-2">
                         <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Исполнитель</label>
                         <select 
                          disabled={newTaskTarget === 'owner'}
                          className={`modern-input font-black uppercase text-[10px] ${newTaskTarget === 'owner' ? 'opacity-50 grayscale' : ''}`} 
                          value={newTaskTarget === 'owner' ? currentOwner : newTaskAssigned} 
                          onChange={e => setNewTaskAssigned(e.target.value as any)}
                         >
                            {Object.entries(ASSIGNEE_LABELS)
                              .filter(([val]) => newTaskTarget === 'owner' ? (val === 'Andrey' || val === 'Anton' || val === 'Owners') : (val === 'Rector' || val === 'Mentor' || val === 'Admins' || val === 'All'))
                              .map(([val, lab]) => <option key={val} value={val}>{lab}</option>)}
                         </select>
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Связанный тип</label>
                         <select className="modern-input font-black uppercase text-[10px]" value={newTaskType} onChange={e => setNewTaskType(e.target.value as any)}>
                            <option value="directive">Директива</option>
                            <option value="regular">Задача</option>
                            <option value="recurring">Регламент</option>
                         </select>
                      </div>
                      <div className="space-y-2">
                         <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Крайний Срок</label>
                         <input type="date" className="modern-input font-mono text-[10px]" value={newTaskDueDate} onChange={e => setNewTaskDueDate(e.target.value)} />
                      </div>
                   </div>

                   <StrategyInput label="Критерий успеха" value={newTaskGoal} onChange={setNewTaskGoal} placeholder="Как поймем что готово?.." />
                   
                   <button onClick={saveTask} className="btn-primary bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20 mt-4">
                      {editingTask ? 'Обновить Директиву' : 'Развернуть Директиву'}
                   </button>
                </div>
             </motion.div>

             {/* RIGHT SIDE: TASK LIST */}
             <motion.div variants={itemVariants} className="lg:col-span-8 space-y-6">
                <AnimatePresence mode="popLayout">
                   {filteredTasks.length === 0 ? (
                     <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-32 text-center border-2 border-dashed border-slate-900 rounded-[4rem] flex flex-col items-center justify-center space-y-4">
                        <div className="w-16 h-16 rounded-3xl bg-slate-900 flex items-center justify-center text-slate-700"><ICONS.Search size={32} /></div>
                        <p className="text-slate-600 font-black uppercase tracking-[0.4em] text-[10px]">Операционная тишина в этом секторе</p>
                     </motion.div>
                   ) : filteredTasks.map(task => {
                      const prio = PRIORITY_META[task.priority] || PRIORITY_META.medium;
                      const stat = STATUS_META[task.status] || STATUS_META.idea;
                      const isEx = expandedTasks.has(task.id);
                      const isOverdue = task.dueDate && new Date() > new Date(task.dueDate) && task.status !== 'completed';

                      return (
                        <motion.div 
                          key={task.id} 
                          layout
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.98 }}
                          className={`glass-card rounded-[3rem] border transition-all duration-300 relative overflow-hidden group ${isOverdue ? 'border-rose-600/50 bg-rose-600/[0.03]' : task.status === 'review' ? 'border-amber-500 ring-4 ring-amber-500/10' : 'border-slate-800'}`}
                        >
                           <div className="p-10">
                              <div className="flex flex-col md:flex-row justify-between gap-8">
                                 <div className="flex-1 space-y-6">
                                    <div className="flex items-center gap-2 flex-wrap">
                                       <span className={`px-2.5 py-1 rounded-full text-[8px] font-black tracking-widest ${prio.bg} ${prio.color} border border-current/10`}>{prio.label}</span>
                                       <span className="text-[8px] bg-slate-950 text-indigo-400 px-2.5 py-1 rounded-full border border-slate-800 font-black uppercase tracking-widest">👤 {ASSIGNEE_LABELS[task.assignedTo]}</span>
                                       {task.dueDate && (
                                          <span className={`text-[8px] px-2.5 py-1 rounded-full font-black border tracking-widest ${isOverdue ? 'bg-rose-600 text-white border-rose-500 animate-pulse' : 'bg-slate-950 text-slate-500 border-slate-800'}`}>
                                             📅 ДО ДЕДЛАЙНА: {new Date(task.dueDate).toLocaleDateString()}
                                          </span>
                                       )}
                                    </div>
                                    
                                    <div className="space-y-2">
                                       <h3 className="text-2xl font-black font-outfit text-white tracking-tight leading-tight group-hover:text-indigo-400 transition-colors">{task.title}</h3>
                                       <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{task.description}</p>
                                    </div>

                                    {/* PROGRESS TRACKER */}
                                    <div className="flex items-center gap-6 pt-4">
                                       <div className="flex-1 h-2 bg-slate-900/50 p-0.5 rounded-full flex gap-1 border border-white/5 relative">
                                          {[1,2,3,4,5].map(step => (
                                            <div key={step} className={`flex-1 rounded-full transition-all duration-700 ${step <= stat.step ? (isOverdue ? 'bg-rose-500' : 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]') : 'bg-transparent'}`}></div>
                                          ))}
                                       </div>
                                       <div className="flex items-center gap-2 min-w-[120px] justify-end">
                                          <div className={`w-2 h-2 rounded-full ${stat.color.replace('text-', 'bg-')} animate-pulse`}></div>
                                          <span className={`text-[10px] font-black uppercase tracking-widest ${stat.color}`}>{stat.label}</span>
                                       </div>
                                    </div>
                                 </div>

                                 <div className="flex flex-col items-end gap-4 shrink-0">
                                    <div className="flex gap-2">
                                       <button 
                                          onClick={() => sendTaskToTelegram(task)} 
                                          disabled={isSendingToTg === task.id}
                                          className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all shadow-xl ${isSendingToTg === task.id ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-sky-600/10 border-sky-600/30 text-sky-400 hover:bg-sky-600 hover:text-white'}`}
                                       >
                                          {isSendingToTg === task.id ? <ICONS.RotateCcw className="animate-spin" size={18} /> : <ICONS.Send size={18} />}
                                       </button>
                                       <button onClick={() => startEditing(task)} className="w-12 h-12 rounded-2xl flex items-center justify-center bg-slate-950 border border-slate-800 text-slate-500 hover:text-white transition-all hover:border-white/20"><ICONS.Edit size={18}/></button>
                                       <button onClick={() => deleteTask(task.id)} className="w-12 h-12 rounded-2xl flex items-center justify-center bg-slate-950 border border-slate-800 text-slate-500 hover:text-rose-500 transition-all hover:border-rose-500/50"><ICONS.Trash size={18}/></button>
                                       <button onClick={() => { const n = new Set(expandedTasks); if(n.has(task.id)) n.delete(task.id); else n.add(task.id); setExpandedTasks(n); }} className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isEx ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'bg-slate-950 text-slate-500 border border-slate-800'}`}><ICONS.Plus size={20} className={isEx ? 'rotate-45' : ''}/></button>
                                    </div>
                                    
                                    <div className="p-1 bg-slate-950/80 rounded-2xl border border-white/5 flex gap-1">
                                       {['idea', 'in_progress', 'completed'].map(s => (
                                          <button 
                                             key={s} 
                                             onClick={() => updateState(p => ({...p, ownerTasks: (p.ownerTasks || []).map(t => t.id === task.id ? {...t, status: s as any, auditLog: [...(t.auditLog || []), logAudit(`Moved to ${s}`, currentOwner)]} : t)}))}
                                             className={`px-3 py-2 rounded-xl text-[8px] font-black uppercase tracking-tighter transition-all ${task.status === s ? 'bg-white/10 text-white shadow-lg' : 'text-slate-600 hover:text-slate-400'}`}
                                          >
                                             {STATUS_META[s as TaskStatus].label}
                                          </button>
                                       ))}
                                    </div>
                                 </div>
                              </div>

                              <AnimatePresence>
                                 {isEx && (
                                    <motion.div 
                                       initial={{ height: 0, opacity: 0 }}
                                       animate={{ height: 'auto', opacity: 1 }}
                                       exit={{ height: 0, opacity: 0 }}
                                       className="overflow-hidden"
                                    >
                                       <div className="pt-10 mt-10 border-t border-slate-900 space-y-8">
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                             <div className="space-y-2">
                                                <h5 className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.3em]">Полный контекст</h5>
                                                <p className="text-sm text-slate-300 leading-relaxed font-medium">{task.description || 'Подробные инструкции не предоставлены.'}</p>
                                             </div>
                                             <div className="space-y-2 p-6 bg-amber-500/[0.03] border border-amber-500/10 rounded-[2rem]">
                                                <h5 className="text-[9px] font-black text-amber-500 uppercase tracking-[0.3em]">KPI успеха / Цель</h5>
                                                <p className="text-sm text-amber-100 font-bold leading-relaxed">{task.strategyData?.goal || 'Требуется общая операционная помощь.'}</p>
                                             </div>
                                          </div>
                                          
                                          {/* AUDIT LOG PREVIEW */}
                                          <div className="space-y-3">
                                             <h5 className="text-[9px] font-black text-slate-700 uppercase tracking-[0.3em]">События ленты</h5>
                                             <div className="flex flex-col gap-2">
                                                {task.auditLog?.slice(-3).map(event => (
                                                   <div key={event.id} className="flex items-center gap-3 text-[10px] text-slate-500 font-mono">
                                                      <span className="w-1.5 h-1.5 rounded-full bg-slate-800"></span>
                                                      <span className="text-slate-300 font-bold">[{event.actor}]</span>
                                                      <span className="flex-1 truncate">{event.action}</span>
                                                      <span className="text-slate-700">{new Date(event.timestamp).toLocaleTimeString()}</span>
                                                   </div>
                                                ))}
                                             </div>
                                          </div>
                                       </div>
                                    </motion.div>
                                 )}
                              </AnimatePresence>
                           </div>
                        </motion.div>
                      );
                   })}
                </AnimatePresence>
             </motion.div>
           </div>
        </motion.div>
      ) : (
        <motion.div key="notebook" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto space-y-6">
           {/* Navigation Tabs for Notebook */}
           <div className="flex justify-center p-2 bg-slate-950/60 rounded-[2.5rem] border border-white/5 w-fit mx-auto shadow-2xl">
              <button onClick={() => setIsArchiveOpen(false)} className={`px-12 py-3.5 rounded-[2rem] text-[10px] font-black tracking-[0.3em] uppercase transition-all ${!isArchiveOpen ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30' : 'text-slate-500 hover:text-slate-300'}`}>Текущий поток</button>
              <button onClick={() => setIsArchiveOpen(true)} className={`px-12 py-3.5 rounded-[2rem] text-[10px] font-black tracking-[0.3em] uppercase transition-all ${isArchiveOpen ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30' : 'text-slate-500 hover:text-slate-300'}`}>Архив реликвий</button>
           </div>

           {!isArchiveOpen ? (
              <div className="glass-card rounded-[4rem] border-slate-800 bg-[#0c0d11] overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.5)] flex flex-col min-h-[900px] relative">
                 {/* Technical Toolbar */}
                 <div className="bg-[#0c0d11]/90 border-b border-white/5 p-4 flex flex-wrap items-center gap-2 sticky top-0 z-20 backdrop-blur-3xl">
                    <div className="flex bg-slate-950 p-1 rounded-xl border border-white/5 gap-1">
                       <ToolbarButton onClick={() => exec('bold')} icon="B" title="Bold" />
                       <ToolbarButton onClick={() => exec('italic')} icon="I" title="Italic" isItalic />
                       <ToolbarButton onClick={() => exec('underline')} icon="U" title="Underline" isUnderline />
                    </div>

                    <div className="flex bg-slate-950 p-1 rounded-xl border border-white/5 gap-1">
                       <ToolbarButton onClick={() => exec('insertUnorderedList')} icon={<ICONS.List size={16}/>} title="Unordered" />
                       <ToolbarButton onClick={() => exec('insertOrderedList')} icon={<ICONS.ListOrdered size={16}/>} title="Ordered" />
                       <ToolbarButton onClick={() => { exec('insertHTML', '<input type="checkbox" class="notebook-check" />&nbsp;'); }} icon={<ICONS.CheckSquare size={16}/>} title="Checkbox" />
                    </div>

                    <div className="relative">
                       <button onClick={() => setShowColorPicker(!showColorPicker)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-950 border border-white/5 hover:border-white/20 text-slate-300 transition-all">
                          <ICONS.Baseline size={16}/>
                          <ICONS.ChevronDown size={10}/>
                       </button>
                       {showColorPicker && (
                          <div className="absolute top-full left-0 mt-2 p-3 bg-slate-900 border border-white/10 rounded-2xl shadow-3xl z-40 grid grid-cols-5 gap-2 animate-in slide-in-from-top-2">
                            {['#ffffff', '#f87171', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6', '#94a3b8', '#000000', '#4ade80'].map(c => (
                              <button key={c} onClick={() => { exec('foreColor', c); setShowColorPicker(false); }} className="w-7 h-7 rounded-lg border border-white/10 ring-2 ring-transparent hover:ring-white/50 transition-all" style={{ backgroundColor: c }} />
                            ))}
                            <button onClick={() => { exec('hiliteColor', '#fbbf24'); setShowColorPicker(false); }} className="col-span-5 text-[8px] font-black uppercase text-slate-500 py-2 hover:bg-white/5 rounded-lg">Highlight</button>
                          </div>
                       )}
                    </div>

                    <div className="flex gap-2 ml-4">
                       <button onClick={insertNextTask} className="px-5 py-2.5 bg-indigo-600/10 border border-indigo-500/20 rounded-xl text-indigo-400 text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-lg">+ Разрыв секции</button>
                       <button onClick={completeCurrentTask} className="px-5 py-2.5 bg-emerald-600/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-[9px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all shadow-lg">✓ Зафиксировать Архив</button>
                    </div>

                    <div className="ml-auto pr-4 flex items-center gap-4">
                        <div className="text-right">
                           <p className="text-[9px] font-black text-slate-600 leading-none">АВТОСИНХРОНИЗАЦИЯ АКТИВНА</p>
                           <p className="text-[8px] text-emerald-500 font-bold uppercase tracking-tight mt-1">Статус: Стабильно</p>
                        </div>
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
                    </div>
                 </div>

                 {/* Editor Surface */}
                 <div className="flex-1 bg-slate-950 p-6 md:p-16 overflow-y-auto custom-scrollbar">
                    <div className="max-w-[850px] mx-auto min-h-[1200px] bg-[#121418] rounded-[3rem] border border-white/5 shadow-[0_50px_100px_rgba(0,0,0,0.8)] p-16 md:p-28 relative notebook-editor group focus-within:ring-1 ring-indigo-500/20">
                       <div className="absolute inset-0 opacity-[0.02] pointer-events-none rounded-[3rem] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                       <div 
                          ref={editorRef}
                          contentEditable
                          className="w-full h-full min-h-[1000px] outline-none text-[18px] leading-[1.9] text-slate-200 prose prose-invert max-w-none relative z-10"
                          onInput={handleEditorInput}
                          onBlur={handleEditorInput}
                          onClick={(e) => { if ((e.target as any).tagName === 'INPUT') handleEditorInput(); }}
                       />
                    </div>
                 </div>
              </div>
           ) : (
              <div className="glass-card rounded-[4rem] border-slate-800 bg-[#0c0d11] overflow-hidden shadow-3xl min-h-[800px] flex flex-col">
                 <div className="p-10 border-b border-white/5 flex items-center justify-between">
                    <div>
                        <h3 className="text-3xl font-black font-outfit text-white leading-none">Хранилище Артефактов</h3>
                        <p className="text-xs text-slate-600 font-medium uppercase tracking-[0.3em] mt-3 underline decoration-indigo-500/50 underline-offset-4">История завершенных операций</p>
                    </div>
                    <button onClick={() => { if(confirm('Очистить историю архива?')) updateState(prev => ({ ...prev, completedDocument: '' })); }} className="text-rose-500 text-[9px] font-black uppercase tracking-[0.4em] px-6 py-3 border border-rose-500/20 rounded-full hover:bg-rose-500 hover:text-white transition-all">Форматировать Архив</button>
                 </div>
                 <div className="flex-1 p-16 overflow-y-auto">
                    <div className="max-w-[850px] mx-auto bg-[#080808]/50 rounded-[3rem] p-20 text-slate-500 leading-relaxed border border-white/5 shadow-inner">
                       {state.completedDocument ? <div dangerouslySetInnerHTML={{ __html: state.completedDocument }} className="prose prose-invert max-w-none opacity-80" /> : (
                          <div className="h-[400px] flex flex-col items-center justify-center space-y-4 opacity-20">
                             <ICONS.ClipboardList size={64}/>
                             <p className="uppercase tracking-[0.5em] text-[10px] font-black">Пустота Архива</p>
                          </div>
                       )}
                    </div>
                 </div>
              </div>
           )}
        </motion.div>
      )}
    </motion.div>
  );
};

const ToolbarButton = ({ onClick, icon, title, isItalic, isUnderline }: any) => (
   <button onClick={onClick} className={`w-10 h-10 rounded-lg hover:bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all ${isItalic ? 'italic' : ''} ${isUnderline ? 'underline' : ''}`} title={title}>
      {icon}
   </button>
);

export default OwnerTable;
