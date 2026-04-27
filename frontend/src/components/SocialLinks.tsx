import { useEffect, useState } from "react";
import { Instagram, Facebook, Youtube, Linkedin, Music2 } from "lucide-react";
import { apiClient, type SiteSettings } from "@/services/api";

const ITEMS: Array<{
  key: keyof SiteSettings;
  label: string;
  Icon: typeof Instagram;
  /** Brand-color gradient applied on hover. */
  gradient: string;
  /** Hover ring/shadow color. */
  ring: string;
}> = [
  {
    key: "instagram_url",
    label: "Instagram",
    Icon: Instagram,
    gradient: "from-pink-500 via-fuchsia-500 to-orange-400",
    ring: "shadow-pink-400/40",
  },
  {
    key: "facebook_url",
    label: "Facebook",
    Icon: Facebook,
    gradient: "from-blue-600 to-blue-500",
    ring: "shadow-blue-400/40",
  },
  {
    key: "youtube_url",
    label: "YouTube",
    Icon: Youtube,
    gradient: "from-red-600 to-rose-500",
    ring: "shadow-red-400/40",
  },
  // Lucide doesn't ship a TikTok glyph; Music2 stands in cleanly.
  {
    key: "tiktok_url",
    label: "TikTok",
    Icon: Music2,
    gradient: "from-slate-900 via-slate-800 to-slate-700",
    ring: "shadow-slate-500/40",
  },
  {
    key: "linkedin_url",
    label: "LinkedIn",
    Icon: Linkedin,
    gradient: "from-sky-700 to-sky-500",
    ring: "shadow-sky-400/40",
  },
];

interface Props {
  /** Optional preloaded settings; otherwise the component fetches itself. */
  settings?: SiteSettings | null;
  /** Visual size of the icon buttons. */
  size?: "sm" | "md" | "lg";
  /** Visual variant. `glass` works on dark gradient backgrounds (e.g. footer hero). */
  variant?: "default" | "glass";
}

/** Reusable social-link row driven by `/site/settings`. Hides itself when nothing is configured. */
const SocialLinks = ({ settings: external, size = "md", variant = "glass" }: Props) => {
  const [settings, setSettings] = useState<SiteSettings | null>(external ?? null);

  useEffect(() => {
    if (external !== undefined) {
      setSettings(external);
      return;
    }
    let alive = true;
    apiClient
      .getSiteSettings()
      .then((s) => alive && setSettings(s))
      .catch(() => alive && setSettings(null));
    return () => {
      alive = false;
    };
  }, [external]);

  const visible = ITEMS.filter((it) => settings && settings[it.key]);
  if (visible.length === 0) return null;

  const dim = size === "sm" ? "h-9 w-9" : size === "lg" ? "h-14 w-14" : "h-12 w-12";
  const ico = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-6 w-6" : "h-5 w-5";

  const baseSurface =
    variant === "glass"
      ? "border-white/30 bg-white/15 text-white backdrop-blur-md"
      : "border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300";

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {visible.map(({ key, label, Icon, gradient, ring }) => (
        <a
          key={key}
          href={settings![key] as string}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          title={label}
          className={`group relative inline-flex ${dim} items-center justify-center overflow-hidden rounded-2xl border ${baseSurface} shadow-sm transition-all duration-300 hover:-translate-y-1 hover:scale-105 hover:border-transparent hover:text-white hover:shadow-lg ${ring}`}
        >
          {/* Gradient fill that fades in on hover */}
          <span
            aria-hidden
            className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
          />
          {/* Shine sweep */}
          <span
            aria-hidden
            className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full"
          />
          <Icon className={`${ico} relative z-10 transition-transform duration-300 group-hover:scale-110`} />
        </a>
      ))}
    </div>
  );
};

export default SocialLinks;
