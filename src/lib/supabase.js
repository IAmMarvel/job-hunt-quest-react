import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const TABLES = {
  companies: "companies",
  questions: "interview_questions",
  skills: "skills",
  motivations: "motivation_lines",
};

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

async function insertRow(table, values) {
  return unwrap(
    await supabase.from(table).insert(values).select("*").single(),
  );
}

async function updateRow(table, id, values) {
  return unwrap(
    await supabase.from(table).update(values).eq("id", id).select("*").single(),
  );
}

async function deleteRow(table, id) {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
}

export async function fetchUserData() {
  const [companies, questions, skills, motivations] = await Promise.all([
    supabase.from(TABLES.companies).select("id,name,rounds,status").order("created_at"),
    supabase
      .from(TABLES.questions)
      .select("id,question,company,topic,round")
      .order("created_at"),
    supabase
      .from(TABLES.skills)
      .select("id,name,category,status")
      .order("created_at"),
    supabase
      .from(TABLES.motivations)
      .select("id,line")
      .order("created_at"),
  ]);

  return {
    companies: unwrap(companies),
    questions: unwrap(questions),
    skills: unwrap(skills),
    motivations: unwrap(motivations),
  };
}

export const createCompany = (userId, company) =>
  insertRow(TABLES.companies, { ...company, user_id: userId });
export const updateCompany = (id, changes) =>
  updateRow(TABLES.companies, id, changes);
export const deleteCompany = (id) => deleteRow(TABLES.companies, id);

export async function resetCompanies(userId, initialCompanies) {
  return unwrap(
    await supabase.rpc("reset_user_companies", {
      p_user_id: userId,
      p_companies: initialCompanies.map(({ name, rounds, status }) => ({
        name,
        rounds,
        status,
      })),
    }),
  );
}

export const createQuestion = (userId, question) =>
  insertRow(TABLES.questions, { ...question, user_id: userId });
export const updateQuestion = (id, changes) =>
  updateRow(TABLES.questions, id, changes);
export const deleteQuestion = (id) => deleteRow(TABLES.questions, id);

export const createSkill = (userId, skill) =>
  insertRow(TABLES.skills, { ...skill, user_id: userId });
export const updateSkill = (id, changes) => updateRow(TABLES.skills, id, changes);
export const deleteSkill = (id) => deleteRow(TABLES.skills, id);

export const createMotivation = (userId, line) =>
  insertRow(TABLES.motivations, { line, user_id: userId });
export const updateMotivation = (id, line) =>
  updateRow(TABLES.motivations, id, { line });
export const deleteMotivation = (id) => deleteRow(TABLES.motivations, id);

export async function importBrowserData(userId, data) {
  const batches = [
    {
      table: TABLES.companies,
      rows: data.companies.map((company, index) => ({
        user_id: userId,
        legacy_id: `company:${company.id ?? index}`,
        name: company.name,
        rounds: company.rounds,
        status: company.status,
      })),
    },
    {
      table: TABLES.questions,
      rows: data.questions.map((item, index) => ({
        user_id: userId,
        legacy_id: `question:${item.id ?? index}`,
        question: item.question,
        company: item.company,
        topic: item.topic,
        round: item.round,
      })),
    },
    {
      table: TABLES.skills,
      rows: data.skills.map((skill, index) => ({
        user_id: userId,
        legacy_id: `skill:${skill.id ?? index}`,
        name: skill.name,
        category: skill.category,
        status: skill.status,
      })),
    },
    {
      table: TABLES.motivations,
      rows: data.motivations.map((item, index) => ({
        user_id: userId,
        legacy_id: `motivation:${item.id ?? index}`,
        line: typeof item === "string" ? item : item.line,
      })),
    },
  ];

  for (const batch of batches) {
    if (batch.rows.length) {
      unwrap(
        await supabase
          .from(batch.table)
          .upsert(batch.rows, { onConflict: "user_id,legacy_id" }),
      );
    }
  }

  return fetchUserData();
}
