import { useState, type FormEvent } from "react";
import { ArrowRight, Atom, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { getApiErrorMessage } from "../services/api";

export default function AuthScreen() {
  const { email: savedEmail, login, register, reauthRequired } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState(savedEmail ?? "");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (isRegistering) {
        await register(email, password, fullName);
      } else {
        await login(email, password);
      }
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-obsidian px-5 py-12">
      <div className="pointer-events-none absolute -left-40 top-1/4 h-96 w-96 rounded-full bg-electric/10 blur-[120px]" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-cyan/10 blur-[120px]" />
      <section className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/[0.08] bg-panel shadow-2xl shadow-black/30 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="hidden flex-col justify-between bg-gradient-to-br from-blue-500/15 via-panel to-cyan-500/10 p-12 lg:flex">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-electric text-white shadow-glow">
              <Atom size={22} />
            </span>
            <span className="max-w-[220px] text-sm font-semibold leading-5 tracking-tight text-white">
              RAG Document <span className="text-cyan">Chunking Pipeline</span>
            </span>
          </div>
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-electric/20 bg-electric/10 px-3 py-1.5 text-xs font-medium text-blue-200">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan" />
              Your private knowledge workspace
            </div>
            <h1 className="max-w-md text-4xl font-semibold leading-tight tracking-tight text-white">
              Find clarity in every document.
            </h1>
            <p className="mt-5 max-w-sm text-sm leading-7 text-slate-400">
              Bring your files together and get grounded answers with sources
              you can trust.
            </p>
          </div>
          <p className="text-xs text-slate-600">
            Secure access · Source-grounded answers
          </p>
        </div>

        <div className="p-7 sm:p-10 lg:p-12">
          <div className="mb-9 flex items-center gap-3 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-electric text-white">
              <Atom size={20} />
            </span>
            <span className="max-w-[230px] text-sm font-semibold leading-5 tracking-tight text-white">
              RAG Document <span className="text-cyan">Chunking Pipeline</span>
            </span>
          </div>
          <div className="mb-8">
            <p className="text-sm font-medium text-cyan">
              {isRegistering ? "Get started" : "Welcome back"}
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
              {isRegistering ? "Create your account" : "Sign in to your workspace"}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              {isRegistering
                ? "Set up your secure document workspace."
                : reauthRequired
                  ? "Your session expired. Sign in to continue your conversation."
                  : "Pick up where your knowledge work left off."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {isRegistering && (
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">
                  Full name
                </span>
                <input
                  required
                  autoComplete="name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Alex Morgan"
                  className="field-control"
                />
              </label>
            )}
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-300">
                Work email
              </span>
              <span className="relative block">
                <Mail className="field-icon" size={17} />
                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@company.com"
                  className="field-control pl-11"
                />
              </span>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-300">
                Password
              </span>
              <span className="relative block">
                <LockKeyhole className="field-icon" size={17} />
                <input
                  required
                  type={showPassword ? "text" : "password"}
                  autoComplete={isRegistering ? "new-password" : "current-password"}
                  minLength={isRegistering ? 8 : undefined}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  className="field-control pl-11 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-500 transition hover:text-slate-300"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </label>

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200"
              >
                {error}
              </p>
            )}

            <button type="submit" disabled={submitting} className="primary-button w-full">
              {submitting
                ? "Please wait..."
                : isRegistering
                  ? "Create account"
                  : "Sign in"}
              {!submitting && <ArrowRight size={17} />}
            </button>
          </form>

          <p className="mt-7 text-center text-sm text-slate-400">
            {isRegistering
              ? "Already have an account?"
              : "New to the pipeline?"}{" "}
            <button
              type="button"
              onClick={() => {
                setError("");
                setIsRegistering((registering) => !registering);
              }}
              className="font-medium text-blue-300 transition hover:text-cyan"
            >
              {isRegistering ? "Sign in" : "Create an account"}
            </button>
          </p>
          <p className="mt-8 text-center text-xs leading-5 text-slate-600">
            Your account and documents are accessible only to you.
          </p>
        </div>
      </section>
    </main>
  );
}
