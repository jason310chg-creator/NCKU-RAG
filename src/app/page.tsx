const mvpItems = [
  "Admin login and role-based access",
  "FAQ, document, link, and structured content records",
  "Draft, published, and archived publishing states",
  "File upload pipeline for PDF, DOCX, TXT, and Markdown",
  "REST API for list, detail, search, and RAG export",
];

const stackItems = [
  "Next.js 16 App Router",
  "TypeScript",
  "PostgreSQL",
  "Prisma",
  "Vitest",
  "Docker Compose",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-[52vh] w-full max-w-6xl flex-col justify-center gap-8 px-6 py-16">
          <div className="max-w-3xl">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
              Knowledge Base Data Platform
            </p>
            <h1 className="text-4xl font-semibold leading-tight text-slate-950 sm:text-5xl">
              RAG-ready data management for department knowledge.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              The first milestone focuses on clean data creation, publishing,
              source quality, search, and export APIs before any chatbot or
              embedding work begins.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm font-medium">
            <span className="rounded border border-slate-300 bg-slate-50 px-3 py-2">
              MVP initialized
            </span>
            <span className="rounded border border-slate-300 bg-slate-50 px-3 py-2">
              TDD enabled
            </span>
            <span className="rounded border border-slate-300 bg-slate-50 px-3 py-2">
              PostgreSQL planned
            </span>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-12 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">MVP Scope</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {mvpItems.map((item) => (
              <div
                className="rounded-md border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700"
                key={item}
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <aside className="rounded-md border border-slate-200 bg-white p-5">
          <h2 className="text-xl font-semibold text-slate-950">Base Stack</h2>
          <ul className="mt-5 space-y-3 text-sm text-slate-700">
            {stackItems.map((item) => (
              <li className="flex items-center gap-3" key={item}>
                <span className="h-2 w-2 rounded-full bg-teal-600" />
                {item}
              </li>
            ))}
          </ul>
        </aside>
      </section>
    </main>
  );
}
