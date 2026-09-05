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
      ad_clicks: {
        Row: {
          ad_id: string
          created_at: string
          id: string
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          ad_id: string
          created_at?: string
          id?: string
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          ad_id?: string
          created_at?: string
          id?: string
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_clicks_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_impressions: {
        Row: {
          ad_id: string
          created_at: string
          event_type: string
          id: string
          played_seconds: number | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          ad_id: string
          created_at?: string
          event_type: string
          id?: string
          played_seconds?: number | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          ad_id?: string
          created_at?: string
          event_type?: string
          id?: string
          played_seconds?: number | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_impressions_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
        ]
      }
      ads: {
        Row: {
          ad_type: string
          click_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          duration_seconds: number | null
          end_at: string | null
          frequency_type: string
          frequency_value: number | null
          id: string
          max_impressions: number | null
          priority: number
          sort_order: number
          start_at: string | null
          status: string
          target_tier: string
          thumbnail_path: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          video_path: string | null
          video_url: string
        }
        Insert: {
          ad_type?: string
          click_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_seconds?: number | null
          end_at?: string | null
          frequency_type?: string
          frequency_value?: number | null
          id?: string
          max_impressions?: number | null
          priority?: number
          sort_order?: number
          start_at?: string | null
          status?: string
          target_tier?: string
          thumbnail_path?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          video_path?: string | null
          video_url: string
        }
        Update: {
          ad_type?: string
          click_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_seconds?: number | null
          end_at?: string | null
          frequency_type?: string
          frequency_value?: number | null
          id?: string
          max_impressions?: number | null
          priority?: number
          sort_order?: number
          start_at?: string | null
          status?: string
          target_tier?: string
          thumbnail_path?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          video_path?: string | null
          video_url?: string
        }
        Relationships: []
      }
      artist_applications: {
        Row: {
          artist_name: string
          avatar_url: string | null
          bio: string | null
          copyright_declaration_accepted: boolean
          copyright_declaration_accepted_at: string | null
          created_at: string
          demo_url: string | null
          description: string | null
          full_name: string
          genre: string | null
          guidelines_accepted: boolean
          id: string
          location: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          social_links: Json
          status: Database["public"]["Enums"]["artist_application_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          artist_name: string
          avatar_url?: string | null
          bio?: string | null
          copyright_declaration_accepted?: boolean
          copyright_declaration_accepted_at?: string | null
          created_at?: string
          demo_url?: string | null
          description?: string | null
          full_name: string
          genre?: string | null
          guidelines_accepted?: boolean
          id?: string
          location?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          social_links?: Json
          status?: Database["public"]["Enums"]["artist_application_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          artist_name?: string
          avatar_url?: string | null
          bio?: string | null
          copyright_declaration_accepted?: boolean
          copyright_declaration_accepted_at?: string | null
          created_at?: string
          demo_url?: string | null
          description?: string | null
          full_name?: string
          genre?: string | null
          guidelines_accepted?: boolean
          id?: string
          location?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          social_links?: Json
          status?: Database["public"]["Enums"]["artist_application_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "artist_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "pi_users"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "artist_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "pi_users"
            referencedColumns: ["uid"]
          },
        ]
      }
      artist_profiles: {
        Row: {
          application_id: string | null
          artist_id: string | null
          artist_name: string
          avatar_url: string | null
          bio: string | null
          created_at: string
          genre: string | null
          id: string
          location: string | null
          pioneer_artist: boolean
          social_links: Json
          status: Database["public"]["Enums"]["artist_profile_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          application_id?: string | null
          artist_id?: string | null
          artist_name: string
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          genre?: string | null
          id?: string
          location?: string | null
          pioneer_artist?: boolean
          social_links?: Json
          status?: Database["public"]["Enums"]["artist_profile_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          application_id?: string | null
          artist_id?: string | null
          artist_name?: string
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          genre?: string | null
          id?: string
          location?: string | null
          pioneer_artist?: boolean
          social_links?: Json
          status?: Database["public"]["Enums"]["artist_profile_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "artist_profiles_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "artist_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artist_profiles_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artist_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "pi_users"
            referencedColumns: ["uid"]
          },
        ]
      }
      artists: {
        Row: {
          bio: string | null
          cover_url: string | null
          created_at: string
          genre: string | null
          id: string
          name: string
          slug: string
          verified: boolean
        }
        Insert: {
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          genre?: string | null
          id?: string
          name: string
          slug: string
          verified?: boolean
        }
        Update: {
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          genre?: string | null
          id?: string
          name?: string
          slug?: string
          verified?: boolean
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          song_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          song_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          song_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "pi_users"
            referencedColumns: ["uid"]
          },
        ]
      }
      membership_history: {
        Row: {
          action: string
          created_at: string
          description: string | null
          id: string
          new_plan: string | null
          previous_plan: string | null
          user_uid: string
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          id?: string
          new_plan?: string | null
          previous_plan?: string | null
          user_uid: string
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          id?: string
          new_plan?: string | null
          previous_plan?: string | null
          user_uid?: string
        }
        Relationships: []
      }
      membership_payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          membership_plan_id: string
          memo: string | null
          metadata: Json
          paid_at: string | null
          payment_id: string
          payment_method: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          transaction_id: string | null
          tx_hash: string | null
          updated_at: string
          user_uid: string
          verified_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          membership_plan_id: string
          memo?: string | null
          metadata?: Json
          paid_at?: string | null
          payment_id: string
          payment_method?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          transaction_id?: string | null
          tx_hash?: string | null
          updated_at?: string
          user_uid: string
          verified_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          membership_plan_id?: string
          memo?: string | null
          metadata?: Json
          paid_at?: string | null
          payment_id?: string
          payment_method?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          transaction_id?: string | null
          tx_hash?: string | null
          updated_at?: string
          user_uid?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "membership_payments_membership_plan_id_fkey"
            columns: ["membership_plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_plans: {
        Row: {
          benefits: Json
          billing_cycle: string
          created_at: string
          currency: string
          description: string | null
          display_name: string
          duration_days: number
          id: string
          is_active: boolean
          name: string
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          benefits?: Json
          billing_cycle?: string
          created_at?: string
          currency?: string
          description?: string | null
          display_name: string
          duration_days?: number
          id?: string
          is_active?: boolean
          name: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          benefits?: Json
          billing_cycle?: string
          created_at?: string
          currency?: string
          description?: string | null
          display_name?: string
          duration_days?: number
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      payment_logs: {
        Row: {
          created_at: string
          event_message: string | null
          event_type: string
          id: string
          payment_id: string | null
          raw_response: Json | null
        }
        Insert: {
          created_at?: string
          event_message?: string | null
          event_type: string
          id?: string
          payment_id?: string | null
          raw_response?: Json | null
        }
        Update: {
          created_at?: string
          event_message?: string | null
          event_type?: string
          id?: string
          payment_id?: string | null
          raw_response?: Json | null
        }
        Relationships: []
      }
      pi_users: {
        Row: {
          auth_user_id: string | null
          avatar_url: string | null
          joined_at: string
          last_seen_at: string
          uid: string
          username: string
          wallet_address: string | null
        }
        Insert: {
          auth_user_id?: string | null
          avatar_url?: string | null
          joined_at?: string
          last_seen_at?: string
          uid: string
          username: string
          wallet_address?: string | null
        }
        Update: {
          auth_user_id?: string | null
          avatar_url?: string | null
          joined_at?: string
          last_seen_at?: string
          uid?: string
          username?: string
          wallet_address?: string | null
        }
        Relationships: []
      }
      plays: {
        Row: {
          id: string
          played_at: string
          song_id: string
          user_id: string | null
        }
        Insert: {
          id?: string
          played_at?: string
          song_id: string
          user_id?: string | null
        }
        Update: {
          id?: string
          played_at?: string
          song_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plays_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plays_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "pi_users"
            referencedColumns: ["uid"]
          },
        ]
      }
      song_verifications: {
        Row: {
          artist_id: string | null
          created_at: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          song_id: string
          status: Database["public"]["Enums"]["song_verification_status"]
          updated_at: string
          verification_notes: string | null
        }
        Insert: {
          artist_id?: string | null
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          song_id: string
          status?: Database["public"]["Enums"]["song_verification_status"]
          updated_at?: string
          verification_notes?: string | null
        }
        Update: {
          artist_id?: string | null
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          song_id?: string
          status?: Database["public"]["Enums"]["song_verification_status"]
          updated_at?: string
          verification_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "song_verifications_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "song_verifications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "pi_users"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "song_verifications_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: true
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      songs: {
        Row: {
          album: string | null
          artist_id: string
          audio_path: string
          audio_url: string
          cover_url: string | null
          created_at: string
          duration_seconds: number
          genre: string | null
          id: string
          plays_count: number
          released_at: string
          title: string
          uploaded_by: string | null
        }
        Insert: {
          album?: string | null
          artist_id: string
          audio_path: string
          audio_url: string
          cover_url?: string | null
          created_at?: string
          duration_seconds?: number
          genre?: string | null
          id?: string
          plays_count?: number
          released_at?: string
          title: string
          uploaded_by?: string | null
        }
        Update: {
          album?: string | null
          artist_id?: string
          audio_path?: string
          audio_url?: string
          cover_url?: string | null
          created_at?: string
          duration_seconds?: number
          genre?: string | null
          id?: string
          plays_count?: number
          released_at?: string
          title?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "songs_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "songs_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "pi_users"
            referencedColumns: ["uid"]
          },
        ]
      }
      user_memberships: {
        Row: {
          auto_renew: boolean
          created_at: string
          expires_at: string | null
          id: string
          membership_level: string
          membership_plan_id: string
          membership_status: Database["public"]["Enums"]["membership_status"]
          renewal_status: string | null
          started_at: string | null
          updated_at: string
          user_uid: string
        }
        Insert: {
          auto_renew?: boolean
          created_at?: string
          expires_at?: string | null
          id?: string
          membership_level: string
          membership_plan_id: string
          membership_status?: Database["public"]["Enums"]["membership_status"]
          renewal_status?: string | null
          started_at?: string | null
          updated_at?: string
          user_uid: string
        }
        Update: {
          auto_renew?: boolean
          created_at?: string
          expires_at?: string | null
          id?: string
          membership_level?: string
          membership_plan_id?: string
          membership_status?: Database["public"]["Enums"]["membership_status"]
          renewal_status?: string | null
          started_at?: string | null
          updated_at?: string
          user_uid?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_memberships_membership_plan_id_fkey"
            columns: ["membership_plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
        ]
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
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "pi_users"
            referencedColumns: ["uid"]
          },
        ]
      }
      verification_download_logs: {
        Row: {
          action: string
          admin_user_id: string
          artist_id: string | null
          downloaded_at: string
          id: string
          song_id: string | null
        }
        Insert: {
          action?: string
          admin_user_id: string
          artist_id?: string | null
          downloaded_at?: string
          id?: string
          song_id?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          artist_id?: string | null
          downloaded_at?: string
          id?: string
          song_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verification_download_logs_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "pi_users"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "verification_download_logs_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_download_logs_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_pi_uid: { Args: never; Returns: string }
      has_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"]; _uid: string }
        Returns: boolean
      }
      increment_song_plays: { Args: { _song_id: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "user"
      artist_application_status: "pending" | "approved" | "rejected"
      artist_profile_status: "active" | "suspended"
      membership_status:
        | "pending"
        | "active"
        | "expired"
        | "cancelled"
        | "suspended"
      payment_status:
        | "pending"
        | "completed"
        | "cancelled"
        | "failed"
        | "expired"
        | "refunded"
      song_verification_status:
        | "pending_verification"
        | "verified"
        | "needs_review"
        | "rejected"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      artist_application_status: ["pending", "approved", "rejected"],
      artist_profile_status: ["active", "suspended"],
      membership_status: [
        "pending",
        "active",
        "expired",
        "cancelled",
        "suspended",
      ],
      payment_status: [
        "pending",
        "completed",
        "cancelled",
        "failed",
        "expired",
        "refunded",
      ],
      song_verification_status: [
        "pending_verification",
        "verified",
        "needs_review",
        "rejected",
      ],
    },
  },
} as const
