
import React, { useMemo } from 'react';
import { AppState, IncomeRecord } from '../types';
import { ICONS } from '../constants';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend 
} from 'recharts';
import { motion } from 'framer-motion';

interface MetricsProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4'];

const Metrics: React.FC<MetricsProps> = ({ state }) => {
  const incomeData = state.incomeData || [];

  const metrics = useMemo(() => {
    const now = new Date();
    
    // Start of current week (Monday)
    const startOfWeek = new Date(now);
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);

    // Start of current month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const opOverall: Record<string, number> = {};
    const opWeek: Record<string, number> = {};
    const opMonth: Record<string, number> = {};
    const modelStats: Record<string, number> = {};
    const dayOfWeekStats: Record<string, number> = {};
    const dayOfWeekMonthStats: Record<string, number> = {};
    const dailyStats: Record<string, number> = {};

    incomeData.forEach(record => {
      const recordDate = new Date(record.date);
      const amount = record.total || 0;

      // Overall Operator
      opOverall[record.operator] = (opOverall[record.operator] || 0) + amount;

      // Week Operator
      if (recordDate >= startOfWeek) {
        opWeek[record.operator] = (opWeek[record.operator] || 0) + amount;
      }

      // Month Operator
      if (recordDate >= startOfMonth) {
        opMonth[record.operator] = (opMonth[record.operator] || 0) + amount;
        
        // Daily Stats for current month
        const dateKey = record.date; // Assuming YYYY-MM-DD
        dailyStats[dateKey] = (dailyStats[dateKey] || 0) + amount;
      }

      // Model Stats
      modelStats[record.model] = (modelStats[record.model] || 0) + amount;

      // Day of Week Stats (Overall)
      const dayName = recordDate.toLocaleDateString('ru-RU', { weekday: 'long' });
      dayOfWeekStats[dayName] = (dayOfWeekStats[dayName] || 0) + amount;

      // Day of Week Stats (Month)
      if (recordDate >= startOfMonth) {
        dayOfWeekMonthStats[dayName] = (dayOfWeekMonthStats[dayName] || 0) + amount;
      }
    });

    const sortTop = (obj: Record<string, number>) => 
      Object.entries(obj)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    const topOpOverall = sortTop(opOverall).slice(0, 3);
    const topOpWeek = sortTop(opWeek).slice(0, 3);
    const topOpMonth = sortTop(opMonth).slice(0, 3);
    const topModels = sortTop(modelStats).slice(0, 10);
    
    const daysOrder = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
    const dayStatsChart = daysOrder.map(day => ({
      name: day.charAt(0).toUpperCase() + day.slice(1),
      value: dayOfWeekStats[day] || 0,
      monthValue: dayOfWeekMonthStats[day] || 0
    }));

    // Generate all days for current month for the daily chart
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dailyStatsChart = [];
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(now.getFullYear(), now.getMonth(), i);
      const dateStr = date.toISOString().split('T')[0];
      dailyStatsChart.push({
        day: i,
        date: dateStr,
        value: dailyStats[dateStr] || 0
      });
    }

    return {
      topOpOverall,
      topOpWeek,
      topOpMonth,
      topModels,
      dayStatsChart,
      dailyStatsChart,
      bestModel: topModels[0] || { name: 'Нет данных', value: 0 }
    };
  }, [incomeData]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-20"
    >
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-outfit text-white">Метрика & Аналитика</h1>
          <p className="text-slate-400">Глубокий анализ производительности операторов и моделей</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
          <ICONS.Reports className="text-indigo-400" size={20} />
          <span className="text-indigo-400 font-bold text-sm">Обновлено: {new Date().toLocaleDateString()}</span>
        </div>
      </header>

      {/* ТОП ОПЕРАТОРЫ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <TopCard 
          title="Топ операторы (Все время)" 
          data={metrics.topOpOverall} 
          icon={<ICONS.Internship size={20} />} 
          color="indigo" 
        />
        <TopCard 
          title="Топ операторы (Неделя)" 
          data={metrics.topOpWeek} 
          icon={<ICONS.Calendar size={20} />} 
          color="emerald" 
        />
        <TopCard 
          title="Топ операторы (Месяц)" 
          data={metrics.topOpMonth} 
          icon={<ICONS.Reports size={20} />} 
          color="sky" 
        />
      </div>

      {/* СУТОЧНЫЙ ЗАРАБОТОК (НОВОЕ) */}
      <div className="glass-card p-6 rounded-3xl border-slate-800 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-3">
            <ICONS.Income className="text-emerald-500" size={24} />
            Суточный заработок (Текущий месяц)
          </h2>
          <div className="text-right">
            <p className="text-[10px] uppercase text-slate-500 font-black tracking-widest">Лучший день месяца</p>
            <p className="text-lg font-black text-emerald-500">
              {metrics.dailyStatsChart.length > 0 
                ? `${[...metrics.dailyStatsChart].sort((a, b) => b.value - a.value)[0].day}-е число ($${[...metrics.dailyStatsChart].sort((a, b) => b.value - a.value)[0].value.toLocaleString()})`
                : '---'}
            </p>
          </div>
        </div>
        
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={metrics.dailyStatsChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="day" stroke="#64748b" fontSize={10} />
              <YAxis stroke="#64748b" fontSize={10} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                itemStyle={{ color: '#f8fafc' }}
                labelFormatter={(label) => `${label}-е число`}
              />
              <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* МОДЕЛИ */}
        <div className="glass-card p-6 rounded-3xl border-slate-800 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
              <ICONS.Models className="text-pink-500" size={24} />
              Производительность моделей
            </h2>
            <div className="text-right">
              <p className="text-[10px] uppercase text-slate-500 font-black tracking-widest">Лучшая модель</p>
              <p className="text-lg font-black text-pink-500">{metrics.bestModel.name}</p>
            </div>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.topModels} layout="vertical" margin={{ left: 40, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  stroke="#64748b" 
                  fontSize={12} 
                  width={100}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                  itemStyle={{ color: '#f8fafc' }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {metrics.topModels.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ДНИ НЕДЕЛИ */}
        <div className="glass-card p-6 rounded-3xl border-slate-800 space-y-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-3">
            <ICONS.Calendar className="text-amber-500" size={24} />
            Анализ по дням недели
          </h2>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.dayStatsChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                  itemStyle={{ color: '#f8fafc' }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  name="Все время" 
                  stroke="#6366f1" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#6366f1' }} 
                  activeDot={{ r: 6 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="monthValue" 
                  name="За месяц" 
                  stroke="#10b981" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#10b981' }} 
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-800">
              <p className="text-[10px] uppercase text-slate-500 font-black tracking-widest mb-1">Лучший день (Все время)</p>
              <p className="text-lg font-bold text-white">
                {[...metrics.dayStatsChart].sort((a, b) => b.value - a.value)[0]?.name || '---'}
              </p>
            </div>
            <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-800">
              <p className="text-[10px] uppercase text-slate-500 font-black tracking-widest mb-1">Лучший день (Месяц)</p>
              <p className="text-lg font-bold text-emerald-400">
                {[...metrics.dayStatsChart].sort((a, b) => b.monthValue - a.monthValue)[0]?.name || '---'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

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
