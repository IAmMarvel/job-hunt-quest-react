import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  createCompany,
  createCollection,
  createMotivation,
  createNote as createNoteRemote,
  createQuestion,
  createSkill,
  deleteCompany as deleteCompanyRemote,
  deleteCollection as deleteCollectionRemote,
  deleteMotivation as deleteMotivationRemote,
  deleteNote as deleteNoteRemote,
  deleteQuestion as deleteQuestionRemote,
  deleteSkill as deleteSkillRemote,
  fetchUserData,
  fetchNotes,
  importBrowserNotes,
  importBrowserData,
  supabase,
  updateCompany,
  updateMotivation,
  updateNote as updateNoteRemote,
  updateQuestion,
  updateSkill,
} from "./lib/supabase.js";

const STORAGE_KEYS = {
  companies: "job-hunt-quest-v1",
  collections: "job-hunt-quest-collections-v1",
  questions: "job-hunt-quest-questions-v1",
  motivations: "job-hunt-quest-motivations-v1",
  skills: "job-hunt-quest-skills-v1",
  notes: "job-hunt-quest-notes-v1",
  target: "job-hunt-quest-target-v1",
};
const DEFAULT_COMPANY_TARGET = 100;
const BROWSER_IMPORT_KEY = "job-hunt-quest-browser-import-v1";
const USER_CACHE_KEY = "job-hunt-quest-user-cache-v1";

const STATUSES = ["selected", "running", "pending", "rejected"];
const INTERVIEW_LANGUAGES = ["Java", "Python"];
const DEFAULT_COLLECTION_ID = "local-bangalore-interviews";
const DEFAULT_COLLECTION = {
  id: DEFAULT_COLLECTION_ID,
  name: "Bangalore Interviews",
};
const NEXT_STATUS = {
  running: "selected",
  selected: "pending",
  pending: "rejected",
  rejected: "running",
};
const STATUS_LABELS = {
  selected: "Selected",
  running: "Scheduled",
  pending: "Pending",
  rejected: "Not Selected",
};
const SKILL_STATUSES = ["To Learn", "Learning", "Practiced", "Confident"];
const QUESTION_TOPICS = [
  "Java",
  "Java Streams",
  "Collections",
  "Spring Boot",
  "Microservices",
  "React",
  "SQL",
  "DSA",
  "System Design",
  "Behavioral",
  "Other",
];
const QUESTION_ROUNDS = [
  "Technical",
  "HR",
  "Managerial",
  "Coding",
  "System Design",
  "Behavioral",
  "Other",
];
const SKILL_CATEGORIES = [
  "Java",
  "Spring Boot",
  "Microservices",
  "Python / FastAPI",
  "React / Frontend",
  "SQL / Database",
  "System Design",
  "DSA",
  "Cloud / DevOps",
  "AI / RAG",
  "Other",
];

const INITIAL_COMPANIES = [
  { id: 1, name: "Capgemini", rounds: 4, status: "rejected" },
  { id: 2, name: "EPAM", rounds: 1, status: "rejected" },
  { id: 3, name: "TCS", rounds: 2, status: "rejected" },
  { id: 4, name: "Baxter", rounds: 1, status: "rejected" },
  { id: 5, name: "Calsoft", rounds: 1, status: "rejected" },
  { id: 6, name: "NuSummit", rounds: 1, status: "rejected" },
  { id: 7, name: "Aziro", rounds: 2, status: "rejected" },
  { id: 8, name: "Zensar", rounds: 1, status: "rejected" },
  { id: 9, name: "Deloitte", rounds: 1, status: "rejected" },
  { id: 10, name: "Mphasis", rounds: 1, status: "rejected" },
];

function loadFromStorage(key, validate, fallback) {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    return Array.isArray(saved) ? saved.filter(validate) : fallback;
  } catch (error) {
    console.warn(`Could not restore ${key}:`, error);
    return fallback;
  }
}

function loadCompanyTarget() {
  try {
    const saved = Number(localStorage.getItem(STORAGE_KEYS.target));
    return Number.isInteger(saved) && saved > 0 ? saved : DEFAULT_COMPANY_TARGET;
  } catch (error) {
    console.warn("Could not restore company target:", error);
    return DEFAULT_COMPANY_TARGET;
  }
}

function loadCompanies(fallback = INITIAL_COMPANIES) {
  return loadFromStorage(
    STORAGE_KEYS.companies,
    (company) =>
      company &&
      Number.isFinite(Number(company.id)) &&
      typeof company.name === "string" &&
      STATUSES.includes(company.status),
    fallback,
  )
    .map((company) => ({
      id: Number(company.id),
      name: company.name.trim(),
      rounds: Math.max(1, Math.min(20, Number(company.rounds) || 1)),
      status: company.status,
      is_ai_interview: company.is_ai_interview === true,
      interview_language: INTERVIEW_LANGUAGES.includes(
        company.interview_language,
      )
        ? company.interview_language
        : null,
      scheduled_at:
        typeof company.scheduled_at === "string" &&
        !Number.isNaN(Date.parse(company.scheduled_at))
          ? company.scheduled_at
          : null,
      collection_id: company.collection_id ?? DEFAULT_COLLECTION_ID,
    }))
    .filter((company) => company.name);
}

function loadCollections() {
  return loadFromStorage(
    STORAGE_KEYS.collections,
    (collection) =>
      collection &&
      (typeof collection.id === "string" ||
        (typeof collection.id === "number" &&
          Number.isFinite(collection.id))) &&
      typeof collection.name === "string" &&
      collection.name.trim(),
    [DEFAULT_COLLECTION],
  ).map((collection) => ({
    id: collection.id,
    name: collection.name.trim(),
  }));
}

function loadQuestions() {
  return loadFromStorage(
    STORAGE_KEYS.questions,
    (question) =>
      question &&
      typeof question.question === "string" &&
      question.question.trim() &&
      typeof question.company === "string" &&
      question.company.trim() &&
      typeof question.topic === "string" &&
      question.topic.trim() &&
      typeof question.round === "string" &&
      question.round.trim(),
    [],
  );
}

function loadMotivations() {
  return loadFromStorage(
    STORAGE_KEYS.motivations,
    (line) => typeof line === "string" && line.trim(),
    [],
  );
}

function loadSkills() {
  return loadFromStorage(
    STORAGE_KEYS.skills,
    (skill) =>
      skill &&
      typeof skill.name === "string" &&
      skill.name.trim() &&
      typeof skill.category === "string" &&
      SKILL_STATUSES.includes(skill.status),
    [],
  );
}

function loadNotes(storageKey = STORAGE_KEYS.notes) {
  return loadFromStorage(
    storageKey,
    (note) =>
      note &&
      typeof note.id === "string" &&
      typeof note.title === "string" &&
      typeof note.content === "string" &&
      typeof note.updatedAt === "string" &&
      !Number.isNaN(Date.parse(note.updatedAt)),
    [],
  );
}

function loadUserDataCache(userId) {
  try {
    const cached = JSON.parse(
      localStorage.getItem(`${USER_CACHE_KEY}:${userId}`),
    );
    const hasId = (item) =>
      item &&
      (typeof item.id === "string" ||
        (typeof item.id === "number" && Number.isFinite(item.id)));
    if (
      !cached ||
      !Array.isArray(cached.companies) ||
      !Array.isArray(cached.collections) ||
      !Array.isArray(cached.questions) ||
      !Array.isArray(cached.skills) ||
      !Array.isArray(cached.motivations)
    ) {
      return null;
    }

    return {
      companies: cached.companies.filter(
        (item) =>
          hasId(item) &&
          typeof item.name === "string" &&
          STATUSES.includes(item.status) &&
          (item.interview_language == null ||
            INTERVIEW_LANGUAGES.includes(item.interview_language)) &&
          (item.scheduled_at == null ||
            (typeof item.scheduled_at === "string" &&
              !Number.isNaN(Date.parse(item.scheduled_at)))) &&
          (item.collection_id == null ||
            typeof item.collection_id === "string" ||
            Number.isFinite(item.collection_id)),
      ),
      collections: cached.collections.filter(
        (item) =>
          hasId(item) && typeof item.name === "string" && item.name.trim(),
      ),
      questions: cached.questions.filter(
        (item) =>
          hasId(item) &&
          typeof item.question === "string" &&
          typeof item.company === "string" &&
          typeof item.topic === "string" &&
          typeof item.round === "string",
      ),
      skills: cached.skills.filter(
        (item) =>
          hasId(item) &&
          typeof item.name === "string" &&
          typeof item.category === "string" &&
          SKILL_STATUSES.includes(item.status),
      ),
      motivations: cached.motivations.filter(
        (item) => hasId(item) && typeof item.line === "string",
      ),
      notes: Array.isArray(cached.notes)
        ? cached.notes.filter(
            (item) =>
              hasId(item) &&
              typeof item.title === "string" &&
              typeof item.content === "string" &&
              typeof item.updatedAt === "string" &&
              !Number.isNaN(Date.parse(item.updatedAt)),
          )
        : [],
    };
  } catch (error) {
    console.warn("Could not restore cached account data:", error);
    return null;
  }
}

