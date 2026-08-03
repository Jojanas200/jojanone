import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Brain,
  Clock,
  FileCheck,
  FileText,
  Gauge,
  Lock,
  Map,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * The icons the content JSON names. Content should never be able to import
 * arbitrary code, so it names an icon and this map resolves it - an unknown
 * name falls back rather than crashing the page.
 */
const ICONS: Record<string, LucideIcon> = {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Brain,
  Clock,
  FileCheck,
  FileText,
  Gauge,
  Lock,
  Map,
  Shield,
  TrendingUp,
  Users,
};

export function iconFor(name: string): LucideIcon {
  return ICONS[name] ?? Sparkles;
}
