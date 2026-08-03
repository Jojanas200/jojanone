"use client";

import { useState } from "react";
import { Check, Send } from "lucide-react";
import { contact } from "@/content/site";

type State =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent" }
  | { kind: "error"; message: string };

export function ContactForm() {
  const { form } = contact;
  const [state, setState] = useState<State>({ kind: "idle" });

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ kind: "sending" });
    const data = Object.fromEntries(new FormData(event.currentTarget));

    try {
      const res = await fetch("/api/site/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (json.ok) setState({ kind: "sent" });
      else
        setState({
          kind: "error",
          message: json.error ?? "Something went wrong. Please try again.",
        });
    } catch {
      setState({
        kind: "error",
        message: "We could not reach the server. Please try again.",
      });
    }
  }

  if (state.kind === "sent") {
    return (
      <div className="s-card">
        <span
          className="s-icon"
          style={{
            background: "rgba(20,184,166,0.12)",
            color: "var(--s-teal)",
          }}
        >
          <Check size={20} />
        </span>
        <h2 className="s-h3" style={{ marginBottom: 10 }}>
          {form.successTitle}
        </h2>
        <p className="s-small">{form.successBody}</p>
      </div>
    );
  }

  return (
    <form className="s-card s-form" onSubmit={onSubmit} noValidate>
      <h2 className="s-h3" style={{ marginBottom: 22 }}>
        {form.title}
      </h2>

      <div className="s-field-row">
        <label className="s-field">
          <span>Name</span>
          <input name="name" required placeholder={form.namePlaceholder} />
        </label>
        <label className="s-field">
          <span>Email</span>
          <input
            name="email"
            type="email"
            required
            placeholder={form.emailPlaceholder}
          />
        </label>
      </div>

      <div className="s-field-row">
        <label className="s-field">
          <span>Company</span>
          <input name="company" placeholder={form.companyPlaceholder} />
        </label>
        <label className="s-field">
          <span>Subject</span>
          <input name="subject" placeholder={form.subjectPlaceholder} />
        </label>
      </div>

      <label className="s-field">
        <span>Message</span>
        <textarea
          name="message"
          required
          rows={6}
          placeholder={form.messagePlaceholder}
        />
      </label>

      {/* Hidden from people, irresistible to bots. */}
      <input
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="s-honeypot"
      />

      {state.kind === "error" ? (
        <p role="alert" className="s-form-error">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        className="s-btn s-btn-primary"
        disabled={state.kind === "sending"}
      >
        {state.kind === "sending" ? "Sending..." : form.submitLabel}
        <Send size={15} />
      </button>
    </form>
  );
}
