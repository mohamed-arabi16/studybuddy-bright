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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_overrides: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          quota_overrides: Json | null
          trial_extension_days: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          quota_overrides?: Json | null
          trial_extension_days?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          quota_overrides?: Json | null
          trial_extension_days?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_jobs: {
        Row: {
          course_id: string | null
          created_at: string
          error_message: string | null
          id: string
          input_hash: string | null
          job_type: string
          questions_for_student: string[] | null
          result_json: Json | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input_hash?: string | null
          job_type: string
          questions_for_student?: string[] | null
          result_json?: Json | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input_hash?: string | null
          job_type?: string
          questions_for_student?: string[] | null
          result_json?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_jobs_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      allocations: {
        Row: {
          course_id: string
          created_at: string
          date: string
          id: string
          topics_json: string[] | null
        }
        Insert: {
          course_id: string
          created_at?: string
          date: string
          id?: string
          topics_json?: string[] | null
        }
        Update: {
          course_id?: string
          created_at?: string
          date?: string
          id?: string
          topics_json?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "allocations_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_files: {
        Row: {
          course_id: string
          created_at: string
          extracted_text: string | null
          extraction_status: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          mime_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          extracted_text?: string | null
          extraction_status?: string
          file_name: string
          file_path: string
          file_size: number
          id?: string
          mime_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          extracted_text?: string | null
          extraction_status?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_files_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          exam_date: string | null
          id: string
          status: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          exam_date?: string | null
          id?: string
          status?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          exam_date?: string | null
          id?: string
          status?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          admin_notes: string | null
          created_at: string
          email: string | null
          feedback_type: string
          id: string
          message: string
          rating: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          email?: string | null
          feedback_type?: string
          id?: string
          message: string
          rating?: number | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          email?: string | null
          feedback_type?: string
          id?: string
          message?: string
          rating?: number | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      google_calendar_connections: {
        Row: {
          access_token: string
          auto_sync: boolean | null
          calendar_id: string | null
          created_at: string
          encrypted_access_token: string | null
          encrypted_refresh_token: string | null
          encryption_version: number | null
          id: string
          is_active: boolean | null
          refresh_token: string
          token_expires_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          auto_sync?: boolean | null
          calendar_id?: string | null
          created_at?: string
          encrypted_access_token?: string | null
          encrypted_refresh_token?: string | null
          encryption_version?: number | null
          id?: string
          is_active?: boolean | null
          refresh_token: string
          token_expires_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          auto_sync?: boolean | null
          calendar_id?: string | null
          created_at?: string
          encrypted_access_token?: string | null
          encrypted_refresh_token?: string | null
          encryption_version?: number | null
          id?: string
          is_active?: boolean | null
          refresh_token?: string
          token_expires_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          created_at: string
          features: Json | null
          id: string
          is_active: boolean | null
          limits: Json | null
          name: string
          price_monthly: number | null
          price_yearly: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          features?: Json | null
          id?: string
          is_active?: boolean | null
          limits?: Json | null
          name: string
          price_monthly?: number | null
          price_yearly?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          features?: Json | null
          id?: string
          is_active?: boolean | null
          limits?: Json | null
          name?: string
          price_monthly?: number | null
          price_yearly?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      pomodoro_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          duration_minutes: number
          id: string
          session_type: string | null
          topic_id: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          session_type?: string | null
          topic_id?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          session_type?: string | null
          topic_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pomodoro_sessions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          daily_study_hours: number | null
          days_off: string[] | null
          department: string | null
          display_name: string | null
          email: string | null
          full_name: string | null
          id: string
          is_disabled: boolean | null
          language: string | null
          phone_number: string | null
          profile_completed: boolean | null
          study_days_per_week: number | null
          university: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          daily_study_hours?: number | null
          days_off?: string[] | null
          department?: string | null
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_disabled?: boolean | null
          language?: string | null
          phone_number?: string | null
          profile_completed?: boolean | null
          study_days_per_week?: number | null
          university?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          daily_study_hours?: number | null
          days_off?: string[] | null
          department?: string | null
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_disabled?: boolean | null
          language?: string | null
          phone_number?: string | null
          profile_completed?: boolean | null
          study_days_per_week?: number | null
          university?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      study_plan_days: {
        Row: {
          created_at: string
          date: string
          id: string
          is_day_off: boolean
          plan_version: number
          total_hours: number
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          is_day_off?: boolean
          plan_version?: number
          total_hours?: number
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          is_day_off?: boolean
          plan_version?: number
          total_hours?: number
          user_id?: string
        }
        Relationships: []
      }
      study_plan_items: {
        Row: {
          completed_at: string | null
          course_id: string
          created_at: string
          hours: number
          id: string
          is_completed: boolean
          is_review: boolean | null
          order_index: number
          plan_day_id: string
          topic_id: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          course_id: string
          created_at?: string
          hours: number
          id?: string
          is_completed?: boolean
          is_review?: boolean | null
          order_index?: number
          plan_day_id: string
          topic_id?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          course_id?: string
          created_at?: string
          hours?: number
          id?: string
          is_completed?: boolean
          is_review?: boolean | null
          order_index?: number
          plan_day_id?: string
          topic_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_plan_items_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_plan_items_plan_day_id_fkey"
            columns: ["plan_day_id"]
            isOneToOne: false
            referencedRelation: "study_plan_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_plan_items_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      study_sessions: {
        Row: {
          completed_tasks: string[]
          created_at: string
          id: string
          session_code: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          completed_tasks?: string[]
          created_at?: string
          id?: string
          session_code: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          completed_tasks?: string[]
          created_at?: string
          id?: string
          session_code?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          last_webhook_at: string | null
          plan_id: string | null
          status: string
          stripe_customer_id: string | null
          stripe_event_id: string | null
          stripe_subscription_id: string | null
          trial_end: string | null
          trial_start: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          last_webhook_at?: string | null
          plan_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_event_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          last_webhook_at?: string | null
          plan_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_event_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          completed_at: string | null
          confidence_level: string | null
          course_id: string
          created_at: string
          description: string | null
          difficulty_weight: number | null
          estimated_hours: number | null
          exam_importance: number | null
          id: string
          is_completed: boolean | null
          notes: string | null
          order_index: number | null
          prerequisite_ids: string[] | null
          source_context: string | null
          source_page: number | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          confidence_level?: string | null
          course_id: string
          created_at?: string
          description?: string | null
          difficulty_weight?: number | null
          estimated_hours?: number | null
          exam_importance?: number | null
          id?: string
          is_completed?: boolean | null
          notes?: string | null
          order_index?: number | null
          prerequisite_ids?: string[] | null
          source_context?: string | null
          source_page?: number | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          confidence_level?: string | null
          course_id?: string
          created_at?: string
          description?: string | null
          difficulty_weight?: number | null
          estimated_hours?: number | null
          exam_importance?: number | null
          id?: string
          is_completed?: boolean | null
          notes?: string | null
          order_index?: number | null
          prerequisite_ids?: string[] | null
          source_context?: string | null
          source_page?: number | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topics_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_analytics: {
        Row: {
          account_created_at: string | null
          account_deleted_at: string | null
          created_at: string | null
          department: string | null
          id: string
          plan_at_deletion: string | null
          total_ai_extractions: number | null
          total_courses: number | null
          total_pomodoro_sessions: number | null
          total_study_minutes: number | null
          total_topics: number | null
          university: string | null
          user_hash: string
        }
        Insert: {
          account_created_at?: string | null
          account_deleted_at?: string | null
          created_at?: string | null
          department?: string | null
          id?: string
          plan_at_deletion?: string | null
          total_ai_extractions?: number | null
          total_courses?: number | null
          total_pomodoro_sessions?: number | null
          total_study_minutes?: number | null
          total_topics?: number | null
          university?: string | null
          user_hash: string
        }
        Update: {
          account_created_at?: string | null
          account_deleted_at?: string | null
          created_at?: string | null
          department?: string | null
          id?: string
          plan_at_deletion?: string | null
          total_ai_extractions?: number | null
          total_courses?: number | null
          total_pomodoro_sessions?: number | null
          total_study_minutes?: number | null
          total_topics?: number | null
          university?: string | null
          user_hash?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
