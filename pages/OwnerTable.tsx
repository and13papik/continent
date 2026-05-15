
import React, { useState, useMemo } from 'react';
import { AppState, OwnerTask, TaskPriority, TaskStatus, OwnerTag, TaskNote, TaskAssignee, TaskType, RecurrenceCycle, TaskAuditEntry, OwnerNote } from '../types';
import { ICONS } from '../constants';
import PeriodBadge from '../components/PeriodBadge';

const TG_TOKEN = '8497961851:AAEmwmEgJNV6KwyQjdcG62GY3IdX8zz6YV4';
const DEFAULT_CHAT_ID = '-1003748692600';

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
    // Split by separator
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
      
      // Update local editor
      editorRef.current.innerHTML = newRemaining || '<div><br></div>';
      alert('Задача перенесена в архив!');
    }
  };

  // Sync state to editor initially and when remote changes (careful with cursor)
  React.useEffect(() => {
    if (editorRef.current && state.ownerDocument !== undefined) {
        if (editorRef.current.innerHTML !== state.ownerDocument) {
            // Only update if not currently focused to avoid cursor jumps
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
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskTarget, setNewTaskTarget] = useState<'owner' | 'admin'>('admin');

  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  // Состояния для Блокнота
  const [editingNote, setEditingNote] = useState<OwnerNote | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteDeadline, setNoteDeadline] = useState('');
  const [noteItems, setNoteItems] = useState<{ id: string; text: string; completed: boolean }[]>([]);
  const [newCheckItem, setNewCheckItem] = useState('');

  const saveNote = () => {
    if (!noteTitle.trim() && !noteContent.trim() && noteItems.length === 0) return;

    if (editingNote) {
      updateState(prev => ({
        ...prev,
        ownerNotes: (prev.ownerNotes || []).map(n => n.id === editingNote.id ? {
          ...n,
          title: noteTitle, content: noteContent, items: noteItems, 
          deadline: noteDeadline || undefined,
          updatedAt: new Date().toISOString()
        } : n)
      }));
      setEditingNote(null);
    } else {
      const note: OwnerNote = {
        id: `note-${Date.now()}`,
        title: noteTitle, content: noteContent, items: noteItems,
        deadline: noteDeadline || undefined,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        periodId: state.selectedPeriodId
      };
      updateState(prev => ({ ...prev, ownerNotes: [note, ...(prev.ownerNotes || [])] }));
    }
    setNoteTitle(''); setNoteContent(''); setNoteItems([]); setNoteDeadline('');
  };

  const deleteNote = (id: string) => {
    if (!confirm('Удалить заметку?')) return;
    updateState(prev => ({
      ...prev,
      deletedIds: [...(prev.deletedIds || []), id],
      ownerNotes: (prev.ownerNotes || []).filter(n => n.id !== id)
    }));
  };

  const startNoteEdit = (n: OwnerNote) => {
    setEditingNote(n);
    setNoteTitle(n.title); setNoteContent(n.content);
    setNoteItems(n.items || []); setNoteDeadline(n.deadline || '');
    setActiveTab('notebook');
  };

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
    
    // Определение кого тегать и какие username писать в заголовке
    let mentionTags = '';
    let headerAddon = '';
    
    if (task.assignedTo === 'Mentor') {
      mentionTags = '<a href="tg://user?id=7475447497">@adm_mentr</a>';
      headerAddon = ' (@adm_mentr)';
    } else if (task.assignedTo === 'Rector') {
      mentionTags = '<a href="tg://user?id=6537516111">@adm_rctr</a>';
      headerAddon = ' (@adm_rctr)';
    } else if (task.assignedTo === 'Admins' || task.assignedTo === 'All') {
      mentionTags = '<a href="tg://user?id=7475447497">@adm_mentr</a> и <a href="tg://user?id=6537516111">@adm_rctr</a>';
      headerAddon = ' (@adm_mentr, @adm_rctr)';
    } else {
      mentionTags = '@continental_agency';
    }

    const typeLabel = TYPE_META[task.taskType]?.label || 'Задача';
    const prioLabel = PRIORITY_META[task.priority]?.label || 'Средний';
    const prioEmoji = PRIORITY_META[task.priority]?.emoji || '⚡️';

    let message = `🚨 <b>CORE${headerAddon}: Новая задача</b>\n\n`;
    message += `<b>Тип:</b> ${typeLabel}\n`;
    message += `<b>Приоритет:</b> ${prioEmoji} ${prioLabel}\n`;
    if (task.dueDate) {
      message += `<b>Дедлайн:</b> ${new Date(task.dueDate).toLocaleDateString()}\n`;
    }
    message += `\n<b>Задача:</b> ${task.title}\n\n`;
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

    const finalAssigned = newTaskTarget === 'owner' ? currentOwner : newTaskAssigned;

    if (editingTask) {
        updateState(prev => ({
            ...prev,
            ownerTasks: (prev.ownerTasks || []).map(t => t.id === editingTask.id ? {
                ...t,
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
        const task: OwnerTask = {
            id: `task-${Date.now()}`,
            title: newTaskTitle, description: newTaskDesc, status: 'idea',
            priority: newTaskPriority, taskType: newTaskType, assignedTo: finalAssigned as TaskAssignee,
            dueDate: newTaskDueDate || undefined,
            recurrenceCycle: newTaskType === 'recurring' ? newTaskCycle : undefined,
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

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[9px] font-black text-amber-500 uppercase tracking-widest">Стратегический надзор штаба</div>
          </div>
          <div className="flex items-center gap-4">
            <h1 className="text-4xl font-black font-outfit text-white tracking-tight">Ядро управления</h1>
            <PeriodBadge state={state} />
          </div>
        </div>
        <div className="flex flex-col gap-3 items-end">
          <div className="flex bg-slate-900/50 p-1 rounded-xl border border-slate-800">
            <button onClick={() => setActiveTab('manager')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'manager' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Задачи</button>
            <button onClick={() => setActiveTab('notebook')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'notebook' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Блокнот</button>
          </div>
          <div className="flex gap-2">
            {['Andrey', 'Anton', 'Owners'].map(id => (
              <button key={id} onClick={() => setCurrentOwner(id as any)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${currentOwner === id ? 'bg-amber-600 text-white shadow-lg' : 'bg-slate-900 text-slate-500'}`}>
                {ASSIGNEE_LABELS[id as TaskAssignee]}
              </button>
            ))}
          </div>
        </div>
      </header>

      {activeTab === 'manager' ? (
        <>
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
              <div>
                 <h2 className="text-xl font-black font-outfit text-white mb-2">{editingTask ? 'Изменить инициативу' : 'Запустить задачу'}</h2>
                 <div className="flex gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800">
                    <button onClick={() => setNewTaskTarget('admin')} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${newTaskTarget === 'admin' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>Для Админов</button>
                    <button onClick={() => setNewTaskTarget('owner')} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${newTaskTarget === 'owner' ? 'bg-amber-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>Для Себя</button>
                 </div>
              </div>

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

                 <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                       <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Исполнитель</label>
                       <select 
                        disabled={newTaskTarget === 'owner'}
                        className={`w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-[10px] text-white font-bold outline-none ${newTaskTarget === 'owner' ? 'opacity-50 grayscale' : ''}`} 
                        value={newTaskTarget === 'owner' ? currentOwner : newTaskAssigned} 
                        onChange={e => setNewTaskAssigned(e.target.value as any)}
                       >
                          {Object.entries(ASSIGNEE_LABELS)
                            .filter(([val]) => newTaskTarget === 'owner' ? (val === 'Andrey' || val === 'Anton' || val === 'Owners') : (val === 'Rector' || val === 'Mentor' || val === 'Admins' || val === 'All'))
                            .map(([val, lab]) => <option key={val} value={val}>{lab}</option>)}
                       </select>
                    </div>
                    <div className="space-y-1">
                       <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Дедлайн</label>
                       <input 
                         type="date" 
                         className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-[10px] text-white outline-none"
                         value={newTaskDueDate}
                         onChange={e => setNewTaskDueDate(e.target.value)}
                       />
                    </div>
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

              // Логика дедлайна
              const now = new Date();
              const dueDate = task.dueDate ? new Date(task.dueDate) : null;
              const isOverdue = dueDate && now > dueDate && task.status !== 'completed';
              const isClosing = dueDate && !isOverdue && (dueDate.getTime() - now.getTime()) < 86400000 && task.status !== 'completed';

              let overdueText = "";
              if (isOverdue) {
                 if (task.assignedTo === 'Mentor') overdueText = "⚠️ АДМИН MENTOR ПРОСРОЧИЛ ЗАДАЧУ!";
                 else if (task.assignedTo === 'Rector') overdueText = "⚠️ АДМИН RECTOR ПРОСРОЧИЛ ЗАДАЧУ!";
                 else overdueText = "⚠️ АДМИНИСТРАЦИЯ ПРОСРОЧИЛА ЗАДАЧУ!";
              }

              return (
                <div key={task.id} className={`glass-card rounded-[32px] border transition-all duration-300 overflow-hidden ${isOverdue ? 'border-rose-600 bg-rose-600/5' : task.status === 'review' ? 'border-amber-500 ring-4 ring-amber-500/10' : 'border-slate-800'}`}>
                   <div className="p-7 flex flex-col md:flex-row justify-between gap-6">
                      <div className="flex-1 space-y-4">
                         <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black tracking-widest ${prio.bg} ${prio.color}`}>{prio.label}</span>
                            <span className="text-[8px] bg-slate-950 text-indigo-400 px-2 py-0.5 rounded border border-slate-800 font-black uppercase">👤 {ASSIGNEE_LABELS[task.assignedTo]}</span>
                            {task.dueDate && (
                               <span className={`text-[8px] px-2 py-0.5 rounded font-black border ${isOverdue ? 'bg-rose-600 text-white border-rose-500' : isClosing ? 'bg-amber-600 text-white border-amber-500 animate-pulse' : 'bg-slate-950 text-slate-500 border-slate-800'}`}>
                                  📅 ДО: {new Date(task.dueDate).toLocaleDateString()}
                               </span>
                            )}
                            {task.status === 'review' && <span className="text-[8px] bg-amber-500 text-slate-950 px-2 py-0.5 rounded font-black uppercase animate-pulse">РАБОТА ЗАВЕРШЕНА — ПРОВЕРЬТЕ</span>}
                         </div>
                         
                         <h3 className="text-xl font-bold font-outfit text-white tracking-tight">{task.title}</h3>
                         
                         {isOverdue && (
                            <div className="py-2 px-3 bg-rose-600 rounded-xl text-[10px] font-black text-white uppercase tracking-widest inline-block animate-bounce shadow-lg shadow-rose-600/20">
                               {overdueText}
                            </div>
                         )}

                         {isClosing && (
                            <div className="py-1 px-2 bg-amber-500/20 rounded-lg text-[9px] font-black text-amber-500 uppercase tracking-widest inline-block">
                               ⏳ Срок истекает скоро (Менее 24ч)
                            </div>
                         )}

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
                            <button onClick={() => startEditing(task)} className="w-10 h-10 rounded-2xl flex items-center justify-center bg-slate-950 border border-slate-800 text-slate-600 hover:text-white transition-all hover:border-indigo-500/50"><ICONS.Edit size={16}/></button>
                            <button onClick={() => deleteTask(task.id)} className="w-10 h-10 rounded-2xl flex items-center justify-center bg-slate-950 border border-slate-800 text-slate-600 hover:text-rose-500 transition-all hover:border-rose-500/50"><ICONS.Trash size={16}/></button>
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
        </>
      ) : (
        <div className="max-w-5xl mx-auto space-y-4">
           {/* Navigation Tabs for Notebook */}
           <div className="flex gap-2 mb-2 p-1 bg-slate-950/50 rounded-2xl border border-slate-800/50 w-fit">
              <button 
                onClick={() => setIsArchiveOpen(false)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all ${!isArchiveOpen ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Активный документ
              </button>
              <button 
                onClick={() => setIsArchiveOpen(true)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all ${isArchiveOpen ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Архив выполненных
              </button>
           </div>

           {!isArchiveOpen ? (
              <div className="glass-card rounded-[32px] border border-slate-800 bg-slate-900/30 overflow-hidden shadow-2xl flex flex-col min-h-[850px] relative">
                 {/* Decorative background elements for Wow effect */}
                 <div className="absolute inset-0 pointer-events-none opacity-5">
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,#6366f1,transparent_70%)]"></div>
                 </div>

                 {/* Word Toolbar */}
                 <div className="bg-slate-950/95 border-b border-slate-800 p-2 flex flex-wrap items-center gap-1 sticky top-0 z-20 backdrop-blur-3xl shadow-xl">
                    <div className="flex items-center gap-0.5 border-r border-slate-800 pr-2">
                       <button onClick={() => exec('bold')} className="w-8 h-8 rounded hover:bg-slate-800 flex items-center justify-center text-slate-300 font-bold" title="Жирный">B</button>
                       <button onClick={() => exec('italic')} className="w-8 h-8 rounded hover:bg-slate-800 flex items-center justify-center text-slate-300 italic" title="Курсив">I</button>
                       <button onClick={() => exec('underline')} className="w-8 h-8 rounded hover:bg-slate-800 flex items-center justify-center text-slate-300 underline" title="Подчеркнутый">U</button>
                    </div>

                    <div className="flex items-center gap-0.5 border-r border-slate-800 px-2">
                       <button onClick={() => exec('insertUnorderedList')} className="w-8 h-8 rounded hover:bg-slate-800 flex items-center justify-center text-slate-300" title="Маркированный список"><ICONS.List size={16}/></button>
                       <button onClick={() => exec('insertOrderedList')} className="w-8 h-8 rounded hover:bg-slate-800 flex items-center justify-center text-slate-300" title="Нумерованный список"><ICONS.ListOrdered size={16}/></button>
                       <button 
                         onClick={() => {
                           const checkbox = '<input type="checkbox" style="width: 14px; height: 14px; margin-right: 8px; vertical-align: middle;" />';
                           exec('insertHTML', checkbox);
                         }} 
                         className="w-8 h-8 rounded hover:bg-slate-800 flex items-center justify-center text-slate-300" 
                         title="Добавить чек-бокс"
                       >
                         <ICONS.CheckSquare size={16}/>
                       </button>
                    </div>

                    <div className="flex items-center gap-1 border-r border-slate-800 px-2 relative">
                       <button onClick={() => setShowColorPicker(!showColorPicker)} className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-800 text-slate-300">
                          <ICONS.Baseline size={16}/>
                          <ICONS.ChevronDown size={10}/>
                       </button>
                       
                       {showColorPicker && (
                         <div className="absolute top-full left-0 mt-1 p-2 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-30 grid grid-cols-5 gap-1 animate-in fade-in zoom-in duration-200">
                           {['#ffffff', '#f87171', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6', '#94a3b8', '#000000', '#4ade80'].map(c => (
                             <button 
                               key={c} 
                               onClick={() => { exec('foreColor', c); setShowColorPicker(false); }} 
                               className="w-6 h-6 rounded border border-white/10 hover:scale-125 transition-transform" 
                               style={{ backgroundColor: c }}
                             />
                           ))}
                           <button onClick={() => { exec('hiliteColor', '#fbbf24'); setShowColorPicker(false); }} className="col-span-5 text-[9px] font-black uppercase text-slate-500 py-1 hover:text-white">Маркер (Желтый)</button>
                           <button onClick={() => { exec('removeFormat'); setShowColorPicker(false); }} className="col-span-5 text-[9px] font-black uppercase text-rose-500 py-1 hover:text-rose-400">Сброс</button>
                         </div>
                       )}
                    </div>

                    {/* Stage Controls */}
                    <div className="flex items-center gap-2 px-3 border-r border-slate-800">
                       <button 
                         onClick={insertNextTask}
                         className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-indigo-400 text-[9px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-2"
                       >
                         <ICONS.Plus size={12}/> Следующая задача
                       </button>
                       <button 
                         onClick={completeCurrentTask}
                         className="px-3 py-1.5 bg-emerald-600/20 border border-emerald-500/30 rounded-lg text-emerald-400 text-[9px] font-black uppercase hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-2"
                       >
                         <ICONS.Check size={12}/> Выполнено
                       </button>
                    </div>

                    <div className="ml-auto flex items-center gap-3 pr-4">
                       <div className="flex flex-col items-end">
                          <span className="text-[9px] font-black text-slate-500 uppercase leading-none">Smart Editor v2</span>
                          <span className="text-[8px] text-indigo-400/80 font-bold uppercase tracking-tighter">Continental Cloud</span>
                       </div>
                       <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.4)]"></div>
                    </div>
                 </div>

                 {/* The "Sheet" - Dark Theme with Wow effect */}
                 <div className="flex-1 bg-slate-950 p-4 md:p-12 overflow-y-auto scroll-smooth">
                    <div className="max-w-[850px] mx-auto min-h-[1100px] bg-[#1a1d25] rounded-xl shadow-[0_30px_100px_rgba(0,0,0,0.6)] border border-slate-800/40 p-12 md:p-24 text-slate-100 transition-all focus-within:ring-4 ring-indigo-500/5 relative overflow-hidden notebook-editor">
                       {/* Texture overlay */}
                       <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
                       
                       <div 
                          ref={editorRef}
                          contentEditable
                          className="w-full h-full min-h-[900px] outline-none text-[17px] leading-[1.8] font-sans prose prose-invert max-w-none relative z-10"
                          onInput={handleEditorInput}
                          onBlur={handleEditorInput}
                          onClick={(e) => {
                             const target = e.target as HTMLElement;
                             if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'checkbox') {
                                 handleEditorInput();
                             }
                          }}
                       />
                    </div>
                 </div>
              </div>
           ) : (
              <div className="glass-card rounded-[32px] border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl flex flex-col min-h-[850px] animate-in slide-in-from-bottom-4 duration-500">
                 <div className="bg-slate-900/50 border-b border-slate-800 p-6 flex items-center justify-between">
                    <div>
                       <h3 className="text-xl font-bold font-outfit text-white">Архив выполненных задач</h3>
                       <p className="text-xs text-slate-500">История ваших достижений и завершенных циклов</p>
                    </div>
                    <button onClick={() => updateState(prev => ({ ...prev, completedDocument: '' }))} className="text-rose-500 text-[10px] font-bold uppercase tracking-widest hover:text-rose-400 transition-colors">Очистить историю</button>
                 </div>
                 <div className="flex-1 p-12 overflow-y-auto">
                    <div className="max-w-[850px] mx-auto bg-[#14171d] rounded-lg p-12 md:p-20 text-slate-400 font-sans leading-relaxed border border-slate-800">
                       {state.completedDocument ? (
                          <div dangerouslySetInnerHTML={{ __html: state.completedDocument }} className="prose prose-invert max-w-none" />
                       ) : (
                          <div className="h-[400px] flex flex-col items-center justify-center text-slate-700">
                             <ICONS.ClipboardList size={48} className="mb-4 opacity-20"/>
                             <p className="uppercase tracking-[0.2em] text-[10px] font-black">Архив пуст</p>
                          </div>
                       )}
                    </div>
                 </div>
              </div>
           )}
           <div className="text-center pb-10">
              <p className="text-[10px] text-slate-700 font-black uppercase tracking-[0.3em] italic opacity-40 hover:opacity-100 transition-opacity cursor-default">
                Continental Digital Workspace — Professional Management Suite v2.0
              </p>
           </div>
        </div>
      )}
    </div>
  );
};

export default OwnerTable;
