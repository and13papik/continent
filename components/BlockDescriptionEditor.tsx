import React, { useState, useRef, useEffect } from 'react';
import { 
  Bold, 
  Italic, 
  Underline, 
  List, 
  ListOrdered, 
  Link as LinkIcon, 
  Heading1, 
  Heading2, 
  Palette, 
  Minus, 
  Type, 
  Image as ImageIcon, 
  ArrowUp, 
  ArrowDown, 
  Trash2, 
  Plus, 
  Sparkles,
  FileImage,
  UploadCloud
} from 'lucide-react';
import { TaskDescriptionBlock } from '../types';

interface BlockDescriptionEditorProps {
  blocks: TaskDescriptionBlock[];
  onChange: (updated: TaskDescriptionBlock[]) => void;
  accentColor: 'amber' | 'sky';
}

// --- ИНДИВИДУАЛЬНЫЙ РЕДАКТОР ДЛЯ СТРОКИ ТЕКСТА ---
function RichTextEditor({ 
  initialHtml, 
  onHtmlChange, 
  accentColor 
}: { 
  initialHtml: string; 
  onHtmlChange: (html: string) => void;
  accentColor: 'amber' | 'sky';
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showColors, setShowColors] = useState(false);

  // Initialize once to prevent cursor reset
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== initialHtml) {
      editorRef.current.innerHTML = initialHtml || '<div><br></div>';
    }
  }, []);

  const handleInput = () => {
    if (editorRef.current) {
      onHtmlChange(editorRef.current.innerHTML);
    }
  };

  const execCommand = (cmd: string, val: string = '') => {
    if (cmd === 'createLink') {
      const url = prompt('Введите URL ссылки (например, https://google.com):');
      if (!url) return;
      document.execCommand(cmd, false, url);
    } else {
      document.execCommand(cmd, false, val);
    }
    handleInput();
  };

  const colors = [
    '#ffffff', '#94a3b8', '#f43f5e', '#fbbf24', '#34d399', '#38bdf8', '#a78bfa'
  ];

  const focusBorder = accentColor === 'amber' ? 'focus:border-amber-500/50' : 'focus:border-sky-500/50';
  const btnActiveBg = accentColor === 'amber' ? 'hover:bg-amber-500/10 hover:text-amber-400' : 'hover:bg-sky-500/10 hover:text-sky-450';

  return (
    <div className="space-y-2 border border-slate-800/80 rounded-2xl overflow-hidden bg-slate-950/50">
      {/* Тулбар форматирования */}
      <div className="flex flex-wrap items-center gap-1 bg-slate-950 px-3 py-2 border-b border-slate-800/80">
        <button
          type="button"
          onClick={() => execCommand('bold')}
          className={`p-1.5 rounded-lg text-slate-400 transition-all ${btnActiveBg}`}
          title="Жирный"
        >
          <Bold size={13} />
        </button>
        <button
          type="button"
          onClick={() => execCommand('italic')}
          className={`p-1.5 rounded-lg text-slate-400 transition-all ${btnActiveBg}`}
          title="Курсив"
        >
          <Italic size={13} />
        </button>
        <button
          type="button"
          onClick={() => execCommand('underline')}
          className={`p-1.5 rounded-lg text-slate-400 transition-all ${btnActiveBg}`}
          title="Подчеркнутый"
        >
          <Underline size={13} />
        </button>

        <div className="w-[1px] h-4 bg-slate-800 self-center mx-1"></div>

        <button
          type="button"
          onClick={() => execCommand('formatBlock', '<h2>')}
          className={`p-1.5 rounded-lg text-slate-400 transition-all ${btnActiveBg}`}
          title="Заголовок H2"
        >
          <Heading1 size={13} />
        </button>
        <button
          type="button"
          onClick={() => execCommand('formatBlock', '<h3>')}
          className={`p-1.5 rounded-lg text-slate-400 transition-all ${btnActiveBg}`}
          title="Заголовок H3"
        >
          <Heading2 size={13} />
        </button>

        <div className="w-[1px] h-4 bg-slate-800 self-center mx-1"></div>

        <button
          type="button"
          onClick={() => execCommand('insertUnorderedList')}
          className={`p-1.5 rounded-lg text-slate-400 transition-all ${btnActiveBg}`}
          title="Маркированный список"
        >
          <List size={13} />
        </button>
        <button
          type="button"
          onClick={() => execCommand('insertOrderedList')}
          className={`p-1.5 rounded-lg text-slate-400 transition-all ${btnActiveBg}`}
          title="Нумерованный список"
        >
          <ListOrdered size={13} />
        </button>

        <div className="w-[1px] h-4 bg-slate-800 self-center mx-1"></div>

        <button
          type="button"
          onClick={() => execCommand('createLink')}
          className={`p-1.5 rounded-lg text-slate-400 transition-all ${btnActiveBg}`}
          title="Вставить ссылку"
        >
          <LinkIcon size={13} />
        </button>
        <button
          type="button"
          onClick={() => execCommand('insertHorizontalRule')}
          className={`p-1.5 rounded-lg text-slate-400 transition-all ${btnActiveBg}`}
          title="Разделительная линия"
        >
          <Minus size={13} />
        </button>

        <div className="w-[1px] h-4 bg-slate-800 self-center mx-1"></div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowColors(!showColors)}
            className={`p-1.5 rounded-lg text-slate-400 transition-all ${btnActiveBg} ${showColors ? 'text-amber-500' : ''}`}
            title="Цвет текста"
          >
            <Palette size={13} />
          </button>
          {showColors && (
            <div className="absolute top-8 left-0 flex items-center gap-1 bg-slate-900 border border-slate-800 p-1.5 rounded-xl z-[50] shadow-xl">
              {colors.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => {
                    execCommand('foreColor', color);
                    setShowColors(false);
                  }}
                  className="w-4 h-4 rounded-full border border-slate-950 focus:scale-110 active:scale-95 transition-transform"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Editor Content Area */}
      <div 
        ref={editorRef}
        contentEditable={true}
        onInput={handleInput}
        className={`w-full min-h-[100px] outline-none text-xs text-white p-4 leading-relaxed font-sans cursor-text rounded-b-2xl transition-all ${focusBorder}`}
      />
    </div>
  );
}

