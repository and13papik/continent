import React, { useState, useMemo } from 'react';
import { AppState, OwnerTask, TaskPriority, TaskStatus, TaskNote, TaskType, TaskAssignee, TaskAuditEntry } from '../types';
import { ICONS } from '../constants';
import PeriodBadge from '../components/PeriodBadge';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Clock, 
  Settings, 
  Plus, 
  Search, 
  Send, 
  Terminal, 
  User, 
  CheckCircle2, 
  Trash2, 
  Eye, 
  Layers, 
  Calendar, 
  Activity, 
  AlertCircle,
  FileText,
  BadgeAlert,
  ChevronDown,
  Check
} from 'lucide-react';

const TG_TOKEN = '8497961851:AAEmwmEgJNV6KwyQjdcG62GY3IdX8zz6YV4';
const DEFAULT_CHAT_ID = '-1003748692600';

// --- ПОМОЩНИКИ ---
function StrategyInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void, placeholder?: string }) {
  return (
    <div className="space-y-1.5 font-mono">
      <label className="text-[10px] font-bold text-sky-400 uppercase tracking-widest ml-1">{label}</label>
      <input 
        type="text" 
        className="w-full bg-slate-950/80 border border-slate-800/80 rounded-2xl px-4 py-3 text-xs text-white outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30 transition-all placeholder:text-slate-700 font-sans font-medium" 
        placeholder={placeholder}
        value={value} 
        onChange={e => onChange(e.target.value)} 
      />
    </div>
  );
}

