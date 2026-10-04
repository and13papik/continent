import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Activity, 
  Download, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Sparkles, 
  Flame, 
  Zap, 
  Crown, 
  ShieldCheck, 
  Clock, 
  MessageSquare, 
  DollarSign, 
  Percent, 
  Award,
  Layers,
  Bot,
  Copy,
  FileText,
  FileCode,
  Image,
  Lock,
  Info,
  RefreshCw,
  User
} from 'lucide-react';
import html2canvas from 'html2canvas';

export interface OperatorDeepStatsModalProps {
  operator: {
    user_id: string;
    name: string;
    avatar?: string;
    messages_count?: number;
    paid_messages_count?: number;
    sold_messages_count?: number;
    earnings?: number;
    reply_time_avg?: number | null;
  };
  onClose: () => void;
  currentShiftLabel?: string;
  currentSortBy?: 'messages' | 'reply_time' | 'ppv_sent' | 'ppv_sold' | 'earnings';
}

export function getSortByLabel(sb?: string): string {
  switch (sb) {
    case 'earnings':
      return 'по доходу';
    case 'reply_time':
      return 'по скорости ответа';
    case 'ppv_sent':
      return 'по отправленным PPV';
    case 'ppv_sold':
      return 'по проданным PPV';
    case 'messages':
    default:
      return 'по сообщениям';
  }
}

interface MetricChange {
  current: number;
  previous: number;
  percent: number;
  status: 'up' | 'down' | 'same' | 'new' | 'no_data';
}

