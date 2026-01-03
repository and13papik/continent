import { 
  LayoutDashboard, 
  CircleDollarSign, 
  CreditCard, 
  Users, 
  Settings, 
  ChevronRight, 
  ChevronLeft, 
  Calendar, 
  Lock, 
  Unlock, 
  Trash2, 
  Edit, 
  Plus, 
  ArrowRightLeft, 
  TriangleAlert, 
  Gift, 
  RotateCcw, 
  BadgeDollarSign,
  GraduationCap,
  UserRound,
  Crown
} from 'lucide-react';

export const ICONS: Record<string, any> = {
  Dashboard: LayoutDashboard,
  Income: CircleDollarSign,
  Operations: CreditCard,
  Reports: Users,
  Models: UserRound,
  Owner: Crown,
  Settings: Settings,
  ChevronRight: ChevronRight,
  ChevronLeft: ChevronLeft,
  Calendar: Calendar,
  Lock: Lock,
  Unlock: Unlock,
  Trash: Trash2,
  Edit: Edit,
  Plus: Plus,
  Transfer: ArrowRightLeft,
  Penalty: TriangleAlert,
  AlertTriangle: TriangleAlert,
  Bonus: Gift,
  Gift: Gift,
  Refund: RotateCcw,
  RotateCcw: RotateCcw, // Прямой ключ для использования в статус-баре
  Salary: BadgeDollarSign,
  BadgeDollarSign: BadgeDollarSign,
  Internship: GraduationCap
};

export const PLATFORM_NAMES: Record<string, string> = {
  onlyFans: 'OnlyFans',
  paypal: 'PayPal',
  crypto: 'Crypto'
};

export const OPERATION_META: Record<string, { label: string; icon: any; color: string }> = {
  advance: { label: 'Аванс', icon: CircleDollarSign, color: 'text-amber-500' },
  penalty: { label: 'Штраф', icon: TriangleAlert, color: 'text-rose-500' },
  bonus: { label: 'Бонус', icon: Gift, color: 'text-emerald-500' },
  refund: { label: 'Возврат', icon: RotateCcw, color: 'text-blue-500' },
  salary_payment: { label: 'Выплата ЗП', icon: BadgeDollarSign, color: 'text-indigo-500' },
  internship: { label: 'Стажировочные', icon: GraduationCap, color: 'text-sky-400' }
};