import Link from "next/link";

const COLUMNS = [
  {
    title: "Tools",
    links: [
      { href: "/create?input=topic", label: "Topic to video" },
      { href: "/create?input=article", label: "Article to video" },
      { href: "/create?input=data", label: "Data story" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/#showcase", label: "Showcase" },
      { href: "/#pricing", label: "Pricing" },
      { href: "/#how", label: "How it works" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:grid-cols-4">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">PoliVid</span>
          <p className="max-w-48 text-sm text-muted-foreground">Short videos drawn with code.</p>
        </div>
        {COLUMNS.map((column) => (
          <div key={column.title} className="flex flex-col gap-2">
            <span className="text-sm font-semibold">{column.title}</span>
            {column.links.map((link) => (
              <Link key={link.href} href={link.href} className="text-sm text-muted-foreground hover:text-foreground">
                {link.label}
              </Link>
            ))}
          </div>
        ))}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Legal</span>
          <span className="text-sm text-muted-foreground">You preview every video before you share it.</span>
          <span className="text-sm text-muted-foreground">Nothing posts on its own.</span>
        </div>
      </div>
    </footer>
  );
}
