/*
This file shows the public home page for the starter app.
Edit this file when the first page text, links, or starter hints change.
Copy this file as a starting point when you add another public page.
*/

import { Link } from "react-router-dom";

export function HomePage() {
  return (
    <section className="grid gap-6 md:grid-cols-[1.3fr_0.9fr]">
      <div className="rounded-3xl bg-slate-900 px-8 py-10 text-white shadow-xl shadow-slate-900/20">
        <p className="mb-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-sm">React + aiohttp + SQLite</p>
        <h2 className="text-4xl font-semibold leading-tight">A small starter for PWA school projects.</h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200">
          This template includes login, admin access, notes, tests, migrations, and a WebSocket example. It stays simple on purpose.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="rounded-full bg-sky-400 px-5 py-3 font-semibold text-slate-950" to="/login">
            Open login page
          </Link>
        </div>
      </div>
      <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-8 shadow-lg shadow-slate-200/60">
        <h3 className="text-lg font-semibold text-slate-900">Default users in dev</h3>
        <div className="mt-4 space-y-3 text-sm text-slate-700">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="font-medium">Normal user</p>
            <p>Username: user</p>
            <p>Password: user</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="font-medium">Admin user</p>
            <p>Username: admin</p>
            <p>Password: admin</p>
          </div>
        </div>
      </div>
    </section>
  );
}