function toScheduledAt(dateValue, timeValue, period) {
  if (!dateValue || !timeValue) return null;
  const match = timeValue.match(/^(0?[1-9]|1[0-2]):([0-5]\d)$/);
  if (!match) return null;
  const hour12 = Number(match[1]);
  const hour24 = (hour12 % 12) + (period === "PM" ? 12 : 0);
  const date = new Date(`${dateValue}T${String(hour24).padStart(2, "0")}:${match[2]}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getScheduleInputValues(value) {
  if (!value || Number.isNaN(Date.parse(value))) {
    return { date: "", time: "", period: "AM" };
  }
  const date = new Date(value);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  const [dateValue, timeValue] = localDate.toISOString().slice(0, 16).split("T");
  const [hour, minute] = timeValue.split(":").map(Number);
  const hour12 = hour % 12 || 12;
  return {
    date: dateValue,
    time: `${String(hour12).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    period: hour >= 12 ? "PM" : "AM",
  };
}

function formatScheduledAt(value) {
  if (!value || Number.isNaN(Date.parse(value))) return "";
  const date = new Date(value);
  const formattedDate = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(date);
  return `${formattedDate} ${formatScheduledTime(date)}`;
}

function formatScheduledTime(value) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(value);
}

function saveUserDataCache(userId, data) {
  try {
    localStorage.setItem(`${USER_CACHE_KEY}:${userId}`, JSON.stringify(data));
  } catch (error) {
    console.warn("Could not cache account data:", error);
  }
}

function usePersistentState(key, initializer, persistLocally) {
  const [value, setValue] = useState(initializer);

  useEffect(() => {
    if (persistLocally) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        console.warn(`Could not save ${key}:`, error);
      }
    }
  }, [key, value, persistLocally]);

  return [value, setValue];
}

function CatLoader({ label, compact = false }) {
  return (
    <span
      className={`cat-loader${compact ? " compact" : ""}`}
      role="status"
      aria-live="polite"
    >
      <svg className="loading-cat" viewBox="0 0 72 54" fill="none" aria-hidden="true">
        <path
          className="cat-tail"
          d="M14 39C4 38 5 25 13 25c5 0 5 5 2 7"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M17 32c0-9 8-15 19-15s19 6 19 15v8H17v-8Z"
          fill="currentColor"
        />
        <path
          d="m22 21-1-11 11 7m13 4 2-11-11 7"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path d="M27 30h1m16 0h1" stroke="#fff9f2" strokeWidth="3" strokeLinecap="round" />
        <path d="M34 35q2 2 4 0" stroke="#fff9f2" strokeWidth="2" strokeLinecap="round" />
        <path d="M22 43v5m12-5v5m12-5v5" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <path d="M8 49h56" stroke="#315a4730" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span className="cat-loader-label">{label}</span>
    </span>
  );
}

function AuthScreen() {
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authMessage, setAuthMessage] = useState(() =>
    new URLSearchParams(window.location.search).get("confirmed") === "1"
      ? "Email confirmed. Please sign in."
      : "",
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("confirmed")) {
      url.searchParams.delete("confirmed");
      window.history.replaceState(null, "", url);
    }
  }, []);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setAuthMessage("");
    const slowSignInNotice = creatingAccount
      ? null
      : window.setTimeout(() => {
          setAuthMessage("Still connecting to the sign-in service...");
        }, 4000);

    try {
      const result = creatingAccount
        ? await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              emailRedirectTo: new URL(
                import.meta.env.BASE_URL,
                window.location.origin,
              ).toString(),
            },
          })
        : await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
      if (result.error) throw result.error;
      if (creatingAccount && !result.data.session) {
        setAuthMessage("Account created. Check your email to confirm your address, then sign in.");
      }
    } catch (error) {
      const errorMessage = error.message || "Authentication failed. Please try again.";
      setAuthMessage(
        errorMessage.includes("Sign-in request timed out")
          ? "Sign-in timed out while waiting for Supabase. Check your connection and try again."
          : errorMessage,
      );
    } finally {
      if (slowSignInNotice !== null) {
        window.clearTimeout(slowSignInNotice);
      }
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="eyebrow">JOB HUNT QUEST</div>
        <h1 className="auth-title">
          {creatingAccount ? "Create your account" : "Welcome back"}
          <svg
            className="auth-sprout"
            viewBox="0 0 64 64"
            fill="none"
            aria-hidden="true"
          >
            <path d="M30 54c1-17 1-27-7-38" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            <path d="M28 30C14 29 8 20 9 10c13 0 21 6 21 19M31 40c2-15 10-21 24-21 0 12-6 21-24 24" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="m49 6 3-4m5 11 5-2m-5 10 5 2" stroke="#ed8f83" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </h1>
        <p>Sign in to keep your job hunt data synced across devices.</p>
        <form className="auth-form" onSubmit={submit}>
          <label className="auth-field">
            <span>Email</span>
            <span className="auth-input-wrap">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
                <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </span>
          </label>
          <label className="auth-field">
            <span>Password</span>
            <span className="auth-input-wrap">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="5" y="10" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
                <path d="M8 10V7a4 4 0 1 1 8 0v3m-4 4v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input
                type={showPassword ? "text" : "password"}
                autoComplete={creatingAccount ? "new-password" : "current-password"}
                minLength="8"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                className="password-toggle"
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A10.8 10.8 0 0 1 12 5c5 0 8.5 4.5 9 7-.2 1.1-1.1 2.5-2.5 3.7M6.2 6.2C3.8 7.7 2.4 10.3 2 12c.5 2.5 4 7 10 7 1 0 2-.2 2.9-.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" stroke="currentColor" strokeWidth="2" />
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                    <path d="m3 3 18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                )}
              </button>
            </span>
          </label>
          <button className="auth-submit" type="submit" disabled={busy}>
            <span>
              {busy ? (
                <CatLoader label="Please wait..." compact />
              ) : creatingAccount ? (
                "Create account"
              ) : (
                "Sign in"
              )}
            </span>
            {!busy && <span aria-hidden="true">→</span>}
          </button>
        </form>
        <div className="message" role="status" aria-live="polite">
          {authMessage}
        </div>
        <div className="auth-divider"><span>OR</span></div>
        <button
          className="auth-toggle"
          type="button"
          onClick={() => {
            setCreatingAccount((current) => !current);
            setAuthMessage("");
          }}
        >
          {creatingAccount ? (
            <>Already have an account? <strong>Sign in</strong></>
          ) : (
            <>New here? <strong>Create an account</strong></>
          )}
        </button>
      </section>
    </main>
  );
}

function SectionHeading({ title, subtitle, aside }) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {aside}
    </div>
  );
}

