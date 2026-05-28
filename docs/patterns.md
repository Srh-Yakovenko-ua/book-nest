# Patterns

How to do common things.

## Adding a new feature (end-to-end)

Example: a `notes` feature with list, create, delete.

### 1. Define the shared type

`packages/shared/src/index.ts`:

```ts
export type Note = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
};

export type CreateNoteInput = Omit<Note, "createdAt" | "id">;
```

### 2. Create the feature folder

```
apps/web/src/features/notes/
├── index.ts
├── api.ts
├── hooks/
│   ├── use-notes.ts
│   └── use-create-note.ts
├── components/
│   └── note-card.tsx
└── pages/
    ├── notes-page.tsx
    └── note-detail-page.tsx
```

### 3. Implement `api.ts`

```ts
import type { CreateNoteInput, Note } from "@app/shared";

import { request } from "@/lib/http-client";

export const notesApi = {
  create: (input: CreateNoteInput) =>
    request<Note>("/api/notes", {
      body: JSON.stringify(input),
      method: "POST",
    }),
  delete: (id: string) => request<void>(`/api/notes/${id}`, { method: "DELETE" }),
  list: () => request<Note[]>("/api/notes"),
};
```

### 4. Wrap with React Query hooks

`hooks/use-notes.ts`:

```ts
import { useQuery } from "@tanstack/react-query";

import { notesApi } from "@/features/notes/api";

export function useNotes() {
  return useQuery({
    queryFn: notesApi.list,
    queryKey: ["notes"],
  });
}
```

`hooks/use-create-note.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { notesApi } from "@/features/notes/api";

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notesApi.create,
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to create"),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notes"] });
      toast.success("Note created");
    },
  });
}
```

### 5. Expose via `index.ts`

```ts
export { NotesPage } from "./pages/notes-page";
export { NoteDetailPage } from "./pages/note-detail-page";
```

### 6. Mount in `App.tsx`

```tsx
const NotesPage = lazy(() =>
  import("@/features/notes").then((m) => ({ default: m.NotesPage })),
);
const NoteDetailPage = lazy(() =>
  import("@/features/notes").then((m) => ({ default: m.NoteDetailPage })),
);

// in router children:
{ element: lazyRoute(NotesPage), path: "notes" },
{ element: lazyRoute(NoteDetailPage), path: "notes/:id" },
```

## Writing a form

Use react-hook-form + zod + shadcn primitives directly. No wrapper library.

```tsx
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const schema = z.object({
  body: z.string().min(1, "Body required"),
  title: z.string().min(1, "Title required").max(200),
});

type FormValues = z.infer<typeof schema>;

export function NoteForm({ onSubmit }: { onSubmit: (v: FormValues) => Promise<void> }) {
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="title">Title</Label>
        <Input id="title" {...register("title")} aria-invalid={!!errors.title} />
        {errors.title && <p className="text-sm text-error">{errors.title.message}</p>}
      </div>
      <div>
        <Label htmlFor="body">Body</Label>
        <Textarea id="body" {...register("body")} aria-invalid={!!errors.body} />
        {errors.body && <p className="text-sm text-error">{errors.body.message}</p>}
      </div>
      <Button type="submit" disabled={isSubmitting}>
        Save
      </Button>
    </form>
  );
}
```

## Fetching data

Basic query:

```tsx
import { useHealth } from "@/features/health/hooks/use-health";

export function HealthBadge() {
  const { data, error, isError, isLoading } = useHealth();

  if (isLoading) return <span>loading…</span>;
  if (isError) return <span>error: {error.message}</span>;
  return <span>{data.status}</span>;
}
```

Mutation with cache invalidation:

```tsx
const createNote = useCreateNote();

async function onSubmit(values: FormValues) {
  await createNote.mutateAsync(values);
}
```

Optimistic update:

```ts
useMutation({
  mutationFn: notesApi.delete,
  onMutate: async (id: string) => {
    await qc.cancelQueries({ queryKey: ["notes"] });
    const previous = qc.getQueryData<Note[]>(["notes"]);
    qc.setQueryData<Note[]>(["notes"], (old) => old?.filter((n) => n.id !== id));
    return { previous };
  },
  onError: (_err, _id, context) => {
    qc.setQueryData(["notes"], context?.previous);
  },
  onSettled: () => {
    void qc.invalidateQueries({ queryKey: ["notes"] });
  },
});
```

## Styling

- Use Tailwind utility classes directly. `prettier-plugin-tailwindcss` sorts them automatically on save.
- Use the theme CSS variables: `bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-error`, `bg-success`, etc.
- Brand accent color is `var(--primary)` (chartreuse). Use `text-primary` for accent dots.
- For conditional classes use `cn()` from `@/lib/utils`:

```tsx
import { cn } from "@/lib/utils";

<button className={cn("rounded-md px-4 py-2", isActive && "bg-primary text-primary-foreground")} />;
```

- For animations use `tw-animate-css` utilities:

```
animate-in fade-in slide-in-from-bottom-3 delay-100 duration-700 fill-mode-both
```

## Logging

```ts
import { createLogger } from "@/lib/logger";

const log = createLogger("notes");

log.info("note created", { id });
log.warn("stale cache", { key });
log.error("failed to create note", err);
```

- In dev: colored `[notes]` prefix in the browser console for all levels.
- In prod: only `warn` and `error` reach the console. `debug` and `info` are silent.

## Setting the page title

```tsx
import { usePageTitle } from "@/hooks/use-page-title";

export function NotesPage() {
  usePageTitle("Notes");
  // tab: "Notes · monorepo / observability"
  return <main>…</main>;
}
```

## Toast notifications

```ts
import { toast } from "sonner";

toast.success("Saved");
toast.error("Failed to save");
toast.info("Syncing…");
toast.warning("Unsaved changes");
```

The global `<Toaster />` is mounted in `main.tsx` once.
