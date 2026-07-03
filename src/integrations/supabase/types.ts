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
          avatar_url: string | null
          joined_at: string
          last_seen_at: string
          uid: string
          username: string
          wallet_address: string | null
        }
        Insert: {
          avatar_url?: string | null
          joined_at?: string
          last_seen_at?: string
          uid: string
          username: string
          wallet_address?: string | null
        }
        Update: {
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"]; _uid: string }
        Returns: boolean
      }
      increment_song_plays: { Args: { _song_id: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "user"
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
    },
  },
} as const
