import { siteConfig } from "@crikket/shared/config/site"
import { ModeToggle } from "@crikket/ui/components/mode-toggle"
import { DocsLayout } from "fumadocs-ui/layouts/docs"
import type { ReactNode } from "react"
import { source } from "@/lib/source"

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      githubUrl={siteConfig.links.github}
      nav={{
        title: (
          <span className="font-bold tracking-tighter sm:text-lg">
            {siteConfig.name}
          </span>
        ),
        transparentMode: "top",
      }}
      themeSwitch={{
        enabled: true,
        component: (
          <div className="ms-auto flex items-center">
            <ModeToggle />
          </div>
        ),
      }}
      tree={source.getPageTree()}
    >
      {children}
    </DocsLayout>
  )
}
