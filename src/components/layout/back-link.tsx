import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function BackLink({
  href,
  children = "Back to dashboard",
  className,
}: {
  href: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors",
        className,
      )}
    >
      <ArrowLeftIcon className="size-4" />
      {children}
    </Link>
  );
}
