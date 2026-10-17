"use client";

import { useActionState, useState } from "react";
import { NOTIFICATION_KINDS, type NotificationPrefs, type ProfileDto } from "@mybook/shared";
import { FormMessage, PasswordField } from "@/components/form";
import type { Dictionary } from "@/i18n/get-dictionary";
import { changePassword, closeAccount, saveSettings } from "./actions";

type S = Dictionary["settings"];

const readonlyClass = "h-12 w-full min-w-0 rounded-xs border border-line bg-paper-2 px-3.5 text-[15px] text-ink-muted";
const inputClass = "h-12 w-full min-w-0 rounded-xs border border-line bg-paper-3 px-3.5 text-[15px] text-ink outline-none focus:border-plum-500 aria-invalid:border-overdue";

/** A heading column on the left and the controls on the right (stacked on phones). */
export function SettingsSection({ id, title, note, children }: { id: string; title: string; note: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid grid-cols-1 gap-x-12 gap-y-5 border-t border-line pt-7 md:grid-cols-[minmax(180px,240px)_minmax(0,1fr)]">
      <div className="flex flex-col gap-1.5">
        <h2 id={id} className="m-0 font-serif text-[28px] font-normal">
          {title}
        </h2>
        <span className="text-[13px] leading-normal text-ink-muted">{note}</span>
      </div>
      {children}
    </section>
  );
}

