export type UserRole = 'athlete' | 'coach' | 'admin' | 'organization' | 'doctor'

export type ConnectionType =
  | 'coach_athlete'
  | 'org_coach'
  | 'org_athlete'
  | 'doctor_athlete'
  | 'coach_doctor'
  | 'org_doctor'
  | 'admin_doctor'

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
          nickname: string | null
          is_searchable: boolean
          discipline: string | null
          coach_specialization: string | null
          experience_years: number | null
          bio: string | null
          phone: string | null
          city: string | null
          country: string | null
          first_name: string | null
          last_name: string | null
          birth_date: string | null
          gender: string | null
          status: string | null
          deleted_at: string | null
          avatar_url: string | null
          sport: string | null
        }
        Insert: {
          id?: string
          auth_id?: string | null
          email: string
          name: string
          role: UserRole
          created_at?: string
          nickname?: string | null
          is_searchable?: boolean
          discipline?: string | null
          coach_specialization?: string | null
          experience_years?: number | null
          bio?: string | null
          phone?: string | null
          city?: string | null
          country?: string | null
          first_name?: string | null
          last_name?: string | null
          birth_date?: string | null
          gender?: string | null
          status?: string | null
          deleted_at?: string | null
          avatar_url?: string | null
          sport?: string | null
        }
        Update: {
          id?: string
          auth_id?: string | null
          email?: string
          name?: string
          role?: UserRole
          created_at?: string
          nickname?: string | null
          is_searchable?: boolean
          discipline?: string | null
          coach_specialization?: string | null
          experience_years?: number | null
          bio?: string | null
          phone?: string | null
          city?: string | null
          country?: string | null
          first_name?: string | null
          last_name?: string | null
          birth_date?: string | null
          gender?: string | null
          status?: string | null
          deleted_at?: string | null
          avatar_url?: string | null
          sport?: string | null
        }
        Relationships: []
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
          first_name: string | null
          last_name: string | null
          birth_date: string | null
          phone: string | null
          city: string | null
          country: string | null
          bio: string | null
          club: string | null
          vo2max: number | null
          max_heart_rate: number | null
          lactate_threshold_hr: number | null
          weekly_training_hours: number | null
          instagram_url: string | null
          twitter_url: string | null
          threads_url: string | null
          telegram_url: string | null
          youtube_url: string | null
          tiktok_url: string | null
          website_url: string | null
        }
        Insert: {
          id: string
          age?: number | null
          gender?: string | null
          weight_kg?: number | null
          height_cm?: number | null
          fitness_level?: string | null
          primary_sport?: string | null
          goal?: string | null
          hrv_baseline?: number | null
          rhr_baseline?: number | null
          profile_public?: boolean
          workouts_public?: boolean
          updated_at?: string | null
          first_name?: string | null
          last_name?: string | null
          birth_date?: string | null
          phone?: string | null
          city?: string | null
          country?: string | null
          bio?: string | null
          club?: string | null
          vo2max?: number | null
          max_heart_rate?: number | null
          lactate_threshold_hr?: number | null
          weekly_training_hours?: number | null
          instagram_url?: string | null
          twitter_url?: string | null
          threads_url?: string | null
          telegram_url?: string | null
          youtube_url?: string | null
          tiktok_url?: string | null
          website_url?: string | null
        }
        Update: {
          id?: string
          age?: number | null
          gender?: string | null
          weight_kg?: number | null
          height_cm?: number | null
          fitness_level?: string | null
          primary_sport?: string | null
          goal?: string | null
          hrv_baseline?: number | null
          rhr_baseline?: number | null
          profile_public?: boolean
          workouts_public?: boolean
          updated_at?: string | null
          first_name?: string | null
          last_name?: string | null
          birth_date?: string | null
          phone?: string | null
          city?: string | null
          country?: string | null
          bio?: string | null
          club?: string | null
          vo2max?: number | null
          max_heart_rate?: number | null
          lactate_threshold_hr?: number | null
          weekly_training_hours?: number | null
          instagram_url?: string | null
          twitter_url?: string | null
          threads_url?: string | null
          telegram_url?: string | null
          youtube_url?: string | null
          tiktok_url?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      connections: {
        Row: {
          id: string
          initiator_id: string
          recipient_id: string
          connection_type: ConnectionType
          status: 'pending' | 'active' | 'declined' | 'cancelled' | 'terminated'
          message: string | null
          initiated_at: string
          responded_at: string | null
          terminated_at: string | null
          terminated_by: string | null
        }
        Insert: {
          id?: string
          initiator_id: string
          recipient_id: string
          connection_type: ConnectionType
          status?: 'pending' | 'active' | 'declined' | 'cancelled' | 'terminated'
          message?: string | null
          initiated_at?: string
          responded_at?: string | null
          terminated_at?: string | null
          terminated_by?: string | null
        }
        Update: {
          id?: string
          initiator_id?: string
          recipient_id?: string
          connection_type?: ConnectionType
          status?: 'pending' | 'active' | 'declined' | 'cancelled' | 'terminated'
          message?: string | null
          initiated_at?: string
          responded_at?: string | null
          terminated_at?: string | null
          terminated_by?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          body: string | null
          entity_type: string | null
          entity_id: string | null
          is_read: boolean
          is_archived: boolean
          action_url: string | null
          created_at: string
          read_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          title: string
          body?: string | null
          entity_type?: string | null
          entity_id?: string | null
          is_read?: boolean
          is_archived?: boolean
          action_url?: string | null
          created_at?: string
          read_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          title?: string
          body?: string | null
          entity_type?: string | null
          entity_id?: string | null
          is_read?: boolean
          is_archived?: boolean
          action_url?: string | null
          created_at?: string
          read_at?: string | null
        }
        Relationships: []
      }
      chats: {
        Row: {
          id: string
          athlete_id: string | null
          coach_id: string | null
          type: 'direct' | 'org_channel' | 'group'
          name: string | null
          org_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          athlete_id?: string | null
          coach_id?: string | null
          type?: 'direct' | 'org_channel' | 'group'
          name?: string | null
          org_id?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          athlete_id?: string | null
          coach_id?: string | null
          type?: 'direct' | 'org_channel' | 'group'
          name?: string | null
          org_id?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      chat_members: {
        Row: {
          id: string
          chat_id: string
          user_id: string
          role: string
          joined_at: string
        }
        Insert: {
          id?: string
          chat_id: string
          user_id: string
          role?: string
          joined_at?: string
        }
        Update: {
          id?: string
          chat_id?: string
          user_id?: string
          role?: string
          joined_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          id: string
          chat_id: string
          sender_id: string
          body: string
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          chat_id: string
          sender_id: string
          body: string
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          chat_id?: string
          sender_id?: string
          body?: string
          is_read?: boolean
          created_at?: string
        }
        Relationships: []
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
        Insert: {
          id?: string
          athlete_id: string
          event_date: string
          event_type: string
          is_public?: boolean
          cycle_type?: string
          activity_type?: string | null
          workout_time_of_day?: string | null
          start_time?: string | null
          activity_duration_min?: number | null
          activity_strain?: number | null
          avg_heart_rate?: number | null
          max_heart_rate?: number | null
          activity_calories?: number | null
          hr_zone_1_min?: number | null
          hr_zone_2_min?: number | null
          hr_zone_3_min?: number | null
          hr_zone_4_min?: number | null
          hr_zone_5_min?: number | null
          recovery_score?: number | null
          hrv?: number | null
          name?: string | null
          description?: string | null
          mood?: number | null
          trainer_comment?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          athlete_id?: string
          event_date?: string
          event_type?: string
          is_public?: boolean
          cycle_type?: string
          activity_type?: string | null
          workout_time_of_day?: string | null
          start_time?: string | null
          activity_duration_min?: number | null
          activity_strain?: number | null
          avg_heart_rate?: number | null
          max_heart_rate?: number | null
          activity_calories?: number | null
          hr_zone_1_min?: number | null
          hr_zone_2_min?: number | null
          hr_zone_3_min?: number | null
          hr_zone_4_min?: number | null
          hr_zone_5_min?: number | null
          recovery_score?: number | null
          hrv?: number | null
          name?: string | null
          description?: string | null
          mood?: number | null
          trainer_comment?: string | null
          created_at?: string
        }
        Relationships: []
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
        Insert: {
          id?: string
          athlete_id: string
          date: string
          recovery_score?: number | null
          hrv?: number | null
          resting_heart_rate?: number | null
          sleep_hours?: number | null
          sleep_efficiency?: number | null
          day_strain?: number | null
          calories_burned?: number | null
          respiratory_rate?: number | null
          skin_temp_deviation?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          athlete_id?: string
          date?: string
          recovery_score?: number | null
          hrv?: number | null
          resting_heart_rate?: number | null
          sleep_hours?: number | null
          sleep_efficiency?: number | null
          day_strain?: number | null
          calories_burned?: number | null
          respiratory_rate?: number | null
          skin_temp_deviation?: number | null
          created_at?: string
        }
        Relationships: []
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
        Insert: {
          id?: string
          athlete_id: string
          date: string
          name: string
          distance?: string | null
          result?: string | null
          notes?: string | null
          is_public?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          athlete_id?: string
          date?: string
          name?: string
          distance?: string | null
          result?: string | null
          notes?: string | null
          is_public?: boolean
          created_at?: string
        }
        Relationships: []
      }
      workout_comments: {
        Row: {
          id: string
          workout_id: string
          author_id: string
          body: string
          created_at: string
        }
        Insert: {
          id?: string
          workout_id: string
          author_id: string
          body: string
          created_at?: string
        }
        Update: {
          id?: string
          workout_id?: string
          author_id?: string
          body?: string
          created_at?: string
        }
        Relationships: []
      }
      observation_diary: {
        Row: {
          id: string
          coach_id: string
          athlete_id: string | null
          date: string
          note: string
          tags: string[]
          created_at: string
        }
        Insert: {
          id?: string
          coach_id: string
          athlete_id?: string | null
          date: string
          note: string
          tags?: string[]
          created_at?: string
        }
        Update: {
          id?: string
          coach_id?: string
          athlete_id?: string | null
          date?: string
          note?: string
          tags?: string[]
          created_at?: string
        }
        Relationships: []
      }
      cycle_blocks: {
        Row: {
          id: string
          athlete_id: string
          start_date: string
          end_date: string
          cycle_type: 'micro' | 'meso' | 'macro'
          label: string | null
          color: string
          created_at: string
        }
        Insert: {
          id?: string
          athlete_id: string
          start_date: string
          end_date: string
          cycle_type: 'micro' | 'meso' | 'macro'
          label?: string | null
          color?: string
          created_at?: string
        }
        Update: {
          id?: string
          athlete_id?: string
          start_date?: string
          end_date?: string
          cycle_type?: 'micro' | 'meso' | 'macro'
          label?: string | null
          color?: string
          created_at?: string
        }
        Relationships: []
      }
      trainer_athletes: {
        Row: {
          trainer_id: string
          athlete_id: string
          created_at: string
        }
        Insert: {
          trainer_id: string
          athlete_id: string
          created_at?: string
        }
        Update: {
          trainer_id?: string
          athlete_id?: string
          created_at?: string
        }
        Relationships: []
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
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          event_date?: string
          event_type?: 'workout' | 'competition' | 'rest' | 'note' | 'travel' | 'medical' | 'test' | 'camp' | 'other'
          title?: string
          notes?: string | null
          start_time?: string | null
          end_time?: string | null
          created_at?: string
        }
        Relationships: []
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
        Insert: {
          id?: string
          user_id: string
          org_name: string
          org_slug: string
          sport_type?: string | null
          city?: string | null
          is_verified?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          org_name?: string
          org_slug?: string
          sport_type?: string | null
          city?: string | null
          is_verified?: boolean
          created_at?: string
        }
        Relationships: []
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
        Insert: {
          id?: string
          org_id: string
          user_id: string
          role: 'athlete' | 'coach'
          status?: 'active' | 'pending' | 'suspended'
          joined_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          user_id?: string
          role?: 'athlete' | 'coach'
          status?: 'active' | 'pending' | 'suspended'
          joined_at?: string
        }
        Relationships: []
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
        Insert: {
          id?: string
          org_id: string
          author_id: string
          title: string
          body: string
          post_type: 'announcement' | 'event' | 'news' | 'result'
          event_date?: string | null
          visible_to?: 'all' | 'members' | 'coaches'
          is_pinned?: boolean
          is_deleted?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          author_id?: string
          title?: string
          body?: string
          post_type?: 'announcement' | 'event' | 'news' | 'result'
          event_date?: string | null
          visible_to?: 'all' | 'members' | 'coaches'
          is_pinned?: boolean
          is_deleted?: boolean
          created_at?: string
        }
        Relationships: []
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
        Insert: {
          id?: string
          org_id: string
          author_id: string
          subject: string
          body: string
          target_roles: ('athlete' | 'coach')[]
          status?: 'draft' | 'sent' | 'scheduled'
          scheduled_at?: string | null
          sent_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          author_id?: string
          subject?: string
          body?: string
          target_roles?: ('athlete' | 'coach')[]
          status?: 'draft' | 'sent' | 'scheduled'
          scheduled_at?: string | null
          sent_at?: string | null
          created_at?: string
        }
        Relationships: []
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
        Insert: {
          id?: string
          newsletter_id: string
          recipient_id: string
          status?: 'pending' | 'delivered' | 'failed'
          delivered_at?: string | null
          opened_at?: string | null
        }
        Update: {
          id?: string
          newsletter_id?: string
          recipient_id?: string
          status?: 'pending' | 'delivered' | 'failed'
          delivered_at?: string | null
          opened_at?: string | null
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      get_my_role: { Args: Record<string, never>; Returns: string }
      get_my_user_id: { Args: Record<string, never>; Returns: string }
    }
  }
}
