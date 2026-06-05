import React, { useState } from 'react';
import { 
  FileText, 
  Send, 
  Globe, 
  Check, 
  Plus, 
  Paperclip, 
  FileCheck,
  Slash,
  Eye,
  Trash2,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { OwnerTask, TaskReport, TaskDescriptionBlock } from '../types';
import { BlockDescriptionEditor, BlockDescriptionViewer } from './BlockDescriptionEditor';

interface TaskReportSectionProps {
  task: OwnerTask;
  isOwner: boolean; // Owner vs Admin
  currentUserRole: string; // e.g., 'Rector', 'Mentor', 'Andrey', 'Anton'
  onSaveReport: (report: TaskReport) => void;
}

export const TaskReportSection: React.FC<TaskReportSectionProps> = ({
  task,
  isOwner,
  currentUserRole,
  onSaveReport
}) => {
  const currentReport = task.taskReport || {};
  const [statusChoice, setStatusChoice] = useState<'report_attached' | 'no_report_needed' | undefined>(
    currentReport.statusChoice
  );
  const [reportType, setReportType] = useState<'telegram' | 'document' | 'website' | 'none'>(
    currentReport.type || 'none'
  );
  const [telegramLink, setTelegramLink] = useState(currentReport.telegramLink || '');
  const [documentName, setDocumentName] = useState(currentReport.documentName || '');
  const [documentBase64, setDocumentBase64] = useState(currentReport.documentBase64 || '');
  const [websiteBlocks, setWebsiteBlocks] = useState<TaskDescriptionBlock[]>(
    currentReport.websiteBlocks || []
  );

  const [isEditing, setIsEditing] = useState(!task.taskReport);
  const [isSaving, setIsSaving] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setDocumentName(file.name);
    const reader = new FileReader();
    reader.onloadend = () => {
      setDocumentBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    setIsSaving(true);
    const updatedReport: TaskReport = {
      statusChoice,
      type: statusChoice === 'no_report_needed' ? 'none' : reportType,
      telegramLink: reportType === 'telegram' ? telegramLink : undefined,
      documentName: reportType === 'document' ? documentName : undefined,
      documentBase64: reportType === 'document' ? documentBase64 : undefined,
      websiteBlocks: reportType === 'website' ? websiteBlocks : undefined,
      createdAt: currentReport.createdAt || new Date().toISOString(),
      submittedBy: currentReport.submittedBy || currentUserRole
    };
    onSaveReport(updatedReport);
    setIsEditing(false);
    setIsSaving(false);
  };

  return (
    <div className="p-6 rounded-[2rem] bg-slate-900/30 border border-slate-800/80 space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-center border-b border-slate-800/60 pb-4">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] block font-mono">
            📝 ОТЧЕТ ОБ ИСПОЛНЕНИИ ЗАДАНИЯ
          </label>
          <p className="text-[9px] text-slate-500 font-mono">
            {currentReport.createdAt 
              ? `Отправлен: ${new Date(currentReport.createdAt).toLocaleString()} пользователем ${currentReport.submittedBy}`
              : 'Отчет еще не сформирован для данного поручения.'
            }
          </p>
        </div>

        {(!isEditing && !isOwner) && (
          <button 
            onClick={() => setIsEditing(true)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-[9px] font-black text-slate-400 hover:text-white uppercase tracking-wider font-mono transition-colors"
          >
            Редактировать
          </button>
        )}
      </div>

      {/* VIEW MODE ONLY */}
      {!isEditing ? (
        <div className="space-y-4">
          {/* Status Choice Badge */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">РЕШЕНИЕ:</span>
            {statusChoice === 'no_report_needed' ? (
              <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-500 text-[9px] font-bold uppercase tracking-wider rounded-lg font-mono flex items-center gap-1.5">
                <Slash size={10} /> ОТЧЕТ НЕ ТРЕБУЕТСЯ
              </span>
            ) : statusChoice === 'report_attached' ? (
              <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-[9px] font-bold uppercase tracking-wider rounded-lg font-mono flex items-center gap-1.5 animate-pulse">
                <FileCheck size={10} /> ОТЧЕТ ПРИКРЕПЛЕН
              </span>
            ) : (
              <span className="text-[10px] text-rose-500 font-bold font-mono">НЕ ЗАДАНО</span>
            )}
          </div>

          {/* Report content details based on type */}
          {statusChoice === 'report_attached' && (
            <div className="p-5 rounded-2xl bg-slate-950/40 border border-slate-850 space-y-4">
              {reportType === 'telegram' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[10px] uppercase font-black tracking-wider text-sky-400 font-mono">
                    <Send size={12} /> Telegram Пост / Ссылка:
                  </div>
                  {telegramLink ? (
                    <a 
                      href={telegramLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-sky-400 font-bold underline hover:text-sky-350 block break-all font-mono"
                    >
                      {telegramLink}
                    </a>
                  ) : (
                    <p className="text-xs text-slate-500 font-semibold italic">Ссылка на телеграм не указана.</p>
                  )}
                </div>
              )}

              {reportType === 'document' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[10px] uppercase font-black tracking-wider text-amber-500 font-mono">
                    <Paperclip size={12} /> Документ / Прикрепленный файл:
                  </div>
                  {documentName ? (
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/40 border border-slate-850">
                      <div className="flex items-center gap-2.5">
                        <FileText size={18} className="text-amber-500" />
                        <div>
                          <p className="text-xs text-slate-200 font-bold font-mono">{documentName}</p>
                          <p className="text-[8px] text-slate-500 uppercase font-black font-mono">ИЗОБРАЖЕНИЕ КЛИЕНТА</p>
                        </div>
                      </div>
                      {documentBase64 && (
                        <a 
                          href={documentBase64} 
                          download={documentName}
                          className="px-3.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-[9px] text-slate-400 hover:text-white font-bold font-mono flex items-center gap-1 active:scale-95 transition-all"
                        >
                          <Eye size={10} /> СКАЧАТЬ
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 font-semibold italic">Файл не прикреплен.</p>
                  )}

                  {documentBase64 && (
                    <div className="mt-4 rounded-xl overflow-hidden border border-slate-850">
                      <img src={documentBase64} alt="uploaded doc" className="w-full max-h-[300px] object-contain bg-slate-950" referrerPolicy="no-referrer" />
                    </div>
                  )}
                </div>
              )}

              {reportType === 'website' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[10px] uppercase font-black tracking-wider text-indigo-400 font-mono">
                    <Globe size={12} /> Интерактивный отчет на сайте:
                  </div>
                  <div className="p-4 rounded-xl bg-slate-900/20 border border-slate-850">
                    <BlockDescriptionViewer blocks={websiteBlocks} fallbackText="Пустой отчет на сайте." />
                  </div>
                </div>
              )}

              {reportType === 'none' && (
                <p className="text-xs text-slate-500 italic">Спецификация отчета не задана.</p>
              )}
            </div>
          )}
        </div>
      ) : (
        /* EDIT / CREATE MODE (ADMIN & MANAGEABLE) */
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* STEP 1: Status Choice */}
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest font-mono">Шаг 1: Верификация отчета</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setStatusChoice('report_attached');
                  if (reportType === 'none') setReportType('website');
                }}
                className={`py-3.5 px-4 rounded-2xl text-[10px] font-black uppercase tracking-wider border transition-all flex items-center justify-center gap-2 font-mono ${
                  statusChoice === 'report_attached'
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-600/5'
                    : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileCheck size={12} />
                Отчет приложен
              </button>

              <button
                type="button"
                onClick={() => {
                  setStatusChoice('no_report_needed');
                  setReportType('none');
                }}
                className={`py-3.5 px-4 rounded-2xl text-[10px] font-black uppercase tracking-wider border transition-all flex items-center justify-center gap-2 font-mono ${
                  statusChoice === 'no_report_needed'
                    ? 'bg-amber-600/20 border-amber-500 text-amber-500 shadow-lg shadow-amber-600/5'
                    : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Slash size={12} />
                Отчет не требуется
              </button>
            </div>
          </div>

          {/* STEP 2: Content formulation if attached */}
          {statusChoice === 'report_attached' && (
            <div className="space-y-5 p-5 rounded-2xl bg-slate-950/40 border border-slate-850 animate-in zoom-in-95 duration-200">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest font-mono">Шаг 2: Выберите формат отчета</label>
                <div className="flex flex-wrap gap-2">
                  {(['website', 'telegram', 'document'] as const).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setReportType(type)}
                      className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all flex items-center gap-2 font-mono ${
                        reportType === type
                          ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/10'
                          : 'bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {type === 'telegram' && <><Send size={11} /> Telegram пост</>}
                      {type === 'document' && <><Paperclip size={11} /> Файл/Документ</>}
                      {type === 'website' && <><Globe size={11} /> Отчет на сайте</>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Telegram inputs */}
              {reportType === 'telegram' && (
                <div className="space-y-2 animate-in slide-in-from-top-2.5 duration-200">
                  <label className="text-[9px] font-black text-sky-400 uppercase tracking-widest font-mono">Ссылка на Telegram пост:</label>
                  <input
                    type="url"
                    placeholder="https://t.me/channel_name/123"
                    value={telegramLink}
                    onChange={e => setTelegramLink(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-700 outline-none focus:border-sky-500/40 font-mono"
                  />
                  <p className="text-[9px] text-slate-600 font-mono">Пожалуйста, скопируйте и вставьте сюда полный адрес поста в ТГ канале.</p>
                </div>
              )}

              {/* Document/File inputs */}
              {reportType === 'document' && (
                <div className="space-y-3 animate-in slide-in-from-top-2.5 duration-200">
                  <label className="text-[9px] font-black text-amber-500 uppercase tracking-widest font-mono">Загрузить файл отчета (Файл / Документ / Фото):</label>
                  
                  <div className="flex items-center gap-4">
                    <label className="cursor-pointer bg-amber-600 hover:bg-amber-500 text-white text-[9px] font-black uppercase tracking-widest px-4 py-3 rounded-xl transition-all flex items-center gap-2 font-mono active:scale-95 shadow-lg shadow-amber-650/15">
                      <Plus size={12} /> Выбрать файл
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleFileUpload} 
                      />
                    </label>

                    {documentName && (
                      <div className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                        <span className="text-xs text-slate-300 font-bold truncate max-w-[200px] font-mono">{documentName}</span>
                        <button 
                          type="button" 
                          onClick={() => { setDocumentName(''); setDocumentBase64(''); }}
                          className="text-slate-500 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>

                  {documentBase64 && (
                    <div className="mt-3 border border-slate-850 bg-slate-950 rounded-xl overflow-hidden max-h-[220px] flex items-center justify-center">
                      <img src={documentBase64} alt="doc preview" className="object-contain max-h-[220px]" referrerPolicy="no-referrer" />
                    </div>
                  )}
                </div>
              )}

              {/* Interactive report on the website with BlockDescriptionEditor */}
              {reportType === 'website' && (
                <div className="space-y-3 animate-in slide-in-from-top-2.5 duration-200">
                  <div className="flex justify-between items-center">
                    <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest font-mono">Заполнение отчета на сайте (Тексты, Форматирование, Изображения):</label>
                  </div>
                  <BlockDescriptionEditor 
                    blocks={websiteBlocks} 
                    onChange={setWebsiteBlocks} 
                    accentColor="sky" 
                  />
                  <p className="text-[9px] text-slate-600 font-mono">Используйте тулбар выше, чтобы добавлять богатые текстовые блоки, заголовки, списки или встраивать снимки.</p>
                </div>
              )}
            </div>
          )}

          {/* Action Footer */}
          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-800/40">
            {task.taskReport && (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-[9px] font-black text-slate-550 uppercase tracking-widest font-mono transition-colors"
              >
                Отмена
              </button>
            )}

            <button
              type="button"
              disabled={!statusChoice}
              onClick={handleSave}
              className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 font-mono ${
                !statusChoice 
                  ? 'bg-slate-900 border border-slate-850 text-slate-600 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500 hover:border-indigo-400 shadow-lg shadow-indigo-600/10 active:scale-95'
              }`}
            >
              <Check size={11} />
              Сохранить Отчет
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
