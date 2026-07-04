import {
  Activity,
  BookOpen,
  BookOpenText,
  Boxes,
  Bug,
  Cloud,
  Code,
  Code2,
  Command,
  Compass,
  Component,
  Cookie,
  Database,
  Eye,
  FileCode2,
  FileText,
  Filter,
  Folder,
  Gauge,
  Globe,
  Globe2,
  Hammer,
  Hash,
  Heart,
  Home,
  Image,
  Info,
  KeyRound,
  Layers,
  Layout,
  LayoutDashboard,
  Library,
  Lightbulb,
  Link2,
  ListTree,
  Lock,
  Mail,
  Map,
  Megaphone,
  MessageSquare,
  Moon,
  Newspaper,
  Package,
  Phone,
  Plug,
  Puzzle,
  Rocket,
  Save,
  Search,
  Send,
  Server,
  Settings,
  Settings2,
  Share2,
  Shield,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Star,
  Sun,
  Terminal,
  TerminalSquare,
  Trash2,
  TriangleAlert,
  Unlock,
  Upload,
  User,
  Users,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";

export const DOCUMENTATION_ICONS = {
  activity: Activity,
  "book-open": BookOpen,
  "book-open-text": BookOpenText,
  boxes: Boxes,
  bug: Bug,
  cloud: Cloud,
  code: Code,
  "code-2": Code2,
  command: Command,
  compass: Compass,
  component: Component,
  cookie: Cookie,
  database: Database,
  eye: Eye,
  "file-code-2": FileCode2,
  "file-text": FileText,
  filter: Filter,
  folder: Folder,
  gauge: Gauge,
  globe: Globe,
  "globe-2": Globe2,
  hammer: Hammer,
  hash: Hash,
  heart: Heart,
  home: Home,
  image: Image,
  info: Info,
  "key-round": KeyRound,
  layers: Layers,
  layout: Layout,
  "layout-dashboard": LayoutDashboard,
  library: Library,
  lightbulb: Lightbulb,
  "link-2": Link2,
  "list-tree": ListTree,
  lock: Lock,
  mail: Mail,
  map: Map,
  megaphone: Megaphone,
  "message-square": MessageSquare,
  moon: Moon,
  newspaper: Newspaper,
  package: Package,
  phone: Phone,
  plug: Plug,
  puzzle: Puzzle,
  rocket: Rocket,
  save: Save,
  search: Search,
  send: Send,
  server: Server,
  settings: Settings,
  "settings-2": Settings2,
  "share-2": Share2,
  shield: Shield,
  "shield-check": ShieldCheck,
  "shopping-bag": ShoppingBag,
  "shopping-cart": ShoppingCart,
  sparkles: Sparkles,
  star: Star,
  sun: Sun,
  terminal: Terminal,
  "terminal-square": TerminalSquare,
  "trash-2": Trash2,
  "triangle-alert": TriangleAlert,
  unlock: Unlock,
  upload: Upload,
  user: User,
  users: Users,
  workflow: Workflow,
  zap: Zap,
} as const;

export type DocumentationIconName = keyof typeof DOCUMENTATION_ICONS;

export const DOCUMENTATION_ICON_NAMES = Object.keys(
  DOCUMENTATION_ICONS,
) as DocumentationIconName[];

/**
 * Checks whether a value is a registered documentation icon name.
 *
 * @param value - Input value to process.
 * @returns True when the value is a known documentation icon name.
 */
export const isDocumentationIconName = (
  value: string | undefined | null,
): value is DocumentationIconName => {
  return Boolean(value && value in DOCUMENTATION_ICONS);
};

/**
 * Normalizes a stored icon name to a supported documentation icon name.
 *
 * @param value - Input value to process.
 * @returns Valid icon name when supported, otherwise undefined.
 */
export const normalizeDocumentationIconName = (
  value: string | undefined | null,
): DocumentationIconName | undefined => {
  if (!value) return undefined;
  return isDocumentationIconName(value) ? value : undefined;
};

/**
 * Renders a documentation icon with an optional fallback Lucide icon.
 *
 * @param options - Function options.
 * @param [options.iconName] - Registered documentation icon name to render.
 * @param [options.fallback] - Fallback value used when the preferred value is unavailable.
 * @param [options.className] - Optional CSS class string applied to the rendered element.
 * @returns Rendered Lucide icon element.
 */
export const DocumentationIcon = ({
  iconName,
  fallback,
  className,
}: {
  iconName?: string | null;
  fallback?: LucideIcon;
  className?: string;
}) => {
  const resolved = normalizeDocumentationIconName(iconName);
  const Icon = resolved ? DOCUMENTATION_ICONS[resolved] : fallback;
  if (!Icon) return null;
  return <Icon className={className} />;
};
