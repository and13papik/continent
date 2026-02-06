
import React, { useState, useMemo } from 'react';
import { AppState, OwnerTask, TaskPriority, TaskStatus, TaskAssignee, TaskNote } from '../types';
import { ICONS } from '../constants';

// --- ВСПОМОГАТЕЛЬНЫЕ КОМПОНЕНТЫ ---

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

interface AdminTableProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const AdminTable: React.FC<AdminTableProps> = ({ state, updateState }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  
  // Состояния для выполнения отчета
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [reportText, setReportText] = useState('');
  const [reportLinks, setReportLinks] = useState('');

  // Форма создания (внутренние задачи)
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('medium');
  const [newTaskAssigned, setNewTaskAssigned] = useState<'Rector' | 'Mentor' | 'Admins'>('Admins');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');

  const PRIORITY_META = useMemo<Record<TaskPriority, { label: string; color: string; bg: string }>>(() => ({
    urgent: { label: 'СРОЧНО', color: 'text-rose-500', bg: 'bg-rose-500/10' },
    high: { label: 'ВЫСОКИЙ', color: 'text-amber-500', bg: 'bg-amber-500/10' },
    medium: { label: 'ОБЫЧНЫЙ', color: 'text-sky-500', bg: 'bg-sky-500/10' },
    low: { label: 'НИЗКИЙ', color: 'text-slate-400', bg: 'bg-slate-500/10' }
  }), []);

  const ASSIGNEE_LABELS: Record<string, string> = {
    Andrey: 'Андрей',
    Anton: 'Антон',
    Rector: 'Rector (Админ 1)',
    Mentor: 'Mentor (Админ 2)',
    Owners: 'Оба владельца',
    Admins: 'Оба админа',
    All: 'Весь состав'
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === '321123') setIsAuthenticated(true);
    else alert('Доступ закрыт. Только для Администраторов.');
  };

  const addTask = () => {
    if (!newTaskTitle.trim()) return;
    const task: OwnerTask = {
      id: `admin-task-${Date.now()}`,
      title: newTaskTitle,
      description: newTaskDesc,
      status: 'planned',
      priority: newTaskPriority,
      assignedTo: newTaskAssigned as any,
      isForAdmins: true,
      tags: [],
      notes: [],
      dueDate: newTaskDueDate || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      periodId: state.selectedPeriodId
    };
    updateState(prev => ({ ...prev, ownerTasks: [task, ...(prev.ownerTasks || [])] }));
    setNewTaskTitle(''); setNewTaskDesc(''); setNewTaskDueDate('');
  };

  const submitReport = () => {
    if (!reportText.trim()) return alert('Пожалуйста, напишите краткий отчет о выполнении.');
    
    const linksArray = reportLinks.split('\n').filter(l => l.trim().startsWith('http'));

    updateState(prev => ({
      ...prev,
      ownerTasks: (prev.ownerTasks || []).map(t => t.id === completingTaskId ? {
        ...t,
        status: 'completed',
        updatedAt: new Date().toISOString(),
        adminReport: {
          text: reportText,
          links: linksArray
        }
      } : t)
    }));

    setCompletingTaskId(null);
    setReportText('');
    setReportLinks('');
  };

  const updateTaskStatus = (id: string, status: TaskStatus) => {
    updateState(prev => ({
      ...prev,
      ownerTasks: (prev.ownerTasks || []).map(t => t.id === id ? { ...t, status, updatedAt: new Date().toISOString() } : t)
    }));
  };

  const adminTasks = useMemo(() => {
    const list = (state.ownerTasks || []).filter(t => t.isForAdmins || ['Rector', 'Mentor', 'Admins'].includes(t.assignedTo));
    return list.sort((a, b) => {
      if (a.status === 'completed' && b.status !== 'completed') return 1;
      if (a.status !== 'completed' && b.status === 'completed') return -1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [state.ownerTasks]);

  const stats = useMemo(() => {
    const now = new Date();
    return {
      active: adminTasks.filter(t => t.status !== 'completed').length,
      overdue: adminTasks.filter(t => t.status !== 'completed' && t.dueDate && new Date(t.dueDate) < now).length,
      today: adminTasks.filter(t => t.status !== 'completed' && t.dueDate && new Date(t.dueDate).toDateString() === now.toDateString()).length,
      completed: adminTasks.filter(t => t.status === 'completed').length
    };
  }, [adminTasks]);

  const LockIcon = ICONS.Lock || 'span';
  const GraduationIcon = ICONS.Internship || 'span';
  const AlertIcon = ICONS.AlertTriangle || 'span';
  const RotateIcon = ICONS.RotateCcw || 'span';
  const PlusIcon = ICONS.Plus || 'span';
  const CheckIcon = ICONS.Salary || 'span';

  if (!isAuthenticated) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center animate-in fade-in zoom-in duration-500">
        <div className="glass-card p-12 rounded-[40px] w-full max-w-md border-sky-500/10 shadow-2xl text-center bg-slate-950/50">
            <div className="w-20 h-20 bg-sky-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-sky-500/20">
              <GraduationIcon size={40} className="text-sky-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2 font-outfit uppercase tracking-wider">Admin HQ</h1>
            <p className="text-slate-400 text-sm mb-8">Операционный штаб администраторов</p>
            <form onSubmit={handleLogin} className="space-y-4">
              <input 
                type="password" 
                autoFocus 
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-center text-2xl tracking-[0.5em] text-white outline-none focus:border-sky-500/50 transition-all" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="••••"
              />
              <button className="w-full bg-sky-600 hover:bg-sky-500 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-sky-600/20 uppercase tracking-[0.2em] text-xs">Авторизация</button>
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
            <div className="px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/20 text-[9px] font-black text-sky-400 uppercase tracking-widest">Operations Hub</div>
          </div>
          <h1 className="text-4xl font-black font-outfit text-white tracking-tight">Рабочий Стол Админов</h1>
          <p className="text-slate-500 text-sm mt-1">Управление текущими задачами и отчетность</p>
        </div>
        
        <button onClick={() => setIsAuthenticated(false)} className="bg-slate-900 border border-slate-800 p-2.5 rounded-2xl text-slate-500 hover:text-rose-400 transition-all active:scale-90">
           <LockIcon size={20} />
        </button>
      </header>

      {/* STATS */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
         <StatWidget label="В работе" value={stats.active} color="indigo" icon={<RotateIcon size={18}/>} />
         <StatWidget label="Просрочено" value={stats.overdue} color="rose" icon={<AlertIcon size={18}/>} overdue={stats.overdue > 0} />
         <StatWidget label="На сегодня" value={stats.today} color="amber" icon={<ICONS.Calendar size={18}/>} />
         <StatWidget label="Выполнено" value={stats.completed} color="emerald" icon={<CheckIcon size={18}/>} />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* NEW INTERNAL TASK */}
        <div className="lg:col-span-4 space-y-6">
           <div className="glass-card p-8 rounded-[32px] border-slate-800 shadow-xl space-y-6 bg-slate-900/20">
              <div className="space-y-1">
                 <h2 className="text-xl font-black font-outfit text-white">Внутренняя Задача</h2>
                 <p className="text-[10px] text-slate-600 uppercase font-black tracking-widest">Самоорганизация отдела</p>
              </div>
              
              <div className="space-y-5">
                 <div className="space-y-2">
                    <input 
                       type="text" 
                       className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3.5 text-white font-bold outline-none focus:border-sky-500/50 transition-all text-sm" 
                       placeholder="Что нужно сделать?" 
                       value={newTaskTitle} 
                       onChange={e => setNewTaskTitle(e.target.value)} 
                    />
                    <textarea 
                       className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3 text-white text-xs outline-none focus:border-sky-500/50 transition-all min-h-[70px]" 
                       placeholder="Детали выполнения..." 
                       value={newTaskDesc} 
                       onChange={e => setNewTaskDesc(e.target.value)} 
                    />
                 </div>

                 <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Дедлайн</label>
                    <input 
                       type="date" 
                       className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-[11px] text-sky-400 font-black outline-none"
                       value={newTaskDueDate}
                       onChange={e => setNewTaskDueDate(e.target.value)}
                    />
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                       <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Исполнитель</label>
                       <select className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-[10px] text-white font-bold outline-none" value={newTaskAssigned} onChange={e => setNewTaskAssigned(e.target.value as any)}>
                          <option value="Admins">Оба админа</option>
                          <option value="Rector">Rector</option>
                          <option value="Mentor">Mentor</option>
                       </select>
                    </div>
                    <div className="space-y-1">
                       <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Приоритет</label>
                       <select className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-[10px] text-white font-bold outline-none" value={newTaskPriority} onChange={e => setNewTaskPriority(e.target.value as any)}>
                          <option value="urgent">СРОЧНО</option>
                          <option value="high">Высокий</option>
                          <option value="medium">Обычный</option>
                          <option value="low">Низкий</option>
                       </select>
                    </div>
                 </div>

                 <button 
                   onClick={addTask} 
                   className="w-full bg-sky-600 text-white font-black py-4 rounded-2xl shadow-xl transition-all uppercase tracking-[0.2em] text-[10px] active:scale-95 hover:bg-sky-500"
                 >
                   Добавить в план
                 </button>
              </div>
           </div>
        </div>

        {/* TASK BOARD */}
        <div className="lg:col-span-8 space-y-4">
           {adminTasks.map(task => {
              const prio = PRIORITY_META[task.priority];
              const isCompleted = task.status === 'completed';
              const now = new Date();
              const dueDate = task.dueDate ? new Date(task.dueDate) : null;
              const isOverdue = !isCompleted && dueDate && dueDate < now;
              const assigneeLabel = ASSIGNEE_LABELS[task.assignedTo];

              return (
                <div key={task.id} className={`glass-card rounded-[32px] border transition-all ${isCompleted ? 'opacity-40 grayscale blur-[0.3px]' : isOverdue ? 'border-rose-500/50 bg-rose-500/5' : 'border-slate-800 hover:border-sky-500/30'}`}>
                   <div className="p-7 flex flex-col md:flex-row justify-between gap-6">
                      <div className="flex-1 space-y-4">
                         <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black tracking-widest ${prio.bg} ${prio.color}`}>{prio.label}</span>
                            
                            {isCompleted ? (
                               <span className="text-[8px] bg-emerald-600 text-white px-2 py-0.5 rounded font-black uppercase tracking-widest">✅ ВЫПОЛНЕНО ({assigneeLabel})</span>
                            ) : isOverdue ? (
                               <span className="text-[8px] bg-rose-600 text-white px-2 py-0.5 rounded font-black uppercase tracking-widest animate-pulse">⚠️ ПРОСРОЧЕНО ({assigneeLabel})</span>
                            ) : (
                               <span className="text-[8px] bg-slate-950 text-sky-400 px-2 py-0.5 rounded border border-slate-800 font-black uppercase tracking-widest">👤 {assigneeLabel}</span>
                            )}

                            {task.dueDate && <span className={`text-[8px] font-mono font-bold ${isOverdue ? 'text-rose-400' : 'text-slate-500'}`}>Срок: {task.dueDate}</span>}
                         </div>

                         <div className="space-y-1.5">
                            <h3 className="text-xl font-bold font-outfit text-white tracking-tight">{task.title}</h3>
                            {task.description && <p className="text-[11px] text-slate-400 leading-relaxed">{task.description}</p>}
                         </div>

                         {/* OWNER CONTEXT (IF FROM OWNER) */}
                         {!task.id.startsWith('admin-task') && (
                            <div className="flex gap-4 p-3 rounded-2xl bg-slate-950/50 border border-slate-800/50">
                               <div className="text-[8px] font-black text-amber-500 uppercase tracking-widest vertical-text py-2">Owner Directive</div>
                               <div className="flex-1 space-y-2">
                                  {task.strategyData?.goal && <p className="text-[10px] text-slate-300"><span className="text-amber-500 font-bold uppercase tracking-tighter">Цель:</span> {task.strategyData.goal}</p>}
                                  {task.strategyData?.effect && <p className="text-[10px] text-slate-300"><span className="text-emerald-500 font-bold uppercase tracking-tighter">Эффект:</span> {task.strategyData.effect}</p>}
                               </div>
                            </div>
                         )}
                      </div>

                      <div className="flex flex-col items-end gap-3 shrink-0">
                         {!isCompleted && (
                            <button 
                              onClick={() => setCompletingTaskId(task.id)}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-6 py-3 rounded-2xl shadow-xl shadow-emerald-600/20 text-[10px] uppercase tracking-widest transition-all active:scale-95"
                            >
                               Выполнено
                            </button>
                         )}
                         <div className="flex flex-col gap-2 w-full">
                            <select 
                              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-[8px] font-black text-slate-500 outline-none uppercase tracking-widest"
                              value={task.status}
                              onChange={(e) => updateTaskStatus(task.id, e.target.value as any)}
                            >
                              <option value="planned">В планах</option>
                              <option value="in_progress">В работе</option>
                              <option value="waiting">Ожидание</option>
                              <option value="completed">Готово</option>
                            </select>
                         </div>
                      </div>
                   </div>

                   {/* REPORT DISPLAY IF COMPLETED */}
                   {task.adminReport && (
                      <div className="bg-emerald-950/10 border-t border-emerald-500/10 p-6 space-y-3">
                         <div className="flex items-center gap-2">
                            <CheckIcon size={14} className="text-emerald-500" />
                            <h4 className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Отчет о выполнении</h4>
                         </div>
                         <p className="text-[11px] text-slate-300">{task.adminReport.text}</p>
                         <div className="flex flex-wrap gap-2">
                            {task.adminReport.links.map((link, idx) => (
                               <a key={idx} href={link} target="_blank" rel="noopener noreferrer" className="text-[9px] text-sky-400 hover:underline">Результат #{idx+1}</a>
                            ))}
                         </div>
                      </div>
                   )}
                </div>
              );
           })}
        </div>
      </div>

      {/* REPORT MODAL */}
      {completingTaskId && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
            <div className="glass-card w-full max-w-lg rounded-[2.5rem] p-10 border-sky-500/30 shadow-2xl relative">
               <h2 className="text-2xl font-black text-white mb-2 font-outfit uppercase tracking-tight">Финальный Отчет</h2>
               <p className="text-slate-500 text-xs mb-8 uppercase tracking-widest font-black">Подтверждение результата задачи</p>
               
               <div className="space-y-6">
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Что было сделано?</label>
                     <textarea 
                       className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-white text-xs outline-none focus:border-sky-500 transition-all min-h-[120px]" 
                       placeholder="Опишите кратко результат..."
                       value={reportText}
                       onChange={e => setReportText(e.target.value)}
                       autoFocus
                     />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Ссылки на результаты / Фото (каждая с новой строки)</label>
                     <textarea 
                       className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-white text-[10px] font-mono outline-none focus:border-sky-500 transition-all min-h-[80px]" 
                       placeholder="https://..."
                       value={reportLinks}
                       onChange={e => setReportLinks(e.target.value)}
                     />
                  </div>

                  <div className="flex gap-4 pt-4">
                     <button onClick={() => setCompletingTaskId(null)} className="flex-1 bg-slate-900 text-slate-500 font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] hover:text-white transition-all">Отмена</button>
                     <button onClick={submitReport} className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-emerald-600/20 uppercase tracking-widest text-[10px]">Подтвердить выполнение</button>
                  </div>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};

export default AdminTable;