const PRIORITY_META: Record<TaskPriority, { label: string; color: string; bg: string; emoji: string; glow: string }> = {
  urgent: { label: 'КРИТИЧЕСКИЙ', color: 'text-rose-500', bg: 'bg-rose-500/10 border-rose-500/20', emoji: '☢️', glow: 'shadow-[0_0_20px_rgba(244,63,94,0.15)]' },
  high: { label: 'ВЫСОКИЙ', color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/20', emoji: '🔥', glow: 'shadow-[0_0_20px_rgba(245,158,11,0.15)]' },
  medium: { label: 'СРЕДНИЙ', color: 'text-sky-500', bg: 'bg-sky-500/10 border-sky-500/20', emoji: '⚡️', glow: 'shadow-[0_0_20px_rgba(14,165,233,0.15)]' },
  low: { label: 'НИЗКИЙ', color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20', emoji: '☕️', glow: 'shadow-none' }
};

const STATUS_META: Record<TaskStatus, { label: string; color: string; step: number; icon: any; glow: string }> = {
  idea: { label: 'Идея', color: 'text-indigo-400', step: 1, icon: FileText, glow: 'bg-indigo-500/20' },
  in_progress: { label: 'В процессе', color: 'text-sky-400', step: 2, icon: Clock, glow: 'bg-sky-500/20' },
  review: { label: 'На проверке', color: 'text-amber-400', step: 4, icon: Activity, glow: 'bg-amber-500/30 border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.2)] animate-pulse' },
  completed: { label: 'Выполнено', color: 'text-emerald-400', step: 5, icon: CheckCircle2, glow: 'bg-emerald-500/20' },
  blocked: { label: 'Заблокировано', color: 'text-rose-500', step: 3, icon: AlertCircle, glow: 'bg-rose-500/20' },
  waiting_external: { label: 'Ожидание', color: 'text-slate-400', step: 3, icon: Clock, glow: 'bg-slate-450/20' }
};

const ASSIGNEE_LABELS: Record<TaskAssignee, string> = {
  Andrey: 'Андрей', Anton: 'Антон', Rector: 'Admin Rector', Mentor: 'Admin Vi (@adm_viksi_viii)', 
  Owners: 'Владельцы (Общее)', Admins: 'Админы (Общие)', All: 'Весь состав'
};

// --- КАРТОЧКА ЗАДАЧИ ---
const TaskCard: React.FC<{ 
  task: OwnerTask; 
  isEx: boolean; 
  currentRole: string;
  onToggle: (id: string) => void;
  onUpdateStatus: (id: string, s: TaskStatus) => void;
  onDelete: (id: string) => void;
  addNote: (id: string, text: string) => void;
  onUploadScreenshot: (id: string, e: React.ChangeEvent<HTMLInputElement>) => void;
  onViewImage: (url: string) => void;
  onRemoveScreenshot: (id: string, index: number) => void;
}> = ({ task, isEx, currentRole, onToggle, onUpdateStatus, onDelete, addNote, onUploadScreenshot, onViewImage, onRemoveScreenshot }) => {
  const [noteVal, setNoteVal] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [isSendingToTg, setIsSendingToTg] = useState(false);

  const prio = PRIORITY_META[task.priority] || PRIORITY_META.medium;
  const stat = STATUS_META[task.status] || STATUS_META.in_progress;
  const isDirective = task.taskType === 'directive';
  const isCompleted = task.status === 'completed';
  
  // Срок
  const now = new Date();
  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = dueDate && now > dueDate && !isCompleted;
  const isClosing = dueDate && !isOverdue && (dueDate.getTime() - now.getTime()) < 86400000 && !isCompleted;

  const isOwnTask = task.id.startsWith('admin-task');

  const sendTaskToTelegram = async () => {
    setIsSendingToTg(true);
    
    let mentionTags = '';
    let headerAddon = '';
    
    if (task.assignedTo === 'Andrey' || task.assignedTo === 'Anton' || task.assignedTo === 'Owners') {
      mentionTags = '@continental_agency';
      headerAddon = ' (@continental_agency)';
    } else if (task.assignedTo === 'Mentor') {
      mentionTags = '<a href="tg://resolve?domain=adm_viksi_viii">@adm_viksi_viii</a>';
      headerAddon = ' (@adm_viksi_viii)';
    } else if (task.assignedTo === 'Rector') {
      mentionTags = '<a href="tg://user?id=6537516111">@adm_rctr</a>';
      headerAddon = ' (@adm_rctr)';
    } else if (task.assignedTo === 'Admins' || task.assignedTo === 'All') {
      mentionTags = '<a href="tg://resolve?domain=adm_viksi_viii">@adm_viksi_viii</a> и <a href="tg://user?id=6537516111">@adm_rctr</a>';
      headerAddon = ' (@adm_viksi_viii, @adm_rctr)';
    } else {
      mentionTags = 'Администрация';
    }

    const prioLabel = PRIORITY_META[task.priority]?.label || 'Средний';
    const prioEmoji = PRIORITY_META[task.priority]?.emoji || '⚡️';

    let message = `🏛 <b>ADMIN${headerAddon}: Отчет об изменениях по задаче</b>\n\n`;
    message += `<b>Статус операции:</b> ${stat.label}\n`;
    message += `<b>Приоритет:</b> ${prioEmoji} ${prioLabel}\n`;
    if (task.dueDate) {
       message += `<b>Дедлайн:</b> ${new Date(task.dueDate).toLocaleDateString()}\n`;
    }
    message += `\n<b>Задача:</b> ${task.title}\n`;
    if (task.notes.length > 0) {
      message += `<b>Последняя запись:</b> <i>"${task.notes[task.notes.length-1].text}"</i>\n`;
    }
    message += `\n<b>Исполнитель:</b> ${mentionTags}`;

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
              { text: "🛰️ Открыть пульт Владельцев", url: "https://continental.monster/#/owner-table" }
            ]]
          }
        })
      });
      if (res.ok) alert('Уведомление отправлено в Телеграм!');
      else {
        const err = await res.json();
        alert(`Ошибка сети: ${err.description}`);
      }
    } catch (e) {
      alert('Сбой сети при коммуникации.');
    } finally {
      setIsSendingToTg(false);
    }
  };

  return (
    <div className={`relative group bg-slate-950/40 rounded-[2.5rem] border transition-all duration-300 overflow-hidden shadow-lg ${
      isOverdue 
        ? 'border-rose-600 bg-rose-950/5 shadow-rose-950/10' 
        : isDirective 
          ? 'border-amber-500/20 shadow-[0_0_40px_rgba(245,158,11,0.02)]' 
          : 'border-slate-800/70 hover:border-slate-700/80 hover:bg-slate-900/10'
    } ${isCompleted ? 'opacity-40 grayscale-[20%]' : ''}`}>
      <div className="p-8 flex flex-col md:flex-row justify-between gap-6 relative">
        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2.5 py-1 rounded-lg text-[8px] font-extrabold tracking-widest border font-mono ${prio.bg} ${prio.color} ${prio.glow}`}>{prio.label}</span>
            {isDirective && (
              <span className="text-[8px] bg-amber-500 text-slate-950 px-2.5 py-1 rounded-lg font-black uppercase flex items-center gap-1 font-mono shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                <ICONS.Crown size={10}/> ДИРЕКТИВА РУКОВОДСТВА
              </span>
            )}
            <span className="text-[8px] text-slate-500 border border-slate-900 px-2.5 py-1 rounded-lg font-black uppercase tracking-widest font-mono">
              👤 {ASSIGNEE_LABELS[task.assignedTo]}
            </span>
            {task.dueDate && (
               <span className={`text-[8px] px-2.5 py-1 rounded-lg font-black border font-mono flex items-center gap-1.5 ${
                 isOverdue 
                   ? 'bg-rose-600/20 text-rose-400 border-rose-500/20 shadow-lg' 
                   : isClosing 
                     ? 'bg-amber-600 text-white border-amber-500 animate-pulse' 
                     : 'bg-slate-950 text-slate-500 border-slate-900'
               }`}>
                  <Calendar size={10}/> {isOverdue ? 'СРОК ИСТЕК' : `ДО: ${new Date(task.dueDate).toLocaleDateString()}`}
               </span>
            )}
          </div>

          <div className="space-y-1.5">
            <h3 className="text-xl font-bold font-outfit text-white tracking-tight leading-snug group-hover:text-sky-400 transition-colors">
              {task.title}
            </h3>
            {isClosing && (
               <div className="flex items-center gap-1.5 text-amber-500 text-[10px] font-black uppercase tracking-widest font-mono">
                  <BadgeAlert size={12} className="animate-bounce" /> КРАЙНЕ СРОЧНО! Осталось менее 24 ч.
               </div>
            )}
          </div>
          
          <div className="flex items-center gap-4 pt-1">
             <div className="flex-1 h-[2px] bg-slate-950 rounded-full flex overflow-hidden">
                {[1,2,3,4,5].map(step => (
                  <div key={step} className={`flex-1 transition-all duration-1000 ${step <= stat.step ? 'bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.3)]' : 'bg-transparent'}`}></div>
                ))}
             </div>
             <div className="flex items-center gap-2">
                <stat.icon size={12} className={`${stat.color}`} />
                <span className={`text-[9px] font-black uppercase tracking-widest font-mono ${stat.color}`}>{stat.label}</span>
             </div>
          </div>
        </div>

        <div className="flex flex-col md:items-end justify-between gap-4 shrink-0 border-t md:border-t-0 border-slate-900/60 pt-4 md:pt-0">
          <div className="flex items-center gap-2">
             <button 
                onClick={sendTaskToTelegram} 
                disabled={isSendingToTg}
                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all flex items-center gap-1.5 ${
                  isSendingToTg 
                    ? 'bg-slate-900 text-slate-500' 
                    : 'bg-sky-600/10 border-sky-600/30 text-sky-450 hover:bg-sky-600 hover:text-white font-mono shadow-md'
                }`}
             >
                {isSendingToTg ? 'ОТПРАВКА...' : <><Send size={11}/> В ТЕЛЕГРАМ</>}
             </button>
             
             <div className="flex gap-1">
                {['idea', 'in_progress', 'review', 'completed'].map(s => (
                  <button 
                     key={s} 
                     onClick={() => onUpdateStatus(task.id, s as any)}
                     className={`px-2.5 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-normal border transition-all font-mono ${
                       task.status === s 
                         ? 'bg-sky-600/25 border-sky-500/40 text-sky-400 shadow-md shadow-sky-600/5' 
                         : 'bg-slate-950/60 border-slate-900 text-slate-500 hover:border-slate-850 hover:text-slate-300'
                     }`}
                  >
                     {STATUS_META[s as TaskStatus].label}
                  </button>
                ))}
             </div>
             
             {isOwnTask && (
               <button onClick={() => onDelete(task.id)} className="w-9 h-9 rounded-xl flex items-center justify-center transition-all border border-slate-900 bg-slate-1000 hover:text-rose-500 hover:border-rose-500/50 text-slate-500">
                  <Trash2 size={14} />
               </button>
             )}
             <button 
               onClick={() => onToggle(task.id)} 
               className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all bg-slate-950 text-slate-500 hover:text-slate-300 border border-slate-900 ${isEx ? 'bg-sky-600 text-white' : ''}`}
             >
                <Plus size={16} className={`transition-transform duration-300 ${isEx ? 'rotate-45' : ''}`} />
             </button>
          </div>
          <p className="text-[9px] text-slate-600 italic font-mono truncate max-w-[250px]">
            {task.notes.length > 0 ? `Запись: "${task.notes[task.notes.length-1].text}"` : 'Нет протокольных записей'}
          </p>
        </div>
      </div>

      <AnimatePresence>
        {isEx && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-slate-950/80 border-t border-slate-900 px-6 sm:px-8 py-8 space-y-8 overflow-hidden"
          >
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] block font-mono">Контекст выполнения и Цель</label>
                   <div className="text-[13px] text-slate-300 leading-relaxed bg-slate-900/30 p-6 rounded-2xl border border-slate-800/40">
                      {task.description || 'Руководство не прикрепило детальное описание.'}
                      {task.strategyData?.goal && (
                        <div className="mt-4 pt-3 border-t border-slate-800/40 flex flex-col gap-1">
                           <span className="text-amber-500 text-[9px] font-bold uppercase tracking-widest font-mono">Критерий верификации:</span>
                           <span className="text-amber-500 text-[11px] font-bold">{task.strategyData.goal}</span>
                        </div>
                      )}
                   </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] font-mono">Журнал Ведомости</label>
                    <button onClick={() => setShowNote(!showNote)} className="text-[9px] font-black text-sky-500 hover:text-sky-400 flex items-center gap-1.5 font-mono">
                      <Plus size={12} /> ДОБАВИТЬ ЗАПИСЬ
                    </button>
                  </div>
                  
                  <div className="space-y-2.5 max-h-[180px] overflow-y-auto pr-2 custom-scrollbar font-mono">
                     {task.notes.map(n => (
                        <div key={n.id} className="p-4 bg-slate-900/20 rounded-xl border border-slate-850 flex justify-between gap-4 text-[11px]">
                           <span className="text-slate-300 flex-1 leading-relaxed font-sans">{n.text}</span>
                           <span className="text-slate-600 uppercase font-bold text-[8px] self-end">{n.author}</span>
                        </div>
                     ))}
                     {task.notes.length === 0 && (
                        <p className="text-[10px] text-slate-600 italic">Сводный протокол пуст.</p>
                     )}
                  </div>
                </div>
             </div>

             {showNote && (
                <div className="bg-slate-900/40 p-6 rounded-2xl border border-sky-500/10 space-y-4 animate-in zoom-in-95">
                   <textarea 
                     className="w-full bg-transparent border-none outline-none text-xs text-white min-h-[80px] placeholder:text-slate-700 font-sans leading-relaxed" 
                     placeholder="Введите прогресс или примечание..." 
                     value={noteVal} 
                     onChange={e => setNoteVal(e.target.value)} 
                     autoFocus 
                   />
                   <div className="flex justify-end gap-4 font-mono">
                      <button onClick={() => { setNoteVal(''); setShowNote(false); }} className="text-[10px] text-slate-500 uppercase font-black">Отмена</button>
                      <button onClick={() => { addNote(task.id, noteVal); setNoteVal(''); setShowNote(false); }} className="bg-sky-600 px-6 py-2 rounded-xl text-[10px] font-black text-white uppercase tracking-wider shadow-md">Сохранить</button>
                    </div>
                 </div>
              )}

              {/* СКРИНШОТЫ ОТЧЕТОВ */}
              <div className="p-6 rounded-2xl bg-slate-900/20 border border-slate-850 space-y-4">
                 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                       <label className="text-[10px] font-black text-sky-400 uppercase tracking-widest block font-mono">Графические отчеты и снимки подтверждения:</label>
                       <p className="text-[10px] text-slate-500">Прикрепляйте графический результат работы. Скрины доступны владельцам для быстрого утверждения задачи.</p>
                    </div>
                    <label className="cursor-pointer bg-sky-600 hover:bg-sky-500 text-white text-[9px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 active:scale-95 shadow-lg shadow-sky-600/10 shrink-0 font-mono">
                       <Plus size={12} /> Прикрепить снимок
                       <input 
                          type="file" 
                          accept="image/*" 
                          multiple 
                          className="hidden" 
                          onChange={(e) => onUploadScreenshot(task.id, e)} 
                       />
                    </label>
                 </div>

                 {task.screenshots && task.screenshots.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 animate-in zoom-in-95">
                       {task.screenshots.map((src, sIdx) => (
                          <div key={sIdx} className="relative group/img rounded-xl overflow-hidden border border-slate-850 bg-slate-950 aspect-video shadow-md">
                             <img 
                                src={src} 
                                className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300" 
                                onClick={() => onViewImage(src)} 
                                alt="screenshot" 
                                referrerPolicy="no-referrer"
                             />
                             <button 
                                onClick={(e) => { e.stopPropagation(); onRemoveScreenshot(task.id, sIdx); }}
                                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-lg bg-black/85 hover:bg-rose-600 border border-white/10 text-white flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity"
                             >
                                <Trash2 size={12} />
                             </button>
                          </div>
                       ))}
                    </div>
                 ) : (
                    <p className="text-[10px] text-slate-600 italic font-mono">Нет загруженных скриншотов. Нажмите кнопку выше для прикрепления графического отчета.</p>
                  )}
               </div>
            </motion.div>
         )}
      </AnimatePresence>
    </div>
  );
};

// --- ОСНОВНОЙ ЭКРАН ADMIN TABLE ---
const AdminTable: React.FC<{ state: AppState; updateState: (updater: (prev: AppState) => AppState) => void }> = ({ state, updateState }) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [currentAdminRole, setCurrentAdminRole] = useState<'Mentor' | 'Rector' | 'Admins'>('Mentor');
  const [activeMode, setActiveMode] = useState<TaskType>('regular');
  const [secondaryFilter, setSecondaryFilter] = useState<'all' | 'critical' | 'process' | 'review'>('all');
  const [taskSearch, setTaskSearch] = useState('');

  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handleScreenshotUpload = (taskId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        updateState(prev => ({
          ...prev,
          ownerTasks: (prev.ownerTasks || []).map(t => t.id === taskId ? {
            ...t,
            screenshots: [...(t.screenshots || []), base64String]
          } : t)
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveScreenshot = (taskId: string, indexToRemove: number) => {
    updateState(prev => ({
      ...prev,
      ownerTasks: (prev.ownerTasks || []).map(t => t.id === taskId ? {
        ...t,
        screenshots: (t.screenshots || []).filter((_, idx) => idx !== indexToRemove)
      } : t)
    }));
  };

  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTo, setNewTo] = useState<TaskAssignee>('Mentor');
  const [newPrio, setNewPrio] = useState<TaskPriority>('medium');
  const [newGoal, setNewGoal] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDueDate, setNewDueDate] = useState('');

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

  const deleteTask = (id: string) => {
    if (!confirm('Удалить эту задачу навсегда?')) return;
    updateState(prev => ({
      ...prev,
      deletedIds: [...(prev.deletedIds || []), id],
      ownerTasks: (prev.ownerTasks || []).filter(t => t.id !== id)
    }));
  };

  const addNote = (id: string, text: string) => {
    if (!text.trim()) return;
    const note: TaskNote = { id: String(Date.now()), text, author: currentAdminRole, createdAt: new Date().toISOString() };
    updateState(p => ({
      ...p,
      ownerTasks: (p.ownerTasks || []).map(t => t.id === id ? { 
        ...t, notes: [...(t.notes || []), note], 
        auditLog: [...(t.auditLog || []), logAudit('Добавлена протокольная запись', currentAdminRole)],
        updatedAt: new Date().toISOString() 
      } : t)
    }));
  };

  const createAdminTask = () => {
    if (!newTitle.trim()) return;
    const task: OwnerTask = {
        id: `admin-task-${Date.now()}`,
        title: newTitle, 
        description: newDesc || 'Инициировано из панели администратора', 
        status: 'idea',
        priority: newPrio, 
        taskType: 'regular', 
        assignedTo: newTo,
        dueDate: newDueDate || undefined,
        tags: [], 
        notes: [], 
        strategyData: { goal: newGoal, reason: '', effect: '' },
        auditLog: [logAudit('Задача создана админом', currentAdminRole)],
        createdAt: new Date().toISOString(), 
        updatedAt: new Date().toISOString(),
        periodId: state.selectedPeriodId
    };
    updateState(prev => ({ ...prev, ownerTasks: [task, ...(prev.ownerTasks || [])] }));
    setNewTitle(''); setNewGoal(''); setNewDesc(''); setNewDueDate(''); setIsCreating(false);
  };

  // --- ВЫЧИСЛЕНИЕ СТАТИСТИКИ АДМИНА ---
  const adminMetrics = useMemo(() => {
    const tasks = state.ownerTasks || [];
    const myTasks = tasks.filter(t => {
      const isForMe = t.assignedTo === currentAdminRole || t.assignedTo === 'Admins' || t.assignedTo === 'All';
      const iDelegatedToOwner = t.id.startsWith('admin-task') && (t.assignedTo === 'Andrey' || t.assignedTo === 'Anton' || t.assignedTo === 'Owners');
      const matchesPeriod = t.periodId === state.selectedPeriodId;
      return (isForMe || iDelegatedToOwner) && matchesPeriod;
    });

    const activeReg = myTasks.filter(t => t.id.startsWith('admin-task') || t.taskType === 'regular');
    const myProgress = myTasks.filter(t => t.status === 'in_progress').length;
    const myReview = myTasks.filter(t => t.status === 'review').length;
    const myCritical = myTasks.filter(t => t.priority === 'urgent' || t.priority === 'high').length;
    
    // Вычисление просрочки
    const now = new Date();
    const myOverdue = myTasks.filter(t => t.dueDate && now > new Date(t.dueDate) && t.status !== 'completed').length;

    return {
      total: myTasks.length,
      progress: myProgress,
      review: myReview,
      critical: myCritical,
      overdue: myOverdue,
      tasksWithReview: tasks.filter(t => t.status === 'review').length
    };
  }, [state.ownerTasks, currentAdminRole, state.selectedPeriodId]);

  const allTasks = useMemo(() => {
    let list = (state.ownerTasks || []).map(t => {
      if (!t.taskType) t.taskType = t.id.startsWith('admin-task') ? 'regular' : 'directive';
      return t;
    });

    list = list.filter(t => {
      const isForMe = t.assignedTo === currentAdminRole || t.assignedTo === 'Admins' || t.assignedTo === 'All';
      const iDelegatedToOwner = t.id.startsWith('admin-task') && (t.assignedTo === 'Andrey' || t.assignedTo === 'Anton' || t.assignedTo === 'Owners');
      const matchesPeriod = t.periodId === state.selectedPeriodId;
      return (isForMe || iDelegatedToOwner) && matchesPeriod;
    });

    list = list.filter(t => t.taskType === activeMode);

    if (taskSearch.trim() !== '') {
      const q = taskSearch.toLowerCase();
      list = list.filter(t => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || (t.strategyData?.goal || '').toLowerCase().includes(q));
    }

    if (secondaryFilter === 'critical') list = list.filter(t => t.priority === 'urgent' || t.priority === 'high');
    if (secondaryFilter === 'process') list = list.filter(t => t.status === 'in_progress');
    if (secondaryFilter === 'review') list = list.filter(t => t.status === 'review');

    return list;
  }, [state.ownerTasks, currentAdminRole, activeMode, secondaryFilter, state.selectedPeriodId, taskSearch]);

  return (
    <div className="space-y-10 pb-32 max-w-7xl mx-auto px-4 sm:px-6 animate-in fade-in duration-700">
      
      {/* BRAND HEADER */}
      <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 border-b border-slate-900/40 pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-sky-550 shadow-[0_0_15px_rgba(14,165,233,0.7)] animate-pulse"></div>
            <span className="text-[10px] sm:text-[11px] font-black text-sky-400 uppercase tracking-[0.4em] font-mono">АДМИНИСТРАТИВНЫЙ РЕДУКТОР</span>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <h1 className="text-3xl sm:text-5xl font-black font-outfit text-white tracking-tight leading-none bg-gradient-to-r from-white via-slate-205 to-sky-400 bg-clip-text text-transparent">
              Центр Админов
            </h1>
            <PeriodBadge state={state} />
          </div>
          <p className="text-xs text-slate-500 font-outfit">Выполнение плановых задач, ведение рабочих регламентов и отправка отчетов.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center self-start xl:self-end">
          {/* ROLE SELECTOR */}
          <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800/80 gap-1">
            {['Rector', 'Mentor', 'Admins'].map(role => (
              <button 
                key={role} 
                onClick={() => { setCurrentAdminRole(role as any); setNewTo(role as any); }} 
                className={`px-4.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                  currentAdminRole === role 
                    ? 'bg-sky-600/20 text-sky-450 border-sky-500/20 shadow-md' 
                    : 'text-slate-500 hover:text-slate-300 border-transparent'
                }`}
              >
                {ASSIGNEE_LABELS[role as TaskAssignee]}
              </button>
            ))}
          </div>

          {activeMode === 'regular' && (
            <button 
              onClick={() => setIsCreating(!isCreating)} 
              className="px-5 py-3 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-black text-[9px] uppercase tracking-widest transition-all shadow-md shadow-sky-600/10 active:scale-95 flex items-center gap-2"
            >
               <Plus size={12} className={`transition-transform duration-300 ${isCreating ? 'rotate-45' : ''}`} />
               {isCreating ? 'ОТМЕНИТЬ ДЕЛЕГИРОВАНИЕ' : 'ИНИЦИИРОВАТЬ ЗАДАЧУ'}
            </button>
          )}
        </div>
      </header>

      {/* --- HUD СТАТИСТИКИ АДМИНИСТРАТОРА (CYAN ACCENTS HUD GRID) --- */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="relative group overflow-hidden bg-slate-900/20 border border-slate-800/50 p-5 rounded-[24px] hover:border-sky-500/30 transition-all shadow-xl backdrop-blur-md">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-sky-500/5 to-transparent rounded-full pointer-events-none"></div>
          <div className="flex justify-between items-start mb-3">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 font-mono">Ваша ведомость</span>
            <div className="w-7 h-7 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400 border border-sky-500/20"><User size={14}/></div>
          </div>
          <div className="space-y-1">
            <h4 className="text-2xl sm:text-3xl font-black font-outfit text-white leading-none">{adminMetrics.total}</h4>
            <p className="text-[9px] text-slate-500 font-mono">всего задач на сессии</p>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="relative group overflow-hidden bg-slate-900/20 border border-slate-800/50 p-5 rounded-[24px] hover:border-sky-500/30 transition-all shadow-xl backdrop-blur-md">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-sky-400/5 to-transparent rounded-full pointer-events-none"></div>
          <div className="flex justify-between items-start mb-3">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 font-mono">В процессе</span>
            <div className="w-7 h-7 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400 border border-sky-500/20"><Activity size={14}/></div>
          </div>
          <div className="space-y-1">
            <h4 className="text-2xl sm:text-3xl font-black font-outfit text-white leading-none">{adminMetrics.progress}</h4>
            <p className="text-[9px] text-slate-500 font-mono">разрабатывается сменОЙ</p>
          </div>
        </div>

        {/* Metric 3 */}
        <div className={`relative group overflow-hidden border p-5 rounded-[24px] transition-all shadow-xl backdrop-blur-md ${adminMetrics.review > 0 ? 'bg-amber-500/5 border-amber-500/30 animate-pulse' : 'bg-slate-900/20 border-slate-800/50 hover:border-sky-500/30'}`}>
          <div className="flex justify-between items-start mb-3">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 font-mono">Отправлено на аудит</span>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${adminMetrics.review > 0 ? 'bg-amber-500 text-slate-950 border-amber-500/20' : 'bg-slate-800 text-slate-400 border-slate-850'}`}><CheckCircle2 size={14}/></div>
          </div>
          <div className="space-y-1">
            <h4 className={`text-2xl sm:text-3xl font-black font-outfit leading-none ${adminMetrics.review > 0 ? 'text-amber-400' : 'text-white'}`}>{adminMetrics.review}</h4>
            <p className="text-[9px] text-slate-500 font-mono">ожидают подписи владельцев</p>
          </div>
        </div>

        {/* Metric 4 */}
        <div className={`relative group overflow-hidden border p-5 rounded-[24px] transition-all shadow-xl backdrop-blur-md ${adminMetrics.overdue > 0 ? 'bg-rose-500/5 border-rose-500/30 shadow-[0_0_20px_rgba(244,63,94,0.06)]' : 'bg-slate-900/20 border-slate-800/50 hover:border-sky-500/30'}`}>
          <div className="flex justify-between items-start mb-3">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 font-mono">ПРОСРОЧЕННОСТЬ</span>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${adminMetrics.overdue > 0 ? 'bg-rose-500 text-white border-rose-500/20 animate-bounce' : 'bg-slate-800 text-slate-400 border-slate-850'}`}><AlertCircle size={14}/></div>
          </div>
          <div className="space-y-1">
            <h4 className={`text-2xl sm:text-3xl font-black font-outfit leading-none ${adminMetrics.overdue > 0 ? 'text-rose-450' : 'text-white'}`}>{adminMetrics.overdue}</h4>
            <p className="text-[9px] text-slate-500 font-mono">нарушены жесткие дедлайны</p>
          </div>
        </div>
      </section>

      {/* --- FORM FOR INITIATING & DELEGATING (ADMIN CONSOLE BLOCK) --- */}
      {isCreating && activeMode === 'regular' && (
        <div className="relative overflow-hidden bg-gradient-to-b from-slate-900/60 to-slate-950/80 p-8 sm:p-10 rounded-[3rem] border border-sky-500/20 space-y-6 animate-in slide-in-from-top-4 shadow-2xl">
           <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-sky-500/20 to-transparent"></div>
           
           <div>
              <h2 className="text-xl font-bold font-outfit text-white flex items-center gap-2">
                 <Terminal size={18} className="text-sky-400" /> Инициировать задачу / Делегировать
              </h2>
              <p className="text-[10px] text-slate-500 font-mono mt-1">ОПЕРАТИВНЫЙ БЛОК ВНУТРЕННЕГО ПЛАНИРОВАНИЯ</p>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 font-mono">
              <div className="lg:col-span-8 space-y-5">
                 <div className="space-y-4">
                    <div className="space-y-1">
                       <label className="text-[9px] font-black text-slate-550 uppercase tracking-widest ml-1">Название задачи</label>
                       <input 
                         className="w-full bg-slate-950 border border-slate-800/80 rounded-2xl px-5 py-4 text-xs text-white font-bold outline-none focus:border-sky-500/40 font-sans" 
                         placeholder="Суть задачи..." 
                         value={newTitle} 
                         onChange={e => setNewTitle(e.target.value)} 
                       />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[9px] font-black text-slate-550 uppercase tracking-widest ml-1">Общий контекст выполнения</label>
                       <textarea 
                         className="w-full bg-slate-950 border border-slate-800/80 rounded-2xl px-5 py-4 text-xs text-white outline-none min-h-[100px] focus:border-sky-500/40 leading-relaxed font-sans" 
                         placeholder="Детали и инструкции..." 
                         value={newDesc} 
                         onChange={e => setNewDesc(e.target.value)} 
                       />
                    </div>
                 </div>
              </div>

              <div className="lg:col-span-4 space-y-4">
                 <div>
                    <label className="text-[9px] font-black text-slate-550 uppercase tracking-widest ml-1 mb-1 block">Ответственный</label>
                    <select 
                      className="w-full bg-slate-950 border border-slate-800/80 rounded-2xl px-4 py-3.5 text-xs text-white font-bold outline-none cursor-pointer focus:border-sky-500/40" 
                      value={newTo} 
                      onChange={e => setNewTo(e.target.value as any)}
                    >
                       <optgroup label="Администраторы">
                          <option value="Rector">Себе (Rector)</option>
                          <option value="Mentor">Себе (Admin Vi)</option>
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
                 
                 <div className="grid grid-cols-2 gap-3">
                    <div>
                       <label className="text-[9px] font-black text-slate-550 uppercase tracking-widest ml-1 mb-1 block">Приоритет</label>
                       <select 
                         className="w-full bg-slate-950 border border-slate-800/80 rounded-2xl px-4 py-3.5 text-xs text-white font-bold outline-none cursor-pointer focus:border-sky-500/40" 
                         value={newPrio} 
                         onChange={e => setNewPrio(e.target.value as any)}
                       >
                          {Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                       </select>
                    </div>
                    <div>
                       <label className="text-[9px] font-black text-slate-550 uppercase tracking-widest ml-1 mb-1 block">Дедлайн</label>
                       <input 
                          type="date" 
                          className="w-full bg-slate-950 border border-slate-800/80 rounded-2xl px-4 py-3 text-xs text-white font-bold outline-none cursor-pointer focus:border-sky-500/40"
                          value={newDueDate}
                          onChange={e => setNewDueDate(e.target.value)}
                       />
                    </div>
                 </div>
                 
                 <StrategyInput label="Целевой результат" value={newGoal} onChange={setNewGoal} placeholder="Что считаем вехой?.." />
                 
                 <button 
                   onClick={createAdminTask} 
                   className="w-full bg-sky-600 hover:bg-sky-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-sky-600/10 transition-all uppercase tracking-widest text-[10px] active:scale-95 flex items-center justify-center gap-2"
                 >
                   <Check size={12}/> Опубликовать в системе
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* --- SECTIONS AND FILTERS WORKSPACE --- */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center bg-slate-950/40 p-4 rounded-3xl border border-slate-800/60 shadow-inner">
        <div className="flex flex-wrap gap-4 items-center pl-2">
          {[
            { id: 'directive', label: 'ДИРЕКТИВЫ' },
            { id: 'regular', label: 'ЗАДАЧИ' },
            { id: 'recurring', label: 'РЕГЛАМЕНТ СМЕН' }
          ].map((mode) => (
            <button 
              key={mode.id} 
              onClick={() => { setActiveMode(mode.id as any); setSecondaryFilter('all'); }} 
              className={`relative py-1.5 px-3 text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${activeMode === mode.id ? `text-sky-400 font-extrabold` : 'text-slate-500 hover:text-slate-300'}`}
            >
              {mode.label}
              {activeMode === mode.id && (
                <motion.div 
                  layoutId="activeAdminModeIndicator" 
                  className="absolute -bottom-4 left-0 right-0 h-0.5 bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.5)] rounded-full" 
                />
              )}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto items-stretch sm:items-center">
          {/* SEARCH BOX */}
          <div className="relative flex-1 sm:w-60">
            <Search size={12} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
            <input 
              type="text" 
              className="w-full bg-slate-950 border border-slate-800 px-8 py-2 rounded-xl text-[10px] text-white outline-none focus:border-sky-500/40 placeholder:text-slate-755 font-mono" 
              placeholder="Искать в ведомости..."
              value={taskSearch}
              onChange={e => setTaskSearch(e.target.value)}
            />
            {taskSearch && (
              <button onClick={() => setTaskSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[9px] uppercase font-bold text-slate-500 hover:text-white font-mono">×</button>
            )}
          </div>

          {/* SECONDARY FILTER */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar bg-slate-950 p-1 rounded-xl">
             {[
               { id: 'all', label: 'ВСЕ' },
               { id: 'critical', label: 'КРИТИЧЕСКИЕ' },
               { id: 'process', label: 'В РАБОТЕ' },
               { id: 'review', label: 'НА ПРОВЕРКЕ' }
             ].map(f => (
               <button 
                 key={f.id} 
                 onClick={() => setSecondaryFilter(f.id as any)} 
                 className={`text-[8px] font-black uppercase tracking-wider whitespace-nowrap px-3 py-1.5 rounded-lg transition-all ${secondaryFilter === f.id ? 'text-white bg-slate-800' : 'text-slate-600 hover:text-slate-400'}`}
               >
                 {f.label}
               </button>
             ))}
          </div>
        </div>
      </div>

      {/* --- СПИСОК КАРТОЧЕК --- */}
      <div className="space-y-4 px-1">
        <AnimatePresence mode="popLayout">
          {allTasks.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="py-44 text-center border-2 border-dashed border-slate-900 rounded-[32px] text-slate-600 flex flex-col items-center justify-center gap-4"
            >
               <Terminal size={32} className="opacity-10 mb-2 text-sky-400" />
               <p className="font-extrabold uppercase tracking-[0.25em] text-[10px]">Ведомость чиста</p>
               <p className="text-[10px] font-sans text-slate-500 tracking-normal normal-case italic">Нет поручений, подходящих под текущий фильтр сессии.</p>
            </motion.div>
          ) : allTasks.map((t, idx) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0, transition: { delay: Math.min(idx * 0.04, 0.45) } }}
              exit={{ opacity: 0, scale: 0.95 }}
              layout
            >
              <TaskCard 
                task={t} 
                currentRole={currentAdminRole}
                isEx={expanded.has(t.id)} 
                onToggle={id => { const n = new Set(expanded); if(n.has(id)) n.delete(id); else n.add(id); setExpanded(n); }} 
                onUpdateStatus={updateStatus} 
                onDelete={deleteTask}
                addNote={addNote}
                onUploadScreenshot={handleScreenshotUpload}
                onViewImage={setSelectedImage}
                onRemoveScreenshot={handleRemoveScreenshot}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* 🔮 ВАУ-ЭФФЕКТ СЛАЙДЕР / ЛАЙТБОКС ДЛЯ СКРИНШОТОВ */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-slate-950/98 z-[9999] flex flex-col items-center justify-center p-4 backdrop-blur-xl animate-in fade-in duration-300"
          onClick={() => setSelectedImage(null)}
        >
          <button 
            onClick={() => setSelectedImage(null)}
            className="absolute top-6 right-6 text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-2xl text-[10px] uppercase font-black tracking-widest transition-all font-mono"
          >
            Закрыть ×
          </button>
          <img 
            src={selectedImage} 
            className="max-w-[92vw] max-h-[85vh] object-contain rounded-2xl shadow-[0_0_80px_rgba(255,255,255,0.08)] border border-white/10 select-none cursor-zoom-out animate-in zoom-in-95 duration-200" 
            alt="Full screen preview" 
            referrerPolicy="no-referrer"
          />
          <p className="text-[10px] text-slate-500 font-mono mt-4 uppercase tracking-widest">Просмотр графического подтверждения</p>
        </div>
      )}

    </div>
  );
};

export default AdminTable;
