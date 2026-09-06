import Link from "next/link";
import { GoogleSignInButton } from "./sign-in-button";

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const failed = Boolean((await searchParams).error);
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-16">
      <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold tracking-wide text-teal-700">NCKU-RAG</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-950">後台登入</h1>
        <p className="mt-4 text-sm leading-7 text-slate-600">
          僅限已獲授權的 Google 帳號。請使用管理員登記的完整電子郵件地址。
        </p>
        {failed && <p role="alert" className="mt-5 rounded-md bg-red-50 p-3 text-sm leading-6 text-red-800">
          登入未完成。請確認使用已獲授權的 Google 帳號，或聯絡管理員。
        </p>}
        <div className="mt-7"><GoogleSignInButton /></div>
        <Link href="/" className="mt-6 inline-block text-sm text-slate-600 underline underline-offset-4">返回首頁</Link>
      </section>
    </main>
  );
}