interface DeepStatsResponse {
  success: boolean;
  user_id: string;
  name: string;
  avatar: string;
  rank: number;
  totalOperators: number;
  sortBy?: 'messages' | 'reply_time' | 'ppv_sent' | 'ppv_sold' | 'earnings';
  periods: {
    current: { start: string; end: string };
    previous: { start: string; end: string };
  };
  current: {
    messages_count: number;
    typed_messages_count: number;
    ai_generated_messages_count: number;
    copied_messages_count: number;
    template_messages_count: number;
    internal_templates_count: number;
    free_media_messages_count: number;
    paid_messages_count: number;
    sold_messages_count: number;
    earnings: number;
    conversion: number;
    reply_time_avg: number | null;
    messageTypeBreakdown: {
      typed: { count: number; percent: number };
      ai: { count: number; percent: number };
      copied: { count: number; percent: number };
      template: { count: number; percent: number };
      internal_templates: { count: number; percent: number };
      free_media: { count: number; percent: number };
      paid: { count: number; percent: number };
    };
  };
  previous: {
    messages_count: number;
    typed_messages_count: number;
    ai_generated_messages_count: number;
    copied_messages_count: number;
    template_messages_count: number;
    internal_templates_count: number;
    free_media_messages_count: number;
    paid_messages_count: number;
    sold_messages_count: number;
    earnings: number;
    conversion: number;
    reply_time_avg: number | null;
    messageTypeBreakdown: {
      typed: { count: number; percent: number };
      ai: { count: number; percent: number };
      copied: { count: number; percent: number };
      template: { count: number; percent: number };
      internal_templates: { count: number; percent: number };
      free_media: { count: number; percent: number };
      paid: { count: number; percent: number };
    };
  };
  changes: {
    messages_count: MetricChange;
    paid_messages_count: MetricChange;
    sold_messages_count: MetricChange;
    earnings: MetricChange;
    conversion: MetricChange;
    reply_time_avg: MetricChange;
    messageTypes: {
      typed: MetricChange;
      ai: MetricChange;
      copied: MetricChange;
      template: MetricChange;
      internal_templates: MetricChange;
      free_media: MetricChange;
      paid: MetricChange;
    };
  };
  teamTrend: {
    messages: number;
    earnings: number;
    conversion: number;
    reply_time: number;
  };
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || isNaN(seconds) || seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function generateWeeklyNarrative(
  changes: DeepStatsResponse['changes'],
  teamTrend: DeepStatsResponse['teamTrend'],
  currConv: number,
  prevConv: number
): string[] {
  const points: { score: number; text: string }[] = [];

  // 1. Messages Activity
  const msgChange = changes.messages_count;
  if (Math.abs(msgChange.percent) >= 15 && msgChange.status !== 'no_data') {
    const isUp = msgChange.percent > 0;
    points.push({
      score: Math.abs(msgChange.percent),
      text: isUp
        ? `📈 Активность выросла на ${msgChange.percent}% (${msgChange.current} сообщений против ${msgChange.previous} на прошлой неделе).`
        : `📉 Общий объём сообщений снизился на ${Math.abs(msgChange.percent)}% (${msgChange.current} против ${msgChange.previous} ранее).`
    });
  }

  // 2. PPV Conversion
  const convChange = changes.conversion;
  if (Math.abs(convChange.percent) >= 15 && convChange.status !== 'no_data') {
    const isUp = convChange.percent > 0;
    points.push({
      score: Math.abs(convChange.percent) * 1.2,
      text: isUp
        ? `💎 Конверсия платных сообщений показала отличный рост (+${convChange.percent}%, текущая ${currConv}% против ${prevConv}%).`
        : `⚠️ Конверсия PPV просела на ${Math.abs(convChange.percent)}% (с ${prevConv}% до ${currConv}%).`
    });
  }

  // 3. Reply Speed
  const rtChange = changes.reply_time_avg;
  if (Math.abs(rtChange.percent) >= 20 && rtChange.status !== 'no_data') {
    const isFaster = rtChange.percent < 0; // Less seconds is faster
    points.push({
      score: Math.abs(rtChange.percent),
      text: isFaster
        ? `⚡ Скорость ответа заметно улучшилась на ${Math.abs(rtChange.percent)}% (сократилось среднее время ожидания фана до ${formatDuration(rtChange.current)}).`
        : `🐢 Время ответа фанам увеличилось на ${rtChange.percent}% (с ${formatDuration(rtChange.previous)} до ${formatDuration(rtChange.current)}).`
    });
  }

  // 4. Comparison with Team Trend
  const opMsgGrowth = msgChange.percent;
  const teamMsgGrowth = teamTrend.messages;
  const diffFromTeam = opMsgGrowth - teamMsgGrowth;

  if (Math.abs(diffFromTeam) >= 10 && msgChange.status !== 'no_data') {
    const isBeatingTeam = diffFromTeam > 0;
    points.push({
      score: Math.abs(diffFromTeam) * 1.1,
      text: isBeatingTeam
        ? `🚀 Опережает средний темп команды на ${diffFromTeam.toFixed(1)} п.п. (+${opMsgGrowth}% у оператора против ${teamMsgGrowth > 0 ? '+' : ''}${teamMsgGrowth}% по команде).`
        : `⏱️ Отстаёт от общей динамики команды на ${Math.abs(diffFromTeam).toFixed(1)} п.п. (${opMsgGrowth > 0 ? '+' : ''}${opMsgGrowth}% против ${teamMsgGrowth > 0 ? '+' : ''}${teamMsgGrowth}% у команды).`
    });
  }

  // Fallback if low variation
  if (points.length === 0) {
    points.push({
      score: 1,
      text: `⚖️ Стабильные рабочие показатели: ключевые метрики находятся в пределах обычной еженедельной нормы.`
    });
  }

  points.sort((a, b) => b.score - a.score);
  return points.slice(0, 4).map(p => p.text);
}

export const OperatorDeepStatsModal: React.FC<OperatorDeepStatsModalProps> = ({
  operator,
  onClose,
  currentShiftLabel,
  currentSortBy
}) => {
  const [data, setData] = useState<DeepStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchDeepStats = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.append('resource', 'operator-deep-stats');
        params.append('user_id', operator.user_id);
        if (operator.name) params.append('name', operator.name);
        if (operator.avatar) params.append('avatar', operator.avatar);
        params.append('sort_by', currentSortBy || 'messages');

        const res = await fetch(`/api/onlymonster/analytics?${params.toString()}`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = await res.json();
        if (!json.success) {
          throw new Error(json.error || 'Не удалось получить детальные метрики оператора');
        }
        if (isMounted) {
          setData(json);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || 'Ошибка загрузки данных');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDeepStats();
    return () => {
      isMounted = false;
    };
  }, [operator.user_id, operator.name, operator.avatar, currentSortBy]);

