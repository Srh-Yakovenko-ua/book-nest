import "@testing-library/jest-dom/vitest";

import type { UserView } from "@app/shared";

import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/features/auth/model/auth-store";
import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { makeProfile } from "../model/profile.fixtures";
import { ProfileSettingsCard } from "./profile-settings-card";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const copy = messages.profile;
const discardCopy = messages.common.discardChanges;

const DRAFT = {
  bio: "Collects first editions.",
  name: "Mariia Koval",
  nickname: "mariia_k",
} as const;

const FIELD_TEXT = {
  bioHint: copy.fields.bioHint.replace("{max}", "300"),
  nameLengthError: copy.errors.nameLength.replace("{min}", "2").replace("{max}", "50"),
  nicknameHint: copy.fields.nicknameHint.replace("{min}", "3").replace("{max}", "30"),
};

const sessionUser = {
  createdAt: "2026-01-01T00:00:00.000Z",
  dateOfBirth: null,
  email: "olena@book.nest",
  emailVerified: true,
  id: "3f9b1c2d-4e5a-4b6c-8d7e-9f0a1b2c3d4e",
  name: "Olena Petrenko",
  nickname: "olena_reads",
  role: "user",
} satisfies UserView;

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

let respondToSave: () => Promise<Response>;

function field(dialog: HTMLElement, name: string): HTMLElement {
  return within(dialog).getByRole("textbox", { name });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

async function openDiscardPrompt(): Promise<HTMLElement> {
  const dialog = await openEditDialog();
  await replaceText(field(dialog, copy.fields.bio), DRAFT.bio);
  await userEvent.click(within(dialog).getByRole("button", { name: copy.dialog.cancel }));
  return screen.findByRole("alertdialog", { name: discardCopy.title });
}

async function openEditDialog(): Promise<HTMLElement> {
  renderWithProviders(<ProfileSettingsCard />);
  await userEvent.click(await screen.findByRole("button", { name: copy.editAction }));
  return screen.findByRole("dialog", { name: copy.dialog.title });
}

function patchBodies(): unknown[] {
  return fetchMock.mock.calls
    .filter(([input, init]) => String(input).endsWith("/api/profile") && init?.method === "PATCH")
    .map(([, init]) => JSON.parse(String(init?.body)) as unknown);
}

async function replaceText(target: HTMLElement, value: string) {
  await userEvent.clear(target);
  await userEvent.type(target, value);
}

async function saveDraft(dialog: HTMLElement) {
  await userEvent.click(within(dialog).getByRole("button", { name: copy.dialog.save }));
}

async function saveNewName() {
  const dialog = await openEditDialog();
  await replaceText(field(dialog, copy.fields.name), DRAFT.name);
  await saveDraft(dialog);
}

async function waitForDialogToClose() {
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
}

beforeEach(() => {
  useAuthStore.getState().setSession("access-token", sessionUser);
  respondToSave = () => Promise.resolve(jsonResponse(makeProfile(DRAFT)));
  fetchMock.mockReset();
  fetchMock.mockImplementation((input, init) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.endsWith("/api/profile") && method === "GET")
      return Promise.resolve(jsonResponse(makeProfile()));
    if (url.endsWith("/api/profile") && method === "PATCH") return respondToSave();
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  useAuthStore.setState(useAuthStore.getInitialState(), true);
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("ProfileEditDialog request body", () => {
  it("sends one update with only the edited name, nickname and bio", async () => {
    const dialog = await openEditDialog();

    await replaceText(field(dialog, copy.fields.name), DRAFT.name);
    await replaceText(field(dialog, copy.fields.nickname), DRAFT.nickname);
    await replaceText(field(dialog, copy.fields.bio), DRAFT.bio);
    await saveDraft(dialog);
    await waitForDialogToClose();

    expect(patchBodies()).toEqual([
      { bio: "Collects first editions.", name: "Mariia Koval", nickname: "mariia_k" },
    ]);
  });

  it("sends the bio alone when only the bio changed", async () => {
    const dialog = await openEditDialog();

    await replaceText(field(dialog, copy.fields.bio), DRAFT.bio);
    await saveDraft(dialog);
    await waitForDialogToClose();

    expect(patchBodies()).toEqual([{ bio: "Collects first editions." }]);
  });

  it("sends a cleared nickname as null", async () => {
    const dialog = await openEditDialog();

    await userEvent.clear(field(dialog, copy.fields.nickname));
    await saveDraft(dialog);
    await waitForDialogToClose();

    expect(patchBodies()).toEqual([{ nickname: null }]);
  });
});

describe("ProfileEditDialog successful save", () => {
  it("closes the dialog", async () => {
    await saveNewName();

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("confirms the save with a toast", async () => {
    await saveNewName();

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(copy.dialog.saved));
  });

  it("shows the saved name on the card", async () => {
    await saveNewName();

    expect(await screen.findByText("Mariia Koval")).toBeInTheDocument();
    expect(screen.queryByText("Olena Petrenko")).not.toBeInTheDocument();
  });

  it("renames the signed-in user", async () => {
    await saveNewName();

    await waitFor(() => expect(useAuthStore.getState().user?.name).toBe("Mariia Koval"));
  });
});

describe("ProfileEditDialog unchanged draft", () => {
  it("keeps save disabled and sends nothing", async () => {
    const dialog = await openEditDialog();
    const save = within(dialog).getByRole("button", { name: copy.dialog.save });

    await userEvent.click(save);

    expect(save).toBeDisabled();
    expect(patchBodies()).toEqual([]);
  });
});

describe("ProfileEditDialog fields", () => {
  it("marks the name as required", async () => {
    const dialog = await openEditDialog();

    expect(field(dialog, copy.fields.name)).toBeRequired();
  });

  it("describes the nickname with its allowed length and characters", async () => {
    const dialog = await openEditDialog();

    expect(field(dialog, copy.fields.nickname)).toHaveAccessibleDescription(
      FIELD_TEXT.nicknameHint,
    );
  });

  it("describes the bio with its length limit", async () => {
    const dialog = await openEditDialog();

    expect(field(dialog, copy.fields.bio)).toHaveAccessibleDescription(FIELD_TEXT.bioHint);
  });
});

describe("ProfileEditDialog validation", () => {
  it("describes a one-character name with an inline error", async () => {
    const dialog = await openEditDialog();
    const nameField = field(dialog, copy.fields.name);

    await replaceText(nameField, "O");
    await saveDraft(dialog);

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(FIELD_TEXT.nameLengthError);
    expect(nameField).toHaveAccessibleDescription(FIELD_TEXT.nameLengthError);
    expect(nameField).toHaveAttribute("aria-invalid", "true");
  });

  it("sends nothing for a one-character name", async () => {
    const dialog = await openEditDialog();

    await replaceText(field(dialog, copy.fields.name), "O");
    await saveDraft(dialog);
    await within(dialog).findByRole("alert");

    expect(patchBodies()).toEqual([]);
  });
});

describe("ProfileEditDialog taken nickname", () => {
  beforeEach(() => {
    respondToSave = () =>
      Promise.resolve(jsonResponse({ message: "Nickname is already taken" }, 409));
  });

  it("marks the nickname field as taken", async () => {
    const dialog = await openEditDialog();
    const nicknameField = field(dialog, copy.fields.nickname);

    await replaceText(nicknameField, "taken_name");
    await saveDraft(dialog);

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(copy.errors.nicknameTaken);
    expect(nicknameField).toHaveAccessibleDescription(
      expect.stringContaining(copy.errors.nicknameTaken),
    );
  });

  it("keeps the nickname hint in the description next to the error", async () => {
    const dialog = await openEditDialog();
    const nicknameField = field(dialog, copy.fields.nickname);

    await replaceText(nicknameField, "taken_name");
    await saveDraft(dialog);
    await within(dialog).findByRole("alert");

    expect(nicknameField).toHaveAccessibleDescription(
      expect.stringContaining(FIELD_TEXT.nicknameHint),
    );
  });

  it("keeps the dialog open with the draft", async () => {
    const dialog = await openEditDialog();

    await replaceText(field(dialog, copy.fields.nickname), "taken_name");
    await saveDraft(dialog);
    await within(dialog).findByRole("alert");

    expect(screen.getByRole("dialog", { name: copy.dialog.title })).toBeInTheDocument();
    expect(field(dialog, copy.fields.nickname)).toHaveValue("taken_name");
  });
});

describe("ProfileEditDialog failed save", () => {
  beforeEach(() => {
    respondToSave = () => Promise.resolve(jsonResponse({ message: "boom" }, 500));
  });

  it("shows the save error", async () => {
    const dialog = await openEditDialog();

    await replaceText(field(dialog, copy.fields.bio), DRAFT.bio);
    await saveDraft(dialog);

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(copy.dialog.saveError);
  });

  it("keeps the dialog open with the draft", async () => {
    const dialog = await openEditDialog();

    await replaceText(field(dialog, copy.fields.bio), DRAFT.bio);
    await saveDraft(dialog);
    await within(dialog).findByRole("alert");

    expect(screen.getByRole("dialog", { name: copy.dialog.title })).toBeInTheDocument();
    expect(field(dialog, copy.fields.bio)).toHaveValue("Collects first editions.");
  });

  it("sends the draft again on the next save", async () => {
    const dialog = await openEditDialog();

    await replaceText(field(dialog, copy.fields.bio), DRAFT.bio);
    await saveDraft(dialog);
    await within(dialog).findByRole("alert");
    await saveDraft(dialog);

    await waitFor(() =>
      expect(patchBodies()).toEqual([
        { bio: "Collects first editions." },
        { bio: "Collects first editions." },
      ]),
    );
  });

  it("clears the save error as soon as the next save starts", async () => {
    let finishRetry: (response: Response) => void = () => undefined;
    const dialog = await openEditDialog();
    await replaceText(field(dialog, copy.fields.bio), DRAFT.bio);
    await saveDraft(dialog);
    await within(dialog).findByText(copy.dialog.saveError);
    respondToSave = () =>
      new Promise<Response>((resolve) => {
        finishRetry = resolve;
      });

    await saveDraft(dialog);
    await waitFor(() =>
      expect(within(dialog).queryByText(copy.dialog.saveError)).not.toBeInTheDocument(),
    );

    expect(screen.getByRole("dialog", { name: copy.dialog.title })).toBeInTheDocument();
    finishRetry(jsonResponse(makeProfile(DRAFT)));
    await waitForDialogToClose();
  });
});

describe("ProfileEditDialog pending save", () => {
  it("sends nothing on a second click while the first save is pending", async () => {
    let finishSave: (response: Response) => void = () => undefined;
    respondToSave = () =>
      new Promise<Response>((resolve) => {
        finishSave = resolve;
      });
    const dialog = await openEditDialog();
    await replaceText(field(dialog, copy.fields.name), DRAFT.name);
    const save = within(dialog).getByRole("button", { name: copy.dialog.save });

    await userEvent.click(save);
    await userEvent.click(save);
    await waitFor(() => expect(patchBodies()).toHaveLength(1));
    finishSave(jsonResponse(makeProfile(DRAFT)));
    await waitForDialogToClose();

    expect(patchBodies()).toHaveLength(1);
  });
});

describe("ProfileEditDialog cancel", () => {
  it("closes an untouched dialog without a prompt or a request", async () => {
    const dialog = await openEditDialog();

    await userEvent.click(within(dialog).getByRole("button", { name: copy.dialog.cancel }));
    await waitForDialogToClose();

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(patchBodies()).toEqual([]);
  });

  it("closes an untouched dialog from the close button", async () => {
    const dialog = await openEditDialog();

    await userEvent.click(within(dialog).getByRole("button", { name: copy.dialog.close }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("asks before discarding an edited draft", async () => {
    const prompt = await openDiscardPrompt();

    expect(prompt).toHaveTextContent(discardCopy.description);
  });

  it("closes without a request once the draft is discarded", async () => {
    const prompt = await openDiscardPrompt();

    await userEvent.click(within(prompt).getByRole("button", { name: discardCopy.confirm }));
    await waitForDialogToClose();

    expect(patchBodies()).toEqual([]);
  });

  it("reopens with the server values after a discard", async () => {
    const prompt = await openDiscardPrompt();
    await userEvent.click(within(prompt).getByRole("button", { name: discardCopy.confirm }));
    await waitForDialogToClose();

    await userEvent.click(screen.getByRole("button", { name: copy.editAction }));
    const reopened = await screen.findByRole("dialog", { name: copy.dialog.title });

    expect(field(reopened, copy.fields.bio)).toHaveValue("Reads fantasy at night.");
  });
});
