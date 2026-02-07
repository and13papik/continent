
import React, { useState, useMemo } from 'react';
import { AppState, OwnerTask, TaskPriority, TaskStatus, TaskNote, TaskType, RecurrenceCycle, TaskAuditEntry } from '../types';
import { ICONS } from '../constants';

// --- HELPERS ---

const PRIORITY_META: Record<TaskPriority, { label: string; color: string; bg: string }> = {
  urgent: { label: 'КРИТИЧЕСКИ', color: 'text-rose-500', bg: 'bg-rose-500/10' },
  high: { label: 'ВЫСОКИЙ', color: 'text-amber-500', bg: 'bg-amber-500/10' },
  medium: { label: 'ОБЫЧНЫЙ', color: 'text-sky-500', bg: 'bg-sky-500/10' },
  low: { label: 'НИЗКИЙ', color: 'text-slate-400', bg: 'bg-slate-500/10' }
};

const STATUS_META: Record<TaskStatus, { label: string; color: string; step: number; icon: any }> = {
  in_progress: { label: 'В процессе', color: 'text-sky-400', step: 1, icon: ICONS.RotateCcw },
  blocked: { label: 'Заблокировано', color: 'text-rose-500', step: 2, icon: ICONS.Lock },
  waiting_external: { label: 'Ожидание', color: 'text-amber-400', step: 3, icon: ICONS.Calendar },
  review: { label: 'На проверке', color: 'text-indigo-400', step: 4, icon: ICONS.Reports },
  completed: { label: 'Завершено', color: 'text-emerald-500', step: 5, icon: ICONS.Plus }
};

// --- TASK CARD ---

