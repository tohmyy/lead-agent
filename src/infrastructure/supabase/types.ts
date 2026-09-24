/**
 * Hand-written mirror of supabase/migrations/*.sql. Regenerate with the
 * Supabase CLI once a live project exists:
 *   supabase gen types typescript --project-id <ref> > src/infrastructure/supabase/types.ts
 * and re-apply the header comment if the CLI overwrites it.
 *
 * IMPORTANT: every shape here is declared with `type X = {...}`, never
 * `interface X {...}`. supabase-js's generic resolution checks each table
 * shape against a `Record<string, unknown>`-based constraint, and
 * TypeScript only grants interfaces the "implicit index signature"
 * compatibility that check depends on in some circumstances — in this
 * generic/conditional-type position it silently does not, which makes
 * every `.from(...)` call resolve to `never` with no error until each
 * calling site. Type aliases don't have this gap. Keep it that way.
 */

export type RunStatus =
  | "draft"
  | "awaiting_icp_approval"
  | "researching"
  | "generating_outreach"
  | "awaiting_review"
  | "completed"
  | "failed"
  | "cancelled";

export type IcpSource = "agent" | "user";

export type QualificationStatus =
  "qualified" | "not_qualified" | "needs_review";

export type ReviewState =
  "not_reviewed" | "reviewed" | "edited" | "approved_for_export";

export type SourceType =
  | "homepage"
  | "about"
  | "product"
  | "services"
  | "pricing"
  | "careers"
  | "blog"
  | "other";

export type OutreachChannel = "email" | "linkedin";

export type ToolCallStatus = "pending" | "running" | "success" | "failed";

export type RunEventType =
  | "run_created"
  | "icp_refined"
  | "icp_approved"
  | "discovery_started"
  | "discovery_completed"
  | "company_research_started"
  | "company_research_completed"
  | "lead_qualified"
  | "lead_rejected"
  | "outreach_started"
  | "outreach_completed"
  | "run_completed"
  | "run_failed"
  | "run_cancelled";

export type IcpCriteria = {
  geography?: { include?: string[]; exclude?: string[] };
  industry?: { include?: string[]; exclude?: string[] };
  employee_range?: { min?: number; max?: number };
  business_model?: { include?: string[] };
  target_personas?: string[];
  hard_filters: string[];
  soft_signals: string[];
};

export type FitReason = {
  reason: string;
  evidence?: string;
  source_ids: string[];
};

export type Concern = {
  concern: string;
  severity: "low" | "medium" | "high";
  source_ids: string[];
};

export type PersonalizationContext = {
  claims: Array<{ text: string; source_id: string }>;
};

