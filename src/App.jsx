import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  createCompany,
  createMotivation,
  createQuestion,
  createSkill,
  deleteCompany as deleteCompanyRemote,
  deleteMotivation as deleteMotivationRemote,
  deleteQuestion as deleteQuestionRemote,
  deleteSkill as deleteSkillRemote,
  fetchUserData,
  importBrowserData,
  supabase,
  updateCompany,
  updateMotivation,
  updateQuestion,
  updateSkill,
} from "./lib/supabase.js";

const STORAGE_KEYS = {
  companies: "job-hunt-quest-v1",
  questions: "job-hunt-quest-questions-v1",
  motivations: "job-hunt-quest-motivations-v1",
  skills: "job-hunt-quest-skills-v1",
};
const BROWSER_IMPORT_KEY = "job-hunt-quest-browser-import-v1";
const USER_CACHE_KEY = "job-hunt-quest-user-cache-v1";

const STATUSES = ["selected", "running", "pending", "rejected"];
const NEXT_STATUS = {
  running: "selected",
  selected: "pending",
  pending: "rejected",
  rejected: "running",
};
const STATUS_LABELS = {
  selected: "Selected",
  running: "Running",
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
    }))
    .filter((company) => company.name);
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
          STATUSES.includes(item.status),
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
    };
  } catch (error) {
    console.warn("Could not restore cached account data:", error);
    return null;
  }
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