// --- ГЛАВНЫЙ КОМПОНЕНТ РЕДАКТОРА ---
export const BlockDescriptionEditor: React.FC<BlockDescriptionEditorProps> = ({
  blocks = [],
  onChange,
  accentColor = 'amber'
}) => {
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const addTextBlock = () => {
    const newBlock: TaskDescriptionBlock = {
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type: 'text',
      text: '<div></div>',
      caption: ''
    };
    onChange([...blocks, newBlock]);
  };

  const addImageBlock = () => {
    const newBlock: TaskDescriptionBlock = {
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type: 'image',
      imageSrc: '',
      caption: ''
    };
    onChange([...blocks, newBlock]);
  };

  const removeBlock = (id: string) => {
    onChange(blocks.filter(b => b.id !== id));
  };

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= blocks.length) return;

    const copy = [...blocks];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;
    onChange(copy);
  };

  const updateBlockText = (id: string, text: string) => {
    onChange(blocks.map(b => b.id === id ? { ...b, text } : b));
  };

  const updateBlockCaption = (id: string, caption: string) => {
    onChange(blocks.map(b => b.id === id ? { ...b, caption } : b));
  };

  const handleImageFile = (id: string, file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      onChange(blocks.map(b => b.id === id ? { ...b, imageSrc: base64 } : b));
    };
    reader.readAsDataURL(file);
  };

  const accentBorder = accentColor === 'amber' ? 'hover:border-amber-500/30' : 'hover:border-sky-500/30';
  const textBtnClass = accentColor === 'amber' 
    ? 'bg-amber-600/10 border-amber-600/20 text-amber-500 hover:bg-amber-600/25' 
    : 'bg-sky-600/10 border-sky-600/20 text-sky-450 hover:bg-sky-600/25';
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-slate-900 pb-2">
        <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] font-mono">
          Конструктор деталей (Блоки)
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={addTextBlock}
            className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all flex items-center gap-1.5 font-mono ${textBtnClass}`}
          >
            <Type size={11} /> + Текст
          </button>
          <button
            type="button"
            onClick={addImageBlock}
            className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all flex items-center gap-1.5 font-mono ${textBtnClass}`}
          >
            <ImageIcon size={11} /> + Фотографию
          </button>
        </div>
      </div>

      {blocks.length === 0 ? (
        <div className="py-8 px-4 border border-dashed border-slate-800 rounded-2xl text-center space-y-2">
          <p className="text-xs text-slate-500 font-medium">Конструктор деталей пуст.</p>
          <p className="text-[10px] text-slate-600 leading-normal max-w-[320px] mx-auto">
            Добавьте текстовые блоки или фотографии. Вы сможете настроить их порядок, выделить важные моменты ссылками и шрифтом, а также подписать снимки.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {blocks.map((block, index) => {
            const isFirst = index === 0;
            const isLast = index === blocks.length - 1;

            return (
              <div 
                key={block.id}
                className={`relative group bg-slate-900/10 border border-slate-850 p-4 rounded-2xl space-y-3 transition-all ${accentBorder}`}
              >
                {/* Заголовок блока с контроллерами перемещения */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 font-mono">
                      Блок {index + 1}: {block.type === 'text' ? '📝 Текстовый редактор' : '🖼️ Фото/Изображение'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Кнопка ВВЕРХ */}
                    <button
                      type="button"
                      disabled={isFirst}
                      onClick={() => moveBlock(index, 'up')}
                      className={`w-6 h-6 rounded-md flex items-center justify-center border border-slate-800 text-slate-500 transition-colors ${!isFirst ? 'hover:bg-slate-850 hover:text-white' : 'opacity-20 cursor-not-allowed'}`}
                      title="Переместить выше"
                    >
                      <ArrowUp size={11} />
                    </button>
                    {/* Кнопка ВНИЗ */}
                    <button
                      type="button"
                      disabled={isLast}
                      onClick={() => moveBlock(index, 'down')}
                      className={`w-6 h-6 rounded-md flex items-center justify-center border border-slate-800 text-slate-500 transition-colors ${!isLast ? 'hover:bg-slate-850 hover:text-white' : 'opacity-20 cursor-not-allowed'}`}
                      title="Переместить ниже"
                    >
                      <ArrowDown size={11} />
                    </button>
                    {/* Удалить */}
                    <button
                      type="button"
                      onClick={() => removeBlock(block.id)}
                      className="w-6 h-6 rounded-md flex items-center justify-center border border-slate-800 text-slate-500 hover:text-rose-500 hover:border-rose-500/30 transition-all ml-1"
                      title="Удалить блок"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>

                {/* Содержимое блока в зависимости от типа */}
                {block.type === 'text' ? (
                  <RichTextEditor
                    initialHtml={block.text || ''}
                    onHtmlChange={(html) => updateBlockText(block.id, html)}
                    accentColor={accentColor}
                  />
                ) : (
                  <div className="space-y-3 font-mono">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                      {/* Слот загрузки или предпросмотр */}
                      <div className="md:col-span-4">
                        {block.imageSrc ? (
                          <div className="relative rounded-xl overflow-hidden border border-slate-800 aspect-video bg-slate-950 group/img">
                            <img 
                              src={block.imageSrc} 
                              className="w-full h-full object-cover" 
                              alt="Uploaded content" 
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-all">
                              <label className="cursor-pointer text-[9px] text-white bg-slate-800 hover:bg-slate-700 font-bold uppercase py-1.5 px-3 rounded-lg border border-slate-700 transition">
                                Заменить
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                      handleImageFile(block.id, e.target.files[0]);
                                    }
                                  }}
                                />
                              </label>
                            </div>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-xl py-6 px-4 hover:border-slate-750 transition-all cursor-pointer bg-slate-950/30 active:scale-[0.98]">
                            <UploadCloud className="text-slate-600 mb-2 animate-pulse" size={24} />
                            <span className="text-[10px] text-slate-400 font-medium font-sans">Перетащите или нажмите</span>
                            <span className="text-[8px] text-slate-600 mt-1 uppercase">Загрузить JPG/PNG</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  handleImageFile(block.id, e.target.files[0]);
                                }
                              }}
                            />
                          </label>
                        )}
                      </div>

                      {/* Текст/описание/порядок для фото */}
                      <div className="md:col-span-8 space-y-1.5 font-mono">
                        <label className="text-[9px] font-black text-slate-550 uppercase tracking-widest ml-1 block">
                          Подпись к фотографии (Текст фото)
                        </label>
                        <input
                          type="text"
                          className="w-full bg-slate-950 border border-slate-800/80 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-slate-700 transition-all font-sans"
                          placeholder="Пример: Интерфейс личного кабинета со статистикой..."
                          value={block.caption || ''}
                          onChange={(e) => updateBlockCaption(block.id, e.target.value)}
                        />
                        <p className="text-[9px] text-slate-600 font-sans italic">
                          Этот текст отобразится непосредственно под фотографией.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// --- КОМПОНЕНТ ДЛЯ ОТОБРАЖЕНИЯ БЛОКОВ (VIEWER) ---
export const BlockDescriptionViewer: React.FC<{
  blocks?: TaskDescriptionBlock[];
  fallbackText: string;
}> = ({ blocks, fallbackText }) => {
  if (!blocks || blocks.length === 0) {
    return (
      <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">
        {fallbackText || 'Вводный контекст/описание отсутствует.'}
      </p>
    );
  }

  return (
    <div className="space-y-4 font-sans prose-styles">
      {/* Встроенные стили для корректного отображения HTML-тегов */}
      <style>{`
        .prose-styles h2 {
          font-size: 1.15rem;
          font-weight: 800;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
          color: #ffffff;
          font-family: ui-sans-serif, system-ui, sans-serif;
          letter-spacing: -0.025em;
        }
        .prose-styles h3 {
          font-size: 1.0rem;
          font-weight: 700;
          margin-top: 1rem;
          margin-bottom: 0.5rem;
          color: #e2e8f0;
          font-family: ui-sans-serif, system-ui, sans-serif;
        }
        .prose-styles b, .prose-styles strong {
          font-weight: 700;
          color: #f1f5f9;
        }
        .prose-styles ul {
          list-style-type: disc !important;
          padding-left: 1.25rem !important;
          margin-top: 0.5rem !important;
          margin-bottom: 0.5rem !important;
        }
        .prose-styles ol {
          list-style-type: decimal !important;
          padding-left: 1.25rem !important;
          margin-top: 0.5rem !important;
          margin-bottom: 0.5rem !important;
        }
        .prose-styles li {
          margin-bottom: 0.25rem;
        }
        .prose-styles a {
          color: #38bdf8;
          text-decoration: underline;
          transition: color 0.15s;
        }
        .prose-styles a:hover {
          color: #0ea5e9;
        }
        .prose-styles hr {
          border: 0;
          border-top: 1px solid #1e293b;
          margin: 1.25rem 0;
        }
      `}</style>

      {blocks.map((block) => {
        if (block.type === 'text') {
          return (
            <div 
              key={block.id}
              className="text-xs text-slate-300 leading-relaxed prose-styles"
              dangerouslySetInnerHTML={{ __html: block.text || '<div></div>' }}
            />
          );
        } else if (block.type === 'image') {
          if (!block.imageSrc) return null;
          return (
            <div key={block.id} className="space-y-2 py-1.5 my-2">
              <div className="rounded-2xl overflow-hidden border border-slate-800/80 bg-slate-950/50 p-1.5 max-w-full sm:max-w-md mx-auto shadow-xl shadow-black/50 hover:border-slate-700/60 transition-colors">
                <img 
                  src={block.imageSrc} 
                  alt={block.caption || "Task illustration"} 
                  className="w-full h-auto rounded-xl object-contain max-h-[360px] mx-auto"
                  referrerPolicy="no-referrer"
                />
              </div>
              {block.caption && (
                <p className="text-[10px] text-slate-400 font-bold italic text-center leading-normal font-mono px-4">
                  📸 {block.caption}
                </p>
              )}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
};

