
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppState, IncomeRecord } from '../types';
import { ICONS } from '../constants';
import { findPeriodIdByDate, parseYearMonth } from '../store';
import PeriodBadge from '../components/PeriodBadge';

interface AddIncomeProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

interface ModelEntry {
  of: string;
  pp: string;
  cr: string;
  pOF: string;
  pPP: string;
  pCR: string;
}

const AddIncome: React.FC<AddIncomeProps> = ({ state, updateState }) => {
  const [operator, setOperator] = useState('');
  const [date, setDate] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [modelData, setModelData] = useState<Record<string, ModelEntry>>({});
  
  const [baselinePercents, setBaselinePercents] = useState({ of: '20', pp: '17', cr: '20' });

  const activePeriod = state.accountingPeriods.find(p => p.id === state.selectedPeriodId);
  
  if (!activePeriod) {
    return (
      <div className="p-8 text-center bg-slate-900/50 rounded-3xl border border-white/5">
        <ICONS.AlertTriangle size={48} className="mx-auto mb-4 text-amber-500" />
        <h2 className="text-xl font-bold text-white mb-2 font-outfit uppercase">Период не найден</h2>
        <p className="text-slate-400 text-sm">Пожалуйста, выберите активный период в боковом меню.</p>
      </div>
    );
  }

  const currentOperators = activePeriod.operators || state.operators;
  const currentModels = activePeriod.models || state.models;

  const isPeriodMismatch = useMemo(() => {
    if (!date || !activePeriod) return false;
    const parsedInput = parseYearMonth(date);
    if (!parsedInput) return false;
    const pDate = new Date(activePeriod.startAt);
    const matchUTC = pDate.getUTCFullYear() === parsedInput.year && pDate.getUTCMonth() === parsedInput.month;
    if (matchUTC) return false;
    const periodIdForDate = findPeriodIdByDate(date, state.accountingPeriods);
    return periodIdForDate !== activePeriod.id;
  }, [date, activePeriod, state.accountingPeriods]);

  const toggleModel = (m: string) => {
    setSelectedModels(prev => {
      if (prev.includes(m)) {
        return prev.filter(x => x !== m);
      } else {
        if (!modelData[m]) {
          setModelData(old => ({
            ...old,
            [m]: { 
              of: '', pp: '', cr: '', 
              pOF: baselinePercents.of, 
              pPP: baselinePercents.pp, 
              pCR: baselinePercents.cr 
            }
          }));
        }
        return [...prev, m];
      }
    });
  };

  const handleInputChange = (model: string, field: keyof ModelEntry, value: string) => {
    setModelData(prev => ({
      ...prev,
      [model]: { ...prev[model], [field]: value }
    }));
  };

  const totals = useMemo(() => {
    let gross = 0;
    let net = 0;
    selectedModels.forEach(m => {
      const data = modelData[m];
      if (!data) return;
      const of = parseFloat(data.of) || 0;
      const pp = parseFloat(data.pp) || 0;
      const cr = parseFloat(data.cr) || 0;
      gross += of + pp + cr;
      net += (of * (parseFloat(data.pOF) || 0) / 100) + 
             (pp * (parseFloat(data.pPP) || 0) / 100) + 
             (cr * (parseFloat(data.pCR) || 0) / 100);
    });
    return { gross, net };
  }, [selectedModels, modelData]);

  const handleSubmit = () => {
    if (!operator || !date || selectedModels.length === 0) {
      alert('Заполните все данные');
      return;
    }

    if (isPeriodMismatch) {
        const existingPeriodId = findPeriodIdByDate(date, state.accountingPeriods);
        const existingPeriod = state.accountingPeriods.find(p => p.id === existingPeriodId);
        if (existingPeriod && existingPeriod.id !== state.selectedPeriodId) {
          if (confirm(`ВНИМАНИЕ: Выбранная дата (${date}) относится к периоду "${existingPeriod.label}", но сейчас выбран "${activePeriod.label}". Переключиться на "${existingPeriod.label}" перед сохранением?`)) {
            updateState(prev => ({ ...prev, selectedPeriodId: existingPeriod.id }));
            return;
          }
        }
        if (!confirm(`ВНИМАНИЕ: Выбранная дата (${date}) не совпадает с текущим периодом (${activePeriod.label}). Записать доход в ${activePeriod.label}?`)) return;
    }

    const parsedInput = parseYearMonth(date);
    const pDate = new Date(activePeriod.startAt);
    const isActiveMatch = parsedInput && (
      pDate.getUTCFullYear() === parsedInput.year && pDate.getUTCMonth() === parsedInput.month
    );
    const targetPeriodId = isActiveMatch ? state.selectedPeriodId : (findPeriodIdByDate(date, state.accountingPeriods) || state.selectedPeriodId);

    const newRecords: IncomeRecord[] = [];
    selectedModels.forEach(m => {
      const data = modelData[m];
      const of = parseFloat(data.of) || 0;
      const pp = parseFloat(data.pp) || 0;
      const cr = parseFloat(data.cr) || 0;
      if (of + pp + cr > 0) {
        const pOF = parseFloat(data.pOF) || 0;
        const pPP = parseFloat(data.pPP) || 0;
        const pCR = parseFloat(data.pCR) || 0;
        newRecords.push({
          id: String(Date.now() + Math.random()),
          date,
          createdAt: new Date().toISOString(),
          periodId: targetPeriodId,
          operator,
          model: m,
          onlyFans: of,
          paypal: pp,
          crypto: cr,
          percentOF: pOF,
          percentPP: pPP,
          percentCrypto: pCR,
          total: of + pp + cr,
          nettoOF: of * (pOF / 100),
          nettoPP: pp * (pPP / 100),
          nettoCrypto: cr * (pCR / 100)
        });
      }
    });

    if (newRecords.length === 0) {
      alert('Введите доход');
      return;
    }

    updateState(prev => ({
      ...prev,
      incomeData: [...prev.incomeData, ...newRecords]
    }));

    setSelectedModels([]);
    setModelData({});
    alert('Доход добавлен успешно!');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-black font-outfit text-white uppercase tracking-tighter flex items-center gap-4">
             <div className="w-12 h-12 bg-indigo-600 rounded-[1.25rem] flex items-center justify-center shadow-2xl shadow-indigo-500/20">
                <ICONS.Plus size={24} />
             </div>
             Добавить доход
          </h1>
          <div className="flex items-center gap-3">
             <PeriodBadge state={state} />
             <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Внесение данных за период: <span className="text-indigo-400">{activePeriod.label}</span></p>
          </div>
        </div>
        
        {activePeriod.status === 'closed' && (
           <div className="bg-amber-500/10 border border-amber-500/20 px-5 py-2.5 rounded-2xl flex items-center gap-3 text-amber-500 animate-pulse">
              <ICONS.Lock size={18} />
              <span className="text-[10px] font-black uppercase tracking-widest">Adjustment Mode</span>
           </div>
        )}
      </header>

      {isPeriodMismatch && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-rose-500/10 border border-rose-500/30 p-5 rounded-[2rem] flex items-center gap-4 text-rose-400 overflow-hidden shadow-2xl shadow-rose-950/20"
          >
             <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center shrink-0">
                <ICONS.AlertTriangle size={20} />
             </div>
             <div>
                <p className="text-[10px] font-black uppercase tracking-widest">Warning: Period Mismatch</p>
                <p className="text-xs font-medium text-rose-300 mt-0.5">Выбранная дата ({date}) не совпадает с активным периодом!</p>
             </div>
          </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: SELECTION */}
        <div className="lg:col-span-8 space-y-8">
          <section className="glass-card p-8 rounded-[2.5rem] border-white/5 space-y-8 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-[0.02] pointer-events-none group-hover:opacity-[0.05] transition-opacity">
               <ICONS.User size={160} />
            </div>
            
            <div className="relative z-10 space-y-6">
               <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-xs font-black">01</div>
                  <h2 className="text-sm font-black font-outfit uppercase tracking-widest text-white">Субъект и время</h2>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Оператор</label>
                   <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-2">
                      {currentOperators.map(op => (
                        <button 
                          key={op} 
                          onClick={() => setOperator(op)}
                          className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${operator === op ? 'bg-indigo-600 border-indigo-500 text-white shadow-xl shadow-indigo-600/20 scale-[1.02]' : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'}`}
                        >
                          {op}
                        </button>
                      ))}
                   </div>
                 </div>
                 
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Календарная дата</label>
                   <input 
                     type="date" 
                     className={`w-full bg-slate-900/50 border rounded-2xl px-6 py-4 text-white font-mono text-lg outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${isPeriodMismatch ? 'border-rose-500 bg-rose-500/5 shadow-[0_0_20px_-10px_rgba(244,63,94,0.3)]' : 'border-slate-800'}`} 
                     value={date} 
                     onChange={(e) => setDate(e.target.value)} 
                   />
                 </div>
               </div>
            </div>
          </section>

          <section className="glass-card p-8 rounded-[2.5rem] border-white/5 space-y-8 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-[0.02] pointer-events-none group-hover:opacity-[0.05] transition-opacity">
               <ICONS.Models size={160} />
            </div>
            
            <div className="relative z-10 space-y-6">
               <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-xs font-black">02</div>
                  <h2 className="text-sm font-black font-outfit uppercase tracking-widest text-white">Список анкет</h2>
               </div>
               
               <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                 {currentModels.map(m => (
                   <button 
                     key={m} 
                     onClick={() => toggleModel(m)} 
                     className={`px-4 py-4 rounded-2xl text-[10px] font-black uppercase tracking-tighter transition-all border ${selectedModels.includes(m) ? 'bg-indigo-600 border-indigo-500 text-white shadow-xl shadow-indigo-600/20 scale-[1.02]' : 'bg-slate-900/40 border-slate-800 text-slate-600 hover:border-slate-700 hover:text-slate-400'}`}
                   >
                     {m}
                   </button>
                 ))}
               </div>
            </div>
          </section>

          <AnimatePresence mode="popLayout">
            {selectedModels.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3 ml-4">
                   <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-xs font-black">03</div>
                   <h2 className="text-sm font-black font-outfit uppercase tracking-widest text-white">Финансовые показатели</h2>
                </div>
                
                <div className="grid grid-cols-1 gap-6">
                  {selectedModels.map((m, idx) => (
                    <motion.div 
                      key={m}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="glass-card p-8 rounded-[2.5rem] space-y-6 shadow-2xl relative overflow-hidden group"
                    >
                      <div className="flex items-center justify-between border-b border-white/5 pb-5">
                         <div className="flex flex-col">
                            <h3 className="font-black text-white text-xl font-outfit uppercase tracking-[0.2em]">{m}</h3>
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">Personnel Model Instance</span>
                         </div>
                         <button 
                           onClick={() => toggleModel(m)} 
                           className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center group/btn"
                         >
                            <ICONS.Trash size={18} className="group-hover/btn:rotate-12 transition-transform" />
                         </button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="space-y-4">
                          <h4 className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em]">Кассовый доход ($)</h4>
                          <div className="grid grid-cols-3 gap-4">
                             <IncomeField label="OF" value={modelData[m]?.of || ''} color="indigo" onChange={v => handleInputChange(m, 'of', v)} />
                             <IncomeField label="PP" value={modelData[m]?.pp || ''} color="sky" onChange={v => handleInputChange(m, 'pp', v)} />
                             <IncomeField label="CR" value={modelData[m]?.cr || ''} color="emerald" onChange={v => handleInputChange(m, 'cr', v)} />
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h4 className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em]">Тарифная ставка (%)</h4>
                          <div className="grid grid-cols-3 gap-4">
                             <RateField label="OF %" value={modelData[m]?.pOF || ''} color="indigo" onChange={v => handleInputChange(m, 'pOF', v)} />
                             <RateField label="PP %" value={modelData[m]?.pPP || ''} color="sky" onChange={v => handleInputChange(m, 'pPP', v)} />
                             <RateField label="CR %" value={modelData[m]?.pCR || ''} color="emerald" onChange={v => handleInputChange(m, 'pCR', v)} />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT COLUMN: SUMMARY */}
        <div className="lg:col-span-4 sticky top-8 space-y-6">
          <section className="glass-card p-8 rounded-[2.5rem] border-indigo-500/20 space-y-8 shadow-2xl relative overflow-hidden bg-gradient-to-br from-indigo-500/[0.03] to-transparent">
            <h2 className="text-xl font-black font-outfit uppercase tracking-tight text-white mb-6">Сводка данных</h2>
            
            <div className="space-y-6">
               <div className="p-6 bg-slate-950/60 rounded-[2rem] border border-white/5 space-y-3">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Общий Грязный Вал</span>
                  <div className="flex items-baseline gap-2">
                     <span className="text-3xl font-black font-mono text-white tracking-tighter">${totals.gross.toLocaleString(undefined, { minimumFractionDigits: 1 })}</span>
                     <span className="text-[10px] font-bold text-slate-700">USD</span>
                  </div>
               </div>

               <div className="p-6 bg-emerald-500/[0.03] rounded-[2rem] border border-emerald-500/20 shadow-[0_10px_40px_-20px_rgba(16,185,129,0.3)] space-y-3">
                  <span className="text-[9px] font-black text-emerald-500/70 uppercase tracking-widest">Ваша Чистая Доля</span>
                  <div className="flex items-baseline gap-2">
                     <span className="text-3xl font-black font-mono text-emerald-400 tracking-tighter">${totals.net.toLocaleString(undefined, { minimumFractionDigits: 1 })}</span>
                     <span className="text-[10px] font-bold text-emerald-900/60 font-mono">NETTO</span>
                  </div>
               </div>
            </div>

            <div className="pt-4 space-y-2">
               <div className="flex justify-between items-center px-4">
                  <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Анкет в чеке:</span>
                  <span className="text-[10px] font-black text-white font-mono">{selectedModels.length}</span>
               </div>
               <div className="w-full h-[1px] bg-white/5" />
            </div>

            <button 
              onClick={handleSubmit}
              disabled={!operator || selectedModels.length === 0}
              className="w-full relative group overflow-hidden"
            >
              <motion.div
                whileHover={{ y: -2, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="bg-gradient-to-br from-indigo-500 via-indigo-600 to-blue-700 p-6 rounded-[2rem] shadow-[0_20px_50px_-10px_rgba(79,70,229,0.4)] flex items-center justify-center gap-4 transition-all"
              >
                {/* Internal Glow */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.2),transparent_70%)] pointer-events-none" />
                
                {/* Shine */}
                <motion.div 
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', repeatDelay: 1 }}
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -rotate-45 pointer-events-none"
                />

                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/10 shadow-inner">
                   <ICONS.Income size={20} className="text-white group-hover:scale-110 transition-transform" />
                </div>
                
                <div className="flex flex-col items-start">
                   <span className="text-white font-black text-xs uppercase tracking-[0.25em]">Подтвердить чек</span>
                   <span className="text-indigo-200 text-[8px] font-bold uppercase tracking-widest opacity-60">Execute Financial Protocol</span>
                </div>

                <ICONS.ArrowRight size={16} className="text-white/40 ml-2 group-hover:translate-x-1 transition-transform" />
              </motion.div>
            </button>
          </section>

          <section className="glass-card p-6 rounded-[2rem] border-white/5 space-y-6 shadow-xl opacity-60 hover:opacity-100 transition-opacity">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">Настройка тарифов</h3>
            <div className="space-y-4">
              <GlobalRateInput label="Rate OnlyFans %" value={baselinePercents.of} onChange={v => setBaselinePercents(p => ({...p, of: v}))} />
              <GlobalRateInput label="Rate PayPal %" value={baselinePercents.pp} onChange={v => setBaselinePercents(p => ({...p, pp: v}))} />
              <GlobalRateInput label="Rate Crypto %" value={baselinePercents.cr} onChange={v => setBaselinePercents(p => ({...p, cr: v}))} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

const IncomeField = ({ label, value, onChange, color }: { label: string, value: string, onChange: (v: string) => void, color: string }) => (
  <div className="space-y-1.5 group/field">
    <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest ml-1 group-focus-within/field:text-indigo-400 transition-colors">{label}</label>
    <div className="relative">
       <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-700">$</div>
       <input 
         type="number" 
         placeholder="0.0" 
         className={`w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-6 pr-3 py-3 text-xs font-mono text-white focus:border-indigo-500/50 focus:bg-slate-900 focus:outline-none transition-all`} 
         value={value} 
         onChange={e => onChange(e.target.value)} 
       />
    </div>
  </div>
);

const RateField = ({ label, value, onChange, color }: { label: string, value: string, onChange: (v: string) => void, color: string }) => (
  <div className="space-y-1.5 group/field">
    <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1 group-focus-within/field:text-indigo-400 transition-colors">{label}</label>
    <div className="relative">
       <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-indigo-900/60">%</div>
       <input 
         type="number" 
         className={`w-full bg-indigo-500/[0.03] border border-indigo-500/20 rounded-xl px-4 py-3 text-xs font-mono text-indigo-400 focus:border-indigo-500 focus:bg-indigo-500/10 focus:outline-none transition-all`} 
         value={value} 
         onChange={e => onChange(e.target.value)} 
       />
    </div>
  </div>
);

const GlobalRateInput = ({ label, value, onChange }: { label: string, value: string, onChange: (v: string) => void }) => (
  <div className="space-y-1.5">
    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">{label}</label>
    <input 
      type="number" 
      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 font-mono text-xs text-indigo-400 font-bold outline-none focus:border-slate-600 transition-all" 
      value={value} 
      onChange={e => onChange(e.target.value)} 
    />
  </div>
);

export default AddIncome;
