import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AppState, OwnerTask, TaskPriority, TaskStatus, OwnerTag, TaskNote, TaskAssignee, TaskType, RecurrenceCycle, TaskAuditEntry, OwnerNote, TaskDescriptionBlock } from '../types';
import { BlockDescriptionEditor, BlockDescriptionViewer } from '../components/BlockDescriptionEditor';
import { TaskReportSection } from '../components/TaskReportSection';
import { TaskReport } from '../types';
import { ICONS } from '../constants';
import PeriodBadge from '../components/PeriodBadge';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  TrendingUp, 
  Layers, 
  Activity, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Send, 
  Search, 
  Award, 
  Terminal, 
  BookOpen, 
  Crown, 
  ChevronRight, 
  Trash2, 
  Plus, 
  Edit, 
  CheckSquare, 
  List, 
  ListOrdered, 
  Baseline, 
  ChevronDown, 
  Eye, 
  Cpu, 
  FileSpreadsheet, 
  Flame, 
  Palette,
  Check
} from 'lucide-react';

const TG_TOKEN = '8497961851:AAEmwmEgJNV6KwyQjdcG62GY3IdX8zz6YV4';
const DEFAULT_CHAT_ID = '-1003748692600';

// --- ПОМОЩНИКИ ---
function StrategyInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void, placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-amber-500/80 uppercase tracking-widest ml-1">{label}</label>
      <input 
        type="text" 
        className="w-full bg-slate-950/80 border border-slate-800/80 rounded-2xl px-4 py-3 text-xs text-white outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition-all placeholder:text-slate-700 font-medium" 
        placeholder={placeholder}
        value={value} 
        onChange={e => onChange(e.target.value)} 
      />
    </div>
  );
}

// --- ШАБЛОНЫ ДЛЯ БЛОКНОТА ---
const TEMPLATES = [
  {
    name: '🎯 Стратегический Вектор',
    content: `<h2>🎯 СТРАТЕГИЧЕСКИЙ ВЕКТОР РАЗВИТИЯ</h2>
<p><strong>Дата создания:</strong> ${new Date().toLocaleDateString()}</p>
<hr />
<h3>1. Ключевые показатели эффективности (KPI)</h3>
<ul>
  <li>Показатель по выручке OF: [Вписать цель в % или $]</li>
  <li>Загрузка моделей / Трафик: [Вписать план по трафику]</li>
</ul>
<h3>2. Приоритетные инициативы</h3>
<p><input type="checkbox" /> Оптимизировать систему прогревных регламентов</p>
<p><input type="checkbox" /> Подключить новый софт аналитики</p>
<h3>3. Ограничения и риски</h3>
<p><em>Опишите потенциальные угрозы для операции...</em></p>`
  },
  {
    name: '🛡️ Протокол Операций',
    content: `<h2>🛡️ ИНСТРУМЕНТ И БЕЗОПАСНОСТЬ ОПЕРАЦИЙ</h2>
<p><strong>Ревизия протокола:</strong> ${new Date().toLocaleDateString()}</p>
<hr />
<h3>1. Критические точки контроля</h3>
<ul>
  <li>Проверка кошельков и криптовалютных адресов перед транзакциями</li>
  <li>Соблюдение двухфакторной аутентификации всеми администраторами</li>
</ul>
<h3>2. План экстренных действий</h3>
<p>При обнаружении нештатной активности следовать строго регламентированным шагам...</p>`
  },
  {
    name: '💸 Схема Доходности',
    content: `<h2>💸 РАСЧЕТ ДОХОДНОСТИ И ОЦЕНКА СОСТАВА</h2>
<p><strong>Период расчетов:</strong> ${new Date().toLocaleDateString()}</p>
<hr />
<h3>1. Бонусная сетка моделей</h3>
<p>Определяется на основе выполнения суточных планов и дополнительных смен.</p>
<h3>2. Пул операционных расходов</h3>
<p><input type="checkbox" /> Трафик &amp; Рекламные закупки</p>
<p><input type="checkbox" /> Лицензии серверного обеспечения</p>`
  }
];

