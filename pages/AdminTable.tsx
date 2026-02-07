import React, { useState, useMemo } from 'react';
import { AppState, OwnerTask, TaskPriority, TaskStatus, TaskAssignee, TaskNote, OwnerTag } from '../types';
import { ICONS } from '../constants';

// --- ВСПОМОГАТЕЛЬНЫЕ КОМПОНЕНТЫ ---

function StrategyInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void, placeholder?: string }) {
  return (
    <div className="space-y-1">
      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">{label}</label>
      <input 
        type="text" 
        className="w-full bg-slate-950 border border-slate-800/50 rounded-xl px-4 py-2.5 text-[11px] text-white outline-none focus:border-sky-500/50 transition-all placeholder:text-slate-700" 
        placeholder={placeholder}
        value={value} 
        onChange={e => onChange(e.target.value)} 
      />
    </div>
  );
}

function StrategyBlock({ label, text, color }: { label: string; text: string; color: string }) {
  if (!text) return null;
  return (
    <div className="space-y-1.5 p-3 rounded-2xl bg-slate-900/30 border border-slate-800/50">
      <label className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">{label}</label>
      <div className={`text-[11px] leading-relaxed font-medium ${color}`}>{text}</div>
    </div>
  );
}

function SectionHeader({ title, icon, color }: { title: string, icon: React.ReactNode, color: string }) {
  return (
    <div className={`flex items-center gap-3 py-4 border-b border-slate-900 mb-4`}>
       <div className={`w-10 h-10 rounded-2xl flex items-center justify-center bg-${color}-500/10 text-${color}-400 border border-${color}-500/20`}>
          {icon}
       </div>
       <h2 className="text-lg font-black font-outfit text-white uppercase tracking-tight">{title}</h2>
    </div>
  );
}

// Moved metadata outside component to be accessible by TaskCard
const PRIORITY_META: Record<TaskPriority, { label: string; color: string; bg: string }> = {
  urgent: { label: 'СРОЧНО', color: 'text-rose-500', bg: 'bg-rose-500/10' },
  high: { label: 'ВЫСОКИЙ', color: 'text-amber-500', bg: 'bg-amber-500/10' },
  medium: { label: 'ОБЫЧНЫЙ', color: 'text-sky-500', bg: 'bg-sky-500/10' },
  low: { label: 'НИЗКИЙ', color: 'text-slate-400', bg: 'bg-slate-500/10' }
};

const STATUS_META: Record<TaskStatus, { label: string; color: string; step: number }> = {
  idea: { label: 'Идея', color: 'text-slate-500', step: 1 },
  planned: { label: 'В планах', color: 'text-indigo-400', step: 2 },
  in_progress: { label: 'В работе', color: 'text-sky-400', step: 3 },
  waiting: { label: 'Ожидание', color: 'text-amber-400', step: 4 },
  completed: { label: 'Готово', color: 'text-emerald-500', step: 5 }
};

const ASSIGNEE_LABELS: Record<string, string> = {
  Rector: 'Rector',
  Mentor: 'Mentor',
  Admins: 'Оба админа'
};

