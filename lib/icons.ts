import {
  Activity, AlignLeft, Archive, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight,
  Award, Bandage, Banknote, Bell, BellRing, Bike, BookOpen, Briefcase, Calculator,
  Calendar, CalendarCheck, CalendarDays, Camera, ChartColumn, ChartLine, ChartPie,
  Check, CheckCheck, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  ChevronsRight, Clipboard, Cloud, Compass, Copy, CreditCard, Crosshair, Crown,
  Database, DollarSign, Dumbbell, Equal, Eye, EyeOff, File, FileDown, Filter, Flag,
  Gift, Users as GroupUsers, Heart, HeartPulse, Home, Image as ImageIcon, Info, Instagram,
  Key, LayoutGrid, LifeBuoy, Link2Off, LoaderCircle, Lock, LogIn, LogOut, MapPin, Map,
  Medal, Menu, MessageCircle, MessageCircleQuestion, MessageSquare, MessageSquarePlus,
  MessagesSquare, Minus, MinusCircle, MinusSquare, Moon, MoreVertical, Paperclip,
  PenLine, Pencil, Pin, Plus, PlusSquare, Printer, Route, Rocket, Ruler, Search,
  SearchCheck, Send, Settings, Share2, Shield, ShieldCheck, ShieldX, ShoppingBag,
  SmilePlus, Sparkles, Square, Star, Store, Tag, Target, Terminal, ThumbsUp, Timer,
  TrendingDown, TrendingUp, Trash2, TriangleAlert, Trophy, User, UserSquare, Users,
  Verified, Waves, Watch, Wallet, X, XCircle, Youtube, Zap,
  type LucideIcon,
} from 'lucide-react'

/**
 * Словарь keenicon → Lucide.
 *
 * ЗАЧЕМ. Иконочный шрифт Metronic обходится дорого: styles.bundle.css на
 * 227 КБ плюс keenicons-filled.woff на 421 КБ грузятся на каждой странице,
 * а весь каталог vendors/keenicons весит 7.1 МБ. Ради 142 реально
 * используемых глифов это несоразмерно. Lucide уже стоит в проекте.
 *
 * ПОЧЕМУ СЛОВАРЬ, А НЕ ПРЯМЫЕ ИМПОРТЫ. Прямые импорты в каждом файле —
 * идеал (лучше tree-shaking, имя иконки видно в разметке), но иконки в
 * этом коде живут тремя способами: 796 раз как <i className="ki-...">,
 * 412 раз строкой в значении или пропе (`icon: 'ki-cup'`), 170 раз внутри
 * шаблонных строк. Строковые случаи нельзя перевести на прямые импорты, не
 * переписав архитектуру пропов у полусотни компонентов. Словарь снимает
 * шрифт СЕЙЧАС и оставляет путь к прямым импортам открытым: легаси-имена
 * заперты в одном файле.
 *
 * Цена компромисса — все 142 иконки попадают в бандл. Это десятки
 * килобайт JS против 648 КБ шрифта и CSS, которые уходят.
 *
 * Соответствия подобраны по смыслу, а не по начертанию. Абстрактные имена
 * Metronic разобраны по контексту использования:
 *   ki-abstract-26  → спорт вообще (вкладка «Спорт», «Вело» в рекордах)
 *   ki-abstract-45  → силовая тренировка
 *   ki-abstract-14  → плавание
 *   ki-technology-4 → велоспорт
 *   ki-abstract-31  → антропометрия (измерения тела)
 */
