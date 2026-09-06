"use client";

import { useState } from "react";
import { authClient } from "../../lib/auth/client";

export function SignOutButton() {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signOut() {
    setPending(true);
    setFailed(false);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setFailed(true);
      } else {
        // Full navigation discards any authenticated page in the client router cache.
        window.location.assign("/login");
      }
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={signOut} disabled={pending}
        className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-wait disabled:opacity-60">
        {pending ? "正在登出…" : "登出"}
      </button>
      {failed && <p role="alert" className="mt-3 text-sm text-red-800">登出未完成，請重試。</p>}
    </div>
  );
}
