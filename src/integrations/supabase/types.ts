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
      albums: {
        Row: {
          color: string | null
          created_at: string | null
          icon: string | null
          id: string
          is_pinned: boolean | null
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_pinned?: boolean | null
          name: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_pinned?: boolean | null
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "albums_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "vault_users"
            referencedColumns: ["id"]
          },
        ]
      }
      break_entries: {
        Row: {
          break_date: string
          created_at: string
          id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          break_date: string
          created_at?: string
          id?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          break_date?: string
          created_at?: string
          id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      break_settings: {
        Row: {
          created_at: string
          id: string
          reminder_enabled: boolean | null
          reminder_time: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reminder_enabled?: boolean | null
          reminder_time?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reminder_enabled?: boolean | null
          reminder_time?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      file_albums: {
        Row: {
          color: string | null
          created_at: string | null
          icon: string | null
          id: string
          is_pinned: boolean | null
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_pinned?: boolean | null
          name: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_pinned?: boolean | null
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      files: {
        Row: {
          album_id: string | null
          deleted_at: string | null
          filename: string
          id: string
          is_favorite: boolean | null
          mime_type: string
          size: number
          tags: string[] | null
          uploaded_at: string | null
          user_id: string
        }
        Insert: {
          album_id?: string | null
          deleted_at?: string | null
          filename: string
          id?: string
          is_favorite?: boolean | null
          mime_type: string
          size: number
          tags?: string[] | null
          uploaded_at?: string | null
          user_id: string
        }
        Update: {
          album_id?: string | null
          deleted_at?: string | null
          filename?: string
          id?: string
          is_favorite?: boolean | null
          mime_type?: string
          size?: number
          tags?: string[] | null
          uploaded_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "file_albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "vault_users"
            referencedColumns: ["id"]
          },
        ]
      }
      link_folders: {
        Row: {
          color: string | null
          created_at: string | null
          icon: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      links: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          description: string | null
          favicon_url: string | null
          folder_id: string | null
          id: string
          image_url: string | null
          is_favorite: boolean | null
          tags: string[] | null
          title: string
          updated_at: string | null
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          favicon_url?: string | null
          folder_id?: string | null
          id?: string
          image_url?: string | null
          is_favorite?: boolean | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          url: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          favicon_url?: string | null
          folder_id?: string | null
          id?: string
          image_url?: string | null
          is_favorite?: boolean | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "links_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "link_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          attempted_at: string | null
          id: string
          ip_address: string
          success: boolean | null
        }
        Insert: {
          attempted_at?: string | null
          id?: string
          ip_address: string
          success?: boolean | null
        }
        Update: {
          attempted_at?: string | null
          id?: string
          ip_address?: string
          success?: boolean | null
        }
        Relationships: []
      }
      note_attachments: {
        Row: {
          created_at: string | null
          filename: string
          id: string
          mime_type: string
          note_id: string
          original_name: string
          size: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          filename: string
          id?: string
          mime_type: string
          note_id: string
          original_name: string
          size: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          filename?: string
          id?: string
          mime_type?: string
          note_id?: string
          original_name?: string
          size?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_attachments_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      note_folders: {
        Row: {
          color: string | null
          created_at: string | null
          icon: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      note_versions: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          note_id: string
          title: string
          user_id: string
          version_number: number
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          note_id: string
          title: string
          user_id: string
          version_number: number
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          note_id?: string
          title?: string
          user_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "note_versions_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          content: string | null
          created_at: string | null
          deleted_at: string | null
          folder_id: string | null
          id: string
          is_favorite: boolean | null
          is_secure: boolean | null
          secure_content: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          deleted_at?: string | null
          folder_id?: string | null
          id?: string
          is_favorite?: boolean | null
          is_secure?: boolean | null
          secure_content?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          deleted_at?: string | null
          folder_id?: string | null
          id?: string
          is_favorite?: boolean | null
          is_secure?: boolean | null
          secure_content?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "note_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "vault_users"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          album_id: string | null
          caption: string | null
          deleted_at: string | null
          filename: string
          id: string
          is_favorite: boolean | null
          tags: string[] | null
          taken_at: string | null
          uploaded_at: string | null
          user_id: string
        }
        Insert: {
          album_id?: string | null
          caption?: string | null
          deleted_at?: string | null
          filename: string
          id?: string
          is_favorite?: boolean | null
          tags?: string[] | null
          taken_at?: string | null
          uploaded_at?: string | null
          user_id: string
        }
        Update: {
          album_id?: string | null
          caption?: string | null
          deleted_at?: string | null
          filename?: string
          id?: string
          is_favorite?: boolean | null
          tags?: string[] | null
          taken_at?: string | null
          uploaded_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photos_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "vault_users"
            referencedColumns: ["id"]
          },
        ]
      }
      secret_texts: {
        Row: {
          created_at: string | null
          encrypted_content: string
          id: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          encrypted_content: string
          id?: string
          title?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          encrypted_content?: string
          id?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      security_logs: {
        Row: {
          browser: string | null
          city: string | null
          country: string | null
          created_at: string | null
          details: Json | null
          device_type: string | null
          event_type: string
          id: string
          ip_address: string | null
          os: string | null
          region: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          details?: Json | null
          device_type?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          os?: string | null
          region?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          details?: Json | null
          device_type?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          os?: string | null
          region?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      session_history: {
        Row: {
          browser: string | null
          city: string | null
          country: string | null
          device_type: string | null
          id: string
          ip_address: string | null
          is_active: boolean | null
          login_at: string | null
          logout_at: string | null
          os: string | null
          region: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          login_at?: string | null
          logout_at?: string | null
          os?: string | null
          region?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          login_at?: string | null
          logout_at?: string | null
          os?: string | null
          region?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "vault_users"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_album_access: {
        Row: {
          created_at: string
          id: string
          permission: string
          shared_album_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission?: string
          shared_album_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission?: string
          shared_album_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_album_access_shared_album_id_fkey"
            columns: ["shared_album_id"]
            isOneToOne: false
            referencedRelation: "shared_albums"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_album_items: {
        Row: {
          added_at: string
          added_by: string
          file_id: string | null
          id: string
          link_id: string | null
          note_id: string | null
          photo_id: string | null
          shared_album_id: string
          tiktok_id: string | null
        }
        Insert: {
          added_at?: string
          added_by: string
          file_id?: string | null
          id?: string
          link_id?: string | null
          note_id?: string | null
          photo_id?: string | null
          shared_album_id: string
          tiktok_id?: string | null
        }
        Update: {
          added_at?: string
          added_by?: string
          file_id?: string | null
          id?: string
          link_id?: string | null
          note_id?: string | null
          photo_id?: string | null
          shared_album_id?: string
          tiktok_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shared_album_items_shared_album_id_fkey"
            columns: ["shared_album_id"]
            isOneToOne: false
            referencedRelation: "shared_albums"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_albums: {
        Row: {
          color: string | null
          content_type: string
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_pinned: boolean | null
          name: string
          owner_id: string
          public_link_enabled: boolean | null
          public_link_password: string | null
          public_link_token: string | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          content_type?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_pinned?: boolean | null
          name: string
          owner_id: string
          public_link_enabled?: boolean | null
          public_link_password?: string | null
          public_link_token?: string | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          content_type?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_pinned?: boolean | null
          name?: string
          owner_id?: string
          public_link_enabled?: boolean | null
          public_link_password?: string | null
          public_link_token?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      tiktok_folders: {
        Row: {
          color: string | null
          created_at: string | null
          icon: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      tiktok_videos: {
        Row: {
          author_name: string | null
          created_at: string | null
          deleted_at: string | null
          folder_id: string | null
          id: string
          is_favorite: boolean | null
          thumbnail_url: string | null
          title: string | null
          url: string
          user_id: string
          video_id: string | null
        }
        Insert: {
          author_name?: string | null
          created_at?: string | null
          deleted_at?: string | null
          folder_id?: string | null
          id?: string
          is_favorite?: boolean | null
          thumbnail_url?: string | null
          title?: string | null
          url: string
          user_id: string
          video_id?: string | null
        }
        Update: {
          author_name?: string | null
          created_at?: string | null
          deleted_at?: string | null
          folder_id?: string | null
          id?: string
          is_favorite?: boolean | null
          thumbnail_url?: string | null
          title?: string | null
          url?: string
          user_id?: string
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tiktok_videos_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "tiktok_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vault_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          is_decoy: boolean
          last_activity: string
          session_token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          is_decoy?: boolean
          last_activity?: string
          session_token: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          is_decoy?: boolean
          last_activity?: string
          session_token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vault_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "vault_users"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_users: {
        Row: {
          admin_notes: string | null
          created_at: string | null
          decoy_pin_hash: string | null
          id: string
          last_login_at: string | null
          last_login_ip: string | null
          login_count: number | null
          pin_hash: string
          recovery_key: string | null
          updated_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string | null
          decoy_pin_hash?: string | null
          id?: string
          last_login_at?: string | null
          last_login_ip?: string | null
          login_count?: number | null
          pin_hash: string
          recovery_key?: string | null
          updated_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string | null
          decoy_pin_hash?: string | null
          id?: string
          last_login_at?: string | null
          last_login_ip?: string | null
          login_count?: number | null
          pin_hash?: string
          recovery_key?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      view_history: {
        Row: {
          id: string
          item_id: string
          item_type: string
          user_id: string
          viewed_at: string | null
        }
        Insert: {
          id?: string
          item_id: string
          item_type: string
          user_id: string
          viewed_at?: string | null
        }
        Update: {
          id?: string
          item_id?: string
          item_type?: string
          user_id?: string
          viewed_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_sessions: { Args: never; Returns: undefined }
      cleanup_old_login_attempts: { Args: never; Returns: undefined }
      get_session_user_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      validate_session_token: {
        Args: { token: string }
        Returns: {
          is_decoy: boolean
          user_id: string
        }[]
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