export const ICON_MAP: Record<string, LucideIcon> = {
  // навигация и управление
  'ki-cross': X,
  'ki-cross-circle': XCircle,
  'ki-check': Check,
  'ki-check-circle': CheckCircle2,
  'ki-double-check': CheckCheck,
  'ki-plus': Plus,
  'ki-plus-squared': PlusSquare,
  'ki-minus': Minus,
  'ki-minus-circle': MinusCircle,
  'ki-minus-squared': MinusSquare,
  'ki-right': ChevronRight,
  'ki-left': ChevronLeft,
  'ki-up': ChevronUp,
  'ki-down': ChevronDown,
  'ki-double-right': ChevronsRight,
  'ki-arrow-right': ArrowRight,
  'ki-arrow-left': ArrowLeft,
  'ki-arrow-up': ArrowUp,
  'ki-arrow-down': ArrowDown,
  'ki-arrow-up-right': ArrowUpRight,
  'ki-burger-menu-2': Menu,
  'ki-dots-circle-vertical': MoreVertical,
  'ki-row-horizontal': AlignLeft,
  'ki-element-11': LayoutGrid,
  'ki-element-equal': Equal,
  'ki-filter': Filter,
  'ki-magnifier': Search,
  'ki-search-list': SearchCheck,
  'ki-loading': LoaderCircle,
  'ki-arrows-circle': LoaderCircle,

  // статусы и уведомления
  'ki-information-2': Info,
  'ki-information-4': Info,
  'ki-notification': Bell,
  'ki-notification-on': BellRing,
  'ki-notification-bing': BellRing,
  'ki-notification-status': Bell,
  'ki-shield-cross': ShieldX,
  'ki-shield-tick': ShieldCheck,
  'ki-security-user': Shield,
  'ki-verify': Verified,
  'ki-flash': Zap,
  'ki-flash-circle': Zap,

  // люди и роли
  'ki-people': Users,
  'ki-users': GroupUsers,
  'ki-user': User,
  'ki-user-square': UserSquare,
  'ki-profile-circle': User,
  'ki-teacher': Award,
  'ki-crown': Crown,
  'ki-crown-2': Crown,

  // время и календарь
  'ki-calendar': Calendar,
  'ki-calendar-2': CalendarDays,
  'ki-calendar-8': CalendarDays,
  'ki-calendar-tick': CalendarCheck,
  'ki-time': Timer,
  'ki-timer': Timer,
  'ki-watch': Watch,

  // спорт и здоровье
  'ki-abstract-26': Activity,
  'ki-abstract-45': Dumbbell,
  'ki-abstract-14': Waves,
  'ki-technology-4': Bike,
  'ki-abstract-31': Ruler,
  'ki-abstract-41': Target,
  'ki-abstract-8': Sparkles,
  'ki-abstract-32': Square,
  'ki-pulse': Activity,
  'ki-heart': Heart,
  'ki-heart-circle': HeartPulse,
  'ki-bandage': Bandage,
  'ki-drop': LifeBuoy,
  'ki-focus': Crosshair,
  'ki-medal-star': Medal,
  'ki-cup': Trophy,
  'ki-award': Award,
  'ki-star': Star,
  'ki-like': ThumbsUp,
  'ki-emoji-happy': SmilePlus,

  // документы и заметки
  'ki-notepad-edit': PenLine,
  'ki-pencil': Pencil,
  'ki-note-2': File,
  'ki-document': File,
  'ki-file-down': FileDown,
  'ki-clipboard': Clipboard,
  'ki-book': BookOpen,
  'ki-archive': Archive,
  'ki-printer': Printer,
  'ki-paper-clip': Paperclip,
  'ki-copy': Copy,
  'ki-trash': Trash2,

  // сообщения
  'ki-message-text': MessageSquare,
  'ki-message-text-2': MessageSquare,
  'ki-messages': MessagesSquare,
  'ki-message-question': MessageCircleQuestion,
  'ki-message-add': MessageSquarePlus,
  'ki-message-programming': Terminal,
  'ki-sms': MessageCircle,
  'ki-paper-plane': Send,
  'ki-share': Share2,

  // графики и данные
  'ki-chart-line-up': TrendingUp,
  'ki-chart-line-up-2': TrendingUp,
  'ki-chart-line-down': TrendingDown,
  'ki-chart-simple': ChartColumn,
  'ki-chart-pie-simple': ChartPie,
  'ki-data': Database,
  'ki-calculator': Calculator,

  // деньги и торговля
  'ki-dollar': DollarSign,
  'ki-wallet': Wallet,
  'ki-bank': Banknote,
  'ki-credit-cart': CreditCard,
  'ki-discount': Tag,
  'ki-price-tag': Tag,
  'ki-tag': Tag,
  'ki-gift': Gift,
  'ki-shop': Store,
  'ki-office-bag': Briefcase,
  'ki-briefcase': Briefcase,

  // места и навигация по карте
  'ki-geolocation': MapPin,
  'ki-pin': Pin,
  'ki-map': Map,
  'ki-route': Route,
  'ki-compass': Compass,
  'ki-flag': Flag,
  'ki-home': Home,
  'ki-home-2': Home,

  // доступ
  'ki-lock': Lock,
  'ki-lock-2': Lock,
  'ki-key': Key,
  'ki-eye': Eye,
  'ki-eye-slash': EyeOff,
  'ki-exit-right': LogOut,
  'ki-exit-right-corner': LogOut,
  'ki-entrance-right': LogIn,
  'ki-disconnect': Link2Off,
  'ki-fasten': Link2Off,

  // прочее
  'ki-picture': ImageIcon,
  'ki-cloud-add': Cloud,
  'ki-rocket': Rocket,
  'ki-moon': Moon,
  'ki-setting-2': Settings,
  'ki-instagram': Instagram,
  'ki-youtube': Youtube,
  'ki-whatsapp': MessageCircle,
}

/** Иконка по умолчанию для имени, которого нет в словаре. */
export const FALLBACK_ICON = Info

export function resolveIcon(name: string): LucideIcon {
  // Имя приходит и как 'ki-cross', и как 'ki-filled ki-cross' — берём
  // последний ki-* токен, отбросив модификатор начертания.
  const token = name
    .split(/\s+/)
    .filter(t => t.startsWith('ki-') && !['ki-filled', 'ki-outline', 'ki-solid', 'ki-duotone'].includes(t))
    .pop()
  return (token && ICON_MAP[token]) || FALLBACK_ICON
}
