import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

type HomeSectionErrorProps = {
  isRetrying: boolean;
  onRetry: () => void;
  retryLabel: string;
  title: string;
};

export function HomeSectionError({
  isRetrying,
  onRetry,
  retryLabel,
  title,
}: HomeSectionErrorProps) {
  return (
    <div className="flex flex-1 flex-col items-start justify-center gap-2" role="alert">
      <p className="flex items-start gap-2 text-sm text-foreground">
        <UiIcon
          aria-hidden
          className="mt-0.5 shrink-0 text-warning"
          name="alert-circle"
          size={16}
        />
        {title}
      </p>
      <Button loading={isRetrying} onClick={onRetry} size="sm" variant="secondary">
        <UiIcon aria-hidden name="refresh" size={14} />
        {retryLabel}
      </Button>
    </div>
  );
}
