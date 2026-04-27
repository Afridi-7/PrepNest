import { useEffect, useState } from "react";
import { Instagram, Facebook, Youtube, Linkedin, Music2 } from "lucide-react";
import { apiClient, type SiteSettings } from "@/services/api";

const ITEMS: Array<{
  key: keyof SiteSettings;
  label: string;
  Icon: typeof Instagram;
  hover: string;
}> = [
  { key: "instagram_url", label: "Instagram", Icon: Instagram, hover: "hover:text-pink-500 hover:border-pink-300" },
  { key: "facebook_url", label: "Facebook", Icon: Facebook, hover: "hover:text-blue-600 hover:border-blue-300" },
  { key: "youtube_url", label: "YouTube", Icon: Youtube, hover: "hover:text-red-600 hover:border-red-300" },
  // Lucide doesn't ship a TikTok glyph; Music2 is a clean stand-in.
  { key: "tiktok_url", label: "TikTok", Icon: Music2, hover: "hover:text-slate-900 hover:border-slate-400 dark:hover:text-white" },
  { key: "linkedin_url", label: "LinkedIn", Icon: Linkedin, hover: "hover:text-sky-700 hover:border-sky-300" },
];

interface Props {
  /** Optional preloaded settings; otherwise the component fetches itself. */
  settings?: SiteSettings | null;
  /** Visual size of the icon buttons. */
  size?: "sm" | "md";
}

/** Reusable social-link row driven by `/site/settings`. Hides itself when nothing is configured. */
const SocialLinks = ({ settings: external, size = "md" }: Props) => {
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

  const dim = size === "sm" ? "h-9 w-9" : "h-11 w-11";
  const ico = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <div className="flex flex-wrap items-center justify-center gap-2.5">
      {visible.map(({ key, label, Icon, hover }) => (
        <a
          key={key}
          href={settings![key] as string}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          title={label}
          className={`inline-flex ${dim} items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 ${hover}`}
        >
          <Icon className={ico} />
        </a>
      ))}
    </div>
  );
};

export default SocialLinks;
