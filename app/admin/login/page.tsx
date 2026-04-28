import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import type { Route } from 'next';

// L0-10: admin login. Compares submitted password against ADMIN_PASSWORD env;
// on match sets `28t_admin_session` cookie to ADMIN_SESSION_KEY value.
// Single-operator workflow — no password reset, no 2FA.

async function loginAction(formData: FormData): Promise<void> {
  'use server';
  const password = formData.get('password');
  const next = formData.get('next');
  if (typeof password !== 'string') redirect('/admin/login?error=invalid' as Route);
  if (password !== process.env.ADMIN_PASSWORD) {
    redirect('/admin/login?error=invalid' as Route);
  }
  const sessionKey = process.env.ADMIN_SESSION_KEY;
  if (!sessionKey) redirect('/admin/login?error=disabled' as Route);
  const cookieStore = await cookies();
  cookieStore.set('28t_admin_session', sessionKey, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  const target = typeof next === 'string' && next.startsWith('/admin') ? next : '/admin';
  redirect(target as Route);
}

type Props = {
  searchParams: Promise<{ error?: string; next?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const { error, next } = await searchParams;
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-6 px-4">
      <h1 className="font-display text-2xl font-bold tracking-tighter text-text">
        28 and Three / Studio
      </h1>
      <form action={loginAction} className="flex w-full flex-col gap-3">
        <input type="hidden" name="next" value={next ?? '/admin'} />
        <input
          type="password"
          name="password"
          required
          placeholder="password"
          autoComplete="current-password"
          className="rounded-sm border border-border-strong bg-surface px-3 py-2 font-mono text-sm text-text outline-none focus:border-accent"
        />
        <button
          type="submit"
          className="inline-flex min-h-[44px] items-center justify-center rounded-sm bg-accent px-6 font-mono text-2xs uppercase tracking-widest text-text transition-colors hover:bg-accent-dim"
        >
          Sign in
        </button>
        {error ? (
          <p className="font-mono text-2xs uppercase tracking-widest text-negative">
            {error === 'disabled' ? 'admin disabled' : 'invalid'}
          </p>
        ) : null}
      </form>
    </div>
  );
}
