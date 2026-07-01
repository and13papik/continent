import React, { useState, useMemo } from 'react';
import { AppState, OwnerTask, TaskPriority, TaskStatus, TaskNote, TaskType, TaskAssignee, TaskAuditEntry, TaskDescriptionBlock, TaskReport } from '../types';
import { BlockDescriptionEditor, BlockDescriptionViewer } from '../components/BlockDescriptionEditor';
import { TaskReportSection } from '../components/TaskReportSection';
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
  Check,
  Image
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
  onUpdateReport: (id: string, report: TaskReport) => void;
}> = ({ task, isEx, currentRole, onToggle, onUpdateStatus, onDelete, addNote, onUploadScreenshot, onViewImage, onRemoveScreenshot, onUpdateReport }) => {
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

    let message = `🏛 <b>ADMIN${headerAddon}: Новое задание</b>\n\n`;
    message += `Посмотрите на платформе\n\n`;
    message += `<b>Статус:</b> ${stat.label}\n`;
    message += `<b>Приоритет:</b> ${prioEmoji} ${prioLabel}\n`;
    message += `<b>Анкеты:</b> 💄 ${task.models && task.models.length > 0 ? task.models.join(', ') : 'Все'}\n`;
    if (task.dueDate) {
       message += `<b>Дедлайн:</b> ${new Date(task.dueDate).toLocaleDateString()}\n`;
    }
    message += `\n<b>Исполнитель:</b> ${mentionTags}`;

    // Функция ручной конвертации base64 в Blob
    const dataURLtoBlob = (dataurl: string) => {
      try {
        const arr = dataurl.split(',');
        const mimeMatch = arr[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/png';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
      } catch (err) {
        console.error("Manual blob conversion failed:", err);
        return null;
      }
    };

    // Сбор изображений из скриншотов и блоков описания
    const photos: string[] = [];
    if (task.screenshots && task.screenshots.length > 0) {
      photos.push(...task.screenshots);
    }
    if (task.descriptionBlocks && task.descriptionBlocks.length > 0) {
      task.descriptionBlocks.forEach(b => {
        if (b.type === 'image' && b.imageSrc) {
          photos.push(b.imageSrc);
        }
      });
    }

    try {
      let res;
      if (photos.length > 0) {
        const firstPhoto = photos[0];
        const formData = new FormData();
        formData.append('chat_id', DEFAULT_CHAT_ID);
        formData.append('caption', message);
        formData.append('parse_mode', 'HTML');
        formData.append('reply_markup', JSON.stringify({
          inline_keyboard: [[
            { text: "🛰️ Открыть пульт Владельцев", url: "https://continental.monster/#/owner-table" }
          ]]
        }));

        if (firstPhoto.startsWith('data:')) {
          const blob = dataURLtoBlob(firstPhoto);
          if (blob) {
            const ext = blob.type.split('/')[1] || 'png';
            formData.append('photo', blob, `image.${ext}`);
          } else {
            formData.append('photo', firstPhoto);
          }
        } else {
          formData.append('photo', firstPhoto);
        }

        res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendPhoto`, {
          method: 'POST',
          body: formData
        });

        // Если дополнительных фото больше одной, отправим их тоже
        if (res.ok && photos.length > 1) {
          for (let i = 1; i < photos.length; i++) {
            const extraPhoto = photos[i];
            const extraFormData = new FormData();
            extraFormData.append('chat_id', DEFAULT_CHAT_ID);
            extraFormData.append('caption', `Фото к заданию [${i + 1}]`);
            if (extraPhoto.startsWith('data:')) {
              const extraBlob = dataURLtoBlob(extraPhoto);
              if (extraBlob) {
                const ext = extraBlob.type.split('/')[1] || 'png';
                extraFormData.append('photo', extraBlob, `image_${i}.${ext}`);
              } else {
                extraFormData.append('photo', extraPhoto);
              }
            } else {
              extraFormData.append('photo', extraPhoto);
            }
            await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendPhoto`, {
              method: 'POST',
              body: extraFormData
            });
          }
        }
      } else {
        res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
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
      }

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
            <span className="text-[8px] text-pink-400 bg-pink-950/20 border border-pink-900/35 px-2.5 py-1 rounded-lg font-black uppercase tracking-widest font-mono">
              💄 АНКЕТЫ: {task.models && task.models.length > 0 ? task.models.join(', ') : 'ДЛЯ ВСЕХ'}
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
             
             <div className="flex flex-col gap-1.5 items-end">
                <div className="flex gap-1">
                   {['idea', 'in_progress', 'review', 'completed'].map(s => (
                     <button 
                        key={s} 
                        onClick={() => {
                          onUpdateStatus(task.id, s as any);
                          if (s === 'completed' && !isEx) onToggle(task.id);
                        }}
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
                {task.taskReport?.statusChoice === 'report_attached' && (
                  <span className="text-[7.5px] text-emerald-400 font-extrabold tracking-widest uppercase font-mono bg-emerald-500/5 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                     ✓ ОТЧЕТ ПРИКРЕПЛЕН
                  </span>
                )}
                {task.taskReport?.statusChoice === 'no_report_needed' && (
                  <span className="text-[7.5px] text-slate-500 font-extrabold tracking-widest uppercase font-mono bg-slate-950/60 border border-slate-900 px-2 py-0.5 rounded-md">
                     ✗ ОТЧЕТ НЕ ТРЕБУЕТСЯ
                  </span>
                )}
                {isCompleted && !task.taskReport?.statusChoice && (
                  <span className="text-[7.5px] text-amber-500 font-black tracking-widest uppercase font-mono bg-amber-500/5 border border-amber-500/20 px-2 py-0.5 rounded-md animate-pulse">
                     ⚠ СДЕЛАЙТЕ ОТЧЕТ!
                  </span>
                )}
              </div>
             
             {isOwnTask && (
               <button onClick={() => onDelete(task.id)} className="w-9 h-9 rounded-xl flex items-center justify-center transition-all border border-slate-900 bg-slate-1000 hover:text-rose-500 hover:border-rose-500/50 text-slate-500">
                  <Trash2 size={14} />
               </button>
             )}
             <button 
                onClick={() => onToggle(task.id)} 
                className={`px-4.5 py-2.5 rounded-2xl text-[9px] font-black uppercase tracking-widest border transition-all flex items-center gap-1.5 font-mono ${
                  isEx 
                    ? 'bg-sky-600 border-sky-500 text-white shadow-lg shadow-sky-600/15' 
                    : 'bg-slate-950 hover:bg-slate-900 border-slate-900 hover:border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                 <span>{isEx ? 'СВЕРНУТЬ ОПИСАНИЕ' : 'РАЗВЕРНУТЬ ОПИСАНИЕ'}</span>
                 <ChevronDown size={11} className={`transition-transform duration-300 ${isEx ? 'rotate-180' : ''}`} />
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
                      <BlockDescriptionViewer blocks={task.descriptionBlocks} fallbackText={task.description || 'Руководство не прикрепило детальное описание.'} />
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
                           <span className="text-slate-600 uppercase font-bold text-[8px] self-end">
                             {n.author === 'All' ? 'ОБЩЕЕ (Rector + Admin VI)' : n.author === 'Rector' ? 'Rector' : n.author === 'Mentor' ? 'Admin Vi' : n.author}
                           </span>
                        </div>
                     ))}
                     {task.notes.length === 0 && (
                        <p className="text-[10px] text-slate-600 italic">Сводный протокол пуст.</p>
                     )}
                  </div>
                </div>
             </div>

             
              {/* СКРИНШОТЫ ИЗОБРАЖЕНИЙ ПОДТВЕРЖДЕНИЯ */}
              <div className="pt-6 border-t border-slate-900/60 space-y-4">
                 <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="space-y-0.5">
                       <label className="text-[10px] font-black text-sky-450 uppercase tracking-[0.2em] block font-mono">Файловые отчеты и прикрепленные скриншоты:</label>
                       <p className="text-[9px] text-slate-500 font-mono">Визуальные подтверждения проделанной работы</p>
                    </div>
                    <label className="cursor-pointer bg-sky-600/10 hover:bg-sky-600 border border-sky-600/20 hover:border-sky-500 text-sky-400 hover:text-white text-[9px] font-black uppercase tracking-wider px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 active:scale-95 font-mono">
                      <Plus size={11} /> Прикрепить отчет
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => onUploadScreenshot(task.id, e)} 
                      />
                    </label>
                 </div>

                 {task.screenshots && task.screenshots.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4 animate-in zoom-in-95">
                      {task.screenshots.map((src, sIdx) => (
                        <div key={sIdx} className="relative group/img rounded-2xl overflow-hidden border border-slate-850 bg-slate-1000 aspect-video shadow-md">
                          <img 
                            src={src} 
                            className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300" 
                            onClick={() => onViewImage(src)} 
                            alt="screenshot" 
                            referrerPolicy="no-referrer"
                          />
                          <button 
                            type="button"
                            onClick={() => {
                              if (confirm('Вы уверены, что хотите удалить этот скриншот?')) {
                                onRemoveScreenshot(task.id, sIdx);
                              }
                            }}
                            className="absolute top-2 right-2 w-6 h-6 rounded-lg bg-black/85 hover:bg-rose-600 border border-white/10 text-white flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                 ) : (
                    <div className="flex flex-col items-center justify-center py-8 px-4 rounded-2xl bg-slate-900/10 border border-dashed border-slate-850/60 text-slate-500">
                      <Image size={24} className="text-slate-750 mb-2 stroke-1" />
                      <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Нет прикрепленных изображений</p>
                    </div>
                 )}
              </div>

              
              {/* РАЗДЕЛ ОТЧЕТА ПО ЗАДАНИЮ */}
              <TaskReportSection 
                task={task}
                isOwner={false}
                currentUserRole={currentRole}
                onSaveReport={(report) => onUpdateReport(task.id, report)}
              />

              {showNote && (
                 <div className="bg-slate-900/40 p-6 rounded-2xl border border-sky-500/10 space-y-4 animate-in zoom-in-95">
                    <textarea 
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white outline-none min-h-[80px]"
                        placeholder="Текст протокольной записи..."
                        value={noteVal}
                        onChange={e => setNoteVal(e.target.value)}
                    />
                    <div className="flex justify-end gap-2 font-mono">
                      <button 
                        onClick={() => { addNote(task.id, noteVal); setNoteVal(''); setShowNote(false); }}
                        className="bg-sky-600 hover:bg-sky-500 px-4 py-1.5 rounded-lg text-white text-[10px] font-black uppercase transition-colors"
                      >
                        Сохранить
                      </button>
                    </div>
                 </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
  );
};

const AdminTable: React.FC<{ 
  state: AppState; 
  updateState: (fn: (prev: AppState) => AppState) => void; 
}> = ({ state, updateState }) => {
  const [currentAdminRole, setCurrentAdminRole] = useState<'All' | 'Rector' | 'Mentor'>('All');
  
  const [activeMode, setActiveMode] = useState<'directive' | 'regular' | 'recurring'>('regular');
  const [secondaryFilter, setSecondaryFilter] = useState<'all' | 'critical' | 'process' | 'review'>('all');
  const [taskSearch, setTaskSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDescBlocks, setNewDescBlocks] = useState<TaskDescriptionBlock[]>([]);
  const [newTo, setNewTo] = useState<TaskAssignee>('All');
  const [newPrio, setNewPrio] = useState<TaskPriority>('medium');
  const [newDueDate, setNewDueDate] = useState('');
  const [newGoal, setNewGoal] = useState('');
  const [newSelectedModels, setNewSelectedModels] = useState<string[]>([]);

  const createAdminTask = () => {
    if (!newTitle.trim()) return;
    const compiledDesc = newDescBlocks.length > 0
      ? newDescBlocks.map(b => b.type === 'text' ? b.text : `[Фото: ${b.caption || ''}]`)
          .join('\n\n')
          .replace(/<[^>]*>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .trim()
      : (newDesc || 'Инициировано из панели администратора');

    const task: OwnerTask = {
        id: `admin-task-${Date.now()}`,
        title: newTitle, 
        description: compiledDesc, 
        descriptionBlocks: newDescBlocks,
        status: 'idea',
        priority: newPrio, 
        taskType: activeMode === 'directive' ? 'directive' : activeMode === 'recurring' ? 'recurring' : 'regular', 
        assignedTo: newTo,
        dueDate: newDueDate || undefined,
        models: newSelectedModels.length > 0 ? newSelectedModels : undefined,
        tags: [], 
        notes: [], 
        strategyData: { goal: newGoal, reason: '', effect: '' },
        auditLog: [
          {
            id: `audit-${Date.now()}`,
            timestamp: new Date().toISOString(),
            action: 'Задача создана администратором',
            actor: currentAdminRole
          }
        ],
        createdAt: new Date().toISOString(), 
        updatedAt: new Date().toISOString(),
        periodId: state.selectedPeriodId
    };
    updateState(prev => ({ ...prev, ownerTasks: [task, ...(prev.ownerTasks || [])] }));
    setNewTitle(''); setNewGoal(''); setNewDesc(''); setNewDescBlocks([]); setNewDueDate(''); setIsCreating(false);
  };

  const updateTaskReport = (taskId: string, report: TaskReport) => {
    updateState(prev => ({
      ...prev,
      ownerTasks: (prev.ownerTasks || []).map(t => t.id === taskId ? {
        ...t,
        taskReport: report,
        updatedAt: new Date().toISOString()
      } : t)
    }));
  };

  const updateStatus = (taskId: string, newStatus: TaskStatus) => {
    updateState(prev => ({
      ...prev,
      ownerTasks: (prev.ownerTasks || []).map(t => t.id === taskId ? {
        ...t,
        status: newStatus,
        auditLog: [
          ...(t.auditLog || []),
          {
            id: `audit-${Date.now()}`,
            timestamp: new Date().toISOString(),
            action: `Статус изменен на "${STATUS_META[newStatus].label}"`,
            actor: currentAdminRole
          }
        ],
        updatedAt: new Date().toISOString()
      } : t)
    }));
  };

  const deleteTask = (taskId: string) => {
    if (confirm('Вы уверены, что хотите удалить эту задачу из ведомости?')) {
      updateState(prev => ({
        ...prev,
        ownerTasks: (prev.ownerTasks || []).filter(t => t.id !== taskId)
      }));
    }
  };

  const addNote = (taskId: string, text: string) => {
    if (!text.trim()) return;
    updateState(prev => ({
      ...prev,
      ownerTasks: (prev.ownerTasks || []).map(t => t.id === taskId ? {
        ...t,
        notes: [
          ...(t.notes || []),
          {
             id: `note-${Date.now()}`,
             text,
             author: currentAdminRole,
             createdAt: new Date().toISOString()
          }
        ],
        updatedAt: new Date().toISOString()
      } : t)
    }));
  };

  const handleScreenshotUpload = (taskId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      updateState(prev => ({
        ...prev,
        ownerTasks: (prev.ownerTasks || []).map(t => t.id === taskId ? {
          ...t,
          screenshots: [...(t.screenshots || []), base64],
          updatedAt: new Date().toISOString()
        } : t)
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveScreenshot = (taskId: string, index: number) => {
     updateState(prev => ({
       ...prev,
       ownerTasks: (prev.ownerTasks || []).map(t => t.id === taskId ? {
         ...t,
         screenshots: (t.screenshots || []).filter((_, idx) => idx !== index),
         updatedAt: new Date().toISOString()
       } : t)
     }));
  };

  const allTasks = useMemo(() => {
    let list = state.ownerTasks || [];
    if (state.selectedPeriodId) {
      list = list.filter(t => t.periodId === state.selectedPeriodId);
    }
    if (activeMode === 'directive') {
      list = list.filter(t => t.taskType === 'directive');
    } else if (activeMode === 'regular') {
      list = list.filter(t => t.taskType === 'regular' || !t.taskType);
    } else if (activeMode === 'recurring') {
      list = list.filter(t => t.taskType === 'recurring');
    }

    if (secondaryFilter === 'critical') {
      list = list.filter(t => t.priority === 'urgent');
    } else if (secondaryFilter === 'process') {
      list = list.filter(t => t.status === 'in_progress');
    } else if (secondaryFilter === 'review') {
      list = list.filter(t => t.status === 'review');
    }

    if (taskSearch.trim()) {
      const q = taskSearch.toLowerCase();
      list = list.filter(t => 
        t.title.toLowerCase().includes(q) || 
        (t.description || '').toLowerCase().includes(q) || 
        (t.strategyData?.goal || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [state.ownerTasks, state.selectedPeriodId, activeMode, secondaryFilter, taskSearch]);

  const adminMetrics = useMemo(() => {
    const tasks = state.ownerTasks || [];
    const urgentCount = tasks.filter(t => t.priority === 'urgent' && t.status !== 'completed').length;
    const reviewCount = tasks.filter(t => t.status === 'review').length;
    const progressCount = tasks.filter(t => t.status === 'in_progress').length;
    const completedCount = tasks.filter(t => t.status === 'completed').length;
    return { urgentCount, reviewCount, progressCount, completedCount };
  }, [state.ownerTasks]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      
      {/* HEADER SECTION WITH ADVANCED ROLES TOGGLE & AUDIT STATS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-gradient-to-r from-slate-950 to-slate-900 p-8 rounded-[2.5rem] border border-slate-800/80 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-sky-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
               <Terminal size={18} />
            </div>
            <div>
               <h1 className="text-2xl font-black font-outfit text-white tracking-tight flex items-center gap-2">
                 Панель Администратора <PeriodBadge state={state} />
               </h1>
               <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Центральный пульт управления континентальной ведомостью</p>
            </div>
          </div>
        </div>

        {/* ROLE SELECTOR & LAUNCH BUTTON */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-850/60 font-mono">
            <span className="text-[9px] text-slate-500 font-bold px-2 uppercase">Симуляция:</span>
            {(['All', 'Rector', 'Mentor'] as const).map(role => (
              <button
                key={role}
                onClick={() => setCurrentAdminRole(role)}
                className={`text-[9px] px-3.5 py-1.5 rounded-xl font-bold transition-all ${currentAdminRole === role ? 'text-white bg-sky-600 shadow-md shadow-sky-600/10' : 'text-slate-500 hover:text-slate-300'}`}
              >
                {role === 'All' ? 'ОБЩЕЕ (Rector + Admin VI)' : role === 'Rector' ? 'RECTOR' : 'ADMIN VI'}
              </button>
            ))}
          </div>

          <button 
            onClick={() => setIsCreating(!isCreating)}
            className="bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-[10px] uppercase tracking-widest px-6 py-3.5 rounded-2xl shadow-xl shadow-sky-600/15 transition-all active:scale-95 flex items-center gap-2 animate-pulse hover:animate-none font-mono"
          >
            <Plus size={14} /> {isCreating ? 'Скрыть блок' : 'Инициировать'}
          </button>
        </div>
      </div>

      {/* ADMIN METRICS DASHBOARD */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
        {[
          { label: 'КРИТИЧЕСКИЕ ДИРЕКТИВЫ', value: adminMetrics.urgentCount, color: 'text-rose-500 border-rose-500/10', bg: 'bg-rose-500/5', desc: 'Требуется контроль' },
          { label: 'НА ПРОВЕРКЕ АДМИНА', value: adminMetrics.reviewCount, color: 'text-amber-500 border-amber-500/10', bg: 'bg-amber-500/5', desc: 'Ждут верификации' },
          { label: 'АКТИВНЫЕ ЗАДАЧИ', value: adminMetrics.progressCount, color: 'text-sky-500 border-sky-500/10', bg: 'bg-sky-500/5', desc: 'В настоящее время' },
          { label: 'ВЫПОЛНЕННЫЕ ПОЛНОСТЬЮ', value: adminMetrics.completedCount, color: 'text-emerald-500 border-emerald-500/10', bg: 'bg-emerald-500/5', desc: 'Закрытые сессии' }
        ].map((card, i) => (
          <div key={i} className={`p-6 bg-slate-950/40 rounded-3xl border border-slate-850 flex flex-col justify-between gap-4 relative overflow-hidden`}>
             <div className="space-y-1">
                <span className="text-[9px] font-black text-slate-550 uppercase tracking-widest">{card.label}</span>
                <p className="text-[10px] text-slate-600 tracking-tight font-sans">{card.desc}</p>
             </div>
             <div className="flex justify-between items-end">
                <p className={`text-4xl font-black font-outfit ${card.color.split(' ')[0]}`}>{card.value}</p>
                <div className={`h-2.5 w-2.5 rounded-full ${card.color.split(' ')[0].replace('text-', 'bg-')}`}></div>
             </div>
          </div>
        ))}
      </div>

      {/* --- FORM FOR INITIATING & DELEGATING --- */}
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
                        <BlockDescriptionEditor 
                          blocks={newDescBlocks} 
                          onChange={(blocks) => setNewDescBlocks(blocks)} 
                          accentColor="sky" 
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
                onUpdateReport={updateTaskReport}
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
