
import React, { useMemo, useState } from 'react';
import { AppState, IncomeRecord } from '../types';
import { ICONS } from '../constants';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, LineChart, Line, Legend, AreaChart, Area 
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';

interface MetricsProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4'];

const Metrics: React.FC<MetricsProps> = ({ state }) => {
  const incomeData = state.incomeData || [];
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  const metrics = useMemo(() => {
    const activePeriodId = state.selectedPeriodId;
    const currentPeriod = state.accountingPeriods.find(p => p.id === activePeriodId);
    
    // Find previous period for comparison
    const sortedPeriods = [...state.accountingPeriods].sort((a, b) => 
      new Date(b.startAt).getTime() - new Date(a.startAt).getTime()
    );
    const currentIndex = sortedPeriods.findIndex(p => p.id === activePeriodId);
    const prevPeriod = currentIndex !== -1 && currentIndex < sortedPeriods.length - 1 
      ? sortedPeriods[currentIndex + 1] 
      : null;

    // Filter data for current and previous periods
    const currentRecords = incomeData.filter(r => r.periodId === activePeriodId);
    const prevRecords = prevPeriod ? incomeData.filter(r => r.periodId === prevPeriod.id) : [];

    const prevTotal = prevRecords.reduce((sum, r) => sum + (r.total || 0), 0);
    const currentTotal = currentRecords.reduce((sum, r) => sum + (r.total || 0), 0);
    const growth = prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : 0;

    // Daily stats for current period - include all days from start to end (or today)
    const dailyRevenue: Record<string, number> = {};
    currentRecords.forEach(r => {
      dailyRevenue[r.date] = (dailyRevenue[r.date] || 0) + r.total;
    });

    const dailyEntries: { date: string; value: number }[] = [];
    if (currentPeriod) {
      const start = new Date(currentPeriod.startAt);
      const end = currentPeriod.endAt ? new Date(currentPeriod.endAt) : new Date();
      const current = new Date(start);
      
      while (current <= end) {
        const dateStr = current.toISOString().split('T')[0];
        dailyEntries.push({
          date: dateStr,
          value: dailyRevenue[dateStr] || 0
        });
        current.setDate(current.getDate() + 1);
      }
    } else {
      // Fallback if no period found
      Object.entries(dailyRevenue).sort((a, b) => a[0].localeCompare(b[0])).forEach(([date, value]) => {
        dailyEntries.push({ date, value });
      });
    }
    
    // Best/Worst Day of Month
    let bestDayOfMonth = { date: 'N/A', value: 0 };
    let worstDayOfMonth = { date: 'N/A', value: Infinity };
    
    dailyEntries.forEach(({ date, value }) => {
      if (value > bestDayOfMonth.value) bestDayOfMonth = { date, value };
      if (value < worstDayOfMonth.value && value > 0) worstDayOfMonth = { date, value };
    });
    if (worstDayOfMonth.value === Infinity) worstDayOfMonth.value = 0;

    // Helper to format date for display
    const formatDate = (dateStr: string) => {
      if (dateStr === 'N/A') return 'N/A';
      const date = new Date(dateStr);
      const dow = dowNames[date.getDay()];
      const formattedDate = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
      return `${dow}, ${formattedDate}`;
    };

    // Best/Worst Day of Week (Totals)
    const dowTotals: Record<number, number> = {};
    const dowNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    
    dailyEntries.forEach(({ date, value }) => {
      const day = new Date(date).getDay();
      dowTotals[day] = (dowTotals[day] || 0) + value;
    });

    let bestDow = { name: 'N/A', value: 0 };
    let worstDow = { name: 'N/A', value: Infinity };

    Object.entries(dowTotals).forEach(([dow, total]) => {
      const name = dowNames[Number(dow)];
      if (total > bestDow.value) bestDow = { name, value: total };
      if (total < worstDow.value && total > 0) worstDow = { name, value: total };
    });
    if (worstDow.value === Infinity) worstDow.value = 0;

    // Forecast Calculation
    const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const daysInMonth = currentPeriod ? (currentPeriod.endAt ? Math.ceil((new Date(currentPeriod.endAt).getTime() - new Date(currentPeriod.startAt).getTime()) / (1000 * 60 * 60 * 24)) : getDaysInMonth(new Date(currentPeriod.startAt))) : 30;
    const daysPassed = dailyEntries.length || 1;
    const runRate = currentTotal / daysPassed;
    const projectedTotal = runRate * Math.max(daysInMonth, daysPassed);

    // Model Specific Metrics
    const modelMetrics = state.models.map(name => {
      const mRecords = currentRecords.filter(r => r.model === name);
      const mTotal = mRecords.reduce((sum, r) => sum + (r.total || 0), 0);
      const mGoal = currentPeriod?.modelMonthlyPlans?.[name] || state.modelMonthlyPlans?.[name] || 0;
      const mProgress = mGoal > 0 ? (mTotal / mGoal) * 100 : 0;
      
      const mDaily: Record<string, number> = {};
      mRecords.forEach(r => { mDaily[r.date] = (mDaily[r.date] || 0) + r.total; });
      
      // Ensure mDaily has all days of the period for the chart
      const mDailyFull: { date: string; value: number }[] = dailyEntries.map(d => ({
        date: d.date,
        value: mDaily[d.date] || 0
      }));

      // Forecast for model
      const mDaysPassed = dailyEntries.length || 1;
      const mRunRate = mTotal / mDaysPassed;
      const mForecast = mRunRate * Math.max(daysInMonth, mDaysPassed);
      
      // Status Logic
      let status: 'good' | 'warning' | 'bad' = 'good';
      if (mGoal > 0) {
        if (mForecast < mGoal * 0.7) status = 'bad';
        else if (mForecast < mGoal) status = 'warning';
      }

      // Best Day for this model
      let mBestDay = { date: 'N/A', value: 0 };
      Object.entries(mDaily).forEach(([d, v]) => {
        if (v > mBestDay.value) mBestDay = { date: d, value: v };
      });

      return {
        name,
        total: mTotal,
        goal: mGoal,
        progress: mProgress,
        forecast: mForecast,
        status,
        bestDay: mBestDay,
        daily: mDailyFull,
        operators: mRecords.reduce((acc, r) => {
          acc[r.operator] = (acc[r.operator] || 0) + r.total;
          return acc;
        }, {} as Record<string, number>)
      };
    }).sort((a, b) => b.total - a.total);

    // Top Operators (Current Month)
    const operatorStats = currentRecords.reduce((acc, r) => {
      if (!acc[r.operator]) acc[r.operator] = { total: 0, count: 0 };
      acc[r.operator].total += r.total;
      acc[r.operator].count += 1;
      return acc;
    }, {} as Record<string, { total: number; count: number }>);

    const topOperatorsMonth = Object.entries(operatorStats)
      .map(([name, stats]) => ({ name, total: stats.total, avg: stats.total / stats.count }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Weekly Stats for Operators
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    
    const startOfCurrentWeek = new Date(now);
    startOfCurrentWeek.setDate(now.getDate() - diffToMonday);
    startOfCurrentWeek.setHours(0, 0, 0, 0);

    const startOfPrevWeek = new Date(startOfCurrentWeek);
    startOfPrevWeek.setDate(startOfCurrentWeek.getDate() - 7);
    
    const endOfPrevWeek = new Date(startOfCurrentWeek);
    endOfPrevWeek.setMilliseconds(-1);

    const currentWeekRecords = incomeData.filter(r => new Date(r.date) >= startOfCurrentWeek);
    const prevWeekRecords = incomeData.filter(r => {
      const d = new Date(r.date);
      return d >= startOfPrevWeek && d <= endOfPrevWeek;
    });

    const opCurrentWeek: Record<string, number> = {};
    const opPrevWeek: Record<string, number> = {};

    currentWeekRecords.forEach(r => { opCurrentWeek[r.operator] = (opCurrentWeek[r.operator] || 0) + r.total; });
    prevWeekRecords.forEach(r => { opPrevWeek[r.operator] = (opPrevWeek[r.operator] || 0) + r.total; });

    const topOperatorsWeek = Object.entries(opCurrentWeek)
      .map(([name, currentTotal]) => {
        const prevTotal = opPrevWeek[name] || 0;
        const growth = prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : currentTotal > 0 ? 100 : 0;
        
        let flag: 'green' | 'yellow' | 'red' = 'yellow';
        if (growth > 5) flag = 'green';
        else if (growth < -5) flag = 'red';

        return { name, currentTotal, prevTotal, growth, flag };
      })
      .sort((a, b) => b.currentTotal - a.currentTotal)
      .slice(0, 5);

    return {
      currentTotal,
      prevTotal,
      growth,
      bestDayOfMonth,
      worstDayOfMonth,
      bestDow,
      worstDow,
      projectedTotal,
      modelMetrics,
      dailyEntries,
      topOperatorsMonth,
      topOperatorsWeek,
      mostProfitableDays: [...dailyEntries].sort((a, b) => b.value - a.value).slice(0, 5),
      formatDate
    };
  }, [incomeData, state.modelMonthlyPlans, state.selectedPeriodId, state.accountingPeriods, state.models]);

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
          <h1 className="text-3xl font-bold font-outfit text-white">Аналитика месяца</h1>
          <p className="text-slate-400">Детальный разбор текущего периода</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-[10px] uppercase text-slate-500 font-black tracking-widest">Доход за месяц</p>
            <div className="flex items-center gap-2 justify-end">
              <p className="text-3xl font-black text-white">${metrics.currentTotal.toLocaleString()}</p>
              {metrics.growth !== 0 && (
                <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${metrics.growth > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                  {metrics.growth > 0 ? '↑' : '↓'} {Math.abs(metrics.growth).toFixed(1)}%
                </span>
              )}
            </div>
          </div>
          <div className="w-px h-12 bg-slate-800" />
          <div className="text-right">
            <p className="text-[10px] uppercase text-slate-500 font-black tracking-widest">Прогноз</p>
            <p className="text-2xl font-black text-indigo-400">${metrics.projectedTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          </div>
        </div>
      </header>

      {/* KEY MONTHLY STATS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatBox label="Лучший день месяца" value={`$${metrics.bestDayOfMonth.value.toLocaleString()}`} subValue={metrics.formatDate(metrics.bestDayOfMonth.date)} color="emerald" />
        <StatBox label="Худший день месяца" value={`$${metrics.worstDayOfMonth.value.toLocaleString()}`} subValue={metrics.formatDate(metrics.worstDayOfMonth.date)} color="red" />
        <StatBox label="Лучший день недели" value={`$${metrics.bestDow.value.toLocaleString()}`} subValue={metrics.bestDow.name} color="indigo" />
        <StatBox label="Худший день недели" value={`$${metrics.worstDow.value.toLocaleString()}`} subValue={metrics.worstDow.name} color="amber" />
      </div>

      {/* AGENCY TREND */}
      <div className="glass-card p-6 rounded-3xl border-slate-800 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-3">
            <ICONS.Dashboard className="text-indigo-500" size={24} />
            Динамика текущего месяца
          </h2>
          <div className="flex gap-4">
            <div className="text-right">
              <p className="text-[10px] uppercase text-slate-500 font-black tracking-widest">Сравнение с прошлым мес.</p>
              <p className="text-lg font-bold text-slate-400">${metrics.prevTotal.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={metrics.dailyEntries}>
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
          <h3 className="text-sm font-black uppercase text-slate-500 tracking-widest mb-4">Детализация по дням месяца</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
            {[...metrics.dailyEntries].reverse().map(day => (
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

      {/* MODEL PROGRESS & HEALTH */}
      <div className="glass-card p-6 rounded-3xl border-slate-800 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-3">
            <ICONS.Models className="text-indigo-500" size={24} />
            Прогресс моделей и Прогноз
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {metrics.modelMetrics.filter(m => m.goal > 0 || m.total > 0).map(model => (
            <div 
              key={model.name} 
              className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                model.status === 'bad' ? 'bg-rose-500/5 border-rose-500/30' : 
                model.status === 'warning' ? 'bg-amber-500/5 border-amber-500/30' : 
                'bg-slate-900/40 border-slate-800 hover:border-slate-700'
              }`}
              onClick={() => setSelectedModel(model.name === selectedModel ? null : model.name)}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="min-w-0">
                  <h3 className="text-lg font-black text-white truncate">{model.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`w-2 h-2 rounded-full ${
                      model.status === 'good' ? 'bg-emerald-500' : 
                      model.status === 'warning' ? 'bg-amber-500' : 'bg-rose-500'
                    }`} />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      {model.status === 'good' ? 'Идет хорошо' : 
                       model.status === 'warning' ? 'На грани' : 'Нужен упор'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-500 uppercase">Прогноз</p>
                  <p className={`text-lg font-black ${
                    model.status === 'good' ? 'text-emerald-400' : 
                    model.status === 'warning' ? 'text-amber-400' : 'text-rose-400'
                  }`}>
                    ${model.forecast.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                  <span className="text-slate-500">Выполнено: ${model.total.toLocaleString()}</span>
                  <span className="text-white">{model.progress.toFixed(1)}%</span>
                </div>
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(model.progress, 100)}%` }}
                    className={`h-full rounded-full ${
                      model.status === 'good' ? 'bg-emerald-500' : 
                      model.status === 'warning' ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-bold text-slate-500">
                  <span>Цель: ${model.goal.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* TOP OPERATORS MONTH */}
        <div className="glass-card p-6 rounded-3xl border-slate-800 space-y-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-3">
            <ICONS.Internship className="text-sky-500" size={24} />
            Топ 5 операторов месяца
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="py-4 text-[10px] uppercase text-slate-500 font-black tracking-widest">Оператор</th>
                  <th className="py-4 text-[10px] uppercase text-slate-500 font-black tracking-widest text-right">Всего</th>
                  <th className="py-4 text-[10px] uppercase text-slate-500 font-black tracking-widest text-right">Среднее</th>
                </tr>
              </thead>
              <tbody>
                {metrics.topOperatorsMonth.map((op, idx) => (
                  <tr key={op.name} className="border-b border-slate-800/50 hover:bg-white/5 transition-colors group">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-slate-600">{idx + 1}</span>
                        <span className="font-bold text-white">{op.name}</span>
                      </div>
                    </td>
                    <td className="py-4 font-mono text-emerald-400 font-bold text-right">${op.total.toLocaleString()}</td>
                    <td className="py-4 font-mono text-slate-300 text-right">${op.avg.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* TOP OPERATORS WEEK */}
        <div className="glass-card p-6 rounded-3xl border-slate-800 space-y-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-3">
            <ICONS.Reports className="text-indigo-500" size={24} />
            Топ 5 операторов недели
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="py-4 text-[10px] uppercase text-slate-500 font-black tracking-widest">Оператор</th>
                  <th className="py-4 text-[10px] uppercase text-slate-500 font-black tracking-widest text-right">Неделя</th>
                  <th className="py-4 text-[10px] uppercase text-slate-500 font-black tracking-widest text-right">Динамика</th>
                </tr>
              </thead>
              <tbody>
                {metrics.topOperatorsWeek.map((op, idx) => (
                  <tr key={op.name} className="border-b border-slate-800/50 hover:bg-white/5 transition-colors group">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-slate-600">{idx + 1}</span>
                        <span className="font-bold text-white">{op.name}</span>
                      </div>
                    </td>
                    <td className="py-4 font-mono text-white font-bold text-right">${op.currentTotal.toLocaleString()}</td>
                    <td className="py-4 text-right">
                      <div className="flex flex-col items-end">
                        <div className={`flex items-center gap-1 text-xs font-black ${
                          op.flag === 'green' ? 'text-emerald-400' : 
                          op.flag === 'red' ? 'text-rose-400' : 'text-amber-400'
                        }`}>
                          {op.growth > 0 ? '↑' : op.growth < 0 ? '↓' : ''}
                          {Math.abs(op.growth).toFixed(1)}%
                        </div>
                        <span className="text-[8px] text-slate-500 uppercase font-bold">vs прош. нед.</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* MOST PROFITABLE DAYS */}
        <div className="glass-card p-6 rounded-3xl border-slate-800 space-y-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-3">
            <ICONS.Income className="text-emerald-500" size={24} />
            Самые прибыльные дни
          </h2>
          <div className="space-y-3">
            {metrics.mostProfitableDays.map((day, idx) => (
              <div key={day.date} className="p-4 bg-slate-900/40 rounded-2xl border border-slate-800/50 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black text-slate-600">{idx + 1}</span>
                  <span className="text-sm font-bold text-slate-200">
                    {metrics.formatDate(day.date)}
                  </span>
                </div>
                <span className="text-sm font-mono font-bold text-emerald-400">${day.value.toLocaleString()}</span>
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
                  <p className="text-slate-400 italic">Детальная аналитика модели за период</p>
                </div>
                <button 
                  onClick={() => setSelectedModel(null)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <ICONS.Close size={24} className="text-slate-500" />
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <StatBox label="Выполнено" value={`$${selectedModelData.total.toLocaleString()}`} color="indigo" />
                <StatBox label="Месячный план" value={`$${selectedModelData.goal.toLocaleString()}`} color="emerald" />
                <StatBox label="Прогноз" value={`$${selectedModelData.forecast.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} color="amber" />
                <StatBox label="Лучший день" value={`$${selectedModelData.bestDay.value.toLocaleString()}`} subValue={metrics.formatDate(selectedModelData.bestDay.date)} color="pink" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-sm font-black uppercase text-slate-500 tracking-widest">Тренд дохода (Текущий период)</h3>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={selectedModelData.daily}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis 
                          dataKey="date" 
                          stroke="#64748b" 
                          fontSize={10} 
                          tickFormatter={(str) => new Date(str).toLocaleDateString('ru-RU', { day: 'numeric' })}
                        />
                        <YAxis stroke="#64748b" fontSize={10} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                          labelFormatter={(label) => metrics.formatDate(label)}
                        />
                        <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-sm font-black uppercase text-slate-500 tracking-widest">Статус выполнения</h3>
                  <div className="space-y-4">
                    <RiskItem 
                      label="Прогресс плана" 
                      status={selectedModelData.status === 'good' ? 'good' : selectedModelData.status === 'warning' ? 'warning' : 'bad'}
                      desc={`Выполнено ${selectedModelData.progress.toFixed(1)}% от цели в $${selectedModelData.goal.toLocaleString()}`}
                    />
                    <RiskItem 
                      label="Оценка прогноза" 
                      status={selectedModelData.forecast >= selectedModelData.goal ? 'good' : selectedModelData.forecast >= selectedModelData.goal * 0.8 ? 'warning' : 'bad'}
                      desc={`Ожидаемый итог: $${selectedModelData.forecast.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                    />
                  </div>
                </div>
              </div>

              {/* OPERATOR BREAKDOWN FOR MODEL */}
              <div className="space-y-4">
                <h3 className="text-sm font-black uppercase text-slate-500 tracking-widest">Выручка по операторам (Текущий период)</h3>
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

function StatBox({ label, value, subValue, color }: { label: string; value: string; subValue?: string; color: string }) {
  const colors: Record<string, string> = {
    indigo: 'text-indigo-400 border-indigo-500/20 bg-indigo-500/5',
    emerald: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5',
    red: 'text-rose-400 border-rose-500/20 bg-rose-500/5',
    amber: 'text-amber-400 border-amber-500/20 bg-amber-500/5',
    pink: 'text-pink-400 border-pink-500/20 bg-pink-500/5'
  };
  return (
    <div className={`p-5 rounded-3xl border ${colors[color] || 'bg-slate-900/50 border-slate-800'}`}>
      <p className="text-[10px] uppercase text-slate-500 font-black tracking-widest mb-2">{label}</p>
      <p className={`text-2xl font-black ${colors[color]?.split(' ')[0] || 'text-white'}`}>{value}</p>
      {subValue && <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase">{subValue}</p>}
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
