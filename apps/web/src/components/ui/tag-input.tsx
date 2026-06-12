"use client";

import * as React from "react";

import { UiIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

type TagInputProps = Omit<React.ComponentProps<"input">, "defaultValue" | "onChange" | "value"> & {
  inputClassName?: string;
  onValueChange: (value: string[]) => void;
  value: string[];
};

function TagInput({
  className,
  disabled,
  id,
  inputClassName,
  onValueChange,
  placeholder = "Додайте теги…",
  value,
  ...props
}: TagInputProps) {
  const [draft, setDraft] = React.useState("");

  const addTag = (raw: string) => {
    const label = raw.trim();
    if (label === "") return;
    const exists = value.some((tag) => tag.toLowerCase() === label.toLowerCase());
    if (!exists) onValueChange([...value, label]);
    setDraft("");
  };

  const removeTag = (target: string) => {
    onValueChange(value.filter((tag) => tag !== target));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag(draft);
      return;
    }
    if (event.key === "Backspace" && draft === "" && value.length > 0) {
      const last = value.at(-1);
      if (last !== undefined) removeTag(last);
    }
  };

  return (
    <label
      className={cn(
        "flex min-h-12 cursor-text flex-wrap items-center gap-2 rounded-md border border-input bg-field px-2.5 py-2 transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 has-disabled:cursor-not-allowed has-disabled:bg-secondary has-disabled:opacity-60",
        className,
      )}
      data-slot="tag-input"
    >
      {value.map((tag) => (
        <span
          className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-full border border-accent-border bg-accent py-0 pr-1.5 pl-3 text-[0.8125rem] font-medium whitespace-nowrap text-accent-foreground"
          data-slot="tag-input-chip"
          key={tag}
        >
          <span className="overflow-hidden text-ellipsis">{tag}</span>
          {disabled ? null : (
            <button
              aria-label={`Видалити тег «${tag}»`}
              className="relative grid size-[18px] shrink-0 cursor-pointer place-items-center rounded-full text-accent-foreground opacity-65 transition-[opacity,background-color] after:absolute after:-inset-[3px] hover:bg-accent-foreground/15 hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              data-slot="tag-input-remove"
              onClick={() => removeTag(tag)}
              type="button"
            >
              <UiIcon className="size-3" name="x" size={12} />
            </button>
          )}
        </span>
      ))}
      <input
        autoComplete="off"
        className={cn(
          "h-7 min-w-[90px] flex-1 border-0 bg-transparent text-[0.9375rem] text-ink outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed",
          inputClassName,
        )}
        disabled={disabled}
        id={id}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        value={draft}
        {...props}
      />
    </label>
  );
}

export { TagInput };
