
import React, { useState, useMemo } from 'react';
import { AppState, OwnerTask, TaskPriority, TaskStatus, OwnerTag, TaskNote, TaskAssignee, TaskType, RecurrenceCycle, TaskAuditEntry } from '../types';
import { ICONS } from '../constants';

const TG_TOKEN = '8497961851:AAEmwmEgJNV6KwyQjdcG62GY3IdX8zz6YV4';
const DEFAULT_CHAT_ID = '-4748511729';

// --- ПОМОЩНИКИ ---

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

// --- ОСНОВНОЙ КОМПОНЕНТ ---

interface OwnerTableProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const OwnerTable: React.FC<OwnerTableProps> = ({ state, updateState }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [currentOwner, setCurrentOwner] = useState<'Andrey' | 'Anton' | 'Owners'>('Andrey');
  const [isSendingToTg, setIsSendingToTg] = useState<string | null>(null);

  const [activeMode, setActiveMode] = useState<TaskType>('directive');
  const [secondaryFilter, setSecondaryFilter] = useState<'all' | 'critical' | 'process' | 'review'>('all');

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

  const TYPE_META: Record<TaskType, { label: string, color: string, bg: string, icon: any }> = {
    directive: { label: 'Директива', color: 'text-amber-500', bg: 'bg-amber-500/10', icon: ICONS.Crown },
    regular: { label: 'Задача', color: 'text-sky-400', bg: 'bg-sky-400/10', icon: ICONS.Reports },
    recurring: { label: 'Регламент', color: 'text-indigo-400', bg: 'bg-indigo-400/10', icon: ICONS.RotateCcw }
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

  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === '1233211') { setIsAuthenticated(true); }
    else alert('Доступ запрещен');
  };

  const logAudit = (action: string, actor: string): TaskAuditEntry => ({
    id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    action, actor, timestamp: new Date().toISOString()
  });

  const sendTaskToTelegram = async (task: OwnerTask) => {
    setIsSendingToTg(task.id);
    
    // Определение кого тегать (HTML формат)
    let mentionTags = '';
    if (task.assignedTo === 'Mentor') {
      mentionTags = '<a href="tg://user?id=7475447497">@adm_mentr</a>';
    } else if (task.assignedTo === 'Rector') {
      mentionTags = '<a href="tg://user?id=6537516111">@adm_rctr</a>';
    } else if (task.assignedTo === 'Admins' || task.assignedTo === 'All') {
      mentionTags = '<a href="tg://user?id=7475447497">@adm_mentr</a> <a href="tg://user?id=6537516111">@adm_rctr</a>';
    } else {
      mentionTags = '@continental_agency';
    }

    const typeLabel = TYPE_META[task.taskType]?.label || 'Задача';
    const prioLabel = PRIORITY_META[task.priority]?.label || 'Средний';
    const prioEmoji = PRIORITY_META[task.priority]?.emoji || '⚡️';

    let message = `🚨 <b>CORE: Новая задача</b>\n\n`;
    message += `<b>Тип:</b> ${typeLabel}\n`;
    message += `<b>Приоритет:</b> ${prioEmoji} ${prioLabel}\n\n`;
    message += `<b>Задача:</b> ${task.title}\n\n`;
    message += `<b>Исполнитель:</b> ${mentionTags}`;

    try {
      const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: DEFAULT_CHAT_ID,
          text: message,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[
              { text: "➡️ Перейти к задаче", url: "https://continental.monster/#/admin-table" }
            ]]
          }
        })
      });
      if (res.ok) alert('Уведомление отправлено');
      else {
        const err = await res.json();
        alert(`Ошибка: ${err.description}`);
      }
    } catch (e) {
      alert('Сбой сети при отправке в TG');
    } finally {
      setIsSendingToTg(null);
    }
  };

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
                strategyData: { goal: newTaskGoal, reason: '', effect: '' },
                auditLog: [...(t.auditLog || []), logAudit('Изменено владельцем', currentOwner)],
                updatedAt: new Date().toISOString()
            } : t)
        }));
        setEditingTask(null);
    } else {
        const task: OwnerTask = {
            id: `task-${Date.now()}`,
            title: newTaskTitle, description: newTaskDesc, status: 'idea',
            priority: newTaskPriority, taskType: newTaskType, assignedTo: newTaskAssigned,
            recurrenceCycle: newTaskType === 'recurring' ? newTaskCycle : undefined,
            tags: [], strategyData: { goal: newTaskGoal, reason: '', effect: '' },
            notes: [], auditLog: [logAudit('Создано владельцем', currentOwner)],
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            periodId: state.selectedPeriodId
        };
        updateState(prev => ({ ...prev, ownerTasks: [task, ...(prev.ownerTasks || [])] }));
    }
    setNewTaskTitle(''); setNewTaskDesc(''); setNewTaskGoal('');
  };

  const startEditing = (task: OwnerTask) => {
    setEditingTask(task);
    setNewTaskTitle(task.title); setNewTaskDesc(task.description);
    setNewTaskPriority(task.priority); setNewTaskAssigned(task.assignedTo);
    setNewTaskType(task.taskType || 'regular'); setNewTaskCycle(task.recurrenceCycle || 'daily');
    setNewTaskGoal(task.strategyData?.goal || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filteredTasks = useMemo(() => {
    let list = (state.ownerTasks || []).map(t => {
      if (!t.taskType) {
        if (t.isRoutine) t.taskType = 'recurring';
        else if (t.id.startsWith('admin-task')) t.taskType = 'regular';
        else t.taskType = 'directive';
      }
      return t;
    });

    list = list.filter(t => t.taskType === activeMode);
    
    list = list.filter(t => {
      const isForMe = t.assignedTo === currentOwner || t.assignedTo === 'Owners' || t.assignedTo === 'All';
      const isDelegatedToAdmin = t.assignedTo === 'Rector' || t.assignedTo === 'Mentor' || t.assignedTo === 'Admins';
      const isVisibleDelegation = isDelegatedToAdmin && (!t.id.startsWith('admin-task') || t.status === 'review');
      return isForMe || isVisibleDelegation;
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

  if (!isAuthenticated) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center animate-in fade-in zoom-in duration-300">
        <div className="glass-card p-12 rounded-[40px] w-full max-w-md border-amber-500/10 shadow-2xl text-center bg-slate-950/50">
            <ICONS.Crown size={48} className="mx-auto text-amber-500 mb-6" />
            <h1 className="text-2xl font-bold text-white mb-8 font-outfit uppercase tracking-wider">Контроль Владельца</h1>
            <form onSubmit={handleLogin} className="space-y-4">
              <input type="password" autoFocus className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-center text-2xl tracking-[0.5em] text-white outline-none focus:border-amber-500/50 transition-all" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black py-4 rounded-2xl uppercase tracking-[0.2em] text-xs">Авторизация</button>
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
            <div className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[9px] font-black text-amber-500 uppercase tracking-widest">Стратегический надзор штаба</div>
          </div>
          <h1 className="text-4xl font-black font-outfit text-white tracking-tight">Ядро управления</h1>
        </div>
        <div className="flex gap-2">
          {['Andrey', 'Anton', 'Owners'].map(id => (
            <button key={id} onClick={() => setCurrentOwner(id as any)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${currentOwner === id ? 'bg-amber-600 text-white shadow-lg' : 'bg-slate-900 text-slate-500'}`}>
              {ASSIGNEE_LABELS[id as TaskAssignee]}
            </button>
          ))}
          <button onClick={() => setIsAuthenticated(false)} className="bg-slate-900 border border-slate-800 p-2 rounded-xl text-slate-500 hover:text-white transition-all"><ICONS.Lock size={18}/></button>
        </div>
      </header>

      <div className="flex flex-col gap-4 border-b border-slate-900 pb-4">
        <div className="flex gap-8 items-center px-2">
          {['directive', 'regular', 'recurring'].map((mode) => (
            <button key={mode} onClick={() => { setActiveMode(mode as any); setSecondaryFilter('all'); }} className={`relative py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${activeMode === mode ? `text-${TYPE_META[mode as TaskType].color.split('-')[1]}-400` : 'text-slate-600 hover:text-slate-400'}`}>
              {TYPE_META[mode as TaskType].label}
              {activeMode === mode && <div className={`absolute -bottom-[17px] left-0 right-0 h-0.5 bg-current rounded-full`} />}
            </button>
          ))}
        </div>
        <div className="flex gap-4 px-2 items-center overflow-x-auto no-scrollbar">
           {['all', 'critical', 'process', 'review'].map(f => (
             <button key={f} onClick={() => setSecondaryFilter(f as any)} className={`text-[8px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${secondaryFilter === f ? 'text-white bg-slate-800 px-3 py-1 rounded-full' : 'text-slate-600 hover:text-slate-400'}`}>
               {f === 'review' ? 'НУЖНО ПРОВЕРИТЬ' : (f === 'all' ? 'ВСЕ' : f === 'critical' ? 'КРИТИЧЕСКИЕ' : 'В ПРОЦЕССЕ')}
             </button>
           ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-4 space-y-6">
           <div className="glass-card p-8 rounded-[32px] border border-slate-800 bg-slate-900/20 space-y-6 shadow-2xl">
              <h2 className="text-xl font-black font-outfit text-white">{editingTask ? 'Изменить инициативу' : 'Запустить задачу'}</h2>
              <div className="space-y-4">
                 <input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3.5 text-white font-bold outline-none text-sm focus:border-amber-500/50" placeholder="Заголовок..." value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} />
                 <textarea className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3 text-white text-xs outline-none min-h-[70px] focus:border-amber-500/50" placeholder="Контекст..." value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)} />
                 
                 <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                       <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Тип</label>
                       <select className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-[10px] text-white font-bold outline-none" value={newTaskType} onChange={e => setNewTaskType(e.target.value as any)}>
                          <option value="directive">Директива</option>
                          <option value="regular">Задача</option>
                          <option value="recurring">Регламент</option>
                       </select>
                    </div>
                    <div className="space-y-1">
                       <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Приоритет</label>
                       <select className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-[10px] text-white font-bold outline-none" value={newTaskPriority} onChange={e => setNewTaskPriority(e.target.value as any)}>
                          {Object.entries(PRIORITY_META).map(([val, m]) => <option key={val} value={val}>{m.label}</option>)}
                       </select>
                    </div>
                 </div>

                 <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Исполнитель</label>
                    <select className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-[10px] text-white font-bold outline-none" value={newTaskAssigned} onChange={e => setNewTaskAssigned(e.target.value as any)}>
                       {Object.entries(ASSIGNEE_LABELS).map(([val, lab]) => <option key={val} value={val}>{lab}</option>)}
                    </select>
                 </div>

                 <StrategyInput label="Целевой результат" value={newTaskGoal} onChange={setNewTaskGoal} placeholder="Что считаем успехом?.." />
                 <button onClick={saveTask} className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black py-4 rounded-2xl shadow-xl uppercase tracking-[0.2em] text-[10px] transition-all active:scale-95">Внедрить</button>
              </div>
           </div>
        </div>

        <div className="lg:col-span-8 space-y-4">
           {filteredTasks.length === 0 ? (
             <div className="p-32 text-center border-2 border-dashed border-slate-900 rounded-[40px] text-slate-600 font-bold uppercase tracking-[0.2em] text-[10px]">
               Нет активных задач в этом секторе.
             </div>
           ) : filteredTasks.map(task => {
              const prio = PRIORITY_META[task.priority] || PRIORITY_META.medium;
              const stat = STATUS_META[task.status] || STATUS_META.idea;
              const isEx = expandedTasks.has(task.id);

              return (
                <div key={task.id} className={`glass-card rounded-[32px] border transition-all duration-300 overflow-hidden ${task.status === 'review' ? 'border-amber-500 ring-4 ring-amber-500/10 shadow-[0_0_40px_rgba(245,158,11,0.1)]' : 'border-slate-800'}`}>
                   <div className="p-7 flex flex-col md:flex-row justify-between gap-6">
                      <div className="flex-1 space-y-4">
                         <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black tracking-widest ${prio.bg} ${prio.color}`}>{prio.label}</span>
                            <span className="text-[8px] bg-slate-950 text-indigo-400 px-2 py-0.5 rounded border border-slate-800 font-black uppercase">👤 {ASSIGNEE_LABELS[task.assignedTo]}</span>
                            {task.status === 'review' && <span className="text-[8px] bg-amber-500 text-slate-950 px-2 py-0.5 rounded font-black uppercase animate-pulse">РАБОТА ЗАВЕРШЕНА — ПРОВЕРЬТЕ</span>}
                         </div>
                         <h3 className="text-xl font-bold font-outfit text-white tracking-tight">{task.title}</h3>
                         <div className="flex items-center gap-4">
                            <div className="flex-1 h-[2px] bg-slate-950 rounded-full flex overflow-hidden">
                               {[1,2,3,4,5].map(step => (
                                 <div key={step} className={`flex-1 transition-all ${step <= stat.step ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.3)]' : 'bg-transparent'}`}></div>
                               ))}
                            </div>
                            <span className={`text-[8px] font-black uppercase tracking-widest ${stat.color}`}>{stat.label}</span>
                         </div>
                      </div>

                      <div className="flex flex-col items-end gap-3 shrink-0">
                         <div className="flex gap-2">
                            <button 
                               onClick={() => sendTaskToTelegram(task)} 
                               disabled={isSendingToTg === task.id}
                               className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all flex items-center gap-2 ${isSendingToTg === task.id ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-sky-600/10 border-sky-600/30 text-sky-400 hover:bg-sky-600 hover:text-white shadow-lg'}`}
                            >
                               {isSendingToTg === task.id ? 'ОТПРАВКА...' : <>🚀 В ТЕЛЕГРАМ</>}
                            </button>
                            <button onClick={() => startEditing(task)} className="w-10 h-10 rounded-2xl flex items-center justify-center bg-slate-950 border border-slate-800 text-slate-600 hover:text-white"><ICONS.Edit size={16}/></button>
                            <button onClick={() => { const n = new Set(expandedTasks); if(n.has(task.id)) n.delete(task.id); else n.add(task.id); setExpandedTasks(n); }} className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${isEx ? 'bg-indigo-600 text-white' : 'bg-slate-950 text-slate-600'}`}><ICONS.Plus size={18} className={isEx ? 'rotate-45' : ''}/></button>
                         </div>
                         <div className="flex gap-1">
                            {['idea', 'in_progress', 'completed'].map(s => (
                               <button 
                                  key={s} 
                                  onClick={() => updateState(p => ({...p, ownerTasks: (p.ownerTasks || []).map(t => t.id === task.id ? {...t, status: s as any, auditLog: [...(t.auditLog || []), logAudit(`Статус: ${s}`, currentOwner)]} : t)}))}
                                  className={`px-2 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-tighter border transition-all ${task.status === s ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-950 border-slate-900 text-slate-600 hover:border-slate-700'}`}
                               >
                                  {STATUS_META[s as TaskStatus].label}
                               </button>
                            ))}
                         </div>
                      </div>
                   </div>

                   {isEx && (
                      <div className="bg-slate-950/40 border-t border-slate-900/50 p-8 space-y-6 animate-in slide-in-from-top-2">
                         <div className="p-5 rounded-2xl bg-slate-900/30 border border-slate-800/50 space-y-2">
                            <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Описание и Цель</label>
                            <p className="text-xs text-slate-300 leading-relaxed">{task.description || 'Нет описания.'}</p>
                            <p className="text-[10px] text-amber-500 font-bold mt-2">Задача: {task.strategyData?.goal || 'Не задана.'}</p>
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
