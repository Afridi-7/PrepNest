import { useEffect, useState } from "react";
import { Loader2, Save, Instagram, Facebook, Youtube, Linkedin, Music2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiClient, type SiteSettings } from "@/services/api";

const FIELDS: Array<{
  key: keyof SiteSettings;
  label: string;
  placeholder: string;
  Icon: typeof Instagram;
  accent: string;
}> = [
  { key: "instagram_url", label: "Instagram", placeholder: "https://instagram.com/yourhandle", Icon: Instagram, accent: "text-pink-500" },
  { key: "facebook_url", label: "Facebook", placeholder: "https://facebook.com/yourpage", Icon: Facebook, accent: "text-blue-600" },
  { key: "youtube_url", label: "YouTube", placeholder: "https://youtube.com/@yourchannel", Icon: Youtube, accent: "text-red-600" },
  { key: "tiktok_url", label: "TikTok", placeholder: "https://tiktok.com/@yourhandle", Icon: Music2, accent: "text-slate-700 dark:text-slate-200" },
  { key: "linkedin_url", label: "LinkedIn", placeholder: "https://linkedin.com/in/yourprofile", Icon: Linkedin, accent: "text-sky-700" },
];

const empty: SiteSettings = {
  instagram_url: "",
  facebook_url: "",
  youtube_url: "",
  tiktok_url: "",
  linkedin_url: "",
};

const SiteSettingsEditor = () => {
  const { toast } = useToast();
  const [draft, setDraft] = useState<SiteSettings>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient
      .getSiteSettings()
      .then((s) => setDraft({
        instagram_url: s.instagram_url ?? "",
        facebook_url: s.facebook_url ?? "",
        youtube_url: s.youtube_url ?? "",
        tiktok_url: s.tiktok_url ?? "",
        linkedin_url: s.linkedin_url ?? "",
      }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const onSave = async () => {
    setSaving(true);
    try {
      // Send empty strings as null so admins can clear a link.
      const payload: Partial<SiteSettings> = {};
      (Object.keys(draft) as Array<keyof SiteSettings>).forEach((k) => {
        const v = (draft[k] ?? "").trim();
        payload[k] = v === "" ? null : v;
      });
      const updated = await apiClient.updateSiteSettings(payload);
      setDraft({
        instagram_url: updated.instagram_url ?? "",
        facebook_url: updated.facebook_url ?? "",
        youtube_url: updated.youtube_url ?? "",
        tiktok_url: updated.tiktok_url ?? "",
        linkedin_url: updated.linkedin_url ?? "",
      });
      toast({ description: "Social links saved!" });
    } catch (e: any) {
      toast({ description: e?.message || "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Social Links</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          These appear in the homepage footer's "Connect with us" row and on the About Us page.
          Leave a field blank to hide that platform.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {FIELDS.map(({ key, label, placeholder, Icon, accent }) => (
              <label key={key} className="block">
                <span className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  <Icon className={`h-4 w-4 ${accent}`} /> {label}
                </span>
                <input
                  type="url"
                  value={(draft[key] as string) ?? ""}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                  placeholder={placeholder}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-500/60 dark:focus:ring-blue-900/40"
                />
              </label>
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <Button onClick={onSave} disabled={loading || saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save links
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SiteSettingsEditor;
