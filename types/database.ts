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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admins: {
        Row: {
          access_level: string | null
          avatar_url: string | null
          bio: string | null
          city: string | null
          country: string | null
          department: string | null
          first_name: string | null
          id: string
          last_name: string | null
          notes: string | null
          on_call: boolean | null
          phone: string | null
          responsibilities: string[] | null
          schedule: string | null
          updated_at: string
          work_email: string | null
        }
        Insert: {
          access_level?: string | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          department?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          notes?: string | null
          on_call?: boolean | null
          phone?: string | null
          responsibilities?: string[] | null
          schedule?: string | null
          updated_at?: string
          work_email?: string | null
        }
        Update: {
          access_level?: string | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          department?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          notes?: string | null
          on_call?: boolean | null
          phone?: string | null
          responsibilities?: string[] | null
          schedule?: string | null
          updated_at?: string
          work_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admins_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_insights: {
        Row: {
          created_at: string
          id: string
          metrics: Json
          model: string | null
          payload: Json
          period_end: string
          period_kind: string
          period_start: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metrics?: Json
          model?: string | null
          payload?: Json
          period_end: string
          period_kind: string
          period_start: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metrics?: Json
          model?: string | null
          payload?: Json
          period_end?: string
          period_kind?: string
          period_start?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_insights_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_rate_limits: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          ip_hash: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          ip_hash?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          ip_hash?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_rate_limits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_passes: {
        Row: {
          athlete_id: string
          coach_id: string
          created_at: string
          currency: string
          expires_at: string
          id: string
          notes: string | null
          plan_id: string | null
          platform_fee_cents: number | null
          price_cents: number
          seller_role: string
          seller_specialty: string | null
          service_type: string
          starts_at: string
          status: string
          stripe_session_id: string | null
          title: string
          total_sessions: number
          updated_at: string
          used_sessions: number
        }
        Insert: {
          athlete_id: string
          coach_id: string
          created_at?: string
          currency?: string
          expires_at: string
          id?: string
          notes?: string | null
          plan_id?: string | null
          platform_fee_cents?: number | null
          price_cents?: number
          seller_role?: string
          seller_specialty?: string | null
          service_type?: string
          starts_at: string
          status?: string
          stripe_session_id?: string | null
          title: string
          total_sessions: number
          updated_at?: string
          used_sessions?: number
        }
        Update: {
          athlete_id?: string
          coach_id?: string
          created_at?: string
          currency?: string
          expires_at?: string
          id?: string
          notes?: string | null
          plan_id?: string | null
          platform_fee_cents?: number | null
          price_cents?: number
          seller_role?: string
          seller_specialty?: string | null
          service_type?: string
          starts_at?: string
          status?: string
          stripe_session_id?: string | null
          title?: string
          total_sessions?: number
          updated_at?: string
          used_sessions?: number
        }
        Relationships: [
          {
            foreignKeyName: "athlete_passes_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_passes_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_passes_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "coach_pass_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      athletes: {
        Row: {
          age: number | null
          avatar_url: string | null
          background_url: string | null
          bio: string | null
          birth_date: string | null
          city: string | null
          club: string | null
          country: string | null
          first_name: string | null
          fitness_level: string | null
          gender: string | null
          goal: string | null
          height_cm: number | null
          hrv_baseline: number | null
          id: string
          instagram_url: string | null
          lactate_threshold_hr: number | null
          language: string | null
          last_name: string | null
          max_heart_rate: number | null
          phone: string | null
          primary_sport: string | null
          profile_public: boolean | null
          rhr_baseline: number | null
          telegram_url: string | null
          threads_url: string | null
          tiktok_url: string | null
          timezone: string | null
          twitter_url: string | null
          updated_at: string | null
          vo2max: number | null
          website_url: string | null
          weekly_training_hours: number | null
          weight_kg: number | null
          workouts_public: boolean | null
          youtube_url: string | null
        }
        Insert: {
          age?: number | null
          avatar_url?: string | null
          background_url?: string | null
          bio?: string | null
          birth_date?: string | null
          city?: string | null
          club?: string | null
          country?: string | null
          first_name?: string | null
          fitness_level?: string | null
          gender?: string | null
          goal?: string | null
          height_cm?: number | null
          hrv_baseline?: number | null
          id: string
          instagram_url?: string | null
          lactate_threshold_hr?: number | null
          language?: string | null
          last_name?: string | null
          max_heart_rate?: number | null
          phone?: string | null
          primary_sport?: string | null
          profile_public?: boolean | null
          rhr_baseline?: number | null
          telegram_url?: string | null
          threads_url?: string | null
          tiktok_url?: string | null
          timezone?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          vo2max?: number | null
          website_url?: string | null
          weekly_training_hours?: number | null
          weight_kg?: number | null
          workouts_public?: boolean | null
          youtube_url?: string | null
        }
        Update: {
          age?: number | null
          avatar_url?: string | null
          background_url?: string | null
          bio?: string | null
          birth_date?: string | null
          city?: string | null
          club?: string | null
          country?: string | null
          first_name?: string | null
          fitness_level?: string | null
          gender?: string | null
          goal?: string | null
          height_cm?: number | null
          hrv_baseline?: number | null
          id?: string
          instagram_url?: string | null
          lactate_threshold_hr?: number | null
          language?: string | null
          last_name?: string | null
          max_heart_rate?: number | null
          phone?: string | null
          primary_sport?: string | null
          profile_public?: boolean | null
          rhr_baseline?: number | null
          telegram_url?: string | null
          threads_url?: string | null
          tiktok_url?: string | null
          timezone?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          vo2max?: number | null
          website_url?: string | null
          weekly_training_hours?: number | null
          weight_kg?: number | null
          workouts_public?: boolean | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athletes_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          new_value: Json | null
          old_value: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id: string | null
          created_at: string | null
          id: string
          ip_address: unknown
          payload: Json | null
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          created_at?: string | null
          id?: string
          ip_address?: unknown
          payload?: Json | null
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          created_at?: string | null
          id?: string
          ip_address?: unknown
          payload?: Json | null
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          all_day: boolean | null
          color: string | null
          created_at: string | null
          description: string | null
          end_date: string | null
          end_time: string | null
          event_date: string | null
          event_type: string
          id: string
          is_public: boolean | null
          notes: string | null
          owner_id: string
          start_date: string
          start_time: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          all_day?: boolean | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          event_date?: string | null
          event_type?: string
          id?: string
          is_public?: boolean | null
          notes?: string | null
          owner_id: string
          start_date: string
          start_time?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          all_day?: boolean | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          event_date?: string | null
          event_type?: string
          id?: string
          is_public?: boolean | null
          notes?: string | null
          owner_id?: string
          start_date?: string
          start_time?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_participants: {
        Row: {
          challenge_id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          joined_at?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_participants_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          activity_type: string | null
          created_at: string
          description: string | null
          ends_at: string
          id: string
          metric: string
          org_id: string | null
          owner_id: string
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          activity_type?: string | null
          created_at?: string
          description?: string | null
          ends_at: string
          id?: string
          metric: string
          org_id?: string | null
          owner_id: string
          starts_at: string
          title: string
          updated_at?: string
        }
        Update: {
          activity_type?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string
          id?: string
          metric?: string
          org_id?: string | null
          owner_id?: string
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenges_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenges_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_members: {
        Row: {
          chat_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          chat_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          chat_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_members_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chats: {
        Row: {
          athlete_id: string | null
          coach_id: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string | null
          org_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          athlete_id?: string | null
          coach_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string | null
          org_id?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          athlete_id?: string | null
          coach_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string | null
          org_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chats_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_orders: {
        Row: {
          athlete_id: string
          coach_id: string
          created_at: string
          currency: string
          fulfilled_at: string | null
          id: string
          paid_at: string | null
          platform_fee_amount: number | null
          price_amount: number
          seller_role: string
          seller_specialty: string | null
          service_id: string
          service_type: string
          status: string
          stripe_session_id: string | null
          updated_at: string
        }
        Insert: {
          athlete_id: string
          coach_id: string
          created_at?: string
          currency?: string
          fulfilled_at?: string | null
          id?: string
          paid_at?: string | null
          platform_fee_amount?: number | null
          price_amount: number
          seller_role?: string
          seller_specialty?: string | null
          service_id: string
          service_type?: string
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          coach_id?: string
          created_at?: string
          currency?: string
          fulfilled_at?: string | null
          id?: string
          paid_at?: string | null
          platform_fee_amount?: number | null
          price_amount?: number
          seller_role?: string
          seller_specialty?: string | null
          service_id?: string
          service_type?: string
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_orders_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_orders_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_orders_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "coach_services"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_pass_plans: {
        Row: {
          coach_id: string
          created_at: string
          currency: string
          description: string | null
          id: string
          is_active: boolean
          period_days: number
          price_cents: number
          seller_role: string
          seller_specialty: string | null
          service_type: string
          title: string
          total_sessions: number
        }
        Insert: {
          coach_id: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean
          period_days: number
          price_cents?: number
          seller_role?: string
          seller_specialty?: string | null
          service_type?: string
          title: string
          total_sessions: number
        }
        Update: {
          coach_id?: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean
          period_days?: number
          price_cents?: number
          seller_role?: string
          seller_specialty?: string | null
          service_type?: string
          title?: string
          total_sessions?: number
        }
        Relationships: [
          {
            foreignKeyName: "coach_pass_plans_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_services: {
        Row: {
          coach_id: string
          created_at: string
          currency: string
          description: string | null
          duration_days: number | null
          format: string | null
          id: string
          is_active: boolean
          price_amount: number
          seller_role: string
          seller_specialty: string | null
          service_type: string
          title: string
          updated_at: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          currency?: string
          description?: string | null
          duration_days?: number | null
          format?: string | null
          id?: string
          is_active?: boolean
          price_amount: number
          seller_role?: string
          seller_specialty?: string | null
          service_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          currency?: string
          description?: string | null
          duration_days?: number | null
          format?: string | null
          id?: string
          is_active?: boolean
          price_amount?: number
          seller_role?: string
          seller_specialty?: string | null
          service_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_services_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_sessions: {
        Row: {
          athlete_id: string
          coach_id: string
          created_at: string
          end_time: string | null
          id: string
          location: string | null
          notes: string | null
          pass_id: string | null
          session_date: string
          start_time: string | null
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          athlete_id: string
          coach_id: string
          created_at?: string
          end_time?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          pass_id?: string | null
          session_date: string
          start_time?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          coach_id?: string
          created_at?: string
          end_time?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          pass_id?: string | null
          session_date?: string
          start_time?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_sessions_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_sessions_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_sessions_pass_id_fkey"
            columns: ["pass_id"]
            isOneToOne: false
            referencedRelation: "athlete_passes"
            referencedColumns: ["id"]
          },
        ]
      }
      coaches: {
        Row: {
          accepts_new_athletes: boolean | null
          achievements: Json | null
          athletes_count: number | null
          avatar_url: string | null
          bio: string | null
          birth_date: string | null
          certifications: Json | null
          city: string | null
          coaching_philosophy: string | null
          country: string | null
          currency: string | null
          education: string | null
          email_public: string | null
          experience_years: number | null
          first_name: string | null
          gender: string | null
          hourly_rate: number | null
          id: string
          instagram_url: string | null
          languages: string[] | null
          last_name: string | null
          past_workplaces: Json | null
          phone: string | null
          profile_public: boolean | null
          search_doc: unknown
          session_formats: string[] | null
          specialization: string | null
          sports: string[] | null
          telegram_url: string | null
          updated_at: string
          website_url: string | null
          whatsapp_url: string | null
          workplace: string | null
          youtube_url: string | null
        }
        Insert: {
          accepts_new_athletes?: boolean | null
          achievements?: Json | null
          athletes_count?: number | null
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          certifications?: Json | null
          city?: string | null
          coaching_philosophy?: string | null
          country?: string | null
          currency?: string | null
          education?: string | null
          email_public?: string | null
          experience_years?: number | null
          first_name?: string | null
          gender?: string | null
          hourly_rate?: number | null
          id: string
          instagram_url?: string | null
          languages?: string[] | null
          last_name?: string | null
          past_workplaces?: Json | null
          phone?: string | null
          profile_public?: boolean | null
          search_doc?: unknown
          session_formats?: string[] | null
          specialization?: string | null
          sports?: string[] | null
          telegram_url?: string | null
          updated_at?: string
          website_url?: string | null
          whatsapp_url?: string | null
          workplace?: string | null
          youtube_url?: string | null
        }
        Update: {
          accepts_new_athletes?: boolean | null
          achievements?: Json | null
          athletes_count?: number | null
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          certifications?: Json | null
          city?: string | null
          coaching_philosophy?: string | null
          country?: string | null
          currency?: string | null
          education?: string | null
          email_public?: string | null
          experience_years?: number | null
          first_name?: string | null
          gender?: string | null
          hourly_rate?: number | null
          id?: string
          instagram_url?: string | null
          languages?: string[] | null
          last_name?: string | null
          past_workplaces?: Json | null
          phone?: string | null
          profile_public?: boolean | null
          search_doc?: unknown
          session_formats?: string[] | null
          specialization?: string | null
          sports?: string[] | null
          telegram_url?: string | null
          updated_at?: string
          website_url?: string | null
          whatsapp_url?: string | null
          workplace?: string | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coaches_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      competitions: {
        Row: {
          athlete_id: string
          competition_type: string | null
          created_at: string | null
          date: string
          distance: string | null
          goal: string | null
          id: string
          is_public: boolean | null
          location: string | null
          name: string
          notes: string | null
          personal_best: boolean | null
          position: number | null
          result: string | null
          status: Database["public"]["Enums"]["competition_status"] | null
          updated_at: string | null
        }
        Insert: {
          athlete_id: string
          competition_type?: string | null
          created_at?: string | null
          date: string
          distance?: string | null
          goal?: string | null
          id?: string
          is_public?: boolean | null
          location?: string | null
          name: string
          notes?: string | null
          personal_best?: boolean | null
          position?: number | null
          result?: string | null
          status?: Database["public"]["Enums"]["competition_status"] | null
          updated_at?: string | null
        }
        Update: {
          athlete_id?: string
          competition_type?: string | null
          created_at?: string | null
          date?: string
          distance?: string | null
          goal?: string | null
          id?: string
          is_public?: boolean | null
          location?: string | null
          name?: string
          notes?: string | null
          personal_best?: boolean | null
          position?: number | null
          result?: string | null
          status?: Database["public"]["Enums"]["competition_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competitions_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      connections: {
        Row: {
          connection_type: string
          id: string
          initiated_at: string
          initiator_id: string
          message: string | null
          recipient_id: string
          responded_at: string | null
          status: string
          terminated_at: string | null
          terminated_by: string | null
        }
        Insert: {
          connection_type: string
          id?: string
          initiated_at?: string
          initiator_id: string
          message?: string | null
          recipient_id: string
          responded_at?: string | null
          status?: string
          terminated_at?: string | null
          terminated_by?: string | null
        }
        Update: {
          connection_type?: string
          id?: string
          initiated_at?: string
          initiator_id?: string
          message?: string | null
          recipient_id?: string
          responded_at?: string | null
          status?: string
          terminated_at?: string | null
          terminated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "connections_initiator_id_fkey"
            columns: ["initiator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_terminated_by_fkey"
            columns: ["terminated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_notes: {
        Row: {
          about_user_id: string
          author_id: string
          body: string
          created_at: string
          id: string
        }
        Insert: {
          about_user_id: string
          author_id: string
          body: string
          created_at?: string
          id?: string
        }
        Update: {
          about_user_id?: string
          author_id?: string
          body?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_notes_about_user_id_fkey"
            columns: ["about_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      cycle_blocks: {
        Row: {
          athlete_id: string
          color: string | null
          created_at: string | null
          cycle_type: string
          description: string | null
          end_date: string
          goal: string | null
          id: string
          label: string | null
          start_date: string
          updated_at: string | null
        }
        Insert: {
          athlete_id: string
          color?: string | null
          created_at?: string | null
          cycle_type: string
          description?: string | null
          end_date: string
          goal?: string | null
          id?: string
          label?: string | null
          start_date: string
          updated_at?: string | null
        }
        Update: {
          athlete_id?: string
          color?: string | null
          created_at?: string | null
          cycle_type?: string
          description?: string | null
          end_date?: string
          goal?: string | null
          id?: string
          label?: string | null
          start_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cycle_blocks_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      cycle_days: {
        Row: {
          cycle_id: string
          day_date: string
          day_type: string
          id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          cycle_id: string
          day_date: string
          day_type: string
          id?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          cycle_id?: string
          day_date?: string
          day_type?: string
          id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cycle_days_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycle_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_days_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_metrics: {
        Row: {
          athlete_id: string
          calories_burned: number | null
          created_at: string | null
          date: string
          day_strain: number | null
          hrv: number | null
          id: string
          recovery_score: number | null
          respiratory_rate: number | null
          resting_heart_rate: number | null
          skin_temp_deviation: number | null
          sleep_efficiency: number | null
          sleep_hours: number | null
        }
        Insert: {
          athlete_id: string
          calories_burned?: number | null
          created_at?: string | null
          date: string
          day_strain?: number | null
          hrv?: number | null
          id?: string
          recovery_score?: number | null
          respiratory_rate?: number | null
          resting_heart_rate?: number | null
          skin_temp_deviation?: number | null
          sleep_efficiency?: number | null
          sleep_hours?: number | null
        }
        Update: {
          athlete_id?: string
          calories_burned?: number | null
          created_at?: string | null
          date?: string
          day_strain?: number | null
          hrv?: number | null
          id?: string
          recovery_score?: number | null
          respiratory_rate?: number | null
          resting_heart_rate?: number | null
          skin_temp_deviation?: number | null
          sleep_efficiency?: number | null
          sleep_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_metrics_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      diary_embeddings: {
        Row: {
          content_hash: string
          content_preview: string | null
          created_at: string
          embedding: string | null
          id: string
          source_id: string
          source_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content_hash: string
          content_preview?: string | null
          created_at?: string
          embedding?: string | null
          id?: string
          source_id: string
          source_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content_hash?: string
          content_preview?: string | null
          created_at?: string
          embedding?: string | null
          id?: string
          source_id?: string
          source_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diary_embeddings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      doctors: {
        Row: {
          accepts_new_patients: boolean | null
          avatar_url: string | null
          bio: string | null
          birth_date: string | null
          certifications: Json | null
          city: string | null
          consultation_fee: number | null
          consultation_formats: string[] | null
          country: string | null
          currency: string | null
          degree: string | null
          education: string | null
          emergency_contact: boolean | null
          experience_years: number | null
          first_name: string | null
          gender: string | null
          hospital_affiliations: string[] | null
          id: string
          languages: string[] | null
          last_name: string | null
          license_authority: string | null
          license_expires_at: string | null
          license_number: string | null
          main_focus: string | null
          medical_specialization: string | null
          phone: string | null
          profile_public: boolean | null
          scientific_publications: Json | null
          search_doc: unknown
          services: string[] | null
          telegram_url: string | null
          updated_at: string
          website_url: string | null
          whatsapp_url: string | null
          workplace: string | null
        }
        Insert: {
          accepts_new_patients?: boolean | null
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          certifications?: Json | null
          city?: string | null
          consultation_fee?: number | null
          consultation_formats?: string[] | null
          country?: string | null
          currency?: string | null
          degree?: string | null
          education?: string | null
          emergency_contact?: boolean | null
          experience_years?: number | null
          first_name?: string | null
          gender?: string | null
          hospital_affiliations?: string[] | null
          id: string
          languages?: string[] | null
          last_name?: string | null
          license_authority?: string | null
          license_expires_at?: string | null
          license_number?: string | null
          main_focus?: string | null
          medical_specialization?: string | null
          phone?: string | null
          profile_public?: boolean | null
          scientific_publications?: Json | null
          search_doc?: unknown
          services?: string[] | null
          telegram_url?: string | null
          updated_at?: string
          website_url?: string | null
          whatsapp_url?: string | null
          workplace?: string | null
        }
        Update: {
          accepts_new_patients?: boolean | null
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          certifications?: Json | null
          city?: string | null
          consultation_fee?: number | null
          consultation_formats?: string[] | null
          country?: string | null
          currency?: string | null
          degree?: string | null
          education?: string | null
          emergency_contact?: boolean | null
          experience_years?: number | null
          first_name?: string | null
          gender?: string | null
          hospital_affiliations?: string[] | null
          id?: string
          languages?: string[] | null
          last_name?: string | null
          license_authority?: string | null
          license_expires_at?: string | null
          license_number?: string | null
          main_focus?: string | null
          medical_specialization?: string | null
          phone?: string | null
          profile_public?: boolean | null
          scientific_publications?: Json | null
          search_doc?: unknown
          services?: string[] | null
          telegram_url?: string | null
          updated_at?: string
          website_url?: string | null
          whatsapp_url?: string | null
          workplace?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doctors_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      email_invites: {
        Row: {
          claimed_at: string | null
          claimed_by_user_id: string | null
          connection_type: string
          created_at: string
          email: string
          expires_at: string
          id: string
          inviter_id: string
          message: string | null
          status: string
          token: string
        }
        Insert: {
          claimed_at?: string | null
          claimed_by_user_id?: string | null
          connection_type: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          inviter_id: string
          message?: string | null
          status?: string
          token?: string
        }
        Update: {
          claimed_at?: string | null
          claimed_by_user_id?: string | null
          connection_type?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          inviter_id?: string
          message?: string | null
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_invites_claimed_by_user_id_fkey"
            columns: ["claimed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_invites_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      form_analyses: {
        Row: {
          ai_feedback: Json | null
          ai_summary: string | null
          athlete_id: string
          author_id: string
          coach_feedback: string | null
          created_at: string
          error_message: string | null
          exercise: string | null
          frames_count: number | null
          id: string
          sport: string | null
          status: string
          title: string
          updated_at: string
          video_path: string | null
          video_public_url: string | null
        }
        Insert: {
          ai_feedback?: Json | null
          ai_summary?: string | null
          athlete_id: string
          author_id: string
          coach_feedback?: string | null
          created_at?: string
          error_message?: string | null
          exercise?: string | null
          frames_count?: number | null
          id?: string
          sport?: string | null
          status?: string
          title: string
          updated_at?: string
          video_path?: string | null
          video_public_url?: string | null
        }
        Update: {
          ai_feedback?: Json | null
          ai_summary?: string | null
          athlete_id?: string
          author_id?: string
          coach_feedback?: string | null
          created_at?: string
          error_message?: string | null
          exercise?: string | null
          frames_count?: number | null
          id?: string
          sport?: string | null
          status?: string
          title?: string
          updated_at?: string
          video_path?: string | null
          video_public_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_analyses_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_analyses_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      injuries: {
        Row: {
          athlete_id: string
          body_part: string
          created_at: string
          description: string | null
          expected_recovery_days: number | null
          id: string
          mechanism: string
          onset_date: string
          recovered_at: string | null
          reported_by: string
          severity: string
          side: string
          status: string
          updated_at: string
        }
        Insert: {
          athlete_id: string
          body_part: string
          created_at?: string
          description?: string | null
          expected_recovery_days?: number | null
          id?: string
          mechanism?: string
          onset_date: string
          recovered_at?: string | null
          reported_by: string
          severity?: string
          side?: string
          status?: string
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          body_part?: string
          created_at?: string
          description?: string | null
          expected_recovery_days?: number | null
          id?: string
          mechanism?: string
          onset_date?: string
          recovered_at?: string | null
          reported_by?: string
          severity?: string
          side?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "injuries_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "injuries_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          created_at: string
          currency: string
          hosted_invoice_url: string | null
          id: string
          issued_at: string
          number: string | null
          payment_id: string | null
          pdf_url: string | null
          status: string
          stripe_invoice_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          hosted_invoice_url?: string | null
          id?: string
          issued_at?: string
          number?: string | null
          payment_id?: string | null
          pdf_url?: string | null
          status?: string
          stripe_invoice_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          hosted_invoice_url?: string | null
          id?: string
          issued_at?: string
          number?: string | null
          payment_id?: string | null
          pdf_url?: string | null
          status?: string
          stripe_invoice_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_checkups: {
        Row: {
          athlete_id: string
          checkup_date: string
          checkup_type: string
          created_at: string
          doctor_id: string
          end_time: string | null
          findings: string | null
          follow_up_date: string | null
          id: string
          location: string | null
          recommendations: string | null
          start_time: string | null
          status: string
          updated_at: string
        }
        Insert: {
          athlete_id: string
          checkup_date: string
          checkup_type?: string
          created_at?: string
          doctor_id: string
          end_time?: string | null
          findings?: string | null
          follow_up_date?: string | null
          id?: string
          location?: string | null
          recommendations?: string | null
          start_time?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          checkup_date?: string
          checkup_type?: string
          created_at?: string
          doctor_id?: string
          end_time?: string | null
          findings?: string | null
          follow_up_date?: string | null
          id?: string
          location?: string | null
          recommendations?: string | null
          start_time?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_checkups_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_checkups_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_diary: {
        Row: {
          athlete_id: string | null
          attachments: Json | null
          body_part: string | null
          calendar_event_id: string | null
          created_at: string
          date: string
          doctor_id: string
          entry_type: string
          id: string
          is_shared_with_athlete: boolean
          is_shared_with_coach: boolean
          lab_data: Json | null
          mood: number | null
          note: string
          pain_level: number | null
          prescription_data: Json | null
          rehab_data: Json | null
          schedule_data: Json | null
          severity: string | null
          tags: string[] | null
          title: string | null
          updated_at: string
          vitals: Json | null
        }
        Insert: {
          athlete_id?: string | null
          attachments?: Json | null
          body_part?: string | null
          calendar_event_id?: string | null
          created_at?: string
          date: string
          doctor_id: string
          entry_type?: string
          id?: string
          is_shared_with_athlete?: boolean
          is_shared_with_coach?: boolean
          lab_data?: Json | null
          mood?: number | null
          note: string
          pain_level?: number | null
          prescription_data?: Json | null
          rehab_data?: Json | null
          schedule_data?: Json | null
          severity?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
          vitals?: Json | null
        }
        Update: {
          athlete_id?: string | null
          attachments?: Json | null
          body_part?: string | null
          calendar_event_id?: string | null
          created_at?: string
          date?: string
          doctor_id?: string
          entry_type?: string
          id?: string
          is_shared_with_athlete?: boolean
          is_shared_with_coach?: boolean
          lab_data?: Json | null
          mood?: number | null
          note?: string
          pain_level?: number | null
          prescription_data?: Json | null
          rehab_data?: Json | null
          schedule_data?: Json | null
          severity?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
          vitals?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_diary_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_diary_calendar_event_id_fkey"
            columns: ["calendar_event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_diary_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          chat_id: string
          created_at: string
          id: string
          is_read: boolean
          sender_id: string
        }
        Insert: {
          body: string
          chat_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          sender_id: string
        }
        Update: {
          body?: string
          chat_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_deliveries: {
        Row: {
          email: string
          error_message: string | null
          id: string
          newsletter_id: string
          opened_at: string | null
          sent_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          email: string
          error_message?: string | null
          id?: string
          newsletter_id: string
          opened_at?: string | null
          sent_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          email?: string
          error_message?: string | null
          id?: string
          newsletter_id?: string
          opened_at?: string | null
          sent_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_deliveries_newsletter_id_fkey"
            columns: ["newsletter_id"]
            isOneToOne: false
            referencedRelation: "newsletters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_deliveries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletters: {
        Row: {
          author_id: string
          body_html: string
          body_text: string | null
          created_at: string
          deleted_at: string | null
          id: string
          org_id: string
          recipients_count: number | null
          scheduled_at: string | null
          sent_at: string | null
          status: string
          subject: string
          target_roles: string[] | null
          updated_at: string
        }
        Insert: {
          author_id: string
          body_html: string
          body_text?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          org_id: string
          recipients_count?: number | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          target_roles?: string[] | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          body_html?: string
          body_text?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          org_id?: string
          recipients_count?: number | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          target_roles?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletters_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletters_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          attachments: Json | null
          content: string
          created_at: string
          id: string
          is_deleted: boolean
          note_date: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attachments?: Json | null
          content?: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          note_date?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attachments?: Json | null
          content?: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          note_date?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          body: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          from_user_id: string | null
          id: string
          is_archived: boolean
          is_read: boolean
          link: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          from_user_id?: string | null
          id?: string
          is_archived?: boolean
          is_read?: boolean
          link?: string | null
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          from_user_id?: string | null
          id?: string
          is_archived?: boolean
          is_read?: boolean
          link?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      observation_diary: {
        Row: {
          athlete_id: string | null
          attachments: Json | null
          calendar_event_id: string | null
          category: string | null
          coach_id: string
          competition_data: Json | null
          created_at: string | null
          date: string
          energy_level: number | null
          entry_type: string
          id: string
          is_shared_with_athlete: boolean
          mood: number | null
          note: string
          risk_level: Database["public"]["Enums"]["risk_level"] | null
          schedule_data: Json | null
          session_data: Json | null
          tags: string[] | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          athlete_id?: string | null
          attachments?: Json | null
          calendar_event_id?: string | null
          category?: string | null
          coach_id: string
          competition_data?: Json | null
          created_at?: string | null
          date?: string
          energy_level?: number | null
          entry_type?: string
          id?: string
          is_shared_with_athlete?: boolean
          mood?: number | null
          note: string
          risk_level?: Database["public"]["Enums"]["risk_level"] | null
          schedule_data?: Json | null
          session_data?: Json | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          athlete_id?: string | null
          attachments?: Json | null
          calendar_event_id?: string | null
          category?: string | null
          coach_id?: string
          competition_data?: Json | null
          created_at?: string | null
          date?: string
          energy_level?: number | null
          entry_type?: string
          id?: string
          is_shared_with_athlete?: boolean
          mood?: number | null
          note?: string
          risk_level?: Database["public"]["Enums"]["risk_level"] | null
          schedule_data?: Json | null
          session_data?: Json | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "observation_diary_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observation_diary_calendar_event_id_fkey"
            columns: ["calendar_event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observation_diary_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      org_group_sessions: {
        Row: {
          created_at: string
          description: string | null
          end_time: string | null
          id: string
          location: string | null
          organization_id: string
          session_date: string
          session_type: string
          start_time: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_time?: string | null
          id?: string
          location?: string | null
          organization_id: string
          session_date: string
          session_type?: string
          start_time?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_time?: string | null
          id?: string
          location?: string | null
          organization_id?: string
          session_date?: string
          session_type?: string
          start_time?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_group_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          joined_at: string | null
          member_role: string
          org_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          member_role: string
          org_id: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          member_role?: string
          org_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      org_session_participants: {
        Row: {
          attendance_status: string
          session_id: string
          user_id: string
        }
        Insert: {
          attendance_status?: string
          session_id: string
          user_id: string
        }
        Update: {
          attendance_status?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_session_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "org_group_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_session_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          city: string | null
          coaches_count: number | null
          contact_person: string | null
          country: string | null
          created_at: string
          description: string | null
          email: string | null
          founded_year: number | null
          id: string
          instagram_url: string | null
          is_verified: boolean | null
          languages: string[] | null
          license_info: string | null
          logo_url: string | null
          members_count: number | null
          membership_types: Json | null
          org_name: string
          org_slug: string
          org_type: string | null
          phone: string | null
          profile_public: boolean | null
          search_doc: unknown
          services: string[] | null
          sport_type: string | null
          telegram_url: string | null
          training_base: string | null
          updated_at: string
          website_url: string | null
          youtube_url: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          coaches_count?: number | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          founded_year?: number | null
          id: string
          instagram_url?: string | null
          is_verified?: boolean | null
          languages?: string[] | null
          license_info?: string | null
          logo_url?: string | null
          members_count?: number | null
          membership_types?: Json | null
          org_name: string
          org_slug: string
          org_type?: string | null
          phone?: string | null
          profile_public?: boolean | null
          search_doc?: unknown
          services?: string[] | null
          sport_type?: string | null
          telegram_url?: string | null
          training_base?: string | null
          updated_at?: string
          website_url?: string | null
          youtube_url?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          coaches_count?: number | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          founded_year?: number | null
          id?: string
          instagram_url?: string | null
          is_verified?: boolean | null
          languages?: string[] | null
          license_info?: string | null
          logo_url?: string | null
          members_count?: number | null
          membership_types?: Json | null
          org_name?: string
          org_slug?: string
          org_type?: string | null
          phone?: string | null
          profile_public?: boolean | null
          search_doc?: unknown
          services?: string[] | null
          sport_type?: string | null
          telegram_url?: string | null
          training_base?: string | null
          updated_at?: string
          website_url?: string | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          provider: string
          provider_event_id: string
          provider_payment_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload: Json
          processed_at?: string | null
          provider: string
          provider_event_id: string
          provider_payment_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
          provider_event_id?: string
          provider_payment_id?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          order_id: string | null
          raw: Json | null
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          order_id?: string | null
          raw?: Json | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          order_id?: string | null
          raw?: Json | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "coach_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_records: {
        Row: {
          achieved_at: string
          athlete_id: string
          category: string
          created_at: string
          exercise: string
          id: string
          lower_is_better: boolean
          metric: string
          notes: string | null
          unit: string
          updated_at: string
          value: number
          workout_id: string | null
        }
        Insert: {
          achieved_at: string
          athlete_id: string
          category: string
          created_at?: string
          exercise: string
          id?: string
          lower_is_better?: boolean
          metric: string
          notes?: string | null
          unit: string
          updated_at?: string
          value: number
          workout_id?: string | null
        }
        Update: {
          achieved_at?: string
          athlete_id?: string
          category?: string
          created_at?: string
          exercise?: string
          id?: string
          lower_is_better?: boolean
          metric?: string
          notes?: string | null
          unit?: string
          updated_at?: string
          value?: number
          workout_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "personal_records_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_records_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_settings: {
        Row: {
          athlete_id: string
          id: string
          resource_type: string
          updated_at: string | null
          visibility: string
        }
        Insert: {
          athlete_id: string
          id?: string
          resource_type: string
          updated_at?: string | null
          visibility?: string
        }
        Update: {
          athlete_id?: string
          id?: string
          resource_type?: string
          updated_at?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "privacy_settings_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_credits: {
        Row: {
          applied_at: string
          id: string
          invited_user_id: string | null
          inviter_id: string
          months_granted: number
          source_invite_id: string | null
        }
        Insert: {
          applied_at?: string
          id?: string
          invited_user_id?: string | null
          inviter_id: string
          months_granted?: number
          source_invite_id?: string | null
        }
        Update: {
          applied_at?: string
          id?: string
          invited_user_id?: string | null
          inviter_id?: string
          months_granted?: number
          source_invite_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_credits_invited_user_id_fkey"
            columns: ["invited_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_credits_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_credits_source_invite_id_fkey"
            columns: ["source_invite_id"]
            isOneToOne: true
            referencedRelation: "email_invites"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_views: {
        Row: {
          created_at: string | null
          filters: Json | null
          id: string
          name: string
          user_id: string
          view_type: string | null
        }
        Insert: {
          created_at?: string | null
          filters?: Json | null
          id?: string
          name: string
          user_id: string
          view_type?: string | null
        }
        Update: {
          created_at?: string | null
          filters?: Json | null
          id?: string
          name?: string
          user_id?: string
          view_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          expires_at: string | null
          id: string
          plan: string
          price_usd: number | null
          provider: string
          started_at: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tariff_code: string | null
          trial_ends_at: string | null
          updated_at: string
          user_id: string
          yookassa_payment_method_id: string | null
        }
        Insert: {
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          expires_at?: string | null
          id?: string
          plan?: string
          price_usd?: number | null
          provider?: string
          started_at?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tariff_code?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
          yookassa_payment_method_id?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          expires_at?: string | null
          id?: string
          plan?: string
          price_usd?: number | null
          provider?: string
          started_at?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tariff_code?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
          yookassa_payment_method_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tariffs: {
        Row: {
          billing_period: string
          code: string
          created_at: string
          currency: string
          description: string | null
          display_order: number
          features: Json
          id: string
          is_active: boolean
          max_athletes: number | null
          max_coaches: number | null
          max_teams: number | null
          name: string
          price_cents: number
          target_role: string
          trial_days: number
          updated_at: string
        }
        Insert: {
          billing_period: string
          code: string
          created_at?: string
          currency?: string
          description?: string | null
          display_order?: number
          features?: Json
          id?: string
          is_active?: boolean
          max_athletes?: number | null
          max_coaches?: number | null
          max_teams?: number | null
          name: string
          price_cents: number
          target_role: string
          trial_days?: number
          updated_at?: string
        }
        Update: {
          billing_period?: string
          code?: string
          created_at?: string
          currency?: string
          description?: string | null
          display_order?: number
          features?: Json
          id?: string
          is_active?: boolean
          max_athletes?: number | null
          max_coaches?: number | null
          max_teams?: number | null
          name?: string
          price_cents?: number
          target_role?: string
          trial_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      tool_leads: {
        Row: {
          created_at: string
          email: string
          id: string
          ip_hash: string | null
          payload: Json | null
          source: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip_hash?: string | null
          payload?: Json | null
          source: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip_hash?: string | null
          payload?: Json | null
          source?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      trainer_athletes: {
        Row: {
          assigned_by: string | null
          athlete_id: string
          created_at: string | null
          notes: string | null
          status: string | null
          trainer_id: string
          updated_at: string | null
        }
        Insert: {
          assigned_by?: string | null
          athlete_id: string
          created_at?: string | null
          notes?: string | null
          status?: string | null
          trainer_id: string
          updated_at?: string | null
        }
        Update: {
          assigned_by?: string | null
          athlete_id?: string
          created_at?: string | null
          notes?: string | null
          status?: string | null
          trainer_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trainer_athletes_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_athletes_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_athletes_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      training_marks: {
        Row: {
          coach_id: string
          color: string | null
          created_at: string | null
          id: string
          label: string
          note: string | null
          workout_id: string
        }
        Insert: {
          coach_id: string
          color?: string | null
          created_at?: string | null
          id?: string
          label: string
          note?: string | null
          workout_id: string
        }
        Update: {
          coach_id?: string
          color?: string | null
          created_at?: string | null
          id?: string
          label?: string
          note?: string | null
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_marks_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_marks_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_device_connections: {
        Row: {
          access_token: string | null
          created_at: string
          id: string
          is_primary: boolean
          last_sync_at: string | null
          last_sync_error: string | null
          metadata: Json | null
          provider: string
          provider_user_id: string | null
          refresh_token: string | null
          scope: string | null
          status: string
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          last_sync_at?: string | null
          last_sync_error?: string | null
          metadata?: Json | null
          provider: string
          provider_user_id?: string | null
          refresh_token?: string | null
          scope?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          last_sync_at?: string | null
          last_sync_error?: string | null
          metadata?: Json | null
          provider?: string
          provider_user_id?: string | null
          refresh_token?: string | null
          scope?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_device_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_id: string | null
          avatar_url: string | null
          bio: string | null
          birth_date: string | null
          city: string | null
          coach_specialization: string | null
          country: string | null
          created_at: string | null
          discipline: string | null
          email: string
          experience_years: number | null
          gender: string | null
          id: string
          is_searchable: boolean
          language: string | null
          name: string
          nickname: string | null
          nickname_changed_at: string | null
          role: string
          search_doc: unknown
          sport: string | null
        }
        Insert: {
          auth_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          city?: string | null
          coach_specialization?: string | null
          country?: string | null
          created_at?: string | null
          discipline?: string | null
          email: string
          experience_years?: number | null
          gender?: string | null
          id?: string
          is_searchable?: boolean
          language?: string | null
          name: string
          nickname?: string | null
          nickname_changed_at?: string | null
          role: string
          search_doc?: unknown
          sport?: string | null
        }
        Update: {
          auth_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          city?: string | null
          coach_specialization?: string | null
          country?: string | null
          created_at?: string | null
          discipline?: string | null
          email?: string
          experience_years?: number | null
          gender?: string | null
          id?: string
          is_searchable?: boolean
          language?: string | null
          name?: string
          nickname?: string | null
          nickname_changed_at?: string | null
          role?: string
          search_doc?: unknown
          sport?: string | null
        }
        Relationships: []
      }
      wall_posts: {
        Row: {
          author_id: string
          body: string
          cover_image_url: string | null
          created_at: string
          deleted_at: string | null
          event_date: string | null
          event_location: string | null
          id: string
          is_pinned: boolean | null
          org_id: string
          pin_order: number | null
          post_type: string
          title: string
          updated_at: string
          visible_to: string[] | null
        }
        Insert: {
          author_id: string
          body: string
          cover_image_url?: string | null
          created_at?: string
          deleted_at?: string | null
          event_date?: string | null
          event_location?: string | null
          id?: string
          is_pinned?: boolean | null
          org_id: string
          pin_order?: number | null
          post_type?: string
          title: string
          updated_at?: string
          visible_to?: string[] | null
        }
        Update: {
          author_id?: string
          body?: string
          cover_image_url?: string | null
          created_at?: string
          deleted_at?: string | null
          event_date?: string | null
          event_location?: string | null
          id?: string
          is_pinned?: boolean | null
          org_id?: string
          pin_order?: number | null
          post_type?: string
          title?: string
          updated_at?: string
          visible_to?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "wall_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wall_posts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      wellness_checkins: {
        Row: {
          athlete_id: string
          created_at: string
          date: string
          energy: number | null
          id: string
          mood: number | null
          notes: string | null
          sleep_hours: number | null
          sleep_quality: number | null
          soreness: number | null
          updated_at: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          date: string
          energy?: number | null
          id?: string
          mood?: number | null
          notes?: string | null
          sleep_hours?: number | null
          sleep_quality?: number | null
          soreness?: number | null
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          date?: string
          energy?: number | null
          id?: string
          mood?: number | null
          notes?: string | null
          sleep_hours?: number | null
          sleep_quality?: number | null
          soreness?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wellness_checkins_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string | null
          id: string
          workout_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string | null
          id?: string
          workout_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string | null
          id?: string
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_comments_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_shares: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          revoked_at: string | null
          token: string
          workout_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          revoked_at?: string | null
          token: string
          workout_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          revoked_at?: string | null
          token?: string
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_shares_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_shares_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_templates: {
        Row: {
          activity_type: string | null
          created_at: string
          description: string | null
          duration_min: number | null
          id: string
          is_public: boolean
          name: string
          segments: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_type?: string | null
          created_at?: string
          description?: string | null
          duration_min?: number | null
          id?: string
          is_public?: boolean
          name: string
          segments?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_type?: string | null
          created_at?: string
          description?: string | null
          duration_min?: number | null
          id?: string
          is_public?: boolean
          name?: string
          segments?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_templates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      workouts: {
        Row: {
          activity_calories: number | null
          activity_duration_min: number | null
          activity_strain: number | null
          activity_type: string | null
          athlete_id: string
          avg_heart_rate: number | null
          coach_mark: string | null
          coach_marked_at: string | null
          coach_marked_by: string | null
          completion_status: string | null
          created_at: string | null
          cycle_type: string | null
          description: string | null
          event_date: string
          event_type: string
          hr_zone_1_min: number | null
          hr_zone_2_min: number | null
          hr_zone_3_min: number | null
          hr_zone_4_min: number | null
          hr_zone_5_min: number | null
          hrv: number | null
          id: string
          is_public: boolean | null
          marks: string[] | null
          max_heart_rate: number | null
          mood: number | null
          name: string | null
          prescribed_at: string | null
          prescribed_by: string | null
          prescribed_note: string | null
          recovery_score: number | null
          risk_flag: Database["public"]["Enums"]["risk_level"] | null
          start_time: string | null
          trainer_comment: string | null
          updated_at: string | null
          workout_time_of_day: string | null
        }
        Insert: {
          activity_calories?: number | null
          activity_duration_min?: number | null
          activity_strain?: number | null
          activity_type?: string | null
          athlete_id: string
          avg_heart_rate?: number | null
          coach_mark?: string | null
          coach_marked_at?: string | null
          coach_marked_by?: string | null
          completion_status?: string | null
          created_at?: string | null
          cycle_type?: string | null
          description?: string | null
          event_date: string
          event_type: string
          hr_zone_1_min?: number | null
          hr_zone_2_min?: number | null
          hr_zone_3_min?: number | null
          hr_zone_4_min?: number | null
          hr_zone_5_min?: number | null
          hrv?: number | null
          id?: string
          is_public?: boolean | null
          marks?: string[] | null
          max_heart_rate?: number | null
          mood?: number | null
          name?: string | null
          prescribed_at?: string | null
          prescribed_by?: string | null
          prescribed_note?: string | null
          recovery_score?: number | null
          risk_flag?: Database["public"]["Enums"]["risk_level"] | null
          start_time?: string | null
          trainer_comment?: string | null
          updated_at?: string | null
          workout_time_of_day?: string | null
        }
        Update: {
          activity_calories?: number | null
          activity_duration_min?: number | null
          activity_strain?: number | null
          activity_type?: string | null
          athlete_id?: string
          avg_heart_rate?: number | null
          coach_mark?: string | null
          coach_marked_at?: string | null
          coach_marked_by?: string | null
          completion_status?: string | null
          created_at?: string | null
          cycle_type?: string | null
          description?: string | null
          event_date?: string
          event_type?: string
          hr_zone_1_min?: number | null
          hr_zone_2_min?: number | null
          hr_zone_3_min?: number | null
          hr_zone_4_min?: number | null
          hr_zone_5_min?: number | null
          hrv?: number | null
          id?: string
          is_public?: boolean | null
          marks?: string[] | null
          max_heart_rate?: number | null
          mood?: number | null
          name?: string | null
          prescribed_at?: string | null
          prescribed_by?: string | null
          prescribed_note?: string | null
          recovery_score?: number | null
          risk_flag?: Database["public"]["Enums"]["risk_level"] | null
          start_time?: string | null
          trainer_comment?: string | null
          updated_at?: string | null
          workout_time_of_day?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workouts_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workouts_coach_marked_by_fkey"
            columns: ["coach_marked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workouts_prescribed_by_fkey"
            columns: ["prescribed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_and_increment_ai_ip_rate_limit: {
        Args: {
          p_ip_hash: string
          p_max_per_window: number
          p_window_seconds: number
        }
        Returns: boolean
      }
      check_and_increment_ai_rate_limit:
        | {
            Args: {
              p_endpoint: string
              p_max_per_window: number
              p_window_seconds: number
            }
            Returns: boolean
          }
        | {
            Args: {
              p_endpoint: string
              p_ip_hash?: string
              p_ip_max?: number
              p_ip_window_secs?: number
              p_max_per_window: number
              p_window_seconds: number
            }
            Returns: boolean
          }
      cleanup_ai_rate_limits: { Args: never; Returns: undefined }
      get_challenge_leaderboard: {
        Args: { p_challenge_id: string }
        Returns: {
          score: number
          total_min: number
          total_strain: number
          user_avatar: string
          user_id: string
          user_name: string
          user_nickname: string
          workouts_count: number
        }[]
      }
      get_my_role: { Args: never; Returns: string }
      get_my_user_id: { Args: never; Returns: string }
      get_shared_workout: {
        Args: { p_token: string }
        Returns: {
          activity_duration_min: number
          activity_strain: number
          activity_type: string
          athlete_avatar: string
          athlete_id: string
          athlete_name: string
          athlete_sport: string
          avg_heart_rate: number
          description: string
          event_date: string
          expires_at: string
          hrv: number
          max_heart_rate: number
          mood: number
          name: string
          recovery_score: number
          workout_id: string
        }[]
      }
      grant_referral_credit: {
        Args: {
          p_invited_user_id: string
          p_inviter_id: string
          p_months?: number
          p_source_invite_id: string
        }
        Returns: string
      }
      match_diary: {
        Args: { p_embedding: string; p_limit?: number }
        Returns: {
          content_preview: string
          similarity: number
          source_id: string
          source_type: string
        }[]
      }
    }
    Enums: {
      audit_action:
        | "create"
        | "update"
        | "delete"
        | "login"
        | "logout"
        | "role_change"
        | "privacy_change"
        | "assign_athlete"
      calendar_view: "day" | "week" | "month" | "quarter" | "year"
      competition_status:
        | "planned"
        | "registered"
        | "completed"
        | "cancelled"
        | "dns"
        | "dnf"
      risk_level: "low" | "moderate" | "high" | "critical"
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
      audit_action: [
        "create",
        "update",
        "delete",
        "login",
        "logout",
        "role_change",
        "privacy_change",
        "assign_athlete",
      ],
      calendar_view: ["day", "week", "month", "quarter", "year"],
      competition_status: [
        "planned",
        "registered",
        "completed",
        "cancelled",
        "dns",
        "dnf",
      ],
      risk_level: ["low", "moderate", "high", "critical"],
    },
  },
} as const

