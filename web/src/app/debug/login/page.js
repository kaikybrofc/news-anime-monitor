import { redirect } from "next/navigation";
import { isDebugSessionAuthenticated } from "@/lib/debug-auth";

export const metadata = {
  title: "Login Debug | OmniZap",
  description: "Acesso protegido ao painel de debug operacional.",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function DebugLoginPage({ searchParams }) {
  const authenticated = await isDebugSessionAuthenticated();
  if (authenticated) {
    redirect("/debug");
  }

  const resolvedSearchParams = await Promise.resolve(searchParams);
  const error = String(resolvedSearchParams?.error || "").trim();
  const hasPasswordMissing = error === "password_missing";
  const hasInvalidPassword = error === "invalid_password";
  const isNotConfigured = error === "not_configured";

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-8 animate-fade-in">
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1 rounded-full bg-rose-500" />
          <h1 className="!text-4xl md:!text-5xl">Painel de Debug</h1>
        </div>
        <p className="lead text-slate-300">
          Área protegida. Informe a senha definida no arquivo <code>.env</code>.
        </p>
      </section>

      <section className="info-card flex flex-col gap-5">
        {hasPasswordMissing ? (
          <p className="text-sm text-amber-400">
            Informe a senha para continuar.
          </p>
        ) : null}
        {hasInvalidPassword ? (
          <p className="text-sm text-rose-400">Senha inválida.</p>
        ) : null}
        {isNotConfigured ? (
          <p className="text-sm text-rose-400">
            Senha não configurada. Defina <code>DEBUG_DASHBOARD_PASSWORD</code> no <code>.env</code>.
          </p>
        ) : null}

        <form action="/debug/auth" method="post" className="flex flex-col gap-4">
          <input
            type="password"
            name="password"
            placeholder="Senha do painel de debug"
            className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-rose-500/60"
            autoComplete="current-password"
            required
          />
          <button type="submit" className="btn btn-primary w-full">
            Entrar
          </button>
        </form>
      </section>
    </div>
  );
}
