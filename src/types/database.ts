export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string | null
          role: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          role?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          role?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      plans: {
        Row: {
          id: string
          name: string
          price: number | null
          limits_json: Json
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          price?: number | null
          limits_json?: Json
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          price?: number | null
          limits_json?: Json
          created_at?: string
        }
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          plan_id: string | null
          status: string
          stripe_customer_id: string | null
          current_period_end: string | null
          trial_end: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          plan_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          current_period_end?: string | null
          trial_end?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          plan_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          current_period_end?: string | null
          trial_end?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      usage_counters: {
        Row: {
          id: string
          user_id: string
          period_start: string
          ai_runs: number | null
          uploads: number | null
          courses_created: number | null
          topics_created: number | null
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          period_start?: string
          ai_runs?: number | null
          uploads?: number | null
          courses_created?: number | null
          topics_created?: number | null
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          period_start?: string
          ai_runs?: number | null
          uploads?: number | null
          courses_created?: number | null
          topics_created?: number | null
          updated_at?: string
        }
      }
      admin_overrides: {
        Row: {
          user_id: string
          limits_json: Json | null
          trial_override: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          limits_json?: Json | null
          trial_override?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          limits_json?: Json | null
          trial_override?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