type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type RunRow = {
  id: string;
  user_id: string;
  objective: string;
  status: RunStatus;
  qualified_target: number;
  discovery_limit: number;
  discovered_count: number;
  qualified_count: number;
  rejected_count: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type RunIcpRow = {
  id: string;
  run_id: string;
  version: number;
  source: IcpSource;
  criteria: IcpCriteria;
  reasoning: string | null;
  approved: boolean;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
};

export type DiscoveredCompanyRow = {
  id: string;
  run_id: string;
  company_name: string;
  domain: string;
  normalized_domain: string;
  discovery_source: string;
  source_url: string | null;
  external_id: string | null;
  raw_metadata: Record<string, unknown> | null;
  discovered_at: string;
  created_at: string;
};

export type LeadRow = {
  id: string;
  run_id: string;
  discovered_company_id: string;
  company_name: string;
  domain: string;
  qualification_status: QualificationStatus;
  confidence_score: number | null;
  fit_reasons: FitReason[];
  concerns: Concern[];
  qualification_reasoning: string;
  source_summary: string;
  research_metadata: Record<string, unknown> | null;
  review_state: ReviewState;
  qualified_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LeadSourceRow = {
  id: string;
  discovered_company_id: string;
  run_id: string;
  url: string;
  normalized_url: string;
  title: string | null;
  source_type: SourceType;
  summary: string;
  relevant_excerpt: string | null;
  scraped_at: string;
  provider: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type ToolCallRow = {
  id: string;
  run_id: string;
  tool_name: string;
  purpose: string;
  input_summary: Record<string, unknown>;
  result_summary: Record<string, unknown> | null;
  status: ToolCallStatus;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  external_reference: string | null;
  created_at: string;
};

export type RunEventRow = {
  id: string;
  run_id: string;
  event_type: RunEventType;
  message: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type OutreachDraftRow = {
  id: string;
  lead_id: string;
  run_id: string;
  channel: OutreachChannel;
  step: 1 | 2 | 3 | null;
  subject: string | null;
  body: string;
  personalization_context: PersonalizationContext;
  review_state: ReviewState;
  version: number;
  created_at: string;
  updated_at: string;
};

/**
 * Marks `K` optional (columns with a DB-level default, e.g. `default now()`
 * or `default false`) while leaving every other column as-required for
 * insert — deliberately per-table rather than a blanket "id/created_at
 * only" rule, since which columns have defaults genuinely varies by table
 * (see supabase/migrations/001_initial_schema.sql).
 */
type Optional<Row, K extends keyof Row> = Omit<Row, K> & Partial<Pick<Row, K>>;

type RunInsert = Optional<
  RunRow,
  | "id"
  | "status"
  | "discovered_count"
  | "qualified_count"
  | "rejected_count"
  | "started_at"
  | "completed_at"
  | "error_message"
  | "created_at"
  | "updated_at"
>;

type RunIcpInsert = Optional<
  RunIcpRow,
  "id" | "reasoning" | "approved" | "approved_at" | "approved_by" | "created_at"
>;

type DiscoveredCompanyInsert = Optional<
  DiscoveredCompanyRow,
  | "id"
  | "discovery_source"
  | "source_url"
  | "external_id"
  | "raw_metadata"
  | "discovered_at"
  | "created_at"
>;

type LeadInsert = Optional<
  LeadRow,
  | "id"
  | "confidence_score"
  | "fit_reasons"
  | "concerns"
  | "research_metadata"
  | "review_state"
  | "qualified_at"
  | "created_at"
  | "updated_at"
>;

type LeadSourceInsert = Optional<
  LeadSourceRow,
  "id" | "title" | "relevant_excerpt" | "scraped_at" | "metadata" | "created_at"
>;

type ToolCallInsert = Optional<
  ToolCallRow,
  | "id"
  | "result_summary"
  | "status"
  | "error_message"
  | "started_at"
  | "completed_at"
  | "duration_ms"
  | "external_reference"
  | "created_at"
>;

type RunEventInsert = Optional<RunEventRow, "id" | "metadata" | "created_at">;

type OutreachDraftInsert = Optional<
  OutreachDraftRow,
  | "id"
  | "step"
  | "subject"
  | "personalization_context"
  | "review_state"
  | "version"
  | "created_at"
  | "updated_at"
>;

export type Database = {
  public: {
    Tables: {
      runs: Table<RunRow, RunInsert, Partial<RunRow>>;
      run_icps: Table<RunIcpRow, RunIcpInsert, Partial<RunIcpRow>>;
      discovered_companies: Table<
        DiscoveredCompanyRow,
        DiscoveredCompanyInsert,
        Partial<DiscoveredCompanyRow>
      >;
      leads: Table<LeadRow, LeadInsert, Partial<LeadRow>>;
      lead_sources: Table<
        LeadSourceRow,
        LeadSourceInsert,
        Partial<LeadSourceRow>
      >;
      tool_calls: Table<ToolCallRow, ToolCallInsert, Partial<ToolCallRow>>;
      run_events: Table<RunEventRow, RunEventInsert, Partial<RunEventRow>>;
      outreach_drafts: Table<
        OutreachDraftRow,
        OutreachDraftInsert,
        Partial<OutreachDraftRow>
      >;
    };
    Views: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
    Functions: {
      reserve_discovery_slots: {
        Args: { p_run_id: string; p_count: number };
        Returns: number;
      };
      release_discovery_slots: {
        Args: { p_run_id: string; p_count: number };
        Returns: undefined;
      };
      increment_run_counts: {
        Args: {
          p_run_id: string;
          p_qualified_delta: number;
          p_rejected_delta: number;
        };
        Returns: undefined;
      };
    };
  };
};
