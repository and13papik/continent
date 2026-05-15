
import React, { useState, useMemo } from 'react';
import { AppState, OperatorWallet, AdvanceRequestItem } from '../types';
import { ICONS } from '../constants';
import PeriodBadge from '../components/PeriodBadge';

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
    
    const TG_TOKEN = '8497961851:AAEmwmEgJNV6KwyQjdcG62GY3IdX8zz6YV4';
    const DEFAULT_CHAT_ID = '-1003748692600';

    const requestId = `adv-${Date.now()}`;
    const remainderValue = operatorStats?.remainder || 0;
    const amountValue = parseFloat(amount);

    // Формируем текст сообщения согласно запросу
    let message = `🚀 <b>ЗАПРОС НА АВАНС</b>\n`;
    message += `--------------------------\n`;
    message += `👤 Оператору <b>@${selectedOperator}</b> запрошен аванс\n`;
    message += `💰 <b>Размер аванса:</b> $${amountValue}\n`;
    message += `📊 <b>Текущий остаток ЗП:</b> $${remainderValue.toFixed(1)}\n`;
    message += `💳 <b>${paymentMethod === 'usdt_trc20' ? 'Кошелек USDT TRC20' : 'Карта'} для выплаты:</b>\n`;
    message += `<code>${walletAddress}</code>\n`;
    message += `--------------------------\n`;
    message += `⚠️ <i>Статус: Ожидает подтверждения</i>`;

    try {
      const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: DEFAULT_CHAT_ID,
          text: message,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                { text: "🔗 Открыть в Dashboard", url: "https://ais-dev-7xz7xwj4qktl4ynp4sez7n-38906691745.europe-west2.run.app/#/advance-request" }
              ]
            ]
          }
        })
      });

      let tgMessageId: number | undefined;
      if (res.ok) {
        const data = await res.json();
        tgMessageId = data.result?.message_id;
      } else {
        console.warn("TG API returned non-OK status:", await res.text());
      }

      // Сохраняем запрос в глобальное состояние
      const newRequest: AdvanceRequestItem = {
        id: requestId,
        operator: selectedOperator,
        amount: amountValue,
        remainderAtTime: remainderValue,
        method: paymentMethod,
        address: walletAddress,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tgMessageId
      };

      console.log("Saving new advance request:", newRequest);

      updateState(prev => {
        const existingRequests = prev.advanceRequests || [];
        if (existingRequests.some(r => r.id === requestId)) return prev;

        let nextState = { 
          ...prev, 
          advanceRequests: [newRequest, ...existingRequests],
          lastUpdated: Date.now() 
        };

        // Сохраняем/обновляем реквизиты в базе, если они изменились
        if (!existingWallet || existingWallet.address !== walletAddress || existingWallet.method !== paymentMethod) {
          const wallets = prev.operatorWallets || [];
          const filtered = wallets.filter(w => w.operator !== selectedOperator);
          const newWallet: OperatorWallet = {
            id: `wallet-${selectedOperator}-${Date.now()}`,
            operator: selectedOperator,
            address: walletAddress,
            method: paymentMethod,
            updatedAt: new Date().toISOString()
          };
          nextState.operatorWallets = [...filtered, newWallet];
        }

        return nextState;
      });

      alert('✅ Запрос на аванс успешно отправлен в Telegram и сохранен!');
      
      // Очищаем поля ТОЛЬКО после успешного обновления состояния
      setSelectedOperator('');
      setAmount('');
      setWalletAddress('');
    } catch (error) {
      console.error("TG Send Error:", error);
      alert('❌ Ошибка при отправке в Telegram: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка'));
    } finally {
      setIsSending(false);
    }
  };

  const markAsPaid = async (reqId: string) => {
    const request = (state.advanceRequests || []).find(r => r.id === reqId);
    if (!request) return;

    // Update local state first
    updateState(prev => ({
      ...prev,
      advanceRequests: (prev.advanceRequests || []).map(r => 
        r.id === reqId ? { ...r, status: 'paid', paidAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : r
      )
    }));

    // If we have a telegram message ID, try to edit it to show "Paid"
    if (request.tgMessageId) {
      const TG_TOKEN = '8497961851:AAEmwmEgJNV6KwyQjdcG62GY3IdX8zz6YV4';
      const DEFAULT_CHAT_ID = '-1003748692600';

      let message = `🚀 <b>ЗАПРОС НА АВАНС ВЫПОЛНЕН</b>\n`;
      message += `--------------------------\n`;
      message += `👤 Оператор: <b>@${request.operator}</b>\n`;
      message += `💰 <b>Сумма:</b> $${request.amount}\n`;
      message += `📊 <b>Остаток был:</b> $${request.remainderAtTime.toFixed(1)}\n`;
      message += `💳 <b>Реквизиты:</b>\n`;
      message += `<code>${request.address}</code>\n`;
      message += `--------------------------\n`;
      message += `✅ <b>СТАТУС: ВЫПЛАЧЕНО ${new Date().toLocaleString()}</b>`;

      try {
        await fetch(`https://api.telegram.org/bot${TG_TOKEN}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: DEFAULT_CHAT_ID,
            message_id: request.tgMessageId,
            text: message,
            parse_mode: 'HTML'
          })
        });
      } catch (e) {
        console.error("Failed to edit TG message", e);
      }
    }
  };

  const activeRequests = (state.advanceRequests || [])
    .filter(r => r.status === 'pending')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
  const historyRequests = (state.advanceRequests || [])
    .filter(r => r.status === 'paid')
    .sort((a, b) => new Date(b.paidAt || b.createdAt).getTime() - new Date(a.paidAt || a.createdAt).getTime());

  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in zoom-in duration-500 pb-20">
      <header className="text-center space-y-3">
        <div className="w-16 h-16 bg-amber-600/20 text-amber-500 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-amber-900/10 border border-amber-500/20">
          <ICONS.HandCoins size={32} />
        </div>
        <div>
          <h1 className="text-3xl font-black text-white font-outfit uppercase tracking-tight">Запрос аванса</h1>
          <div className="flex items-center justify-center gap-3 mt-2">
            <PeriodBadge state={state} />
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest leading-none">Центр управления платежами</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
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
                         <ICONS.Income size={18} />
                      </div>
                      <div>
                         <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Текущий остаток ЗП</p>
                         <p className="text-xl font-black text-white font-mono">${operatorStats?.remainder.toFixed(1)}</p>
                      </div>
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
                         {paymentMethod === 'usdt_trc20' ? <ICONS.Wallet size={16}/> : <ICONS.History size={16}/>}
                      </div>
                      <input 
                        value={walletAddress}
                        onChange={e => setWalletAddress(e.target.value)}
                        placeholder={paymentMethod === 'usdt_trc20' ? "Адрес USDT TRC20..." : "Номер карты..."}
                        className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-sm font-mono text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all placeholder:text-slate-700"
                      />
                   </div>
                </div>

                {/* Submit Button */}
                <button 
                  onClick={sendToTelegram}
                  disabled={!amount || !walletAddress || isSending}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:hover:bg-indigo-600 text-white py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] transition-all shadow-xl shadow-indigo-600/20 active:scale-[0.98] flex items-center justify-center gap-3"
                >
                  {isSending ? (
                    <><ICONS.RotateCcw size={16} className="animate-spin" /> Отправка...</>
                  ) : (
                    <><ICONS.Send size={16} /> Отправить запрос в TG</>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Active Requests List */}
        <div className="space-y-6">
           <div className="flex items-center justify-between px-2">
              <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                 Активные запросы
              </h2>
              <span className="bg-slate-900 border border-slate-800 text-slate-500 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                {activeRequests.length}
              </span>
           </div>

           <div className="space-y-3">
              {activeRequests.length === 0 ? (
                <div className="p-12 border-2 border-dashed border-slate-800 rounded-[2rem] text-center text-slate-700">
                   <ICONS.CheckSquare size={32} className="mx-auto mb-2 opacity-20"/>
                   <p className="text-[10px] font-black uppercase tracking-widest">Нет активных запросов</p>
                </div>
              ) : (
                activeRequests.map(req => (
                  <div key={req.id} className="bg-slate-900/50 border border-slate-800 p-6 rounded-[2rem] space-y-4 hover:border-indigo-500/30 transition-all group">
                     <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 flex items-center justify-center text-indigo-400">
                              <ICONS.User size={18}/>
                           </div>
                           <div>
                              <p className="text-sm font-bold text-white">@{req.operator}</p>
                              <p className="text-[10px] text-slate-500 font-bold tracking-tight">{new Date(req.createdAt).toLocaleString()}</p>
                           </div>
                        </div>
                        <div className="text-right">
                           <p className="text-lg font-black text-amber-500 font-mono">${req.amount}</p>
                           <p className="text-[8px] text-slate-600 font-black uppercase tracking-tighter">Остаток: ${req.remainderAtTime.toFixed(0)}</p>
                        </div>
                     </div>
                     
                     <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/50 flex items-center justify-between">
                        <code className="text-[10px] text-slate-400 truncate max-w-[200px]">{req.address}</code>
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-600">{req.method}</span>
                     </div>

                     <button 
                        onClick={() => markAsPaid(req.id)}
                        className="w-full bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                     >
                        Пометить как выплачено
                     </button>
                  </div>
                ))
              )}
           </div>
        </div>
      </div>

      {/* History Section */}
      <div className="space-y-6 pt-10">
         <div className="flex items-center justify-between border-b border-slate-800 pb-4 px-2">
            <h2 className="text-lg font-black text-slate-400 uppercase tracking-widest flex items-center gap-3">
               <ICONS.History size={20} className="text-slate-600"/>
               История выплат
            </h2>
            <button 
               onClick={() => updateState(prev => ({ ...prev, advanceRequests: [] }))}
               className="text-rose-500 text-[10px] font-black uppercase tracking-widest hover:text-rose-400"
            >
               Очистить всё
            </button>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {historyRequests.length === 0 ? (
               <div className="col-span-full p-20 text-center opacity-20">
                  <ICONS.ClipboardList size={64} className="mx-auto mb-4"/>
                  <p className="uppercase tracking-[0.3em] font-black text-sm">История пуста</p>
               </div>
            ) : (
               historyRequests.map(req => (
                  <div key={req.id} className="bg-slate-950/40 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                           <ICONS.Check size={14}/>
                        </div>
                        <div>
                           <p className="text-xs font-bold text-slate-300">@{req.operator}</p>
                           <p className="text-[9px] text-slate-600 uppercase font-black tracking-tighter">Выплачено {new Date(req.paidAt || '').toLocaleDateString()}</p>
                        </div>
                     </div>
                     <p className="text-sm font-black text-slate-400 font-mono">${req.amount}</p>
                  </div>
               ))
            )}
         </div>
      </div>
    </div>
  );
};

export default AdvanceRequest;
