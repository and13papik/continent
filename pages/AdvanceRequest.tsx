
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppState, OperatorWallet, AdvanceRequestItem, OperationRecord } from '../types';
import { ICONS } from '../constants';
import PeriodBadge from '../components/PeriodBadge';

interface AdvanceRequestProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const formatUsername = (name: string): string => {
  if (!name) return '';
  return name.startsWith('@') ? name : `@${name}`;
};

const AdvanceRequest: React.FC<AdvanceRequestProps> = ({ state, updateState }) => {
  const [selectedOperator, setSelectedOperator] = useState('');
  const [amount, setAmount] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'usdt_trc20' | 'card'>('usdt_trc20');
  const [isSending, setIsSending] = useState(false);
  const [autoDeducts, setAutoDeducts] = useState<Record<string, boolean>>({});

  const activePeriodId = state.selectedPeriodId;
  const activePeriod = state.accountingPeriods.find(p => p.id === activePeriodId);
  const operators = activePeriod?.operators || state.operators;

  const operatorStats = useMemo(() => {
    if (!selectedOperator) return null;
    
    const incomes = state.incomeData.filter(r => r.operator === selectedOperator && r.periodId === activePeriodId);
    const ops = state.operationsData.filter(o => o.operator === selectedOperator && o.periodId === activePeriodId);
    
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
  };

  const sendToTelegram = async () => {
    if (!selectedOperator || !amount || !walletAddress) return;
    
    setIsSending(true);
    const TG_TOKEN = '8497961851:AAEmwmEgJNV6KwyQjdcG62GY3IdX8zz6YV4';
    const DEFAULT_CHAT_ID = '-1003748692600';

    const requestId = `adv-${Date.now()}`;
    const remainderValue = operatorStats?.remainder || 0;
    const amountValue = parseFloat(amount);

    let message = `🚀 <b>ЗАПРОС НА АВАНС</b>\n`;
    message += `--------------------------\n`;
    message += `👤 Оператору <b>${formatUsername(selectedOperator)}</b> запрошен аванс\n`;
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
      }

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
        tgMessageId,
        periodId: activePeriodId
      };

      updateState(prev => {
        const existingRequests = prev.advanceRequests || [];
        let nextState = { 
          ...prev, 
          advanceRequests: [newRequest, ...existingRequests],
          lastUpdated: Date.now() 
        };

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

      alert('✅ Запрос на аванс успешно отправлен!');
      setSelectedOperator('');
      setAmount('');
      setWalletAddress('');
    } catch (error) {
      alert('❌ Ошибка отправки: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsSending(false);
    }
  };

  const deleteRequest = async (reqId: string) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот запрос аванса?')) return;

    const request = (state.advanceRequests || []).find(r => r.id === reqId);
    if (!request) return;

    updateState(prev => ({
      ...prev,
      advanceRequests: (prev.advanceRequests || []).filter(r => r.id !== reqId),
      deletedIds: [...(prev.deletedIds || []), reqId],
      lastUpdated: Date.now()
    }));

    if (request.tgMessageId) {
      const TG_TOKEN = '8497961851:AAEmwmEgJNV6KwyQjdcG62GY3IdX8zz6YV4';
      const DEFAULT_CHAT_ID = '-1003748692600';

      let message = `❌ <b>ЗАПРОС НА АВАНС ОТКЛОНЕН / УДАЛЕН</b>\n`;
      message += `--------------------------\n`;
      message += `👤 Оператор: <b>${formatUsername(request.operator)}</b>\n`;
      message += `💰 <b>Сумма:</b> $${request.amount}\n`;
      message += `--------------------------\n`;
      message += `🔴 <b>Запрос удален из системы администратором</b>`;

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
      } catch (e) {}
    }
  };

  const markAsPaid = async (reqId: string, isAutoDeducted: boolean) => {
    const request = (state.advanceRequests || []).find(r => r.id === reqId);
    if (!request) return;

    updateState(prev => {
      const updatedRequests: AdvanceRequestItem[] = (prev.advanceRequests || []).map(r => 
        r.id === reqId ? { ...r, status: 'paid' as const, paidAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : r
      );

      let nextState = {
        ...prev,
        advanceRequests: updatedRequests
      };

      if (isAutoDeducted) {
        const newOp: OperationRecord = {
          id: `op-adv-${request.id}-${Date.now()}`,
          type: 'advance',
          operator: request.operator,
          amount: request.amount,
          comment: `Автовычет аванса (заявка от ${new Date(request.createdAt).toLocaleDateString('ru-RU')})`,
          date: new Date().toISOString().split('T')[0],
          createdAt: new Date().toISOString(),
          periodId: request.periodId || activePeriodId || ''
        };
        nextState.operationsData = [newOp, ...prev.operationsData];
      }

      return nextState;
    });

    const TG_TOKEN = '8497961851:AAEmwmEgJNV6KwyQjdcG62GY3IdX8zz6YV4';
    const DEFAULT_CHAT_ID = '-1003748692600';

    if (request.tgMessageId) {
      let message = `🚀 <b>ЗАПРОС НА АВАНС ВЫПОЛНЕН</b>\n`;
      message += `--------------------------\n`;
      message += `👤 Оператор: <b>${formatUsername(request.operator)}</b>\n`;
      message += `💰 <b>Сумма:</b> $${request.amount}\n`;
      message += `📊 <b>Остаток был:</b> $${request.remainderAtTime.toFixed(1)}\n`;
      message += `💳 <b>Реквизиты:</b>\n`;
      message += `<code>${request.address}</code>\n`;
      message += `--------------------------\n`;
      if (isAutoDeducted) {
        message += `📥 <i>Аванс автоматически высчитан из зарплаты оператора</i>\n`;
      }
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
      } catch (e) {}
    }

    // Отправка нового сообщения-уведомления о выплате аванса
    let newNotif = `✅ <b>АВАНС ВЫПЛАЧЕН</b>\n`;
    newNotif += `--------------------------\n`;
    newNotif += `👤 Оператор: <b>${formatUsername(request.operator)}</b>\n`;
    newNotif += `💰 <b>Сумма:</b> $${request.amount}\n`;
    newNotif += `💳 <b>Метод:</b> ${request.method === 'usdt_trc20' ? 'USDT TRC20' : 'Карта'}\n`;
    newNotif += `🏛️ <b>Реквизиты:</b> <code>${request.address}</code>\n`;
    if (isAutoDeducted) {
      newNotif += `📥 <b>Аванс автоматически высчитан из зарплаты оператора</b>\n`;
    }
    newNotif += `--------------------------\n`;
    newNotif += `🕒 <b>Время выплаты:</b> ${new Date().toLocaleString('ru-RU')}`;

    try {
      await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: DEFAULT_CHAT_ID,
          text: newNotif,
          parse_mode: 'HTML'
        })
      });
    } catch (e) {}
  };

  const isInActivePeriod = (req: AdvanceRequestItem) => {
    if (req.periodId) {
      return req.periodId === activePeriodId;
    }
    if (!activePeriod) return false;
    const reqTime = new Date(req.createdAt).getTime();
    const pStart = new Date(activePeriod.startAt).getTime();
    const pEnd = activePeriod.endAt ? new Date(activePeriod.endAt).getTime() : Infinity;
    return reqTime >= pStart && reqTime <= pEnd;
  };

  const activeRequests = (state.advanceRequests || [])
    .filter(r => r.status === 'pending')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
  const historyRequests = (state.advanceRequests || [])
    .filter(r => r.status === 'paid' && isInActivePeriod(r))
    .sort((a, b) => new Date(b.paidAt || b.createdAt).getTime() - new Date(a.paidAt || a.createdAt).getTime());

  const totalPaidAdvancesInPeriod = useMemo(() => {
    return historyRequests.reduce((sum, r) => sum + r.amount, 0);
  }, [historyRequests]);

  return (
    <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-black font-outfit text-white uppercase tracking-tighter flex items-center gap-4">
             <div className="w-12 h-12 bg-amber-600 rounded-[1.25rem] flex items-center justify-center shadow-2xl shadow-amber-500/20">
                <ICONS.HandCoins size={24} />
             </div>
             Запрос аванса
          </h1>
          <div className="flex items-center gap-3">
             <PeriodBadge state={state} />
             <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Financial Transaction Center</p>
          </div>
        </div>
        
        <div className="bg-slate-900/60 px-6 py-4 rounded-[2rem] border border-slate-800 flex items-center gap-5">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/10">
            <ICONS.HandCoins size={20} />
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Выдано авансов (период)</p>
            <p className="text-xl font-black text-amber-500 font-mono leading-none mt-1">${totalPaidAdvancesInPeriod.toLocaleString()}</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: REQUEST FORM */}
        <div className="lg:col-span-7">
          <section className="glass-card p-10 rounded-[2.5rem] border-white/5 space-y-10 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-[0.02] pointer-events-none group-hover:opacity-[0.08] transition-opacity duration-1000">
               <ICONS.HandCoins size={240} />
            </div>

            <div className="relative z-10 space-y-8">
               <div className="space-y-4">
                  <div className="flex items-center justify-between">
                     <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">1. Выберите оператора</label>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                     {operators.map(op => (
                        <button 
                          key={op}
                          onClick={() => handleSelectOperator(op)}
                          className={`px-4 py-4 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest transition-all border ${selectedOperator === op ? 'bg-amber-600 border-amber-500 text-white shadow-xl shadow-amber-600/20 scale-[1.05]' : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:border-slate-700'}`}
                        >
                          {op}
                        </button>
                     ))}
                  </div>
               </div>

               <AnimatePresence mode="wait">
                 {selectedOperator && (
                   <motion.div 
                     key={selectedOperator}
                     initial={{ opacity: 0, y: 20 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: -20 }}
                     className="space-y-8"
                   >
                     {/* Stats Preview Card */}
                     <div className="p-8 bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/20 rounded-[2rem] flex items-center justify-between shadow-inner">
                        <div className="flex items-center gap-5">
                           <div className="w-14 h-14 rounded-2xl bg-slate-950 flex items-center justify-center text-amber-500 border border-white/5 shadow-2xl">
                              <ICONS.Income size={24} />
                           </div>
                           <div>
                              <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Доступно к выплате</p>
                              <div className="flex items-baseline gap-2">
                                 <p className="text-3xl font-black text-white font-mono tracking-tighter">${operatorStats?.remainder.toFixed(1)}</p>
                                 <span className="text-[10px] font-bold text-amber-500 font-mono">NET</span>
                              </div>
                           </div>
                        </div>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                           <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">2. Сумма аванса</label>
                           <div className="relative group/input">
                              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-700 font-bold text-xl group-focus-within/input:text-amber-500 transition-colors">$</div>
                              <input 
                                type="number"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                placeholder="0.00"
                                className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl py-6 pl-12 pr-6 text-2xl font-mono text-white focus:outline-none focus:border-amber-500/50 focus:bg-slate-900 transition-all shadow-inner"
                              />
                           </div>
                        </div>

                        <div className="space-y-4">
                           <div className="flex items-center justify-between px-1">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">3. Канал выплаты</label>
                              <div className="flex p-1 bg-slate-950 rounded-xl border border-white/5">
                                 <button 
                                   onClick={() => setPaymentMethod('usdt_trc20')}
                                   className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${paymentMethod === 'usdt_trc20' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'text-slate-600 hover:text-slate-400'}`}
                                 >
                                   USDT
                                 </button>
                                 <button 
                                   onClick={() => setPaymentMethod('card')}
                                   className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${paymentMethod === 'card' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'text-slate-600 hover:text-slate-400'}`}
                                 >
                                   Card
                                 </button>
                              </div>
                           </div>
                           <div className="relative group/input">
                              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-700 group-focus-within/input:text-amber-500 transition-colors">
                                 {paymentMethod === 'usdt_trc20' ? <ICONS.Wallet size={20}/> : <ICONS.History size={20}/>}
                              </div>
                              <input 
                                value={walletAddress}
                                onChange={e => setWalletAddress(e.target.value)}
                                placeholder={paymentMethod === 'usdt_trc20' ? "T-address..." : "Card number..."}
                                className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl py-6 pl-14 pr-6 text-xs font-mono text-slate-300 focus:outline-none focus:border-amber-500/50 focus:bg-slate-900 transition-all shadow-inner placeholder:text-slate-800"
                              />
                           </div>
                        </div>
                     </div>

                     <button 
                        onClick={sendToTelegram}
                        disabled={!amount || !walletAddress || isSending}
                        className="w-full relative group overflow-hidden"
                     >
                        <motion.div
                          whileHover={{ y: -2, scale: 1.01 }}
                          whileTap={{ scale: 0.98 }}
                          className="bg-gradient-to-br from-amber-500 via-orange-600 to-amber-700 p-6 rounded-[2rem] shadow-[0_20px_50px_-10px_rgba(245,158,11,0.4)] flex items-center justify-center gap-4 transition-all"
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
                             {isSending ? (
                               <ICONS.RotateCcw size={20} className="text-white animate-spin" />
                             ) : (
                               <ICONS.Send size={20} className="text-white group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                             )}
                          </div>
                          
                          <div className="flex flex-col items-start text-left">
                             <span className="text-white font-black text-xs uppercase tracking-[0.25em]">
                               {isSending ? 'Обработка...' : 'Отправить запрос'}
                             </span>
                             <span className="text-amber-200 text-[8px] font-bold uppercase tracking-widest opacity-60">Secure Payment Request</span>
                          </div>

                          <ICONS.ArrowRight size={16} className="text-white/40 ml-auto group-hover:translate-x-1 transition-transform" />
                        </motion.div>
                     </button>
                   </motion.div>
                 )}
               </AnimatePresence>
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN: QUEUE & HISTORY */}
        <div className="lg:col-span-5 space-y-10">
           <div className="space-y-6">
              <div className="flex items-center justify-between px-4">
                 <h2 className="text-sm font-black text-white uppercase tracking-[0.2em] flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)] animate-pulse"></div>
                    Живая очередь
                 </h2>
                 <span className="bg-white/5 border border-white/10 text-slate-500 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase font-mono">
                   {activeRequests.length} TX
                 </span>
              </div>

              <div className="space-y-4">
                 <AnimatePresence mode="popLayout">
                    {activeRequests.length === 0 ? (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="py-20 border-2 border-dashed border-white/5 rounded-[2.5rem] text-center text-slate-800 flex flex-col items-center gap-4"
                      >
                         <ICONS.CheckSquare size={48} className="opacity-10"/>
                         <p className="text-[10px] font-black uppercase tracking-[0.3em]">Очередь выплат пуста</p>
                      </motion.div>
                    ) : (
                      activeRequests.map(req => (
                        <motion.div 
                          key={req.id} 
                          layout
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="glass-card p-8 rounded-[2.5rem] border-white/5 space-y-6 hover:border-amber-500/30 transition-all group shadow-xl"
                        >
                           <div className="flex justify-between items-start">
                              <div className="flex items-center gap-4">
                                 <div className="w-12 h-12 rounded-[1.25rem] bg-amber-500/10 flex items-center justify-center text-amber-500 shadow-inner">
                                    <ICONS.User size={20}/>
                                 </div>
                                 <div className="space-y-1">
                                    <p className="text-sm font-black text-white uppercase tracking-wider">{formatUsername(req.operator)}</p>
                                    <p className="text-[10px] text-slate-600 font-black uppercase tracking-tighter">{new Date(req.createdAt).toLocaleString()}</p>
                                 </div>
                              </div>
                              <div className="text-right">
                                 <p className="text-2xl font-black text-amber-500 font-mono tracking-tighter">${req.amount}</p>
                                 <p className="text-[9px] text-slate-700 font-black uppercase tracking-widest mt-1">Status: Pending</p>
                              </div>
                           </div>
                           
                           <div className="bg-slate-950/80 p-4 rounded-2xl border border-white/5 flex items-center justify-between group-hover:border-amber-500/10 transition-colors">
                              <code className="text-[10px] text-slate-500 truncate max-w-[200px] font-mono">{req.address}</code>
                              <span className="text-[8px] font-black uppercase tracking-widest text-slate-700 px-2 py-1 bg-white/5 rounded-md">{req.method}</span>
                           </div>

                           <div className="space-y-4 pt-2">
                              {/* Checkbox for auto deduct */}
                              <label className="flex items-center gap-2.5 cursor-pointer bg-slate-950/60 hover:bg-slate-950 border border-white/5 hover:border-white/10 px-4 py-3 rounded-2xl select-none transition-all duration-300">
                                <input 
                                   type="checkbox"
                                   id={`auto-deduct-${req.id}`}
                                   checked={autoDeducts[req.id] ?? true}
                                   onChange={e => setAutoDeducts(prev => ({ ...prev, [req.id]: e.target.checked }))}
                                   className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-amber-500 focus:ring-amber-500/50 accent-amber-500 cursor-pointer"
                                />
                                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Вычесть из ЗП автоматически</span>
                              </label>

                              <div className="grid grid-cols-4 gap-3">
                                 <button 
                                    onClick={() => markAsPaid(req.id, autoDeducts[req.id] ?? true)}
                                    className="col-span-3 bg-emerald-500/10 hover:bg-emerald-600 text-emerald-500 hover:text-white border border-emerald-500/20 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-inner flex items-center justify-center gap-2"
                                 >
                                    <ICONS.Check size={14}/> Провести выплату
                                 </button>
                                 <button 
                                    onClick={() => deleteRequest(req.id)}
                                    className="col-span-1 bg-rose-500/10 hover:bg-rose-600 text-rose-500 hover:text-white border border-rose-500/20 py-4 rounded-2xl transition-all shadow-inner flex items-center justify-center"
                                    title="Удалить запрос"
                                 >
                                    <ICONS.Trash size={16}/>
                                 </button>
                              </div>
                           </div>
                        </motion.div>
                      ))
                    )}
                 </AnimatePresence>
              </div>
           </div>

           {/* Stats / History Recap */}
           <div className="glass-card p-8 rounded-[2.5rem] border-white/5 space-y-6">
              <div className="flex items-center justify-between border-b border-white/5 pb-5">
                 <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-3">
                    <ICONS.History size={16} className="text-slate-700"/>
                    Последние транзакции
                 </h3>
                 <button 
                   onClick={() => updateState(prev => ({ ...prev, advanceRequests: (prev.advanceRequests || []).filter(r => r.status !== 'paid') }))}
                   className="text-rose-500 text-[8px] font-black uppercase tracking-widest hover:text-rose-400 opacity-40 hover:opacity-100 transition-all font-mono"
                 >
                   Flush History
                 </button>
              </div>

              <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                 {historyRequests.length === 0 ? (
                    <div className="py-10 text-center opacity-10">
                       <p className="uppercase tracking-widest font-black text-[9px]">No historical data</p>
                    </div>
                 ) : (
                    historyRequests.map(req => (
                       <div key={req.id} className="bg-slate-950/40 border border-white/5 p-4 rounded-2xl flex items-center justify-between group hover:border-white/10 transition-colors">
                          <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                <ICONS.Check size={14}/>
                             </div>
                             <div>
                                <p className="text-[11px] font-black text-slate-400">{formatUsername(req.operator)}</p>
                                <p className="text-[8px] text-slate-700 font-black uppercase tracking-tighter">{new Date(req.paidAt || '').toLocaleDateString()}</p>
                             </div>
                          </div>
                          <p className="text-sm font-black text-slate-600 font-mono tracking-tighter group-hover:text-slate-400 transition-colors">${req.amount}</p>
                       </div>
                    ))
                 )}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default AdvanceRequest;
