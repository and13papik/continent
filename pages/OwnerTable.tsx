
import React, { useState, useMemo } from 'react';
import { AppState, OwnerTask, TaskPriority, TaskStatus, OwnerTag, TaskNote, TaskAssignee, TaskType, RecurrenceCycle, TaskAuditEntry } from '../types';
import { ICONS } from '../constants';

// --- HELPERS ---

function StrategyInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void, placeholder?: string }) {
  return (
    <div className="space-y-1">
      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">{label}</label>
      <input 
        type="text" 
        className="w-full bg-slate-950 border border-slate-800/50 rounded-xl px-4 py-2.5 text-[11px] text-white outline-none focus:border-amber-500/50 transition-all placeholder:text-slate-700" 
        placeholder={placeholder}
        value={value} 
        onChange={e => onChange(e.target.value)} 
      />
    </div>
  );
}

function StatWidget({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  const colorClasses: Record<string, string> = {
    rose: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    sky: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
    amber: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    indigo: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20'
  };

  return (
    <div className={`glass-card p-4 rounded-3xl border flex items-center gap-4 transition-all ${colorClasses[color] || 'border-slate-800'}`}>
      <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 bg-slate-950/50">
         {icon}
      </div>
      <div>
         <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest leading-none mb-1.5">{label}</p>
         <p className="text-xl font-bold font-outfit text-white leading-none">{value}</p>
      </div>
    </div>
  );
}

// --- MAIN ---

interface OwnerTableProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const OwnerTable: React.FC<OwnerTableProps> = ({ state, updateState }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [currentOwner, setCurrentOwner] = useState<'Andrey' | 'Anton' | 'Owners'>('Andrey');

  // Modes: directive, regular, recurring
  const [activeMode, setActiveMode] = useState<TaskType>('directive');
  const [secondaryFilter, setSecondaryFilter] = useState<'all' | 'critical' | 'process' | 'blocked'>('all');

  const PRIORITY_META = useMemo<Record<TaskPriority, { label: string; color: string; bg: string }>>(() => ({
    urgent: { label: 'КРИТИЧЕСКИ', color: 'text-rose-500', bg: 'bg-rose-500/10' },
    high: { label: 'ВЫСОКИЙ', color: 'text-amber-500', bg: 'bg-amber-500/10' },
    medium: { label: 'СРЕДНИЙ', color: 'text-sky-500', bg: 'bg-sky-500/10' },
    low: { label: 'НИЗКИЙ', color: 'text-slate-400', bg: 'bg-slate-500/10' }
  }), []);

  const STATUS_META = useMemo<Record<TaskStatus, { label: string; color: string; step: number }>>(() => ({
    in_progress: { label: 'В процессе', color: 'text-sky-400', step: 1 },
    blocked: { label: 'Заблокировано', color: 'text-rose-500', step: 2 },
    waiting_external: { label: 'Ожидание (Вне)', color: 'text-amber-400', step: 3 },
    review: { label: 'На проверке', color: 'text-indigo-400', step: 4 },
    completed: { label: 'Завершено', color: 'text-emerald-500', step: 5 }
  }), []);

  const TYPE_META: Record<TaskType, { label: string, color: string, bg: string, icon: any }> = {
    directive: { label: 'ДИРЕКТИВА', color: 'text-amber-500', bg: 'bg-amber-500/10', icon: ICONS.Crown },
    regular: { label: 'ЗАДАЧА', color: 'text-sky-400', bg: 'bg-sky-400/10', icon: ICONS.Reports },
    recurring: { label: 'РЕГЛАМЕНТ', color: 'text-indigo-400', bg: 'bg-indigo-400/10', icon: ICONS.RotateCcw }
  };

  const ASSIGNEE_LABELS: Record<TaskAssignee, string> = {
    Andrey: 'Андрей', Anton: 'Антон', Rector: 'Admin Rector', Mentor: 'Admin Mentor', 
    Owners: 'Общее (Owners)', Admins: 'Общие (Admins)', All: 'Весь состав'
  };

  // Forms
  const [editingTask, setEditingTask] = useState<OwnerTask | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('medium');
  const [newTaskAssigned, setNewTaskAssigned] = useState<TaskAssignee>('Admins');
  const [newTaskType, setNewTaskType] = useState<TaskType>('directive');
  const [newTaskCycle, setNewTaskCycle] = useState<RecurrenceCycle>('daily');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskGoal, setNewTaskGoal] = useState('');

  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  // NORMALIZATION LAYER
  const normalizedTasks = useMemo(() => {
    return (state.ownerTasks || []).map(task => {
      let status = task.status;
      if (!STATUS_META[status]) {
        if ((status as string) === 'planned') status = 'in_progress';
        if ((status as string) === 'idea') status = 'in_progress';
        if ((status as string) === 'waiting') status = 'waiting_external';
      }
      let type = task.taskType;
      if (!type) {
        if (task.isRoutine) type = 'recurring';
        else if (!task.id.startsWith('admin-task')) type = 'directive';
        else type = 'regular';
      }
      return {
        ...task,
        status,
        taskType: type,
        auditLog: task.auditLog || [],
        notes: task.notes || [],
        strategyData: task.strategyData || { goal: '', reason: '', effect: '' }
      } as OwnerTask;
    });
  }, [state.ownerTasks, STATUS_META]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === '1233211') { setIsAuthenticated(true); }
    else alert('Доступ запрещен');
  };

  const logAudit = (action: string, actor: string, details?: string): TaskAuditEntry => ({
    id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    action, actor, timestamp: new Date().toISOString(), details
  });

  const saveTask = () => {
    if (!newTaskTitle.trim()) return;

    if (editingTask) {
        updateState(prev => ({
            ...prev,
            ownerTasks: (prev.ownerTasks || []).map(t => t.id === editingTask.id ? {
                ...t,
                title: newTaskTitle, description: newTaskDesc, priority: newTaskPriority,
                assignedTo: newTaskAssigned, taskType: newTaskType,
                recurrenceCycle: newTaskType === 'recurring' ? newTaskCycle : undefined,
                dueDate: newTaskDueDate || undefined,
                strategyData: { goal: newTaskGoal, reason: '', effect: '' },
                auditLog: [...(t.auditLog || []), logAudit('Task edited', currentOwner)],
                updatedAt: new Date().toISOString()
            } : t)
        }));
        setEditingTask(null);
    } else {
        const task: OwnerTask = {
            id: `task-${Date.now()}`,
            title: newTaskTitle, description: newTaskDesc, status: 'in_progress',
            priority: newTaskPriority, taskType: newTaskType, assignedTo: newTaskAssigned,
            recurrenceCycle: newTaskType === 'recurring' ? newTaskCycle : undefined,
            dueDate: newTaskDueDate || undefined,
            tags: [], strategyData: { goal: newTaskGoal, reason: '', effect: '' },
            notes: [], auditLog: [logAudit('Task initiated', currentOwner)],
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            periodId: state.selectedPeriodId
        };
        updateState(prev => ({ ...prev, ownerTasks: [task, ...(prev.ownerTasks || [])] }));
    }
    setNewTaskTitle(''); setNewTaskDesc(''); setNewTaskGoal(''); setNewTaskDueDate('');
  };

  const quickAction = (id: string, action: 'pin' | 'priority' | 'extend') => {
    updateState(prev => ({
      ...prev,
      ownerTasks: (prev.ownerTasks || []).map(t => {
        if (t.id !== id) return t;
        let update: Partial<OwnerTask> = {};
        if (action === 'pin') update.isPinned = !t.isPinned;
        if (action === 'priority') {
          const cycle: Record<TaskPriority, TaskPriority> = { low: 'medium', medium: 'high', high: 'urgent', urgent: 'low' };
          update.priority = cycle[t.priority] || 'medium';
        }
        if (action === 'extend' && t.dueDate) {
          const d = new Date(t.dueDate); d.setDate(d.getDate() + 3);
          update.dueDate = d.toISOString().split('T')[0];
        }
        return { ...t, ...update, auditLog: [...(t.auditLog || []), logAudit(`Quick action: ${action}`, currentOwner)], updatedAt: new Date().toISOString() };
      })
    }));
  };

  const startEditing = (task: OwnerTask) => {
    setEditingTask(task);
    setNewTaskTitle(task.title); setNewTaskDesc(task.description);
    setNewTaskPriority(task.priority); setNewTaskAssigned(task.assignedTo);
    setNewTaskType(task.taskType || 'regular'); setNewTaskCycle(task.recurrenceCycle || 'daily');
    setNewTaskDueDate(task.dueDate || ''); setNewTaskGoal(task.strategyData?.goal || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filteredTasks = useMemo(() => {
    // Базовая фильтрация по типу
    let list = normalizedTasks.filter(t => t.taskType === activeMode);
    
    // Фильтрация по владельцу
    // Если выбран Андрей, показываем его задачи + Общие (Owners) + Весь состав
    // Если выбран Антон, аналогично
    // Если выбрано Общее, показываем задачи Owners + All
    if (currentOwner === 'Andrey') {
      list = list.filter(t => t.assignedTo === 'Andrey' || t.assignedTo === 'Owners' || t.assignedTo === 'All');
    } else if (currentOwner === 'Anton') {
      list = list.filter(t => t.assignedTo === 'Anton' || t.assignedTo === 'Owners' || t.assignedTo === 'All');
    } else if (currentOwner === 'Owners') {
      list = list.filter(t => t.assignedTo === 'Owners' || t.assignedTo === 'All');
    }

    if (secondaryFilter === 'critical') list = list.filter(t => t.priority === 'urgent' || t.priority === 'high');
    if (secondaryFilter === 'process') list = list.filter(t => t.status === 'in_progress');
    if (secondaryFilter === 'blocked') list = list.filter(t => t.status === 'blocked');

    return list.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const prioOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      const pComp = (prioOrder[a.priority] ?? 2) - (prioOrder[b.priority] ?? 2);
      return pComp !== 0 ? pComp : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [normalizedTasks, activeMode, secondaryFilter, currentOwner]);

  const emptyMessages = {
    directive: "Нет активных директив. Стратегический контроль стабилен.",
    regular: "Все задачи выполнены. Команда сфокусирована.",
    recurring: "Регламент пока не задан. Система гибкая."
  };

  const CrownIcon = ICONS.Crown || 'span';
  const PinIcon = ICONS.Lock || 'span';
  const FlagIcon = ICONS.AlertTriangle || 'span';
  const EditIcon = ICONS.Edit || 'span';
  const CalendarIcon = ICONS.Calendar || 'span';

  if (!isAuthenticated) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center animate-in fade-in zoom-in duration-300">
        <div className="glass-card p-12 rounded-[40px] w-full max-w-md border-amber-500/10 shadow-2xl text-center bg-slate-950/50">
            <div className="w-20 h-20 bg-amber-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-amber-500/20">
              <CrownIcon size={40} className="text-amber-500" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-8 font-outfit uppercase tracking-wider">Owner Control</h1>
            <form onSubmit={handleLogin} className="space-y-4">
              <input type="password" autoFocus className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-center text-2xl tracking-[0.5em] text-white outline-none focus:border-amber-500/50 transition-all" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black py-4 rounded-2xl uppercase tracking-[0.2em] text-xs">Authorize HQ</button>
            </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[9px] font-black text-amber-500 uppercase tracking-widest">HQ Strategic Oversight</div>
          </div>
          <h1 className="text-4xl font-black font-outfit text-white tracking-tight">Core Control</h1>
        </div>
        <div className="flex gap-2">
          {[
            { id: 'Andrey', label: 'Андрей' },
            { id: 'Anton', label: 'Антон' },
            { id: 'Owners', label: 'Общее' }
          ].map(owner => (
            <button 
              key={owner.id} 
              onClick={() => setCurrentOwner(owner.id as any)} 
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${currentOwner === owner.id ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20' : 'bg-slate-900 text-slate-500'}`}
            >
              {owner.label}
            </button>
          ))}
          <button onClick={() => setIsAuthenticated(false)} className="bg-slate-900 border border-slate-800 p-2 rounded-xl text-slate-500 hover:text-white transition-all"><ICONS.Lock size={18}/></button>
        </div>
      </header>

      {/* SEGMENTED MODE SWITCHER */}
      <div className="flex flex-col gap-4 border-b border-slate-900 pb-4">
        <div className="flex gap-8 items-center px-2">
          {[
            { id: 'directive', label: 'ДИРЕКТИВЫ', color: 'amber' },
            { id: 'regular', label: 'ЗАДАЧИ', color: 'sky' },
            { id: 'recurring', label: 'РЕГЛАМЕНТ', color: 'indigo' }
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => { setActiveMode(mode.id as TaskType); setSecondaryFilter('all'); }}
              className={`relative py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${activeMode === mode.id ? `text-${mode.color}-400 drop-shadow-[0_0_8px_rgba(var(--tw-color-${mode.color}-400),0.5)]` : 'text-slate-600 hover:text-slate-400'}`}
            >
              {mode.label}
              {activeMode === mode.id && (
                <div className={`absolute -bottom-[17px] left-0 right-0 h-0.5 bg-${mode.color}-500 shadow-[0_0_10px_rgba(var(--tw-color-${mode.color}-500),0.5)] rounded-full animate-in fade-in slide-in-from-bottom-1`} />
              )}
            </button>
          ))}
        </div>

        {/* SECONDARY FILTERS */}
        <div className="flex gap-4 px-2 items-center overflow-x-auto no-scrollbar">
           {[
             { id: 'all', label: 'ВСЕ' },
             { id: 'critical', label: 'КРИТИЧЕСКИЕ' },
             { id: 'process', label: 'В ПРОЦЕССЕ' },
             { id: 'blocked', label: 'ЗАБЛОКИРОВАНО' }
           ].map(f => (
             <button
               key={f.id}
               onClick={() => setSecondaryFilter(f.id as any)}
               className={`text-[8px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${secondaryFilter === f.id ? 'text-white bg-slate-800 px-3 py-1 rounded-full' : 'text-slate-600 hover:text-slate-400'}`}
             >
               {f.label}
             </button>
           ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-4 space-y-6">
           <div className="glass-card p-8 rounded-[32px] border border-slate-800 bg-slate-900/20 space-y-6">
              <h2 className="text-xl font-black font-outfit text-white">{editingTask ? 'Modify Initiative' : 'Initiate Task'}</h2>
              <div className="space-y-4">
                 <input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3.5 text-white font-bold outline-none text-sm" placeholder="Subject..." value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} />
                 <textarea className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3 text-white text-xs outline-none min-h-[70px]" placeholder="Brief context..." value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)} />
                 
                 <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                       <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Archetype</label>
                       <select className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-[10px] text-white font-bold outline-none" value={newTaskType} onChange={e => setNewTaskType(e.target.value as any)}>
                          <option value="directive">Directive</option>
                          <option value="regular">Regular Task</option>
                          <option value="recurring">Regulation</option>
                       </select>
                    </div>
                    {newTaskType === 'recurring' && (
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Cycle</label>
                        <select className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-[10px] text-white font-bold outline-none" value={newTaskCycle} onChange={e => setNewTaskCycle(e.target.value as any)}>
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                        </select>
                      </div>
                    )}
                 </div>

                 <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                       <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Responsible</label>
                       <select className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-[10px] text-white font-bold outline-none" value={newTaskAssigned} onChange={e => setNewTaskAssigned(e.target.value as any)}>
                          {Object.entries(ASSIGNEE_LABELS).map(([val, lab]) => <option key={val} value={val}>{lab}</option>)}
                       </select>
                    </div>
                    <div className="space-y-1">
                       <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Priority</label>
                       <select className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-[10px] text-white font-bold outline-none" value={newTaskPriority} onChange={e => setNewTaskPriority(e.target.value as any)}>
                          {Object.entries(PRIORITY_META).map(([val, m]) => <option key={val} value={val}>{(m as any).label}</option>)}
                       </select>
                    </div>
                 </div>

                 <StrategyInput label="Deadline" value={newTaskDueDate} onChange={setNewTaskDueDate} placeholder="YYYY-MM-DD" />
                 <StrategyInput label="Main Objective" value={newTaskGoal} onChange={setNewTaskGoal} placeholder="Define success..." />

                 <button onClick={saveTask} className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black py-4 rounded-2xl shadow-xl uppercase tracking-[0.2em] text-[10px] transition-all">Command Deploy</button>
              </div>
           </div>
        </div>

        <div className="lg:col-span-8 space-y-4">
           {filteredTasks.length === 0 ? (
             <div className="p-32 text-center border-2 border-dashed border-slate-900 rounded-[40px] text-slate-600 font-bold uppercase tracking-[0.2em] text-[10px] animate-in fade-in duration-500">
               {emptyMessages[activeMode]}
             </div>
           ) : filteredTasks.map(task => {
              const prio = PRIORITY_META[task.priority] || PRIORITY_META.medium;
              const stat = STATUS_META[task.status] || STATUS_META.in_progress;
              const typeConfig = TYPE_META[task.taskType] || TYPE_META.regular;
              const isEx = expandedTasks.has(task.id);
              const TypeIcon = typeConfig.icon || 'span';

              return (
                <div key={task.id} className={`glass-card rounded-[32px] border transition-all duration-300 overflow-hidden ${task.isPinned ? 'border-amber-500/50 shadow-[0_0_30px_rgba(245,158,11,0.05)]' : 'border-slate-800 hover:border-slate-700'}`}>
                   <div className="p-7 flex flex-col md:flex-row justify-between gap-6">
                      <div className="flex-1 space-y-4">
                         <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black tracking-widest ${typeConfig.bg} ${typeConfig.color} flex items-center gap-1`}>
                              <TypeIcon size={10} /> {typeConfig.label}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black tracking-widest ${prio.bg} ${prio.color}`}>{prio.label}</span>
                            <span className="text-[8px] bg-slate-950 text-indigo-400 px-2 py-0.5 rounded border border-slate-800 font-black uppercase">👤 {ASSIGNEE_LABELS[task.assignedTo] || task.assignedTo}</span>
                            {task.isPinned && <span className="text-[8px] bg-amber-500 text-slate-950 px-2 py-0.5 rounded font-black uppercase flex items-center gap-1 shadow-lg shadow-amber-500/20"><PinIcon size={10}/> PINNED</span>}
                         </div>
                         <h3 className="text-xl font-bold font-outfit text-white tracking-tight">{task.title}</h3>
                         <div className="flex items-center gap-4">
                            <div className="flex-1 h-[2px] bg-slate-950 rounded-full flex overflow-hidden">
                               {[1,2,3,4,5].map(step => (
                                 <div key={step} className={`flex-1 transition-all ${step <= (stat.step || 1) ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.3)]' : 'bg-transparent'}`}></div>
                               ))}
                            </div>
                            <span className={`text-[8px] font-black uppercase tracking-widest ${stat.color}`}>{stat.label}</span>
                         </div>
                      </div>

                      <div className="flex flex-col items-end gap-3 shrink-0">
                         <div className="flex gap-2">
                            <button onClick={() => quickAction(task.id, 'pin')} className={`w-10 h-10 rounded-2xl flex items-center justify-center border transition-all ${task.isPinned ? 'bg-amber-600 border-amber-500 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-600 hover:text-white'}`}><PinIcon size={16} /></button>
                            <button onClick={() => quickAction(task.id, 'priority')} className="w-10 h-10 rounded-2xl flex items-center justify-center bg-slate-950 border border-slate-800 text-slate-600 hover:text-sky-400"><FlagIcon size={16} /></button>
                            <button onClick={() => quickAction(task.id, 'extend')} className="w-10 h-10 rounded-2xl flex items-center justify-center bg-slate-950 border border-slate-800 text-slate-600 hover:text-emerald-400"><CalendarIcon size={16} /></button>
                            <button onClick={() => startEditing(task)} className="w-10 h-10 rounded-2xl flex items-center justify-center bg-slate-950 border border-slate-800 text-slate-600 hover:text-white"><EditIcon size={16} /></button>
                            {/* Fixed typo: changed id to task.id */}
                            <button onClick={() => { const n = new Set(expandedTasks); if(n.has(task.id)) n.delete(task.id); else n.add(task.id); setExpandedTasks(n); }} className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${isEx ? 'bg-indigo-600 text-white' : 'bg-slate-950 text-slate-600'}`}><ICONS.Plus size={18} className={isEx ? 'rotate-45' : ''}/></button>
                         </div>
                         <select className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-[8px] font-black text-slate-400 outline-none uppercase" value={task.status} onChange={(e) => updateState(p => ({...p, ownerTasks: (p.ownerTasks || []).map(t => t.id === task.id ? {...t, status: e.target.value as any, auditLog: [...(t.auditLog || []), logAudit(`Status to ${e.target.value}`, currentOwner)]} : t)}))}>
                            {Object.entries(STATUS_META).map(([val, m]) => <option key={val} value={val}>{(m as any).label}</option>)}
                         </select>
                      </div>
                   </div>

                   {isEx && (
                      <div className="bg-slate-950/40 border-t border-slate-900/50 p-8 space-y-6 animate-in slide-in-from-top-2">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="p-4 rounded-2xl bg-slate-900/30 border border-slate-800/50 space-y-2">
                               <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Main Objective</label>
                               <p className="text-xs text-slate-200">{task.strategyData?.goal || 'No objective set.'}</p>
                            </div>
                            <div className="p-4 rounded-2xl bg-slate-900/30 border border-slate-800/50 space-y-2">
                               <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">HQ Audit Log</label>
                               <div className="space-y-1 max-h-[80px] overflow-y-auto">
                                  {(task.auditLog || []).slice(-5).map(log => (
                                    <div key={log.id} className="text-[7px] text-slate-500 uppercase tracking-tighter border-b border-slate-800 last:border-none py-1">
                                       {new Date(log.timestamp).toLocaleDateString()} • {log.actor} - {log.action}
                                    </div>
                                  ))}
                               </div>
                            </div>
                         </div>
                      </div>
                   )}
                </div>
              );
           })}
        </div>
      </div>
    </div>
  );
};

export default OwnerTable;