  const handleDownloadCard = async () => {
    if (!cardRef.current || isExporting) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#0a0d17',
        scale: 2,
        useCORS: true,
        logging: false
      });
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      const cleanName = (operator.name || 'operator').replace(/\s+/g, '_');
      a.download = `card-${cleanName}-${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
    } catch (e) {
      console.error('Error generating card image:', e);
    } finally {
      setIsExporting(false);
    }
  };

  // Helper for change badge
  const renderChangeBadge = (c?: MetricChange, invertColors: boolean = false) => {
    if (!c || c.status === 'no_data') {
      return <span className="text-[10px] text-slate-500 font-mono flex items-center gap-0.5"><Minus size={10} /> 0%</span>;
    }
    if (c.status === 'new') {
      return <span className="text-[10px] font-black font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-1 rounded">NEW</span>;
    }

    const isGood = invertColors ? c.percent < 0 : c.percent > 0;
    const isBad = invertColors ? c.percent > 0 : c.percent < 0;

    const colorClass = isGood
      ? 'text-emerald-400 bg-emerald-950/40 border-emerald-500/30'
      : isBad
      ? 'text-rose-400 bg-rose-950/40 border-rose-500/30'
      : 'text-slate-400 bg-slate-800/40 border-slate-700/30';

    return (
      <span className={`text-[10px] font-black font-mono border px-1.5 py-0.5 rounded flex items-center gap-0.5 ${colorClass}`}>
        {c.percent > 0 ? <TrendingUp size={10} /> : c.percent < 0 ? <TrendingDown size={10} /> : <Minus size={10} />}
        {c.percent > 0 ? `+${c.percent}%` : `${c.percent}%`}
      </span>
    );
  };

  // Radar chart SVG calculation
  const renderRadarChart = () => {
    if (!data) return null;

    const cx = 175;
    const cy = 175;
    const r = 110;

    // 6 Axes:
    // 1: Messages
    // 2: PPV Sent
    // 3: PPV Sold
    // 4: Earnings
    // 5: Reply Speed (Inverted: smaller seconds = higher radius = better)
    // 6: Conversion (%)
    const axes = [
      {
        label: 'Сообщения',
        currVal: data.current.messages_count,
        prevVal: data.previous.messages_count,
        format: (v: number) => v.toLocaleString()
      },
      {
        label: 'PPV отпр.',
        currVal: data.current.paid_messages_count,
        prevVal: data.previous.paid_messages_count,
        format: (v: number) => v.toLocaleString()
      },
      {
        label: 'PPV прод.',
        currVal: data.current.sold_messages_count,
        prevVal: data.previous.sold_messages_count,
        format: (v: number) => v.toLocaleString()
      },
      {
        label: 'Доход ($)',
        currVal: data.current.earnings,
        prevVal: data.previous.earnings,
        format: (v: number) => `$${Math.round(v)}`
      },
      {
        label: 'Скорость',
        isInverted: true,
        currVal: data.current.reply_time_avg || 0,
        prevVal: data.previous.reply_time_avg || 0,
        format: (v: number) => v > 0 ? formatDuration(v) : '—'
      },
      {
        label: 'Конверсия',
        currVal: data.current.conversion,
        prevVal: data.previous.conversion,
        format: (v: number) => `${v}%`
      }
    ];

    const numAxes = axes.length;

    // Compute normalized points (0 to 1) for each axis
    const getAxisCoord = (index: number, normVal: number) => {
      const angle = -Math.PI / 2 + (index * 2 * Math.PI) / numAxes;
      const x = cx + normVal * r * Math.cos(angle);
      const y = cy + normVal * r * Math.sin(angle);
      return { x, y, angle };
    };

    const currPoints = axes.map((axis, i) => {
      let norm = 0;
      if (axis.isInverted) {
        // Less is better: 30s is top (1.0), 300s is low (0.1)
        const v = axis.currVal || 300;
        const clamped = Math.max(20, Math.min(360, v));
        norm = Math.max(0.1, 1 - (clamped - 20) / 340);
      } else {
        const maxVal = Math.max(axis.currVal, axis.prevVal, 1) * 1.15;
        norm = Math.max(0.08, Math.min(1, axis.currVal / maxVal));
      }
      return getAxisCoord(i, norm);
    });

    const prevPoints = axes.map((axis, i) => {
      let norm = 0;
      if (axis.isInverted) {
        const v = axis.prevVal || 300;
        const clamped = Math.max(20, Math.min(360, v));
        norm = Math.max(0.1, 1 - (clamped - 20) / 340);
      } else {
        const maxVal = Math.max(axis.currVal, axis.prevVal, 1) * 1.15;
        norm = Math.max(0.08, Math.min(1, axis.prevVal / maxVal));
      }
      return getAxisCoord(i, norm);
    });

    const currPolyStr = currPoints.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const prevPolyStr = prevPoints.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    const levels = [0.25, 0.5, 0.75, 1];

    return (
      <div className="relative flex flex-col items-center">
        <svg viewBox="0 0 350 350" className="w-full max-w-[320px] sm:max-w-[340px] overflow-visible">
          {/* Concentric grid rings */}
          {levels.map((lvl) => {
            const ringPts = Array.from({ length: numAxes }).map((_, i) => {
              const { x, y } = getAxisCoord(i, lvl);
              return `${x.toFixed(1)},${y.toFixed(1)}`;
            }).join(' ');
            return (
              <polygon
                key={lvl}
                points={ringPts}
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth={lvl === 1 ? '1.5' : '1'}
                strokeDasharray={lvl === 1 ? undefined : '2 3'}
              />
            );
          })}

          {/* Radial Spokes */}
          {axes.map((_, i) => {
            const { x, y } = getAxisCoord(i, 1);
            return (
              <line
                key={i}
                x1={cx}
                y1={cy}
                x2={x}
                y2={y}
                stroke="rgba(255,255,255,0.12)"
                strokeWidth="1"
              />
            );
          })}

          {/* Previous Week Polygon (Slate Dashed) */}
          <polygon
            points={prevPolyStr}
            fill="rgba(100, 116, 139, 0.2)"
            stroke="#94a3b8"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />

          {/* Current Week Polygon (Violet Glowing) */}
          <polygon
            points={currPolyStr}
            fill="rgba(139, 92, 246, 0.35)"
            stroke="#a78bfa"
            strokeWidth="2.5"
          />

          {/* Points on current week */}
          {currPoints.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="4"
              fill="#c084fc"
              stroke="#1e1b4b"
              strokeWidth="2"
            />
          ))}

          {/* Axis Labels */}
          {axes.map((axis, i) => {
            const labelCoord = getAxisCoord(i, 1.25);
            return (
              <g key={i}>
                <text
                  x={labelCoord.x}
                  y={labelCoord.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-slate-300 font-mono text-[10px] font-bold"
                >
                  {axis.label}
                </text>
                <text
                  x={labelCoord.x}
                  y={labelCoord.y + 11}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-violet-300 font-mono text-[9px] font-black"
                >
                  {axis.format(axis.currVal)}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div className="flex items-center gap-5 mt-2 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-violet-500 inline-block shadow-sm"></span>
            <span className="text-violet-300 font-bold">Текущая неделя</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-b-2 border-dashed border-slate-400 inline-block"></span>
            <span className="text-slate-400 font-bold">Прошлая неделя</span>
          </div>
        </div>
      </div>
    );
  };

  const narrativeSentences = data
    ? generateWeeklyNarrative(
        data.changes,
        data.teamTrend,
        data.current.conversion,
        data.previous.conversion
      )
    : [];

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 font-mono overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="glass-card bg-[#0b0f19] border border-white/20 rounded-3xl max-w-4xl w-full text-white shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center text-white font-black text-sm shadow-md shrink-0">
              {operator.avatar ? (
                <img 
                  src={operator.avatar} 
                  alt={operator.name} 
                  className="w-full h-full object-cover rounded-2xl"
                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                />
              ) : (
                <User size={20} />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">{operator.name}</h3>
                {data && (
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 flex items-center gap-1">
                    <span>Ранг #{data.rank} из {data.totalOperators}</span>
                    <span className="opacity-75 font-semibold text-slate-300">
                      ({getSortByLabel(data.sortBy || currentSortBy)})
                    </span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Недельный анализ (неделя к неделе){currentShiftLabel ? ` • Смена: ${currentShiftLabel}` : ''} • ID: {operator.user_id}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 custom-scrollbar">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3">
              <RefreshCw size={36} className="text-violet-400 animate-spin" />
              <p className="text-sm font-bold text-slate-300">Загрузка детальных метрик и сравнения недель...</p>
              <p className="text-xs text-slate-500 font-mono">Агрегация типов сообщений из OnlyMonster API</p>
            </div>
          ) : error ? (
            <div className="p-6 bg-rose-950/30 border border-rose-500/30 rounded-2xl text-center space-y-2">
              <p className="text-sm font-bold text-rose-300">Ошибка получения детального анализа</p>
              <p className="text-xs text-slate-400">{error}</p>
            </div>
          ) : data ? (
            <>
              {/* TOP 2-COLUMN GRID: BLOCK 1 (RADAR) & BLOCK 3 (NARRATIVE) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* BLOCK 1: RADAR CHART (5 cols) */}
                <div className="lg:col-span-6 p-4 rounded-2xl bg-slate-900/70 border border-white/10 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Activity size={16} className="text-violet-400" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-200">
                        Блок 1: Радар Недели к Неделе
                      </h4>
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold">6 осей баланса</span>
                  </div>

                  {renderRadarChart()}

                  <div className="mt-3 text-[10px] text-slate-400 text-center border-t border-white/5 pt-2">
                    Сравнение одинаковых временных интервалов (пн–текущий момент)
                  </div>
                </div>

                {/* BLOCK 3: AUTO-NARRATIVE (7 cols) */}
                <div className="lg:col-span-6 p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-850 border border-violet-500/20 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Sparkles size={16} className="text-amber-400" />
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-200">
                          Блок 3: Авто-рассказ смены
                        </h4>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold">
                        Трендовый вывод
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {narrativeSentences.map((sentence, sIdx) => (
                        <div 
                          key={sIdx}
                          className="p-3 rounded-xl bg-slate-800/60 border border-white/5 text-xs text-slate-200 leading-relaxed font-mono"
                        >
                          {sentence}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Team context footer */}
                  <div className="mt-4 pt-3 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="p-2 bg-slate-800/40 rounded-xl">
                      <span className="text-[8px] uppercase text-slate-400 block font-bold">Команда: Смс</span>
                      <span className={`text-xs font-black ${data.teamTrend.messages >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {data.teamTrend.messages >= 0 ? `+${data.teamTrend.messages}%` : `${data.teamTrend.messages}%`}
                      </span>
                    </div>
                    <div className="p-2 bg-slate-800/40 rounded-xl">
                      <span className="text-[8px] uppercase text-slate-400 block font-bold">Команда: Доход</span>
                      <span className={`text-xs font-black ${data.teamTrend.earnings >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {data.teamTrend.earnings >= 0 ? `+${data.teamTrend.earnings}%` : `${data.teamTrend.earnings}%`}
                      </span>
                    </div>
                    <div className="p-2 bg-slate-800/40 rounded-xl">
                      <span className="text-[8px] uppercase text-slate-400 block font-bold">Команда: Конв.</span>
                      <span className={`text-xs font-black ${data.teamTrend.conversion >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {data.teamTrend.conversion >= 0 ? `+${data.teamTrend.conversion}%` : `${data.teamTrend.conversion}%`}
                      </span>
                    </div>
                    <div className="p-2 bg-slate-800/40 rounded-xl">
                      <span className="text-[8px] uppercase text-slate-400 block font-bold">Команда: Время</span>
                      <span className={`text-xs font-black ${data.teamTrend.reply_time <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {data.teamTrend.reply_time <= 0 ? `${data.teamTrend.reply_time}%` : `+${data.teamTrend.reply_time}%`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* BLOCK 2: MESSAGE TYPE BREAKDOWN */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-white/10 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Layers size={16} className="text-cyan-400" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-200">
                      Блок 2: Разбивка типов сообщений
                    </h4>
                  </div>
                  <span className="text-xs font-bold text-slate-400">
                    Всего сообщений: <strong className="text-white font-mono">{data.current.messages_count.toLocaleString()}</strong>
                  </span>
                </div>

                {/* 100% Stacked Distribution Bar */}
                {(() => {
                  const b = data.current.messageTypeBreakdown;
                  const categories = [
                    { key: 'typed', label: 'Ручные', pct: b.typed.percent, color: 'bg-emerald-500' },
                    { key: 'ai', label: 'ИИ', pct: b.ai.percent, color: 'bg-violet-500' },
                    { key: 'copied', label: 'Копипаст', pct: b.copied.percent, color: 'bg-amber-500' },
                    { key: 'template', label: 'OF-темплейты', pct: b.template.percent, color: 'bg-blue-500' },
                    { key: 'internal_templates', label: 'Внутр. темплейты', pct: b.internal_templates.percent, color: 'bg-cyan-500' },
                    { key: 'free_media', label: 'Фри-контент', pct: b.free_media.percent, color: 'bg-pink-500' },
                    { key: 'paid', label: 'Платные (PPV)', pct: b.paid.percent, color: 'bg-rose-500' }
                  ].filter(c => c.pct > 0);

                  return (
                    <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden flex shadow-inner">
                      {categories.map(c => (
                        <div
                          key={c.key}
                          style={{ width: `${c.pct}%` }}
                          className={`${c.color} h-full transition-all duration-500 hover:brightness-125`}
                          title={`${c.label}: ${c.pct}%`}
                        />
                      ))}
                    </div>
                  );
                })()}

                {/* 7 Categories Grid */}
                {(() => {
                  const b = data.current.messageTypeBreakdown;
                  const ch = data.changes.messageTypes;

                  const items = [
                    {
                      key: 'typed',
                      name: 'Ручные (вручную напечатанные)',
                      icon: MessageSquare,
                      colorText: 'text-emerald-400',
                      barColor: 'bg-emerald-500',
                      count: b.typed.count,
                      percent: b.typed.percent,
                      change: ch.typed
                    },
                    {
                      key: 'ai',
                      name: 'ИИ-сгенерированные',
                      icon: Bot,
                      colorText: 'text-violet-400',
                      barColor: 'bg-violet-500',
                      count: b.ai.count,
                      percent: b.ai.percent,
                      change: ch.ai
                    },
                    {
                      key: 'copied',
                      name: 'Скопированные (копипаст)',
                      icon: Copy,
                      colorText: 'text-amber-400',
                      barColor: 'bg-amber-500',
                      count: b.copied.count,
                      percent: b.copied.percent,
                      change: ch.copied
                    },
                    {
                      key: 'template',
                      name: 'OF-темплейты (заготовки)',
                      icon: FileText,
                      colorText: 'text-blue-400',
                      barColor: 'bg-blue-500',
                      count: b.template.count,
                      percent: b.template.percent,
                      change: ch.template
                    },
                    {
                      key: 'internal_templates',
                      name: 'Внутренние шаблоны',
                      icon: FileCode,
                      colorText: 'text-cyan-400',
                      barColor: 'bg-cyan-500',
                      count: b.internal_templates.count,
                      percent: b.internal_templates.percent,
                      change: ch.internal_templates
                    },
                    {
                      key: 'free_media',
                      name: 'Бесплатный медиа-контент',
                      icon: Image,
                      colorText: 'text-pink-400',
                      barColor: 'bg-pink-500',
                      count: b.free_media.count,
                      percent: b.free_media.percent,
                      change: ch.free_media
                    },
                    {
                      key: 'paid',
                      name: 'Платные PPV-сообщения',
                      icon: Lock,
                      colorText: 'text-rose-400',
                      barColor: 'bg-rose-500',
                      count: b.paid.count,
                      percent: b.paid.percent,
                      change: ch.paid
                    }
                  ];

                  // Find dominant
                  const sorted = [...items].sort((a, b) => b.percent - a.percent);
                  const dominant = sorted[0];

                  return (
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {items.map(it => {
                          const IconComp = it.icon;
                          return (
                            <div 
                              key={it.key}
                              className="p-2.5 rounded-xl bg-slate-800/60 border border-white/5 flex flex-col justify-between space-y-1.5"
                            >
                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                  <IconComp size={14} className={it.colorText} />
                                  <span className="font-bold text-slate-200">{it.name}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {renderChangeBadge(it.change)}
                                  <span className="font-black text-white font-mono">{it.count}</span>
                                  <span className={`text-[11px] font-bold ${it.colorText}`}>({it.percent}%)</span>
                                </div>
                              </div>
                              <div className="w-full bg-slate-700/50 h-1.5 rounded-full overflow-hidden">
                                <div 
                                  className={`${it.barColor} h-full rounded-full transition-all duration-500`}
                                  style={{ width: `${Math.min(100, it.percent)}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Summary conclusion */}
                      <div className="p-3 bg-violet-950/20 border border-violet-500/20 rounded-xl space-y-1 text-xs">
                        <div className="flex items-center gap-2 font-bold text-violet-300">
                          <Sparkles size={14} className="text-violet-400 shrink-0" />
                          <span>
                            {dominant.percent >= 50 ? (
                              <>Доминирующий стиль: <strong className="text-white">{dominant.name}</strong> составляет <span className="text-amber-400 font-black">{dominant.percent}%</span> всего объёма.</>
                            ) : (
                              <>Сбалансированный стиль: наибольшая доля у «{dominant.name}» ({dominant.percent}%).</>
                            )}
                          </span>
                        </div>
                        {b.ai.percent >= 20 && (
                          <div className="flex items-center gap-1.5 text-indigo-300 pl-5 text-[11px]">
                            <Zap size={12} className="text-indigo-400" />
                            <span>Оператор активно применяет ИИ-ассистента ({b.ai.percent}% генераций).</span>
                          </div>
                        )}
                        <div className="text-[10px] text-slate-500 italic pl-5 pt-0.5">
                          ℹ️ Авто/Приоритетные сообщения: недоступно по агрегату API (доступно только на уровне отдельных чатов).
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* BLOCK 4: GAMER / TRADING CARD */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award size={16} className="text-amber-400" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-200">
                      Блок 4: Игровая Карточка
                    </h4>
                  </div>
                  <button
                    onClick={handleDownloadCard}
                    disabled={isExporting}
                    className="py-1 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-mono text-xs font-bold transition-all flex items-center gap-1.5 shadow-md hover:shadow-violet-600/30 disabled:opacity-50"
                  >
                    <Download size={13} />
                    <span>{isExporting ? 'Сохранение...' : 'Скачать как картинку'}</span>
                  </button>
                </div>

                {/* THE VISUAL TRADING CARD (for export) */}
                <div 
                  ref={cardRef}
                  id="operator-trading-card"
                  className="p-6 rounded-3xl bg-gradient-to-br from-[#12162a] via-[#0d1222] to-[#181330] border-2 border-violet-500/40 shadow-2xl relative overflow-hidden font-mono max-w-lg mx-auto"
                >
                  {/* Decorative glow circles */}
                  <div className="absolute top-0 right-0 w-36 h-36 bg-violet-600/20 rounded-full blur-2xl pointer-events-none"></div>
                  <div className="absolute bottom-0 left-0 w-36 h-36 bg-cyan-600/20 rounded-full blur-2xl pointer-events-none"></div>

                  {/* Card Header: Avatar & Rank */}
                  <div className="relative flex flex-col items-center text-center space-y-2">
                    <div className="relative">
                      <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-400 p-1 shadow-xl">
                        <div className="w-full h-full rounded-xl bg-slate-900 overflow-hidden flex items-center justify-center">
                          {operator.avatar ? (
                            <img 
                              src={operator.avatar} 
                              alt={operator.name}
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                            />
                          ) : (
                            <User size={36} className="text-slate-400" />
                          )}
                        </div>
                      </div>
                      <div className="absolute -bottom-2 -right-2 px-2 py-0.5 rounded-lg bg-amber-500 text-slate-950 font-black text-xs shadow-md border border-amber-300">
                        #{data.rank}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-black text-white tracking-tight">{operator.name}</h3>
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                        Continental Operator • ID {operator.user_id}
                      </p>
                    </div>

                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/20 border border-violet-400/40 text-violet-300 text-xs font-black">
                      <Crown size={12} className="text-amber-400" />
                      <span>
                        РАНГ #{data.rank} ИЗ {data.totalOperators}{' '}
                        <span className="text-[10px] font-bold text-violet-200/80 uppercase">
                          ({getSortByLabel(data.sortBy || currentSortBy)})
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* 4 Key Stats Grid */}
                  <div className="grid grid-cols-2 gap-3 my-5">
                    <div className="p-3 rounded-2xl bg-slate-900/80 border border-white/10 text-center">
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block">Сообщения</span>
                      <span className="text-xl font-black text-white block mt-0.5">
                        {data.current.messages_count.toLocaleString()}
                      </span>
                      <div className="mt-1 flex items-center justify-center">
                        {renderChangeBadge(data.changes.messages_count)}
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-900/80 border border-white/10 text-center">
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block">Доход (NET)</span>
                      <span className="text-xl font-black text-emerald-400 block mt-0.5">
                        ${data.current.earnings.toLocaleString()}
                      </span>
                      <div className="mt-1 flex items-center justify-center">
                        {renderChangeBadge(data.changes.earnings)}
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-900/80 border border-white/10 text-center">
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block">PPV Конверсия</span>
                      <span className="text-xl font-black text-violet-300 block mt-0.5">
                        {data.current.conversion}%
                      </span>
                      <div className="mt-1 flex items-center justify-center">
                        {renderChangeBadge(data.changes.conversion)}
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-900/80 border border-white/10 text-center">
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block">Ср. Скорость</span>
                      <span className="text-xl font-black text-cyan-300 block mt-0.5">
                        {formatDuration(data.current.reply_time_avg)}
                      </span>
                      <div className="mt-1 flex items-center justify-center">
                        {renderChangeBadge(data.changes.reply_time_avg, true)}
                      </div>
                    </div>
                  </div>

                  {/* Badges Row */}
                  <div className="flex items-center justify-center gap-2 flex-wrap pt-2 border-t border-white/10">
                    {data.current.messages_count >= 200 && (
                      <span className="px-2.5 py-1 rounded-xl bg-orange-950/40 border border-orange-500/40 text-orange-300 text-[10px] font-black flex items-center gap-1">
                        <Flame size={12} className="text-orange-400" /> Огневой темп
                      </span>
                    )}
                    {data.current.reply_time_avg && data.current.reply_time_avg <= 120 && (
                      <span className="px-2.5 py-1 rounded-xl bg-cyan-950/40 border border-cyan-500/40 text-cyan-300 text-[10px] font-black flex items-center gap-1">
                        <Zap size={12} className="text-cyan-400" /> Сверхбыстрый ответ
                      </span>
                    )}
                    {data.current.conversion >= 25 && (
                      <span className="px-2.5 py-1 rounded-xl bg-violet-950/40 border border-violet-500/40 text-violet-300 text-[10px] font-black flex items-center gap-1">
                        <Sparkles size={12} className="text-violet-400" /> Топ конвертер
                      </span>
                    )}
                    {data.rank === 1 && (
                      <span className="px-2.5 py-1 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-300 text-[10px] font-black flex items-center gap-1">
                        <Crown size={12} className="text-amber-400" /> Лидер недели
                      </span>
                    )}
                    {data.current.messageTypeBreakdown.typed.percent >= 30 && data.current.messageTypeBreakdown.ai.percent >= 15 && (
                      <span className="px-2.5 py-1 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-[10px] font-black flex items-center gap-1">
                        <ShieldCheck size={12} className="text-emerald-400" /> Мастер баланса
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
export default OperatorDeepStatsModal;
