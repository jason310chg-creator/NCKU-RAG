import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ requireEditor: vi.fn(), redirect: vi.fn(), forbidden: vi.fn() }));
vi.mock("../../lib/auth/dal", () => ({ requireEditor: mocks.requireEditor }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, forbidden: mocks.forbidden }));
vi.mock("./sign-out-button", () => ({ SignOutButton: () => <button>登出</button> }));
import { AuthAccessError } from "../../lib/auth/dal-core";
import AdminPage from "./page";

describe("admin server page boundary (unit; status codes need HTTP acceptance)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.redirect.mockImplementation(() => { throw new Error("NEXT_REDIRECT"); });
    mocks.forbidden.mockImplementation(() => { throw new Error("NEXT_FORBIDDEN"); });
  });

  it.each(["editor", "admin"])("renders the current %s identity returned by the DAL", async (role) => {
    mocks.requireEditor.mockResolvedValue({ name: "Authorized Person", email: "user@example.com", role });
    const html = renderToStaticMarkup(await AdminPage());
    expect(html).toContain("Authorized Person");
    expect(html).toContain("user@example.com");
    expect(mocks.requireEditor).toHaveBeenCalledTimes(1);
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.forbidden).not.toHaveBeenCalled();
  });

  it("redirects only an unauthenticated visitor to login", async () => {
    mocks.requireEditor.mockRejectedValue(new AuthAccessError(401, "UNAUTHENTICATED"));
    await expect(AdminPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
    expect(mocks.forbidden).not.toHaveBeenCalled();
  });

  it.each(["FORBIDDEN", "USER_INACTIVE"] as const)("renders forbidden for %s", async (code) => {
    mocks.requireEditor.mockRejectedValue(new AuthAccessError(403, code));
    await expect(AdminPage()).rejects.toThrow("NEXT_FORBIDDEN");
    expect(mocks.forbidden).toHaveBeenCalledTimes(1);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("propagates database failures instead of pretending the user is logged out", async () => {
    const error = new Error("database failure");
    mocks.requireEditor.mockRejectedValue(error);
    await expect(AdminPage()).rejects.toBe(error);
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.forbidden).not.toHaveBeenCalled();
  });
});
