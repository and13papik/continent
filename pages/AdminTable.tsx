
import React, { useState, useMemo } from 'react';
import { AppState, OwnerTask, TaskPriority, TaskStatus, TaskNote, TaskType, RecurrenceCycle, TaskAuditEntry } from '../types';
import { ICONS } from '../constants';

// --- HELPERS ---

function SectionHeader({ title, icon, color }: { title: string, icon: React.ReactNode, color: string }) {
  const colorMap: any = { amber: 'text-amber-500 bg-amber-500/10 border-amber-500/20', indigo: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20', sky: 'text-sky-400 bg-sky-400/10 border-sky-400/20' };
  return (
    <div className={`flex items-center gap-3 py-4 border-b border-slate-900 mb-6`}>
       <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${colorMap[color]}`}>
          {icon}
       </div>
       <h2 className="text-lg font-black font-outfit text-white uppercase tracking-tight">{title}</h2>
    </div>
  );
}

const PRIORITY_META: Record<TaskPriority, { label: string; color: string; bg: string }> = {
  urgent: { label: 'СРОЧНО', color: 'text-rose-500', bg: 'bg-rose-500/10' },
  high: { label: 'ВЫСОКИЙ', color: 'text-amber-500', bg: 'bg-amber-500/10' },
  medium: { label: 'ОБЫЧНЫЙ', color: 'text-sky-500', bg: 'bg-sky-500/10' },
  low: { label: 'НИЗКИЙ', color: 'text-slate-400', bg: 'bg-slate-500/10' }
};

const STATUS_META: Record<TaskStatus, { label: string; color: string; step: number }> = {
  in_progress: { label: 'В процессе', color: 'text-sky-400', step: 1 },
  blocked: { label: 'Заблокировано', color: 'text-rose-500', step: 2 },
  waiting_external: { label: 'Ожидание (Вне)', color: 'text-amber-400', step: 3 },
  review: { label: 'На проверке', color: 'text-indigo-400', step: 4 },
  completed: { label: 'Завершено', color: 'text-emerald-500', step: 5 }
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
  const PlusIcon = ICONS.Plus || 'span';

  return (
    <div className={`glass-card rounded-3xl border transition-all duration-300 overflow-hidden ${isDirective ? 'border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.05)] ring-1 ring-amber-500/10' : 'border-slate-800'} ${isCompleted ? 'opacity-50 grayscale' : 'hover:border-slate-700'}`}>
       <div className="p-6 flex flex-col md:flex-row justify-between gap-6">
          <div className="flex-1 space-y-3">
             <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded text-[8px] font-black tracking-widest ${prio.bg} ${prio.color}`}>{prio.label}</span>
                {isDirective && (
                  <span className="text-[8px] bg-amber-500/10 text-amber-500 border border-amber-500/30 px-2 py-0.5 rounded font-black uppercase flex items-center gap-1">
                    <CrownIcon size={10}/> DIRECTIVE
                  </span>
                )}
                {isRecurring && (
                  <span className="text-[8px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded font-black uppercase flex items-center gap-1">
                    <RotateIcon size={10}/> {task.recurrenceCycle?.toUpperCase()}
                  </span>
                )}
                <span className="text-[8px] bg-slate-900 text-sky-400 px-2 py-0.5 rounded border border-slate-800 font-black uppercase">👤 {task.assignedTo}</span>
                {task.dueDate && <span className="text-[8px] text-slate-500 font-mono font-bold uppercase ml-auto">Due: {task.dueDate}</span>}
             </div>

             <h3 className="text-base font-bold font-outfit text-white tracking-tight">{task.title}</h3>
             
             {isRecurring && task.lastCompletedAt && (
                <p className="text-[8px] text-emerald-500/70 font-mono font-bold uppercase tracking-widest">
                   Last Reset: {new Date(task.lastCompletedAt).toLocaleString()}
                </p>
             )}

             <div className="pt-2 flex items-center gap-3">
                <div className="flex-1 h-[2px] bg-slate-900 rounded-full flex overflow-hidden">
                   {[1,2,3,4,5].map(step => (
                     <div key={step} className={`flex-1 ${step <= (stat.step || 1) ? 'bg-indigo-500' : 'bg-transparent'}`}></div>
                   ))}
                </div>
                <span className={`text-[8px] font-black uppercase tracking-widest ${stat.color}`}>{stat.label}</span>
             </div>
          </div>

          <div className="flex flex-col items-end gap-3 shrink-0">
             <div className="flex gap-2">
                 {!isCompleted && !isRecurring && (
                     <button onClick={() => onComplete(task.id)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-4 py-2 rounded-xl text-[9px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">
                        Complete
                     </button>
                 )}
                 {isRecurring && (
                     <button onClick={() => onComplete(task.id, true)} className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-4 py-2 rounded-xl text-[9px] uppercase tracking-widest shadow-lg shadow-indigo-600/20 active:scale-95 transition-all">
                        Reset Cycle
                     </button>
                 )}
                 <button onClick={() => onToggle(task.id)} className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${isEx ? 'bg-sky-600 text-white' : 'bg-slate-900 text-slate-600'}`}>
                    <PlusIcon size={14} className={isEx ? 'rotate-45' : ''}/>
                 </button>
             </div>
             <select className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[8px] font-black text-slate-500 uppercase outline-none" value={task.status} onChange={(e) => onUpdateStatus(task.id, e.target.value as any)}>
                {Object.entries(STATUS_META).map(([val, m]) => <option key={val} value={val}>{m.label}</option>)}
             </select>
          </div>
       </div>

       {isEx && (
          <div className="bg-slate-950/40 border-t border-slate-900/50 p-6 space-y-6 animate-in slide-in-from-top-2">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                   <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Main Objective</label>
                   <p className="text-[11px] text-slate-300 leading-relaxed bg-slate-900/40 p-3 rounded-xl border border-slate-800/30">
                      {task.strategyData?.goal || 'No description provided.'}
                   </p>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Operational Protocol</label>
                    <button onClick={() => setShowNote(!showNote)} className="text-[8px] font-bold text-sky-400">Add Log</button>
                  </div>
                  <div className="space-y-1 max-h-[100px] overflow-y-auto pr-1">
                     {(!task.notes || task.notes.length === 0) ? <p className="text-[10px] text-slate-700 italic">No notes captured.</p> : task.notes.map(n => (
                        <div key={n.id} className="p-2 bg-slate-950/50 rounded-lg border border-slate-900 text-[10px] flex justify-between gap-4">
                           <span className="text-slate-300 flex-1">{n.text}</span>
                           <span className="text-slate-600 uppercase font-black text-[7px] shrink-0">{n.author}</span>
                        </div>
                     ))}
                  </div>
                </div>
             </div>

             {showNote && (
                <div className="bg-slate-900 p-4 rounded-2xl border border-sky-500/20 space-y-3">
                   <textarea className="w-full bg-transparent border-none outline-none text-[10px] text-white min-h-[50px]" placeholder="Brief status update..." value={noteVal} onChange={e => setNoteVal(e.target.value)} autoFocus />
                   <div className="flex justify-end gap-2">
                      <button onClick={() => { setNoteVal(''); setShowNote(false); }} className="text-[8px] text-slate-500 uppercase font-bold">Cancel</button>
                      <button onClick={() => { addNote(task.id, noteVal); setNoteVal(''); setShowNote(false); }} className="bg-sky-600 px-4 py-1 rounded-lg text-[9px] font-black text-white uppercase">Submit Log</button>
                   </div>
                </div>
             )}

             <div className="pt-4 border-t border-slate-900/50">
                <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest block mb-2">Audit History</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                   {(task.auditLog || []).slice(-4).map(log => (
                      <div key={log.id} className="text-[7px] text-slate-500 uppercase tracking-tighter bg-slate-950/30 p-2 rounded-lg border border-slate-900">
                         {new Date(log.timestamp).toLocaleDateString()} • {log.action}
                      </div>
                   ))}
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
    directive: "Нет активных директив. Стратегический контроль стабилен.",
    regular: "Все задачи выполнены. Команда сфокусирована.",
    recurring: "Регламент пока не задан. Система гибкая."
  };

  return (
    <div className="space-y-8 pb-20 max-w-7xl mx-auto animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/20 text-[9px] font-black text-sky-400 uppercase tracking-widest">Operation HQ</div>
          </div>
          <h1 className="text-4xl font-black font-outfit text-white tracking-tight">Execution Hub</h1>
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
                <div className={`absolute -bottom-[17px] left-0 right-0 h-0.5 bg-${mode.color}-500 shadow-[0_0_10px_rgba(var(--tw-color-${mode.color}-500),0.8)] rounded-full animate-in fade-in slide-in-from-bottom-1`} />
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

      <div className="space-y-4">
        {allTasks.length === 0 ? (
          <div className="p-32 text-center border-2 border-dashed border-slate-900 rounded-[40px] text-slate-600 font-bold uppercase tracking-[0.2em] text-[10px] animate-in fade-in duration-500">
            {emptyMessages[activeMode]}
          </div>
        ) : allTasks.map(t => (
          <TaskCard 
            key={t.id} 
            task={t} 
            isEx={expanded.has(t.id)} 
            onToggle={id => { const n = new Set(expanded); if(n.has(id)) n.delete(id); else n.add(id); setExpanded(n); }} 
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
