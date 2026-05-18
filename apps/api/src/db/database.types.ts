export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      cards: {
        Row: {
          card_type: Database["public"]["Enums"]["card_type"]
          created_at: string
          deck_id: string | null
          difficulty: number
          due: string
          elapsed_days: number
          embedding: string | null
          embedding_updated_at: string | null
          fields_data: Json
          id: string
          is_suspended: boolean
          jlpt_level: Database["public"]["Enums"]["jlpt_level"] | null
          lapses: number
          last_review: string | null
          layout_type: Database["public"]["Enums"]["layout_type"]
          learning_steps: number
          parent_card_id: string | null
          premade_deck_id: string | null
          reps: number
          scheduled_days: number
          stability: number
          state: number
          tags: string[]
          updated_at: string
          user_id: string | null
          version: number
        }
        Insert: {
          card_type?: Database["public"]["Enums"]["card_type"]
          created_at?: string
          deck_id?: string | null
          difficulty?: number
          due?: string
          elapsed_days?: number
          embedding?: string | null
          embedding_updated_at?: string | null
          fields_data?: Json
          id?: string
          is_suspended?: boolean
          jlpt_level?: Database["public"]["Enums"]["jlpt_level"] | null
          lapses?: number
          last_review?: string | null
          layout_type?: Database["public"]["Enums"]["layout_type"]
          learning_steps?: number
          parent_card_id?: string | null
          premade_deck_id?: string | null
          reps?: number
          scheduled_days?: number
          stability?: number
          state?: number
          tags?: string[]
          updated_at?: string
          user_id?: string | null
          version?: number
        }
        Update: {
          card_type?: Database["public"]["Enums"]["card_type"]
          created_at?: string
          deck_id?: string | null
          difficulty?: number
          due?: string
          elapsed_days?: number
          embedding?: string | null
          embedding_updated_at?: string | null
          fields_data?: Json
          id?: string
          is_suspended?: boolean
          jlpt_level?: Database["public"]["Enums"]["jlpt_level"] | null
          lapses?: number
          last_review?: string | null
          layout_type?: Database["public"]["Enums"]["layout_type"]
          learning_steps?: number
          parent_card_id?: string | null
          premade_deck_id?: string | null
          reps?: number
          scheduled_days?: number
          stability?: number
          state?: number
          tags?: string[]
          updated_at?: string
          user_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "cards_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_parent_card_id_fkey"
            columns: ["parent_card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_premade_deck_id_fkey"
            columns: ["premade_deck_id"]
            isOneToOne: false
            referencedRelation: "premade_decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      card_state_snapshots: {
        Row: {
          user_id:          string
          snapshot_date:    string
          new_count:        number
          learning_count:   number
          review_count:     number
          relearning_count: number
          mature_count:     number
          recorded_at:      string
        }
        Insert: {
          user_id:           string
          snapshot_date:     string
          new_count?:        number
          learning_count?:   number
          review_count?:     number
          relearning_count?: number
          mature_count?:     number
          recorded_at?:      string
        }
        Update: {
          user_id?:          string
          snapshot_date?:    string
          new_count?:        number
          learning_count?:   number
          review_count?:     number
          relearning_count?: number
          mature_count?:     number
          recorded_at?:      string
        }
        Relationships: [
          {
            foreignKeyName: "card_state_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      confusable_pairs: {
        Row: {
          user_id:          string
          card_a:           string
          card_b:           string
          miss_count:       number
          similarity_score: number
          last_observed:    string
          recorded_at:      string
        }
        Insert: {
          user_id:           string
          card_a:            string
          card_b:            string
          miss_count?:       number
          similarity_score:  number
          last_observed:     string
          recorded_at?:      string
        }
        Update: {
          user_id?:          string
          card_a?:           string
          card_b?:           string
          miss_count?:       number
          similarity_score?: number
          last_observed?:    string
          recorded_at?:      string
        }
        Relationships: [
          {
            foreignKeyName: "confusable_pairs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "confusable_pairs_card_a_fkey"
            columns: ["card_a"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "confusable_pairs_card_b_fkey"
            columns: ["card_b"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      decks: {
        Row: {
          card_count: number
          created_at: string
          deck_type: Database["public"]["Enums"]["deck_type"]
          description: string | null
          id: string
          is_public: boolean
          name: string
          source_premade_id: string | null
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          card_count?: number
          created_at?: string
          deck_type?: Database["public"]["Enums"]["deck_type"]
          description?: string | null
          id?: string
          is_public?: boolean
          name: string
          source_premade_id?: string | null
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          card_count?: number
          created_at?: string
          deck_type?: Database["public"]["Enums"]["deck_type"]
          description?: string | null
          id?: string
          is_public?: boolean
          name?: string
          source_premade_id?: string | null
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "decks_source_premade_id_fkey"
            columns: ["source_premade_id"]
            isOneToOne: false
            referencedRelation: "premade_decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      idempotency_keys: {
        Row: {
          created_at: string
          expires_at: string
          key: string
          request_hash: string
          response_body: Json | null
          response_status: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          key: string
          request_hash: string
          response_body?: Json | null
          response_status?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          key?: string
          request_hash?: string
          response_body?: Json | null
          response_status?: number | null
          user_id?: string
        }
        Relationships: []
      }
      leech_drill_attempts: {
        Row: {
          answered_at: string
          card_id: string | null
          created_at: string
          event_id: string
          id: string
          leech_id: string | null
          local_sequence: number | null
          response_time_ms: number | null
          result: string
          session_card_id: string
          session_id: string
          shown_at: string | null
          user_id: string
        }
        Insert: {
          answered_at?: string
          card_id?: string | null
          created_at?: string
          event_id: string
          id?: string
          leech_id?: string | null
          local_sequence?: number | null
          response_time_ms?: number | null
          result: string
          session_card_id: string
          session_id: string
          shown_at?: string | null
          user_id: string
        }
        Update: {
          answered_at?: string
          card_id?: string | null
          created_at?: string
          event_id?: string
          id?: string
          leech_id?: string | null
          local_sequence?: number | null
          response_time_ms?: number | null
          result?: string
          session_card_id?: string
          session_id?: string
          shown_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leech_drill_attempts_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leech_drill_attempts_leech_id_fkey"
            columns: ["leech_id"]
            isOneToOne: false
            referencedRelation: "leeches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leech_drill_attempts_session_card_fk"
            columns: ["session_card_id", "session_id"]
            isOneToOne: false
            referencedRelation: "leech_drill_session_cards"
            referencedColumns: ["id", "session_id"]
          },
          {
            foreignKeyName: "leech_drill_attempts_session_fk"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "leech_drill_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leech_drill_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leech_drill_session_cards: {
        Row: {
          baseline_difficulty: number
          baseline_due: string
          baseline_elapsed_days: number
          baseline_lapses: number
          baseline_last_review: string | null
          baseline_learning_steps: number
          baseline_reps: number
          baseline_scheduled_days: number
          baseline_stability: number
          baseline_state: number
          canonical_state_fingerprint: string
          card_id: string | null
          created_at: string
          id: string
          leech_id: string | null
          ordinal: number
          session_id: string
          source_reason: string
          user_id: string
        }
        Insert: {
          baseline_difficulty: number
          baseline_due: string
          baseline_elapsed_days: number
          baseline_lapses: number
          baseline_last_review?: string | null
          baseline_learning_steps: number
          baseline_reps: number
          baseline_scheduled_days: number
          baseline_stability: number
          baseline_state: number
          canonical_state_fingerprint: string
          card_id?: string | null
          created_at?: string
          id?: string
          leech_id?: string | null
          ordinal: number
          session_id: string
          source_reason: string
          user_id: string
        }
        Update: {
          baseline_difficulty?: number
          baseline_due?: string
          baseline_elapsed_days?: number
          baseline_lapses?: number
          baseline_last_review?: string | null
          baseline_learning_steps?: number
          baseline_reps?: number
          baseline_scheduled_days?: number
          baseline_stability?: number
          baseline_state?: number
          canonical_state_fingerprint?: string
          card_id?: string | null
          created_at?: string
          id?: string
          leech_id?: string | null
          ordinal?: number
          session_id?: string
          source_reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leech_drill_session_cards_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leech_drill_session_cards_leech_id_fkey"
            columns: ["leech_id"]
            isOneToOne: false
            referencedRelation: "leeches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leech_drill_session_cards_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "leech_drill_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leech_drill_session_cards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leech_drill_sessions: {
        Row: {
          created_at: string
          finished_at: string | null
          id: string
          mode: string
          repeat_policy: string
          source: string
          source_query: Json
          started_at: string
          status: string
          stop_rule: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          finished_at?: string | null
          id?: string
          mode?: string
          repeat_policy?: string
          source: string
          source_query?: Json
          started_at?: string
          status?: string
          stop_rule?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          finished_at?: string | null
          id?: string
          mode?: string
          repeat_policy?: string
          source?: string
          source_query?: Json
          started_at?: string
          status?: string
          stop_rule?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leech_drill_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leeches: {
        Row: {
          card_id: string | null
          created_at: string
          diagnosis: string | null
          id: string
          prescription: string | null
          resolved: boolean
          resolved_at: string | null
          session_id: string | null
          user_id: string
        }
        Insert: {
          card_id?: string | null
          created_at?: string
          diagnosis?: string | null
          id?: string
          prescription?: string | null
          resolved?: boolean
          resolved_at?: string | null
          session_id?: string | null
          user_id: string
        }
        Update: {
          card_id?: string | null
          created_at?: string
          diagnosis?: string | null
          id?: string
          prescription?: string | null
          resolved?: boolean
          resolved_at?: string | null
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leeches_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leeches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      premade_decks: {
        Row: {
          card_count: number
          created_at: string
          deck_type: Database["public"]["Enums"]["deck_type"]
          description: string | null
          domain: string | null
          id: string
          is_active: boolean
          jlpt_level: Database["public"]["Enums"]["jlpt_level"] | null
          name: string
          updated_at: string
        }
        Insert: {
          card_count?: number
          created_at?: string
          deck_type: Database["public"]["Enums"]["deck_type"]
          description?: string | null
          domain?: string | null
          id?: string
          is_active?: boolean
          jlpt_level?: Database["public"]["Enums"]["jlpt_level"] | null
          name: string
          updated_at?: string
        }
        Update: {
          card_count?: number
          created_at?: string
          deck_type?: Database["public"]["Enums"]["deck_type"]
          description?: string | null
          domain?: string | null
          id?: string
          is_active?: boolean
          jlpt_level?: Database["public"]["Enums"]["jlpt_level"] | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          daily_new_cards_limit: number
          daily_review_limit: number
          id: string
          jlpt_target: Database["public"]["Enums"]["jlpt_level"] | null
          native_language: string
          retention_target: number
          study_goal: string | null
          timezone: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          daily_new_cards_limit?: number
          daily_review_limit?: number
          id: string
          jlpt_target?: Database["public"]["Enums"]["jlpt_level"] | null
          native_language?: string
          retention_target?: number
          study_goal?: string | null
          timezone?: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          daily_new_cards_limit?: number
          daily_review_limit?: number
          id?: string
          jlpt_target?: Database["public"]["Enums"]["jlpt_level"] | null
          native_language?: string
          retention_target?: number
          study_goal?: string | null
          timezone?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      review_logs: {
        Row: {
          card_id: string | null
          difficulty_after: number
          difficulty_before: number | null
          due_after: string
          due_before: string | null
          elapsed_days_before: number | null
          id: string
          lapses_before: number | null
          last_review_before: string | null
          learning_steps_before: number | null
          rating: Database["public"]["Enums"]["review_rating"]
          reps_before: number | null
          review_time_ms: number | null
          reviewed_at: string
          scheduled_days_after: number
          scheduled_days_before: number | null
          session_id: string | null
          stability_after: number
          stability_before: number | null
          state_before: number | null
          user_id: string
        }
        Insert: {
          card_id?: string | null
          difficulty_after: number
          difficulty_before?: number | null
          due_after: string
          due_before?: string | null
          elapsed_days_before?: number | null
          id?: string
          lapses_before?: number | null
          last_review_before?: string | null
          learning_steps_before?: number | null
          rating: Database["public"]["Enums"]["review_rating"]
          reps_before?: number | null
          review_time_ms?: number | null
          reviewed_at?: string
          scheduled_days_after: number
          scheduled_days_before?: number | null
          session_id?: string | null
          stability_after: number
          stability_before?: number | null
          state_before?: number | null
          user_id: string
        }
        Update: {
          card_id?: string | null
          difficulty_after?: number
          difficulty_before?: number | null
          due_after?: string
          due_before?: string | null
          elapsed_days_before?: number | null
          id?: string
          lapses_before?: number | null
          last_review_before?: string | null
          learning_steps_before?: number | null
          rating?: Database["public"]["Enums"]["review_rating"]
          reps_before?: number | null
          review_time_ms?: number | null
          reviewed_at?: string
          scheduled_days_after?: number
          scheduled_days_before?: number | null
          session_id?: string | null
          stability_after?: number
          stability_before?: number | null
          state_before?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_logs_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_interests: {
        Row: {
          interest: string
          user_id: string
        }
        Insert: {
          interest: string
          user_id: string
        }
        Update: {
          interest?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_interests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bulk_update_card_embeddings: {
        Args: { p_updates: Json }
        Returns: number
      }
      claim_idempotency_key: {
        Args: { p_key: string; p_request_hash: string; p_user_id: string }
        Returns: {
          status: string
          stored_body: Json
          stored_status: number
        }[]
      }
      compute_card_state_fingerprint_v1: {
        Args: {
          p_difficulty: number
          p_due: string
          p_elapsed_days: number
          p_lapses: number
          p_last_review: string
          p_learning_steps: number
          p_reps: number
          p_scheduled_days: number
          p_stability: number
          p_state: number
        }
        Returns: string
      }
      create_leech_drill_session:
        | {
            Args: {
              p_card_type: string
              p_deck_id: string
              p_jlpt_level: string
              p_limit: number
              p_mode: string
              p_order: string
              p_repeat_policy: string
              p_source: string
              p_source_query: Json
              p_stop_rule: Json
              p_user_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_card_id: string
              p_card_ids: string[]
              p_card_type: string
              p_deck_id: string
              p_jlpt_level: string
              p_limit: number
              p_min_lapses: number
              p_mode: string
              p_order: string
              p_repeat_policy: string
              p_source: string
              p_source_query: Json
              p_stop_rule: Json
              p_user_id: string
            }
            Returns: Json
          }
      delete_idempotency_key: {
        Args: { p_key: string; p_user_id: string }
        Returns: undefined
      }
      find_similar_cards: {
        Args: { p_card_id: string; p_limit?: number; p_user_id: string }
        Returns: {
          card_type: Database["public"]["Enums"]["card_type"]
          deck_id: string
          fields_data: Json
          id: string
          jlpt_level: Database["public"]["Enums"]["jlpt_level"]
          layout_type: Database["public"]["Enums"]["layout_type"]
          similarity: number
          tags: string[]
        }[]
      }
      get_accuracy_by_layout: {
        Args: { p_user_id: string }
        Returns: {
          layout: string
          successful: number
          total: number
        }[]
      }
      get_dashboard_data:
        | { Args: { p_user_id: string }; Returns: Json }
        | { Args: { p_timezone?: string; p_user_id: string }; Returns: Json }
      get_due_cards: {
        Args: {
          p_daily_new_cards_limit: number
          p_daily_review_limit: number
          p_timezone?: string
          p_user_id: string
        }
        Returns: {
          card_type: Database["public"]["Enums"]["card_type"]
          deck_id: string
          due: string
          fields_data: Json
          id: string
          jlpt_level: Database["public"]["Enums"]["jlpt_level"]
          layout_type: Database["public"]["Enums"]["layout_type"]
          state: number
        }[]
      }
      get_heatmap_data: {
        Args: { p_timezone?: string; p_user_id: string }
        Returns: {
          count: number
          date: string
          retention: number
        }[]
      }
      get_card_quality_issues: {
        Args: { p_user_id: string }
        Returns: {
          issue_type: string
          count:      number
        }[]
      }
      get_confusable_pairs: {
        Args: { p_user_id: string; p_limit: number }
        Returns: {
          card_a_id:        string
          card_b_id:        string
          card_a_word:      string | null
          card_a_reading:   string | null
          card_a_meaning:   string | null
          card_b_word:      string | null
          card_b_reading:   string | null
          card_b_meaning:   string | null
          miss_count:       number
          similarity_score: number
          last_observed:    string
        }[]
      }
      record_confusable_pairs: {
        Args: Record<string, never>
        Returns: undefined
      }
      get_maturity_pipeline_history: {
        Args: { p_days: number; p_user_id: string }
        Returns: {
          snapshot_date:    string
          new_count:        number
          learning_count:   number
          review_count:     number
          relearning_count: number
          mature_count:     number
        }[]
      }
      record_card_state_snapshots: {
        Args: Record<string, never>
        Returns: undefined
      }
      get_jlpt_gap: {
        Args: { p_user_id: string }
        Returns: {
          due: number
          jlpt_level: string
          learned: number
          total: number
        }[]
      }
      get_leech_drill_session: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: Json
      }
      get_milestone_forecast: {
        Args: { p_user_id: string }
        Returns: {
          daily_pace: number
          days_remaining: number
          jlpt_level: string
          learned: number
          projected_completion_date: string
          total: number
        }[]
      }
      get_problem_cards: {
        Args: { p_bucket: string; p_user_id: string }
        Returns: {
          card_id:     string
          card_type:   Database["public"]["Enums"]["card_type"]
          deck_id:     string | null
          due:         string
          fields_data: Json
          jlpt_level:  Database["public"]["Enums"]["jlpt_level"] | null
          lapses:      number
          last_review: string | null
          layout_type: Database["public"]["Enums"]["layout_type"]
          reps:        number
          state:       number
        }[]
      }
      get_review_forecast: {
        Args: {
          p_daily_new_cards_limit?: number
          p_daily_review_limit?: number
          p_days?: number
          p_timezone?: string
          p_user_id: string
        }
        Returns: {
          backlog_count: number
          count: number
          date: string
          new_count: number
          review_count: number
        }[]
      }
      get_session_summary: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: Json
      }
      get_stale_embedding_cards: {
        Args: { p_user_id: string }
        Returns: {
          card_type: Database["public"]["Enums"]["card_type"]
          created_at: string
          deck_id: string
          difficulty: number
          due: string
          elapsed_days: number
          fields_data: Json
          id: string
          is_suspended: boolean
          jlpt_level: Database["public"]["Enums"]["jlpt_level"]
          lapses: number
          last_review: string
          layout_type: Database["public"]["Enums"]["layout_type"]
          parent_card_id: string
          reps: number
          scheduled_days: number
          stability: number
          state: number
          tags: string[]
          updated_at: string
          user_id: string
        }[]
      }
      list_cards_paginated: {
        Args: {
          p_cursor?: string
          p_deck_id: string
          p_limit: number
          p_status_filter?: string
          p_user_id: string
        }
        Returns: {
          card_type: Database["public"]["Enums"]["card_type"]
          due: string
          fields_data: Json
          id: string
          is_suspended: boolean
          jlpt_level: Database["public"]["Enums"]["jlpt_level"]
          layout_type: Database["public"]["Enums"]["layout_type"]
          state: number
          tags: string[]
        }[]
      }
      list_decks_paginated: {
        Args: { p_cursor?: string; p_limit: number; p_user_id: string }
        Returns: {
          card_count: number
          created_at: string
          deck_type: Database["public"]["Enums"]["deck_type"]
          description: string
          id: string
          is_premade_fork: boolean
          name: string
          source_premade_id: string
          updated_at: string
          version: number
        }[]
      }
      list_premade_decks_paginated: {
        Args: {
          p_cursor?: string
          p_deck_type?: Database["public"]["Enums"]["deck_type"]
          p_domain?: string
          p_jlpt_level?: Database["public"]["Enums"]["jlpt_level"]
          p_limit: number
        }
        Returns: {
          card_count: number
          created_at: string
          deck_type: Database["public"]["Enums"]["deck_type"]
          description: string
          domain: string
          id: string
          is_active: boolean
          jlpt_level: Database["public"]["Enums"]["jlpt_level"]
          name: string
          updated_at: string
          version: number
        }[]
      }
      process_forget: {
        Args: {
          p_card_id: string
          p_difficulty: number
          p_difficulty_before: number
          p_due: string
          p_due_before: string
          p_elapsed_days_before: number
          p_lapses: number
          p_lapses_before: number
          p_last_review_before: string
          p_learning_steps_before: number
          p_reps: number
          p_reps_before: number
          p_scheduled_days: number
          p_scheduled_days_before: number
          p_stability: number
          p_stability_before: number
          p_state_before: number
          p_updated_at: string
          p_user_id: string
        }
        Returns: undefined
      }
      process_review: {
        Args: {
          p_card_id: string
          p_difficulty: number
          p_difficulty_after: number
          p_difficulty_before?: number
          p_due: string
          p_due_after: string
          p_due_before?: string
          p_elapsed_days: number
          p_elapsed_days_before?: number
          p_lapses: number
          p_lapses_before?: number
          p_last_review: string
          p_last_review_before?: string
          p_learning_steps: number
          p_learning_steps_before?: number
          p_leech_threshold: number
          p_rating: Database["public"]["Enums"]["review_rating"]
          p_reps: number
          p_reps_before?: number
          p_review_time_ms: number
          p_scheduled_days: number
          p_scheduled_days_after: number
          p_scheduled_days_before?: number
          p_session_id?: string
          p_stability: number
          p_stability_after: number
          p_stability_before?: number
          p_state: number
          p_state_before?: number
          p_updated_at: string
          p_user_id: string
        }
        Returns: undefined
      }
      process_review_batch: {
        Args: { p_leech_threshold: number; p_reviews: Json; p_user_id: string }
        Returns: {
          card_id: string
          difficulty: number
          due: string
          error_message: string
          scheduled_days: number
          stability: number
          state: number
          success: boolean
        }[]
      }
      record_leech_drill_attempt: {
        Args: {
          p_answered_at: string
          p_asserted_card_id: string
          p_asserted_leech_id: string
          p_event_id: string
          p_local_sequence: number
          p_response_time_ms: number
          p_result: string
          p_session_card_id: string
          p_session_id: string
          p_shown_at: string
          p_user_id: string
        }
        Returns: Json
      }
      store_idempotency_response: {
        Args: {
          p_body: Json
          p_key: string
          p_status: number
          p_user_id: string
        }
        Returns: undefined
      }
      copy_premade_deck: {
        Args: { p_premade_deck_id: string; p_user_id: string }
        Returns: {
          card_count: number
          deck_id: string
        }[]
      }
      transition_leech_drill_session: {
        Args: {
          p_session_id: string
          p_target_status: string
          p_user_id: string
        }
        Returns: undefined
      }
      update_card_with_sibling_sync: {
        Args: {
          p_card_id: string
          p_card_type?: Database["public"]["Enums"]["card_type"]
          p_expected_version: number
          p_fields_data?: Json
          p_jlpt_level?: Database["public"]["Enums"]["jlpt_level"]
          p_layout_type?: Database["public"]["Enums"]["layout_type"]
          p_tags?: string[]
          p_user_id: string
        }
        Returns: {
          card_type: Database["public"]["Enums"]["card_type"]
          created_at: string
          deck_id: string
          difficulty: number
          due: string
          elapsed_days: number
          fields_data: Json
          id: string
          is_suspended: boolean
          jlpt_level: Database["public"]["Enums"]["jlpt_level"]
          lapses: number
          last_review: string
          layout_type: Database["public"]["Enums"]["layout_type"]
          learning_steps: number
          parent_card_id: string
          premade_deck_id: string
          reps: number
          scheduled_days: number
          stability: number
          state: number
          tags: string[]
          updated_at: string
          user_id: string
          version: number
        }[]
      }
      update_deck_with_version_check: {
        Args: {
          p_deck_id: string
          p_expected_version: number
          p_patch: Json
          p_user_id: string
        }
        Returns: {
          card_count: number
          created_at: string
          deck_type: Database["public"]["Enums"]["deck_type"]
          description: string
          id: string
          is_premade_fork: boolean
          name: string
          source_premade_id: string
          updated_at: string
          version: number
        }[]
      }
      update_profile_with_interests: {
        Args: {
          p_expected_version: number
          p_interests?: string[]
          p_patch: Json
          p_user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      card_type: "comprehension" | "production" | "listening"
      deck_type: "vocabulary" | "kanji" | "mixed"
      jlpt_level: "N5" | "N4" | "N3" | "N2" | "N1" | "beyond_jlpt"
      layout_type: "vocabulary" | "grammar" | "sentence"
      review_rating: "again" | "hard" | "good" | "easy" | "manual"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      card_type: ["comprehension", "production", "listening"],
      deck_type: ["vocabulary", "kanji", "mixed"],
      jlpt_level: ["N5", "N4", "N3", "N2", "N1", "beyond_jlpt"],
      layout_type: ["vocabulary", "grammar", "sentence"],
      review_rating: ["again", "hard", "good", "easy", "manual"],
    },
  },
} as const
