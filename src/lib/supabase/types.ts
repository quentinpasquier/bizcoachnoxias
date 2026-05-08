export type Difficulty = "debutant" | "intermediaire" | "avance" | "expert";
export type Gender = "homme" | "femme";
export type SessionStatus = "active" | "completed" | "abandoned";
export type EndedBy = "user" | "prospect" | "timeout";
export type MessageRole = "user" | "prospect" | "system";

export interface Profile {
  id: string;
  full_name: string | null;
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

export interface AxisScore {
  score: number;
  comment: string;
}

export interface Evaluation {
  overall_score: number;
  axes: {
    accroche: AxisScore;
    decouverte: AxisScore;
    objections: AxisScore;
    valeur: AxisScore;
    closing: AxisScore;
  };
  strengths: string[];
  improvements: string[];
  next_steps: string[];
  outcome_summary: string;
}
