export type UserRole = 'athlete' | 'coach' | 'admin' | 'organization'

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          auth_id: string | null
          email: string
          name: string
          role: UserRole
          created_at: string
        }
        Insert: {
          id?: string
          auth_id?: string | null
          email: string
          name: string
          role: UserRole
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['users']['Insert']>
      }
      athletes: {
        Row: {
          id: string
          age: number | null
          gender: string | null
          weight_kg: number | null
          height_cm: number | null
          fitness_level: string | null
          primary_sport: string | null
          goal: string | null
          hrv_baseline: number | null
          rhr_baseline: number | null
          profile_public: boolean
          workouts_public: boolean
          updated_at: string | null
        }
        Insert: Partial<Database['public']['Tables']['athletes']['Row']> & { id: string }
        Update: Partial<Database['public']['Tables']['athletes']['Row']>
      }
      workouts: {
        Row: {
          id: string
          athlete_id: string
          event_date: string
          event_type: string
          activity_type: string | null
          workout_time_of_day: string | null
          start_time: string | null
          activity_duration_min: number | null
          activity_strain: number | null
          avg_heart_rate: number | null
          max_heart_rate: number | null
          activity_calories: number | null
          hr_zone_1_min: number | null
          hr_zone_2_min: number | null
          hr_zone_3_min: number | null
          hr_zone_4_min: number | null
          hr_zone_5_min: number | null
          recovery_score: number | null
          hrv: number | null
          name: string | null
          description: string | null
          mood: number | null
          is_public: boolean
          cycle_type: string
          trainer_comment: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['workouts']['Row'], 'id' | 'created_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['workouts']['Row']>
      }
      daily_metrics: {
        Row: {
          id: string
          athlete_id: string
          date: string
          recovery_score: number | null
          hrv: number | null
          resting_heart_rate: number | null
          sleep_hours: number | null
          sleep_efficiency: number | null
          day_strain: number | null
          calories_burned: number | null
          respiratory_rate: number | null
          skin_temp_deviation: number | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['daily_metrics']['Row'], 'id' | 'created_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['daily_metrics']['Row']>
      }
      competitions: {
        Row: {
          id: string
          athlete_id: string
          date: string
          name: string
          distance: string | null
          result: string | null
          notes: string | null
          is_public: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['competitions']['Row'], 'id' | 'created_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['competitions']['Row']>
      }
      workout_comments: {
        Row: { id: string; workout_id: string; author_id: string; body: string; created_at: string }
        Insert: Omit<Database['public']['Tables']['workout_comments']['Row'], 'id' | 'created_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['workout_comments']['Row']>
      }
      observation_diary: {
        Row: { id: string; coach_id: string; athlete_id: string | null; date: string; note: string; tags: string[]; created_at: string }
        Insert: Omit<Database['public']['Tables']['observation_diary']['Row'], 'id' | 'created_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['observation_diary']['Row']>
      }
      cycle_blocks: {
        Row: { id: string; athlete_id: string; start_date: string; end_date: string; cycle_type: 'micro' | 'meso' | 'macro'; label: string | null; color: string; created_at: string }
        Insert: Omit<Database['public']['Tables']['cycle_blocks']['Row'], 'id' | 'created_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['cycle_blocks']['Row']>
      }
      trainer_athletes: {
        Row: { trainer_id: string; athlete_id: string; created_at: string }
        Insert: { trainer_id: string; athlete_id: string }
        Update: never
      }
      calendar_events: {
        Row: {
          id: string
          owner_id: string
          event_date: string
          event_type: 'workout' | 'competition' | 'rest' | 'note' | 'travel' | 'medical' | 'test' | 'camp' | 'other'
          title: string
          notes: string | null
          start_time: string | null
          end_time: string | null
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          event_date: string
          event_type: 'workout' | 'competition' | 'rest' | 'note' | 'travel' | 'medical' | 'test' | 'camp' | 'other'
          title: string
          notes?: string | null
          start_time?: string | null
          end_time?: string | null
        }
        Update: {
          event_date?: string
          event_type?: 'workout' | 'competition' | 'rest' | 'note' | 'travel' | 'medical' | 'test' | 'camp' | 'other'
          title?: string
          notes?: string | null
          start_time?: string | null
          end_time?: string | null
        }
      }
      organizations: {
        Row: {
          id: string
          user_id: string
          org_name: string
          org_slug: string
          sport_type: string | null
          city: string | null
          is_verified: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['organizations']['Row'], 'id' | 'created_at' | 'is_verified'> & { id?: string; is_verified?: boolean }
        Update: Partial<Database['public']['Tables']['organizations']['Row']>
      }
      org_members: {
        Row: {
          id: string
          org_id: string
          user_id: string
          role: 'athlete' | 'coach'
          status: 'active' | 'pending' | 'suspended'
          joined_at: string
        }
        Insert: Omit<Database['public']['Tables']['org_members']['Row'], 'id' | 'joined_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['org_members']['Row']>
      }
      wall_posts: {
        Row: {
          id: string
          org_id: string
          author_id: string
          title: string
          body: string
          post_type: 'announcement' | 'event' | 'news' | 'result'
          event_date: string | null
          visible_to: 'all' | 'members' | 'coaches'
          is_pinned: boolean
          is_deleted: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['wall_posts']['Row'], 'id' | 'created_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['wall_posts']['Row']>
      }
      newsletters: {
        Row: {
          id: string
          org_id: string
          author_id: string
          subject: string
          body: string
          target_roles: ('athlete' | 'coach')[]
          status: 'draft' | 'sent' | 'scheduled'
          scheduled_at: string | null
          sent_at: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['newsletters']['Row'], 'id' | 'created_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['newsletters']['Row']>
      }
      newsletter_deliveries: {
        Row: {
          id: string
          newsletter_id: string
          recipient_id: string
          status: 'pending' | 'delivered' | 'failed'
          delivered_at: string | null
          opened_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['newsletter_deliveries']['Row'], 'id'> & { id?: string }
        Update: Partial<Database['public']['Tables']['newsletter_deliveries']['Row']>
      }
    }
    Functions: {
      get_my_role: { Args: Record<never, never>; Returns: string }
      get_my_user_id: { Args: Record<never, never>; Returns: string }
    }
  }
}