function Labeled({ label, children, htmlFor }: { label: React.ReactNode; children: React.ReactNode; htmlFor: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

/** Pill switch backed by a real checkbox, so the form posts it. */
function Switch({ name, defaultChecked, label, locked }: { name: string; defaultChecked: boolean; label: string; locked?: boolean }) {
  return (
    <label className={`relative inline-flex ${locked ? "cursor-not-allowed opacity-55" : "cursor-pointer"}`}>
      <input type="checkbox" role="switch" name={name} defaultChecked={defaultChecked} disabled={locked} aria-label={label} className="peer sr-only" />
      {/* Disabled checkboxes are not posted; keep a locked switch on. */}
      {locked && <input type="hidden" name={name} value="on" />}
      <span
        aria-hidden
        className="relative h-5.5 w-10 rounded-full bg-line transition-colors peer-checked:bg-plum-700 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-plum-500 after:absolute after:top-0.75 after:left-0.75 after:size-4 after:rounded-full after:bg-paper-3 after:transition-transform after:duration-300 peer-checked:after:translate-x-4.5"
      />
    </label>
  );
}

/** Profile, language and notifications are saved together with "Save changes". */
export function SettingsForm({ profile, prefs, s, locale, faculties, languageNames, saved, unknownError }: {
  profile: ProfileDto;
  prefs: NotificationPrefs;
  s: S;
  locale: string;
  faculties: string[];
  languageNames: Record<"tr" | "en", string>;
  saved: boolean;
  unknownError: string;
}) {
  const [state, action, pending] = useActionState(saveSettings, { error: null, done: saved });
  const [language, setLanguage] = useState(profile.locale);
  const facultyOptions = profile.faculty && !faculties.includes(profile.faculty) ? [profile.faculty, ...faculties] : faculties;

  return (
    <form action={action} className="flex flex-col gap-10">
      <input type="hidden" name="currentLocale" value={locale} />
      <input type="hidden" name="locale" value={language} />

      <SettingsSection id="h-profile" title={s.profile} note={s.profileNote}>
        <div className="grid grid-cols-1 gap-x-5 gap-y-4.5 sm:grid-cols-2">
          <Labeled label={s.fullName} htmlFor="p-name">
            <input id="p-name" value={profile.fullName} readOnly className={readonlyClass} />
          </Labeled>
          <Labeled label={s.studentNumber} htmlFor="p-no">
            <input id="p-no" value={profile.studentNumber ?? profile.cardNumber} readOnly className={readonlyClass} />
          </Labeled>
          <Labeled label={s.email} htmlFor="p-email">
            <input id="p-email" type="email" value={profile.email} readOnly className={readonlyClass} />
          </Labeled>
          <Labeled
            htmlFor="p-phone"
            label={
              <>
                {s.phone} <span className="font-normal text-ink-muted">{s.optional}</span>
              </>
            }
          >
            <input
              id="p-phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              defaultValue={profile.phone ?? ""}
              placeholder="+90 5__ ___ __ __"
              aria-invalid={state.error === "invalid_phone" || undefined}
              className={inputClass}
            />
          </Labeled>
          <Labeled label={s.faculty} htmlFor="p-faculty">
            <select id="p-faculty" name="faculty" defaultValue={profile.faculty ?? ""} className={`${inputClass} appearance-none`}>
              <option value="">—</option>
              {facultyOptions.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </Labeled>
        </div>
      </SettingsSection>

      <SettingsSection id="h-lang" title={s.language} note={s.languageNote}>
        <div role="radiogroup" aria-labelledby="h-lang" className="inline-flex self-start justify-self-start border border-ink">
          {(["tr", "en"] as const).map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={language === l}
              onClick={() => setLanguage(l)}
              className={`eyebrow h-11 px-5.5 text-[11px] ${language === l ? "bg-ink text-paper" : "text-ink hover:bg-paper-2"}`}
            >
              {languageNames[l]}
            </button>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection id="h-notif" title={s.notifications} note={s.notificationsNote}>
        <div className="flex flex-col">
          <div className="grid grid-cols-[minmax(0,1fr)_64px_64px] gap-3 border-b border-line pb-2.5 sm:grid-cols-[minmax(0,1fr)_72px_72px]">
            <span />
            <span className="eyebrow text-center text-[9.5px] text-ink-muted">{s.byEmail}</span>
            <span className="eyebrow text-center text-[9.5px] text-ink-muted">{s.byPush}</span>
          </div>
          {NOTIFICATION_KINDS.map((kind) => {
            const [label, help] = s.kinds[kind];
            const locked = kind === "overdue";
            return (
              <div key={kind} className="grid grid-cols-[minmax(0,1fr)_64px_64px] items-center gap-3 border-b border-line py-4 sm:grid-cols-[minmax(0,1fr)_72px_72px]">
                <span className="flex flex-col gap-0.5">
                  <span className="text-[15px]">{label}</span>
                  <span className="text-[13px] text-ink-muted">{help}</span>
                </span>
                {(["email", "push"] as const).map((ch) => (
                  <span key={ch} className="flex justify-center">
                    <Switch
                      name={`${kind}.${ch}`}
                      defaultChecked={prefs[kind][ch]}
                      locked={locked}
                      label={s.channelLabel.replace("{kind}", label).replace("{channel}", ch === "email" ? s.byEmail : s.byPush)}
                    />
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      </SettingsSection>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-6">
        {state.error && (
          <span role="alert" className="mr-auto text-sm text-overdue">
            {state.error === "invalid_phone" ? s.invalidPhone : unknownError}
          </span>
        )}
        {state.done && !state.error && (
          <span role="status" className="mr-auto animate-swap text-sm text-available">
            {s.saved}
          </span>
        )}
        <button type="reset" onClick={() => setLanguage(profile.locale)} className="eyebrow h-13 px-5 text-[11px] text-ink hover:text-plum-500">
          {s.discard}
        </button>
        <button type="submit" disabled={pending} className="eyebrow h-13 bg-plum-700 px-7 text-[11px] text-paper hover:bg-plum-900 disabled:opacity-60">
          {s.saveChanges}
        </button>
      </div>
    </form>
  );
}

export function PasswordForm({ s, auth }: { s: S; auth: Dictionary["auth"] }) {
  const [state, action, pending] = useActionState(changePassword, { error: null });
  const message = state.error === "wrong_password" ? s.wrongPassword : state.error === "weak_password" ? auth.errors.weak_password : state.error ? auth.errors.unknown : null;
  return (
    <form action={action} className="flex flex-col gap-4">
      {message && <FormMessage tone="error">{message}</FormMessage>}
      {state.done && <FormMessage tone="success">{s.passwordUpdated}</FormMessage>}
      <div className="flex flex-wrap items-end gap-x-5 gap-y-4.5">
        <div className="flex-[1_1_200px]">
          <PasswordField
            name="currentPassword"
            label={s.currentPassword}
            showLabel={auth.showPassword}
            hideLabel={auth.hidePassword}
            autoComplete="current-password"
            required
            invalid={state.error === "wrong_password"}
          />
        </div>
        <div className="flex-[1_1_200px]">
          <PasswordField
            name="newPassword"
            label={s.newPassword}
            showLabel={auth.showPassword}
            hideLabel={auth.hidePassword}
            autoComplete="new-password"
            minLength={10}
            required
            invalid={state.error === "weak_password"}
          />
        </div>
        <button type="submit" disabled={pending} className="eyebrow h-13 border border-ink px-5.5 text-[11px] text-ink hover:bg-ink hover:text-paper disabled:opacity-60">
          {s.updatePassword}
        </button>
      </div>
    </form>
  );
}

export function DataControls({ s, locale, canClose }: { s: S; locale: string; canClose: boolean }) {
  const [state, action, pending] = useActionState(closeAccount, { error: null });
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-7 gap-y-4">
        <a href={`/${locale}/account/settings/export`} download className="eyebrow inline-flex h-12 items-center border border-ink px-5.5 text-[11px] text-ink no-underline hover:bg-ink hover:text-paper">
          {s.download}
        </a>
        <form action={action} onSubmit={(e) => !window.confirm(s.closeConfirm) && e.preventDefault()}>
          <input type="hidden" name="lang" value={locale} />
          <button
            type="submit"
            disabled={!canClose || pending}
            className="eyebrow h-12 text-[11px] text-overdue underline underline-offset-5 disabled:cursor-not-allowed disabled:text-ink-muted disabled:no-underline"
          >
            {s.close}
          </button>
        </form>
        <span className="text-[13px] text-ink-muted">{canClose ? s.closeNote : s.closeBlocked}</span>
      </div>
      {state.error && <FormMessage tone="error">{s.closeBlocked}</FormMessage>}
    </div>
  );
}
