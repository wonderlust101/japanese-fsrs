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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
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
      decks: {
        Row: {
          card_count: number
          created_at: string
          deck_type: Database["public"]["Enums"]["deck_type"]
          description: string | null
          id: string
          is_premade_fork: boolean
          is_public: boolean
          name: string
          source_premade_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          card_count?: number
          created_at?: string
          deck_type?: Database["public"]["Enums"]["deck_type"]
          description?: string | null
          id?: string
          is_premade_fork?: boolean
          is_public?: boolean
          name: string
          source_premade_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          card_count?: number
          created_at?: string
          deck_type?: Database["public"]["Enums"]["deck_type"]
          description?: string | null
          id?: string
          is_premade_fork?: boolean
          is_public?: boolean
          name?: string
          source_premade_id?: string | null
          updated_at?: string
          user_id?: string
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
      grammar_patterns: {
        Row: {
          created_at: string
          deck_id: string
          difficulty: number
          due: string
          elapsed_days: number
          example_sentences: Json
          id: string
          is_suspended: boolean
          jlpt_level: Database["public"]["Enums"]["jlpt_level"] | null
          lapses: number
          last_review: string | null
          learning_steps: number
          meaning: string
          notes: string | null
          pattern: string
          reps: number
          scheduled_days: number
          stability: number
          state: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deck_id: string
          difficulty?: number
          due?: string
          elapsed_days?: number
          example_sentences?: Json
          id?: string
          is_suspended?: boolean
          jlpt_level?: Database["public"]["Enums"]["jlpt_level"] | null
          lapses?: number
          last_review?: string | null
          learning_steps?: number
          meaning: string
          notes?: string | null
          pattern: string
          reps?: number
          scheduled_days?: number
          stability?: number
          state?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deck_id?: string
          difficulty?: number
          due?: string
          elapsed_days?: number
          example_sentences?: Json
          id?: string
          is_suspended?: boolean
          jlpt_level?: Database["public"]["Enums"]["jlpt_level"] | null
          lapses?: number
          last_review?: string | null
          learning_steps?: number
          meaning?: string
          notes?: string | null
          pattern?: string
          reps?: number
          scheduled_days?: number
          stability?: number
          state?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grammar_patterns_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grammar_patterns_user_id_fkey"
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
          version: number
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
          version?: number
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
          version?: number
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
      user_premade_subscriptions: {
        Row: {
          id: string
          last_seen_version: number
          premade_deck_id: string
          subscribed_at: string
          user_id: string
        }
        Insert: {
          id?: string
          last_seen_version?: number
          premade_deck_id: string
          subscribed_at?: string
          user_id: string
        }
        Update: {
          id?: string
          last_seen_version?: number
          premade_deck_id?: string
          subscribed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_premade_subscriptions_premade_deck_id_fkey"
            columns: ["premade_deck_id"]
            isOneToOne: false
            referencedRelation: "premade_decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_premade_subscriptions_user_id_fkey"
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
      get_dashboard_data: { Args: { p_user_id: string }; Returns: Json }
      get_due_cards: {
        Args: {
          p_daily_new_cards_limit: number
          p_daily_review_limit: number
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
        Args: { p_user_id: string }
        Returns: {
          count: number
          date: string
          retention: number
        }[]
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
      get_review_forecast: {
        Args: { p_days?: number; p_user_id: string }
        Returns: {
          count: number
          date: string
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
      get_streak: {
        Args: { p_user_id: string }
        Returns: {
          current_streak: number
          last_review_date: string
          longest_streak: number
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
      subscribe_to_premade_deck: {
        Args: { p_premade_deck_id: string; p_user_id: string }
        Returns: {
          already_existed: boolean
          card_count: number
          deck_id: string
          subscription_id: string
        }[]
      }
      unsubscribe_from_premade_deck: {
        Args: { p_premade_deck_id: string; p_user_id: string }
        Returns: undefined
      }
      update_card_with_sibling_sync: {
        Args: {
          p_card_id: string
          p_card_type?: Database["public"]["Enums"]["card_type"]
          p_fields_data?: Json
          p_jlpt_level?: Database["public"]["Enums"]["jlpt_level"]
          p_layout_type?: Database["public"]["Enums"]["layout_type"]
          p_tags?: string[]
          p_user_id: string
        }
        Returns: undefined
      }
      update_profile_with_interests: {
        Args: { p_interests?: string[]; p_patch: Json; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      card_type: "comprehension" | "production" | "listening"
      deck_type: "vocabulary" | "grammar" | "kanji" | "mixed"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      card_type: ["comprehension", "production", "listening"],
      deck_type: ["vocabulary", "grammar", "kanji", "mixed"],
      jlpt_level: ["N5", "N4", "N3", "N2", "N1", "beyond_jlpt"],
      layout_type: ["vocabulary", "grammar", "sentence"],
      review_rating: ["again", "hard", "good", "easy", "manual"],
    },
  },
} as const
