export const AUDIT_COLLECTIONS: Record<string, string> = {
  incomeData: 'Доходы операторов', operationsData: 'Операции и выплаты',
  ownerExpenses: 'Расходы', ownerManualIncomes: 'Доходы овнеров', ownerAdvances: 'Авансы овнеров',
  modelBonuses: 'Бонусы моделей', paidStatuses: 'Отметки об оплате', advanceRequests: 'Заявки на аванс',
  totalTableEntries: 'Total Table', accountingPeriods: 'Периоды', admins: 'Админы и ставки',
  operatorWallets: 'Реквизиты операторов', rosterData: 'Расписание', operators: 'Список операторов',
  models: 'Список моделей', modelGroups: 'Группы моделей', priorityModels: 'Приоритетные модели',
  inactiveModels: 'Неактивные модели', modelRates: 'Ставки моделей',
  modelDefaultGoals: 'Цели смен', modelMonthlyPlans: 'Планы месяца', system: 'Система',
};
export const AUDIT_ACTIONS: Record<string, string> = { create: 'Добавлено', update: 'Изменено', delete: 'Удалено', enabled: 'Включено' };
export interface AuditEvent {
  id: string; created_at: string; actor_username: string; actor_role: 'owner' | 'admin' | 'system';
  collection: string; record_id: string; action: string; label: string; period_id: string | null;
  before_value?: unknown; after_value?: unknown;
}
export interface AuditPage { events: AuditEvent[]; nextCursor: string | null }

const FIELD_LABELS: Record<string, string> = {
  amount: 'Сумма', total: 'Общий доход', onlyFans: 'OnlyFans', paypal: 'PayPal', crypto: 'Крипта',
  percentOF: 'Процент OnlyFans', percentPP: 'Процент PayPal', percentCrypto: 'Процент крипты',
  nettoOF: 'Зарплата с OnlyFans', nettoPP: 'Зарплата с PayPal', nettoCrypto: 'Зарплата с крипты',
  operator: 'Оператор', model: 'Модель', modelName: 'Модель', ownerName: 'Овнер', entityName: 'Сотрудник',
  date: 'Дата', comment: 'Комментарий', type: 'Тип', category: 'Категория', platform: 'Платформа',
  periodId: 'Период', name: 'Имя', rate: 'Ставка', label: 'Название', status: 'Статус',
  balance: 'Доход', goal: 'Цель', night: 'Ночь', morning: 'Утро', day: 'День', evening: 'Вечер',
  startAt: 'Начало', endAt: 'Окончание', address: 'Реквизиты', method: 'Способ выплаты',
  of: 'OnlyFans', pp: 'PayPal', cr: 'Крипта', models: 'Модели', operators: 'Операторы', admins: 'Админы',
  modelRates: 'Ставки моделей', modelMonthlyPlans: 'Планы месяца', modelDefaultGoals: 'Цели смен',
  paidAt: 'Дата оплаты', remainderAtTime: 'Остаток на момент заявки', shift: 'Смена', isTrainee: 'Стажёр',
};
const VALUE_LABELS: Record<string, string> = {
  advance: 'Аванс', penalty: 'Штраф', bonus: 'Бонус', refund: 'Возврат', salary_payment: 'Зарплата',
  internship: 'Стажировка', open: 'Открыт', closed: 'Закрыт', pending: 'Ожидает', paid: 'Оплачено',
  onlyFans: 'OnlyFans', paypal: 'PayPal', crypto: 'Крипта', all: 'Все', usdt_trc20: 'USDT TRC20', card: 'Карта',
};
export function auditValue(value: unknown, field?: string): string {
  if (value === undefined || value === null) return '—';
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
  if (typeof value === 'number') return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 8 }).format(value);
  if (typeof value === 'string') return (field && ['Тип','Статус','Платформа','Способ выплаты'].includes(field) ? VALUE_LABELS[value] : undefined) || value || '(пусто)';
  return JSON.stringify(value);
}
export function auditChanges(before: unknown, after: unknown, prefix: string[] = []): { field: string; before: unknown; after: unknown }[] {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  if ((object(before) || before == null) && (object(after) || after == null) && (object(before) || object(after))) {
    const b = object(before) ? before : {}, a = object(after) ? after : {};
    return [...new Set([...Object.keys(b), ...Object.keys(a)])].filter(k => !['id','createdAt','updatedAt'].includes(k))
      .flatMap(key => auditChanges(b[key], a[key], [...prefix, key]));
  }
  return [{ field: prefix.map(k => FIELD_LABELS[k] || k).join(' → ') || 'Значение', before, after }];
}
