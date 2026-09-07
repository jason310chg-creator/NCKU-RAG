import { describe, expect, it } from "vitest";
import { DocumentStatus, Role, Visibility } from "../../generated/prisma/enums";
import { canEditDocument, canReadAdminDocument } from "./policy";

const editor = { id: "editor-id", role: Role.editor, isActive: true };
const draft = { ownerId: editor.id, status: DocumentStatus.draft, visibility: Visibility.public };

describe("admin document policy (pure unit tests)", () => {
  it("denies anonymous access", () => {
    expect(canReadAdminDocument(null, draft)).toBe(false);
    expect(canEditDocument(null, draft)).toBe(false);
  });

  it.each([Role.viewer, Role.editor, Role.admin])("denies inactive %s access", (role) => {
    const inactive = { ...editor, role, isActive: false };
    expect(canReadAdminDocument(inactive, draft)).toBe(false);
    expect(canEditDocument(inactive, draft)).toBe(false);
  });

  it.each([Visibility.public, Visibility.department_only, Visibility.admin_only])(
    "denies a Viewer backend access to %s documents", (visibility) => {
      const viewer = { ...editor, role: Role.viewer };
      expect(canReadAdminDocument(viewer, { ...draft, visibility })).toBe(false);
      expect(canEditDocument(viewer, { ...draft, visibility })).toBe(false);
    },
  );

  it.each([Visibility.public, Visibility.department_only])(
    "allows an Editor to read %s documents regardless of ownership or status", (visibility) => {
      for (const status of Object.values(DocumentStatus)) {
        expect(canReadAdminDocument(editor, { ...draft, ownerId: "someone-else", visibility, status })).toBe(true);
      }
    },
  );

  it("never allows an Editor to read or edit admin_only documents, including their own draft", () => {
    const restricted = { ...draft, visibility: Visibility.admin_only };
    expect(canReadAdminDocument(editor, restricted)).toBe(false);
    expect(canEditDocument(editor, restricted)).toBe(false);
  });

  it.each([Visibility.public, Visibility.department_only])(
    "allows an Editor to edit their own %s draft", (visibility) => {
      expect(canEditDocument(editor, { ...draft, visibility })).toBe(true);
    },
  );

  it.each(["another-owner", null])("denies an Editor editing a draft owned by %s", (ownerId) => {
    expect(canEditDocument(editor, { ...draft, ownerId })).toBe(false);
  });

  it.each([DocumentStatus.published, DocumentStatus.archived])(
    "denies an Editor editing their own %s document", (status) => {
      expect(canEditDocument(editor, { ...draft, status })).toBe(false);
    },
  );

  it.each([Visibility.public, Visibility.department_only, Visibility.admin_only])(
    "allows an active Admin to read and edit %s documents in every status regardless of owner", (visibility) => {
      const admin = { ...editor, role: Role.admin };
      for (const status of Object.values(DocumentStatus)) {
        for (const ownerId of [admin.id, "someone-else", null]) {
          const document = { ownerId, visibility, status };
          expect(canReadAdminDocument(admin, document)).toBe(true);
          expect(canEditDocument(admin, document)).toBe(true);
        }
      }
    },
  );
});
