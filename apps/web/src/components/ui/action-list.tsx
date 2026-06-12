import * as React from "react";

import { UiIcon, type UiIconName } from "@/components/icons";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type ActionListProps = React.ComponentProps<"div"> & {
  dividers?: boolean;
  icon?: UiIconName;
  title?: string;
};

function ActionList({
  children,
  className,
  dividers = false,
  icon,
  title,
  ...props
}: ActionListProps) {
  const rows = React.Children.toArray(children).filter(React.isValidElement);

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border border-border bg-card p-2 shadow-card",
        className,
      )}
      data-slot="action-list"
      {...props}
    >
      {title === undefined ? null : (
        <h2 className="flex items-center gap-2.5 px-2 pt-1.5 pb-3 font-heading text-[1.0625rem] font-bold text-ink">
          {icon === undefined ? null : (
            <UiIcon className="shrink-0 text-primary" name={icon} size={18} />
          )}
          {title}
        </h2>
      )}

      <ul className="flex flex-col gap-0.5">
        {rows.map((row, index) => (
          <li key={row.key ?? index}>
            {dividers && index > 0 ? <Separator className="my-1.5" /> : null}
            {row}
          </li>
        ))}
      </ul>
    </div>
  );
}

export { ActionList };