// --- ОСНОВНОЙ КОМПОНЕНТ ---
interface OwnerTableProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const OwnerTable: React.FC<OwnerTableProps> = ({ state, updateState }) => {
  const [activeTab, setActiveTab] = useState<'manager' | 'notebook'>('manager');
  const [currentOwner, setCurrentOwner] = useState<'Andrey' | 'Anton' | 'Owners'>('Owners');
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isSendingToTg, setIsSendingToTg] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [taskSearch, setTaskSearch] = useState('');
  
  // Custom skins for notebook
  const [notebookSkin, setNotebookSkin] = useState<'chamber' | 'vellum' | 'cyberpunk'>('chamber');

  const handleScreenshotUpload = (taskId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        updateState(prev => ({
          ...prev,
          ownerTasks: (prev.ownerTasks || []).map(t => t.id === taskId ? {
            ...t,
            screenshots: [...(t.screenshots || []), base64]
          } : t)
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const [activeMode, setActiveMode] = useState<TaskType>('directive');
  const [secondaryFilter, setSecondaryFilter] = useState<'all' | 'critical' | 'process' | 'review'>('all');

  const editorRef = useRef<HTMLDivElement>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Estimations for documents
  const [docStats, setDocStats] = useState({ words: 0, chars: 0, minRead: 0 });

  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    if (editorRef.current) {
        const html = editorRef.current.innerHTML;
        updateState(prev => ({ ...prev, ownerDocument: html }));
        calculateWords(html);
    }
  };

  const handleEditorInput = () => {
    if (editorRef.current) {
        const html = editorRef.current.innerHTML;
        updateState(prev => ({ ...prev, ownerDocument: html }));
        calculateWords(html);
    }
  };

  const calculateWords = (html: string) => {
    const text = html.replace(/<[^>]*>/g, ' ');
    const cleaned = text.trim().replace(/\s+/g, ' ');
    const chars = cleaned.length;
    const words = cleaned === '' ? 0 : cleaned.split(' ').length;
    const minRead = Math.max(1, Math.round(words / 150));
    setDocStats({ words, chars, minRead });
  };

  const insertNextTask = () => {
    const separator = `<div class="task-separator" contenteditable="false" style="height: 1px; background: rgba(251, 191, 36, 0.2); margin: 30px 0;"></div><div><br></div>`;
    exec('insertHTML', separator);
  };

  const applyTemplate = (content: string) => {
    if (!editorRef.current) return;
    if (confirm('Вставить шаблон в документ? Текущий текст останется, шаблон прикрепится к концу.')) {
      const updatedHTML = (editorRef.current.innerHTML || '') + '<br/>' + content;
      updateState(prev => ({ ...prev, ownerDocument: updatedHTML }));
      editorRef.current.innerHTML = updatedHTML;
      calculateWords(updatedHTML);
    }
  };

  const completeCurrentTask = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    const parts = html.split('<div class="task-separator" contenteditable="false" style="height: 1px; background: rgba(251, 191, 36, 0.2); margin: 30px 0;"></div>');
    
    if (parts.length > 0) {
      const completedPart = parts[0].trim();
      if (!completedPart || completedPart === '<div><br></div>' || completedPart === '<br>') {
          alert('Нечего завершать!');
          return;
      }

      const timestamp = `<div style="font-size: 11px; color: #fbbf24; margin-bottom: 12px; font-weight: 800; font-family: monospace;">🏆 ЗАВЕРШЕНО РУКОВОДСТВОМ: ${new Date().toLocaleString()}</div>`;
      const archivedContent = `<div class="archived-task" style="border-left: 3px solid #10b981; padding-left: 20px; margin-bottom: 40px; background: rgba(16, 185, 129, 0.03); padding-top: 15px; padding-bottom: 15px; border-radius: 0 12px 12px 0;">${timestamp}${completedPart}</div>`;
      
      const newRemaining = parts.slice(1).join('<div class="task-separator" contenteditable="false" style="height: 1px; background: rgba(251, 191, 36, 0.2); margin: 30px 0;"></div>');
      
      updateState(prev => ({
        ...prev,
        ownerDocument: newRemaining || '<div><br></div>',
        completedDocument: archivedContent + (prev.completedDocument || '')
      }));
      
      editorRef.current.innerHTML = newRemaining || '<div><br></div>';
      calculateWords(newRemaining || '<div><br></div>');
      alert('Задача успешно заархивирована!');
    }
  };

  useEffect(() => {
    if (editorRef.current && state.ownerDocument !== undefined) {
        if (editorRef.current.innerHTML !== state.ownerDocument) {
            if (document.activeElement !== editorRef.current) {
                editorRef.current.innerHTML = state.ownerDocument || '';
                calculateWords(state.ownerDocument || '');
            }
        }
    }
  }, [state.ownerDocument]);

  const PRIORITY_META: Record<TaskPriority, { label: string; color: string; bg: string; emoji: string; glow: string }> = {
    urgent: { label: 'КРИТИЧЕСКИЙ', color: 'text-rose-500', bg: 'bg-rose-500/10 border-rose-500/20', emoji: '☢️', glow: 'shadow-[0_0_20px_rgba(244,63,94,0.15)]' },
    high: { label: 'ВЫСОКИЙ', color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/20', emoji: '🔥', glow: 'shadow-[0_0_20px_rgba(245,158,11,0.15)]' },
    medium: { label: 'СРЕДНИЙ', color: 'text-sky-500', bg: 'bg-sky-500/10 border-sky-500/20', emoji: '⚡️', glow: 'shadow-[0_0_20px_rgba(14,165,233,0.15)]' },
    low: { label: 'НИЗКИЙ', color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20', emoji: '☕️', glow: 'shadow-none' }
  };

  const STATUS_META: Record<TaskStatus, { label: string; color: string; glow: string; step: number }> = {
    idea: { label: 'Идея', color: 'text-indigo-400', glow: 'bg-indigo-400/20', step: 1 },
    in_progress: { label: 'В процессе', color: 'text-sky-400', glow: 'bg-sky-400/20', step: 2 },
    review: { label: 'НА ПРОВЕРКЕ', color: 'text-amber-400', glow: 'bg-amber-500/30 border border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.25)] animate-pulse', step: 4 },
    completed: { label: 'Выполнено', color: 'text-emerald-400', glow: 'bg-emerald-400/20', step: 5 },
    blocked: { label: 'Заблокировано', color: 'text-rose-500', glow: 'bg-rose-500/20', step: 3 },
    waiting_external: { label: 'Ожидание', color: 'text-slate-400', glow: 'bg-slate-450/20', step: 3 }
  };

  const TYPE_META: Record<TaskType, { label: string, color: string, bg: string, icon: any, desc: string }> = {
    directive: { label: 'Директива', color: 'text-amber-500', bg: 'bg-amber-500/15 border-amber-500/30', icon: Crown, desc: 'Стратегические указания владельцев' },
    regular: { label: 'Задача', color: 'text-sky-400', bg: 'bg-sky-400/15 border-sky-400/30', icon: FileText, desc: 'Текущие операционные поручения' },
    recurring: { label: 'Регламент', color: 'text-indigo-400', bg: 'bg-indigo-400/15 border-indigo-400/30', icon: Clock, desc: 'Циклические стандарты смен' }
  };

  const ASSIGNEE_LABELS: Record<TaskAssignee, string> = {
    Andrey: 'Андрей', Anton: 'Антон', Owners: 'Общее (Владельцы)', 
    Rector: 'Admin Rector', Mentor: 'Admin Vi (@adm_viksi_viii)', Admins: 'Админы (Общие)', All: 'Весь состав'
  };

  const [editingTask, setEditingTask] = useState<OwnerTask | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskDescBlocks, setNewTaskDescBlocks] = useState<TaskDescriptionBlock[]>([]);
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
    
    let mentionTags = '';
    let headerAddon = '';
    
    if (task.assignedTo === 'Mentor') {
      mentionTags = '<a href="tg://resolve?domain=adm_viksi_viii">@adm_viksi_viii</a>';
      headerAddon = ' (@adm_viksi_viii)';
    } else if (task.assignedTo === 'Rector') {
      mentionTags = '<a href="tg://user?id=6537516111">@adm_rctr</a>';
      headerAddon = ' (@adm_rctr)';
    } else if (task.assignedTo === 'Admins' || task.assignedTo === 'All') {
      mentionTags = '<a href="tg://resolve?domain=adm_viksi_viii">@adm_viksi_viii</a> и <a href="tg://user?id=6537516111">@adm_rctr</a>';
      headerAddon = ' (@adm_viksi_viii, @adm_rctr)';
    } else {
      mentionTags = '@continental_agency';
    }

    const typeLabel = TYPE_META[task.taskType]?.label || 'Задача';
    const prioLabel = PRIORITY_META[task.priority]?.label || 'Средний';
    const prioEmoji = PRIORITY_META[task.priority]?.emoji || '⚡️';

    let message = `🚨 <b>CORE${headerAddon}: Новая стратегическая инициатива</b>\n\n`;
    message += `<b>Тип:</b> ${typeLabel}\n`;
    message += `<b>Приоритет:</b> ${prioEmoji} ${prioLabel}\n`;
    if (task.dueDate) {
      message += `<b>Дедлайн:</b> ${new Date(task.dueDate).toLocaleDateString()}\n`;
    }
    message += `\n<b>Инициатива:</b> <u>${task.title}</u>\n`;
    if (task.description) {
      message += `<b>Контекст:</b> ${task.description}\n`;
    }
    if (task.strategyData?.goal) {
      message += `<b>Целевой образ:</b> ${task.strategyData.goal}\n`;
    }
    message += `\n<b>Ответственное крыло:</b> ${mentionTags}`;

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
              { text: "🛰️ Вход в Узел Администратора", url: "https://continental.monster/#/admin-table" }
            ]]
          }
        })
      });
      if (res.ok) alert('Уведомление отправлено в Телеграм!');
      else {
        const err = await res.json();
        alert(`Ошибка отправки: ${err.description}`);
      }
    } catch (e) {
      alert('Сбой сети при отправке. Проверьте подключение.');
    } finally {
      setIsSendingToTg(null);
    }
  };

  const saveTask = () => {
    if (!newTaskTitle.trim()) return;

    const finalAssigned = newTaskTarget === 'owner' ? currentOwner : newTaskAssigned;
    const compiledDesc = newTaskDescBlocks.length > 0
      ? newTaskDescBlocks.map(b => b.type === 'text' ? b.text : `[Фото: ${b.caption || ''}]`)
          .join('\n\n')
          .replace(/<[^>]*>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .trim()
      : newTaskDesc;

    if (editingTask) {
        updateState(prev => ({
            ...prev,
            ownerTasks: (prev.ownerTasks || []).map(t => t.id === editingTask.id ? {
                ...t,
                title: newTaskTitle, 
                description: compiledDesc, 
                descriptionBlocks: newTaskDescBlocks,
                priority: newTaskPriority,
                assignedTo: finalAssigned as TaskAssignee, taskType: newTaskType,
                dueDate: newTaskDueDate || undefined,
                recurrenceCycle: newTaskType === 'recurring' ? newTaskCycle : undefined,
                strategyData: { goal: newTaskGoal, reason: '', effect: '' },
                auditLog: [...(t.auditLog || []), logAudit(`Отредактировано`, currentOwner)],
                updatedAt: new Date().toISOString()
            } : t)
        }));
        setEditingTask(null);
    } else {
        const task: OwnerTask = {
            id: `task-${Date.now()}`,
            title: newTaskTitle, 
            description: compiledDesc, 
            descriptionBlocks: newTaskDescBlocks,
            status: 'idea',
            priority: newTaskPriority, taskType: newTaskType, assignedTo: finalAssigned as TaskAssignee,
            dueDate: newTaskDueDate || undefined,
            recurrenceCycle: newTaskType === 'recurring' ? newTaskCycle : undefined,
            tags: [], strategyData: { goal: newTaskGoal, reason: '', effect: '' },
            notes: [], auditLog: [logAudit('Создано', currentOwner)],
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            periodId: state.selectedPeriodId
        };
        updateState(prev => ({ ...prev, ownerTasks: [task, ...(prev.ownerTasks || [])] }));
    }
    setNewTaskTitle(''); setNewTaskDesc(''); setNewTaskDescBlocks([]); setNewTaskGoal(''); setNewTaskDueDate('');
  };

  const startEditing = (task: OwnerTask) => {
    setEditingTask(task);
    setNewTaskTitle(task.title); setNewTaskDesc(task.description);
    setNewTaskDescBlocks(task.descriptionBlocks || (task.description ? [{ id: `init-${Date.now()}`, type: 'text', text: `<div>${task.description.replace(/\n/g, '<br>')}</div>` }] : []));
    setNewTaskPriority(task.priority); setNewTaskAssigned(task.assignedTo);
    setNewTaskType(task.taskType || 'regular'); setNewTaskCycle(task.recurrenceCycle || 'daily');
    setNewTaskGoal(task.strategyData?.goal || '');
    setNewTaskDueDate(task.dueDate || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- ВЫЧИСЛЕНИЕ СТАТИСТИКИ (DASHBOARD METRICS HUD) ---
  const metrics = useMemo(() => {
    const tasks = state.ownerTasks || [];
    const myTasks = tasks.filter(t => t.periodId === state.selectedPeriodId);
    
    const directives = myTasks.filter(t => t.taskType === 'directive');
    const regulars = myTasks.filter(t => t.taskType === 'regular');
    const recurring = myTasks.filter(t => t.taskType === 'recurring');

    const completed = myTasks.filter(t => t.status === 'completed').length;
    
    // Новые метрики по отчетам
    const reportsAttached = myTasks.filter(t => t.taskReport?.statusChoice === 'report_attached').length;
    const noReportNeeded = myTasks.filter(t => t.taskReport?.statusChoice === 'no_report_needed').length;
    const pendingReports = myTasks.filter(t => t.status === 'completed' && !t.taskReport?.statusChoice).length;
    const review = myTasks.filter(t => t.status === 'review').length;
    const critical = myTasks.filter(t => t.priority === 'urgent' || t.priority === 'high').length;
    
    const totalCount = myTasks.length;
    const percent = totalCount > 0 ? Math.round((completed / totalCount) * 100) : 0;

    return {
      directivesCount: directives.length,
      regularsCount: regulars.length,
      recurringCount: recurring.length,
      totalCount,
      completed,
      review,
      critical,
      percent,
      reportsAttached,
      noReportNeeded,
      pendingReports
    };
  }, [state.ownerTasks, state.selectedPeriodId]);

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

    if (taskSearch.trim() !== '') {
      const q = taskSearch.toLowerCase();
      list = list.filter(t => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || (t.strategyData?.goal || '').toLowerCase().includes(q));
    }

    if (secondaryFilter === 'critical') list = list.filter(t => t.priority === 'urgent' || t.priority === 'high');
    if (secondaryFilter === 'process') list = list.filter(t => t.status === 'in_progress');
    if (secondaryFilter === 'review') list = list.filter(t => t.status === 'review');

    return list.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const prioOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      return (prioOrder[a.priority] ?? 2) - (prioOrder[b.priority] ?? 2);
    });
  }, [state.ownerTasks, activeMode, secondaryFilter, currentOwner, state.selectedPeriodId, taskSearch]);

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-24 max-w-7xl mx-auto px-4 sm:px-6">
      
      {/* --- ШАПКА ХАБА С АНИМАЦИЕЙ --- */}
      <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 border-b border-slate-900/40 pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <div className="text-[10px] sm:text-[11px] font-black text-amber-500 uppercase tracking-[0.4em] font-mono">СТРАТЕГИЧЕСКИЙ НАДЗОР ШТАБА</div>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <h1 className="text-3xl sm:text-5xl font-black font-outfit text-white tracking-tight leading-none bg-gradient-to-r from-white via-slate-200 to-slate-500 bg-clip-text text-transparent">
              Ядро Управления
            </h1>
            <PeriodBadge state={state} />
          </div>
          <p className="text-xs text-slate-500 leading-relaxed font-outfit">Высший управляющий контур и контроль исполнения директив.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center self-start xl:self-end">
          {/* TAB PICKER */}
          <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800/80">
            <button 
              onClick={() => setActiveTab('manager')} 
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'manager' ? 'bg-amber-600 text-white shadow-xl shadow-amber-600/10' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Cpu size={12} /> Задачи
            </button>
            <button 
              onClick={() => setActiveTab('notebook')} 
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'notebook' ? 'bg-amber-600 text-white shadow-xl shadow-amber-600/10' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <BookOpen size={12} /> Блокнот
            </button>
          </div>

          {/* OWNER FILTER */}
          <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800/80 gap-1">
            {['Andrey', 'Anton', 'Owners'].map(id => (
              <button 
                key={id} 
                onClick={() => setCurrentOwner(id as any)} 
                className={`flex items-center gap-1.5 px-4.5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${currentOwner === id ? 'bg-amber-600/20 text-amber-500 border border-amber-500/20 shadow-md' : 'text-slate-500 hover:text-slate-300 border border-transparent'}`}
              >
                {id === 'Owners' ? <Crown size={11} className="text-amber-500" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />}
                {ASSIGNEE_LABELS[id as TaskAssignee]}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* --- HUD СТРАТЕГИЧЕСКИХ ПОКАЗАТЕЛЕЙ (WOW HUD GRID) --- */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* HUD 1: Инициативы */}
        <div className="relative group overflow-hidden bg-slate-900/20 border border-slate-800/50 p-5 rounded-[24px] hover:border-amber-500/30 transition-all shadow-xl backdrop-blur-md">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-500/5 to-transparent rounded-full pointer-events-none transition-transform duration-700 group-hover:scale-125"></div>
          <div className="flex justify-between items-start mb-3">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 font-mono">Активные инициативы</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20"><Crown size={14}/></div>
          </div>
          <div className="space-y-1">
            <h4 className="text-2xl sm:text-3xl font-black font-outfit text-white leading-none">{metrics.totalCount}</h4>
            <div className="flex gap-2 text-[9px] text-slate-500 font-mono">
              <span>{metrics.directivesCount} дир.</span>
              <span>•</span>
              <span>{metrics.recurringCount} регл.</span>
            </div>
          </div>
        </div>

        {/* HUD 2: Выполнено % */}
        <div className="relative group overflow-hidden bg-slate-900/20 border border-slate-800/50 p-5 rounded-[24px] hover:border-amber-500/30 transition-all shadow-xl backdrop-blur-md">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/5 to-transparent rounded-full pointer-events-none transition-transform duration-700 group-hover:scale-125"></div>
          <div className="flex justify-between items-start mb-3">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 font-mono">Прогресс выполнения</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20"><CheckCircle2 size={14}/></div>
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <h4 className="text-2xl sm:text-3xl font-black font-outfit text-white leading-none">{metrics.percent}%</h4>
              <span className="text-[9px] text-slate-500 font-mono font-bold">({metrics.completed}/{metrics.totalCount})</span>
            </div>
            <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden flex">
              <div className="bg-emerald-400 h-full transition-all duration-1000" style={{ width: `${metrics.percent}%` }}></div>
            </div>
          </div>
        </div>

        {/* HUD 3: На Верификации */}
        <div className={`relative group overflow-hidden border p-5 rounded-[24px] transition-all shadow-xl backdrop-blur-md ${metrics.review > 0 ? 'bg-amber-500/5 border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.05)]' : 'bg-slate-900/20 border-slate-800/50 hover:border-amber-500/30'}`}>
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-500/10 to-transparent rounded-full pointer-events-none"></div>
          <div className="flex justify-between items-start mb-3">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 font-mono">Контроль Верификации</span>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${metrics.review > 0 ? 'bg-amber-500 text-slate-950 border-amber-500/30 animate-pulse' : 'bg-slate-800 text-slate-400 border-slate-800/80'}`}><Activity size={14}/></div>
          </div>
          <div className="space-y-1">
            <h4 className={`text-2xl sm:text-3xl font-black font-outfit leading-none ${metrics.review > 0 ? 'text-amber-400 font-mono font-black' : 'text-white'}`}>{metrics.review}</h4>
            <p className="text-[9px] text-slate-500 font-mono">Задачи ожидают проверки</p>
          </div>
        </div>

        {/* HUD 4: Срочные Риски */}
        <div className={`relative group overflow-hidden border p-5 rounded-[24px] transition-all shadow-xl backdrop-blur-md ${metrics.critical > 0 ? 'bg-rose-500/5 border-rose-500/30 shadow-[0_0_20px_rgba(244,63,94,0.05)] animate-pulse' : 'bg-slate-900/20 border-slate-800/50 hover:border-amber-500/30'}`}>
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-rose-500/10 to-transparent rounded-full pointer-events-none"></div>
          <div className="flex justify-between items-start mb-3">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 font-mono">Срочные Риски</span>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${metrics.critical > 0 ? 'bg-rose-500 text-white border-rose-500/20' : 'bg-slate-800 text-slate-400 border-slate-800/80'}`}><AlertCircle size={14}/></div>
          </div>
          <div className="space-y-1">
            <h4 className="text-2xl sm:text-3xl font-black font-outfit text-white leading-none">{metrics.critical}</h4>
            <p className="text-[9px] text-slate-500 font-mono">приоритет Критич./Высок.</p>
          </div>
        </div>

        {/* HUD 5: Контроль Отчетов */}
        <div className="relative group overflow-hidden bg-slate-900/20 border border-slate-800/50 p-5 rounded-[24px] hover:border-indigo-500/30 transition-all shadow-xl backdrop-blur-md col-span-2 md:col-span-3 lg:col-span-1">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500/5 to-transparent rounded-full pointer-events-none transition-transform duration-700 group-hover:scale-125"></div>
          <div className="flex justify-between items-start mb-3">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 font-mono">Контроль Отчетов</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20"><FileText size={14}/></div>
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline gap-1.5">
              <h4 className="text-2xl sm:text-3xl font-black font-outfit text-indigo-400 leading-none">{metrics.reportsAttached}</h4>
              <span className="text-[9px] text-slate-500 font-mono">приложено</span>
            </div>
            <div className="flex gap-1.5 text-[8.5px] text-slate-500 font-mono font-bold flex-wrap">
              <span className="text-amber-500">{metrics.pendingReports} ожидают</span>
              <span>•</span>
              <span className="text-slate-400">{metrics.noReportNeeded} без отчета</span>
            </div>
          </div>
        </div>
      </section>

      {activeTab === 'manager' ? (
        <>
          {/* --- ФИЛЬТРЫ И СЕКТОРА С ПОИСКОМ (GLASS WORKSPACE BAR) --- */}
          <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center bg-slate-950/40 p-4 rounded-3xl border border-slate-800/60 shadow-inner">
            <div className="flex flex-wrap gap-4 items-center pl-2">
              {['directive', 'regular', 'recurring'].map((mode) => (
                <button 
                  key={mode} 
                  onClick={() => { setActiveMode(mode as any); setSecondaryFilter('all'); }} 
                  className={`relative py-1.5 px-3 text-[10px] font-black uppercase tracking-widest transition-all ${activeMode === mode ? `text-amber-500 font-extrabold` : 'text-slate-500 hover:text-slate-300'}`}
                >
                  {TYPE_META[mode as TaskType].label}
                  {activeMode === mode && (
                    <motion.div 
                      layoutId="activeModeIndicator" 
                      className="absolute -bottom-4 left-0 right-0 h-0.5 bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)] rounded-full" 
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
                  className="w-full bg-slate-950 border border-slate-800 px-8 py-2 rounded-xl text-[10px] text-white outline-none focus:border-amber-500/40 placeholder:text-slate-755 font-mono" 
                  placeholder="Искать в секторе..."
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
                  { id: 'all', l: 'ВСЕ' },
                  { id: 'critical', l: 'КРИТИЧЕСКИЕ' },
                  { id: 'process', l: 'В РАБОТЕ' },
                  { id: 'review', l: 'НА ПРОВЕРКЕ' }
                ].map(f => (
                  <button 
                    key={f.id} 
                    onClick={() => setSecondaryFilter(f.id as any)} 
                    className={`text-[8px] font-black uppercase tracking-wider whitespace-nowrap px-3 py-1.5 rounded-lg transition-all ${secondaryFilter === f.id ? 'text-white bg-slate-800' : 'text-slate-600 hover:text-slate-400'}`}
                  >
                    {f.l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* --- ФОРМА ВНЕДРЕНИЯ ЗАДАЧ (ЛЕВАЯ ПАНЕЛЬ) --- */}
            <div className="lg:col-span-4 space-y-6">
              <div className="relative overflow-hidden bg-gradient-to-b from-slate-900/60 to-slate-950/80 p-8 rounded-[32px] border border-slate-800 shadow-2xl space-y-6">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-amber-500/20 to-transparent"></div>
                
                <div>
                  <h2 className="text-xl font-black font-outfit text-white mb-2 tracking-tight flex items-center gap-2">
                    <Sparkles size={18} className="text-amber-500" />
                    {editingTask ? 'Изменить инициативу' : 'Запустить задачу'}
                  </h2>
                  <p className="text-[10px] text-slate-500 font-mono mb-4">ВНЕДРЕНИЕ И ОПЕРАТИВНОЕ ПЛАНИРОВАНИЕ</p>
                  
                  <div className="flex gap-1 p-1 bg-slate-950 rounded-2xl border border-slate-800/80">
                    <button 
                      onClick={() => setNewTaskTarget('admin')} 
                      className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all flex items-center justify-center gap-1.5 ${newTaskTarget === 'admin' ? 'bg-indigo-600/25 text-indigo-400 border border-indigo-500/25 shadow-md' : 'text-slate-500 hover:text-slate-300 border border-transparent'}`}
                    >
                      <Terminal size={11} /> Для Админов
                    </button>
                    <button 
                      onClick={() => setNewTaskTarget('owner')} 
                      className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all flex items-center justify-center gap-1.5 ${newTaskTarget === 'owner' ? 'bg-amber-600/25 text-amber-500 border border-amber-500/25 shadow-md' : 'text-slate-500 hover:text-slate-300 border border-transparent'}`}
                    >
                      <Crown size={11} /> Для Себя
                    </button>
                  </div>
                </div>

                <div className="space-y-4 font-mono">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-550 uppercase tracking-widest ml-1">Суть задачи</label>
                    <input 
                      type="text" 
                      className="w-full bg-slate-950 border border-slate-800/80 rounded-2xl px-5 py-3.5 text-white font-bold outline-none text-xs focus:border-amber-500/50" 
                      placeholder="Заголовок..." 
                      value={newTaskTitle} 
                      onChange={e => setNewTaskTitle(e.target.value)} 
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-550 uppercase tracking-widest ml-1 font-mono">Детали и контекст</label>
                    <BlockDescriptionEditor 
                      blocks={newTaskDescBlocks} 
                      onChange={(blocks) => setNewTaskDescBlocks(blocks)} 
                      accentColor="amber" 
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-550 uppercase tracking-widest ml-1">Тип</label>
                      <select 
                        className="w-full bg-slate-950 border border-slate-800/80 rounded-xl px-4 py-2.5 text-[10px] text-white font-bold outline-none cursor-pointer" 
                        value={newTaskType} 
                        onChange={e => setNewTaskType(e.target.value as any)}
                      >
                        <option value="directive">Директива</option>
                        <option value="regular">Задача</option>
                        <option value="recurring">Регламент</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-550 uppercase tracking-widest ml-1">Приоритет</label>
                      <select 
                        className="w-full bg-slate-950 border border-slate-800/80 rounded-xl px-4 py-2.5 text-[10px] text-white font-bold outline-none cursor-pointer" 
                        value={newTaskPriority} 
                        onChange={e => setNewTaskPriority(e.target.value as any)}
                      >
                        {Object.entries(PRIORITY_META).map(([val, m]) => <option key={val} value={val}>{m.label}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-550 uppercase tracking-widest ml-1">Исполнитель</label>
                      <select 
                        disabled={newTaskTarget === 'owner'}
                        className={`w-full bg-slate-950 border border-slate-800/80 rounded-xl px-4 py-2.5 text-[10px] text-white font-bold outline-none cursor-pointer ${newTaskTarget === 'owner' ? 'opacity-40 grayscale pointer-events-none' : ''}`} 
                        value={newTaskTarget === 'owner' ? currentOwner : newTaskAssigned} 
                        onChange={e => setNewTaskAssigned(e.target.value as any)}
                      >
                        {Object.entries(ASSIGNEE_LABELS)
                          .filter(([val]) => newTaskTarget === 'owner' ? (val === 'Andrey' || val === 'Anton' || val === 'Owners') : (val === 'Rector' || val === 'Mentor' || val === 'Admins' || val === 'All'))
                          .map(([val, lab]) => <option key={val} value={val}>{lab}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-550 uppercase tracking-widest ml-1">Дедлайн</label>
                      <input 
                        type="date" 
                        className="w-full bg-slate-950 border border-slate-800/80 rounded-xl px-4 py-2.5 text-[10px] text-white outline-none cursor-pointer"
                        value={newTaskDueDate}
                        onChange={e => setNewTaskDueDate(e.target.value)}
                      />
                    </div>
                  </div>

                  {newTaskType === 'recurring' && (
                    <div className="space-y-1 animate-in slide-in-from-top-2">
                      <label className="text-[9px] font-black text-slate-550 uppercase tracking-widest ml-1">Цикл регламента</label>
                      <select 
                        className="w-full bg-slate-950 border border-slate-800/80 rounded-xl px-4 py-2.5 text-[10px] text-white font-bold outline-none cursor-pointer"
                        value={newTaskCycle}
                        onChange={e => setNewTaskCycle(e.target.value as any)}
                      >
                        <option value="daily">Ежедневно (Каждая смена)</option>
                        <option value="weekly">Еженедельно</option>
                        <option value="monthly">Ежемесячно</option>
                      </select>
                    </div>
                  )}

                  <StrategyInput label="Целевой результат" value={newTaskGoal} onChange={setNewTaskGoal} placeholder="Что считаем результатом?.." />
                  
                  <div className="pt-2 flex gap-3">
                    {editingTask && (
                      <button 
                        onClick={() => {
                          setEditingTask(null);
                          setNewTaskTitle('');
                          setNewTaskDesc('');
                          setNewTaskGoal('');
                          setNewTaskDueDate('');
                        }}
                        className="px-4 py-4 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:text-white text-slate-400 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all"
                      >
                        ×
                      </button>
                    )}
                    <button 
                      onClick={saveTask} 
                      className="flex-1 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-black py-4 rounded-2xl shadow-xl shadow-amber-65x00/10 uppercase tracking-[0.2em] text-[10px] transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Check size={12} /> {editingTask ? 'Применить Изменения' : 'Внедрить в Систему'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* --- СПИСОК АКТИВНЫХ ИНИЦИАТИВ (ПРАВАЯ СЕКЦИЯ) --- */}
            <div className="lg:col-span-8 space-y-4">
              <AnimatePresence mode="popLayout">
                {filteredTasks.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="p-24 text-center border-2 border-dashed border-slate-900 rounded-[32px] text-slate-600 flex flex-col items-center justify-center gap-4"
                  >
                    <Crown size={32} className="opacity-10 mb-2 text-amber-500" />
                    <p className="font-extrabold uppercase tracking-[0.25em] text-[10px]">Сектор пуст</p>
                    <p className="text-[10px] font-sans text-slate-500 tracking-normal normal-case italic">Нет активных или подходящих под фильтры операционных записей.</p>
                  </motion.div>
                ) : filteredTasks.map((task, idx) => {
                  const prio = PRIORITY_META[task.priority] || PRIORITY_META.medium;
                  const stat = STATUS_META[task.status] || STATUS_META.idea;
                  const isEx = expandedTasks.has(task.id);

                  // Срок
                  const now = new Date();
                  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
                  const isOverdue = dueDate && now > dueDate && task.status !== 'completed';
                  const isClosing = dueDate && !isOverdue && (dueDate.getTime() - now.getTime()) < 86400000 && task.status !== 'completed';

                  let overdueText = "⚠️ СРОК ВЫПОЛНЕНИЯ ПРОСРОЧЕН!";
                  if (isOverdue) {
                    if (task.assignedTo === 'Mentor') overdueText = "⚠️ АДМИН ADMIN VI ПРОСРОЧИЛ СРОК!";
                    else if (task.assignedTo === 'Rector') overdueText = "⚠️ АДМИН RECTOR ПРОСРОЧИЛ СРОК!";
                    else overdueText = "⚠️ АДМИНИСТРАЦИЯ ПРЕВЫСИЛА КРАЙНИЙ СРОК!";
                  }

                  return (
                    <motion.div 
                      key={task.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0, transition: { delay: Math.min(idx * 0.05, 0.4) } }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      layout
                      className={`relative group bg-slate-950/40 rounded-[28px] border transition-all duration-300 overflow-hidden shadow-lg ${
                        isOverdue 
                          ? 'border-rose-600 bg-rose-950/5 shadow-rose-950/10' 
                          : task.status === 'review' 
                            ? 'border-amber-500 shadow-amber-500/10 ring-2 ring-amber-500/20' 
                            : 'border-slate-800/70 hover:border-slate-700 hover:bg-slate-900/10'
                      }`}
                    >
                      <div className="p-6 sm:p-8 flex flex-col md:flex-row justify-between gap-6 relative">
                        {/* Status bar top glow */}
                        <div className={`absolute top-0 left-6 right-6 h-[2px] bg-gradient-to-r from-transparent ${isOverdue ? 'via-rose-500' : task.status === 'review' ? 'via-amber-400' : 'via-transparent'} to-transparent`}></div>

                        <div className="flex-1 space-y-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2.5 py-1 rounded-lg text-[8px] font-extrabold tracking-widest border font-mono ${prio.bg} ${prio.color} ${prio.glow}`}>{prio.label}</span>
                            <span className="text-[8px] bg-slate-950 text-indigo-400 px-2.5 py-1 rounded-lg border border-slate-800/80 font-black uppercase font-mono flex items-center gap-1.5 shadow-sm">
                              👤 {ASSIGNEE_LABELS[task.assignedTo]}
                            </span>
                            {task.dueDate && (
                              <span className={`text-[8px] px-2.5 py-1 rounded-lg font-black border font-mono flex items-center gap-1.5 ${
                                isOverdue 
                                  ? 'bg-rose-600/20 text-rose-400 border-rose-500/30' 
                                  : isClosing 
                                    ? 'bg-amber-600 text-white border-amber-500 animate-pulse' 
                                    : 'bg-slate-950 text-slate-500 border-slate-900'
                              }`}>
                                📅 ДО: {new Date(task.dueDate).toLocaleDateString()}
                              </span>
                            )}
                            {task.status === 'review' && (
                              <span className="text-[8px] bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 px-2.5 py-1 rounded-lg font-black uppercase tracking-wider animate-pulse flex items-center gap-1.5 shadow-md">
                                <Sparkles size={11}/> ПРОВЕРИТЬ ВЫПОЛНЕНИЕ
                              </span>
                            )}
                          </div>
                          
                          <div className="space-y-1.5">
                            <h3 className="text-xl font-bold font-outfit text-white tracking-tight leading-snug group-hover:text-amber-400 transition-colors">
                              {task.title}
                            </h3>
                            {task.description && (
                              <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{task.description}</p>
                            )}
                          </div>
                          
                          {isOverdue && (
                            <div className="py-2 px-3 border border-rose-500/30 bg-rose-600/10 rounded-xl text-[9px] font-black text-rose-400 uppercase tracking-widest inline-flex items-center gap-2 animate-bounce shadow-lg">
                              <AlertCircle size={12} /> {overdueText}
                            </div>
                          )}

                          {isClosing && (
                            <div className="py-1 px-2.5 bg-amber-500/15 border border-amber-500/20 rounded-lg text-[9px] font-black text-amber-500 uppercase tracking-widest inline-block font-mono">
                              ⏳ МЕНЕЕ 24 ЧАСОВ ДО ИСТЕЧЕНИЯ ДЕДЛАЙНА!
                            </div>
                          )}

                          {/* PROG CODE SEGMENT */}
                          <div className="flex items-center gap-4 pt-1">
                            <div className="flex-1 h-[2px] bg-slate-950 rounded-full flex overflow-hidden">
                              {[1,2,3,4,5].map(step => (
                                <div key={step} className={`flex-1 transition-all ${step <= stat.step ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.3)]' : 'bg-transparent'}`}></div>
                              ))}
                            </div>
                            <span className={`text-[9px] font-black uppercase tracking-widest font-mono ${stat.color} flex items-center gap-1.5`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${stat.glow}`}></span>
                              {stat.label}
                            </span>
                          </div>
                        </div>

                        {/* КНОПКИ ДЕЙСТВИЙ (ПРАВЫЙ УГОЛ) */}
                        <div className="flex flex-col md:items-end justify-between gap-4 shrink-0 border-t md:border-t-0 border-slate-900/60 pt-4 md:pt-0">
                          <div className="flex items-center gap-2">
                            <motion.button 
                              whileHover={{ scale: 1.03 }}
                              whileTap={{ scale: 0.97 }}
                              onClick={() => sendTaskToTelegram(task)} 
                              disabled={isSendingToTg === task.id}
                              className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all flex items-center gap-1.5 ${
                                isSendingToTg === task.id 
                                  ? 'bg-slate-900 text-slate-500 border-slate-800' 
                                  : 'bg-sky-600/10 border-sky-600/30 text-sky-400 hover:bg-sky-600 hover:text-white shadow-lg font-mono'
                              }`}
                            >
                              {isSendingToTg === task.id ? 'ОТПРАВКА...' : <><Send size={11}/> В ТЕЛЕГРАМ</>}
                            </motion.button>
                            
                            <button onClick={() => startEditing(task)} className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-950 border border-slate-800 text-slate-500 hover:text-white transition-all hover:border-indigo-500/50"><Edit size={14}/></button>
                            <button onClick={() => deleteTask(task.id)} className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-950 border border-slate-800 text-slate-500 hover:text-rose-500 transition-all hover:border-rose-500/50"><Trash2 size={14}/></button>
                            <button 
                              onClick={() => { const n = new Set(expandedTasks); if(n.has(task.id)) n.delete(task.id); else n.add(task.id); setExpandedTasks(n); }} 
                              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${isEx ? 'bg-indigo-600 text-white' : 'bg-slate-950 text-slate-500 hover:text-slate-300'}`}
                            >
                              <Plus size={16} className={`transition-transform duration-300 ${isEx ? 'rotate-45' : ''}`}/>
                            </button>
                          </div>
                          
                          <div className="flex flex-col gap-1.5 items-end">
                            <div className="flex gap-1">
                              {['idea', 'in_progress', 'completed'].map(s => (
                                <button 
                                  key={s} 
                                  onClick={() => {
                                    updateState(p => ({
                                      ...p, 
                                      ownerTasks: (p.ownerTasks || []).map(t => t.id === task.id ? {
                                        ...t, 
                                        status: s as any, 
                                        auditLog: [...(t.auditLog || []), logAudit(`Статус изменен на ${s}`, currentOwner)]
                                      } : t)
                                    }));
                                    if (s === 'completed' && !isEx) {
                                      const n = new Set(expandedTasks);
                                      n.add(task.id);
                                      setExpandedTasks(n);
                                    }
                                  }}
                                  className={`px-2.5 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-normal border transition-all font-mono ${
                                    task.status === s 
                                      ? 'bg-indigo-600/25 border-indigo-500/40 text-indigo-400 shadow-md shadow-indigo-600/5' 
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
                            {task.status === 'completed' && !task.taskReport?.statusChoice && (
                              <span className="text-[7.5px] text-amber-500 font-black tracking-widest uppercase font-mono bg-amber-500/5 border border-amber-500/20 px-2 py-0.5 rounded-md animate-pulse">
                                 ⚠ НЕТ ОТЧЕТА!
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* РАСШИРЕННЫЙ СПИСОК (ДЕТАЛИ) */}
                      <AnimatePresence>
                        {isEx && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="bg-slate-950/80 border-t border-slate-900 px-6 sm:px-8 py-6 space-y-6 overflow-hidden"
                          >
                            <div className="p-5 rounded-2xl bg-slate-900/30 border border-slate-800/40 space-y-2 mb-2">
                              <label className="text-[9px] font-black text-slate-550 uppercase tracking-widest block font-mono mb-2">Описание и Цели директивы</label>
                              <BlockDescriptionViewer blocks={task.descriptionBlocks} fallbackText={task.description} />
                              {task.strategyData?.goal && (
                                <div className="mt-3 pt-3 border-t border-slate-800/50 flex items-center gap-2">
                                  <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest font-mono">Целевой вектор:</span>
                                  <span className="text-xs text-amber-500 font-bold">{task.strategyData.goal}</span>
                                </div>
                              )}
                            </div>

                            {/* ДЕЛЕГИРОВАНИЕ */}
                            <div className="p-5 rounded-2xl bg-slate-900/30 border border-slate-800/40 space-y-4">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black text-amber-500 uppercase tracking-[0.2em] block font-mono">Делегирование админам (Синхронизируется с Admin Table):</label>
                                  <div className="flex flex-wrap items-center gap-3">
                                    <select 
                                      value={task.assignedTo} 
                                      onChange={(e) => {
                                        const newAssign = e.target.value as TaskAssignee;
                                        updateState(p => ({
                                          ...p,
                                          ownerTasks: (p.ownerTasks || []).map(t => t.id === task.id ? {
                                            ...t,
                                            assignedTo: newAssign,
                                            taskType: (newAssign === 'Rector' || newAssign === 'Mentor' || newAssign === 'Admins') ? 'regular' : t.taskType,
                                            auditLog: [...(t.auditLog || []), logAudit(`Делегировано: ${ASSIGNEE_LABELS[newAssign]}`, currentOwner)]
                                          } : t)
                                        }));
                                      }}
                                      className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white font-bold outline-none cursor-pointer focus:border-amber-500/50"
                                    >
                                      <optgroup label="Владельцы (Core Table)">
                                        <option value="Owners">Общее (Владельцы)</option>
                                        <option value="Andrey">Андрей</option>
                                        <option value="Anton">Антон</option>
                                      </optgroup>
                                      <optgroup label="Администраторы (Admin Table)">
                                        <option value="Admins">Админы (Общие)</option>
                                        <option value="Mentor">Admin Vi (@adm_viksi_viii)</option>
                                        <option value="Rector">Admin Rector</option>
                                      </optgroup>
                                      <option value="All">Весь состав (Админы + Owner)</option>
                                    </select>
                                    
                                    <div className="text-[10px] uppercase font-black font-mono">
                                      {(task.assignedTo === 'Mentor' || task.assignedTo === 'Rector' || task.assignedTo === 'Admins' || task.assignedTo === 'All') ? (
                                        <span className="text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">📡 Видно на панели админов</span>
                                      ) : (
                                        <span className="text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">🔒 Конфиденциально владельцам</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* СКРИНШОТЫ ИЗОБРАЖЕНИЙ ПОДТВЕРЖДЕНИЯ */}
                            <div className="p-5 rounded-2xl bg-slate-900/30 border border-slate-800/40 space-y-4">
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block font-mono">Файловые отчеты и подтверждения выполнения:</label>
                                <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-extrabold uppercase tracking-widest px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 active:scale-95 shadow-md shadow-indigo-600/15">
                                  <Plus size={11} /> Прикрепить отчет
                                  <input 
                                    type="file" 
                                    accept="image/*" 
                                    multiple 
                                    className="hidden" 
                                    onChange={(e) => handleScreenshotUpload(task.id, e)} 
                                  />
                                </label>
                              </div>

                              {task.screenshots && task.screenshots.length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-in zoom-in-95">
                                  {task.screenshots.map((src, sIdx) => (
                                    <div key={sIdx} className="relative group/img rounded-xl overflow-hidden border border-slate-800 bg-slate-950 aspect-video shadow-md">
                                      <img 
                                        src={src} 
                                        className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300" 
                                        onClick={() => setSelectedImage(src)} 
                                        alt="screenshot" 
                                        referrerPolicy="no-referrer"
                                      />
                                      <button 
                                        onClick={() => {
                                          if (confirm('Удалить этот скриншот?')) {
                                            updateState(prev => ({
                                              ...prev,
                                              ownerTasks: (prev.ownerTasks || []).map(t => t.id === task.id ? {
                                                ...t,
                                                screenshots: (t.screenshots || []).filter((_, i) => i !== sIdx)
                                              } : t)
                                            }));
                                          }
                                        }}
                                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-lg bg-black/70 hover:bg-rose-600 border border-white/10 text-white flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[10px] text-slate-550 italic font-mono">Графический отчет отсутствует. Нажмите кнопку справа, чтобы загрузить снимок.</p>
                              )}
                            </div>

                            
                            {/* РАЗДЕЛ ОТЧЕТА ПО ЗАДАНИЮ */}
                            <TaskReportSection 
                              task={task}
                              isOwner={true}
                              currentUserRole={currentOwner}
                              onSaveReport={(report) => {
                                updateState(prev => ({
                                  ...prev,
                                  ownerTasks: (prev.ownerTasks || []).map(t => t.id === task.id ? {
                                    ...t,
                                    taskReport: report,
                                    updatedAt: new Date().toISOString(),
                                    auditLog: [
                                      ...(t.auditLog || []),
                                      {
                                        id: `audit-${Date.now()}`,
                                        timestamp: new Date().toISOString(),
                                        action: `Отчет по задаче изменен`,
                                        actor: currentOwner
                                      }
                                    ]
                                  } : t)
                                }));
                              }}
                            />

                            {/* ЖУРНАЛ И СИСТЕМНЫЙ АУДИТ */}
                            <div className="p-4 bg-slate-900/15 rounded-xl border border-slate-900 text-[10px] font-mono text-slate-600 space-y-1 max-h-[120px] overflow-y-auto">
                              <span className="text-[9px] text-slate-500 font-extrabold uppercase">ЖУРНАЛ КОРРЕКТИРОВОК:</span>
                              {(task.auditLog || []).map(audit => (
                                <div key={audit.id} className="flex justify-between items-center py-0.5 border-b border-slate-900/50">
                                  <span>• {audit.action} ({audit.actor})</span>
                                  <span>{new Date(audit.timestamp).toLocaleTimeString()}</span>
                                </div>
                              ))}
                            </div>

                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        </>
      ) : (
        /* --- HIGH-END ПЛЕЙБУК СТРАТЕГА (SMART EDITOR WORKSPACE) --- */
        <div className="max-w-5xl mx-auto space-y-5 animate-in slide-in-from-bottom-4 duration-500">
          
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            {/* SUBTABS */}
            <div className="flex gap-1.5 p-1 bg-slate-950 rounded-2xl border border-slate-800/80 w-fit">
              <button 
                onClick={() => setIsArchiveOpen(false)}
                className={`px-5 py-2.5 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all flex items-center gap-1.5 ${!isArchiveOpen ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <FileText size={12} /> Активный Плейбук
              </button>
              <button 
                onClick={() => setIsArchiveOpen(true)}
                className={`px-5 py-2.5 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all flex items-center gap-1.5 ${isArchiveOpen ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <Award size={12} /> Выполненные Директивы ({state.completedDocument ? '1+' : '0'})
              </button>
            </div>

            {/* SKIN CONTROL & TEMPLATES CONTROL */}
            {!isArchiveOpen && (
              <div className="flex flex-wrap items-center gap-3">
                {/* TEMPLATES DROPDOWN */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono">Бланк:</span>
                  <div className="flex gap-1">
                    {TEMPLATES.map(temp => (
                      <button 
                        key={temp.name}
                        onClick={() => applyTemplate(temp.content)}
                        className="bg-slate-900 border border-slate-800 hover:border-amber-500/20 text-[9px] font-semibold text-slate-300 px-2.5 py-1.5 rounded-lg hover:text-white transition-all font-mono"
                      >
                        {temp.name.split(' ')[0]} {/* Show icon only or short label */}
                      </button>
                    ))}
                  </div>
                </div>

                {/* SKINS */}
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-900">
                  <button 
                    onClick={() => setNotebookSkin('chamber')} 
                    className={`p-1.5 rounded-lg text-[9px] font-bold transition-all ${notebookSkin === 'chamber' ? 'bg-slate-800 text-amber-500' : 'text-slate-600 hover:text-slate-300'}`}
                    title="Милитари Найт"
                  >
                    <Palette size={12} />
                  </button>
                  <button 
                    onClick={() => setNotebookSkin('vellum')} 
                    className={`p-1.5 rounded-lg text-[9px] font-bold transition-all ${notebookSkin === 'vellum' ? 'bg-slate-200 text-slate-900' : 'text-slate-600 hover:text-slate-300'}`}
                    title="Имперский Веллум"
                  >
                    <BookOpen size={12} />
                  </button>
                  <button 
                    onClick={() => setNotebookSkin('cyberpunk')} 
                    className={`p-1.5 rounded-lg text-[9px] font-bold transition-all ${notebookSkin === 'cyberpunk' ? 'bg-emerald-950 text-emerald-400' : 'text-slate-600 hover:text-slate-300'}`}
                    title="Хай-Тек"
                  >
                    <Terminal size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {!isArchiveOpen ? (
            <div className="glass-card rounded-[32px] border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl flex flex-col min-h-[850px] relative">
              
              {/* Word Toolbar */}
              <div className="bg-slate-950 border-b border-slate-900 p-2 flex flex-wrap items-center gap-2 sticky top-0 z-20 backdrop-blur-3xl shadow-md">
                <div className="flex items-center gap-0.5 bg-slate-900/40 p-1 rounded-xl border border-slate-900">
                  <button onClick={() => exec('bold')} className="w-8 h-8 rounded-lg hover:bg-slate-800 flex items-center justify-center text-slate-300 font-bold" title="Жирный">B</button>
                  <button onClick={() => exec('italic')} className="w-8 h-8 rounded-lg hover:bg-slate-800 flex items-center justify-center text-slate-300 italic" title="Курсив">I</button>
                  <button onClick={() => exec('underline')} className="w-8 h-8 rounded-lg hover:bg-slate-800 flex items-center justify-center text-slate-300 underline" title="Подчеркнутый">U</button>
                </div>

                <div className="flex items-center gap-0.5 bg-slate-900/40 p-1 rounded-xl border border-slate-900">
                  <button onClick={() => exec('insertUnorderedList')} className="w-8 h-8 rounded-lg hover:bg-slate-800 flex items-center justify-center text-slate-300" title="Маркированный список"><List size={14}/></button>
                  <button onClick={() => exec('insertOrderedList')} className="w-8 h-8 rounded-lg hover:bg-slate-800 flex items-center justify-center text-slate-300" title="Нумерованный список"><ListOrdered size={14}/></button>
                  <button 
                    onClick={() => {
                      const checkbox = '<input type="checkbox" style="width: 14px; height: 14px; margin-right: 8px; vertical-align: middle;" />';
                      exec('insertHTML', checkbox);
                    }} 
                    className="w-8 h-8 rounded-lg hover:bg-slate-800 flex items-center justify-center text-slate-300" 
                    title="Добавить чек-бокс"
                  >
                    <CheckSquare size={14}/>
                  </button>
                </div>

                <div className="flex items-center gap-1 bg-slate-900/40 p-1 rounded-xl border border-slate-900 relative">
                  <button onClick={() => setShowColorPicker(!showColorPicker)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-slate-800 text-slate-300">
                    <Baseline size={14}/>
                    <ChevronDown size={10}/>
                  </button>
                  
                  {showColorPicker && (
                    <div className="absolute top-full left-0 mt-2 p-2.5 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-30 grid grid-cols-5 gap-1.5 animate-in fade-in zoom-in duration-200">
                      {['#ffffff', '#f87171', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6', '#94a3b8', '#000000', '#4ade80'].map(c => (
                        <button 
                          key={c} 
                          onClick={() => { exec('foreColor', c); setShowColorPicker(false); }} 
                          className="w-6 h-6 rounded border border-white/10 hover:scale-125 transition-transform" 
                          style={{ backgroundColor: c }}
                        />
                      ))}
                      <button onClick={() => { exec('hiliteColor', '#fbbf24'); setShowColorPicker(false); }} className="col-span-5 text-[9px] font-black uppercase text-amber-500 py-1 hover:text-white">Маркер (Желтый)</button>
                      <button onClick={() => { exec('removeFormat'); setShowColorPicker(false); }} className="col-span-5 text-[9px] font-black uppercase text-rose-500 py-1 hover:text-rose-400">Сброс формата</button>
                    </div>
                  )}
                </div>

                {/* Stage Controls */}
                <div className="flex items-center gap-1.5 border-l border-slate-900 pl-2">
                  <button 
                    onClick={insertNextTask}
                    className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-amber-500 text-[9px] font-black uppercase hover:bg-amber-600 hover:text-white transition-all flex items-center gap-1.5 font-mono"
                  >
                    <Plus size={11}/> РАЗДЕЛИТЕЛЬ ДИРЕКТИВЫ
                  </button>
                  <button 
                    onClick={completeCurrentTask}
                    className="px-3 py-1.5 bg-emerald-600/20 border border-emerald-500/30 rounded-lg text-emerald-400 text-[9px] font-black uppercase hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-1.5 font-mono"
                  >
                    <Check size={11}/> В АРХИВ ВЫПОЛНЕННЫХ
                  </button>
                </div>

                <div className="ml-auto hidden sm:flex items-center gap-3 pr-2">
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] font-black text-slate-550 uppercase leading-none font-mono">Playbook v2</span>
                    <span className="text-[8px] text-amber-400/80 font-bold uppercase tracking-tighter">AUTHENTIC CONSOLE</span>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>
                </div>
              </div>

              {/* The "Sheet Style Wallpaper Wrapper" */}
              <div className={`flex-1 p-4 md:p-10 overflow-y-auto duration-500 ${
                notebookSkin === 'chamber' ? 'bg-[#0f1115]' :
                notebookSkin === 'vellum' ? 'bg-[#f4f3ef]' : 'bg-[#050c09]'
              }`}>
                <div className={`max-w-[850px] mx-auto min-h-[1000px] rounded-2xl shadow-2xl p-12 md:p-20 relative overflow-hidden transition-all duration-300 border ${
                  notebookSkin === 'chamber' ? 'bg-[#181a21]/90 border-slate-800 text-slate-100' :
                  notebookSkin === 'vellum' ? 'bg-white border-slate-300 text-slate-900 shadow-xl prose-dark font-serif' :
                  'bg-[#0a1510] border-emerald-950 text-emerald-400 font-mono shadow-[0_0_30px_rgba(16,185,129,0.03)]'
                }`}>
                  {/* Decorative paper texture overlay */}
                  {notebookSkin === 'chamber' && <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/black-paper.png')]"></div>}
                  {notebookSkin === 'vellum' && <div className="absolute inset-0 opacity-[0.4] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]"></div>}
                  {notebookSkin === 'cyberpunk' && <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(circle_at_bottom_left,#030712,transparent_100%)]"></div>}

                  <div 
                    ref={editorRef}
                    contentEditable
                    className={`w-full h-full min-h-[900px] outline-none text-[16px] leading-[1.85] prose prose-invert max-w-none relative z-10 ${
                      notebookSkin === 'chamber' ? 'prose-invert font-sans' :
                      notebookSkin === 'vellum' ? 'prose-stone font-serif text-slate-900 font-medium' :
                      'prose-emerald font-mono text-emerald-350'
                    }`}
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

              {/* STATS PANEL BOTTOM */}
              <div className="bg-slate-950 border-t border-slate-900 px-6 py-3 flex justify-between items-center text-[10px] text-slate-500 font-mono">
                <div className="flex gap-4">
                  <span>SKEW SKIN: <strong className="text-slate-300 uppercase">{notebookSkin}</strong></span>
                  <span>CHARACTERS: <strong className="text-slate-300">{docStats.chars}</strong></span>
                  <span>WORDS: <strong className="text-slate-300">{docStats.words}</strong></span>
                </div>
                <div>
                  <span>ESTIMATED READING: <strong className="text-amber-500">{docStats.minRead} MIN</strong></span>
                </div>
              </div>

            </div>
          ) : (
            <div className="glass-card rounded-[32px] border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl flex flex-col min-h-[850px] animate-in slide-in-from-bottom-4 duration-500">
              <div className="bg-slate-900/30 border-b border-slate-800 px-8 py-6 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold font-outfit text-white">Архив Выполненных Задач плейбука</h3>
                  <p className="text-xs text-slate-500">Реестр исторически завершенных директив конвейера</p>
                </div>
                <button 
                  onClick={() => {
                    if (confirm('Внимание! Действие безвозвратно очистит весь исторический архив плейбука. Очистить?')) {
                      updateState(prev => ({ ...prev, completedDocument: '' }));
                    }
                  }} 
                  className="text-rose-500 hover:text-rose-400 text-[10px] font-black uppercase tracking-widest transition-colors font-mono"
                >
                  Очистить Коллапс-Архив
                </button>
              </div>
              <div className="flex-1 p-6 md:p-12 overflow-y-auto bg-slate-950 font-serif">
                <div className="max-w-[850px] mx-auto bg-[#13161c] rounded-2xl p-12 md:p-20 text-slate-300 font-sans leading-relaxed border border-slate-900">
                  {state.completedDocument ? (
                    <div dangerouslySetInnerHTML={{ __html: state.completedDocument }} className="prose prose-invert max-w-none prose-emerald" />
                  ) : (
                    <div className="h-[400px] flex flex-col items-center justify-center text-slate-700">
                      <BookOpen size={40} className="mb-4 opacity-15 text-amber-500"/>
                      <p className="uppercase tracking-[0.25em] text-[10px] font-black font-mono">Архив документов не сформирован</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="text-center pt-4">
            <p className="text-[9px] text-slate-700 font-black uppercase tracking-[0.3em] italic opacity-40 hover:opacity-100 transition-opacity cursor-default">
              Continental Digital playboard — Executive Strategic Authority v2.3</p>
          </div>
        </div>
      )}

      {/* --- КОРРЕКТНЫЙ ЛАЙТБОКС С ЛУПОЙ (ПРОСМОТР СКРИНШОТОВ) --- */}
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
          
          <p className="text-[10px] text-slate-500 font-mono mt-4 uppercase tracking-widest">Просмотр оригинального графического отчета</p>
        </div>
      )}

    </div>
  );
};

export default OwnerTable;
