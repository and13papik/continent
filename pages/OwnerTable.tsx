
import React, { useState, useMemo } from 'react';
import { AppState, OwnerTask, TaskPriority, TaskStatus, OwnerTag, TaskNote, TaskAssignee } from '../types';
import { ICONS } from '../constants';

// --- ВСПОМОГАТЕЛЬНЫЕ КОМПОНЕНТЫ ---

function StrategyInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void, placeholder?: string }) {
  return (
    <div className="space-y-1">
      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">{label}</label>
      <input 
        type="text" 
        className="w-full bg-slate-950 border border-slate-800/50 rounded-xl px-4 py-2.5 text-[11px] text-white outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-700" 
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

function StatWidget({ label, value, color, icon, overdue }: { label: string; value: number; color: string; icon: React.ReactNode, overdue?: boolean }) {
  const colorClasses: Record<string, string> = {
    rose: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    sky: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
    amber: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    indigo: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
  };

  return (
    <div className={`glass-card p-4 rounded-3xl border flex items-center gap-4 transition-all hover:translate-y-[-2px] ${overdue ? 'ring-1 ring-rose-500/50 shadow-lg shadow-rose-500/10' : ''} ${colorClasses[color] || 'border-slate-800'}`}>
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

// --- ОСНОВНОЙ КОМПОНЕНТ ---

interface OwnerTableProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const OwnerTable: React.FC<OwnerTableProps> = ({ state, updateState }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  
  const PRIORITY_META = useMemo<Record<TaskPriority, { label: string; color: string; bg: string }>>(() => ({
    urgent: { label: 'КРИТИЧЕСКИ', color: 'text-rose-500', bg: 'bg-rose-500/10' },
    high: { label: 'ВЫСОКИЙ', color: 'text-amber-500', bg: 'bg-amber-500/10' },
    medium: { label: 'СРЕДНИЙ', color: 'text-sky-500', bg: 'bg-sky-500/10' },
    low: { label: 'НИЗКИЙ', color: 'text-slate-400', bg: 'bg-slate-500/10' }
  }), []);

  const STATUS_META = useMemo<Record<TaskStatus, { label: string; color: string; step: number }>>(() => ({
    idea: { label: 'Идея', color: 'text-slate-500', step: 1 },
    planned: { label: 'Запланировано', color: 'text-indigo-400', step: 2 },
    in_progress: { label: 'В процессе', color: 'text-sky-400', step: 3 },
    waiting: { label: 'Ожидание', color: 'text-amber-400', step: 4 },
    completed: { label: 'Завершено', color: 'text-emerald-500', step: 5 }
  }), []);

  const ASSIGNEE_LABELS: Record<TaskAssignee, string> = {
    Andrey: 'Андрей',
    Anton: 'Антон',
    Rector: 'Rector (Админ 1)',
    Mentor: 'Mentor (Админ 2)',
    Owners: 'Оба владельца',
    Admins: 'Оба админа',
    All: 'Весь состав'
  };

  const STATUS_LABELS: Record<TaskStatus, string> = {
    idea: 'Идея',
    planned: 'В планах',
    in_progress: 'В процессе',
    waiting: 'Ожидание',
    completed: 'Готово'
  };

  const TAG_META = useMemo<Record<OwnerTag, { label: string; color: string }>>(() => ({
    CRITICAL: { label: 'CRITICAL', color: 'bg-rose-600' },
    MONEY: { label: 'MONEY', color: 'bg-emerald-600' },
    SYSTEM: { label: 'SYSTEM', color: 'bg-indigo-600' },
    CONTENT: { label: 'CONTENT', color: 'bg-sky-600' },
    BLOCKER: { label: 'BLOCKER', color: 'bg-orange-600' }
  }), []);

  // Состояние редактирования
  const [editingTask, setEditingTask] = useState<OwnerTask | null>(null);

  // Форма (используется и для создания, и для редактирования в модальном окне)
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('medium');
  const [newTaskAssigned, setNewTaskAssigned] = useState<TaskAssignee>('Owners');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskModel, setNewTaskModel] = useState('');
  const [newTaskTags, setNewTaskTags] = useState<OwnerTag[]>([]);
  const [newTaskGoal, setNewTaskGoal] = useState('');
  const [newTaskReason, setNewTaskReason] = useState('');
  const [newTaskEffect, setNewTaskEffect] = useState('');
  const [newTaskForAdmins, setNewTaskForAdmins] = useState(false);

  // Фильтры
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all');
  const [filterOwner, setFilterOwner] = useState<TaskAssignee | 'all'>('all');
  const [filterModel, setFilterModel] = useState<string | 'all'>('all');
  const [isStrategyMode, setIsStrategyMode] = useState(false);

  // UI
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [activeNoteInput, setActiveNoteInput] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [noteAuthor, setNoteAuthor] = useState<'Andrey' | 'Anton'>('Andrey');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === '1233211') setIsAuthenticated(true);
    else alert('Доступ запрещен. Неверный пароль.');
  };

  const toggleTaskExpansion = (id: string) => {
    const next = new Set(expandedTasks);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpandedTasks(next);
  };

  const toggleTag = (tag: OwnerTag) => {
    setNewTaskTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const saveTask = () => {
    if (!newTaskTitle.trim()) return;

    if (editingTask) {
        // Логика обновления
        updateState(prev => ({
            ...prev,
            ownerTasks: (prev.ownerTasks || []).map(t => t.id === editingTask.id ? {
                ...t,
                title: newTaskTitle,
                description: newTaskDesc,
                priority: newTaskPriority,
                assignedTo: newTaskAssigned,
                isForAdmins: newTaskForAdmins,
                dueDate: newTaskDueDate || undefined,
                tags: newTaskTags,
                strategyData: {
                    goal: newTaskGoal,
                    reason: newTaskReason,
                    effect: newTaskEffect
                },
                modelId: newTaskModel || undefined,
                updatedAt: new Date().toISOString()
            } : t)
        }));
        setEditingTask(null);
    } else {
        // Логика добавления
        const task: OwnerTask = {
            id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            title: newTaskTitle,
            description: newTaskDesc,
            status: 'idea',
            priority: newTaskPriority,
            assignedTo: newTaskAssigned,
            isForAdmins: newTaskForAdmins,
            dueDate: newTaskDueDate || undefined,
            tags: newTaskTags,
            strategyData: {
                goal: newTaskGoal,
                reason: newTaskReason,
                effect: newTaskEffect
            },
            notes: [],
            modelId: newTaskModel || undefined,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            periodId: state.selectedPeriodId
        };
        updateState(prev => ({ ...prev, ownerTasks: [task, ...(prev.ownerTasks || [])] }));
    }

    // Сброс полей
    setNewTaskTitle(''); setNewTaskDesc(''); setNewTaskModel(''); setNewTaskTags([]);
    setNewTaskGoal(''); setNewTaskReason(''); setNewTaskEffect(''); setNewTaskDueDate('');
    setNewTaskForAdmins(false);
  };

  const startEditing = (task: OwnerTask) => {
    setEditingTask(task);
    setNewTaskTitle(task.title);
    setNewTaskDesc(task.description);
    setNewTaskPriority(task.priority);
    setNewTaskAssigned(task.assignedTo);
    setNewTaskDueDate(task.dueDate || '');
    setNewTaskModel(task.modelId || '');
    setNewTaskTags(task.tags);
    setNewTaskGoal(task.strategyData?.goal || '');
    setNewTaskReason(task.strategyData?.reason || '');
    setNewTaskEffect(task.strategyData?.effect || '');
    setNewTaskForAdmins(!!task.isForAdmins);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEditing = () => {
    setEditingTask(null);
    setNewTaskTitle(''); setNewTaskDesc(''); setNewTaskModel(''); setNewTaskTags([]);
    setNewTaskGoal(''); setNewTaskReason(''); setNewTaskEffect(''); setNewTaskDueDate('');
    setNewTaskForAdmins(false);
  };

  const updateTaskStatus = (id: string, status: TaskStatus) => {
    updateState(prev => ({
      ...prev,
      ownerTasks: (prev.ownerTasks || []).map(t => t.id === id ? { ...t, status, updatedAt: new Date().toISOString() } : t)
    }));
  };

  const addNote = (taskId: string) => {
    if (!noteText.trim()) return;
    const note: TaskNote = {
      id: String(Date.now()),
      text: noteText,
      author: noteAuthor,
      createdAt: new Date().toISOString()
    };
    updateState(prev => ({
      ...prev,
      ownerTasks: (prev.ownerTasks || []).map(t => t.id === taskId ? { ...t, notes: [...t.notes, note], updatedAt: new Date().toISOString() } : t)
    }));
    setNoteText('');
    setActiveNoteInput(null);
  };

  const deleteTask = (id: string) => {
    if (!confirm('Вы действительно хотите удалить это стратегическое решение?')) return;
    updateState(prev => ({
      ...prev,
      deletedIds: [...prev.deletedIds, id],
      ownerTasks: (prev.ownerTasks || []).filter(t => t.id !== id)
    }));
  };

  const filteredTasks = useMemo(() => {
    let list = [...(state.ownerTasks || [])];
    if (isStrategyMode) {
      list = list.filter(t => t.tags.some(tag => ['CRITICAL', 'MONEY', 'SYSTEM'].includes(tag)));
    }
    if (filterStatus !== 'all') list = list.filter(t => t.status === filterStatus);
    if (filterOwner !== 'all') {
      list = list.filter(t => t.assignedTo === filterOwner);
    }
    if (filterModel !== 'all') list = list.filter(t => t.modelId === filterModel);

    return list.sort((a, b) => {
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        const pCompare = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (pCompare !== 0) return pCompare;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [state.ownerTasks, filterStatus, filterOwner, filterModel, isStrategyMode]);

  const stats = useMemo(() => {
    const all = state.ownerTasks || [];
    const now = new Date();
    return {
      urgent: all.filter(t => t.priority === 'urgent' && t.status !== 'completed').length,
      inProgress: all.filter(t => t.status === 'in_progress').length,
      waiting: all.filter(t => t.status === 'waiting').length,
      overdue: all.filter(t => t.status !== 'completed' && t.dueDate && new Date(t.dueDate) < now).length
    };
  }, [state.ownerTasks]);

  const AlertIcon = ICONS.AlertTriangle || 'span';
  const RotateIcon = ICONS.RotateCcw || 'span';
  const LockIcon = ICONS.Lock || 'span';
  const PlusIcon = ICONS.Plus || 'span';
  const CrownIcon = ICONS.Crown || 'span';
  const GraduationIcon = ICONS.Internship || 'span';
  const EditIcon = ICONS.Edit || 'span';

  if (!isAuthenticated) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center animate-in fade-in zoom-in duration-500">
        <div className="glass-card p-12 rounded-[40px] w-full max-w-md border-amber-500/10 shadow-2xl text-center bg-slate-950/50">
            <div className="w-20 h-20 bg-amber-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-amber-500/20">
              <CrownIcon size={40} className="text-amber-500" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2 font-outfit uppercase tracking-wider">Owner Control</h1>
            <p className="text-slate-400 text-sm mb-8">Стратегический блокнот владельца</p>
            <form onSubmit={handleLogin} className="space-y-4">
              <input 
                type="password" 
                autoFocus 
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-center text-2xl tracking-[0.5em] text-white outline-none focus:border-amber-500/50 transition-all" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="••••"
              />
              <button className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-amber-600/20 uppercase tracking-[0.2em] text-xs">Доступ к штабу</button>
            </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 max-w-7xl mx-auto">
      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[9px] font-black text-amber-500 uppercase tracking-widest">High-Level Control</div>
          </div>
          <h1 className="text-4xl font-black font-outfit text-white tracking-tight">Центр Стратегии</h1>
          <p className="text-slate-500 text-sm mt-1">Принимайте решения, которые влияют на рост системы</p>
        </div>
        
        <div className="flex items-center gap-4">
           <div className="flex bg-slate-900/80 p-1 rounded-2xl border border-slate-800 shadow-inner">
              <button 
                onClick={() => setIsStrategyMode(false)} 
                className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!isStrategyMode ? 'bg-slate-700 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
              >
                ОПЕРАЦИИ
              </button>
              <button 
                onClick={() => setIsStrategyMode(true)} 
                className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isStrategyMode ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20' : 'text-slate-500 hover:text-slate-300'}`}
              >
                СТРАТЕГИЯ
              </button>
           </div>
           <button onClick={() => setIsAuthenticated(false)} className="bg-slate-900 border border-slate-800 p-2.5 rounded-2xl text-slate-500 hover:text-rose-400 transition-all active:scale-90">
             <LockIcon size={20} />
           </button>
        </div>
      </header>

      {/* DASHBOARD BAR */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
         <StatWidget label="Просрочено" value={stats.overdue} color="rose" icon={<AlertIcon size={18}/>} overdue={stats.overdue > 0} />
         <StatWidget label="В процессе" value={stats.inProgress} color="sky" icon={<RotateIcon size={18}/>} />
         <StatWidget label="Ожидание" value={stats.waiting} color="amber" icon={<LockIcon size={18}/>} />
         <StatWidget label="Критично" value={stats.urgent} color="indigo" icon={<PlusIcon size={18}/>} />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* NEW DIRECTIVE FORM (LEFT COLUMN) */}
        <div className="lg:col-span-4 space-y-6">
           <div className={`glass-card p-8 rounded-[32px] border shadow-xl space-y-6 bg-slate-900/20 transition-all ${editingTask ? 'border-amber-500/50 shadow-amber-500/10' : 'border-slate-800'}`}>
              <div className="space-y-1">
                 <h2 className="text-xl font-black font-outfit text-white">{editingTask ? 'Редактировать Директиву' : 'Новая Директива'}</h2>
                 <p className="text-[10px] text-slate-600 uppercase font-black tracking-widest">{editingTask ? 'Внесение корректировок' : 'Проектирование будущего'}</p>
              </div>
              
              <div className="space-y-5">
                 <div className="space-y-2">
                    <input 
                       type="text" 
                       className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3.5 text-white font-bold outline-none focus:border-indigo-500/50 transition-all text-sm placeholder:text-slate-700" 
                       placeholder="Название директивы..." 
                       value={newTaskTitle} 
                       onChange={e => setNewTaskTitle(e.target.value)} 
                    />
                    <textarea 
                       className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3 text-white text-xs outline-none focus:border-indigo-500/50 transition-all min-h-[70px] placeholder:text-slate-800" 
                       placeholder="Краткая суть директивы..." 
                       value={newTaskDesc} 
                       onChange={e => setNewTaskDesc(e.target.value)} 
                    />
                 </div>

                 <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Дедлайн выполнения</label>
                    <input 
                       type="date" 
                       className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-[11px] text-indigo-400 font-black outline-none"
                       value={newTaskDueDate}
                       onChange={e => setNewTaskDueDate(e.target.value)}
                    />
                 </div>

                 <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div className="space-y-0.5">
                       <p className="text-[10px] font-black text-sky-400 uppercase tracking-widest">Делегировать Админам</p>
                       <p className="text-[8px] text-slate-500">Задача появится в Admin Table</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={newTaskForAdmins} onChange={e => setNewTaskForAdmins(e.target.checked)} />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
                    </label>
                 </div>

                 <div className="space-y-3">
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Метки воздействия</label>
                    <div className="flex flex-wrap gap-2">
                       {(Object.keys(TAG_META) as OwnerTag[]).map(t => (
                         <button 
                           key={t} 
                           onClick={() => toggleTag(t)}
                           className={`px-3 py-1 rounded-lg text-[8px] font-black border transition-all ${newTaskTags.includes(t) ? `${TAG_META[t].color} border-white/20 text-white shadow-lg` : 'bg-slate-950 border-slate-800 text-slate-600 hover:text-slate-400'}`}
                         >
                           {t}
                         </button>
                       ))}
                    </div>
                 </div>

                 <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Ответственный</label>
                    <select className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-[10px] text-white font-bold outline-none" value={newTaskAssigned} onChange={e => setNewTaskAssigned(e.target.value as any)}>
                       {Object.entries(ASSIGNEE_LABELS).map(([val, lab]) => <option key={val} value={val}>{lab}</option>)}
                    </select>
                 </div>

                 <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Приоритет</label>
                    <select className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-[10px] text-white font-bold outline-none" value={newTaskPriority} onChange={e => setNewTaskPriority(e.target.value as any)}>
                       <option value="urgent">КРИТИЧЕСКИ</option>
                       <option value="high">Высокий</option>
                       <option value="medium">Средний</option>
                       <option value="low">Низкий</option>
                    </select>
                 </div>

                 <div className="space-y-4 pt-4 border-t border-slate-800/50">
                    <StrategyInput label="Главная Цель" placeholder="Для чего это действие?" value={newTaskGoal} onChange={setNewTaskGoal} />
                    <StrategyInput label="Основание" placeholder="Почему это важно сейчас?" value={newTaskReason} onChange={setNewTaskReason} />
                    <StrategyInput label="Ожидаемый Эффект" placeholder="Результат в деньгах или системе?" value={newTaskEffect} onChange={setNewTaskEffect} />
                 </div>

                 <div className="flex flex-col gap-3">
                    <button 
                        onClick={saveTask} 
                        className={`w-full font-black py-4 rounded-2xl shadow-xl transition-all uppercase tracking-[0.2em] text-[10px] active:scale-95 ${editingTask ? 'bg-amber-600 text-white hover:bg-amber-500' : 'bg-white text-slate-950 hover:bg-amber-500 hover:text-white'}`}
                    >
                        {editingTask ? 'Сохранить Изменения' : 'ИНИЦИИРОВАТЬ ДИРЕКТИВУ'}
                    </button>
                    {editingTask && (
                        <button onClick={cancelEditing} className="w-full text-slate-500 hover:text-white py-2 text-[10px] font-black uppercase tracking-widest">Отмена</button>
                    )}
                 </div>
              </div>
           </div>
        </div>

        {/* BOARD (RIGHT COLUMN) */}
        <div className="lg:col-span-8 space-y-6">
           
           {/* FILTERS */}
           <div className="glass-card p-6 rounded-[32px] border-slate-800 shadow-lg flex flex-wrap gap-6 items-center bg-slate-900/40">
              <div className="space-y-1">
                 <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest ml-1">Статус реализации</label>
                 <div className="flex gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                    {['all', 'idea', 'planned', 'in_progress', 'waiting', 'completed'].map(s => (
                      <button 
                        key={s} 
                        onClick={() => setFilterStatus(s as any)} 
                        className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${filterStatus === s ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                      >
                        {s === 'all' ? 'Все' : STATUS_META[s as TaskStatus].label}
                      </button>
                    ))}
                 </div>
              </div>

              <div className="space-y-1">
                 <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest ml-1">Ответственный</label>
                 <select className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-[10px] text-white font-bold outline-none" value={filterOwner} onChange={e => setFilterOwner(e.target.value as any)}>
                    <option value="all">Весь штаб</option>
                    {Object.entries(ASSIGNEE_LABELS).map(([val, lab]) => <option key={val} value={val}>{lab}</option>)}
                 </select>
              </div>
           </div>

           {/* TASK LIST */}
           <div className="space-y-4">
              {filteredTasks.length === 0 ? (
                <div className="p-32 text-center border-2 border-dashed border-slate-900 rounded-[40px] text-slate-800 font-bold uppercase tracking-[0.4em] text-[10px]">
                   Оперативный план пуст
                </div>
              ) : (
                filteredTasks.map(task => {
                  const prio = PRIORITY_META[task.priority];
                  const stat = STATUS_META[task.status];
                  const isExpanded = expandedTasks.has(task.id);
                  const isCompleted = task.status === 'completed';
                  
                  // Логика просрочки
                  const now = new Date();
                  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
                  const isOverdue = !isCompleted && dueDate && dueDate < now;
                  
                  const assigneeLabel = ASSIGNEE_LABELS[task.assignedTo];

                  return (
                    <div 
                      key={task.id} 
                      className={`glass-card rounded-[32px] border transition-all duration-300 overflow-hidden ${isCompleted ? 'opacity-50 grayscale' : isOverdue ? 'border-rose-500/50 shadow-rose-500/10' : 'border-slate-800 hover:border-indigo-500/30 shadow-xl'}`}
                    >
                       {/* CARD HEADER */}
                       <div className="p-7 flex items-start justify-between gap-6">
                          <div className="flex-1 space-y-4">
                             <div className="flex items-center gap-2 flex-wrap">
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black tracking-widest border border-transparent ${prio.bg} ${prio.color}`}>{prio.label}</span>
                                {task.tags.map(tag => (
                                   <span key={tag} className={`px-2 py-0.5 rounded text-[8px] font-black text-white ${TAG_META[tag].color} shadow-sm tracking-tighter`}>{tag}</span>
                                ))}
                                
                                {task.isForAdmins && (
                                   <span className="text-[8px] bg-sky-600/20 text-sky-400 border border-sky-500/30 px-2 py-0.5 rounded font-black uppercase tracking-widest flex items-center gap-1">
                                      <GraduationIcon size={10} /> У АДМИНОВ
                                   </span>
                                )}

                                {/* ДИНАМИЧЕСКИЙ СТАТУС ДЕДЛАЙНА */}
                                {isCompleted ? (
                                  <span className="text-[8px] bg-emerald-600 text-white px-2 py-0.5 rounded font-black uppercase tracking-widest flex items-center gap-1">
                                    ✅ ВЫПОЛНЕНО: {assigneeLabel}
                                  </span>
                                ) : isOverdue ? (
                                  <span className="text-[8px] bg-rose-600 text-white px-2 py-0.5 rounded font-black uppercase tracking-widest animate-pulse flex items-center gap-1">
                                    ⚠️ ПРОСРОЧЕНО: {assigneeLabel}
                                  </span>
                                ) : (
                                  <span className="text-[8px] bg-slate-950 text-indigo-400 px-2 py-0.5 rounded border border-slate-800 font-black uppercase tracking-widest">
                                    👤 {assigneeLabel}
                                  </span>
                                )}
                             </div>

                             <div className="space-y-1.5">
                                <h3 className="text-xl font-bold font-outfit text-white tracking-tight leading-snug">{task.title}</h3>
                                {task.description && <p className="text-[11px] text-slate-500 leading-relaxed">{task.description}</p>}
                             </div>

                             {/* PROGRESS */}
                             <div className="pt-2 flex items-center gap-4">
                                <div className="flex-1 h-[3px] bg-slate-950 rounded-full overflow-hidden flex">
                                   {[1,2,3,4,5].map(step => (
                                     <div key={step} className={`flex-1 border-r border-slate-900 last:border-none transition-all ${step <= stat.step ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.3)]' : 'bg-transparent'}`}></div>
                                   ))}
                                </div>
                                <div className="flex items-center gap-4 shrink-0">
                                   {task.dueDate && (
                                      <span className={`text-[8px] font-mono font-bold uppercase tracking-widest ${isOverdue ? 'text-rose-400' : 'text-slate-500'}`}>
                                        Дедлайн: {task.dueDate}
                                      </span>
                                   )}
                                   <span className={`text-[8px] font-black uppercase tracking-widest ${stat.color}`}>{stat.label}</span>
                                </div>
                             </div>
                          </div>

                          <div className="flex flex-col items-end gap-5 shrink-0">
                             <div className="flex gap-2">
                                <button 
                                    onClick={() => startEditing(task)}
                                    className="w-10 h-10 rounded-2xl flex items-center justify-center bg-slate-950 text-slate-500 border border-slate-800 hover:text-white hover:border-amber-500/50 transition-all"
                                    title="Редактировать"
                                >
                                    <EditIcon size={16} />
                                </button>
                                <button 
                                  onClick={() => toggleTaskExpansion(task.id)}
                                  className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${isExpanded ? 'bg-indigo-600 text-white' : 'bg-slate-950 text-slate-600 border border-slate-800 hover:text-white hover:border-indigo-500/50'}`}
                                >
                                   <PlusIcon size={18} className={isExpanded ? 'rotate-45' : ''}/>
                                </button>
                                <div className="flex flex-col gap-1.5">
                                   <select 
                                      className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-[8px] font-black text-slate-400 outline-none uppercase tracking-widest focus:border-indigo-500/50 transition-all"
                                      value={task.status}
                                      onChange={(e) => updateTaskStatus(task.id, e.target.value as any)}
                                    >
                                      {Object.entries(STATUS_LABELS).map(([val, lab]) => <option key={val} value={val}>{lab}</option>)}
                                   </select>
                                   <button onClick={() => deleteTask(task.id)} className="text-slate-700 hover:text-rose-500 transition-colors text-[8px] font-bold uppercase text-right px-2">Удалить</button>
                                </div>
                             </div>
                          </div>
                       </div>

                       {/* EXPANDABLE SECTION */}
                       {isExpanded && (
                         <div className="bg-slate-950/40 border-t border-slate-900/50 animate-in slide-in-from-top-4 duration-300 p-8 space-y-8">
                            
                            {/* STRATEGY BLOCKS */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                               <StrategyBlock label="ГЛАВНАЯ ЦЕЛЬ" text={task.strategyData?.goal || ''} color="text-indigo-400" />
                               <StrategyBlock label="ОСНОВАНИЕ / ПОЧЕМУ СЕЙЧАС" text={task.strategyData?.reason || ''} color="text-sky-400" />
                               <StrategyBlock label="ОЖИДАЕМЫЙ ЭФФЕКТ" text={task.strategyData?.effect || ''} color="text-emerald-400" />
                            </div>

                            {/* ADMIN REPORT SECTION (IF COMPLETED) */}
                            {task.adminReport && (
                               <div className="p-6 rounded-3xl bg-sky-950/20 border border-sky-500/20 space-y-3">
                                  <div className="flex items-center gap-2 mb-2">
                                     <GraduationIcon size={14} className="text-sky-400" />
                                     <h4 className="text-[10px] font-black text-sky-400 uppercase tracking-[0.2em]">Отчет Администратора</h4>
                                  </div>
                                  <p className="text-[11px] text-slate-200 leading-relaxed">{task.adminReport.text}</p>
                                  {task.adminReport.links && task.adminReport.links.length > 0 && (
                                     <div className="flex flex-wrap gap-2 pt-2">
                                        {task.adminReport.links.map((link, idx) => (
                                           <a key={idx} href={link} target="_blank" rel="noopener noreferrer" className="px-3 py-1 bg-sky-600/30 hover:bg-sky-600/50 text-white rounded-lg text-[9px] font-bold border border-sky-500/30 transition-all">
                                              Ссылка #{idx + 1}
                                           </a>
                                        ))}
                                     </div>
                                  )}
                               </div>
                            )}

                            {/* LOGS */}
                            <div className="space-y-4">
                               <div className="flex justify-between items-center border-b border-slate-900/50 pb-2.5">
                                  <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Протокол решений</h4>
                                  <button onClick={() => setActiveNoteInput(task.id)} className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-widest">Добавить запись</button>
                               </div>
                               
                               <div className="space-y-3.5 pl-2">
                                  {task.notes.length === 0 ? (
                                    <p className="text-[10px] text-slate-700 italic">Журнал пуст. Зафиксируйте первый шаг...</p>
                                  ) : (
                                    task.notes.map(note => (
                                      <div key={note.id} className="relative flex gap-5 group/note">
                                         <div className={`w-0.5 h-full absolute -left-2 top-0 ${note.author === 'Andrey' ? 'bg-amber-500' : 'bg-indigo-500'} opacity-20 group-hover/note:opacity-50 transition-opacity`}></div>
                                         <div className="flex-1 space-y-1">
                                            <div className="flex items-center gap-3">
                                               <span className={`text-[8px] font-black uppercase tracking-widest ${note.author === 'Andrey' ? 'text-amber-500' : 'text-indigo-500'}`}>{note.author === 'Andrey' ? 'Андрей' : 'Антон'}</span>
                                               <span className="text-[7px] text-slate-700 font-mono">{new Date(note.createdAt).toLocaleString()}</span>
                                            </div>
                                            <p className="text-[11px] text-slate-300 leading-relaxed bg-slate-900/40 p-2.5 rounded-xl border border-slate-800/30">{note.text}</p>
                                         </div>
                                      </div>
                                    ))
                                  )}
                               </div>

                               {activeNoteInput === task.id && (
                                 <div className="bg-slate-900/60 p-5 rounded-[24px] border border-indigo-500/20 space-y-4 animate-in fade-in zoom-in-95 duration-200">
                                    <textarea 
                                      className="w-full bg-transparent border-none outline-none text-xs text-white min-h-[70px] placeholder:text-slate-700" 
                                      placeholder="Опишите текущий результат или важное изменение..." 
                                      value={noteText}
                                      onChange={e => setNoteText(e.target.value)}
                                      autoFocus
                                    />
                                    <div className="flex justify-between items-center pt-2 border-t border-slate-800/50">
                                       <div className="flex gap-2">
                                          <button onClick={() => setNoteAuthor('Andrey')} className={`w-8 h-8 rounded-xl text-[9px] font-black border transition-all ${noteAuthor === 'Andrey' ? 'bg-amber-500 border-amber-400 text-slate-950' : 'bg-slate-950 border-slate-800 text-slate-600'}`}>A</button>
                                          <button onClick={() => setNoteAuthor('Anton')} className={`w-8 h-8 rounded-xl text-[9px] font-black border transition-all ${noteAuthor === 'Anton' ? 'bg-indigo-500 border-indigo-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-600'}`}>P</button>
                                       </div>
                                       <div className="flex gap-4">
                                          <button onClick={() => setActiveNoteInput(null)} className="text-[10px] text-slate-500 hover:text-white uppercase font-bold tracking-widest">Отмена</button>
                                          <button onClick={() => addNote(task.id)} className="bg-indigo-600 px-5 py-2 rounded-xl text-[10px] font-black text-white uppercase shadow-lg shadow-indigo-600/20 active:scale-95 transition-all">Записать в журнал</button>
                                       </div>
                                    </div>
                                 </div>
                               )}
                            </div>
                         </div>
                       )}
                    </div>
                  );
                })
              )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default OwnerTable;
