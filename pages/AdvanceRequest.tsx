
import React, { useState, useMemo } from 'react';
import { AppState, OperatorWallet } from '../types';
import { ICONS } from '../constants';

interface AdvanceRequestProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const AdvanceRequest: React.FC<AdvanceRequestProps> = ({ state, updateState }) => {
  const [selectedOperator, setSelectedOperator] = useState('');
  const [amount, setAmount] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'usdt_trc20' | 'card'>('usdt_trc20');
  const [isSending, setIsSending] = useState(false);
  const [step, setStep] = useState(1);

  const activePeriodId = state.selectedPeriodId;
  const activePeriod = state.accountingPeriods.find(p => p.id === activePeriodId);
  const operators = activePeriod?.operators || state.operators;

  const operatorStats = useMemo(() => {
    if (!selectedOperator) return null;
    
    const incomes = state.incomeData.filter(r => r.operator === selectedOperator && r.periodId === activePeriodId);
    const ops = state.operationsData.filter(o => o.operator === selectedOperator && o.periodId === activePeriodId && !o.model);
    
    const rawG = incomes.reduce((sum, r) => sum + r.total, 0);
    const rawN = incomes.reduce((sum, r) => sum + (r.nettoOF + r.nettoPP + r.nettoCrypto), 0);
    const opRefunds = state.operationsData.filter(o => o.type === 'refund' && o.operator === selectedOperator && o.periodId === activePeriodId).reduce((sum, o) => sum + o.amount, 0);
    const avgRate = rawG > 0 ? rawN / rawG : 0.20;
    
    const totalNet = rawN - (opRefunds * avgRate);
    const adjPlus = ops.filter(o => o.type === 'bonus').reduce((sum, o) => sum + o.amount, 0);
    const adjMinus = ops.filter(o => ['penalty', 'advance', 'salary_payment', 'internship'].includes(o.type)).reduce((sum, o) => sum + o.amount, 0);
    
    const remainder = totalNet + adjPlus - adjMinus;
    return { remainder };
  }, [selectedOperator, state.incomeData, state.operationsData, activePeriodId]);

  const existingWallet = useMemo(() => {
    return state.operatorWallets?.find(w => w.operator === selectedOperator);
  }, [selectedOperator, state.operatorWallets]);

  const handleSelectOperator = (op: string) => {
    setSelectedOperator(op);
    const wallet = state.operatorWallets?.find(w => w.operator === op);
    if (wallet) {
      setWalletAddress(wallet.address);
      setPaymentMethod(wallet.method);
    } else {
      setWalletAddress('');
    }
    setStep(1);
  };

  const sendToTelegram = async () => {
    if (!selectedOperator || !amount || !walletAddress) return;
    
    setIsSending(true);
    
    // Simulate Telegram message
    const message = `
🚀 *ЗАПРОС НА АВАНС*
--------------------------
👤 Оператор: @${selectedOperator}
💰 Размер аванса: $${amount}
📊 Текущий остаток ЗП: $${operatorStats?.remainder.toFixed(1)}
💳 Реквизиты (${paymentMethod === 'usdt_trc20' ? 'USDT TRC20 balance' : 'Карта'}):
\`${walletAddress}\`
--------------------------
⚠️ *Статус: Ожидает подтверждения*
    `.trim();

    console.log("Sending to TG:", message);

    // If there is an existing wallet, maybe update it if it's different?
    // User requested "confirm current wallet".
    if (!existingWallet || existingWallet.address !== walletAddress || existingWallet.method !== paymentMethod) {
       updateState(prev => {
         const wallets = prev.operatorWallets || [];
         const filtered = wallets.filter(w => w.operator !== selectedOperator);
         const newWallet: OperatorWallet = {
           id: `wallet-${selectedOperator}-${Date.now()}`,
           operator: selectedOperator,
           address: walletAddress,
           method: paymentMethod,
           updatedAt: new Date().toISOString()
         };
         return { ...prev, operatorWallets: [...filtered, newWallet] };
       });
    }

    setTimeout(() => {
      setIsSending(false);
      alert('Запрос на аванс успешно отправлен в Telegram!');
      setStep(1);
      setSelectedOperator('');
      setAmount('');
    }, 1500);
  };

