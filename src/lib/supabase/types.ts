export type Difficulty = "debutant" | "intermediaire" | "avance" | "expert";
export type Gender = "homme" | "femme";
export type SessionStatus = "active" | "completed" | "abandoned";
export type EndedBy = "user" | "prospect" | "timeout";
export type MessageRole = "user" | "prospect" | "system";
export type CategoryKey =
  | "accroche"
  | "decouverte"
  | "valeur"
  | "objections"
  | "closing";

export type UserRole = "commercial" | "manager";

export interface Profile {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  company: string | null;
  role_title: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyncedFile {
  filename: string;
  size: number;
  char_count: number;
  uploaded_at: string;
  kind: "pdf" | "docx" | "csv" | "txt" | "md" | "other";
}

export interface PersonaProfile {
  id: string; // slug, ex: "avocat"
  label: string; // "Avocat"
  role: string; // "Avocat associé en droit des affaires"
  typical_company: string; // "Cabinet de 5-15 personnes en grande ville"
  key_pains: string[];
  key_kpis: string[];
  main_objections: string[];
  decision_signals: string;
  prep_briefing: string; // 2-3 paragraphes pour préparer l'appel
  prep_bullets?: string[]; // 4-6 points clés ultra-courts pour la sidebar
}

export type QuizCategory =
  | "qui"
  | "pourquoi"
  | "quoi"
  | "douleurs"
  | "objections";

export interface QuizQuestion {
  id: string;
  category: QuizCategory;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

export interface QuizData {
  questions: QuizQuestion[];
  generated_at: string;
  source_version: string;
}

export interface QuizAttemptAnswer {
  question_id: string;
  selected_index: number;
  correct: boolean;
}

export interface QuizAttemptRow {
  id: string;
  client_id: string;
  user_id: string;
  total_questions: number;
  correct_answers: number;
  score: number;
  answers: QuizAttemptAnswer[];
  started_at: string;
  completed_at: string;
}

export interface Client {
  id: string;
  name: string;
  sector: string | null;
  description: string | null;
  value_proposition: string | null;
  product_pitch: string;
  ideal_targets: string | null;
  typical_objections: string[];
  active: boolean;
  synced_content: string | null;
  synced_at: string | null;
  synced_files: SyncedFile[];
  target_personas: string[];
  persona_profiles: PersonaProfile[];
  quiz_data: QuizData | null;
  quiz_generated_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface Scenario {
  persona_label: string;
  persona_name: string;
  persona_role: string;
  company_name: string;
  company_context: string;
  current_situation: string;
  hidden_pain_points: string[];
  kpis_to_probe: string[];
  available_objections: string[];
  decision_criteria: string;
  voice_notes: string;
  // Champs enrichis pour rendre la simulation plus réaliste
  current_setting?: string; // où se trouve physiquement le prospect au moment de l'appel
  mood_baseline?: string; // humeur de base au décrochage
  speech_quirks?: string[]; // tics de langage du persona
}

export interface SessionRow {
  id: string;
  user_id: string;
  client_id: string | null;
  client_name_snapshot: string | null;
  difficulty: Difficulty;
  gender: Gender | null;
  persona_key: string;
  persona_label: string;
  product_pitch: string | null;
  objective: string;
  status: SessionStatus;
  ended_by: EndedBy | null;
  appointment_secured: boolean;
  score: number | null;
  evaluation: Evaluation | null;
  scenario_data: Scenario | null;
  started_at: string;
  ended_at: string | null;
}

export interface MessageRow {
  id: string;
  session_id: string;
  role: MessageRole;
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface CriterionResult {
  id: string;
  label: string;
  passed: boolean;
  comment: string;
}

export interface CategoryResult {
  key: CategoryKey;
  label: string;
  score: number;
  max: number;
  criteria: CriterionResult[];
}

export interface Evaluation {
  overall_score: number;
  criteria_total: number;
  criteria_max: number;
  categories: CategoryResult[];
  strengths: string[];
  improvements: string[];
  next_steps: string[];
  outcome_summary: string;
}
