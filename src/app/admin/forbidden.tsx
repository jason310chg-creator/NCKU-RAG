import Link from "next/link";
import { SignOutButton } from "./sign-out-button";

export default function Forbidden() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
      <p className="text-sm font-semibold text-teal-700">NCKU-RAG · 403</p>
      <h1 className="mt-3 text-3xl font-semibold">無法存取後台</h1>
      <p className="mt-5 text-sm leading-7 text-slate-600">此帳號目前無法使用後台。請聯絡管理員確認權限，或登出後改用其他帳號。</p>
      <div className="mt-7 flex flex-wrap items-center gap-5">
        <SignOutButton />
        <Link href="/" className="text-sm text-slate-600 underline underline-offset-4">返回首頁</Link>
      </div>
    </main>
  );
}
