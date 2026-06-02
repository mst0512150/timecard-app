"use client";

import { useEffect, useState } from "react";
import { AdminScreen } from "@/components/AdminScreen";
import {
  ADMIN_PASSWORD,
  clearAdminAuthed,
  isAdminAuthed,
  setAdminAuthed,
} from "@/lib/admin-auth";

export function AdminGate() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    setAuthed(isAdminAuthed());
    setReady(true);
  }, []);

  useEffect(() => {
    // 管理画面から離れたら毎回ログアウト扱いにする
    return () => {
      clearAdminAuthed();
    };
  }, []);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    if (password !== ADMIN_PASSWORD) {
      setLoginError("パスワードが違います");
      return;
    }
    setAdminAuthed();
    setAuthed(true);
    setPassword("");
  }

  function handleLogout() {
    clearAdminAuthed();
    setAuthed(false);
    setPassword("");
    setLoginError(null);
  }

  if (!ready) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-lg items-center justify-center px-4">
        <p className="text-sm text-slate-500">読み込み中…</p>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-lg items-center justify-center px-4 py-8">
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            ADMIN
          </p>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">管理画面ログイン</h1>
          <p className="mt-1 text-sm text-slate-600">パスワードを入力してください</p>
          <form onSubmit={handleLogin} className="mt-5 space-y-3">
            <label className="block text-sm">
              <span className="text-slate-600">パスワード</span>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-base outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </label>
            {loginError ? (
              <p className="text-sm text-red-600" role="alert">
                {loginError}
              </p>
            ) : null}
            <button
              type="submit"
              className="w-full rounded-xl bg-slate-900 py-3.5 text-sm font-semibold text-white"
            >
              ログイン
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <AdminScreen onLogout={handleLogout} />;
}
