
import React, { useState, useMemo } from 'react';
import { AppState, OwnerTask, TaskPriority, TaskStatus, TaskNote, TaskType, TaskAssignee, TaskAuditEntry } from '../types';
import { ICONS } from '../constants';

// --- ПОМОЩНИКИ ---

const PRIORITY_META: Record<TaskPriority, { label: string; color: string; bg: string }> = {
  urgent: { label: 'КРИТИЧЕСКИ', color: 'text-rose-500', bg: 'bg-rose-500/10' },
  high: { label: 'ВЫСОКИЙ', color: 'text-amber-500', bg: 'bg-amber-500/10' },
  medium: { label: 'СРЕДНИЙ', color: 'text-sky-500', bg: 'bg-sky-500/10' },
  low: { label: 'НИЗКИЙ', color: 'text-slate-400', bg: 'bg-slate-500/10' }
};

const STATUS_META: Record<TaskStatus, { label: string; color: string; step: number; icon: any }> = {
  idea: { label: 'Идея', color: 'text-indigo-400', step: 1, icon: ICONS.Reports },
  in_progress: { label: 'В процессе', color: 'text-sky-400', step: 2, icon: ICONS.RotateCcw },
  review: { label: 'На проверке', color: 'text-amber-400', step: 4, icon: ICONS.Calendar },
  completed: { label: 'Выполнено', color: 'text-emerald-500', step: 5, icon: ICONS.Plus },
  blocked: { label: 'Заблокировано', color: 'text-rose-500', step: 3, icon: ICONS.Lock },
  waiting_external: { label: 'Ожидание', color: 'text-slate-400', step: 3, icon: ICONS.Calendar }
};

const ASSIGNEE_LABELS: Record<TaskAssignee, string> = {
  Andrey: 'Андрей', Anton: 'Антон', Rector: 'Admin Rector', Mentor: 'Admin Mentor', 
  Owners: 'Владельцы (Общее)', Admins: 'Админы (Общие)', All: 'Весь состав'
};

// --- КАРТОЧКА ЗАДАЧИ ---

