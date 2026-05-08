export type Difficulty = "debutant" | "intermediaire" | "avance" | "expert";
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

export interface SessionRow {
  id: string;
  user_id: string;
  difficulty: Difficulty;
  persona_key: string;
  persona_label: string;
  product_pitch: string | null;
  objective: string;
  status: SessionStatus;
  ended_by: EndedBy | null;
  appointment_secured: boolean;
  score: number | null;
  evaluation: Evaluation | null;
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