function DashboardView({
  companies,
  companyTarget,
  collections,
  onOpenCollection,
  onCreateCollection,
  onDeleteCollection,
  onAddCompany,
  onViewCompanies,
  onViewScheduledCompanies,
  onSaveCompanyTarget,
}) {
  const statusCounts = Object.fromEntries(
    STATUSES.map((status) => [
      status,
      companies.filter((company) => company.status === status).length,
    ]),
  );
  const scheduledCompanies = companies.filter(
    (company) => company.status === "running" && company.scheduled_at,
  );
  const upcomingCompanies = [...scheduledCompanies]
    .filter((company) => new Date(company.scheduled_at).getTime() >= Date.now())
    .sort(
      (left, right) =>
        new Date(left.scheduled_at).getTime() -
        new Date(right.scheduled_at).getTime(),
    )
    .slice(0, 3);
  const scheduledCount = scheduledCompanies.length;
  const [newCollectionName, setNewCollectionName] = useState("");
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetValue, setTargetValue] = useState(String(companyTarget));

  function submitCollection(event) {
    event.preventDefault();
    const name = newCollectionName.trim();
    if (!name) return;
    onCreateCollection(name);
    setNewCollectionName("");
  }

  function submitTarget(event) {
    event.preventDefault();
    const target = Number(targetValue);
    if (!Number.isInteger(target) || target < 1 || target > 10_000) return;
    onSaveCompanyTarget(target);
    setEditingTarget(false);
  }

  const targetProgress = Math.min(100, Math.round((companies.length / companyTarget) * 100));

  return (
    <section className="dashboard-page redesigned-dashboard" aria-label="Job search dashboard">
        <div className="dashboard-heading redesigned-page-heading">
          <div>
            <div className="eyebrow">YOUR JOB SEARCH</div>
            <h2>Your job search, at a glance</h2>
            <p>A clear view of your applications and what’s coming next.</p>
          </div>
          <button className="primary-action" type="button" onClick={onAddCompany}>
            <span aria-hidden="true">＋</span> Add a company
          </button>
        </div>

        <div className="dashboard-stats">
          {[
            ["Total companies", companies.length, "Across all collections", "▤"],
            ["Interviews scheduled", scheduledCount, "With a date and time", "◷"],
            ["Awaiting response", statusCounts.pending, "Keep your momentum", "◌"],
            ["Offers & selections", statusCounts.selected, "You’re making progress", "✳"],
          ].map(([label, count, note, icon]) => (
            <article className="dashboard-stat" key={label}>
              <div className="stat-topline">
                <span>{label}</span>
                <span aria-hidden="true">{icon}</span>
              </div>
              <strong>{count}</strong>
              <small>{note}</small>
            </article>
          ))}
        </div>

        <section className="company-goal-panel" aria-labelledby="company-goal-title">
          <div className="company-goal-heading">
            <div>
              <div className="eyebrow">YOUR MILESTONE</div>
              <h3 id="company-goal-title">Company application goal</h3>
            </div>
            {!editingTarget && (
              <button
                type="button"
                className="text-action"
                onClick={() => {
                  setTargetValue(String(companyTarget));
                  setEditingTarget(true);
                }}
              >
                Set target
              </button>
            )}
          </div>
          {editingTarget ? (
            <form className="company-goal-edit" onSubmit={submitTarget}>
              <label htmlFor="company-target">Target companies</label>
              <input
                id="company-target"
                type="number"
                min="1"
                max="10000"
                step="1"
                required
                value={targetValue}
                onChange={(event) => setTargetValue(event.target.value)}
              />
              <button className="primary-action" type="submit">Save target</button>
              <button
                className="secondary-action"
                type="button"
                onClick={() => setEditingTarget(false)}
              >
                Cancel
              </button>
            </form>
          ) : (
            <>
              <div className="company-goal-summary">
                <strong>{companies.length}</strong>
                <span>of {companyTarget} companies</span>
                <b>{targetProgress}%</b>
              </div>
              <div
                className="company-goal-track"
                role="progressbar"
                aria-label="Company application goal"
                aria-valuemin="0"
                aria-valuemax={companyTarget}
                aria-valuenow={Math.min(companies.length, companyTarget)}
              >
                <span style={{ width: `${targetProgress}%` }} />
              </div>
              <p className="company-goal-caption">
                {companies.length >= companyTarget
                  ? "You reached your company application goal!"
                  : `${companyTarget - companies.length} more ${companyTarget - companies.length === 1 ? "company" : "companies"} to reach your goal`}
              </p>
            </>
          )}
        </section>

        <div className="dashboard-content-grid">
          <section className="dashboard-panel" aria-labelledby="upcoming-title">
            <div className="redesign-section-heading">
              <div>
                <h3 id="upcoming-title">Coming up next</h3>
                <p>Your next scheduled interview</p>
              </div>
              <button type="button" className="text-action" onClick={onViewScheduledCompanies}>
                View all <span aria-hidden="true">→</span>
              </button>
            </div>
            {upcomingCompanies.length ? (
              <div className="upcoming-list">
                {upcomingCompanies.map((company, index) => {
                  const date = new Date(company.scheduled_at);
                  const collection = collections.find(
                    (item) => item.id === company.collection_id,
                  );
                  return (
                    <article className="upcoming-item" key={company.id}>
                      <div className="upcoming-date">
                        <strong>
                          {new Intl.DateTimeFormat(undefined, { day: "2-digit" }).format(date)}
                        </strong>
                        <span>
                          {new Intl.DateTimeFormat(undefined, { month: "short" }).format(date)}
                        </span>
                      </div>
                      <div className="upcoming-details">
                        <strong>{company.name}</strong>
                        <span>{collection?.name ?? "Interview"} · {company.rounds} round{company.rounds === 1 ? "" : "s"}</span>
                      </div>
                      <time dateTime={company.scheduled_at}>{formatScheduledTime(date)}</time>
                      {index === 0 && <span className="sr-only">Next interview</span>}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="upcoming-empty">
                <span aria-hidden="true">◷</span>
                <strong>No interviews scheduled yet</strong>
                <p>Add a date and time to a company to see it here.</p>
              </div>
            )}
          </section>

          <section className="dashboard-panel" aria-labelledby="progress-title">
            <div className="redesign-section-heading">
              <div>
                <h3 id="progress-title">Application progress</h3>
                <p>Across all {companies.length} {companies.length === 1 ? "company" : "companies"}</p>
              </div>
              <button type="button" className="text-action" onClick={onViewCompanies}>
                Details <span aria-hidden="true">→</span>
              </button>
            </div>
            <div className="progress-breakdown">
              {STATUSES.map((status) => {
                const label = STATUS_LABELS[status];
                const percent = companies.length
                  ? Math.round((statusCounts[status] / companies.length) * 100)
                  : 0;
                return (
                  <div className="progress-row" key={status}>
                    <span className={`status-dot ${status}`} />
                    <span>{label}</span>
                    <div className="progress-track">
                      <span className={`progress-value ${status}`} style={{ width: `${percent}%` }} />
                    </div>
                    <strong>{statusCounts[status]}</strong>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <section className="collection-section redesigned-collections" aria-labelledby="collections-title">
          <div className="collection-section-heading">
            <div>
              <h3 id="collections-title">Your collections</h3>
              <p>Applications organized by location and goal.</p>
            </div>
            <form className="new-collection-form" onSubmit={submitCollection}>
              <label className="sr-only" htmlFor="new-collection-name">Collection name</label>
              <input
                id="new-collection-name"
                type="text"
                maxLength="80"
                placeholder="New collection name"
                value={newCollectionName}
                onChange={(event) => setNewCollectionName(event.target.value)}
                required
              />
              <button className="secondary-action" type="submit">＋ New collection</button>
            </form>
          </div>
          <div className="collection-cards">
            {collections.map((collection) => {
              const collectionCompanies = companies.filter(
                (company) => company.collection_id === collection.id,
              );
              const activeCount = collectionCompanies.filter(
                (company) => company.status === "running",
              ).length;
              const percent = collectionCompanies.length
                ? Math.round((activeCount / collectionCompanies.length) * 100)
                : 0;
              return (
                <article className="collection-card" key={collection.id}>
                  <button
                    className="collection-open"
                    type="button"
                    onClick={() => onOpenCollection(collection)}
                  >
                    <span className="collection-card-icon" aria-hidden="true">⌖</span>
                    <span className="collection-card-content">
                      <strong>{collection.name}</strong>
                      <span>{collectionCompanies.length} companies · {activeCount} interviews in progress</span>
                    </span>
                    <span className="collection-card-arrow" aria-hidden="true">→</span>
                  </button>
                  <div className="collection-progress-track" aria-hidden="true">
                    <span style={{ width: `${percent}%` }} />
                  </div>
                  <div className="collection-card-footer">
                    <span>{collectionCompanies.length ? `${activeCount} interviews in progress` : "Ready when you are"}</span>
                    <button
                      className="collection-delete"
                      type="button"
                      onClick={() => onDeleteCollection(collection)}
                      aria-label={`Delete ${collection.name} collection`}
                      title="Delete collection and its companies"
                    >
                      ×
                    </button>
                  </div>
                </article>
              );
            })}
            {collections.length === 0 && (
              <p className="collection-empty">
                No collections yet. Create one to start organizing your applications.
              </p>
            )}
          </div>
        </section>
    </section>
  );
}

function CompanyCard({ company, collection, onMove, onEdit, onDelete }) {
  return (
    <article className="company-row">
        <span className="company-avatar" aria-hidden="true">
          {company.name.slice(0, 2).toUpperCase()}
        </span>
        <button
          className="company-move"
          type="button"
          onClick={() => onMove(company.id)}
          aria-label={`${company.name}: ${STATUS_LABELS[company.status]}. Move to ${STATUS_LABELS[NEXT_STATUS[company.status]]}.`}
          title={`Move to ${STATUS_LABELS[NEXT_STATUS[company.status]]}`}
        >
          <span className="company-name">{company.name}</span>
          <span className="company-meta">
            {company.rounds} round{company.rounds === 1 ? "" : "s"}
            {collection && <> · {collection.name}</>}
            {company.interview_language && <> · {company.interview_language}</>}
            {company.is_ai_interview && <span className="company-ai-badge">AI interview</span>}
            {company.scheduled_at && (
              <time className="company-scheduled-at" dateTime={company.scheduled_at}>
                ◷ {formatScheduledAt(company.scheduled_at)}
              </time>
            )}
          </span>
        </button>
        <button
          className={`company-status ${company.status}`}
          type="button"
          onClick={() => onMove(company.id)}
          aria-label={`Move ${company.name} from ${STATUS_LABELS[company.status]} to ${STATUS_LABELS[NEXT_STATUS[company.status]]}`}
          title={`Move to ${STATUS_LABELS[NEXT_STATUS[company.status]]}`}
        >
          {STATUS_LABELS[company.status]}
        </button>
        <button
          className="company-action"
        type="button"
        onClick={() => onEdit(company)}
        aria-label={`Edit interview details for ${company.name}`}
        title="Edit interview details"
      >
        ✎
      </button>
      <button
        className="company-action delete-company"
        type="button"
        onClick={() => onDelete(company)}
        aria-label={`Delete ${company.name}`}
        title="Delete company"
      >
        ×
      </button>
    </article>
  );
}

function NotesView({ notes, onSave, onDelete, saving }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState(null);

  async function submitNote(event) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    if (!trimmedTitle || !trimmedContent) return;
    const saved = await onSave({
      id: editingId,
      title: trimmedTitle,
      content: trimmedContent,
    });
    if (!saved) return;
    setTitle("");
    setContent("");
    setEditingId(null);
  }

  function editNote(note) {
    setTitle(note.title);
    setContent(note.content);
    setEditingId(note.id);
  }

  function cancelEdit() {
    setTitle("");
    setContent("");
    setEditingId(null);
  }

  return (
    <section className="notes-page" aria-labelledby="notes-title">
      <div className="notes-heading">
        <div>
          <div className="eyebrow">YOUR WORKSPACE</div>
          <h1 id="notes-title">Notes</h1>
          <p>Keep important reminders and ideas close at hand.</p>
        </div>
      </div>
      <form className="notes-form" onSubmit={submitNote}>
        <h2>{editingId ? "Edit note" : "Add a note"}</h2>
        <label>
          Title
          <input
            type="text"
            maxLength="120"
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Questions for my next interview"
          />
        </label>
        <label>
          Note
          <textarea
            required
            rows="5"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Write down a reminder, idea, or anything you want to keep."
          />
        </label>
        <div className="notes-form-actions">
          <button className="primary-action" type="submit" disabled={saving}>
            {saving ? "Saving..." : editingId ? "Save changes" : "Save note"}
          </button>
          {editingId && (
            <button className="secondary-action" type="button" onClick={cancelEdit}>
              Cancel
            </button>
          )}
        </div>
      </form>
      <div className="notes-list" aria-live="polite">
        {notes.length ? (
          [...notes]
            .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
            .map((note) => (
              <article className="note-card" key={note.id}>
                <div className="note-card-heading">
                  <div>
                    <h2>{note.title}</h2>
                    <time dateTime={note.updatedAt}>
                      Updated {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(note.updatedAt))}
                    </time>
                  </div>
                  <div className="note-card-actions">
                    <button type="button" onClick={() => editNote(note)}>Edit</button>
                    <button type="button" onClick={() => onDelete(note.id)} aria-label={`Delete ${note.title}`}>
                      Delete
                    </button>
                  </div>
                </div>
                <p>{note.content}</p>
              </article>
            ))
        ) : (
          <div className="notes-empty">
            <strong>No notes yet</strong>
            <p>Add your first note to keep an interview reminder or idea handy.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 600px)").matches,
  );
  useEffect(() => {
    const updateViewport = () =>
      setIsMobileViewport(window.matchMedia("(max-width: 600px)").matches);
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);
  const [companies, setCompanies] = usePersistentState(
    STORAGE_KEYS.companies,
    () => (supabase ? [] : loadCompanies()),
    !supabase,
  );
  const [companyTarget, setCompanyTarget] = useState(loadCompanyTarget);
  const [collections, setCollections] = usePersistentState(
    STORAGE_KEYS.collections,
    () => (supabase ? [] : loadCollections()),
    !supabase,
  );
  const [questions, setQuestions] = usePersistentState(
    STORAGE_KEYS.questions,
    () => (supabase ? [] : loadQuestions()),
    !supabase,
  );
  const [motivations, setMotivations] = usePersistentState(
    STORAGE_KEYS.motivations,
    () => (supabase ? [] : loadMotivations()),
    !supabase,
  );
  const [skills, setSkills] = usePersistentState(
    STORAGE_KEYS.skills,
    () => (supabase ? [] : loadSkills()),
    !supabase,
  );
  const [companyName, setCompanyName] = useState("");
  const [interviewCount, setInterviewCount] = useState("1");
  const [interviewLanguage, setInterviewLanguage] = useState("Java");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [scheduledPeriod, setScheduledPeriod] = useState("AM");
  const [isAiInterview, setIsAiInterview] = useState(false);
  const [companyStatus, setCompanyStatus] = useState("running");
  const [activeView, setActiveView] = useState("dashboard");
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [companySearch, setCompanySearch] = useState("");
  const [companyStatusFilter, setCompanyStatusFilter] = useState("all");
  const [activeCollectionId, setActiveCollectionId] = useState(null);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState([]);
  const [message, setMessage] = useState("");

  const [question, setQuestion] = useState("");
  const [questionCompany, setQuestionCompany] = useState("");
  const [questionTopic, setQuestionTopic] = useState("");
  const [questionRound, setQuestionRound] = useState("");

  const [skillName, setSkillName] = useState("");
  const [skillCategory, setSkillCategory] = useState("");
  const [skillStatus, setSkillStatus] = useState(SKILL_STATUSES[0]);
  const [skillSearch, setSkillSearch] = useState("");
  const [skillFilter, setSkillFilter] = useState("All");
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(Boolean(supabase));
  const [cloudLoading, setCloudLoading] = useState(false);
  const [hasUserCache, setHasUserCache] = useState(false);
  const [cloudError, setCloudError] = useState("");
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [cloudReload, setCloudReload] = useState(0);
  const legacyData = useRef(null);

  if (!legacyData.current) {
    legacyData.current = {
      companies: loadCompanies([]),
      questions: loadQuestions(),
      skills: loadSkills(),
      motivations: loadMotivations(),
    };
  }

  const user = session?.user ?? null;
  const notesStorageKey = user
    ? `${STORAGE_KEYS.notes}:${user.id}`
    : STORAGE_KEYS.notes;
  const notesStorageKeyRef = useRef(notesStorageKey);
  const [notes, setNotes] = useState(loadNotes);

  useEffect(() => {
    if (supabase) return;
    if (notesStorageKeyRef.current === notesStorageKey) return;
    notesStorageKeyRef.current = notesStorageKey;
    setNotes(loadNotes(notesStorageKey));
  }, [notesStorageKey]);

  useEffect(() => {
    if (supabase) return;
    if (notesStorageKeyRef.current !== notesStorageKey) return;
    try {
      localStorage.setItem(notesStorageKey, JSON.stringify(notes));
    } catch (error) {
      console.warn("Could not save notes:", error);
    }
  }, [notes, notesStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.target, JSON.stringify(companyTarget));
    } catch (error) {
      console.warn("Could not save company target:", error);
    }
  }, [companyTarget]);

  useEffect(() => {
    if (!collections.length) {
      setActiveCollectionId(null);
      setSelectedCollectionIds([]);
      return;
    }
    if (!collections.some((collection) => collection.id === activeCollectionId)) {
      setActiveCollectionId(collections[0].id);
      setSelectedCollectionIds([collections[0].id]);
    }
  }, [collections, activeCollectionId]);

  useEffect(() => {
    const fallbackCollection =
      collections.find(
        (collection) =>
          collection.name.toLowerCase() === "bangalore interviews",
      ) ?? collections[0];
    if (!fallbackCollection) return;
    const collectionIds = new Set(collections.map((collection) => collection.id));
    setCompanies((current) =>
      current.map((company) =>
        collectionIds.has(company.collection_id)
          ? company
          : { ...company, collection_id: fallbackCollection.id },
      ),
    );
  }, [collections, setCompanies]);

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;

    let awaitingSignupConfirmation =
      new URLSearchParams(window.location.hash.slice(1)).get("type") ===
      "signup";
    function returnToLoginAfterConfirmation() {
      if (!awaitingSignupConfirmation) return false;
      awaitingSignupConfirmation = false;
      const loginUrl = new URL(import.meta.env.BASE_URL, window.location.origin);
      loginUrl.searchParams.set("confirmed", "1");
      window.history.replaceState(null, "", loginUrl);
      setSession(null);
      setCloudLoading(false);
      setHasUserCache(false);
      setAuthLoading(false);
      window.setTimeout(() => {
        supabase.auth.signOut().catch((error) => {
          setCloudError(error.message || "Could not complete email confirmation.");
        });
      }, 0);
      return true;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "SIGNED_IN" && returnToLoginAfterConfirmation()) return;
      setSession(nextSession);
      if (!nextSession) {
        setCloudLoading(false);
        setHasUserCache(false);
        setCompanies([]);
        setCollections([]);
        setQuestions([]);
        setSkills([]);
        setMotivations([]);
        setNotes([]);
      }
    });

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setCloudError(error.message);
      if (data?.session && returnToLoginAfterConfirmation()) return;
      if (data?.session) setCloudLoading(true);
      setSession(data?.session ?? null);
      setAuthLoading(false);
    }).catch((error) => {
      if (!active) return;
      setCloudError(error.message || "Could not restore your sign-in session.");
      setAuthLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [setCompanies, setMotivations, setQuestions, setSkills]);

  useEffect(() => {
    if (!user) {
      setCloudLoading(false);
      setHasUserCache(false);
      return undefined;
    }

    let active = true;
    setCloudLoading(true);
    setCloudError("");
    async function loadAndSyncData() {
      const cachedData = loadUserDataCache(user.id);
      setHasUserCache(Boolean(cachedData));
      if (cachedData) {
        setCompanies(cachedData.companies);
        setCollections(cachedData.collections);
        setQuestions(cachedData.questions);
        setSkills(cachedData.skills);
        setMotivations(cachedData.motivations);
        setNotes(cachedData.notes);
      } else {
        setNotes([]);
      }

      const backup = legacyData.current;
      const hasBrowserData =
        backup.companies.length +
        backup.questions.length +
        backup.skills.length +
        backup.motivations.length >
        0;
      const importKey = `${BROWSER_IMPORT_KEY}:${user.id}`;
      let browserDataImported = false;

      try {
        browserDataImported = localStorage.getItem(importKey) === "1";
      } catch (error) {
        console.warn("Could not check browser data sync status:", error);
      }

      let data = await fetchUserData();
      let defaultCollection = data.collections.find(
        (collection) => collection.name.toLowerCase() === "bangalore interviews",
      );
      if (!defaultCollection) {
        defaultCollection = await createCollection(user.id, "Bangalore Interviews");
        data.collections = [...data.collections, defaultCollection];
      }

      if (!browserDataImported) {
        if (hasBrowserData) {
          data = await importBrowserData(user.id, backup, defaultCollection.id);
        }
        if (!active) return;
        try {
          localStorage.setItem(importKey, "1");
        } catch (error) {
          console.warn("Could not save browser data sync status:", error);
        }
        if (hasBrowserData) {
          setMessage("Browser data synced to your account.");
        }
      } else {
        data = await fetchUserData();
      }

      if (!active) return;
      setCompanies(data.companies);
      setCollections(data.collections);
      setQuestions(data.questions);
      setSkills(data.skills);
      setMotivations(data.motivations);
      saveUserDataCache(user.id, data);

      const notesImportKey = `job-hunt-quest-notes-import-v1:${user.id}`;
      let notesImported = false;
      try {
        notesImported = localStorage.getItem(notesImportKey) === "1";
      } catch (error) {
        console.warn("Could not check browser notes sync status:", error);
      }
      if (!notesImported) {
        const browserNotes = [
          ...loadNotes(STORAGE_KEYS.notes),
          ...loadNotes(`${STORAGE_KEYS.notes}:${user.id}`),
        ];
        const uniqueNotes = [...new Map(
          browserNotes.map((note) => [note.id, note]),
        ).values()];
        await importBrowserNotes(user.id, uniqueNotes);
        try {
          localStorage.setItem(notesImportKey, "1");
        } catch (error) {
          console.warn("Could not save browser notes sync status:", error);
        }
      }
      if (!active) return;
      const savedNotes = await fetchNotes();
      if (!active) return;
      setNotes(savedNotes);
      saveUserDataCache(user.id, { ...data, notes: savedNotes });
      setHasUserCache(true);
    }

    loadAndSyncData()
      .catch((error) => {
        if (active) {
          setCloudError(error.message || "Could not load your saved data.");
        }
      })
      .finally(() => {
        if (active) {
          setCloudLoading(false);
          setSaving(false);
        }
      });

    return () => {
      active = false;
    };
  }, [user?.id, cloudReload, setCompanies, setMotivations, setQuestions, setSkills]);

  useEffect(() => {
    if (!user || cloudLoading) return;
    saveUserDataCache(user.id, {
      companies,
      collections,
      questions,
      skills,
      motivations,
      notes,
    });
  }, [user?.id, cloudLoading, companies, collections, questions, skills, motivations, notes]);

  async function runCloudMutation(operation) {
    setSaving(true);
    try {
      return { ok: true, value: await operation() };
    } catch (error) {
      setMessage(`Could not save your change: ${error.message || "Unknown error"}`);
      return { ok: false, value: null };
    } finally {
      setSaving(false);
    }
  }

  async function addCollection(name) {
    if (collections.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
      setMessage(`A collection named "${name}" already exists.`);
      return;
    }
    let collection = { id: `local-${Date.now()}`, name };
    if (user) {
      const result = await runCloudMutation(() =>
        createCollection(user.id, name),
      );
      if (!result.ok) return;
      collection = result.value;
    }
    setCollections((current) => [...current, collection]);
    setMessage(`${name} collection created.`);
  }

  async function removeCollection(collection) {
    if (
      !window.confirm(
        `Delete "${collection.name}" and all companies in it? This cannot be undone.`,
      )
    ) {
      return;
    }
    if (user) {
      const result = await runCloudMutation(() =>
        deleteCollectionRemote(collection.id),
      );
      if (!result.ok) return;
    }
    setCollections((current) =>
      current.filter((item) => item.id !== collection.id),
    );
    setCompanies((current) =>
      current.filter((company) => company.collection_id !== collection.id),
    );
    setMessage(`${collection.name} collection and its companies deleted.`);
  }

  const activeCollection = collections.find(
    (collection) => collection.id === activeCollectionId,
  );
  const collectionCompanies = useMemo(
    () =>
      activeCollection
        ? companies.filter(
            (company) => company.collection_id === activeCollection.id,
          )
        : [],
    [companies, activeCollection],
  );

  const visibleCompanies = useMemo(() => {
    const search = companySearch.trim().toLowerCase();
    return [...collectionCompanies]
      .filter(
        (company) =>
          (companyStatusFilter === "all" ||
            (companyStatusFilter === "scheduled" &&
              company.status === "running" &&
              company.scheduled_at) ||
            (companyStatusFilter !== "scheduled" &&
              companyStatusFilter !== "all" &&
              company.status === companyStatusFilter)) &&
          (!search || company.name.toLowerCase().includes(search)),
      )
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [collectionCompanies, companySearch, companyStatusFilter]);

  const visibleSkills = useMemo(() => {
    const search = skillSearch.trim().toLowerCase();
    return skills
      .map((skill, index) => ({ ...skill, index }))
      .filter(
        (skill) =>
          (skillFilter === "All" || skill.status === skillFilter) &&
          (skill.name.toLowerCase().includes(search) ||
            skill.category.toLowerCase().includes(search)),
      )
      .reverse();
  }, [skills, skillSearch, skillFilter]);

  function openAddCompany() {
    setEditingCompany(null);
    setCompanyName("");
    setInterviewCount("1");
    setInterviewLanguage("Java");
    setScheduledDate("");
    setScheduledTime("");
    setScheduledPeriod("AM");
    setIsAiInterview(false);
    setCompanyStatus("running");
    setSelectedCollectionIds(
      activeCollectionId ? [activeCollectionId] : collections.slice(0, 1).map((item) => item.id),
    );
    setMessage("");
    setCompanyDialogOpen(true);
  }

  function openEditCompany(company) {
    setEditingCompany(company);
    setCompanyName(company.name);
    setInterviewCount(String(company.rounds));
    setInterviewLanguage(company.interview_language ?? "");
    const scheduleValues = getScheduleInputValues(company.scheduled_at);
    setScheduledDate(scheduleValues.date);
    setScheduledTime(scheduleValues.time);
    setScheduledPeriod(scheduleValues.period);
    setIsAiInterview(company.is_ai_interview);
    setCompanyStatus(company.status);
    setMessage("");
    setCompanyDialogOpen(true);
  }

  function closeCompanyDialog() {
    setCompanyDialogOpen(false);
    setEditingCompany(null);
  }

  async function saveCompany(event) {
    event.preventDefault();
    const name = companyName.trim();
    const rounds = Number(interviewCount);

    if (!name) {
      setMessage("Please enter a company name.");
      return;
    }
    if (!Number.isInteger(rounds) || rounds < 1 || rounds > 20) {
      setMessage("Interview count must be between 1 and 20.");
      return;
    }
    if (
      interviewLanguage &&
      !INTERVIEW_LANGUAGES.includes(interviewLanguage)
    ) {
      setMessage("Interview language must be Java, Python, or blank.");
      return;
    }
    const hasSchedule = Boolean(scheduledDate || scheduledTime);
    const scheduled_at = hasSchedule
      ? toScheduledAt(scheduledDate, scheduledTime, scheduledPeriod)
      : null;
    if (hasSchedule && scheduled_at === null) {
      setMessage("Enter a valid interview date and time, or leave it blank.");
      return;
    }

    if (editingCompany) {
      const updates = {
        name,
        rounds,
        status: companyStatus,
        interview_language: interviewLanguage || null,
        scheduled_at,
        is_ai_interview: isAiInterview,
      };
      if (user) {
        const result = await runCloudMutation(() =>
          updateCompany(editingCompany.id, updates),
        );
        if (!result.ok) return;
      }
      setCompanies((current) =>
        current.map((company) =>
          company.id === editingCompany.id
            ? { ...company, ...updates }
            : company,
        ),
      );
      setMessage(`${name}: interview details updated.`);
      closeCompanyDialog();
      return;
    }

    const targetCollections = collections.filter((collection) =>
      selectedCollectionIds.includes(collection.id),
    );
    if (!targetCollections.length) {
      setMessage("Select at least one collection for this company.");
      return;
    }
    if (companies.length + targetCollections.length > companyTarget) {
      setMessage(`Your target of ${companyTarget} companies is reached.`);
      return;
    }

    const newCompany = {
      name,
      rounds,
      status: companyStatus,
      is_ai_interview: isAiInterview,
      interview_language: interviewLanguage || null,
      scheduled_at,
    };
    let savedCompanies = targetCollections.map((collection, index) => ({
      ...newCompany,
      collection_id: collection.id,
      id:
        Math.max(0, ...companies.map((company) => Number(company.id) || 0)) +
        index +
        1,
    }));
    if (user) {
      const result = await runCloudMutation(() =>
        createCompany(
          user.id,
          newCompany,
          targetCollections.map((collection) => collection.id),
        ),
      );
      if (!result.ok) return;
      savedCompanies = result.value;
    }
    setCompanies((current) => [...current, ...savedCompanies]);
    setMessage(
      `${name} added to ${targetCollections.length} collection${targetCollections.length === 1 ? "" : "s"}.`,
    );
    setCompanyName("");
    setInterviewCount("1");
    setInterviewLanguage("Java");
    setScheduledDate("");
    setScheduledTime("");
    setScheduledPeriod("AM");
    setIsAiInterview(false);
    setCompanyStatus("running");
    closeCompanyDialog();
  }

  async function moveCompany(id, targetStatus) {
    const company = companies.find((item) => item.id === id);
    if (!company) return;

    const status =
      targetStatus ?? NEXT_STATUS[company.status];
    if (user) {
      const result = await runCloudMutation(() =>
        updateCompany(id, { status }),
      );
      if (!result.ok) return;
    }
    setCompanies((current) =>
      current.map((item) =>
        item.id === id ? { ...item, status } : item,
      ),
    );
    setMessage(`${company.name} moved to ${STATUS_LABELS[status]}.`);
  }

  async function deleteCompany(company) {
    if (!window.confirm(`Delete ${company.name} from your job hunt?`)) return;
    if (user) {
      const result = await runCloudMutation(() =>
        deleteCompanyRemote(company.id),
      );
      if (!result.ok) return;
    }
    setCompanies((current) =>
      current.filter((item) => item.id !== company.id),
    );
    setMessage(`${company.name} deleted.`);
  }

  async function addQuestion(event) {
    event.preventDefault();
    const cleanQuestion = question.trim();
    if (!cleanQuestion || !questionCompany || !questionTopic || !questionRound) {
      return;
    }
    const newQuestion = {
      question: cleanQuestion,
      company: questionCompany,
      topic: questionTopic,
      round: questionRound,
    };
    let savedQuestion = newQuestion;
    if (user) {
      const result = await runCloudMutation(() =>
        createQuestion(user.id, newQuestion),
      );
      if (!result.ok) return;
      savedQuestion = result.value;
    }
    setQuestions((current) => [...current, savedQuestion]);
    setQuestion("");
    setQuestionTopic("");
    setQuestionRound("");
  }

  async function editQuestion(index) {
    const item = questions[index];
    if (!item) return;
    const updated = window.prompt("Edit interview question:", item.question);
    if (updated === null || !updated.trim()) return;
    if (user && item.id) {
      const result = await runCloudMutation(() =>
        updateQuestion(item.id, { question: updated.trim() }),
      );
      if (!result.ok) return;
    }
    setQuestions((current) =>
      current.map((questionItem, itemIndex) =>
        itemIndex === index
          ? { ...questionItem, question: updated.trim() }
          : questionItem,
      ),
    );
  }

  async function deleteQuestion(index) {
    if (!window.confirm("Delete this interview question?")) return;
    const item = questions[index];
    if (user && item?.id) {
      const result = await runCloudMutation(() =>
        deleteQuestionRemote(item.id),
      );
      if (!result.ok) return;
    }
    setQuestions((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function addSkill(event) {
    event.preventDefault();
    const name = skillName.trim();
    if (!name || !skillCategory) return;

    if (
      skills.some((skill) => skill.name.toLowerCase() === name.toLowerCase()) &&
      !window.confirm(`"${name}" is already in your skill list. Add it anyway?`)
    ) {
      return;
    }
    const newSkill = { name, category: skillCategory, status: skillStatus };
    let savedSkill = newSkill;
    if (user) {
      const result = await runCloudMutation(() =>
        createSkill(user.id, newSkill),
      );
      if (!result.ok) return;
      savedSkill = result.value;
    }
    setSkills((current) => [...current, savedSkill]);
    setSkillName("");
    setSkillCategory("");
    setSkillStatus(SKILL_STATUSES[0]);
  }

  async function updateSkill(index) {
    const skill = skills[index];
    if (!skill) return;
    const status =
      SKILL_STATUSES[
        (SKILL_STATUSES.indexOf(skill.status) + 1) % SKILL_STATUSES.length
      ];
    if (user && skill.id) {
      const result = await runCloudMutation(() =>
        updateSkillRemote(skill.id, { status }),
      );
      if (!result.ok) return;
    }
    setSkills((current) =>
      current.map((skill, skillIndex) =>
        skillIndex === index
          ? { ...skill, status }
          : skill,
      ),
    );
  }

  async function deleteSkill(index) {
    const skill = skills[index];
    if (!skill || !window.confirm(`Delete "${skill.name}" from your skills?`)) {
      return;
    }
    if (user && skill.id) {
      const result = await runCloudMutation(() =>
        deleteSkillRemote(skill.id),
      );
      if (!result.ok) return;
    }
    setSkills((current) => current.filter((_, skillIndex) => skillIndex !== index));
  }

  async function addMotivation() {
    const line = window.prompt("Write your motivation line:");
    if (line === null || !line.trim()) return;
    let savedLine = line.trim();
    if (user) {
      const result = await runCloudMutation(() =>
        createMotivation(user.id, savedLine),
      );
      if (!result.ok) return;
      savedLine = result.value;
    }
    setMotivations((current) => [...current, savedLine]);
  }

  async function editMotivation(index) {
    const item = motivations[index];
    const line = typeof item === "string" ? item : item.line;
    const updated = window.prompt("Edit your motivation line:", line);
    if (updated === null || !updated.trim()) return;
    if (user && typeof item !== "string" && item.id) {
      const result = await runCloudMutation(() =>
        updateMotivation(item.id, updated.trim()),
      );
      if (!result.ok) return;
    }
    setMotivations((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? typeof item === "string"
            ? updated.trim()
            : { ...item, line: updated.trim() }
          : item,
      ),
    );
  }

  async function deleteMotivation(index) {
    if (!window.confirm("Delete this motivation line?")) return;
    const item = motivations[index];
    if (user && typeof item !== "string" && item?.id) {
      const result = await runCloudMutation(() =>
        deleteMotivationRemote(item.id),
      );
      if (!result.ok) return;
    }
    setMotivations((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
  }

  async function saveNote(note) {
    const now = new Date().toISOString();
    const existingNote = notes.find((item) => item.id === note.id);
    let savedNote = {
      ...note,
      id: note.id ?? globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      createdAt: existingNote?.createdAt ?? now,
      updatedAt: now,
    };
    if (user) {
      const result = await runCloudMutation(() =>
        note.id
          ? updateNoteRemote(note.id, note)
          : createNoteRemote(user.id, note),
      );
      if (!result.ok) return false;
      savedNote = result.value;
    }
    setNotes((current) =>
      note.id
        ? current.map((item) => (item.id === note.id ? savedNote : item))
        : [savedNote, ...current],
    );
    return true;
  }

  async function deleteNote(noteId) {
    const note = notes.find((item) => item.id === noteId);
    if (!note || !window.confirm(`Delete "${note.title}"?`)) return;
    if (user) {
      const result = await runCloudMutation(() => deleteNoteRemote(noteId));
      if (!result.ok) return;
    }
    setNotes((current) => current.filter((item) => item.id !== noteId));
  }

  async function signOut() {
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) setCloudError(`Could not sign out: ${error.message}`);
    } finally {
      setSigningOut(false);
    }
  }

  function navigateToSection(section) {
    setMobileSidebarOpen(false);
    if (section === "dashboard") {
      setActiveView("dashboard");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (section === "notes") {
      setActiveView("notes");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setActiveView("board");
    window.setTimeout(() => {
      document.getElementById(section)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  }

  useEffect(() => {
    if (!companyDialogOpen) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape") closeCompanyDialog();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [companyDialogOpen]);

  if (supabase && authLoading) {
    return (
      <main className="auth-page">
        <section className="auth-card auth-loading-card">
          <CatLoader label="Checking your sign-in..." />
        </section>
      </main>
    );
  }

  if (supabase && !user) {
    return (
      <>
        <AuthScreen />
        {cloudError && <p className="auth-error">{cloudError}</p>}
      </>
    );
  }

  if (supabase && cloudLoading && !hasUserCache) {
    return (
      <main className="auth-page">
        <section className="auth-card auth-loading-card">
          <CatLoader label="Loading your saved job hunt..." />
        </section>
      </main>
    );
  }

  if (supabase && cloudError && !hasUserCache) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <h1>Couldn’t load your data</h1>
          <p role="alert">{cloudError}</p>
          <button
            className="add-btn"
            type="button"
            onClick={() => setCloudReload((current) => current + 1)}
          >
            Try again
          </button>
          <button
            className="auth-toggle sign-out-button"
            type="button"
            onClick={signOut}
            disabled={signingOut}
          >
            {signingOut ? <CatLoader label="Signing out..." compact /> : "Sign out"}
          </button>
        </section>
      </main>
    );
  }

  return (
    <div className={`workspace-shell${sidebarCollapsed ? " sidebar-collapsed" : ""}${mobileSidebarOpen ? " mobile-sidebar-open" : ""}`}>
      {mobileSidebarOpen && (
        <button
          className="sidebar-backdrop"
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}
      <aside className="workspace-sidebar">
        <button
          className="sidebar-close"
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setMobileSidebarOpen(false)}
        >
          Close menu
        </button>
        <div className="workspace-brand">
          <span className="workspace-brand-mark" aria-hidden="true">J</span>
          <span className="workspace-brand-copy">
            <strong>JOB HUNT QUEST</strong>
            <small>Your next chapter starts here</small>
          </span>
        </div>
        <span className="workspace-nav-label">WORKSPACE</span>
        <nav className="workspace-nav" aria-label="Main navigation">
          <button
            type="button"
            className={activeView === "dashboard" ? "active" : ""}
            aria-label="Dashboard"
            aria-current={activeView === "dashboard" ? "page" : undefined}
            onClick={() => navigateToSection("dashboard")}
          >
            <span aria-hidden="true">⌂</span><span className="workspace-nav-text">Dashboard</span>
          </button>
          <button
            type="button"
            className={activeView === "board" ? "active" : ""}
            aria-label="Companies"
            aria-current={activeView === "board" ? "page" : undefined}
            onClick={() => navigateToSection("companies")}
          >
            <span aria-hidden="true">▤</span><span className="workspace-nav-text">Companies</span>
          </button>
          <button type="button" aria-label="Interview prep" onClick={() => navigateToSection("interview-prep")}>
            <span aria-hidden="true">◷</span><span className="workspace-nav-text">Interview prep</span>
          </button>
          <button type="button" aria-label="Skills" onClick={() => navigateToSection("skills")}>
            <span aria-hidden="true">✳</span><span className="workspace-nav-text">Skills</span>
          </button>
          <button
            type="button"
            className={activeView === "notes" ? "active" : ""}
            aria-label="Notes"
            aria-current={activeView === "notes" ? "page" : undefined}
            onClick={() => navigateToSection("notes")}
          >
            <span aria-hidden="true">✎</span><span className="workspace-nav-text">Notes</span>
          </button>
        </nav>
        <div className="workspace-account">
          <span className="workspace-avatar" aria-hidden="true">
            {(user?.email?.[0] ?? "N").toUpperCase()}
          </span>
          <span className="workspace-account-copy">
            <strong>{user?.email ?? "Local workspace"}</strong>
            <small>{user ? "Personal workspace" : "Saved in this browser"}</small>
          </span>
          {user && (
            <button
              className="workspace-signout"
              type="button"
              onClick={signOut}
              disabled={signingOut}
            >
              {signingOut ? "…" : "Sign out"}
            </button>
          )}
        </div>
      </aside>

      <main className="workspace-main">
        <div className="workspace-topbar">
          <div className="workspace-breadcrumb">
            <button
              className="sidebar-toggle"
              type="button"
              aria-label={
                isMobileViewport
                  ? mobileSidebarOpen
                    ? "Close navigation menu"
                    : "Open navigation menu"
                  : sidebarCollapsed
                    ? "Expand sidebar"
                    : "Collapse sidebar"
              }
              aria-expanded={
                isMobileViewport ? mobileSidebarOpen : !sidebarCollapsed
              }
              onClick={() => {
                if (window.matchMedia("(max-width: 600px)").matches) {
                  setMobileSidebarOpen((open) => !open);
                } else {
                  setSidebarCollapsed((collapsed) => !collapsed);
                }
              }}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              >
                <path d="M3.5 5.5h13M3.5 10h13M3.5 14.5h13" />
              </svg>
            </button>
            <span>Workspace <span aria-hidden="true">/</span> <strong>{activeView === "dashboard" ? "Overview" : activeView === "notes" ? "Notes" : activeCollection?.name ?? "Companies"}</strong></span>
          </div>
          <div className="workspace-topbar-actions">
            {saving || (cloudLoading && hasUserCache) ? (
              <span className="workspace-sync"><i />Syncing changes</span>
            ) : (
              <span className="workspace-sync"><i />{user ? "Changes synced" : "Saved on this device"}</span>
            )}
            {user && (
              <button
                className="workspace-top-signout"
                type="button"
                onClick={signOut}
                disabled={signingOut}
              >
                {signingOut ? "Signing out..." : "Sign out"}
              </button>
            )}
            {user && (
              <span className="workspace-avatar workspace-top-avatar" aria-hidden="true">
                {(user.email?.[0] ?? "N").toUpperCase()}
              </span>
            )}
          </div>
        </div>

      {saving && (
        <div className="save-loading">
          <CatLoader label="Saving your changes..." compact />
        </div>
      )}

      {cloudLoading && hasUserCache && (
        <div className="sync-notice" role="status">
          <CatLoader label="Syncing your saved data..." compact />
        </div>
      )}

      {cloudError && (
        <div className="sync-error" role="alert">
          <span>{cloudError}</span>
          <button
            className="secondary"
            type="button"
            onClick={() => setCloudReload((current) => current + 1)}
          >
            Try again
          </button>
        </div>
      )}

      {!supabase && (
        <div className="setup-notice workspace-setup-notice" role="status">
          Local-only mode: add your Supabase project URL and public key to enable
          accounts and cloud sync.
        </div>
      )}

      {message && !companyDialogOpen && (
        <div
          className={`workspace-message${message.startsWith("Could not save") ? " error" : ""}`}
          role={message.startsWith("Could not save") ? "alert" : "status"}
          aria-live="polite"
        >
          <span>{message}</span>
          <button
            type="button"
            onClick={() => setMessage("")}
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      {activeView === "dashboard" && (
        <DashboardView
          companies={companies}
          companyTarget={companyTarget}
          collections={collections}
          onOpenCollection={(collection) => {
            setActiveCollectionId(collection.id);
            setSelectedCollectionIds([collection.id]);
            setActiveView("board");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          onCreateCollection={addCollection}
          onDeleteCollection={removeCollection}
          onAddCompany={() => {
            setActiveView("board");
            openAddCompany();
          }}
          onViewCompanies={() => {
            setActiveCollectionId(null);
            setCompanySearch("");
            setCompanyStatusFilter("all");
            setActiveView("board");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          onViewScheduledCompanies={() => {
            setActiveCollectionId(null);
            setCompanySearch("");
            setCompanyStatusFilter("scheduled");
            setActiveView("board");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          onSaveCompanyTarget={setCompanyTarget}
        />
      )}

      {activeView === "board" && (
        <>
        <section className="pipeline-page" id="companies" aria-label="Company pipeline">
          <div className="pipeline-heading">
            <div>
              <div className="eyebrow">{activeCollection?.name ?? "YOUR COMPANIES"}</div>
              <h1>Company pipeline</h1>
              <p>Keep every application and interview detail in one place.</p>
            </div>
            <button className="primary-action" type="button" onClick={openAddCompany}>
              <span aria-hidden="true">＋</span> Add a company
            </button>
          </div>
          <section className="pipeline-panel">
            <div className="pipeline-toolbar">
              <label className="company-search">
                <span aria-hidden="true">⌕</span>
                <input
                  type="search"
                  placeholder="Search companies..."
                  aria-label="Search companies"
                  value={companySearch}
                  onChange={(event) => setCompanySearch(event.target.value)}
                />
              </label>
              <span className="pipeline-count">
                {visibleCompanies.length} of {collectionCompanies.length} companies
              </span>
            </div>
            <div className="company-filters" aria-label="Filter companies">
              <button
                type="button"
                className={companyStatusFilter === "all" ? "active" : ""}
                aria-pressed={companyStatusFilter === "all"}
                onClick={() => setCompanyStatusFilter("all")}
              >
                All <span>{collectionCompanies.length}</span>
              </button>
              <button
                type="button"
                className={companyStatusFilter === "scheduled" ? "active" : ""}
                aria-pressed={companyStatusFilter === "scheduled"}
                onClick={() => setCompanyStatusFilter("scheduled")}
              >
                Scheduled interviews{" "}
                <span>
                  {collectionCompanies.filter(
                    (company) =>
                      company.status === "running" && company.scheduled_at,
                  ).length}
                </span>
              </button>
              {STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  className={companyStatusFilter === status ? "active" : ""}
                  aria-pressed={companyStatusFilter === status}
                  onClick={() => setCompanyStatusFilter(status)}
                >
                  {STATUS_LABELS[status]}{" "}
                  <span>{collectionCompanies.filter((company) => company.status === status).length}</span>
                </button>
              ))}
            </div>
            <div className="company-list" aria-live="polite">
              {visibleCompanies.length ? (
                visibleCompanies.map((company) => (
                  <CompanyCard
                    key={company.id}
                    company={company}
                    collection={collections.find((item) => item.id === company.collection_id)}
                    onMove={moveCompany}
                    onEdit={openEditCompany}
                    onDelete={deleteCompany}
                  />
                ))
              ) : (
                <div className="pipeline-empty">
                  {collectionCompanies.length
                    ? "No companies match your search or filter."
                    : "No companies in this collection yet. Add one to get started."}
                </div>
              )}
            </div>
          </section>
          <p className="pipeline-hint">
            Select a status on a company to move it through your pipeline.
          </p>
        </section>

      <section className="question-bank" id="interview-prep">
        <SectionHeading
          title="🧠 Interview Question Bank"
          subtitle="Save the questions companies ask you and build your own preparation bank."
        />
        <form className="question-form" onSubmit={addQuestion}>
          <label className="question-field">
            Question
            <textarea
              maxLength="500"
              placeholder="e.g. Find duplicate characters in a String using Java Streams"
              required
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
          </label>
          <label className="question-field">
            Company
            <select
              required
              value={questionCompany}
              onChange={(event) => setQuestionCompany(event.target.value)}
            >
              <option value="">Select company</option>
              {companies.map((company) => (
                <option key={company.id} value={company.name}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>
          <label className="question-field">
            Topic
            <select
              required
              value={questionTopic}
              onChange={(event) => setQuestionTopic(event.target.value)}
            >
              <option value="">Select topic</option>
              {QUESTION_TOPICS.map((topic) => (
                <option key={topic}>{topic}</option>
              ))}
            </select>
          </label>
          <label className="question-field">
            Round
            <select
              required
              value={questionRound}
              onChange={(event) => setQuestionRound(event.target.value)}
            >
              <option value="">Select round</option>
              {QUESTION_ROUNDS.map((round) => (
                <option key={round}>{round}</option>
              ))}
            </select>
          </label>
          <button className="question-add" type="submit">
            + Add Question
          </button>
        </form>
        <div className="question-list">
          {questions.length ? (
            [...questions].reverse().map((item, reverseIndex) => {
              const index = questions.length - 1 - reverseIndex;
              return (
                <article className="question-card" key={`${index}-${item.question}`}>
                  <div className="question-text">{item.question}</div>
                  <div className="question-meta">
                    <span className="question-tag">🏢 {item.company}</span>
                    <span className="question-tag">🏷️ {item.topic}</span>
                    <span className="question-tag">🎤 {item.round}</span>
                  </div>
                  <div className="question-actions">
                    <button
                      type="button"
                      className="question-action"
                      onClick={() => editQuestion(index)}
                    >
                      ✎ Edit
                    </button>
                    <button
                      type="button"
                      className="question-action"
                      onClick={() => deleteQuestion(index)}
                    >
                      × Delete
                    </button>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="question-empty">
              No interview questions yet. Add your first one above ✨
            </div>
          )}
        </div>
      </section>

      <section className="skill-bank" id="skills">
        <SectionHeading
          title="🛠️ Skills Tracker"
          subtitle="Capture skills you come across while preparing or interviewing, and track your learning progress."
          aside={
            <div className="skill-total">
              {skills.length} skill{skills.length === 1 ? "" : "s"}
            </div>
          }
        />
        <form className="skill-form" onSubmit={addSkill}>
          <label>
            Skill
            <input
              type="text"
              maxLength="100"
              placeholder="e.g. Redis, Java Streams, Rate Limiting"
              required
              value={skillName}
              onChange={(event) => setSkillName(event.target.value)}
            />
          </label>
          <label>
            Category
            <select
              required
              value={skillCategory}
              onChange={(event) => setSkillCategory(event.target.value)}
            >
              <option value="">Select category</option>
              {SKILL_CATEGORIES.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>
          <label>
            Learning status
            <select
              required
              value={skillStatus}
              onChange={(event) => setSkillStatus(event.target.value)}
            >
              {SKILL_STATUSES.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <button className="skill-add" type="submit">
            + Add Skill
          </button>
        </form>
        <div className="skill-tools">
          <input
            type="search"
            placeholder="Search skills..."
            aria-label="Search skills"
            value={skillSearch}
            onChange={(event) => setSkillSearch(event.target.value)}
          />
          <select
            aria-label="Filter skills by status"
            value={skillFilter}
            onChange={(event) => setSkillFilter(event.target.value)}
          >
            <option value="All">All statuses</option>
            {SKILL_STATUSES.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </div>
        <div className="skill-list">
          {visibleSkills.length ? (
            visibleSkills.map((skill) => (
              <article className="skill-card" key={`${skill.index}-${skill.name}`}>
                <div className="skill-card-top">
                  <div>
                    <div className="skill-name">{skill.name}</div>
                    <div className="skill-category">{skill.category}</div>
                  </div>
                  <span className="skill-status" data-status={skill.status}>
                    {skill.status}
                  </span>
                </div>
                <div className="skill-actions">
                  <button
                    type="button"
                    className="skill-action"
                    onClick={() => updateSkill(skill.index)}
                  >
                    ↻ Update status
                  </button>
                  <button
                    type="button"
                    className="skill-action"
                    onClick={() => deleteSkill(skill.index)}
                  >
                    × Delete
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="skill-empty">
              {skills.length
                ? "No skills match your search or filter."
                : "No skills yet. Add the first skill you come across ✨"}
            </div>
          )}
        </div>
      </section>

      <section className="motivation">
        <SectionHeading
          title="💛 My Motivation"
          subtitle="Write the lines you want to see when the job hunt gets tough."
          aside={
            <button className="secondary" type="button" onClick={addMotivation}>
              + Add line
            </button>
          }
        />
        <div className="motivation-list">
          {motivations.length ? (
            motivations.map((item, index) => {
              const line = typeof item === "string" ? item : item.line;
              return (
              <div className="motivation-item" key={`${index}-${line}`}>
                <span>{line}</span>
                <div className="motivation-actions">
                  <button
                    className="motivation-btn"
                    type="button"
                    title="Edit"
                    aria-label="Edit motivation line"
                    onClick={() => editMotivation(index)}
                  >
                    ✎
                  </button>
                  <button
                    className="motivation-btn"
                    type="button"
                    title="Delete"
                    aria-label="Delete motivation line"
                    onClick={() => deleteMotivation(index)}
                  >
                    ×
                  </button>
                </div>
              </div>
              );
            })
          ) : (
            <div className="motivation-empty">
              No motivation lines yet. Add your first one above ✨
            </div>
          )}
        </div>
      </section>

        </>
      )}
      {activeView === "notes" && (
        <NotesView
          notes={notes}
          onSave={saveNote}
          onDelete={deleteNote}
          saving={saving}
        />
      )}
      </main>

      <nav className="mobile-workspace-nav" aria-label="Mobile navigation">
        <button
          type="button"
          className={activeView === "dashboard" ? "active" : ""}
          onClick={() => navigateToSection("dashboard")}
        >
          <span aria-hidden="true">⌂</span>Home
        </button>
        <button
          type="button"
          className={activeView === "board" ? "active" : ""}
          onClick={() => navigateToSection("companies")}
        >
          <span aria-hidden="true">▤</span>Companies
        </button>
        <button type="button" onClick={() => navigateToSection("interview-prep")}>
          <span aria-hidden="true">◷</span>Prep
        </button>
        <button type="button" onClick={() => navigateToSection("skills")}>
          <span aria-hidden="true">✳</span>Skills
        </button>
        <button
          type="button"
          className={activeView === "notes" ? "active" : ""}
          aria-current={activeView === "notes" ? "page" : undefined}
          onClick={() => navigateToSection("notes")}
        >
          <span aria-hidden="true">✎</span>Notes
        </button>
      </nav>

      {companyDialogOpen && (
        <div
          className="company-dialog-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeCompanyDialog();
          }}
        >
          <form
            className="company-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="company-dialog-title"
            onSubmit={saveCompany}
          >
            <div className="company-dialog-heading">
              <div>
                <h2 id="company-dialog-title">
                  {editingCompany ? "Edit company details" : "Add a company"}
                </h2>
                <p>
                  {editingCompany
                    ? "Keep your application details up to date."
                    : "Add an application to your interview pipeline."}
                </p>
              </div>
              <button
                type="button"
                className="dialog-close"
                onClick={closeCompanyDialog}
                aria-label="Close dialog"
              >
                ×
              </button>
            </div>
            <div className="company-dialog-fields">
              <label className="dialog-field dialog-field-full">
                Company name
                <input
                  type="text"
                  placeholder="e.g. Infosys"
                  maxLength="80"
                  autoComplete="organization"
                  required
                  autoFocus
                  readOnly={Boolean(editingCompany)}
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                />
              </label>
              <label className="dialog-field">
                Application status
                <select
                  value={companyStatus}
                  onChange={(event) => setCompanyStatus(event.target.value)}
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                  ))}
                </select>
              </label>
              <label className="dialog-field">
                Interview rounds
                <input
                  type="number"
                  min="1"
                  max="20"
                  required
                  value={interviewCount}
                  onChange={(event) => setInterviewCount(event.target.value)}
                />
              </label>
              <label className="dialog-field">
                Interview date
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(event) => setScheduledDate(event.target.value)}
                />
              </label>
              <label className="dialog-field">
                Interview time (12-hour)
                <span className="interview-time-input">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="09:30"
                    pattern="(?:0[1-9]|1[0-2]):[0-5][0-9]"
                    aria-label="Interview time in 12-hour format"
                    value={scheduledTime}
                    onChange={(event) => setScheduledTime(event.target.value)}
                  />
                  <select
                    aria-label="AM or PM"
                    value={scheduledPeriod}
                    onChange={(event) => setScheduledPeriod(event.target.value)}
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </span>
              </label>
              <label className="dialog-field">
                Interview language
                <select
                  value={interviewLanguage}
                  onChange={(event) => setInterviewLanguage(event.target.value)}
                >
                  <option value="">Not specified</option>
                  {INTERVIEW_LANGUAGES.map((language) => (
                    <option key={language} value={language}>{language}</option>
                  ))}
                </select>
              </label>
              <label className="dialog-checkbox">
                <input
                  type="checkbox"
                  checked={isAiInterview}
                  onChange={(event) => setIsAiInterview(event.target.checked)}
                />
                AI interview
              </label>
              {!editingCompany && (
                <fieldset className="dialog-collections">
                  <legend>Add to collections</legend>
                  {collections.map((collection) => (
                    <label key={collection.id}>
                      <input
                        type="checkbox"
                        checked={selectedCollectionIds.includes(collection.id)}
                        onChange={(event) =>
                          setSelectedCollectionIds((current) =>
                            event.target.checked
                              ? [...current, collection.id]
                              : current.filter((id) => id !== collection.id),
                          )
                        }
                      />
                      {collection.name}
                    </label>
                  ))}
                </fieldset>
              )}
            </div>
            {message && (
              <p className="dialog-message" role="status" aria-live="polite">
                {message}
              </p>
            )}
            <div className="company-dialog-actions">
              <button
                className="secondary-action"
                type="button"
                onClick={closeCompanyDialog}
              >
                Cancel
              </button>
              <button className="primary-action" type="submit" disabled={saving}>
                {saving ? "Saving..." : editingCompany ? "Save changes" : "Add company"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default App;
