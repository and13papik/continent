import React, { useMemo, useState } from 'react';
import { AppState, IncomeRecord } from '../types';
import { ICONS } from '../constants';
import { OnlyMonsterTab } from '../components/OnlyMonsterTab';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, LineChart, Line, AreaChart, Area, PieChart, Pie
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import PeriodBadge from '../components/PeriodBadge';

interface MetricsProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
  userRole?: 'user' | 'owner' | null;
}

const METRICS_COLORS = {
  indigo: '#6366f1',
  violet: '#8b5cf6',
  pink: '#ec4899',
  rose: '#f43f5e',
  amber: '#f59e0b',
  emerald: '#10b981',
  sky: '#06b6d4',
  teal: '#14b8a6',
  purple: '#a855f7',
  gray: '#64748b'
};

const Metrics: React.FC<MetricsProps> = ({ state, userRole }) => {
  const incomeData = state.incomeData || [];
  const [activeTab, setActiveTab] = useState<'overview' | 'diagnostics' | 'models' | 'operators' | 'calendar' | 'onlymonster'>('onlymonster');
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [modelFilterSearch, setModelFilterSearch] = useState('');
  const [opFilterSearch, setOpFilterSearch] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<'all' | 'onlyFans' | 'paypal' | 'crypto'>('all');
  const [copiedReport, setCopiedReport] = useState(false);

  const inactiveModelsSet = useMemo(() => {
    return new Set((state.inactiveModels || []).map(m => m.trim().toLowerCase()));
  }, [state.inactiveModels]);

  const metrics = useMemo(() => {
    const activePeriodId = state.selectedPeriodId;
    const currentPeriod = state.accountingPeriods.find(p => p.id === activePeriodId);
    
    // Find previous period for comparison
    const sortedPeriods = [...state.accountingPeriods].sort((a, b) => 
      new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    );
    const currentIndex = sortedPeriods.findIndex(p => p.id === activePeriodId);
    const prevPeriod = currentIndex > 0 ? sortedPeriods[currentIndex - 1] : null;

    // Accounting day logic (03:00 AM Kyiv threshold)
    const getAccountingDateKyiv = () => {
      const now = new Date();
      try {
        const formatter = new Intl.DateTimeFormat("en-US", {
          timeZone: "Europe/Kiev",
          year: "numeric",
          month: "numeric",
          day: "numeric",
          hour: "numeric",
          hour12: false
        });
        const parts = formatter.formatToParts(now);
        const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
        
        const y = parseInt(partMap.year, 10);
        const m = parseInt(partMap.month, 10);
        const d = parseInt(partMap.day, 10);
        const h = parseInt(partMap.hour, 10);
        
        const date = new Date(y, m - 1, d);
        if (h < 3) {
          date.setDate(date.getDate() - 1);
        }
        return date;
      } catch (e) {
        const date = new Date();
        if (date.getHours() < 3) {
          date.setDate(date.getDate() - 1);
        }
        return date;
      }
    };
    const accountingDate = getAccountingDateKyiv();

    const isLatestPeriod = sortedPeriods.length > 0 && sortedPeriods[sortedPeriods.length - 1].id === activePeriodId;

    let targetYear = accountingDate.getFullYear();
    let targetMonth = accountingDate.getMonth();

    if (currentPeriod) {
      const pStart = new Date(currentPeriod.startAt);
      targetYear = pStart.getUTCFullYear();
      targetMonth = pStart.getUTCMonth();
    }

    const currentRecords = incomeData.filter(r => r.periodId === activePeriodId);
    const prevRecords = prevPeriod ? incomeData.filter(r => r.periodId === prevPeriod.id) : [];

    const prevTotal = prevRecords.reduce((sum, r) => sum + (r.total || 0), 0);
    const currentTotal = currentRecords.reduce((sum, r) => sum + (r.total || 0), 0);
    const growth = prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : 0;

    // Platform share breakdown
    const currentOF = currentRecords.reduce((sum, r) => sum + (r.onlyFans || 0), 0);
    const currentPP = currentRecords.reduce((sum, r) => sum + (r.paypal || 0), 0);
    const currentCR = currentRecords.reduce((sum, r) => sum + (r.crypto || 0), 0);

    const platformShare = [
      { name: 'OnlyFans', value: currentOF, percent: currentTotal > 0 ? (currentOF / currentTotal) * 100 : 0, color: METRICS_COLORS.indigo },
      { name: 'PayPal', value: currentPP, percent: currentTotal > 0 ? (currentPP / currentTotal) * 100 : 0, color: METRICS_COLORS.emerald },
      { name: 'Crypto', value: currentCR, percent: currentTotal > 0 ? (currentCR / currentTotal) * 100 : 0, color: METRICS_COLORS.amber }
    ].filter(p => p.value > 0);

    // Daily stats for current month with platform breakdown
    const dailyRevenue: Record<string, { total: number; onlyFans: number; paypal: number; crypto: number }> = {};
    currentRecords.forEach(r => {
      if (!dailyRevenue[r.date]) {
        dailyRevenue[r.date] = { total: 0, onlyFans: 0, paypal: 0, crypto: 0 };
      }
      dailyRevenue[r.date].total += (r.total || 0);
      dailyRevenue[r.date].onlyFans += (r.onlyFans || 0);
      dailyRevenue[r.date].paypal += (r.paypal || 0);
      dailyRevenue[r.date].crypto += (r.crypto || 0);
    });

    const dailyEntries: { date: string; value: number; total: number; onlyFans: number; paypal: number; crypto: number }[] = [];
    const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    
    const maxDayToInclude = isLatestPeriod
      ? Math.max(
          accountingDate.getFullYear() === targetYear && accountingDate.getMonth() === targetMonth ? accountingDate.getDate() : 1,
          ...currentRecords.map(r => {
            const parts = r.date.split('-');
            if (parts.length === 3 && parseInt(parts[0], 10) === targetYear && parseInt(parts[1], 10) === targetMonth + 1) {
              return parseInt(parts[2], 10);
            }
            return 1;
          })
        )
      : daysInMonth;

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (d <= maxDayToInclude) {
        const dayData = dailyRevenue[dateStr] || { total: 0, onlyFans: 0, paypal: 0, crypto: 0 };
        const val = selectedPlatform === 'onlyFans' ? dayData.onlyFans :
                    selectedPlatform === 'paypal' ? dayData.paypal :
                    selectedPlatform === 'crypto' ? dayData.crypto : dayData.total;
        dailyEntries.push({
          date: dateStr,
          value: val,
          total: dayData.total,
          onlyFans: dayData.onlyFans,
          paypal: dayData.paypal,
          crypto: dayData.crypto
        });
      }
    }
    
    // Best/Worst Day of Month
    let bestDayOfMonth = { date: 'N/A', value: 0 };
    let worstDayOfMonth = { date: 'N/A', value: Infinity };
    
    dailyEntries.forEach(({ date, value }) => {
      if (value > bestDayOfMonth.value) bestDayOfMonth = { date, value };
      if (value < worstDayOfMonth.value && value > 0) worstDayOfMonth = { date, value };
    });
    if (worstDayOfMonth.value === Infinity) worstDayOfMonth.value = 0;

    const formatDayString = (dateStr: string) => {
      if (dateStr === 'N/A' || !dateStr) return 'N/A';
      const parts = dateStr.split('-');
      if (parts.length !== 3) return dateStr;
      const [y, m, d] = parts;
      const monthNames = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
      const mIdx = parseInt(m, 10) - 1;
      const dowNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
      
      const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
      const dow = dowNames[date.getDay()];
      
      return `${dow}, ${parseInt(d, 10)} ${monthNames[mIdx] || m}`;
    };

    const formatShortDayString = (dateStr: string) => {
      if (dateStr === 'N/A' || !dateStr) return 'N/A';
      const parts = dateStr.split('-');
      if (parts.length !== 3) return dateStr;
      const [, m, d] = parts;
      const monthNames = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
      return `${parseInt(d, 10)} ${monthNames[parseInt(m, 10) - 1] || m}`;
    };

    // Best/Worst Day of Week (Unbiased Average)
    const dowNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    const dowSum: Record<number, number> = {0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0};
    const dowCount: Record<number, number> = {0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0};
    
    dailyEntries.forEach(({ date, value }) => {
      const parts = date.split('-');
      if (parts.length === 3) {
        const [y, m, d] = parts.map(Number);
        const dayOfWeek = new Date(y, m - 1, d).getDay();
        dowSum[dayOfWeek] += value;
        dowCount[dayOfWeek] += 1;
      }
    });

    const dowAverages = Object.keys(dowSum).map(Number).map(dow => {
      const sum = dowSum[dow];
      const count = dowCount[dow] || 1;
      return {
        dow,
        name: dowNames[dow],
        average: sum / count,
        total: sum,
        count
      };
    }).sort((a, b) => b.average - a.average);

    const bestDow = dowAverages.length > 0 ? { name: dowAverages[0].name, value: dowAverages[0].average } : { name: 'N/A', value: 0 };
    const worstDow = dowAverages.length > 0 ? { name: dowAverages[dowAverages.length - 1].name, value: dowAverages[dowAverages.length - 1].average } : { name: 'N/A', value: 0 };

    // Days Passed for Forecast
    let daysPassed = daysInMonth;
    if (isLatestPeriod) {
      if (accountingDate.getFullYear() === targetYear && accountingDate.getMonth() === targetMonth) {
        daysPassed = Math.max(1, accountingDate.getDate());
      } else if (accountingDate.getTime() < new Date(targetYear, targetMonth, 1).getTime()) {
        daysPassed = 1;
      }
    }

    const runRate = currentTotal / daysPassed;
    const projectedTotal = Math.max(currentTotal, runRate * daysInMonth);

    // Cumulative plans
    const currentPeriodModels = (currentPeriod?.models && currentPeriod.models.length > 0)
      ? currentPeriod.models
      : state.models;

    const activeModelsList = currentPeriodModels.filter(m => m.trim() !== '' && !inactiveModelsSet.has(m.trim().toLowerCase()));
    const totalCombinedPlan = activeModelsList.reduce((sum, name) => {
      return sum + (currentPeriod?.modelMonthlyPlans?.[name] || state.modelMonthlyPlans?.[name] || 0);
    }, 0);

    const planFulfillmentForecast = totalCombinedPlan > 0 ? (projectedTotal / totalCombinedPlan) * 100 : 0;

    // Model metrics
    const modelMetrics = currentPeriodModels
      .filter(m => m.trim() !== '')
      .map(name => {
        const mRecords = currentRecords.filter(r => r.model.trim().toLowerCase() === name.trim().toLowerCase());
        const mTotal = mRecords.reduce((sum, r) => sum + (r.total || 0), 0);
        const mOnlyFansTotal = mRecords.reduce((sum, r) => sum + (r.onlyFans || 0), 0);
        const mPrevRecords = prevRecords.filter(r => r.model.trim().toLowerCase() === name.trim().toLowerCase());
        const mPrevTotal = mPrevRecords.reduce((sum, r) => sum + (r.total || 0), 0);
        const mGrowth = mPrevTotal > 0 ? ((mTotal - mPrevTotal) / mPrevTotal) * 100 : mTotal > 0 ? 100 : 0;
        const mGoal = currentPeriod?.modelMonthlyPlans?.[name] || state.modelMonthlyPlans?.[name] || 0;
        
        const mProgress = mGoal > 0 ? (mOnlyFansTotal / mGoal) * 100 : 0;
        
        const mDaily: Record<string, number> = {};
        mRecords.forEach(r => { mDaily[r.date] = (mDaily[r.date] || 0) + r.total; });
        
        const mDailyFull = dailyEntries.map(d => ({
          date: d.date,
          value: mDaily[d.date] || 0
        }));

        const mRunRate = mOnlyFansTotal / daysPassed;
        const mForecast = Math.max(mOnlyFansTotal, mRunRate * daysInMonth);
        
        // Status logic
        let status: 'good' | 'warning' | 'bad' = 'good';
        if (mGoal > 0) {
          const expectedProgress = (daysPassed / daysInMonth) * 100;
          if (mProgress < expectedProgress * 0.75) status = 'bad';
          else if (mProgress < expectedProgress) status = 'warning';
        }

        let mBestDay = { date: 'N/A', value: 0 };
        Object.entries(mDaily).forEach(([d, v]) => {
          if (v > mBestDay.value) mBestDay = { date: d, value: v };
        });

        return {
          name,
          isActive: !inactiveModelsSet.has(name.trim().toLowerCase()),
          total: mTotal,
          totalOnlyFans: mOnlyFansTotal,
          goal: mGoal,
          progress: mProgress,
          forecast: mForecast,
          growth: mGrowth,
          status,
          bestDay: mBestDay,
          daily: mDailyFull,
          operators: mRecords.reduce((acc, r) => {
            acc[r.operator] = (acc[r.operator] || 0) + r.total;
            return acc;
          }, {} as Record<string, number>)
        };
      }).sort((a, b) => b.total - a.total);

    // Operator Stats & Analytics
    const operatorStats = currentRecords.reduce((acc, r) => {
      if (!acc[r.operator]) {
        acc[r.operator] = { total: 0, count: 0, of: 0, pp: 0, cr: 0, dates: new Set<string>() };
      }
      acc[r.operator].total += r.total;
      acc[r.operator].of += r.onlyFans;
      acc[r.operator].pp += r.paypal;
      acc[r.operator].cr += r.crypto;
      acc[r.operator].count += 1;
      acc[r.operator].dates.add(r.date);
      return acc;
    }, {} as Record<string, { total: number; count: number; of: number; pp: number; cr: number; dates: Set<string> }>);

    const topOperatorsMonth = Object.entries(operatorStats)
      .map(([name, stats]) => {
        const daysWorked = stats.dates.size || 1;
        const avgPerDay = stats.total / daysWorked;
        // Consistency: percentage of working days where revenue is > $100
        let highRevenueDays = 0;
        stats.dates.forEach(date => {
          const dayTotal = currentRecords
            .filter(r => r.operator === name && r.date === date)
            .reduce((sum, r) => sum + r.total, 0);
          if (dayTotal > 150) highRevenueDays++;
        });
        const consistencyIndex = (highRevenueDays / daysWorked) * 100;

        return {
          name,
          total: stats.total,
          onlyFansShare: stats.total > 0 ? (stats.of / stats.total) * 100 : 0,
          avgPerShift: stats.total / stats.count,
          avgPerDay,
          daysWorked,
          consistencyIndex
        };
      })
      .sort((a, b) => b.total - a.total);

    // Weekly Operator dynamics
    const getLocalDateString = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const today = new Date();
    const currentDayOfWeek = today.getDay();
    const diffToMon = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;
    
    const currentMonday = new Date(today);
    currentMonday.setDate(today.getDate() - diffToMon);
    
    const prevMonday = new Date(currentMonday);
    prevMonday.setDate(currentMonday.getDate() - 7);

    const currentWeekDates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(currentMonday);
      d.setDate(currentMonday.getDate() + i);
      currentWeekDates.push(getLocalDateString(d));
    }

    const prevWeekDates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(prevMonday);
      d.setDate(prevMonday.getDate() + i);
      prevWeekDates.push(getLocalDateString(d));
    }

    const currentWeekSet = new Set(currentWeekDates);
    const prevWeekSet = new Set(prevWeekDates);

    const currentWeekRecords = incomeData.filter(r => currentWeekSet.has(r.date));
    const prevWeekRecords = incomeData.filter(r => prevWeekSet.has(r.date));

    const opCurrentWeek: Record<string, number> = {};
    const opPrevWeek: Record<string, number> = {};

    currentWeekRecords.forEach(r => { opCurrentWeek[r.operator] = (opCurrentWeek[r.operator] || 0) + r.total; });
    prevWeekRecords.forEach(r => { opPrevWeek[r.operator] = (opPrevWeek[r.operator] || 0) + r.total; });

    const topOperatorsWeek = Object.entries(opCurrentWeek)
      .map(([name, cTotal]) => {
        const pTotal = opPrevWeek[name] || 0;
        const growthVal = pTotal > 0 ? ((cTotal - pTotal) / pTotal) * 100 : cTotal > 0 ? 100 : 0;
        
        let flag: 'green' | 'yellow' | 'red' = 'yellow';
        if (growthVal > 10) flag = 'green';
        else if (growthVal < -10) flag = 'red';

        return { name, currentTotal: cTotal, prevTotal: pTotal, growth: growthVal, flag };
      })
      .sort((a, b) => b.currentTotal - a.currentTotal);

    // AI Diagnostics ("Где плохо, где хорошо")
    const diagnostics = (() => {
      const achievements: { text: string; sub: string }[] = [];
      const warnings: { text: string; sub: string; severity: 'high' | 'medium' }[] = [];
      const recommendations: string[] = [];

      // Overall health achievements
      if (growth > 0) {
        achievements.push({
          text: `Выручка выросла на +${growth.toFixed(1)}%`,
          sub: `Текущий период принес $${currentTotal.toLocaleString()} против $${prevTotal.toLocaleString()} в прошлом периоде.`
        });
      }
      
      const avgDaily = currentTotal / (dailyEntries.length || 1);
      const prevAvgDaily = prevTotal / (daysInMonth || 1);
      if (avgDaily > prevAvgDaily) {
        achievements.push({
          text: `Средний дневной сбор вырос до $${avgDaily.toLocaleString(undefined, { maximumFractionDigits: 0 })}/день`,
          sub: `Это выше среднего показателя прошлого периода ($${prevAvgDaily.toLocaleString(undefined, { maximumFractionDigits: 0 })}/день) на +${(((avgDaily - prevAvgDaily) / prevAvgDaily) * 100).toFixed(1)}%.`
        });
      }

      // Strongest weekdays
      if (dowAverages.length > 0) {
        const topDow = dowAverages[0];
        achievements.push({
          text: `Пиковый день недели: ${topDow.name}`,
          sub: `Средние сборы в этот день составляют $${topDow.average.toLocaleString(undefined, { maximumFractionDigits: 0 })} в день.`
        });
      }

      // Overperforming models
      const overachievingModels = modelMetrics.filter(m => m.isActive && m.goal > 0 && m.forecast >= m.goal * 1.05);
      overachievingModels.forEach(m => {
        achievements.push({
          text: `Модель ${m.name} опережает плановые темпы`,
          sub: `Прогноз составляет $${m.forecast.toLocaleString(undefined, { maximumFractionDigits: 0 })} при цели в $${m.goal.toLocaleString()} (+${(m.forecast / m.goal * 100 - 100).toFixed(0)}%).`
        });
      });

      // Growing operators
      const starOps = topOperatorsWeek.filter(o => o.growth > 15 && o.currentTotal > 300);
      starOps.forEach(o => {
        achievements.push({
          text: `Резкий рост оператора: ${o.name}`,
          sub: `Показал взрывную динамику на этой неделе: +${o.growth.toFixed(1)}% ($${o.currentTotal.toLocaleString()} vs $${o.prevTotal.toLocaleString()}).`
        });
      });

      // Warnings & Risks
      // General target risks
      if (totalCombinedPlan > 0 && projectedTotal < totalCombinedPlan) {
        warnings.push({
          severity: 'high',
          text: `Агентство рискует недополучить ${(100 - planFulfillmentForecast).toFixed(1)}% от общего плана`,
          sub: `Общий прогноз ($${projectedTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}) отстает от суммарного плана моделей ($${totalCombinedPlan.toLocaleString()}).`
        });
        recommendations.push("Требуется мобилизовать трафик или перераспределить рабочие часы операторов на приоритетные модели для закрытия отставания в сборах.");
      }

      // Underperforming models
      const failingModels = modelMetrics.filter(m => m.isActive && m.goal > 0 && m.forecast < m.goal * 0.85);
      failingModels.forEach(m => {
        warnings.push({
          severity: 'high',
          text: `Критическое отставание модели: ${m.name}`,
          sub: `Прогноз OnlyFans ($${m.forecast.toLocaleString(undefined, { maximumFractionDigits: 0 })}) составляет всего ${m.progress.toFixed(0)}% от цели в $${m.goal.toLocaleString()}. Ожидаемый дефицит: -$${Math.max(0, m.goal - m.forecast).toLocaleString(undefined, { maximumFractionDigits: 0 })}.`
        });
        recommendations.push(`Срочно проверьте качество трафика и работу операторов на модели ${m.name}. Дефицит по этой модели ставит под угрозу общий план агентства.`);
      });

      // Declining operators
      const decliningOps = topOperatorsWeek.filter(o => o.growth < -15 && o.prevTotal > 300);
      decliningOps.forEach(o => {
        warnings.push({
          severity: 'medium',
          text: `Падение эффективности оператора: ${o.name}`,
          sub: `Сборы за текущую неделю просели на ${o.growth.toFixed(1)}% по сравнению с прошлой ($${o.currentTotal.toLocaleString()} vs $${o.prevTotal.toLocaleString()}).`
        });
        recommendations.push(`Проведите разбор смен с оператором ${o.name}, чтобы выявить причины падения сборов на ${Math.abs(o.growth).toFixed(0)}%.`);
      });

      // Weak days check & Weekend slumps
      const weekdays = dowAverages.filter(d => [1,2,3,4,5].includes(d.dow));
      const weekends = dowAverages.filter(d => [0,6].includes(d.dow));
      
      const avgWeekdays = weekdays.reduce((sum, d) => sum + d.average, 0) / (weekdays.length || 1);
      const avgWeekends = weekends.reduce((sum, d) => sum + d.average, 0) / (weekends.length || 1);
      
      if (avgWeekends < avgWeekdays * 0.85) {
        warnings.push({
          severity: 'medium',
          text: `Выявлен спад выручки в выходные дни (на -${((1 - avgWeekends / avgWeekdays) * 100).toFixed(0)}%)`,
          sub: `В среднем выходные приносят $${avgWeekends.toLocaleString(undefined, { maximumFractionDigits: 0 })}/день по сравнению с $${avgWeekdays.toLocaleString(undefined, { maximumFractionDigits: 0 })}/день в будни.`
        });
        recommendations.push("Усильте контроль за выходом операторов в субботу и воскресенье или пересмотрите графики дежурств опытных сотрудников.");
      }

      // Zero or suspiciously low days
      const suspiciousDays = dailyEntries.filter(d => d.value < avgDaily * 0.25 && d.value > 0);
      if (suspiciousDays.length > 0) {
        warnings.push({
          severity: 'medium',
          text: `Обнаружены аномально низкие дни сбора`,
          sub: `Дни: ${suspiciousDays.map(d => formatShortDayString(d.date)).join(', ')} принесли менее 25% от среднедневного сбора. Проверьте логи смен.`
        });
      }

      // Fallback recommendation
      if (recommendations.length === 0) {
        recommendations.push("Все операционные метрики в зеленой зоне. Рекомендуется поддерживать текущий темп и сфокусироваться на масштабировании лучших операторов.");
      }

      return {
        achievements,
        warnings,
        recommendations
      };
    })();

    return {
      currentTotal,
      prevTotal,
      growth,
      platformShare,
      bestDayOfMonth,
      worstDayOfMonth,
      bestDow,
      worstDow,
      projectedTotal,
      totalCombinedPlan,
      planFulfillmentForecast,
      modelMetrics,
      dailyEntries,
      topOperatorsMonth,
      topOperatorsWeek,
      dowAverages,
      diagnostics,
      daysInMonth,
      daysPassed,
      avgDailyRevenue: currentTotal / (dailyEntries.length || 1),
      mostProfitableDays: [...dailyEntries].sort((a, b) => b.value - a.value).slice(0, 5),
      formatDate: formatDayString,
      formatShortDate: formatShortDayString
    };
  }, [incomeData, state.modelMonthlyPlans, state.selectedPeriodId, state.accountingPeriods, state.models, inactiveModelsSet, selectedPlatform]);

  const selectedModelData = useMemo(() => {
    if (!selectedModel) return null;
    return metrics.modelMetrics.find(m => m.name === selectedModel);
  }, [selectedModel, metrics.modelMetrics]);

  // Filters for sub-tabs
  const filteredModelMetrics = useMemo(() => {
    return metrics.modelMetrics.filter(m => 
      m.name.toLowerCase().includes(modelFilterSearch.toLowerCase())
    );
  }, [metrics.modelMetrics, modelFilterSearch]);

  const filteredOperators = useMemo(() => {
    return metrics.topOperatorsMonth.filter(op => 
      op.name.toLowerCase().includes(opFilterSearch.toLowerCase())
    );
  }, [metrics.topOperatorsMonth, opFilterSearch]);

  const generateTelegramReport = () => {
    const activePeriod = state.accountingPeriods.find(p => p.id === state.selectedPeriodId);
    const periodName = activePeriod ? activePeriod.label : 'Текущий период';
    const topModel = metrics.modelMetrics[0];
    const topOp = metrics.topOperatorsMonth[0];
    const mainRisk = metrics.diagnostics.warnings[0]?.text;
    const mainInsight = metrics.diagnostics.achievements[0]?.text;

    let reportText = '📊 *Сводный отчет по метрикам агентства*\n';
    reportText += '🗓 *Период:* ' + periodName + '\n\n';
    reportText += '💵 *Общая выручка:* $' + metrics.currentTotal.toLocaleString() + ' (' + (metrics.growth >= 0 ? '+' : '') + metrics.growth.toFixed(1) + '% vs прошлый период)\n';
    reportText += '📈 *Прогноз на период:* $' + metrics.projectedTotal.toLocaleString(undefined, { maximumFractionDigits: 0 }) + '\n';
    reportText += '🎯 *Выполнение плана:* ' + metrics.planFulfillmentForecast.toFixed(1) + '%\n\n';
    reportText += '⭐ *Топ модель:* ' + (topModel ? topModel.name + ' ($' + topModel.total.toLocaleString() + ', ' + topModel.progress.toFixed(0) + '% от плана)' : '—') + '\n';
    reportText += '⚡ *Топ оператор:* ' + (topOp ? topOp.name + ' ($' + topOp.total.toLocaleString() + ', $' + topOp.avgPerShift.toFixed(0) + '/смена)' : '—') + '\n';
    if (mainInsight) reportText += '\n✅ *Успех:* ' + mainInsight + '\n';
    if (mainRisk) reportText += '\n⚠️ *Внимание:* ' + mainRisk + '\n';
    reportText += '\n_Сформировано автоматически из Аналитического Центра_';

    try {
      navigator.clipboard.writeText(reportText);
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 3000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-20"
    >
      {/* METRICS SUB-TABS */}
      <div className="flex flex-wrap gap-1 bg-slate-950/60 p-1 rounded-2xl border border-white/[0.03]">
        {[
          { id: 'overview', label: 'Обзор', icon: ICONS.Dashboard },
          { id: 'diagnostics', label: 'Анализ & Инсайты', icon: ICONS.Penalty, highlight: metrics.diagnostics.warnings.length > 0 },
          { id: 'models', label: 'Модели & Планы', icon: ICONS.Models },
          { id: 'operators', label: 'Операторы', icon: ICONS.Reports },
          { id: 'calendar', label: 'Дни и Тренды', icon: ICONS.Calendar },
          { id: 'onlymonster', label: 'OnlyMonster', icon: ICONS.Clock }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-bold uppercase font-mono tracking-wider transition-all duration-300 flex items-center justify-center gap-2 border ${
                isActive 
                  ? 'bg-gradient-to-br from-indigo-500/15 to-violet-500/5 text-indigo-400 border-indigo-500/20 shadow-md shadow-indigo-950/40' 
                  : 'text-slate-500 border-transparent hover:text-slate-300 hover:bg-white/[0.02]'
              }`}
            >
              {Icon && <Icon size={14} />}
              <span>{tab.label}</span>
              {tab.highlight && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* ACTIVE TAB CONTAINER */}
      <div className="outline-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* TAB: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* QUICK STATBOXES */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatBox label="Лучший день месяца" value={`$${metrics.bestDayOfMonth.value.toLocaleString()}`} subValue={metrics.formatDate(metrics.bestDayOfMonth.date)} color="emerald" />
                  <StatBox label="Худший день месяца" value={`$${metrics.worstDayOfMonth.value.toLocaleString()}`} subValue={metrics.formatDate(metrics.worstDayOfMonth.date)} color="red" />
                  <StatBox label="Среднесменный сбор" value={`$${(metrics.currentTotal / (incomeData.filter(r => r.periodId === state.selectedPeriodId).length || 1)).toLocaleString(undefined, { maximumFractionDigits: 0 })}`} subValue="В среднем за смену" color="indigo" />
                  <StatBox label="Среднедневной сбор" value={`$${metrics.avgDailyRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} subValue="В среднем за 1 день" color="amber" />
                </div>

                {/* GRAPH & PLATFORM BREAKDOWN */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* MAIN CHART */}
                  <div className="lg:col-span-2 glass-card p-5 rounded-3xl border border-white/5 bg-slate-950/45 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <h3 className="text-sm font-black uppercase text-slate-300 tracking-wider font-mono flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-indigo-500" />
                          Динамика выручки
                        </h3>

                        <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-white/5">
                          {[
                            { id: 'all', label: 'Все' },
                            { id: 'onlyFans', label: 'OF' },
                            { id: 'paypal', label: 'PayPal' },
                            { id: 'crypto', label: 'Crypto' }
                          ].map(p => (
                            <button
                              key={p.id}
                              onClick={() => setSelectedPlatform(p.id as any)}
                              className={`px-2 py-0.5 text-[9px] font-black font-mono uppercase rounded-lg transition-all ${
                                selectedPlatform === p.id 
                                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm' 
                                  : 'text-slate-500 hover:text-slate-300'
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">
                        Дней пройдено: {metrics.daysPassed} из {metrics.daysInMonth}
                      </span>
                    </div>
                    <div className="h-[280px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={metrics.dailyEntries}>
                          <defs>
                            <linearGradient id="overviewGlow" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={METRICS_COLORS.indigo} stopOpacity={0.25}/>
                              <stop offset="95%" stopColor={METRICS_COLORS.indigo} stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" vertical={false} />
                          <XAxis 
                            dataKey="date" 
                            stroke="#475569" 
                            fontSize={9} 
                            tickFormatter={(str) => metrics.formatShortDate(str)}
                            tickLine={false}
                          />
                          <YAxis stroke="#475569" fontSize={9} tickLine={false} axisLine={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '12px' }}
                            labelStyle={{ color: '#94a3b8', fontSize: '10px', fontWeight: 'bold' }}
                            itemStyle={{ color: '#f8fafc', fontSize: '12px' }}
                            formatter={(val: any) => [`$${val?.toLocaleString() || 0}`, 'Выручка'] }
                            labelFormatter={(lbl) => metrics.formatDate(lbl as string)}
                          />
                          <Area type="monotone" dataKey="value" stroke={METRICS_COLORS.indigo} fillOpacity={1} fill="url(#overviewGlow)" strokeWidth={2.5} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* PLATFORM BREAKDOWN */}
                  <div className="glass-card p-5 rounded-3xl border border-white/5 bg-slate-950/45 flex flex-col justify-between space-y-4">
                    <div>
                      <h3 className="text-sm font-black uppercase text-slate-300 tracking-wider font-mono flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Доли Платформ
                      </h3>
                      <p className="text-[10px] text-slate-500 uppercase font-mono mt-1">Доминирующие источники дохода</p>
                    </div>

                    <div className="relative flex items-center justify-center py-4">
                      <div className="h-[140px] w-[140px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={metrics.platformShare}
                              cx="50%"
                              cy="50%"
                              innerRadius={45}
                              outerRadius={60}
                              paddingAngle={4}
                              dataKey="value"
                            >
                              {metrics.platformShare.map((entry, idx) => (
                                <Cell key={`cell-${idx}`} fill={entry.color} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="absolute flex flex-col items-center">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono">OnlyFans Share</span>
                        <span className="text-xl font-black text-white font-mono">
                          {metrics.platformShare.find(p => p.name === 'OnlyFans')?.percent.toFixed(0) || '0'}%
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {metrics.platformShare.map(platform => (
                        <div key={platform.name} className="flex justify-between items-center bg-slate-950/40 p-2.5 rounded-xl border border-white/[0.02]">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: platform.color }} />
                            <span className="text-xs font-bold text-slate-300">{platform.name}</span>
                          </div>
                          <div className="text-right font-mono text-xs">
                            <span className="text-white font-black">${platform.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            <span className="text-slate-500 text-[10px] ml-1.5">({platform.percent.toFixed(1)}%)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* BOTTOM SUMMARY ROW */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* MOST PROFITABLE DAYS */}
                  <div className="glass-card p-5 rounded-3xl border border-white/5 bg-slate-950/45 space-y-3">
                    <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider font-mono flex items-center gap-1.5">
                      <ICONS.Income size={14} className="text-emerald-400" />
                      Топ-5 лучших дней периода
                    </h3>
                    <div className="space-y-2">
                      {metrics.mostProfitableDays.map((day, idx) => (
                        <div key={day.date} className="p-3 bg-slate-950/40 rounded-xl border border-white/[0.02] hover:border-white/5 transition-colors flex justify-between items-center">
                          <div className="flex items-center gap-2.5">
                            <span className="w-5 h-5 rounded-md bg-slate-900 border border-white/5 flex items-center justify-center text-[10px] font-black text-slate-500 font-mono">
                              {idx + 1}
                            </span>
                            <span className="text-xs font-bold text-slate-200">{metrics.formatDate(day.date)}</span>
                          </div>
                          <span className="text-xs font-mono font-black text-emerald-400">${day.value.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* WEEKLY DYNAMICS OF LEADERS */}
                  <div className="glass-card p-5 rounded-3xl border border-white/5 bg-slate-950/45 space-y-3">
                    <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider font-mono flex items-center gap-1.5">
                      <ICONS.Reports size={14} className="text-indigo-400" />
                      Недельная динамика лидеров
                    </h3>
                    <div className="space-y-2">
                      {metrics.topOperatorsWeek.slice(0, 5).map((op, idx) => (
                        <div key={op.name} className="p-3 bg-slate-950/40 rounded-xl border border-white/[0.02] hover:border-white/5 transition-colors flex justify-between items-center">
                          <div className="flex items-center gap-2.5">
                            <span className="w-5 h-5 rounded-md bg-slate-900 border border-white/5 flex items-center justify-center text-[10px] font-black text-slate-500 font-mono">
                              {idx + 1}
                            </span>
                            <span className="text-xs font-bold text-slate-200">{op.name}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-mono font-black text-white mr-2">${op.currentTotal.toLocaleString()}</span>
                            <span className={`text-[10px] font-mono font-black ${op.flag === 'green' ? 'text-emerald-400' : op.flag === 'red' ? 'text-rose-400' : 'text-amber-400'}`}>
                              {op.growth > 0 ? '↑' : op.growth < 0 ? '↓' : ''}{Math.abs(op.growth).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: DIAGNOSTICS ("Где плохо, где хорошо") */}
            {activeTab === 'diagnostics' && (
              <div className="space-y-6">
                {/* AGENCY HEALTH HEADER */}
                <div className="p-6 rounded-3xl border border-white/5 bg-gradient-to-b from-slate-950 to-slate-900/60 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/[0.02] rounded-full blur-3xl pointer-events-none" />
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
                    <div className="space-y-1">
                      <h3 className="text-base font-black text-white uppercase tracking-tight font-mono">Прогнозируемое Выполнение Общего Плана</h3>
                      <p className="text-xs text-slate-400">На основе текущего темпа и целей активных моделей</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-500 font-mono font-bold block mb-1">Суммарный план: ${metrics.totalCombinedPlan.toLocaleString()}</span>
                      <span className={`text-3xl font-black font-mono ${metrics.planFulfillmentForecast >= 100 ? 'text-emerald-400' : metrics.planFulfillmentForecast >= 80 ? 'text-amber-400' : 'text-rose-400'}`}>
                        {metrics.planFulfillmentForecast.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  {/* PROGRESS BAR */}
                  <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden mt-4 p-[1px] border border-white/5">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        metrics.planFulfillmentForecast >= 100 ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 
                        metrics.planFulfillmentForecast >= 80 ? 'bg-gradient-to-r from-amber-600 to-amber-400' : 
                        'bg-gradient-to-r from-rose-600 to-rose-400'
                      }`} 
                      style={{ width: `${Math.min(100, metrics.planFulfillmentForecast)}%` }} 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* ACHIEVEMENTS ("ЧТО ИДЕТ ОТЛИЧНО 👍") */}
                  <div className="glass-card p-5 rounded-3xl border border-emerald-500/10 bg-slate-950/30 space-y-4">
                    <div className="flex items-center gap-2.5 border-b border-white/5 pb-3">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <ICONS.Check size={16} />
                      </div>
                      <div>
                        <h3 className="text-sm font-black uppercase text-emerald-400 tracking-wider font-mono">Сильные стороны (Что идет хорошо)</h3>
                        <p className="text-[10px] text-slate-500 uppercase font-mono">Выявленные успехи за период</p>
                      </div>
                    </div>

                    <div className="space-y-3.5 max-h-[400px] overflow-y-auto pr-1">
                      {metrics.diagnostics.achievements.length === 0 ? (
                        <p className="text-xs text-slate-500 italic py-4">Выдающихся аномалий роста не обнаружено.</p>
                      ) : (
                        metrics.diagnostics.achievements.map((item, i) => (
                          <div key={i} className="p-3.5 bg-emerald-950/[0.04] border border-emerald-500/5 rounded-xl space-y-1">
                            <p className="text-xs font-black text-slate-100 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              {item.text}
                            </p>
                            <p className="text-[11px] text-slate-400 leading-relaxed">{item.sub}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* RISKS ("Зоны риска & Что идет плохо ⚠️") */}
                  <div className="glass-card p-5 rounded-3xl border border-rose-500/10 bg-slate-950/30 space-y-4">
                    <div className="flex items-center gap-2.5 border-b border-white/5 pb-3">
                      <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                        <ICONS.Penalty size={16} />
                      </div>
                      <div>
                        <h3 className="text-sm font-black uppercase text-rose-400 tracking-wider font-mono">Зоны внимания (Что идет плохо)</h3>
                        <p className="text-[10px] text-slate-500 uppercase font-mono">Потенциальные просадки и дефициты</p>
                      </div>
                    </div>

                    <div className="space-y-3.5 max-h-[400px] overflow-y-auto pr-1">
                      {metrics.diagnostics.warnings.length === 0 ? (
                        <div className="p-4 bg-emerald-950/15 border border-emerald-500/20 text-emerald-400 rounded-2xl text-center">
                          <p className="text-xs font-bold">Критических рисков не обнаружено! Все показатели стабильны.</p>
                        </div>
                      ) : (
                        metrics.diagnostics.warnings.map((item, i) => (
                          <div 
                            key={i} 
                            className={`p-3.5 border rounded-xl space-y-1 ${
                              item.severity === 'high' 
                                ? 'bg-rose-950/[0.06] border-rose-500/15' 
                                : 'bg-amber-950/[0.04] border-amber-500/10'
                            }`}
                          >
                            <p className="text-xs font-black text-slate-100 flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${item.severity === 'high' ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'}`} />
                              {item.text}
                            </p>
                            <p className="text-[11px] text-slate-400 leading-relaxed">{item.sub}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* OWNER RECOMMENDATIONS */}
                <div className="p-5 rounded-3xl border border-white/5 bg-slate-950/50 space-y-3">
                  <h3 className="text-xs font-black uppercase text-indigo-400 tracking-wider font-mono flex items-center gap-2">
                    <ICONS.Settings size={14} className="animate-spin" style={{ animationDuration: '6s' }} />
                    Рекомендации для руководства
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {metrics.diagnostics.recommendations.map((rec, i) => (
                      <div key={i} className="p-3 bg-slate-900/60 rounded-xl border border-white/[0.02] flex items-start gap-2.5">
                        <span className="text-indigo-400 mt-0.5 text-xs font-bold">●</span>
                        <p className="text-xs text-slate-300 leading-relaxed">{rec}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: MODELS & PLANS */}
            {activeTab === 'models' && (
              <div className="space-y-6">
                {/* SEARCH FILTER */}
                <div className="flex gap-4">
                  <div className="relative flex-1">
                    <ICONS.Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input 
                      type="text" 
                      placeholder="Поиск модели..." 
                      className="bg-slate-950/60 border border-white/5 rounded-xl pl-9.5 pr-4 py-2 text-xs text-white outline-none focus:border-indigo-500/40 w-full placeholder-slate-600 transition-colors"
                      value={modelFilterSearch}
                      onChange={e => setModelFilterSearch(e.target.value)}
                    />
                  </div>
                </div>

                {/* MODELS GRID */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredModelMetrics.map(model => (
                    <div 
                      key={model.name} 
                      onClick={() => setSelectedModel(model.name === selectedModel ? null : model.name)}
                      className={`p-4 rounded-2xl border transition-all duration-300 cursor-pointer relative overflow-hidden group ${
                        model.name === selectedModel
                          ? 'border-indigo-500 bg-indigo-950/15 shadow-indigo-950/50 shadow-xl'
                          : model.status === 'bad' ? 'bg-rose-950/[0.04] border-rose-500/10 hover:border-rose-500/30' : 
                            model.status === 'warning' ? 'bg-amber-950/[0.03] border-amber-500/10 hover:border-amber-500/30' : 
                            'bg-slate-950/45 border-white/[0.03] hover:border-white/10'
                      }`}
                    >
                      <div className="absolute top-0 right-0 w-20 h-20 bg-white/[0.01] rounded-full blur-xl pointer-events-none transition-all group-hover:scale-125" />
                      
                      <div className="flex justify-between items-start mb-3">
                        <div className="min-w-0">
                          <h4 className="text-base font-black text-white truncate flex items-center gap-1.5">
                            {model.name}
                            {!model.isActive && (
                              <span className="text-[7.5px] font-mono font-bold bg-slate-800 text-slate-500 px-1 py-0.5 rounded uppercase">Inact</span>
                            )}
                          </h4>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[8px] font-mono font-bold text-slate-500 uppercase tracking-widest block">OF Target Plan</span>
                            {model.growth !== 0 && (
                              <span className={`text-[7.5px] font-mono font-bold px-1 py-0.2 rounded ${
                                model.growth > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                              }`}>
                                {model.growth > 0 ? '↑' : ''}{model.growth.toFixed(0)}%
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[8.5px] font-bold text-slate-500 uppercase block font-mono">Прогноз</span>
                          <span className={`text-xs font-black font-mono ${
                            model.status === 'good' ? 'text-emerald-400' : 
                            model.status === 'warning' ? 'text-amber-400' : 'text-rose-400'
                          }`}>
                            ${model.forecast.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2 mt-4">
                        <div className="flex justify-between text-[9px] font-mono font-bold uppercase tracking-wider">
                          <span className="text-slate-400">Сборы OF: ${model.totalOnlyFans.toLocaleString()}</span>
                          <span className="text-slate-200">{model.progress.toFixed(0)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden p-[0.5px]">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              model.status === 'good' ? 'bg-emerald-500' : 
                              model.status === 'warning' ? 'bg-amber-500' : 'bg-rose-500'
                            }`} 
                            style={{ width: `${Math.min(100, model.progress)}%` }} 
                          />
                        </div>
                        <div className="flex justify-between text-[8px] font-mono text-slate-500">
                          <span>Цель: ${model.goal.toLocaleString()}</span>
                          <span>Осталось: ${Math.max(0, model.goal - model.totalOnlyFans).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* SELECTED MODEL DETAILS VIEW */}
                <AnimatePresence>
                  {selectedModelData && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden mt-6"
                    >
                      <div className="p-6 rounded-[2rem] border border-indigo-500/20 bg-indigo-950/[0.08] relative overflow-hidden space-y-6">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[9px] font-mono font-bold text-indigo-400 uppercase tracking-widest block">Подробный разбор</span>
                            <h3 className="text-xl font-black text-white mt-1 uppercase tracking-tight">{selectedModelData.name}</h3>
                          </div>
                          <button 
                            onClick={() => setSelectedModel(null)}
                            className="p-1.5 bg-white/5 hover:bg-white/10 rounded-full transition-all"
                          >
                            <ICONS.Close size={14} className="text-slate-400" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <MiniStat label="OF Gross" value={`$${selectedModelData.totalOnlyFans.toLocaleString()}`} color="indigo" />
                          <MiniStat label="Общий Сбор" value={`$${selectedModelData.total.toLocaleString()}`} color="emerald" />
                          <MiniStat label="OF Прогноз" value={`$${selectedModelData.forecast.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} color="amber" />
                          <MiniStat label="Лучший День" value={`$${selectedModelData.bestDay.value.toLocaleString()}`} subValue={metrics.formatDate(selectedModelData.bestDay.date)} color="pink" />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                          {/* LINE CHART */}
                          <div className="space-y-2 bg-slate-950/40 p-4 rounded-2xl border border-white/[0.02]">
                            <h4 className="text-[10px] font-mono font-black uppercase text-slate-400 tracking-wider">График дохода OnlyFans по дням</h4>
                            <div className="h-[200px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={selectedModelData.daily}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff04" vertical={false} />
                                  <XAxis 
                                    dataKey="date" 
                                    stroke="#475569" 
                                    fontSize={8} 
                                    tickFormatter={(str) => new Date(str).toLocaleDateString('ru-RU', { day: 'numeric' })}
                                  />
                                  <YAxis stroke="#475569" fontSize={8} />
                                  <Tooltip 
                                    contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '12px' }}
                                    labelFormatter={(lbl) => metrics.formatDate(lbl as string)}
                                  />
                                  <Line type="monotone" dataKey="value" stroke={METRICS_COLORS.indigo} strokeWidth={2} dot={false} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          {/* OPERATORS WORKED */}
                          <div className="space-y-2 bg-slate-950/40 p-4 rounded-2xl border border-white/[0.02] flex flex-col justify-between">
                            <h4 className="text-[10px] font-mono font-black uppercase text-slate-400 tracking-wider mb-2">Операторы, работавшие на модели</h4>
                            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                              {Object.entries(selectedModelData.operators).length === 0 ? (
                                <p className="text-xs text-slate-500 italic">Нет зарегистрированных смен за период.</p>
                              ) : (
                                Object.entries(selectedModelData.operators).sort((a,b) => b[1] - a[1]).map(([opName, opTotal]) => (
                                  <div key={opName} className="p-2.5 bg-slate-950/60 rounded-xl border border-white/[0.02] flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-300">{opName}</span>
                                    <span className="text-xs font-mono font-black text-emerald-400">${opTotal.toLocaleString()}</span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* TAB: OPERATORS */}
            {activeTab === 'operators' && (
              <div className="space-y-6">
                {/* SEARCH OPERATOR */}
                <div className="flex gap-4">
                  <div className="relative flex-1">
                    <ICONS.Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input 
                      type="text" 
                      placeholder="Поиск оператора..." 
                      className="bg-slate-950/60 border border-white/5 rounded-xl pl-9.5 pr-4 py-2 text-xs text-white outline-none focus:border-indigo-500/40 w-full placeholder-slate-600 transition-colors"
                      value={opFilterSearch}
                      onChange={e => setOpFilterSearch(e.target.value)}
                    />
                  </div>
                </div>

                {/* RANKINGS GRID */}
                <div className="glass-card p-5 rounded-3xl border border-white/5 bg-slate-950/45 space-y-4">
                  <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider font-mono flex items-center gap-2">
                    <ICONS.Reports size={14} className="text-sky-400" />
                    Рейтинг эффективности операторов периода
                  </h3>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/5">
                          <th className="py-3 text-[10px] uppercase text-slate-500 font-black tracking-widest font-mono">Ранг & Имя</th>
                          <th className="py-3 text-[10px] uppercase text-slate-500 font-black tracking-widest font-mono text-center">Дней</th>
                          <th className="py-3 text-[10px] uppercase text-slate-500 font-black tracking-widest font-mono text-center">OF Доля %</th>
                          <th className="py-3 text-[10px] uppercase text-slate-500 font-black tracking-widest font-mono text-center">Индекс Стабильности</th>
                          <th className="py-3 text-[10px] uppercase text-slate-500 font-black tracking-widest font-mono text-right">Ср. за смену</th>
                          <th className="py-3 text-[10px] uppercase text-slate-500 font-black tracking-widest font-mono text-right">Всего за период</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOperators.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center py-8 text-xs text-slate-500 italic">Операторы не найдены</td>
                          </tr>
                        ) : (
                          filteredOperators.map((op, idx) => {
                            let stabilityColor = 'bg-rose-500/10 text-rose-400 border-rose-500/10';
                            if (op.consistencyIndex >= 70) stabilityColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15';
                            else if (op.consistencyIndex >= 40) stabilityColor = 'bg-amber-500/10 text-amber-400 border-amber-500/15';

                            return (
                              <tr key={op.name} className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors">
                                <td className="py-3.5">
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs font-black text-slate-600 font-mono w-4">{idx + 1}</span>
                                    <span className="font-extrabold text-white text-xs">{op.name}</span>
                                  </div>
                                </td>
                                <td className="py-3.5 text-center font-mono text-slate-400 text-xs">{op.daysWorked}</td>
                                <td className="py-3.5 text-center font-mono text-slate-400 text-xs">{op.onlyFansShare.toFixed(0)}%</td>
                                <td className="py-3.5 text-center">
                                  <span className={`text-[9px] font-mono font-black border uppercase px-1.5 py-0.5 rounded-md ${stabilityColor}`}>
                                    {op.consistencyIndex.toFixed(0)}%
                                  </span>
                                </td>
                                <td className="py-3.5 text-right font-mono text-slate-300 text-xs">${op.avgPerShift.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                <td className="py-3.5 text-right font-mono text-emerald-400 font-black text-xs">${op.total.toLocaleString()}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: CALENDAR & DAYS */}
            {activeTab === 'calendar' && (
              <div className="space-y-6">
                {/* DAY OF WEEK UNBIASED AVERAGES */}
                <div className="glass-card p-5 rounded-3xl border border-white/5 bg-slate-950/45 space-y-4">
                  <div>
                    <h3 className="text-xs font-black uppercase text-slate-300 tracking-wider font-mono flex items-center gap-2">
                      <ICONS.Calendar size={14} className="text-amber-400" />
                      Анализ Дней Недели (Математическое Среднее)
                    </h3>
                    <p className="text-[10px] text-slate-500 uppercase font-mono mt-0.5">Убирает погрешность лишних дней в месяце</p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
                    {metrics.dowAverages.map((day) => (
                      <div key={day.dow} className="p-3.5 bg-slate-950/60 rounded-xl border border-white/[0.02] flex flex-col items-center space-y-1 hover:border-white/5 transition-all text-center">
                        <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">{day.name.slice(0, 3)}</span>
                        <span className="text-sm font-black text-white font-mono">${day.average.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        <span className="text-[8px] font-mono text-slate-600 uppercase">Смен: {day.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* MONTH HEATMAP BOARD */}
                <div className="glass-card p-5 rounded-3xl border border-white/5 bg-slate-950/45 space-y-4">
                  <div>
                    <h3 className="text-xs font-black uppercase text-slate-300 tracking-wider font-mono flex items-center gap-2">
                      <ICONS.Dashboard size={14} className="text-violet-400" />
                      Тепловая Карта Дней Периода
                    </h3>
                    <p className="text-[10px] text-slate-500 uppercase font-mono mt-0.5">Визуальное сопоставление выручки со среднедневным сбором (${metrics.avgDailyRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}/день)</p>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-10 gap-2.5">
                    {metrics.dailyEntries.map(day => {
                      const dateParts = day.date.split('-');
                      const dayNum = dateParts.length === 3 ? parseInt(dateParts[2], 10) : 0;
                      
                      let colorClass = 'bg-slate-900/60 border-white/[0.02] text-slate-500';
                      let label = 'Пропущен';
                      
                      if (day.value > 0) {
                        if (day.value >= metrics.avgDailyRevenue * 1.15) {
                          colorClass = 'bg-emerald-950/30 border-emerald-500/20 text-emerald-400 shadow-md shadow-emerald-950/20';
                          label = 'Выше нормы';
                        } else if (day.value >= metrics.avgDailyRevenue * 0.8) {
                          colorClass = 'bg-indigo-950/20 border-indigo-500/15 text-indigo-400';
                          label = 'В норме';
                        } else {
                          colorClass = 'bg-rose-950/30 border-rose-500/15 text-rose-400';
                          label = 'Ниже нормы';
                        }
                      }

                      return (
                        <div 
                          key={day.date} 
                          className={`p-3 rounded-xl border flex flex-col items-center justify-between min-h-[65px] transition-all relative group overflow-hidden ${colorClass}`}
                          title={`${metrics.formatDate(day.date)}: $${day.value.toLocaleString()}`}
                        >
                          <span className="text-[9px] font-mono font-bold uppercase text-slate-500/80 self-start">{dayNum}</span>
                          <span className="text-xs font-black font-mono self-end">${day.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                          
                          {/* Micro hover metadata tooltip pop */}
                          <div className="absolute inset-0 bg-black/95 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center p-1 text-[8.5px] transition-opacity duration-200 pointer-events-none text-center font-mono uppercase font-black tracking-wider leading-tight">
                            <span>{label}</span>
                            <span className="text-[7.5px] font-bold text-slate-500 mt-0.5">{day.date}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'onlymonster' && (
              <OnlyMonsterTab agencyModels={state.models || []} userRole={userRole} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

// MINI HELPERS
function StatBox({ label, value, subValue, color }: { label: string; value: string; subValue?: string; color: string }) {
  const colors: Record<string, string> = {
    indigo: 'text-indigo-400 border-indigo-500/10 bg-indigo-500/[0.02]',
    emerald: 'text-emerald-400 border-emerald-500/10 bg-emerald-500/[0.02]',
    red: 'text-rose-400 border-rose-500/10 bg-rose-500/[0.02]',
    amber: 'text-amber-400 border-amber-500/10 bg-amber-500/[0.02]',
    pink: 'text-pink-400 border-pink-500/10 bg-pink-500/[0.02]'
  };
  return (
    <div className={`p-4 rounded-2xl border ${colors[color] || 'bg-slate-900/40 border-slate-800'} transition-all`}>
      <p className="text-[9px] uppercase text-slate-500 font-black tracking-widest mb-1.5 font-mono">{label}</p>
      <p className={`text-xl font-black font-mono ${colors[color]?.split(' ')[0] || 'text-white'}`}>{value}</p>
      {subValue && <p className="text-[9px] font-bold text-slate-500 mt-1 uppercase font-mono">{subValue}</p>}
    </div>
  );
}

function MiniStat({ label, value, subValue, color }: { label: string; value: string; subValue?: string; color: string }) {
  const colors: Record<string, string> = {
    indigo: 'text-indigo-400',
    emerald: 'text-emerald-400',
    pink: 'text-pink-400',
    amber: 'text-amber-400'
  };
  return (
    <div className="p-3 bg-slate-950/70 border border-white/[0.02] rounded-xl">
      <span className="text-[8px] font-mono font-bold text-slate-500 uppercase tracking-wider block">{label}</span>
      <span className={`text-sm font-black font-mono block mt-0.5 ${colors[color] || 'text-white'}`}>{value}</span>
      {subValue && <span className="text-[8px] font-bold text-slate-500 block mt-0.5 truncate uppercase font-mono">{subValue}</span>}
    </div>
  );
}

export default Metrics;
