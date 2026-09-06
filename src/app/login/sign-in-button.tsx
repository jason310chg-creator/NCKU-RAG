"use client";

import { useState } from "react";
import { authClient } from "../../lib/auth/client";

export function GoogleSignInButton() {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signIn() {
    setPending(true);
    setFailed(false);
    try {
      const result = await authClient.signIn.social({
        provider: "google", callbackURL: "/admin", errorCallbackURL: "/login?error=oauth",
      });
      if (result.error) setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" onClick={signIn} disabled={pending}
        className="w-full rounded-md bg-teal-700 px-5 py-3 font-medium text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-wait disabled:opacity-60">
        {pending ? "正在前往 Google…" : "使用 Google 登入"}
      </button>
      {failed && <p role="alert" className="mt-4 text-sm leading-6 text-red-800">無法開始登入，請稍後重試或聯絡管理員。</p>}
    </>
  );
}
