"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/lib/actions/admin";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, null);
  return (
    <form action={action} className="card mt-6 space-y-4 p-5">
      <div>
        <label htmlFor="password" className="label">
          كلمة السر
        </label>
        <input id="password" name="password" type="password" required autoComplete="current-password" dir="ltr" className="input" />
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "جارٍ التحقق…" : "دخول"}
      </button>
    </form>
  );
}
