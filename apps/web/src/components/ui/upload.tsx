"use client";

import * as React from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type UploadProps = {
  accept?: string;
  browseLabel?: string;
  className?: string;
  disabled?: boolean;
  files: File[];
  hint?: React.ReactNode;
  id?: string;
  media?: React.ReactNode;
  multiple?: boolean;
  onFilesChange: (files: File[]) => void;
  title?: string;
};

function formatSize(bytes: number) {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} МБ`;
  return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}

function Upload({
  accept,
  browseLabel = "Завантажити файл",
  className,
  disabled,
  files,
  hint,
  id,
  media,
  multiple = false,
  onFilesChange,
  title = "Перетягніть файл сюди",
}: UploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const depth = React.useRef(0);
  const titleId = React.useId();

  const openPicker = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const addFiles = (incoming: File[] | FileList | null) => {
    if (!incoming || incoming.length === 0) return;
    const next = Array.from(incoming);
    onFilesChange(multiple ? [...files, ...next] : next.slice(0, 1));
  };

  const pasteHandlerRef = React.useRef<(event: ClipboardEvent) => void>(() => undefined);

  React.useEffect(() => {
    pasteHandlerRef.current = (event) => {
      if (disabled) return;
      const clipboard = event.clipboardData;
      if (clipboard === null) return;

      const images = Array.from(clipboard.files).filter((file) => file.type.startsWith("image/"));
      if (images.length === 0) return;

      const active = document.activeElement;
      const isEditingField =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement ||
        (active instanceof HTMLElement && active.isContentEditable);
      if (active !== buttonRef.current && isEditingField) return;

      event.preventDefault();
      addFiles(images);
    };
  });

  React.useEffect(() => {
    const onWindowPaste = (event: ClipboardEvent) => pasteHandlerRef.current(event);
    window.addEventListener("paste", onWindowPaste);
    return () => window.removeEventListener("paste", onWindowPaste);
  }, []);

  const removeAt = (index: number) => {
    onFilesChange(files.filter((_, current) => current !== index));
  };

  return (
    <div className={cn("flex flex-col gap-3", className)} data-slot="upload">
      <button
        className={cn(
          "relative flex w-full cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-input bg-field px-6 py-8 text-center transition-[border-color,background-color,box-shadow] duration-200 ease-out outline-none hover:not-disabled:border-accent-border hover:not-disabled:bg-secondary focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-secondary disabled:opacity-60",
          dragOver &&
            "border-solid border-accent-border bg-accent/40 ring-4 ring-ring/50 hover:not-disabled:border-accent-border hover:not-disabled:bg-accent/40",
        )}
        data-slot="upload-dropzone"
        disabled={disabled}
        onClick={openPicker}
        onDragEnter={(event) => {
          event.preventDefault();
          if (disabled) return;
          depth.current += 1;
          setDragOver(true);
        }}
        onDragLeave={() => {
          depth.current -= 1;
          if (depth.current <= 0) {
            depth.current = 0;
            setDragOver(false);
          }
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          depth.current = 0;
          setDragOver(false);
          if (disabled) return;
          addFiles(event.dataTransfer.files);
        }}
        ref={buttonRef}
        type="button"
      >
        {media ?? (
          <span
            className={cn(
              "mb-1 text-icon transition-colors duration-200 ease-out",
              dragOver && "text-primary",
            )}
          >
            <UiIcon name="cloud-up" size={54} />
          </span>
        )}
        <span className="text-sm font-bold text-ink" id={titleId}>
          {dragOver ? "Відпустіть, щоб завантажити" : title}
        </span>
        <span className="text-sm text-muted-foreground">або</span>
        <span className="mt-1 flex w-full">
          <Button asChild className="h-11 w-full" tabIndex={-1}>
            <span>
              <UiIcon name="upload" size={18} />
              {browseLabel}
            </span>
          </Button>
        </span>
      </button>

      <input
        accept={accept}
        aria-labelledby={titleId}
        className="sr-only"
        id={id}
        multiple={multiple}
        onChange={(event) => {
          addFiles(event.target.files);
          event.target.value = "";
        }}
        ref={inputRef}
        tabIndex={-1}
        type="file"
      />

      {hint === undefined ? null : (
        <div className="text-center text-xs leading-snug text-muted-foreground">{hint}</div>
      )}

      {files.length === 0 ? null : (
        <ul className="flex flex-col gap-2" data-slot="upload-list">
          {files.map((file, index) => (
            <li
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5"
              key={`${file.name}-${index}`}
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-md border border-border bg-secondary text-muted-foreground">
                <UiIcon name="image" size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 truncate text-[0.9375rem] font-semibold text-ink">
                  <UiIcon className="shrink-0 text-success" name="check" size={16} />
                  <span className="truncate">{file.name}</span>
                </span>
                <span className="mt-0.5 block text-[0.8125rem] text-muted-foreground">
                  {formatSize(file.size)}
                </span>
              </span>
              {disabled ? null : (
                <Button
                  aria-label={`Видалити ${file.name}`}
                  onClick={() => removeAt(index)}
                  size="icon-sm"
                  variant="ghost"
                >
                  <UiIcon name="trash" size={16} />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export { Upload };
