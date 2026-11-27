import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

type PickerStartAction = {
  href: string;
  icon: UiIconName;
  label: string;
};

export function PickerNoEntities({
  action,
  message,
}: {
  action: PickerStartAction;
  message: string;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border p-4">
      <p className="text-sm leading-relaxed text-muted-foreground">{message}</p>
      <Button asChild size="sm" variant="secondary">
        <Link href={action.href}>
          <UiIcon name={action.icon} size={14} />
          {action.label}
        </Link>
      </Button>
    </div>
  );
}
