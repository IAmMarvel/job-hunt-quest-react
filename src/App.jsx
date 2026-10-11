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

function loadCompanies() {
  return loadFromStorage(
    STORAGE_KEYS.companies,
    (company) =>
      company &&
      Number.isFinite(Number(company.id)) &&
      typeof company.name === "string" &&
      STATUSES.includes(company.status),
    INITIAL_COMPANIES,
  ).map((company) => ({
    id: Number(company.id),
    name: company.name.trim(),
    rounds: Math.max(1, Math.min(20, Number(company.rounds) || 1)),
    status: company.status,
  })).filter((company) => company.name);
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

function AuthScreen() {
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setAuthMessage("");

    try {
      const result = creatingAccount
        ? await supabase.auth.signUp({ email: email.trim(), password })
        : await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
      if (result.error) throw result.error;
      if (creatingAccount && !result.data.session) {
        setAuthMessage("Account created. Check your email to confirm your address, then sign in.");
      }
    } catch (error) {
      setAuthMessage(error.message || "Authentication failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="eyebrow">JOB HUNT QUEST</div>
        <h1>{creatingAccount ? "Create your account" : "Welcome back"}</h1>
        <p>Sign in to keep your job hunt data synced across devices.</p>
        <form className="auth-form" onSubmit={submit}>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete={creatingAccount ? "new-password" : "current-password"}
              minLength="8"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button className="add-btn" type="submit" disabled={busy}>
            {busy
              ? "Please wait..."
              : creatingAccount
                ? "Create account"
                : "Sign in"}
          </button>
        </form>
        <div className="message" role="status" aria-live="polite">
          {authMessage}
        </div>
        <button
          className="auth-toggle"
          type="button"
          onClick={() => {
            setCreatingAccount((current) => !current);
            setAuthMessage("");
          }}
        >
          {creatingAccount
            ? "Already have an account? Sign in"
            : "New here? Create an account"}
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
    loadCompanies,
    !supabase,
  );
  const [questions, setQuestions] = usePersistentState(
    STORAGE_KEYS.questions,
    loadQuestions,
    !supabase,
  );
  const [motivations, setMotivations] = usePersistentState(
    STORAGE_KEYS.motivations,
    loadMotivations,
    !supabase,
  );
  const [skills, setSkills] = usePersistentState(
    STORAGE_KEYS.skills,
    loadSkills,
    !supabase,
  );

  const [companyName, setCompanyName] = useState("");
  const [interviewCount, setInterviewCount] = useState("1");
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
  const [cloudError, setCloudError] = useState("");
  const [saving, setSaving] = useState(false);
  const [cloudReload, setCloudReload] = useState(0);
  const legacyData = useRef(null);

  if (!legacyData.current) {
    legacyData.current = {
      companies: loadCompanies(),
      questions: loadQuestions(),
      skills: loadSkills(),
      motivations: loadMotivations(),
    };
  }

  const user = session?.user ?? null;

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setCloudError(error.message);
      if (data?.session) setCloudLoading(true);
      setSession(data?.session ?? null);
      setAuthLoading(false);
    }).catch((error) => {
      if (!active) return;
      setCloudError(error.message || "Could not restore your sign-in session.");
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setCloudLoading(false);
        setCompanies([]);
        setQuestions([]);
        setSkills([]);
        setMotivations([]);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [setCompanies, setMotivations, setQuestions, setSkills]);

  useEffect(() => {
    if (!user) {
      setCloudLoading(false);
      return undefined;
    }

    let active = true;
    setCloudLoading(true);
    setCloudError("");
    fetchUserData()
      .then((data) => {
        if (!active) return;
        setCompanies(data.companies);
        setQuestions(data.questions);
        setSkills(data.skills);
        setMotivations(data.motivations);
      })
      .catch((error) => {
        if (active) {
          setCloudError(error.message || "Could not load your saved data.");
        }
      })
      .finally(() => {
        if (active) setCloudLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user?.id, cloudReload, setCompanies, setMotivations, setQuestions, setSkills]);

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

    const newCompany = { name, rounds, status: "running" };
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

  async function importLocalData() {
    const backup = legacyData.current;
    const total =
      backup.companies.length +
      backup.questions.length +
      backup.skills.length +
      backup.motivations.length;
    if (
      !window.confirm(
        `Import browser data (${backup.companies.length} companies, ${backup.questions.length} questions, ${backup.skills.length} skills, and ${backup.motivations.length} motivation lines)? Repeating the import updates matching imported entries.`,
      )
    ) {
      return;
    }
    if (!total) return;

    const result = await runCloudMutation(() =>
      importBrowserData(user.id, backup),
    );
    if (!result.ok) return;
    setCompanies(result.value.companies);
    setQuestions(result.value.questions);
    setSkills(result.value.skills);
    setMotivations(result.value.motivations);
    setMessage("Browser data imported to your account.");
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) setMessage(`Could not sign out: ${error.message}`);
  }

  if (supabase && authLoading) {
    return <main className="auth-page"><p>Checking your sign-in...</p></main>;
  }

  if (supabase && !user) {
    return (
      <>
        <AuthScreen />
        {cloudError && <p className="auth-error">{cloudError}</p>}
      </>
    );
  }

  if (supabase && cloudLoading) {
    return <main className="auth-page"><p>Loading your saved job hunt...</p></main>;
  }

  if (supabase && cloudError) {
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
          <button className="auth-toggle" type="button" onClick={signOut}>
            Sign out
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
            <button className="secondary" type="button" onClick={signOut}>
              Sign out
            </button>
          </div>
        )}
      </header>

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

      {user && (
        <div className="import-row">
          <p>Have data saved in this browser? Import it into your account.</p>
          <button
            className="secondary"
            type="button"
            onClick={importLocalData}
            disabled={saving}
          >
            {saving ? "Importing..." : "Import browser data"}
          </button>
        </div>
      )}

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
