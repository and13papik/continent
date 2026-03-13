
import React, { useMemo, useState } from 'react';
import { AppState, IncomeRecord } from '../types';
import { ICONS } from '../constants';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, LineChart, Line, Legend, AreaChart, Area 
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

interface MetricsProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4'];

const Metrics: React.FC<MetricsProps> = ({ state }) => {
  const incomeData = state.incomeData || [];
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  const metrics = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    // Date helpers
    const getDaysAgo = (days: number) => {
      const d = new Date(now);
      d.setDate(d.getDate() - days);
      d.setHours(0, 0, 0, 0);
      return d;
    };

    const startOfWeek = getDaysAgo(now.getDay() === 0 ? 6 : now.getDay() - 1);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const rolling7DaysStart = getDaysAgo(7);
    const baselineStart = getDaysAgo(30);

    // Monthly Plan Helpers
    const activePeriodId = state.selectedPeriodId;

    // Data structures
    const modelData: Record<string, {
      total: number;
      weekly: number;
      monthly: number;
      daily: Record<string, number>;
      bestDay: { date: string; value: number };
      worstDay: { date: string; value: number };
      streaks: number;
      currentStreak: number;
      operators: Record<string, number>;
    }> = {};

    const operatorData: Record<string, {
      total: number;
      week: number;
      month: number;
      rolling7: number;
      peakDay: number;
    }> = {};

    const agencyDaily: Record<string, number> = {};

    // Process all income records
    incomeData.forEach(record => {
      const recordDate = new Date(record.date);
      const amount = record.total || 0;
      const dateStr = record.date;

      // Agency Daily
      agencyDaily[dateStr] = (agencyDaily[dateStr] || 0) + amount;

      // Model Data
      if (!modelData[record.model]) {
        modelData[record.model] = {
          total: 0, weekly: 0, monthly: 0, daily: {},
          bestDay: { date: '', value: -Infinity },
          worstDay: { date: '', value: Infinity },
          streaks: 0, currentStreak: 0,
          operators: {}
        };
      }
      const m = modelData[record.model];
      m.total += amount;
      m.daily[dateStr] = (m.daily[dateStr] || 0) + amount;
      m.operators[record.operator] = (m.operators[record.operator] || 0) + amount;
      if (recordDate >= startOfWeek) m.weekly += amount;
      if (recordDate >= startOfMonth) m.monthly += amount;

      // Operator Data
      if (!operatorData[record.operator]) {
        operatorData[record.operator] = { total: 0, week: 0, month: 0, rolling7: 0, peakDay: 0 };
      }
      const o = operatorData[record.operator];
      o.total += amount;
      if (recordDate >= startOfWeek) o.week += amount;
      if (recordDate >= startOfMonth) o.month += amount;
      if (recordDate >= rolling7DaysStart) o.rolling7 += amount;
      if (amount > o.peakDay) o.peakDay = amount;
    });

    // Post-process Model Data (Best/Worst/Streaks/Health)
    const modelMetrics = Object.entries(modelData).map(([name, data]) => {
      const dailyEntries = Object.entries(data.daily).sort((a, b) => a[0].localeCompare(b[0]));
      
      // Best/Worst
      dailyEntries.forEach(([date, val]) => {
        if (val > data.bestDay.value) data.bestDay = { date, value: val };
        if (val < data.worstDay.value) data.worstDay = { date, value: val };
      });

      // Streaks (> $1000)
      let currentStreak = 0;
      let maxStreak = 0;
      // Sort all dates to check streaks properly
      const allDates = dailyEntries.map(e => e[0]);
      allDates.forEach(date => {
        if (data.daily[date] >= 1000) {
          currentStreak++;
          maxStreak = Math.max(maxStreak, currentStreak);
        } else {
          currentStreak = 0;
        }
      });

      // Rolling 7 days avg
      const last7Days = [];
      for(let i=0; i<7; i++) {
        const d = getDaysAgo(i).toISOString().split('T')[0];
        last7Days.push(data.daily[d] || 0);
      }
      const current7DayAvg = last7Days.reduce((a, b) => a + b, 0) / 7;

      // Max 7 day avg for health score
      let max7DayAvg = current7DayAvg;
      if (dailyEntries.length >= 7) {
        for (let i = 0; i <= dailyEntries.length - 7; i++) {
          const window = dailyEntries.slice(i, i + 7);
          const avg = window.reduce((sum, e) => sum + e[1], 0) / 7;
          if (avg > max7DayAvg) max7DayAvg = avg;
        }
      }

      const healthScore = max7DayAvg > 0 ? (current7DayAvg / max7DayAvg) * 100 : 0;

      // Baseline (last 30 days)
      const last30Days = [];
      for(let i=0; i<30; i++) {
        const d = getDaysAgo(i).toISOString().split('T')[0];
        last30Days.push(data.daily[d] || 0);
      }
      const baselineAvg = last30Days.reduce((a, b) => a + b, 0) / 30;
      
      // Day-over-day change
      const yesterday = getDaysAgo(1).toISOString().split('T')[0];
      const dayBefore = getDaysAgo(2).toISOString().split('T')[0];
      const yesterdayVal = data.daily[yesterday] || 0;
      const dayBeforeVal = data.daily[dayBefore] || 0;
      const dodChange = dayBeforeVal > 0 ? ((yesterdayVal - dayBeforeVal) / dayBeforeVal) * 100 : 0;

      // Progress bar (Monthly)
      const goal = state.modelMonthlyPlans?.[name] || 0;
      const progress = goal > 0 ? (data.monthly / goal) * 100 : 0;

      // Low Performance Flag (last 5 days below 70% of baseline)
      const last5Days = [];
      for(let i=0; i<5; i++) {
        const dStr = getDaysAgo(i).toISOString().split('T')[0];
        last5Days.push(data.daily[dStr] || 0);
      }
      const isUnderperforming = last5Days.every(v => v < baselineAvg * 0.7) && baselineAvg > 0;

      // Best Day of Week
      const dowTotals: Record<number, number> = {};
      const dowCounts: Record<number, number> = {};
      dailyEntries.forEach(([date, val]) => {
        const d = new Date(date).getDay();
        dowTotals[d] = (dowTotals[d] || 0) + val;
        dowCounts[d] = (dowCounts[d] || 0) + 1;
      });
      let bestDow = -1;
      let maxDowAvg = -1;
      Object.entries(dowTotals).forEach(([dow, total]) => {
        const avg = total / dowCounts[Number(dow)];
        if (avg > maxDowAvg) {
          maxDowAvg = avg;
          bestDow = Number(dow);
        }
      });
      const dowNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

      return {
        name,
        ...data,
        current7DayAvg,
        max7DayAvg,
        healthScore,
        baselineAvg,
        dodChange,
        maxStreak,
        goal,
        progress,
        isUnderperforming,
        bestDowName: bestDow !== -1 ? dowNames[bestDow] : 'N/A',
        isAtRisk: healthScore < 60 || (dodChange < -20 && yesterdayVal < baselineAvg * 0.8) || isUnderperforming
      };
    });

    // Agency Stats
    const agencyDailyChart = Object.entries(agencyDaily)
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);

    const agencyAvgDaily = Object.values(agencyDaily).reduce((a, b) => a + b, 0) / Object.keys(agencyDaily).length;

    // Top Operators
    const topOperators = Object.entries(operatorData)
      .map(([name, data]) => ({ name, ...data, rolling7Avg: data.rolling7 / 7 }))
      .sort((a, b) => b.rolling7 - a.rolling7);

    return {
      modelMetrics,
      agencyDailyChart,
      agencyAvgDaily,
      topOperators,
      totalRevenue: Object.values(agencyDaily).reduce((a, b) => a + b, 0)
    };
  }, [incomeData, state.modelMonthlyPlans, state.selectedPeriodId]);

  const selectedModelData = useMemo(() => {
    if (!selectedModel) return null;
    return metrics.modelMetrics.find(m => m.name === selectedModel);
  }, [selectedModel, metrics.modelMetrics]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-20"
    >
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-outfit text-white">Метрика & Аналитика</h1>
          <p className="text-slate-400">Продвинутый анализ эффективности агентства</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] uppercase text-slate-500 font-black tracking-widest">Общий доход</p>
            <p className="text-2xl font-black text-white">${metrics.totalRevenue.toLocaleString()}</p>
          </div>
          <div className="w-px h-10 bg-slate-800" />
          <div className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
            <ICONS.Reports className="text-indigo-400" size={20} />
            <span className="text-indigo-400 font-bold text-sm">Live</span>
          </div>
        </div>
      </header>

      {/* AGENCY TREND */}
      <div className="glass-card p-6 rounded-3xl border-slate-800 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-3">
            <ICONS.Dashboard className="text-indigo-500" size={24} />
            Общая динамика агентства (30 дней)
          </h2>
          <div className="flex gap-4">
            <div className="text-right">
              <p className="text-[10px] uppercase text-slate-500 font-black tracking-widest">Средний чек/день</p>
              <p className="text-lg font-bold text-white">${metrics.agencyAvgDaily.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
          </div>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={metrics.agencyDailyChart}>
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis 
                dataKey="date" 
                stroke="#64748b" 
                fontSize={10} 
                tickFormatter={(str) => new Date(str).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
              />
              <YAxis stroke="#64748b" fontSize={10} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                itemStyle={{ color: '#f8fafc' }}
              />
              <Area type="monotone" dataKey="value" stroke="#6366f1" fillOpacity={1} fill="url(#colorRev)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* DAILY REVENUE LIST */}
        <div className="mt-8">
          <h3 className="text-sm font-black uppercase text-slate-500 tracking-widest mb-4">Детализация по дням</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
            {[...metrics.agencyDailyChart].reverse().map(day => (
              <div key={day.date} className="p-3 bg-slate-900/40 rounded-xl border border-slate-800/50 flex flex-col items-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase">
                  {new Date(day.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                </span>
                <span className="text-sm font-black text-white">${day.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MODEL PROGRESS & HEALTH (MOVED FROM DASHBOARD) */}
      <div className="glass-card p-6 rounded-3xl border-slate-800 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-3">
            <ICONS.Models className="text-indigo-500" size={24} />
            Прогресс моделей и Флаги здоровья
          </h2>
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
            Месячный план vs Реальность
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {metrics.modelMetrics.filter(m => m.goal > 0 || m.monthly > 0).map(model => (
            <div key={model.name} className={`p-4 rounded-2xl border transition-all ${
              model.isUnderperforming ? 'bg-rose-500/5 border-rose-500/30' : 'bg-slate-900/40 border-slate-800'
            }`}>
              <div className="flex justify-between items-start mb-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-white truncate">{model.name}</h3>
                  <p className="text-[10px] font-bold text-slate-500">
                    ${model.monthly.toLocaleString()} / ${model.goal.toLocaleString()}
                  </p>
                </div>
                {model.isUnderperforming && (
                  <div className="px-2 py-0.5 rounded bg-rose-500 text-white text-[8px] font-black uppercase tracking-tighter animate-pulse">
                    Low Performance
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-[9px] font-black uppercase tracking-widest">
                  <span className="text-slate-500">Прогресс</span>
                  <span className={model.progress >= 100 ? 'text-emerald-400' : 'text-indigo-400'}>
                    {model.progress.toFixed(1)}%
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(model.progress, 100)}%` }}
                    className={`h-full rounded-full ${
                      model.progress >= 100 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 
                      model.isUnderperforming ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]' :
                      'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]'
                    }`}
                  />
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-800/50 flex justify-between items-center">
                <span className="text-[9px] font-bold text-slate-500 uppercase">Лучший день:</span>
                <span className="text-[9px] font-black text-indigo-400 uppercase">{model.bestDowName}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* TOP OPERATORS TABLE */}
        <div className="lg:col-span-2 glass-card p-6 rounded-3xl border-slate-800 space-y-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-3">
            <ICONS.Internship className="text-emerald-500" size={24} />
            Топ операторов (Rolling 7 Days)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="py-4 text-[10px] uppercase text-slate-500 font-black tracking-widest">Оператор</th>
                  <th className="py-4 text-[10px] uppercase text-slate-500 font-black tracking-widest">7дн Сумма</th>
                  <th className="py-4 text-[10px] uppercase text-slate-500 font-black tracking-widest">7дн Среднее</th>
                  <th className="py-4 text-[10px] uppercase text-slate-500 font-black tracking-widest">Пик (День)</th>
                  <th className="py-4 text-[10px] uppercase text-slate-500 font-black tracking-widest">Месяц</th>
                </tr>
              </thead>
              <tbody>
                {metrics.topOperators.slice(0, 10).map((op, idx) => (
                  <tr key={op.name} className="border-b border-slate-800/50 hover:bg-white/5 transition-colors group">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-slate-600">{idx + 1}</span>
                        <span className="font-bold text-white">{op.name}</span>
                      </div>
                    </td>
                    <td className="py-4 font-mono text-emerald-400 font-bold">${op.rolling7.toLocaleString()}</td>
                    <td className="py-4 font-mono text-slate-300">${op.rolling7Avg.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    <td className="py-4 font-mono text-amber-400 font-bold">${op.peakDay.toLocaleString()}</td>
                    <td className="py-4 font-mono text-slate-400">${op.month.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* MODEL HEALTH SCORES */}
        <div className="glass-card p-6 rounded-3xl border-slate-800 space-y-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-3">
            <ICONS.Models className="text-pink-500" size={24} />
            Здоровье анкет
          </h2>
          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {metrics.modelMetrics.sort((a, b) => a.healthScore - b.healthScore).map(model => (
              <div 
                key={model.name} 
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  selectedModel === model.name ? 'bg-indigo-500/20 border-indigo-500' : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                }`}
                onClick={() => setSelectedModel(model.name === selectedModel ? null : model.name)}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-white">{model.name}</h3>
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Health Score</p>
                  </div>
                  <div className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                    model.healthScore > 80 ? 'bg-emerald-500/20 text-emerald-400' :
                    model.healthScore > 60 ? 'bg-amber-500/20 text-amber-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {model.healthScore.toFixed(0)}%
                  </div>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${model.healthScore}%` }}
                    className={`h-full ${
                      model.healthScore > 80 ? 'bg-emerald-500' :
                      model.healthScore > 60 ? 'bg-amber-500' :
                      'bg-red-500'
                    }`}
                  />
                </div>
                {model.isAtRisk && (
                  <div className="mt-2 flex items-center gap-1 text-[10px] text-red-400 font-bold uppercase">
                    <ICONS.Delete size={12} /> В зоне риска
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MODEL DETAIL VIEW */}
      <AnimatePresence>
        {selectedModelData && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass-card p-8 rounded-3xl border-indigo-500/30 bg-indigo-500/5 space-y-8">
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-3xl font-black text-white">{selectedModelData.name}</h2>
                  <p className="text-slate-400 italic">Детальная аналитика модели</p>
                </div>
                <button 
                  onClick={() => setSelectedModel(null)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <ICONS.Delete size={24} className="text-slate-500" />
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <StatBox label="Среднее (30дн)" value={`$${selectedModelData.baselineAvg.toFixed(0)}`} color="indigo" />
                <StatBox 
                  label="Изменение (24ч)" 
                  value={`${selectedModelData.dodChange > 0 ? '+' : ''}${selectedModelData.dodChange.toFixed(1)}%`} 
                  color={selectedModelData.dodChange >= 0 ? 'emerald' : 'red'} 
                />
                <StatBox label="Лучший день" value={`$${selectedModelData.bestDay.value.toLocaleString()}`} color="amber" />
                <StatBox label="Стрик (>1k)" value={`${selectedModelData.maxStreak} дн`} color="pink" />
                <StatBox label="Лучший день недели" value={selectedModelData.bestDowName} color="indigo" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-sm font-black uppercase text-slate-500 tracking-widest">Тренд дохода (30 дней)</h3>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={Object.entries(selectedModelData.daily).map(([date, value]) => ({ date, value })).sort((a,b) => a.date.localeCompare(b.date)).slice(-30)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="date" hide />
                        <YAxis stroke="#64748b" fontSize={10} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }} />
                        <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-sm font-black uppercase text-slate-500 tracking-widest">Стабильность и Риски</h3>
                  <div className="space-y-4">
                    <RiskItem 
                      label="Baseline Performance" 
                      status={selectedModelData.current7DayAvg >= selectedModelData.baselineAvg * 0.9 ? 'good' : 'bad'}
                      desc={`Текущее среднее ($${selectedModelData.current7DayAvg.toFixed(0)}) vs Baseline ($${selectedModelData.baselineAvg.toFixed(0)})`}
                    />
                    <RiskItem 
                      label="Volatility Check" 
                      status={selectedModelData.bestDay.value / selectedModelData.baselineAvg < 5 ? 'good' : 'warning'}
                      desc="Соотношение пика к среднему значению"
                    />
                    <RiskItem 
                      label="Account Health" 
                      status={selectedModelData.healthScore > 70 ? 'good' : selectedModelData.healthScore > 50 ? 'warning' : 'bad'}
                      desc={`Оценка жизнеспособности аккаунта: ${selectedModelData.healthScore.toFixed(1)}%`}
                    />
                  </div>
                </div>
              </div>

              {/* OPERATOR BREAKDOWN FOR MODEL */}
              <div className="space-y-4">
                <h3 className="text-sm font-black uppercase text-slate-500 tracking-widest">Выручка по операторам (Все время)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {Object.entries(selectedModelData.operators).sort((a,b) => b[1] - a[1]).map(([opName, opTotal]) => (
                    <div key={opName} className="p-4 bg-slate-900/40 rounded-2xl border border-slate-800/50 flex justify-between items-center">
                      <span className="text-sm font-bold text-slate-200">{opName}</span>
                      <span className="text-sm font-mono font-bold text-emerald-400">${opTotal.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    indigo: 'text-indigo-400',
    emerald: 'text-emerald-400',
    red: 'text-red-400',
    amber: 'text-amber-400',
    pink: 'text-pink-400'
  };
  return (
    <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-800">
      <p className="text-[10px] uppercase text-slate-500 font-black tracking-widest mb-1">{label}</p>
      <p className={`text-xl font-black ${colors[color] || 'text-white'}`}>{value}</p>
    </div>
  );
}

function RiskItem({ label, status, desc }: { label: string; status: 'good' | 'warning' | 'bad'; desc: string }) {
  const icons = {
    good: <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />,
    warning: <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />,
    bad: <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
  };
  return (
    <div className="flex items-start gap-4 p-4 bg-slate-900/30 rounded-2xl border border-slate-800/50">
      <div className="mt-1.5">{icons[status]}</div>
      <div>
        <p className="text-xs font-bold text-white">{label}</p>
        <p className="text-[10px] text-slate-500">{desc}</p>
      </div>
    </div>
  );
}

function TopCard({ title, data, icon, color }: { title: string; data: { name: string; value: number }[]; icon: React.ReactNode; color: 'indigo' | 'emerald' | 'sky' }) {
  const colorClasses = {
    indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    sky: 'text-sky-400 bg-sky-500/10 border-sky-500/20'
  };

  return (
    <div className="glass-card p-6 rounded-3xl border-slate-800 space-y-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorClasses[color]}`}>
          {icon}
        </div>
        <h3 className="font-bold text-white">{title}</h3>
      </div>
      
      <div className="space-y-3">
        {data.length > 0 ? data.map((item, idx) => (
          <div key={item.name} className="flex items-center justify-between p-3 bg-slate-900/40 rounded-2xl border border-slate-800/50">
            <div className="flex items-center gap-3">
              <span className="text-xs font-black text-slate-600 w-4">{idx + 1}.</span>
              <span className="text-sm font-bold text-slate-200">{item.name}</span>
            </div>
            <span className="text-sm font-mono font-bold text-white">${item.value.toLocaleString()}</span>
          </div>
        )) : (
          <div className="py-8 text-center text-slate-600 text-xs italic">Нет данных за этот период</div>
        )}
      </div>
    </div>
  );
}

export default Metrics;
