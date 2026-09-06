import { forbidden, redirect } from "next/navigation";
import { Role } from "../../generated/prisma/enums";
import { requireEditor } from "../../lib/auth/dal";
import { AuthAccessError } from "../../lib/auth/dal-core";
import { SignOutButton } from "./sign-out-button";

export default async function AdminPage() {
  const user = await requireEditor().catch((error: unknown) => {
    if (!(error instanceof AuthAccessError)) throw error;
    if (error.status === 401) redirect("/login");
    forbidden();
  });

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-950">
      <div className="mx-auto max-w-4xl">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-200 pb-8">
          <div>
            <p className="text-sm font-semibold tracking-wide text-teal-700">NCKU-RAG</p>
            <h1 className="mt-3 text-3xl font-semibold">資料管理後台</h1>
          </div>
          <SignOutButton />
        </header>
        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-semibold">{user.name}，歡迎回來</h2>
          <p className="mt-3 break-all text-sm text-slate-600">{user.email}</p>
          <span className="mt-4 inline-flex rounded-full bg-teal-50 px-3 py-1 text-sm font-medium text-teal-800">
            {user.role === Role.admin ? "Admin 管理員" : "Editor 編輯者"}
          </span>
          <p className="mt-6 text-sm leading-7 text-slate-600">您已登入後台。文件與使用者管理功能尚未開放。</p>
        </section>
      </div>
    </main>
  );
}
