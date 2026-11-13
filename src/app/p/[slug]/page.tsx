"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AppFrame from "@/components/AppFrame";
import { Logo } from "@/components/ui";
import { api } from "@/lib/client";
import type { Files } from "@/lib/types";

type PublishedApp = { title: string; teamName: string; files: Files };

export default function PublishedPage() {
  const params = useParams<{ slug: string }>();
  const slug = String(params.slug || "");
  const [app, setApp] = useState<PublishedApp | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    api<PublishedApp>(`/api/app/${encodeURIComponent(slug)}`)
      .then((d) => {
        setApp(d);
        document.title = `${d.title} · Basha Hacks`;
      })
      .catch(() => setMissing(true));
  }, [slug]);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-line px-3 text-sm">
        <Link href="/" aria-label="Basha Hacks home">
          <Logo />
        </Link>
        {app && (
          <span className="min-w-0 truncate text-muted">
            <span className="font-medium text-fg">{app.title}</span> by {app.teamName}
          </span>
        )}
        <span className="label ml-auto hidden sm:inline">Built at DevOps Basha Hacks</span>
      </header>
      <main className="min-h-0 flex-1 bg-white">
        {app ? (
          <AppFrame files={app.files} storageKey={`bh_app_${slug}`} title={app.title} />
        ) : (
          <div className="flex h-full items-center justify-center bg-bg p-8 text-center text-muted">
            {missing ? "This app has not been published yet. Ask the builder to press Publish." : "Loading the app"}
          </div>
        )}
      </main>
    </div>
  );
}
