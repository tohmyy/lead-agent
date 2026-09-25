import { Badge } from "@/components/ui/badge";

export function ApprovedCriteriaStrip({
  hardFilters,
}: {
  hardFilters?: string[];
}) {
  if (!hardFilters || hardFilters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="text-muted-foreground text-sm">Approved hard filters</p>
      {hardFilters.map((filter) => (
        <Badge key={filter} variant="outline">
          {filter}
        </Badge>
      ))}
    </div>
  );
}
