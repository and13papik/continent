
import React, { useState, useMemo } from 'react';
import { AppState, IncomeRecord } from '../types';
import { ICONS } from '../constants';
import { findPeriodIdByDate } from '../store';

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
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [modelData, setModelData] = useState<Record<string, ModelEntry>>({});
  
  const [baselinePercents, setBaselinePercents] = useState({ of: '20', pp: '17', cr: '20' });

  const activePeriod = state.accountingPeriods.find(p => p.id === state.selectedPeriodId)!;
  const currentOperators = activePeriod.operators || state.operators;
  const currentModels = activePeriod.models || state.models;

  // Проверка: соответствует ли дата выбранному месяцу?
  const isPeriodMismatch = useMemo(() => {
    if (!date || !activePeriod) return false;
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
            return; // Прерываем сохранение, чтобы пользователь мог проверить данные в новом периоде
          }
        }

        if (!confirm(`ВНИМАНИЕ: Выбранная дата (${date}) не совпадает с текущим периодом (${activePeriod.label}). Записать доход в ${activePeriod.label}?`)) return;
    }

    const targetPeriodId = findPeriodIdByDate(date, state.accountingPeriods) || state.selectedPeriodId;

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
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-outfit text-white">Добавить доход</h1>
          <p className="text-slate-400">Внесение данных за период: <span className="text-indigo-400 font-bold">{activePeriod.label}</span></p>
        </div>
        {activePeriod.status === 'closed' && (
           <div className="bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-xl flex items-center gap-3 text-amber-500">
              <ICONS.Lock size={18} />
              <span className="text-xs font-black uppercase tracking-widest">Режим корректировки истории</span>
           </div>
        )}
      </header>

      {isPeriodMismatch && (
          <div className="bg-rose-600/20 border border-rose-500/40 p-4 rounded-2xl flex items-center gap-3 text-rose-400 animate-in slide-in-from-top-2">
             <ICONS.AlertTriangle size={20} />
             <p className="text-xs font-bold uppercase tracking-tight">Внимание: Выбранная дата не относится к {activePeriod.label}!</p>
          </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-6">
          <div className="glass-card p-6 rounded-3xl space-y-4">
            <h2 className="text-lg font-bold font-outfit flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">1</span>
              Основные данные
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Оператор</label>
                <select className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500" value={operator} onChange={(e) => setOperator(e.target.value)}>
                  <option value="">Выберите оператора</option>
                  {currentOperators.map(op => <option key={op} value={op}>{op}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Дата</label>
                <input 
                  type="date" 
                  className={`w-full bg-slate-900 border rounded-2xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${isPeriodMismatch ? 'border-rose-500 bg-rose-500/5' : 'border-slate-700'}`} 
                  value={date} 
                  onChange={(e) => setDate(e.target.value)} 
                />
              </div>
            </div>
          </div>

          <div className="glass-card p-6 rounded-3xl space-y-4">
            <h2 className="text-lg font-bold font-outfit flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">2</span>
              Выберите анкеты
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {currentModels.map(m => (
                <button key={m} onClick={() => toggleModel(m)} className={`px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-tighter transition-all border ${selectedModels.includes(m) ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20' : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:border-slate-700'}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          {selectedModels.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold font-outfit flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">3</span>
                Доход и ставки
              </h2>
              <div className="grid grid-cols-1 gap-4">
                {selectedModels.map(m => (
                  <div key={m} className="glass-card p-6 rounded-3xl space-y-4 animate-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <h3 className="font-black text-white text-lg font-outfit uppercase tracking-widest">{m}</h3>
                      <button onClick={() => toggleModel(m)} className="text-slate-500 hover:text-rose-400 p-2 rounded-xl hover:bg-rose-500/10 transition-all"><ICONS.Trash size={18} /></button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Доход ($)</h4>
                        <div className="grid grid-cols-3 gap-3">
                          <IncomeField label="OF" value={modelData[m]?.of || ''} color="blue" onChange={v => handleInputChange(m, 'of', v)} />
                          <IncomeField label="PP" value={modelData[m]?.pp || ''} color="sky" onChange={v => handleInputChange(m, 'pp', v)} />
                          <IncomeField label="CR" value={modelData[m]?.cr || ''} color="emerald" onChange={v => handleInputChange(m, 'cr', v)} />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ставки (%)</h4>
                        <div className="grid grid-cols-3 gap-3">
                          <RateField label="OF %" value={modelData[m]?.pOF || ''} color="blue" onChange={v => handleInputChange(m, 'pOF', v)} />
                          <RateField label="PP %" value={modelData[m]?.pPP || ''} color="sky" onChange={v => handleInputChange(m, 'pPP', v)} />
                          <RateField label="CR %" value={modelData[m]?.pCR || ''} color="emerald" onChange={v => handleInputChange(m, 'pCR', v)} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="glass-card p-6 rounded-3xl space-y-6 sticky top-8 border-indigo-500/20 shadow-2xl">
            <h2 className="text-lg font-bold font-outfit">Базовые ставки</h2>
            <div className="space-y-4">
              <GlobalRateInput label="OnlyFans %" value={baselinePercents.of} onChange={v => setBaselinePercents(p => ({...p, of: v}))} />
              <GlobalRateInput label="PayPal %" value={baselinePercents.pp} onChange={v => setBaselinePercents(p => ({...p, pp: v}))} />
              <GlobalRateInput label="Crypto %" value={baselinePercents.cr} onChange={v => setBaselinePercents(p => ({...p, cr: v}))} />
            </div>

            <hr className="border-slate-800" />
            
            <button 
              onClick={handleSubmit}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-5 rounded-2xl shadow-xl shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 group active:scale-95"
            >
              <ICONS.Plus size={20} className="group-hover:rotate-90 transition-transform" />
              Подтвердить доход
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const IncomeField = ({ label, value, onChange, color }: { label: string, value: string, onChange: (v: string) => void, color: string }) => (
  <div className="space-y-1">
    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">{label}</label>
    <input type="number" placeholder="0" className={`w-full bg-slate-900/50 border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono text-white focus:ring-1 focus:ring-${color}-500 outline-none`} value={value} onChange={e => onChange(e.target.value)} />
  </div>
);

const RateField = ({ label, value, onChange, color }: { label: string, value: string, onChange: (v: string) => void, color: string }) => (
  <div className="space-y-1">
    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">{label}</label>
    <input type="number" className={`w-full bg-${color}-500/5 border border-${color}-500/20 rounded-xl px-3 py-2 text-sm font-mono text-${color}-400 outline-none`} value={value} onChange={e => onChange(e.target.value)} />
  </div>
);

const GlobalRateInput = ({ label, value, onChange }: { label: string, value: string, onChange: (v: string) => void }) => (
  <div className="space-y-1">
    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{label}</label>
    <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 font-mono text-indigo-400 font-bold outline-none focus:ring-2 focus:ring-indigo-500" value={value} onChange={e => onChange(e.target.value)} />
  </div>
);

export default AddIncome;
