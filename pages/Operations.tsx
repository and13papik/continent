import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AppState, OperationType, OperationRecord, Platform, IncomeRecord } from '../types';
import { ICONS, OPERATION_META, PLATFORM_NAMES } from '../constants';
import { findPeriodIdByDate } from '../store';
import { OnlyFansLogo, PayPalLogo } from '../components/ServiceLogos';
import './Operations.css';

const money = (value: number) => '$' + value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateLabel = (value: string) => value.split('-').reverse().join('.');
const PAGE_SIZE = 30;

interface OperationsProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => boolean | void;
}

const Operations: React.FC<OperationsProps> = ({ state, updateState }) => {
  const journalHeading = useRef<HTMLHeadingElement>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [type, setType] = useState<OperationType>('advance');
  const activePeriodId = state.selectedPeriodId;
  const activePeriod = state.accountingPeriods.find(p => p.id === activePeriodId);
  const currentOperators = activePeriod?.operators || state.operators;
  const currentModels = activePeriod?.models || state.models;

  const [operator, setOperator] = useState('');
  const [targetModel, setTargetModel] = useState('');
  const [amount, setAmount] = useState('');
  const [comment, setComment] = useState('');
  const [platform, setPlatform] = useState<Platform | 'all'>('all');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [targetPeriodId, setTargetPeriodId] = useState(state.selectedPeriodId);

  // Sync selected period
  useEffect(() => {
    setTargetPeriodId(state.selectedPeriodId);
    setCreating(false);
    setEditingOp(null);
  }, [state.selectedPeriodId]);

  const [editingOp, setEditingOp] = useState<OperationRecord | null>(null);
  const [editingAmount, setEditingAmount] = useState('');
  const [editingComment, setEditingComment] = useState('');
  
  // Filters
  const [activeFilter, setActiveFilter] = useState<OperationType | 'all' | 'income'>('all');
  const [filterOperator, setFilterOperator] = useState('');
  const [filterModel, setFilterModel] = useState('');
  const [filterDate, setFilterDate] = useState('');

  const resetFilters = () => {
    setSearch('');
    setActiveFilter('all');
    setFilterOperator('');
    setFilterModel('');
    setFilterDate('');
  };

  const handleSubmit = () => {
    setFormError('');
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) { setFormError('Введите сумму больше нуля.'); return; }
    if (!operator || !amount || !eventDate) {
      alert('Заполните обязательные поля');
      return;
    }
    
    if (type === 'refund' && !targetModel) {
      alert('Для возврата необходимо выбрать модель');
      return;
    }

    const finalPeriodId = findPeriodIdByDate(eventDate, state.accountingPeriods) || targetPeriodId;

    if (state.accountingPeriods.find(p => p.id === finalPeriodId)?.status !== 'open') { setFormError('Выбранная дата относится к закрытому периоду.'); return; }

    const newOp: OperationRecord = {
      id: String(Date.now()),
      type,
      operator,
      model: (type === 'refund' || !!targetModel) ? targetModel : undefined,
      amount: parseFloat(amount),
      comment,
      date: eventDate,
      createdAt: new Date().toISOString(),
      periodId: finalPeriodId,
      platform: platform === 'all' ? undefined : platform
    };

    if (updateState(prev => ({
      ...prev,
      operationsData: [newOp, ...prev.operationsData]
    })) === false) return;

    setAmount('');
    setComment('');
    setTargetModel('');
    setCreating(false);
  };

  const handleStartEdit = (op: OperationRecord) => {
    setFormError('');
    setEditingOp(op);
    setEditingAmount(String(op.amount));
    setEditingComment(op.comment || '');
  };

  const handleUpdate = () => {
    if (!editingOp) return;
    const updAmount = parseFloat(editingAmount);
    if (!Number.isFinite(updAmount)) {
      alert('Некорректная сумма');
      return;
    }

    if (updateState(prev => ({
      ...prev,
      operationsData: prev.operationsData.map(o => 
        o.id === editingOp.id ? { ...o, amount: updAmount, comment: editingComment, updatedAt: new Date().toISOString() } : o
      )
    })) === false) return;
    setEditingOp(null);
  };

  const deleteOp = (id: string) => {
    if (!confirm('Удалить операцию?')) return;
    if (updateState(prev => ({
      ...prev,
      deletedIds: [...prev.deletedIds, id],
      operationsData: prev.operationsData.filter(o => o.id !== id)
    })) === false) return;
  };

  const deleteIncome = (id: string) => {
    if (!confirm('Удалить запись о доходе?')) return;
    if (updateState(prev => ({
      ...prev,
      deletedIds: [...prev.deletedIds, id],
      incomeData: prev.incomeData.filter(i => i.id !== id)
    })) === false) return;
  };

  const unifiedHistory = useMemo(() => {
    const currentPeriodId = state.selectedPeriodId;
    
    let opsRaw = state.operationsData.filter(o => o.periodId === currentPeriodId);
    let incsRaw = state.incomeData.filter(i => i.periodId === currentPeriodId);

    if (activeFilter !== 'all') {
      if (activeFilter === 'income') {
        opsRaw = [];
      } else {
        opsRaw = opsRaw.filter(o => o.type === activeFilter);
        incsRaw = [];
      }
    }

    if (filterOperator) {
      opsRaw = opsRaw.filter(o => o.operator === filterOperator);
      incsRaw = incsRaw.filter(i => i.operator === filterOperator);
    }

    if (filterModel) {
      opsRaw = opsRaw.filter(o => o.model === filterModel);
      incsRaw = incsRaw.filter(i => i.model === filterModel);
    }

    if (filterDate) {
      opsRaw = opsRaw.filter(o => o.date === filterDate);
      incsRaw = incsRaw.filter(i => i.date === filterDate);
    }

    const query = search.trim().toLocaleLowerCase();
    if (query) {
      opsRaw = opsRaw.filter(o => [o.operator, o.model, o.comment, OPERATION_META[o.type].label].filter(Boolean).join(' ').toLocaleLowerCase().includes(query));
      incsRaw = incsRaw.filter(i => [i.operator, i.model, 'Начисление'].join(' ').toLocaleLowerCase().includes(query));
    }

    const ops = opsRaw.map(o => ({ ...o, entryType: 'operation' as const }));
    const incs = incsRaw.map(i => ({ ...i, entryType: 'income' as const }));

    return [...ops, ...incs].sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [state.operationsData, state.incomeData, state.selectedPeriodId, activeFilter, filterOperator, filterModel, filterDate, search]);

  const totals = useMemo(() => {
    return unifiedHistory.reduce((acc, item) => {
      if (item.entryType === 'operation') {
        const op = item as OperationRecord;
        if (['bonus', 'internship'].includes(op.type)) {
          acc.plus += op.amount;
        } else {
          acc.minus += op.amount;
        }
      } else {
        const inc = item as IncomeRecord;
        acc.plus += (inc.nettoOF + inc.nettoPP + inc.nettoCrypto);
      }
      return acc;
    }, { plus: 0, minus: 0 });
  }, [unifiedHistory]);

  useEffect(() => { setPage(1); setExpanded(null); }, [activePeriodId, activeFilter, filterOperator, filterModel, filterDate, search]);
  const pageCount = Math.max(1, Math.ceil(unifiedHistory.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleHistory = unifiedHistory.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const filtered = !!(search || filterOperator || filterModel || filterDate || activeFilter !== 'all');
  const locked = activePeriod?.status !== 'open';
  const periodRecords = [...state.operationsData, ...state.incomeData].filter(item => item.periodId === activePeriodId);
  const availableOperators = [...new Set([...currentOperators, ...periodRecords.map(item => item.operator)])];
  const availableModels = [...new Set([...currentModels, ...periodRecords.map(item => item.model).filter((model): model is string => !!model)])];

  const changePage = (next: number) => {
    setPage(next);
    setExpanded(null);
    journalHeading.current?.scrollIntoView({ block: "start" });
    journalHeading.current?.focus({ preventScroll: true });
  };

  return <div className="ct-page ct-operations">
    <header className="ct-page-heading">
      <div><h1>Операции</h1><p className="ct-muted">Начисления, выплаты и корректировки персонала</p></div>
      <button className="ct-button ct-button-primary" disabled={locked} onClick={() => { setFormError(''); setCreating(true); }}><ICONS.Plus size={17} />Новая операция</button>
    </header>

    <section className="ct-ops-summary" aria-label="Итоги журнала">
      <div className="ct-ops-stat" role="region" aria-label="Начисления"><span className="ct-ops-stat-icon is-plus"><ICONS.Income size={20} /></span><div><span>Начисления</span><strong className="is-plus">{money(totals.plus)}</strong><small>Доход в ЗП, бонусы и стажировочные</small></div></div>
      <div className="ct-ops-stat" role="region" aria-label="Выплаты и удержания"><span className="ct-ops-stat-icon is-minus"><ICONS.Wallet size={20} /></span><div><span>Выплаты и удержания</span><strong>{money(totals.minus)}</strong><small>Авансы, ЗП, штрафы и возвраты</small></div></div>
      <div className="ct-ops-stat" role="region" aria-label="Количество записей"><span className="ct-ops-stat-icon"><ICONS.History size={20} /></span><div><span>Записей {filtered ? 'по фильтрам' : 'за период'}</span><strong>{unifiedHistory.length.toLocaleString('ru-RU')}</strong><small>{activePeriod?.label}{locked ? ' · закрыт' : ''}</small></div></div>
    </section>

    <section className="ct-ops-journal" aria-labelledby="ops-journal-title">
      <div className="ct-ops-journal-heading"><div><h2 ref={journalHeading} tabIndex={-1} id="ops-journal-title">Журнал операций</h2><p>Итоги сверху рассчитаны {filtered ? 'по текущим фильтрам' : 'за выбранный месяц'}.</p></div><label className="ct-ops-search"><ICONS.Search size={17} /><input aria-label="Поиск по журналу" placeholder="Имя, анкета или комментарий" value={search} onChange={e => setSearch(e.target.value)} /></label></div>
      <div className="ct-ops-filters">
        <div className="ct-ops-types" role="group" aria-label="Тип операции">
          <button aria-pressed={activeFilter === 'all'} onClick={() => setActiveFilter('all')}>Все</button>
          <button aria-pressed={activeFilter === 'income'} onClick={() => setActiveFilter('income')}><ICONS.Income size={14} />Начисления</button>
          {Object.entries(OPERATION_META).map(([key, meta]) => <button key={key} aria-pressed={activeFilter === key} onClick={() => setActiveFilter(key as OperationType)}><meta.icon size={14} />{meta.label}</button>)}
        </div>
        <div className="ct-ops-filter-fields">
          <label>Сотрудник<select aria-label="Сотрудник" value={filterOperator} onChange={e => setFilterOperator(e.target.value)}><option value="">Все сотрудники</option>{availableOperators.map(op => <option key={op}>{op}</option>)}</select></label>
          <label>Анкета<select aria-label="Анкета" value={filterModel} onChange={e => setFilterModel(e.target.value)}><option value="">Все анкеты</option>{availableModels.map(model => <option key={model}>{model}</option>)}</select></label>
          <label>Дата<input aria-label="Дата" type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} /></label>
          <button className="ct-button ct-ops-reset" disabled={!filtered} onClick={resetFilters}><ICONS.RotateCcw size={15} />Сбросить</button>
        </div>
      </div>
      {locked && <p className="ct-ops-locked"><ICONS.Lock size={14} />Период закрыт. Журнал доступен для просмотра.</p>}
      <div className="ct-ops-table-wrap">
        <table className="ct-ops-table"><caption className="sr-only">Начисления и операции персонала</caption>
          <thead><tr><th scope="col">Дата</th><th scope="col">Сотрудник / анкета</th><th scope="col">Операция</th><th scope="col" className="ct-ops-amount">Сумма</th><th scope="col"><span className="sr-only">Действия</span></th></tr></thead>
          <tbody>{visibleHistory.map(item => {
            const key = `${item.entryType}:${item.id}`;
            const income = item.entryType === 'income' ? item : null;
            const op = item.entryType === 'operation' ? item : null;
            const positive = !!income || !!op && ['bonus', 'internship'].includes(op.type);
            const value = income ? income.nettoOF + income.nettoPP + income.nettoCrypto : op!.amount;
            const label = op ? OPERATION_META[op.type].label : 'Начисление';
            const Icon = op ? OPERATION_META[op.type].icon : ICONS.Income;
            const open = expanded === key;
            const detailId = `ops-detail-${key}`;
            return <React.Fragment key={key}>
              <tr className={`ct-ops-row${open ? ' is-expanded' : ''}`}>
                <td className="ct-ops-date"><time dateTime={item.date}>{dateLabel(item.date)}</time></td>
                <td className="ct-ops-person"><strong>{item.operator}</strong><span>{item.model || 'Без анкеты'}</span></td>
                <td><span className={`ct-ops-badge ct-ops-${op?.type || 'income'}`}><Icon size={13} />{label}</span><span className="ct-ops-row-note">{income ? `Доход ${money(income.total)}` : op?.comment || (op?.platform ? PLATFORM_NAMES[op.platform] : 'Все платформы')}</span></td>
                <td className="ct-ops-amount"><strong className={positive ? 'is-plus' : 'is-minus'}>{positive ? '+' : '−'}{money(value)}</strong>{income && <small>в зарплату</small>}</td>
                <td><div className="ct-ops-row-actions"><button aria-label={`Подробнее: ${item.operator}, ${label}, ${dateLabel(item.date)}`} aria-expanded={open} aria-controls={open ? detailId : undefined} title="Подробнее" onClick={() => setExpanded(open ? null : key)}><ICONS.ChevronDown size={17} className={open ? 'is-open' : ''} /></button>{op && <button disabled={locked} aria-label={`Редактировать операцию ${op.id}`} title="Редактировать" onClick={() => handleStartEdit(op)}><ICONS.Edit size={15} /></button>}<button disabled={locked} className="ct-ops-delete" aria-label={`Удалить ${income ? 'доход' : 'операцию'} ${item.id}`} title="Удалить" onClick={() => op ? deleteOp(op.id) : deleteIncome(item.id)}><ICONS.Trash size={15} /></button></div></td>
              </tr>
              {open && <tr className="ct-ops-detail-row"><td colSpan={5}><div id={detailId} className="ct-ops-detail">
                {income ? <div className="ct-ops-platform-details">{[
                  {label:'OnlyFans', icon:<OnlyFansLogo />, gross:income.onlyFans, net:income.nettoOF, rate:income.percentOF},
                  {label:'PayPal', icon:<PayPalLogo />, gross:income.paypal, net:income.nettoPP, rate:income.percentPP},
                  {label:'Crypto', icon:<ICONS.Income size={15} />, gross:income.crypto, net:income.nettoCrypto, rate:income.percentCrypto},
                ].map(p => <div key={p.label}><span>{p.icon}{p.label}<small>{p.rate}%</small></span><dl><div><dt>Доход</dt><dd>{money(p.gross)}</dd></div><div><dt>В зарплату</dt><dd className="is-plus">{money(p.net)}</dd></div></dl></div>)}</div> : <><p><b>Платформа:</b> {op?.platform ? PLATFORM_NAMES[op.platform] : 'Все платформы'}</p><p className="ct-ops-comment"><b>Комментарий:</b> {op?.comment || 'Не указан'}</p></>}
                <small className="ct-ops-record-id">ID записи: {item.id}</small>
              </div></td></tr>}
            </React.Fragment>;
          })}</tbody>
        </table>
      </div>
      {!unifiedHistory.length && <div className="ct-ops-empty"><ICONS.Search size={28} /><h3>Записей не найдено</h3><p>{filtered ? 'Измените условия поиска или сбросьте фильтры.' : 'В этом периоде пока нет операций.'}</p>{filtered && <button className="ct-button" onClick={resetFilters}>Сбросить фильтры</button>}</div>}
      <footer className="ct-ops-pagination"><span role="status">{unifiedHistory.length ? `${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, unifiedHistory.length)} из ${unifiedHistory.length}` : '0 записей'}</span><div><button className="ct-button" aria-label="Предыдущая страница" disabled={currentPage === 1} onClick={() => changePage(currentPage - 1)}><ICONS.ChevronLeft size={16} /></button><span>{currentPage} / {pageCount}</span><button className="ct-button" aria-label="Следующая страница" disabled={currentPage === pageCount} onClick={() => changePage(currentPage + 1)}><ICONS.ChevronRight size={16} /></button></div></footer>
    </section>

    {creating && <OperationDialog title="Новая операция" close={() => setCreating(false)}>
      <p className="ct-ops-form-intro">Выплата или корректировка зарплаты сотрудника</p>
      <form onSubmit={e => { e.preventDefault(); handleSubmit(); }}>
        <div className="ct-ops-form-grid">
          <label>Тип операции<select aria-label="Тип операции" autoFocus value={type} onChange={e => setType(e.target.value as OperationType)}>{Object.entries(OPERATION_META).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}</select></label>
          <label>Платформа<select aria-label="Платформа" value={platform} onChange={e => setPlatform(e.target.value as Platform | 'all')}><option value="all">Все платформы</option><option value="onlyFans">OnlyFans</option><option value="paypal">PayPal</option><option value="crypto">Crypto</option></select></label>
          <label>Оператор<select aria-label="Оператор" required value={operator} onChange={e => setOperator(e.target.value)}><option value="">Выберите сотрудника</option>{currentOperators.map(op => <option key={op}>{op}</option>)}</select></label>
          <label>Анкета{type === 'refund' ? ' · обязательно' : ''}<select aria-label="Анкета" required={type === 'refund'} value={targetModel} onChange={e => setTargetModel(e.target.value)}><option value="">Без анкеты</option>{currentModels.map(model => <option key={model}>{model}</option>)}</select></label>
          <label>Сумма, USD<input required type="number" step="any" min="0.000001" placeholder="0,00" value={amount} onChange={e => setAmount(e.target.value)} /></label>
          <label>Дата операции<input required type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} /></label>
          <label className="ct-ops-form-wide">Период<select aria-label="Период" value={targetPeriodId} onChange={e => setTargetPeriodId(e.target.value)}>{state.accountingPeriods.slice().reverse().map(p => <option key={p.id} value={p.id} disabled={p.status === 'closed'}>{p.label}{p.status === 'closed' ? ' · закрыт' : ''}</option>)}</select><small>При совпадении даты с месяцем запись относится к этому месяцу.</small></label>
          <label className="ct-ops-form-wide">Комментарий<textarea rows={3} value={comment} placeholder="Причина или примечание" onChange={e => setComment(e.target.value)} /></label>
        </div>
        {formError && <p className="ct-ops-error" role="alert">{formError}</p>}
        <footer><button type="button" className="ct-button" onClick={() => setCreating(false)}>Отмена</button><button type="submit" className="ct-button ct-button-primary" disabled={locked}>Сохранить операцию</button></footer>
      </form>
    </OperationDialog>}
    {editingOp && <OperationDialog title="Редактировать операцию" close={() => setEditingOp(null)}>
      <p className="ct-ops-form-intro">{editingOp.operator} · {OPERATION_META[editingOp.type].label} · {dateLabel(editingOp.date)}</p>
      <form onSubmit={e => { e.preventDefault(); handleUpdate(); }}><div className="ct-ops-form-grid">
        <label className="ct-ops-form-wide">Сумма, USD<input autoFocus required type="number" step="any" value={editingAmount} onChange={e => setEditingAmount(e.target.value)} /></label>
        <label className="ct-ops-form-wide">Комментарий<textarea rows={4} value={editingComment} onChange={e => setEditingComment(e.target.value)} /></label>
      </div><footer><button type="button" className="ct-button" onClick={() => setEditingOp(null)}>Отмена</button><button type="submit" className="ct-button ct-button-primary" disabled={locked}>Сохранить изменения</button></footer></form>
    </OperationDialog>}
  </div>;
};

function OperationDialog({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!, previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => { dialog.close(); previous?.focus(); };
  }, []);
  return createPortal(<dialog ref={ref} className="ct-ops-dialog" aria-labelledby="ops-dialog-title" onCancel={close}><header><h2 id="ops-dialog-title">{title}</h2><button type="button" aria-label="Закрыть окно" onClick={close}><ICONS.Close size={20} /></button></header>{children}</dialog>, document.body);
}

export default Operations;