  return (
    <div className="max-w-xl mx-auto space-y-8 animate-in fade-in zoom-in duration-500">
      <header className="text-center space-y-2">
        <div className="w-16 h-16 bg-amber-600/20 text-amber-500 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-amber-900/10 border border-amber-500/20">
          <ICONS.HandCoins size={32} />
        </div>
        <h1 className="text-3xl font-black text-white font-outfit uppercase tracking-tight">Запрос аванса</h1>
        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Система мгновенных уведомлений</p>
      </header>

      <div className="glass-card p-8 rounded-[2.5rem] border-slate-800 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
           <ICONS.HandCoins size={120} />
        </div>

        <div className="space-y-6 relative z-10">
          {/* Step 1: Select Operator */}
          <div className="space-y-3">
             <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Выбор оператора</label>
             <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {operators.map(op => (
                   <button 
                     key={op}
                     onClick={() => handleSelectOperator(op)}
                     className={`px-4 py-3 rounded-2xl text-xs font-bold transition-all border ${selectedOperator === op ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20' : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700'}`}
                   >
                     {op}
                   </button>
                ))}
             </div>
          </div>

          {selectedOperator && (
            <div className="animate-in slide-in-from-top-4 duration-300 space-y-6">
              {/* Stats Preview */}
              <div className="p-5 bg-indigo-500/5 border border-indigo-500/20 rounded-[2rem] flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                       <ICONS.Salary size={18} />
                    </div>
                    <div>
                       <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Текущий остаток ЗП</p>
                       <p className="text-xl font-black text-white font-mono">${operatorStats?.remainder.toFixed(1)}</p>
                    </div>
                 </div>
                 <div className="text-right">
                    <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Доступно к авансу</p>
                    <p className="text-sm font-bold text-slate-200">~ ${(operatorStats?.remainder || 0) > 0 ? (operatorStats?.remainder || 0).toFixed(0) : '0'}</p>
                 </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-3">
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Сумма запроса</label>
                 <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 font-bold">$</div>
                    <input 
                      type="number"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-4 pl-10 pr-4 text-xl font-mono text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
                    />
                 </div>
                 <p className="text-[8px] text-slate-600 font-bold uppercase tracking-tighter">Рекомендуемая сумма не более 50% от текущего остатка</p>
              </div>

              {/* Payment Details */}
              <div className="space-y-4 pt-2">
                 <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Способ выплаты</label>
                    <div className="flex gap-1">
                       <button 
                         onClick={() => setPaymentMethod('usdt_trc20')}
                         className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${paymentMethod === 'usdt_trc20' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-600 border border-transparent'}`}
                       >
                         USDT TRC20
                       </button>
                       <button 
                         onClick={() => setPaymentMethod('card')}
                         className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${paymentMethod === 'card' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'text-slate-600 border border-transparent'}`}
                       >
                         Карта
                       </button>
                    </div>
                 </div>

                 <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600">
                       {paymentMethod === 'usdt_trc20' ? <ICONS.Wallet size={16}/> : <ICONS.Card size={16}/>}
                    </div>
                    <input 
                      value={walletAddress}
                      onChange={e => setWalletAddress(e.target.value)}
                      placeholder={paymentMethod === 'usdt_trc20' ? "Адрес USDT TRC20..." : "Номер карты..."}
                      className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-sm font-mono text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all placeholder:text-slate-700"
                    />
                 </div>

                 {existingWallet && (
                   <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex items-center gap-2">
                      <ICONS.Check size={14} className="text-emerald-500"/>
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">Реквизиты подтянуты из ведомости</span>
                   </div>
                 )}
              </div>

              {/* Submit Button */}
              <button 
                onClick={sendToTelegram}
                disabled={!amount || !walletAddress || isSending}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:hover:bg-indigo-600 text-white py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] transition-all shadow-xl shadow-indigo-600/20 active:scale-[0.98] flex items-center justify-center gap-3"
              >
                {isSending ? (
                  <>
                    <ICONS.RotateCcw size={16} className="animate-spin" />
                    Отправка запроса...
                  </>
                ) : (
                  <>
                    <ICONS.Send size={16} />
                    Отправить запрос в TG
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="text-center p-6 bg-slate-900/20 border border-slate-800/50 rounded-[2rem]">
         <div className="flex items-center justify-center gap-2 text-slate-500 mb-2">
            <ICONS.History size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">Последние запросы (симуляция)</span>
         </div>
         <p className="text-[9px] text-slate-600 leading-relaxed max-w-xs mx-auto">
           Все запросы отправляются в общую рабочую группу. После выплаты бухгалтер поставит отметку "Выплачено" в Telegram.
         </p>
      </div>
    </div>
  );
};

export default AdvanceRequest;