const TaskCard: React.FC<{ 
  task: OwnerTask; 
  isEx: boolean; 
  onToggle: (id: string) => void;
  onComplete: (id: string, isRecurring?: boolean) => void;
  onUpdateStatus: (id: string, s: TaskStatus) => void;
  addNote: (id: string, text: string) => void;
}> = ({ task, isEx, onToggle, onComplete, onUpdateStatus, addNote }) => {
  const [noteVal, setNoteVal] = useState('');
  const [showNote, setShowNote] = useState(false);

  const prio = PRIORITY_META[task.priority] || PRIORITY_META.medium;
  const stat = STATUS_META[task.status] || STATUS_META.in_progress;
  const isDirective = task.taskType === 'directive';
  const isRecurring = task.taskType === 'recurring';
  const isCompleted = task.status === 'completed';

  const today = new Date().toISOString().split('T')[0];
  const isUrgentDeadline = task.dueDate && task.dueDate <= today && !isCompleted;

  const CrownIcon = ICONS.Crown || 'span';
  const RotateIcon = ICONS.RotateCcw || 'span';
  const ClockIcon = ICONS.Calendar || 'span';

  return (
    <div className={`glass-card rounded-[2.5rem] border transition-all duration-500 overflow-hidden ${isDirective ? 'border-amber-500/30 shadow-[0_0_60px_rgba(245,158,11,0.04)] ring-1 ring-amber-500/5' : 'border-slate-800/40'} ${isCompleted ? 'opacity-30 grayscale' : 'hover:border-slate-700/80 hover:shadow-2xl'}`}>
       <div className="p-10 flex flex-col md:flex-row justify-between gap-10">
          <div className="flex-1 space-y-6">
             {/* TOP BADGES LAYER */}
             <div className="flex items-center gap-3 flex-wrap">
                <span className={`px-2.5 py-0.5 rounded-[4px] text-[8px] font-black tracking-[0.15em] ${prio.bg} ${prio.color}`}>{prio.label}</span>
                {isDirective && (
                  <span className="text-[8px] bg-amber-500 text-slate-950 px-2.5 py-0.5 rounded-[4px] font-black uppercase flex items-center gap-1.5 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                    <CrownIcon size={10}/> DIRECTIVE
                  </span>
                )}
                <span className="text-[8px] text-slate-500 border border-slate-800/60 px-2.5 py-0.5 rounded-[4px] font-black uppercase tracking-widest">👤 {task.assignedTo}</span>
                
                {task.dueDate && (
                  <div className={`flex items-center gap-2 ml-auto px-3 py-1 rounded-full bg-slate-900/40 border border-slate-800/30 ${isUrgentDeadline ? 'text-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.15)] animate-pulse' : 'text-slate-600'}`}>
                    <ClockIcon size={12} />
                    <span className="text-[10px] font-mono font-bold uppercase tracking-tighter">
                      {isUrgentDeadline ? 'ASAP' : 'DEADLINE'}: {task.dueDate}
                    </span>
                  </div>
                )}
             </div>

             <h3 className="text-2xl font-bold font-outfit text-white tracking-tight leading-tight">{task.title}</h3>
             
             <div className="flex items-center gap-5 pt-2">
                <div className="flex-1 h-[2px] bg-slate-900/60 rounded-full flex overflow-hidden">
                   {[1,2,3,4,5].map(step => (
                     <div key={step} className={`flex-1 transition-all duration-1000 ${step <= (stat.step || 1) ? 'bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.4)]' : 'bg-transparent'}`}></div>
                   ))}
                </div>
                <div className="flex items-center gap-2.5">
                   <stat.icon size={12} className={stat.color} />
                   <span className={`text-[10px] font-black uppercase tracking-[0.25em] ${stat.color}`}>{stat.label}</span>
                </div>
             </div>
          </div>

          {/* ACTIONS LAYER */}
          <div className="flex flex-col items-end justify-between gap-8 shrink-0">
             <div className="flex items-center gap-4">
                 {!isCompleted && !isRecurring && (
                     <button onClick={() => onComplete(task.id)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-7 py-3.5 rounded-2xl text-[11px] uppercase tracking-[0.15em] shadow-2xl shadow-emerald-600/10 active:scale-95 transition-all">
                        Complete
                     </button>
                 )}
                 {isRecurring && (
                     <button onClick={() => onComplete(task.id, true)} className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-7 py-3.5 rounded-2xl text-[11px] uppercase tracking-[0.15em] shadow-2xl shadow-indigo-600/10 active:scale-95 transition-all">
                        Reset Cycle
                     </button>
                 )}
                 {/* Кнопка раскрытия: максимально деликатная */}
                 <button onClick={() => onToggle(task.id)} className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all border opacity-20 hover:opacity-100 hover:scale-110 active:scale-90 ${isEx ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-950 border-slate-900 text-slate-500'}`}>
                    {isEx ? <ICONS.Plus size={14} className="rotate-45" /> : <ICONS.Plus size={14} />}
                 </button>
             </div>
             <select className="bg-slate-950/40 border border-slate-800/80 rounded-xl px-4 py-2 text-[9px] font-black text-slate-500 uppercase outline-none focus:border-indigo-500/40 transition-colors cursor-pointer hover:bg-slate-900/50" value={task.status} onChange={(e) => onUpdateStatus(task.id, e.target.value as any)}>
                {Object.entries(STATUS_META).map(([val, m]) => <option key={val} value={val}>{m.label}</option>)}
             </select>
          </div>
       </div>

       {isEx && (
          <div className="bg-slate-950/60 border-t border-slate-900/50 p-12 space-y-12 animate-in slide-in-from-top-4 duration-500">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                <div className="space-y-5">
                   <div className="flex items-center gap-2">
                      <CrownIcon size={12} className="text-slate-700" />
                      <label className="text-[11px] font-black text-slate-700 uppercase tracking-[0.4em] block">Main Objective</label>
                   </div>
                   <div className="text-[14px] text-slate-300 leading-relaxed font-medium bg-slate-900/20 p-8 rounded-[2.5rem] border border-slate-800/30 shadow-inner group">
                      {task.strategyData?.goal || <span className="italic text-slate-800 font-bold uppercase tracking-widest text-[10px]">Стратегическая цель не задана</span>}
                   </div>
                </div>
                
                <div className="space-y-6">
                  <div className="flex justify-between items-center border-b border-slate-900/50 pb-4">
                    <label className="text-[11px] font-black text-slate-700 uppercase tracking-[0.4em]">Operational Protocol</label>
                    <button onClick={() => setShowNote(!showNote)} className="group text-[10px] font-black text-sky-500 hover:text-sky-400 uppercase tracking-widest transition-colors flex items-center gap-2">
                      <div className="w-5 h-5 rounded-lg bg-sky-500/10 flex items-center justify-center group-hover:bg-sky-500 group-hover:text-white transition-all">
                        <ICONS.Plus size={12} /> 
                      </div>
                      Add Operational Record
                    </button>
                  </div>
                  <div className="space-y-3.5 max-h-[220px] overflow-y-auto pr-4 custom-scrollbar">
                     {(!task.notes || task.notes.length === 0) ? (
                        <p className="text-[11px] text-slate-800 font-bold uppercase tracking-[0.2em] py-10 text-center">Журнал операций пуст</p>
                     ) : task.notes.map(n => (
                        <div key={n.id} className="p-5 bg-slate-900/20 rounded-3xl border border-slate-800/20 flex justify-between gap-6 hover:border-slate-700/50 transition-colors">
                           <span className="text-[12px] text-slate-400 flex-1 leading-relaxed">{n.text}</span>
                           <span className="text-slate-700 uppercase font-black text-[9px] self-end tracking-tighter bg-slate-950 px-2 py-1 rounded-lg">{n.author}</span>
                        </div>
                     ))}
                  </div>
                </div>
             </div>

             {showNote && (
                <div className="bg-slate-900/40 p-10 rounded-[3rem] border border-sky-500/10 space-y-6 shadow-2xl animate-in zoom-in-95">
                   <textarea className="w-full bg-transparent border-none outline-none text-sm text-white min-h-[100px] placeholder:text-slate-800 font-medium" placeholder="Опишите текущий прогресс или событие..." value={noteVal} onChange={e => setNoteVal(e.target.value)} autoFocus />
                   <div className="flex justify-end gap-5">
                      <button onClick={() => { setNoteVal(''); setShowNote(false); }} className="text-[11px] text-slate-600 uppercase font-black tracking-[0.3em] hover:text-slate-400 transition-colors">Cancel</button>
                      <button onClick={() => { addNote(task.id, noteVal); setNoteVal(''); setShowNote(false); }} className="bg-sky-600 hover:bg-sky-500 px-10 py-3 rounded-2xl text-[11px] font-black text-white uppercase tracking-[0.25em] shadow-xl shadow-sky-600/10 transition-all">Submit Log</button>
                   </div>
                </div>
             )}
          </div>
       )}
    </div>
  );
};

// --- ADMIN TABLE ---

interface AdminTableProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const AdminTable: React.FC<AdminTableProps> = ({ state, updateState }) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [currentAdminRole, setCurrentAdminRole] = useState<'Mentor' | 'Rector' | 'Admins'>('Mentor');

  const [activeMode, setActiveMode] = useState<TaskType>('regular');
  const [secondaryFilter, setSecondaryFilter] = useState<'all' | 'critical' | 'process' | 'blocked'>('all');

  const logAudit = (action: string, actor: string): TaskAuditEntry => ({
    id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    action, actor, timestamp: new Date().toISOString()
  });

  const updateStatus = (id: string, status: TaskStatus) => {
    updateState(p => ({
      ...p,
      ownerTasks: (p.ownerTasks || []).map(t => t.id === id ? { 
        ...t, status, 
        auditLog: [...(t.auditLog || []), logAudit(`Status change to ${status}`, currentAdminRole)], 
        updatedAt: new Date().toISOString() 
      } : t)
    }));
  };

  const completeTask = (id: string, isRecurring = false) => {
    updateState(p => ({
      ...p,
      ownerTasks: (p.ownerTasks || []).map(t => t.id === id ? { 
        ...t, 
        status: isRecurring ? t.status : 'review', 
        lastCompletedAt: isRecurring ? new Date().toISOString() : t.lastCompletedAt,
        auditLog: [...(t.auditLog || []), logAudit(isRecurring ? 'Regulation reset' : 'Submitted for review', currentAdminRole)],
        updatedAt: new Date().toISOString() 
      } : t)
    }));
  };

  const addNote = (id: string, text: string) => {
    if (!text.trim()) return;
    const note: TaskNote = { id: String(Date.now()), text, author: currentAdminRole, createdAt: new Date().toISOString() };
    updateState(p => ({
      ...p,
      ownerTasks: (p.ownerTasks || []).map(t => t.id === id ? { 
        ...t, notes: [...(t.notes || []), note], 
        auditLog: [...(t.auditLog || []), logAudit('Operational log added', currentAdminRole)],
        updatedAt: new Date().toISOString() 
      } : t)
    }));
  };

  // NORMALIZATION & FILTERING
  const allTasks = useMemo(() => {
    let list = (state.ownerTasks || []).map(t => {
      let type = t.taskType;
      if (!type) {
        if (t.isRoutine) type = 'recurring';
        else if (!t.id.startsWith('admin-task')) type = 'directive';
        else type = 'regular';
      }
      let status = t.status;
      if (!STATUS_META[status]) {
        if ((status as string) === 'planned' || (status as string) === 'idea') status = 'in_progress';
        if ((status as string) === 'waiting') status = 'waiting_external';
      }
      return { ...t, taskType: type, status };
    });

    // Фильтрация по Роли Админа
    // Mentor видит свои + общие админские + общие для всех
    // Rector аналогично
    // Admins (Общие) видит только те, что на обоих админов или весь состав
    if (currentAdminRole === 'Mentor') {
      list = list.filter(t => t.assignedTo === 'Mentor' || t.assignedTo === 'Admins' || t.assignedTo === 'All');
    } else if (currentAdminRole === 'Rector') {
      list = list.filter(t => t.assignedTo === 'Rector' || t.assignedTo === 'Admins' || t.assignedTo === 'All');
    } else if (currentAdminRole === 'Admins') {
      list = list.filter(t => t.assignedTo === 'Admins' || t.assignedTo === 'All');
    }

    // Filter by Active Mode
    list = list.filter(t => t.taskType === activeMode);

    // Filter by Secondary
    if (secondaryFilter === 'critical') list = list.filter(t => t.priority === 'urgent' || t.priority === 'high');
    if (secondaryFilter === 'process') list = list.filter(t => t.status === 'in_progress');
    if (secondaryFilter === 'blocked') list = list.filter(t => t.status === 'blocked');

    return list;
  }, [state.ownerTasks, currentAdminRole, activeMode, secondaryFilter]);

  const emptyMessages = {
    directive: "Активные директивы отсутствуют. Операционный контроль в норме.",
    regular: "Все операционные задачи завершены. Команда ожидает вводных.",
    recurring: "Система работает без жестких регламентов. Гибкость максимальна."
  };

  return (
    <div className="space-y-16 pb-32 max-w-7xl mx-auto animate-in fade-in duration-1000">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-slate-900/50 pb-16">
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <div className="w-2.5 h-2.5 rounded-full bg-sky-500 shadow-[0_0_15px_rgba(14,165,233,0.7)] animate-pulse"></div>
            <span className="text-[12px] font-black text-sky-500 uppercase tracking-[0.6em]">Management & Protocol</span>
          </div>
          <h1 className="text-5xl font-black font-outfit text-white tracking-tighter">ADMIN CENTER</h1>
        </div>
        
        {/* ROLE SWITCHER */}
        <div className="flex gap-2">
          {[
            { id: 'Rector', label: 'Admin Rector' },
            { id: 'Mentor', label: 'Admin Mentor' },
            { id: 'Admins', label: 'Общие' }
          ].map(role => (
            <button 
              key={role.id} 
              onClick={() => setCurrentAdminRole(role.id as any)} 
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${currentAdminRole === role.id ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20' : 'bg-slate-900 text-slate-500'}`}
            >
              {role.label}
            </button>
          ))}
        </div>
      </header>

      {/* MODE SWITCHER */}
      <div className="space-y-12">
        <div className="flex gap-16 items-center px-6 border-b border-slate-900/30">
          {[
            { id: 'directive', label: 'ДИРЕКТИВЫ', color: 'amber' },
            { id: 'regular', label: 'ЗАДАЧИ', color: 'sky' },
            { id: 'recurring', label: 'РЕГЛАМЕНТ', color: 'indigo' }
          ].map((mode) => {
            const isActive = activeMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => { setActiveMode(mode.id as TaskType); setSecondaryFilter('all'); }}
                className={`group relative py-7 text-[13px] font-black uppercase tracking-[0.55em] transition-all duration-500 ${isActive ? `text-${mode.color}-400` : 'text-slate-600 hover:text-slate-400 hover:tracking-[0.65em]'}`}
              >
                <span className={isActive ? 'drop-shadow-[0_0_20px_rgba(var(--tw-color-' + mode.color + '-400),0.8)]' : ''}>
                  {mode.label}
                </span>
                {isActive && (
                  <div className={`absolute -bottom-0.5 left-0 right-0 h-[5px] bg-${mode.color}-500 shadow-[0_0_30px_rgba(var(--tw-color-${mode.color}-500),1)] rounded-full animate-in fade-in slide-in-from-bottom-2 duration-500`} />
                )}
              </button>
            );
          })}
        </div>

        {/* SECONDARY FILTERS - HIDE IN RECURRING */}
        {activeMode !== 'recurring' && (
          <div className="flex gap-12 px-10 items-center overflow-x-auto no-scrollbar animate-in slide-in-from-left-4 duration-500">
             <button
               onClick={() => setSecondaryFilter('all')}
               className={`px-6 py-2.5 rounded-full text-[11px] font-black uppercase tracking-[0.2em] transition-all ${secondaryFilter === 'all' ? 'text-white bg-slate-900 shadow-2xl scale-105' : 'text-slate-700 hover:text-slate-400'}`}
             >
               ВСЕ
             </button>
             
             {[
               { id: 'critical', label: 'КРИТИЧЕСКИЕ', icon: ICONS.Penalty, color: 'text-rose-500' },
               { id: 'process', label: 'В ПРОЦЕССЕ', icon: ICONS.RotateCcw, color: 'text-sky-500' },
               { id: 'blocked', label: 'ЗАБЛОКИРОВАНО', icon: ICONS.Lock, color: 'text-amber-500' }
             ].map(f => {
               const Icon = f.icon;
               const isActive = secondaryFilter === f.id;
               return (
                 <button
                   key={f.id}
                   onClick={() => setSecondaryFilter(f.id as any)}
                   className={`group relative flex items-center gap-3.5 text-[11px] font-black uppercase tracking-[0.2em] transition-all ${isActive ? f.color : 'text-slate-700 hover:text-slate-500'}`}
                 >
                   <Icon size={16} className={isActive ? f.color : 'text-slate-800 group-hover:text-slate-600'} />
                   <span>{f.label}</span>
                   {isActive && <div className={`w-1.5 h-1.5 rounded-full ${f.color.replace('text', 'bg')} ml-1 shadow-[0_0_12px_rgba(255,255,255,0.5)]`} />}
                   {isActive && <div className={`absolute bottom-[-14px] left-0 right-0 h-[3px] ${f.color.replace('text', 'bg')} animate-in fade-in slide-in-from-bottom-1`} />}
                 </button>
               );
             })}
          </div>
        )}
      </div>

      {/* TASKS LIST */}
      <div className="space-y-8 px-2 pb-40">
        {allTasks.length === 0 ? (
          <div className="py-60 text-center flex flex-col items-center gap-10 animate-in fade-in zoom-in-95 duration-1000">
             <div className="w-28 h-28 rounded-[3.5rem] bg-slate-900/20 border border-slate-800/40 flex items-center justify-center text-slate-800">
                <ICONS.Dashboard size={48} strokeWidth={1} className="opacity-30" />
             </div>
             <p className="max-w-md text-base font-bold text-slate-700 leading-relaxed tracking-[0.3em] uppercase text-[12px]">
               {emptyMessages[activeMode]}
             </p>
          </div>
        ) : allTasks.map(t => (
          <TaskCard 
            key={t.id} 
            task={t} 
            isEx={expanded.has(t.id)} 
            onToggle={id => { 
              const n = new Set(expanded); 
              if(n.has(id)) n.delete(id); else n.add(id); 
              setExpanded(n); 
            }} 
            onComplete={completeTask} 
            onUpdateStatus={updateStatus} 
            addNote={addNote} 
          />
        ))}
      </div>
    </div>
  );
};

export default AdminTable;