function CompanyCard({ company, onMove, onEdit, onDelete, onDragStart, onDragEnd }) {
  return (
    <article
      className="company"
      draggable
      onDragStart={(event) => onDragStart(event, company.id)}
      onDragEnd={onDragEnd}
    >
      <button
        className="company-move"
        type="button"
        onClick={() => onMove(company.id)}
        aria-label={`${company.name}, ${STATUS_LABELS[company.status]}. Click to move to the next status.`}
        title="Click to move to the next status"
      >
        <span className="company-name">{company.name}</span>
        <span className="rounds">
          {company.rounds} interview{company.rounds === 1 ? "" : "s"}
        </span>
      </button>
      <button
        className="company-action"
        type="button"
        onClick={() => onEdit(company)}
        aria-label={`Edit interview count for ${company.name}`}
        title="Edit interview count"
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

function App() {
  const [companies, setCompanies] = usePersistentState(
    STORAGE_KEYS.companies,
    () => (supabase ? [] : loadCompanies()),
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
  const [isAiInterview, setIsAiInterview] = useState(false);
  const [message, setMessage] = useState("");
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverStatus, setDragOverStatus] = useState(null);

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
        setQuestions([]);
        setSkills([]);
        setMotivations([]);
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
        setQuestions(cachedData.questions);
        setSkills(cachedData.skills);
        setMotivations(cachedData.motivations);
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

      let data;
      if (!browserDataImported) {
        if (hasBrowserData) {
          data = await importBrowserData(user.id, backup);
        } else {
          data = await fetchUserData();
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
      setQuestions(data.questions);
      setSkills(data.skills);
      setMotivations(data.motivations);
      saveUserDataCache(user.id, data);
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
      questions,
      skills,
      motivations,
    });
  }, [user?.id, cloudLoading, companies, questions, skills, motivations]);

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

  const groups = useMemo(
    () =>
      Object.fromEntries(
        STATUSES.map((status) => [
          status,
          companies.filter((company) => company.status === status),
        ]),
      ),
    [companies],
  );
  const aiInterviewCompanies = useMemo(
    () => companies.filter((company) => company.is_ai_interview),
    [companies],
  );

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

  async function addCompany(event) {
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
    if (companies.length >= 100) {
      setMessage("🎉 Company #100 reached!");
      return;
    }

    const newCompany = {
      name,
      rounds,
      status: "running",
      is_ai_interview: isAiInterview,
    };
    let savedCompany = {
      ...newCompany,
      id:
        Math.max(
          0,
          ...companies.map((company) => Number(company.id) || 0),
        ) + 1,
    };
    if (user) {
      const result = await runCloudMutation(() =>
        createCompany(user.id, newCompany),
      );
      if (!result.ok) return;
      savedCompany = result.value;
    }
    setCompanies((current) => [...current, savedCompany]);
    setMessage(`${name} added as Company #${companies.length + 1} 🟡`);
    setCompanyName("");
    setInterviewCount("1");
    setIsAiInterview(false);
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

  async function editCompany(company) {
    const entered = window.prompt(
      `How many interviews did you have with ${company.name}?`,
      String(company.rounds),
    );
    if (entered === null) return;

    const rounds = Number(entered);
    if (!Number.isInteger(rounds) || rounds < 1 || rounds > 20) {
      setMessage("Interview count must be a whole number between 1 and 20.");
      return;
    }

    if (user) {
      const result = await runCloudMutation(() =>
        updateCompany(company.id, { rounds }),
      );
      if (!result.ok) return;
    }
    setCompanies((current) =>
      current.map((item) =>
        item.id === company.id ? { ...item, rounds } : item,
      ),
    );
    setMessage(`${company.name}: interview count updated to ${rounds}.`);
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

  function handleDragStart(event, id) {
    setDraggedId(id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(id));
  }

  function handleDrop(event, status) {
    event.preventDefault();
    const droppedId = event.dataTransfer.getData("text/plain") || draggedId;
    const company = companies.find(
      (item) => String(item.id) === String(droppedId),
    );
    if (company) moveCompany(company.id, status);
    setDraggedId(null);
    setDragOverStatus(null);
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

  async function signOut() {
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) setCloudError(`Could not sign out: ${error.message}`);
    } finally {
      setSigningOut(false);
    }
  }

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
    <main className="app">
      <header className="header">
        <div>
          <div className="eyebrow">JOB HUNT QUEST</div>
          <h1>Journey to Company #100 🎯</h1>
        </div>
        <div className="counter" aria-label={`${companies.length} of 100 companies`}>
          <strong>{companies.length} / 100</strong>
          <span>companies</span>
        </div>
        {user && (
          <div className="account-actions">
            <span>{user.email}</span>
            <button
              className="secondary sign-out-button"
              type="button"
              onClick={signOut}
              disabled={signingOut}
            >
              {signingOut ? <CatLoader label="Signing out..." compact /> : "Sign out"}
            </button>
          </div>
        )}
      </header>

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
        <div className="setup-notice" role="status">
          Local-only mode: add your Supabase project URL and public key to enable
          accounts and cloud sync.
        </div>
      )}

      <div
        className="progress"
        role="progressbar"
        aria-label="Companies tracked"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={Math.min(companies.length, 100)}
      >
        <div style={{ width: `${Math.min(companies.length, 100)}%` }} />
      </div>

      <section className="form-card" aria-label="Add a company">
        <form className="company-form" onSubmit={addCompany}>
          <label>
            Company name
            <input
              type="text"
              placeholder="e.g. Infosys"
              maxLength="80"
              autoComplete="off"
              required
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
            />
          </label>
          <label>
            No. of interviews
            <input
              type="number"
              min="1"
              max="20"
              required
              value={interviewCount}
              onChange={(event) => setInterviewCount(event.target.value)}
            />
          </label>
          <label className="ai-interview-option">
            <input
              type="checkbox"
              checked={isAiInterview}
              onChange={(event) => setIsAiInterview(event.target.checked)}
            />
            AI interview
          </label>
          <button className="add-btn" type="submit">
            {saving ? "Saving..." : "+ Add Company"}
          </button>
        </form>
        <div className="message" aria-live="polite">
          {message}
        </div>
        <div className="saved-state">
          {user
            ? `✓ Data synced to your account (${user.email})`
            : "✓ Your data is saved in this browser"}
        </div>
      </section>

      <section className="stacks" aria-label="Company application statuses">
        {STATUSES.map((status) => (
          <div className="stack-wrap" key={status}>
            <div
              className={`deck ${status}${dragOverStatus === status ? " drag-over" : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDragOverStatus(status);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setDragOverStatus(null);
                }
              }}
              onDrop={(event) => handleDrop(event, status)}
              aria-label={`${STATUS_LABELS[status]} companies`}
            >
              {groups[status].length ? (
                [...groups[status]].reverse().map((company) => (
                  <CompanyCard
                    key={company.id}
                    company={company}
                    onMove={moveCompany}
                    onEdit={editCompany}
                    onDelete={deleteCompany}
                    onDragStart={handleDragStart}
                    onDragEnd={() => {
                      setDraggedId(null);
                      setDragOverStatus(null);
                    }}
                  />
                ))
              ) : (
                <div className="empty">No companies yet</div>
              )}
            </div>
            <div className="label">
              {STATUS_LABELS[status]}{" "}
              <span className="count">({groups[status].length})</span>
            </div>
          </div>
        ))}
        <div className="stack-wrap">
          <div className="deck ai-interview" aria-label="AI interview companies">
            {aiInterviewCompanies.length ? (
              [...aiInterviewCompanies].reverse().map((company) => (
                  <CompanyCard
                    key={company.id}
                    company={company}
                    onMove={moveCompany}
                    onEdit={editCompany}
                    onDelete={deleteCompany}
                    onDragStart={handleDragStart}
                    onDragEnd={() => {
                      setDraggedId(null);
                      setDragOverStatus(null);
                    }}
                  />
                ))
            ) : (
              <div className="empty">No AI interviews yet</div>
            )}
          </div>
          <div className="label">
            AI interview{" "}
            <span className="count">
              ({aiInterviewCompanies.length})
            </span>
          </div>
        </div>
      </section>
      <p className="hint">
        Click a company card to move it: Running → Selected → Pending → Not
        Selected → Running
      </p>

      <section className="question-bank">
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

      <section className="skill-bank">
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

    </main>
  );
}

export default App;