const TaskCard: React.FC<{ 
  task: OwnerTask; 
  isEx: boolean; 
  currentRole: string;
  onToggle: (id: string) => void;
  onUpdateStatus: (id: string, s: TaskStatus) => void;
  addNote: (id: string, text: string) => void;
}> = ({ task, isEx, currentRole, onToggle, onUpdateStatus, addNote }) => {
  const [noteVal, setNoteVal] = useState('');
  const [showNote, setShowNote] = useState(false);

  const prio = PRIORITY_META[task.priority] || PRIORITY_META.medium;
  const stat = STATUS_META[task.status] || STATUS_META.in_progress;
  const isDirective = task.taskType === 'directive';
  const isCompleted = task.status === 'completed';

  return (
    <div className={`glass-card rounded-[2.5rem] border transition-all duration-500 overflow-hidden ${isDirective ? 'border-amber-500/30 shadow-[0_0_60px_rgba(245,158,11,0.04)]' : 'border-slate-800/40'} ${isCompleted ? 'opacity-30 grayscale' : 'hover:border-slate-700/80'}`}>
       <div className="p-10 flex flex-col md:flex-row justify-between gap-10">
          <div className="flex-1 space-y-6">
             <div className="flex items-center gap-3 flex-wrap">
                <span className={`px-2.5 py-0.5 rounded-[4px] text-[8px] font-black tracking-[0.15em] ${prio.bg} ${prio.color}`}>{prio.label}</span>
                {isDirective && (
                  <span className="text-[8px] bg-amber-500 text-slate-950 px-2.5 py-0.5 rounded-[4px] font-black uppercase flex items-center gap-1.5 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                    <ICONS.Crown size={10}/> ДИРЕКТИВА
                  </span>
                )}
                <span className="text-[8px] text-slate-500 border border-slate-800/60 px-2.5 py-0.5 rounded-[4px] font-black uppercase tracking-widest">👤 {ASSIGNEE_LABELS[task.assignedTo]}</span>
             </div>

             <h3 className="text-2xl font-bold font-outfit text-white tracking-tight leading-tight">{task.title}</h3>
             
             <div className="flex items-center gap-5 pt-2">
                <div className="flex-1 h-[2px] bg-slate-900/60 rounded-full flex overflow-hidden">
                   {[1,2,3,4,5].map(step => (
                     <div key={step} className={`flex-1 transition-all duration-1000 ${step <= stat.step ? 'bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.4)]' : 'bg-transparent'}`}></div>
                   ))}
                </div>
                <div className="flex items-center gap-2.5">
                   <stat.icon size={12} className={stat.color} />
                   <span className={`text-[10px] font-black uppercase tracking-[0.25em] ${stat.color}`}>{stat.label}</span>
                </div>
             </div>
          </div>

          <div className="flex flex-col items-end justify-between gap-8 shrink-0">
             <div className="flex items-center gap-3">
                 <div className="flex gap-1.5">
                    {['idea', 'in_progress', 'review', 'completed'].map(s => (
                      <button 
                         key={s} 
                         onClick={() => onUpdateStatus(task.id, s as any)}
                         className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${task.status === s ? 'bg-sky-600 border-sky-500 text-white shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'}`}
                      >
                         {STATUS_META[s as TaskStatus].label}
                      </button>
                    ))}
                 </div>
                 <button onClick={() => onToggle(task.id)} className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all border opacity-20 hover:opacity-100 ${isEx ? 'bg-slate-800 text-white' : 'bg-slate-950 border-slate-900'}`}>
                    <ICONS.Plus size={16} className={isEx ? 'rotate-45' : ''} />
                 </button>
             </div>
             <p className="text-[10px] text-slate-500 italic truncate max-w-[200px]">
               {task.notes.length > 0 ? `Последняя запись: ${task.notes[task.notes.length-1].text}` : 'Нет операционных записей'}
             </p>
          </div>
       </div>

       {isEx && (
          <div className="bg-slate-950/60 border-t border-slate-900/50 p-12 space-y-12 animate-in slide-in-from-top-4 duration-500">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                <div className="space-y-5">
                   <label className="text-[11px] font-black text-slate-700 uppercase tracking-[0.4em] block">Контекст выполнения</label>
                   <div className="text-[14px] text-slate-300 leading-relaxed font-medium bg-slate-900/20 p-8 rounded-[2.5rem] border border-slate-800/30">
                      {task.description || 'Описание отсутствует.'}
                      <div className="mt-4 pt-4 border-t border-slate-800/50">
                         <span className="text-amber-500 text-[10px] font-bold uppercase">Основная цель: {task.strategyData?.goal || 'Не задана'}</span>
                      </div>
                   </div>
                </div>
                
                <div className="space-y-6">
                  <div className="flex justify-between items-center border-b border-slate-900/50 pb-4">
                    <label className="text-[11px] font-black text-slate-700 uppercase tracking-[0.4em]">Журнал протокола</label>
                    <button onClick={() => setShowNote(!showNote)} className="text-[10px] font-black text-sky-500 hover:text-sky-400 flex items-center gap-2">
                      <ICONS.Plus size={12} /> ДОБАВИТЬ ЗАПИСЬ
                    </button>
                  </div>
                  <div className="space-y-3.5 max-h-[220px] overflow-y-auto pr-4 custom-scrollbar">
                     {task.notes.map(n => (
                        <div key={n.id} className="p-5 bg-slate-900/20 rounded-3xl border border-slate-800/20 flex justify-between gap-6">
                           <span className="text-[12px] text-slate-400 flex-1 leading-relaxed">{n.text}</span>
                           <span className="text-slate-700 uppercase font-black text-[9px] self-end">{n.author}</span>
                        </div>
                     ))}
                  </div>
                </div>
             </div>

             {showNote && (
                <div className="bg-slate-900/40 p-10 rounded-[3rem] border border-sky-500/10 space-y-6 animate-in zoom-in-95">
                   <textarea className="w-full bg-transparent border-none outline-none text-sm text-white min-h-[100px] placeholder:text-slate-800 font-medium" placeholder="Обновите прогресс..." value={noteVal} onChange={e => setNoteVal(e.target.value)} autoFocus />
                   <div className="flex justify-end gap-5">
                      <button onClick={() => { setNoteVal(''); setShowNote(false); }} className="text-[11px] text-slate-600 uppercase font-black">Отмена</button>
                      <button onClick={() => { addNote(task.id, noteVal); setNoteVal(''); setShowNote(false); }} className="bg-sky-600 px-10 py-3 rounded-2xl text-[11px] font-black text-white uppercase tracking-widest shadow-xl">Сохранить</button>
                   </div>
                </div>
             )}
          </div>
       )}
    </div>
  );
};

// --- ОСНОВНОЙ ЭКРАН ADMIN TABLE ---

const AdminTable: React.FC<{ state: AppState; updateState: (updater: (prev: AppState) => AppState) => void }> = ({ state, updateState }) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [currentAdminRole, setCurrentAdminRole] = useState<'Mentor' | 'Rector' | 'Admins'>('Mentor');
  const [activeMode, setActiveMode] = useState<TaskType>('regular');
  const [secondaryFilter, setSecondaryFilter] = useState<'all' | 'critical' | 'process' | 'review'>('all');

  // Форма создания/делегирования
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTo, setNewTo] = useState<TaskAssignee>('Mentor');
  const [newPrio, setNewPrio] = useState<TaskPriority>('medium');

  const logAudit = (action: string, actor: string): TaskAuditEntry => ({
    id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    action, actor, timestamp: new Date().toISOString()
  });

  const updateStatus = (id: string, status: TaskStatus) => {
    updateState(p => ({
      ...p,
      ownerTasks: (p.ownerTasks || []).map(t => t.id === id ? { 
        ...t, status, 
        auditLog: [...(t.auditLog || []), logAudit(`Статус изменен на ${status}`, currentAdminRole)], 
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
        auditLog: [...(t.auditLog || []), logAudit('Добавлена запись в протокол', currentAdminRole)],
        updatedAt: new Date().toISOString() 
      } : t)
    }));
  };

  const createAdminTask = () => {
    if (!newTitle.trim()) return;
    const task: OwnerTask = {
        id: `admin-task-${Date.now()}`,
        title: newTitle, description: 'Инициировано из панели администратора', status: 'idea',
        priority: newPrio, taskType: 'regular', assignedTo: newTo,
        tags: [], notes: [], auditLog: [logAudit('Задача создана админом', currentAdminRole)],
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        periodId: state.selectedPeriodId
    };
    updateState(prev => ({ ...prev, ownerTasks: [task, ...(prev.ownerTasks || [])] }));
    setNewTitle(''); setIsCreating(false);
  };

  const allTasks = useMemo(() => {
    let list = (state.ownerTasks || []).map(t => {
      if (!t.taskType) t.taskType = t.id.startsWith('admin-task') ? 'regular' : 'directive';
      return t;
    });

    // Логика видимости для админов
    if (currentAdminRole === 'Mentor') {
      list = list.filter(t => t.assignedTo === 'Mentor' || t.assignedTo === 'Admins' || t.assignedTo === 'All');
    } else if (currentAdminRole === 'Rector') {
      list = list.filter(t => t.assignedTo === 'Rector' || t.assignedTo === 'Admins' || t.assignedTo === 'All');
    } else if (currentAdminRole === 'Admins') {
      list = list.filter(t => t.assignedTo === 'Admins' || t.assignedTo === 'All');
    }

    list = list.filter(t => t.taskType === activeMode);

    if (secondaryFilter === 'critical') list = list.filter(t => t.priority === 'urgent' || t.priority === 'high');
    if (secondaryFilter === 'process') list = list.filter(t => t.status === 'in_progress');
    if (secondaryFilter === 'review') list = list.filter(t => t.status === 'review');

    return list;
  }, [state.ownerTasks, currentAdminRole, activeMode, secondaryFilter]);

  return (
    <div className="space-y-16 pb-32 max-w-7xl mx-auto animate-in fade-in duration-1000">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-slate-900/50 pb-16">
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <div className="w-2.5 h-2.5 rounded-full bg-sky-500 shadow-[0_0_15px_rgba(14,165,233,0.7)] animate-pulse"></div>
            <span className="text-[12px] font-black text-sky-500 uppercase tracking-[0.6em]">Узел администрирования</span>
          </div>
          <h1 className="text-5xl font-black font-outfit text-white tracking-tighter">ЦЕНТР АДМИНОВ</h1>
        </div>
        
        <div className="flex flex-col items-end gap-4">
          <div className="flex gap-2">
            {['Rector', 'Mentor', 'Admins'].map(role => (
              <button key={role} onClick={() => { setCurrentAdminRole(role as any); setNewTo(role as any); }} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${currentAdminRole === role ? 'bg-sky-600 text-white shadow-lg' : 'bg-slate-900 text-slate-500'}`}>
                {ASSIGNEE_LABELS[role as TaskAssignee]}
              </button>
            ))}
          </div>
          {activeMode === 'regular' && (
            <button onClick={() => setIsCreating(!isCreating)} className="flex items-center gap-2 text-sky-500 font-black text-[10px] uppercase tracking-widest hover:text-white transition-all">
               <ICONS.Plus size={14} className={isCreating ? 'rotate-45' : ''}/> {isCreating ? 'Закрыть форму' : 'Создать задачу / Делегировать'}
            </button>
          )}
        </div>
      </header>

      {isCreating && activeMode === 'regular' && (
        <div className="glass-card p-10 rounded-[3rem] border-sky-500/20 bg-sky-500/5 space-y-8 animate-in slide-in-from-top-4">
           <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-2">
                 <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Название задачи</label>
                 <input className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-sky-500/50" placeholder="Что нужно сделать?.." value={newTitle} onChange={e => setNewTitle(e.target.value)} />
              </div>
              <div>
                 <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Кому назначить</label>
                 <select className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-4 text-xs text-white font-bold outline-none" value={newTo} onChange={e => setNewTo(e.target.value as any)}>
                    <optgroup label="Админы">
                       <option value="Rector">Себе (Rector)</option>
                       <option value="Mentor">Себе (Mentor)</option>
                       <option value="Admins">Админы (Общие)</option>
                    </optgroup>
                    <optgroup label="Владельцы">
                       <option value="Andrey">Андрею</option>
                       <option value="Anton">Антону</option>
                       <option value="Owners">Владельцам (Общее)</option>
                    </optgroup>
                    <option value="All">Весь состав</option>
                 </select>
              </div>
              <div>
                 <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Приоритет</label>
                 <select className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-4 text-xs text-white font-bold outline-none" value={newPrio} onChange={e => setNewPrio(e.target.value as any)}>
                    {Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                 </select>
              </div>
           </div>
           <button onClick={createAdminTask} className="w-full bg-sky-600 hover:bg-sky-500 text-white font-black py-5 rounded-2xl shadow-xl shadow-sky-600/20 transition-all uppercase tracking-widest text-xs">Подтвердить и опубликовать</button>
        </div>
      )}

      <div className="space-y-12">
        <div className="flex gap-16 items-center px-6 border-b border-slate-900/30">
          {[
            { id: 'directive', label: 'ДИРЕКТИВЫ' },
            { id: 'regular', label: 'ЗАДАЧИ' },
            { id: 'recurring', label: 'РЕГЛАМЕНТ' }
          ].map((mode) => (
            <button key={mode.id} onClick={() => { setActiveMode(mode.id as any); setSecondaryFilter('all'); }} className={`group relative py-7 text-[13px] font-black uppercase tracking-[0.55em] transition-all duration-500 ${activeMode === mode.id ? `text-sky-400` : 'text-slate-600 hover:text-slate-400'}`}>
              {mode.label}
              {activeMode === mode.id && <div className={`absolute -bottom-0.5 left-0 right-0 h-[5px] bg-sky-500 shadow-[0_0_30px_rgba(14,165,233,1)] rounded-full`} />}
            </button>
          ))}
        </div>
        <div className="flex gap-12 px-10 items-center overflow-x-auto no-scrollbar">
           {[
             { id: 'all', label: 'ВСЕ' },
             { id: 'critical', label: 'КРИТИЧЕСКИЕ' },
             { id: 'process', label: 'В ПРОЦЕССЕ' },
             { id: 'review', label: 'НА ПРОВЕРКЕ' }
           ].map(f => (
             <button key={f.id} onClick={() => setSecondaryFilter(f.id as any)} className={`group relative flex items-center gap-3.5 text-[11px] font-black uppercase tracking-[0.2em] transition-all ${secondaryFilter === f.id ? 'text-white' : 'text-slate-700 hover:text-slate-500'}`}>
               {f.label}
               {secondaryFilter === f.id && <div className={`absolute bottom-[-14px] left-0 right-0 h-[3px] bg-sky-500`} />}
             </button>
           ))}
        </div>
      </div>

      <div className="space-y-8 px-2 pb-40">
        {allTasks.length === 0 ? (
          <div className="py-60 text-center flex flex-col items-center gap-10">
             <div className="w-28 h-28 rounded-[3.5rem] bg-slate-900/20 border border-slate-800/40 flex items-center justify-center text-slate-800"><ICONS.Dashboard size={48} className="opacity-30" /></div>
             <p className="max-w-md text-base font-bold text-slate-700 leading-relaxed tracking-[0.3em] uppercase text-[12px]">В данном секторе задачи отсутствуют.</p>
          </div>
        ) : allTasks.map(t => (
          <TaskCard 
            key={t.id} 
            task={t} 
            currentRole={currentAdminRole}
            isEx={expanded.has(t.id)} 
            onToggle={id => { const n = new Set(expanded); if(n.has(id)) n.delete(id); else n.add(id); setExpanded(n); }} 
            onUpdateStatus={updateStatus} 
            addNote={addNote} 
          />
        ))}
      </div>
    </div>
  );
};

export default AdminTable;
