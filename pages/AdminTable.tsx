
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

  const CrownIcon = ICONS.Crown || 'span';
  const RotateIcon = ICONS.RotateCcw || 'span';

  return (
    <div className={`glass-card rounded-[2rem] border transition-all duration-500 overflow-hidden ${isDirective ? 'border-amber-500/30 shadow-[0_0_40px_rgba(245,158,11,0.03)]' : 'border-slate-800/50'} ${isCompleted ? 'opacity-40 grayscale' : 'hover:border-slate-700 hover:shadow-2xl'}`}>
       <div className="p-7 flex flex-col md:flex-row justify-between gap-6">
          <div className="flex-1 space-y-4">
             <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded text-[8px] font-black tracking-widest ${prio.bg} ${prio.color}`}>{prio.label}</span>
                {isDirective && (
                  <span className="text-[8px] bg-amber-500 text-slate-950 px-2 py-0.5 rounded font-black uppercase flex items-center gap-1 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                    <CrownIcon size={10}/> DIRECTIVE
                  </span>
                )}
                {isRecurring && (
                  <span className="text-[8px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded font-black uppercase flex items-center gap-1">
                    <RotateIcon size={10}/> {task.recurrenceCycle || 'CYCLE'}
                  </span>
                )}
                <span className="text-[8px] text-slate-500 border border-slate-800 px-2 py-0.5 rounded font-black uppercase">👤 {task.assignedTo}</span>
                {task.dueDate && <span className="text-[8px] text-slate-600 font-mono font-bold uppercase ml-auto">Deadline: {task.dueDate}</span>}
             </div>

             <h3 className="text-lg font-bold font-outfit text-white tracking-tight leading-tight">{task.title}</h3>
             
             <div className="flex items-center gap-4">
                <div className="flex-1 h-[1px] bg-slate-900 rounded-full flex overflow-hidden">
                   {[1,2,3,4,5].map(step => (
                     <div key={step} className={`flex-1 transition-all duration-700 ${step <= (stat.step || 1) ? 'bg-indigo-500/60 shadow-[0_0_8px_rgba(99,102,241,0.4)]' : 'bg-transparent'}`}></div>
                   ))}
                </div>
                <span className={`text-[9px] font-black uppercase tracking-[0.15em] ${stat.color}`}>{stat.label}</span>
             </div>
          </div>

          <div className="flex flex-col items-end justify-between gap-4 shrink-0">
             <div className="flex gap-2">
                 {!isCompleted && !isRecurring && (
                     <button onClick={() => onComplete(task.id)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-5 py-2.5 rounded-2xl text-[9px] uppercase tracking-widest shadow-lg shadow-emerald-500/10 active:scale-95 transition-all">
                        Complete
                     </button>
                 )}
                 {isRecurring && (
                     <button onClick={() => onComplete(task.id, true)} className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-5 py-2.5 rounded-2xl text-[9px] uppercase tracking-widest shadow-lg shadow-indigo-600/10 active:scale-95 transition-all">
                        Reset Cycle
                     </button>
                 )}
                 <button onClick={() => onToggle(task.id)} className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all border ${isEx ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-950 border-slate-900 text-slate-700 hover:text-slate-400'}`}>
                    {isEx ? <ICONS.ChevronRight size={18} className="rotate-90"/> : <ICONS.Plus size={18} />}
                 </button>
             </div>
             <select className="bg-slate-950/50 border border-slate-800 rounded-xl px-3 py-1.5 text-[8px] font-black text-slate-500 uppercase outline-none focus:border-indigo-500/50 transition-colors" value={task.status} onChange={(e) => onUpdateStatus(task.id, e.target.value as any)}>
                {Object.entries(STATUS_META).map(([val, m]) => <option key={val} value={val}>{m.label}</option>)}
             </select>
          </div>
       </div>

       {isEx && (
          <div className="bg-slate-950/40 border-t border-slate-900/50 p-8 space-y-8 animate-in slide-in-from-top-3 duration-500">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-3">
                   <label className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] block">Main Objective</label>
                   <p className="text-[12px] text-slate-300 leading-relaxed font-medium bg-slate-900/30 p-5 rounded-3xl border border-slate-800/30">
                      {task.strategyData?.goal || <span className="italic text-slate-600">Стратегическая установка не зафиксирована Владельцем</span>}
                   </p>
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-end border-b border-slate-900 pb-2">
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em]">Operational Protocol</label>
                    <button onClick={() => setShowNote(!showNote)} className="text-[9px] font-black text-sky-500 hover:text-sky-400 uppercase tracking-widest transition-colors flex items-center gap-1">
                      <ICONS.Plus size={12} /> Add Log
                    </button>
                  </div>
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                     {(!task.notes || task.notes.length === 0) ? (
                        <p className="text-[10px] text-slate-700 italic py-4">Журнал операций пуст.</p>
                     ) : task.notes.map(n => (
                        <div key={n.id} className="p-3 bg-slate-900/40 rounded-2xl border border-slate-800/30 flex justify-between gap-4 group">
                           <span className="text-[11px] text-slate-400 flex-1 leading-relaxed">{n.text}</span>
                           <span className="text-slate-600 uppercase font-black text-[7px] self-end tracking-tighter">{n.author}</span>
                        </div>
                     ))}
                  </div>
                </div>
             </div>

             {showNote && (
                <div className="bg-slate-900/60 p-6 rounded-[2rem] border border-sky-500/20 space-y-4 shadow-2xl animate-in zoom-in-95">
                   <textarea className="w-full bg-transparent border-none outline-none text-xs text-white min-h-[60px] placeholder:text-slate-700" placeholder="Опишите текущий прогресс или возникшее препятствие..." value={noteVal} onChange={e => setNoteVal(e.target.value)} autoFocus />
                   <div className="flex justify-end gap-3">
                      <button onClick={() => { setNoteVal(''); setShowNote(false); }} className="text-[9px] text-slate-600 uppercase font-black tracking-widest hover:text-slate-400">Cancel</button>
                      <button onClick={() => { addNote(task.id, noteVal); setNoteVal(''); setShowNote(false); }} className="bg-sky-600 px-6 py-2 rounded-xl text-[9px] font-black text-white uppercase tracking-widest shadow-lg shadow-sky-600/10">Submit Log</button>
                   </div>
                </div>
             )}

             <div className="pt-6 border-t border-slate-900/50">
                <label className="text-[9px] font-black text-slate-700 uppercase tracking-[0.3em] block mb-6">Execution Timeline</label>
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
                   {(task.auditLog || []).slice(-6).map((log, idx, arr) => {
                      const isLast = idx === arr.length - 1;
                      return (
                        <React.Fragment key={log.id}>
                          <div className={`flex flex-col items-center gap-2 shrink-0 px-4 py-3 rounded-2xl border transition-all ${isLast ? 'bg-indigo-500/10 border-indigo-500/30' : 'opacity-30 border-transparent hover:opacity-100 hover:bg-slate-900/50'}`}>
                             <div className="w-2 h-2 rounded-full bg-indigo-500" />
                             <div className="text-center">
                                <p className="text-[7px] font-black text-white uppercase tracking-tighter mb-0.5">{log.action.replace('Status change to', '→')}</p>
                                <p className="text-[6px] text-slate-500 uppercase font-bold">{new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                             </div>
                          </div>
                          {!isLast && <div className="h-px w-8 bg-slate-900 shrink-0" />}
                        </React.Fragment>
                      );
                   })}
                </div>
             </div>
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
  const [currentAdmin] = useState<'Rector' | 'Mentor'>('Rector');

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
        auditLog: [...(t.auditLog || []), logAudit(`Status change to ${status}`, currentAdmin)], 
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
        auditLog: [...(t.auditLog || []), logAudit(isRecurring ? 'Regulation reset' : 'Submitted for review', currentAdmin)],
        updatedAt: new Date().toISOString() 
      } : t)
    }));
  };

  const addNote = (id: string, text: string) => {
    if (!text.trim()) return;
    const note: TaskNote = { id: String(Date.now()), text, author: currentAdmin, createdAt: new Date().toISOString() };
    updateState(p => ({
      ...p,
      ownerTasks: (p.ownerTasks || []).map(t => t.id === id ? { 
        ...t, notes: [...(t.notes || []), note], 
        auditLog: [...(t.auditLog || []), logAudit('Operational log added', currentAdmin)],
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
    }).filter(t => t.assignedTo === 'Admins' || t.assignedTo === currentAdmin || t.assignedTo === 'All');

    // Filter by Active Mode
    list = list.filter(t => t.taskType === activeMode);

    // Filter by Secondary
    if (secondaryFilter === 'critical') list = list.filter(t => t.priority === 'urgent' || t.priority === 'high');
    if (secondaryFilter === 'process') list = list.filter(t => t.status === 'in_progress');
    if (secondaryFilter === 'blocked') list = list.filter(t => t.status === 'blocked');

    return list;
  }, [state.ownerTasks, currentAdmin, activeMode, secondaryFilter]);

  const emptyMessages = {
    directive: "Активные директивы отсутствуют. Операционный контроль в норме.",
    regular: "Все операционные задачи завершены. Команда ожидает вводных.",
    recurring: "Система работает без жестких регламентов. Гибкость максимальна."
  };

  return (
    <div className="space-y-12 pb-24 max-w-7xl mx-auto animate-in fade-in duration-1000">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-slate-900 pb-10">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse"></div>
            <span className="text-[10px] font-black text-sky-500 uppercase tracking-[0.4em]">Operations Center</span>
          </div>
          <h1 className="text-5xl font-black font-outfit text-white tracking-tighter">Execution Hub</h1>
        </div>
      </header>

      {/* MODE SWITCHER */}
      <div className="space-y-10">
        <div className="flex gap-12 items-center px-4">
          {[
            { id: 'directive', label: 'ДИРЕКТИВЫ', color: 'amber' },
            { id: 'regular', label: 'ЗАДАЧИ', color: 'sky' },
            { id: 'recurring', label: 'РЕГЛАМЕНТ', color: 'indigo' }
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => { setActiveMode(mode.id as TaskType); setSecondaryFilter('all'); }}
              className={`group relative py-2 text-[11px] font-black uppercase tracking-[0.35em] transition-all duration-500 ${activeMode === mode.id ? `text-${mode.color}-400` : 'text-slate-600 hover:text-slate-400'}`}
            >
              <span className={activeMode === mode.id ? 'drop-shadow-[0_0_10px_rgba(var(--tw-color-' + mode.color + '-400),0.6)]' : ''}>
                {mode.label}
              </span>
              {activeMode === mode.id && (
                <div className={`absolute -bottom-[42px] left-0 right-0 h-[3px] bg-${mode.color}-500 shadow-[0_0_20px_rgba(var(--tw-color-${mode.color}-500),0.8)] rounded-full animate-in fade-in slide-in-from-bottom-2 duration-500`} />
              )}
            </button>
          ))}
        </div>

        {/* SECONDARY FILTERS - "INVISIBLE" STYLE */}
        <div className="flex gap-8 px-6 items-center overflow-x-auto no-scrollbar">
           <button
             onClick={() => setSecondaryFilter('all')}
             className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${secondaryFilter === 'all' ? 'text-white bg-slate-800' : 'text-slate-600 hover:text-slate-400'}`}
           >
             ВСЕ
           </button>
           
           {[
             { id: 'critical', label: 'КРИТИЧЕСКИЕ', icon: ICONS.Penalty },
             { id: 'process', label: 'В ПРОЦЕССЕ', icon: ICONS.RotateCcw },
             { id: 'blocked', label: 'ЗАБЛОКИРОВАНО', icon: ICONS.Lock }
           ].map(f => {
             const Icon = f.icon;
             const isActive = secondaryFilter === f.id;
             return (
               <button
                 key={f.id}
                 onClick={() => setSecondaryFilter(f.id as any)}
                 className={`group flex items-center gap-2.5 text-[9px] font-black uppercase tracking-widest transition-all ${isActive ? 'text-indigo-400' : 'text-slate-600 hover:text-slate-500'}`}
               >
                 <Icon size={12} className={isActive ? 'text-indigo-400' : 'text-slate-700 group-hover:text-slate-500'} />
                 <span>{f.label}</span>
                 {isActive && <div className="w-1 h-1 rounded-full bg-indigo-400 ml-1 shadow-[0_0_8px_rgba(129,140,248,0.8)]" />}
               </button>
             );
           })}
        </div>
      </div>

      {/* TASKS LIST */}
      <div className="space-y-5 px-1">
        {allTasks.length === 0 ? (
          <div className="py-40 text-center flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-700">
             <div className="w-20 h-20 rounded-[2.5rem] bg-slate-900/50 border border-slate-800 flex items-center justify-center text-slate-700">
                <ICONS.Dashboard size={32} strokeWidth={1}/>
             </div>
             <p className="max-w-md text-sm font-medium text-slate-500 leading-relaxed tracking-wide">
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
