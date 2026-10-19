import { TruncatedText } from "@/components/truncated-text";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type NoteCategoryBadgeProps = {
  category: string;
  className?: string;
};

export function NoteCategoryBadge({ category, className }: NoteCategoryBadgeProps) {
  return (
    <Badge className={cn("block max-w-full min-w-0", className)} variant="secondary">
      <TruncatedText className="block" text={category} />
    </Badge>
  );
}