// TaskCard moved outside to fix key prop typing errors and avoid remounts on parent render
const TaskCard = ({ 
  task, 
  isExpanded, 
  toggleExpansion, 
  setCompletingTaskId, 
  startEditing, 
  updateTaskStatus, 
  deleteTask,
  activeNoteInput,
  setActiveNoteInput,
  noteText,
  setNoteText,
  noteAuthor,
  setNoteAuthor,
  addNote
}: { 
  task: OwnerTask;
  isExpanded: boolean;
  toggleExpansion: (id: string) => void;
  setCompletingTaskId: (id: string) => void;
  startEditing: (task: OwnerTask) => void;
  updateTaskStatus: (id: string, status: TaskStatus) => void;
  deleteTask: (id: string) => void;
  activeNoteInput: string | null;
  setActiveNoteInput: (id: string | null) => void;
  noteText: string;
  setNoteText: (text: string) => void;
  noteAuthor: 'Rector' | 'Mentor';
  setNoteAuthor: (author: 'Rector' | 'Mentor') => void;
  addNote: (taskId: string) => void;
}) => {
  const prio = PRIORITY_META[task.priority];
  const stat = STATUS_META[task.status];
  const isCompleted = task.status === 'completed';
  const isDirective = !task.id.startsWith('admin-task');
  const isRoutine = task.isRoutine;

  return (
    <div className={`glass-card rounded-3xl border transition-all duration-300 overflow-hidden ${isCompleted ? 'opacity-40 grayscale' : 'border-slate-800 hover:border-sky-500/30'}`}>
       <div className="p-6 flex flex-col md:flex-row justify-between gap-6">
          <div className="flex-1 space-y-3">
             <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded text-[8px] font-black tracking-widest ${prio.bg} ${prio.color}`}>{prio.label}</span>
                {isDirective && !isRoutine && (
                  <span className="text-[8px] bg-amber-500/10 text-amber-500 border border-amber-500/30 px-2 py-0.5 rounded font-black uppercase flex items-center gap-1">
                    <ICONS.Crown size={10}/> DIRECTIVE
                  </span>
                )}
                {isRoutine && (
                  <span className="text-[8px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded font-black uppercase flex items-center gap-1">
                    <ICONS.RotateCcw size={10}/> РЕГЛАМЕНТ
                  </span>
                )}
                <span className="text-[8px] bg-slate-900 text-sky-400 px-2 py-0.5 rounded border border-slate-800 font-black uppercase">👤 {ASSIGNEE_LABELS[task.assignedTo] || task.assignedTo}</span>
                {task.dueDate && <span className="text-[8px] text-slate-500 font-mono font-bold uppercase ml-auto">До: {task.dueDate}</span>}
             </div>

             <div className="space-y-1">
                <h3 className="text-base font-bold font-outfit text-white tracking-tight">{task.title}</h3>
                {task.description && <p className="text-[10px] text-slate-400 leading-relaxed line-clamp-2">{task.description}</p>}
             </div>

             <div className="pt-2 flex items-center gap-3">
                <div className="flex-1 h-[2px] bg-slate-900 rounded-full flex overflow-hidden">
                   {[1,2,3,4,5].map(step => (
                     <div key={step} className={`flex-1 ${step <= stat.step ? 'bg-sky-500' : 'bg-transparent'}`}></div>
                   ))}
                </div>
                <span className={`text-[8px] font-black uppercase tracking-widest ${stat.color}`}>{stat.label}</span>
             </div>
          </div>

          <div className="flex flex-col items-end gap-3 shrink-0">
             <div className="flex gap-2">
                 {!isCompleted && (
                     <button onClick={() => setCompletingTaskId(task.id)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-4 py-2 rounded-xl text-[9px] uppercase tracking-widest active:scale-95 shadow-lg shadow-emerald-500/20">
                        Завершить
                     </button>
                 )}
                 {!isDirective && (
                     <button onClick={() => startEditing(task)} className="w-8 h-8 rounded-xl flex items-center justify-center bg-slate-900 border border-slate-800 text-slate-500 hover:text-white transition-all">
                        <ICONS.Edit size={14} />
                     </button>
                 )}
                 <button onClick={() => toggleExpansion(task.id)} className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${isExpanded ? 'bg-sky-600 text-white' : 'bg-slate-900 text-slate-600 border border-slate-800'}`}>
                    <ICONS.Plus size={14} className={isExpanded ? 'rotate-45' : ''}/>
                 </button>
             </div>
             <select className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[8px] font-black text-slate-500 uppercase outline-none" value={task.status} onChange={(e) => updateTaskStatus(task.id, e.target.value as any)}>
                <option value="planned">В планах</option>
                <option value="in_progress">В работе</option>
                <option value="waiting">Ожидание</option>
                <option value="completed">Готово</option>
             </select>
             {!isDirective && <button onClick={() => deleteTask(task.id)} className="text-[8px] font-bold text-slate-700 hover:text-rose-500 uppercase">Удалить</button>}
          </div>
       </div>

       {isExpanded && (
          <div className="bg-slate-950/40 border-t border-slate-900/50 p-6 space-y-6 animate-in slide-in-from-top-2">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StrategyBlock label="ЦЕЛЬ" text={task.strategyData?.goal || ''} color="text-sky-400" />
                <StrategyBlock label="ОСНОВАНИЕ" text={task.strategyData?.reason || ''} color="text-indigo-400" />
                <StrategyBlock label="ЭФФЕКТ" text={task.strategyData?.effect || ''} color="text-emerald-400" />
             </div>

             {task.adminReport && (
                <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 space-y-2">
                   <p className="text-[8px] font-black text-emerald-500 uppercase">Финальный отчет</p>
                   <p className="text-[10px] text-slate-200">{task.adminReport.text}</p>
                   <div className="flex gap-2 pt-1">
                      {task.adminReport.links.map((l, i) => <a key={i} href={l} target="_blank" className="text-[8px] bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded border border-emerald-500/20">Link #{i+1}</a>)}
                   </div>
                </div>
             )}

             <div className="space-y-3">
                <div className="flex justify-between items-center border-b border-slate-900 pb-1.5">
                   <h4 className="text-[9px] font-black text-slate-600 uppercase">Протокол логов</h4>
                   <button onClick={() => setActiveNoteInput(task.id)} className="text-[8px] font-bold text-sky-400">Добавить запись</button>
                </div>
                {task.notes.map(n => (
                  <div key={n.id} className="text-[10px] space-y-1">
                     <div className="flex items-center gap-2 opacity-50">
                        <span className="font-black uppercase text-sky-400">{n.author}</span>
                        <span className="text-[8px] font-mono">{new Date(n.createdAt).toLocaleString()}</span>
                     </div>
                     <p className="text-slate-300 bg-slate-900/40 p-2 rounded-xl border border-slate-800/30">{n.text}</p>
                  </div>
                ))}
                {activeNoteInput === task.id && (
                   <div className="bg-slate-900 p-4 rounded-2xl border border-sky-500/20 space-y-3">
                      <textarea className="w-full bg-transparent border-none outline-none text-[10px] text-white" placeholder="Зафиксируйте прогресс..." value={noteText} onChange={e => setNoteText(e.target.value)} autoFocus />
                      <div className="flex justify-between items-center pt-2">
                         <div className="flex gap-1">
                            {['Rector', 'Mentor'].map(a => <button key={a} onClick={() => setNoteAuthor(a as any)} className={`w-6 h-6 rounded-lg text-[8px] font-black ${noteAuthor === a ? 'bg-sky-500 text-slate-950' : 'bg-slate-950 text-slate-600 border border-slate-800'}`}>{a[0]}</button>)}
                         </div>
                         <button onClick={() => addNote(task.id)} className="bg-sky-600 px-4 py-1 rounded-lg text-[9px] font-black text-white uppercase">Записать</button>
                      </div>
                   </div>
                )}
             </div>
          </div>
       )}
    </div>
  );
};

// --- ОСНОВНОЙ КОМПОНЕНТ ---

interface AdminTableProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const AdminTable: React.FC<AdminTableProps> = ({ state, updateState }) => {
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [reportText, setReportText] = useState('');
  const [reportLinks, setReportLinks] = useState('');

  const [editingTask, setEditingTask] = useState<OwnerTask | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('medium');
  const [newTaskAssigned, setNewTaskAssigned] = useState<TaskAssignee>('Admins');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');

  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [activeNoteInput, setActiveNoteInput] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [noteAuthor, setNoteAuthor] = useState<'Rector' | 'Mentor'>('Rector');

  const saveInternalTask = () => {
    if (!newTaskTitle.trim()) return;

    if (editingTask) {
        updateState(prev => ({
            ...prev,
            ownerTasks: (prev.ownerTasks || []).map(t => t.id === editingTask.id ? {
                ...t,
                title: newTaskTitle,
                description: newTaskDesc,
                priority: newTaskPriority,
                assignedTo: newTaskAssigned,
                dueDate: newTaskDueDate || undefined,
                updatedAt: new Date().toISOString()
            } : t)
        }));
        setEditingTask(null);
    } else {
        const task: OwnerTask = {
            id: `admin-task-${Date.now()}`,
            title: newTaskTitle,
            description: newTaskDesc,
            status: 'planned',
            priority: newTaskPriority,
            assignedTo: newTaskAssigned,
            isForAdmins: true,
            isRoutine: false,
            tags: [],
            notes: [],
            dueDate: newTaskDueDate || undefined,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            periodId: state.selectedPeriodId
        };
        updateState(prev => ({ ...prev, ownerTasks: [task, ...(prev.ownerTasks || [])] }));
    }
    setNewTaskTitle(''); setNewTaskDesc(''); setNewTaskDueDate('');
  };

  const startEditing = (task: OwnerTask) => {
    setEditingTask(task);
    setNewTaskTitle(task.title);
    setNewTaskDesc(task.description);
    setNewTaskPriority(task.priority);
    setNewTaskAssigned(task.assignedTo as any);
    setNewTaskDueDate(task.dueDate || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEditing = () => {
    setEditingTask(null);
    setNewTaskTitle(''); setNewTaskDesc(''); setNewTaskDueDate('');
  };

  const deleteTask = (id: string) => {
    if (!confirm('Удалить внутреннюю задачу?')) return;
    updateState(prev => ({
      ...prev,
      deletedIds: [...prev.deletedIds, id],
      ownerTasks: (prev.ownerTasks || []).filter(t => t.id !== id)
    }));
  };

  const addNote = (taskId: string) => {
    if (!noteText.trim()) return;
    const note: TaskNote = {
      id: String(Date.now()),
      text: noteText,
      author: noteAuthor as any,
      createdAt: new Date().toISOString()
    };
    updateState(prev => ({
      ...prev,
      ownerTasks: (prev.ownerTasks || []).map(t => t.id === taskId ? { ...t, notes: [...t.notes, note], updatedAt: new Date().toISOString() } : t)
    }));
    setNoteText('');
    setActiveNoteInput(null);
  };

  const submitReport = () => {
    if (!reportText.trim()) return alert('Напишите отчет.');
    const linksArray = reportLinks.split('\n').filter(l => l.trim().startsWith('http'));

    updateState(prev => ({
      ...prev,
      ownerTasks: (prev.ownerTasks || []).map(t => t.id === completingTaskId ? {
        ...t,
        status: 'completed',
        updatedAt: new Date().toISOString(),
        adminReport: { text: reportText, links: linksArray }
      } : t)
    }));
    setCompletingTaskId(null); setReportText(''); setReportLinks('');
  };

  const updateTaskStatus = (id: string, status: TaskStatus) => {
    updateState(prev => ({
      ...prev,
      ownerTasks: (prev.ownerTasks || []).map(t => t.id === id ? { ...t, status, updatedAt: new Date().toISOString() } : t)
    }));
  };

  const toggleExpansion = (id: string) => {
    const next = new Set(expandedTasks);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpandedTasks(next);
  };

  const allRelevantTasks = useMemo(() => {
    return (state.ownerTasks || []).filter(t => t.isForAdmins || ['Rector', 'Mentor', 'Admins'].includes(t.assignedTo));
  }, [state.ownerTasks]);

  // Группировка задач
  const taskGroups = useMemo(() => {
    return {
      directives: allRelevantTasks.filter(t => !t.id.startsWith('admin-task') && !t.isRoutine),
      routines: allRelevantTasks.filter(t => t.isRoutine),
      internal: allRelevantTasks.filter(t => t.id.startsWith('admin-task'))
    };
  }, [allRelevantTasks]);

  const stats = useMemo(() => {
    return {
      total: allRelevantTasks.length,
      directives: taskGroups.directives.filter(t => t.status !== 'completed').length,
      routines: taskGroups.routines.length,
      internal: taskGroups.internal.filter(t => t.status !== 'completed').length
    };
  }, [allRelevantTasks, taskGroups]);

  const GraduationIcon = ICONS.Internship || 'span';
  const RotateIcon = ICONS.RotateCcw || 'span';
  const CrownIcon = ICONS.Crown || 'span';
  const ClockIcon = ICONS.Calendar || 'span';

  // Helper function to render a list of TaskCards with all required props
  const renderTaskCards = (tasks: OwnerTask[]) => {
    return tasks.map(t => (
      <TaskCard 
        key={t.id} 
        task={t}
        isExpanded={expandedTasks.has(t.id)}
        toggleExpansion={toggleExpansion}
        setCompletingTaskId={setCompletingTaskId}
        startEditing={startEditing}
        updateTaskStatus={updateTaskStatus}
        deleteTask={deleteTask}
        activeNoteInput={activeNoteInput}
        setActiveNoteInput={setActiveNoteInput}
        noteText={noteText}
        setNoteText={setNoteText}
        noteAuthor={noteAuthor}
        setNoteAuthor={setNoteAuthor}
        addNote={addNote}
      />
    ));
  };

  return (
    <div className="space-y-8 pb-20 max-w-7xl mx-auto animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black font-outfit text-white tracking-tight">Admin Table</h1>
          <p className="text-slate-500 text-sm mt-1">Рабочий штаб операционного контроля</p>
        </div>
        <div className="flex gap-4">
           <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex items-center gap-6">
              <div className="text-center">
                 <p className="text-[8px] font-black uppercase text-amber-500">Директивы</p>
                 <p className="text-lg font-black text-white">{stats.directives}</p>
              </div>
              <div className="w-px h-6 bg-slate-800"></div>
              <div className="text-center">
                 <p className="text-[8px] font-black uppercase text-indigo-400">Регламент</p>
                 <p className="text-lg font-black text-white">{stats.routines}</p>
              </div>
              <div className="w-px h-6 bg-slate-800"></div>
              <div className="text-center">
                 <p className="text-[8px] font-black uppercase text-sky-400">Задачи</p>
                 <p className="text-lg font-black text-white">{stats.internal}</p>
              </div>
           </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* SIDEBAR FORM */}
        <div className="lg:col-span-4 space-y-6">
           <div className={`glass-card p-8 rounded-[32px] border shadow-xl space-y-5 bg-slate-900/20 transition-all ${editingTask ? 'border-sky-500/50 shadow-sky-500/10' : 'border-slate-800'}`}>
              <h2 className="text-lg font-black font-outfit text-white uppercase tracking-tight">{editingTask ? 'Редактор' : 'Новая задача'}</h2>
              <div className="space-y-4">
                 <input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3 text-white font-bold outline-none text-xs placeholder:text-slate-700" placeholder="Что нужно сделать?" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} />
                 <textarea className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3 text-white text-[10px] outline-none min-h-[60px]" placeholder="Детали..." value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)} />
                 <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                       <label className="text-[8px] font-black text-slate-600 uppercase">Срок</label>
                       <input type="date" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-[10px] text-sky-400 outline-none" value={newTaskDueDate} onChange={e => setNewTaskDueDate(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[8px] font-black text-slate-600 uppercase">Исполнитель</label>
                       <select className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-[10px] text-white outline-none font-bold" value={newTaskAssigned} onChange={e => setNewTaskAssigned(e.target.value as any)}>
                          <option value="Admins">Оба админа</option>
                          <option value="Rector">Rector</option>
                          <option value="Mentor">Mentor</option>
                       </select>
                    </div>
                 </div>
                 <button onClick={saveInternalTask} className="w-full bg-sky-600 hover:bg-sky-500 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest active:scale-95 shadow-xl shadow-sky-600/20">{editingTask ? 'Сохранить' : 'Создать задачу'}</button>
                 {editingTask && <button onClick={cancelEditing} className="w-full text-slate-500 text-[10px] uppercase font-bold">Отмена</button>}
              </div>
           </div>
        </div>

        {/* TASK BOARD */}
        <div className="lg:col-span-8 space-y-10">
           
           {/* SECTION 1: DIRECTIVES */}
           <section>
              <SectionHeader title="Штабные Директивы" icon={<CrownIcon size={20}/>} color="amber" />
              <div className="space-y-3">
                 {taskGroups.directives.length === 0 ? <p className="text-[10px] text-slate-700 py-10 text-center italic border border-dashed border-slate-900 rounded-3xl">Новых директив от владельцев нет</p> : renderTaskCards(taskGroups.directives)}
              </div>
           </section>

           {/* SECTION 2: ROUTINES */}
           <section>
              <SectionHeader title="Регламент / Постоянные" icon={<ClockIcon size={20}/>} color="indigo" />
              <div className="space-y-3">
                 {taskGroups.routines.length === 0 ? <p className="text-[10px] text-slate-700 py-10 text-center italic border border-dashed border-slate-900 rounded-3xl">Регламентные задачи не назначены</p> : renderTaskCards(taskGroups.routines)}
              </div>
           </section>

           {/* SECTION 3: INTERNAL */}
           <section>
              <SectionHeader title="Внутренние Задачи Админов" icon={<GraduationIcon size={20}/>} color="sky" />
              <div className="space-y-3">
                 {taskGroups.internal.length === 0 ? <p className="text-[10px] text-slate-700 py-10 text-center italic border border-dashed border-slate-900 rounded-3xl">Внутренний план пуст</p> : renderTaskCards(taskGroups.internal)}
              </div>
           </section>

        </div>
      </div>

      {completingTaskId && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in">
            <div className="glass-card w-full max-w-lg rounded-[2.5rem] p-10 border-sky-500/30">
               <h2 className="text-xl font-black text-white mb-6 uppercase">Отчет о выполнении</h2>
               <div className="space-y-5">
                  <textarea className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-white min-h-[120px] outline-none" placeholder="Что было сделано?" value={reportText} onChange={e => setReportText(e.target.value)} />
                  <textarea className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-[10px] font-mono text-sky-400 min-h-[80px] outline-none" placeholder="Ссылки на результат (каждая с новой строки)" value={reportLinks} onChange={e => setReportLinks(e.target.value)} />
                  <div className="flex gap-4 pt-4">
                     <button onClick={() => setCompletingTaskId(null)} className="flex-1 bg-slate-900 text-slate-500 font-bold py-3 rounded-xl uppercase text-[10px]">Отмена</button>
                     <button onClick={submitReport} className="flex-[2] bg-emerald-600 text-white font-black py-3 rounded-xl uppercase text-[10px] shadow-lg shadow-emerald-600/20">Отправить отчет</button>
                  </div>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};

export default AdminTable;
