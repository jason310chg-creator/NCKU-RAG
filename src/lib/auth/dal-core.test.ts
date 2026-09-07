// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../../generated/prisma/client";
import { Role } from "../../generated/prisma/enums";
import { AuthAccessError, createAuthDal } from "./dal-core";

const USER_ID = "4d41c5c5-1e9b-4b10-ae09-c5516fcab252";
const user = {
  id: USER_ID, name: "Authorized Editor", email: "editor@example.com",
  role: Role.editor, isActive: true,
};

function setup() {
  const findUnique = vi.fn().mockResolvedValue({ ...user });
  const getSession = vi.fn().mockResolvedValue({ user: { id: USER_ID } });
  // These doubles observe authorization behavior; PostgreSQL is tested separately.
  const prisma = { user: { findUnique } } as unknown as Pick<PrismaClient, "user">;
  return { findUnique, getSession, dal: createAuthDal(prisma, getSession) };
}

describe("authorization DAL (unit, mocked database and session)", () => {
  let context: ReturnType<typeof setup>;
  const headers = new Headers({ cookie: "session=opaque" });
  beforeEach(() => { context = setup(); });

  it("loads the current database user using the verified session id", async () => {
    await expect(context.dal.getCurrentUser(headers)).resolves.toEqual(user);
    expect(context.getSession).toHaveBeenCalledWith(headers);
    expect(context.findUnique).toHaveBeenCalledWith({
      where: { id: USER_ID },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
  });

  it("returns null without a session and never queries the user table", async () => {
    context.getSession.mockResolvedValue(null);
    await expect(context.dal.getCurrentUser(headers)).resolves.toBeNull();
    expect(context.findUnique).not.toHaveBeenCalled();
  });

  it("returns null when the session's user was removed", async () => {
    context.findUnique.mockResolvedValue(null);
    await expect(context.dal.getCurrentUser(headers)).resolves.toBeNull();
  });

  it("returns a known inactive user so the server can distinguish forbidden access", async () => {
    context.findUnique.mockResolvedValue({ ...user, isActive: false });
    await expect(context.dal.getCurrentUser(headers)).resolves.toEqual({ ...user, isActive: false });
  });

  it.each(["requireUser", "requireEditor", "requireAdmin"] as const)(
    "%s rejects an absent session with 401", async (method) => {
      context.getSession.mockResolvedValue(null);
      await expect(context.dal[method](headers)).rejects.toMatchObject({
        status: 401, code: "UNAUTHENTICATED",
      });
    },
  );

  it.each(["requireUser", "requireEditor", "requireAdmin"] as const)(
    "%s rejects a deleted session user with 401", async (method) => {
      context.findUnique.mockResolvedValue(null);
      await expect(context.dal[method](headers)).rejects.toMatchObject({
        status: 401, code: "UNAUTHENTICATED",
      });
    },
  );

  it.each(["requireUser", "requireEditor", "requireAdmin"] as const)(
    "%s rejects an inactive administrator with 403", async (method) => {
      context.findUnique.mockResolvedValue({ ...user, role: Role.admin, isActive: false });
      await expect(context.dal[method](headers)).rejects.toMatchObject({
        status: 403, code: "USER_INACTIVE",
      });
    },
  );

  it("allows an active Viewer through requireUser only", async () => {
    context.findUnique.mockResolvedValue({ ...user, role: Role.viewer });
    await expect(context.dal.requireUser(headers)).resolves.toMatchObject({ role: Role.viewer });
    await expect(context.dal.requireEditor(headers)).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
    await expect(context.dal.requireAdmin(headers)).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });

  it("allows an active Editor through requireEditor but rejects requireAdmin", async () => {
    await expect(context.dal.requireEditor(headers)).resolves.toEqual(user);
    await expect(context.dal.requireAdmin(headers)).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });

  it("allows an active Admin through both protected role requirements", async () => {
    context.findUnique.mockResolvedValue({ ...user, role: Role.admin });
    await expect(context.dal.requireEditor(headers)).resolves.toMatchObject({ role: Role.admin });
    await expect(context.dal.requireAdmin(headers)).resolves.toMatchObject({ role: Role.admin });
  });

  it("ignores forged roles, active flags and identity fields in the session snapshot", async () => {
    context.getSession.mockResolvedValue({
      user: { id: USER_ID, role: Role.admin, isActive: true, name: "Forged", email: "forged@example.com" },
    });
    context.findUnique.mockResolvedValue({ ...user, role: Role.viewer });
    await expect(context.dal.getCurrentUser(headers)).resolves.toEqual({ ...user, role: Role.viewer });
    await expect(context.dal.requireAdmin(headers)).rejects.toMatchObject({ status: 403 });
  });

  it("applies a database role downgrade on the next call with the same session", async () => {
    context.findUnique
      .mockResolvedValueOnce({ ...user, role: Role.admin })
      .mockResolvedValueOnce({ ...user, role: Role.editor });
    await expect(context.dal.requireAdmin(headers)).resolves.toMatchObject({ role: Role.admin });
    await expect(context.dal.requireAdmin(headers)).rejects.toMatchObject({ status: 403 });
    expect(context.getSession).toHaveBeenCalledTimes(2);
    expect(context.findUnique).toHaveBeenCalledTimes(2);
  });

  it("applies a database role promotion on the next call with the same session", async () => {
    context.findUnique
      .mockResolvedValueOnce({ ...user, role: Role.editor })
      .mockResolvedValueOnce({ ...user, role: Role.admin });
    await expect(context.dal.requireAdmin(headers)).rejects.toMatchObject({ status: 403 });
    await expect(context.dal.requireAdmin(headers)).resolves.toMatchObject({ role: Role.admin });
  });

  it("revokes protected access immediately when the database user becomes inactive", async () => {
    context.findUnique
      .mockResolvedValueOnce({ ...user })
      .mockResolvedValueOnce({ ...user, isActive: false });
    await expect(context.dal.requireEditor(headers)).resolves.toEqual(user);
    await expect(context.dal.requireEditor(headers)).rejects.toMatchObject({ status: 403, code: "USER_INACTIVE" });
  });

  it.each(["getCurrentUser", "requireUser", "requireEditor", "requireAdmin"] as const)(
    "%s propagates database failures unchanged", async (method) => {
      const failure = new Error("database unavailable");
      context.findUnique.mockRejectedValue(failure);
      await expect(context.dal[method](headers)).rejects.toBe(failure);
    },
  );

  it("propagates session verification failures instead of treating them as logged out", async () => {
    const failure = new Error("session store unavailable");
    context.getSession.mockRejectedValue(failure);
    await expect(context.dal.requireEditor(headers)).rejects.toBe(failure);
    expect(context.findUnique).not.toHaveBeenCalled();
  });

  it("uses a recognizable access error without exposing database or session details", async () => {
    context.getSession.mockResolvedValue(null);
    const failure = await context.dal.requireUser(headers).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AuthAccessError);
    expect(failure).toMatchObject({ name: "AuthAccessError", message: "Authentication required" });
  });
});
