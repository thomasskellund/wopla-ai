export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  api: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      archive_chat_room: {
        Args: { p_archived: boolean; p_room_id: string }
        Returns: undefined
      }
      create_custom_group: {
        Args: { p_member_profile_ids: string[]; p_name: string }
        Returns: Database["public"]["Tables"]["chat_rooms"]["Row"]
        SetofOptions: {
          from: "*"
          to: "chat_rooms"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_chat_messages: {
        Args: { p_before?: string; p_limit?: number; p_room_id: string }
        Returns: {
          attachment_mime: string
          attachment_name: string
          attachment_path: string
          body: string
          created_at: string
          id: string
          sender_id: string
          sender_name: string
        }[]
      }
      get_or_create_company_vendor_room: {
        Args: { p_other_id: string }
        Returns: Database["public"]["Tables"]["chat_rooms"]["Row"]
        SetofOptions: {
          from: "*"
          to: "chat_rooms"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      list_chat_rooms: {
        Args: { p_archived?: boolean; p_keyword?: string }
        Returns: {
          archived: boolean
          company_id: string
          company_name: string
          id: string
          last_message_at: string
          last_message_preview: string
          name: string
          room_type: Database["public"]["Enums"]["chat_room_type"]
          unread_count: number
          vendor_id: string
          vendor_name: string
        }[]
      }
      mark_chat_room_read: { Args: { p_room_id: string }; Returns: undefined }
      mark_chat_room_unread: { Args: { p_room_id: string }; Returns: undefined }
      send_chat_message: {
        Args: {
          p_attachment_mime?: string
          p_attachment_name?: string
          p_attachment_path?: string
          p_body?: string
          p_room_id: string
        }
        Returns: Database["public"]["Tables"]["chat_messages"]["Row"]
        SetofOptions: {
          from: "*"
          to: "chat_messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_custom_group: {
        Args: {
          p_member_profile_ids: string[]
          p_name: string
          p_room_id: string
        }
        Returns: undefined
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
      chat_messages: {
        Row: {
          attachment_mime: string | null
          attachment_name: string | null
          attachment_path: string | null
          body: string | null
          created_at: string
          deleted_at: string | null
          id: string
          room_id: string
          sender_id: string
        }
        Insert: {
          attachment_mime?: string | null
          attachment_name?: string | null
          attachment_path?: string | null
          body?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          room_id: string
          sender_id: string
        }
        Update: {
          attachment_mime?: string | null
          attachment_name?: string | null
          attachment_path?: string | null
          body?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          room_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_room_members: {
        Row: {
          archived: boolean
          created_at: string
          id: string
          last_read_at: string | null
          profile_id: string
          room_id: string
          unread_count: number
        }
        Insert: {
          archived?: boolean
          created_at?: string
          id?: string
          last_read_at?: string | null
          profile_id: string
          room_id: string
          unread_count?: number
        }
        Update: {
          archived?: boolean
          created_at?: string
          id?: string
          last_read_at?: string | null
          profile_id?: string
          room_id?: string
          unread_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "chat_room_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_room_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_rooms: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          id: string
          last_message_at: string
          name: string | null
          room_type: Database["public"]["Enums"]["chat_room_type"]
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_message_at?: string
          name?: string | null
          room_type: Database["public"]["Enums"]["chat_room_type"]
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_message_at?: string
          name?: string | null
          room_type?: Database["public"]["Enums"]["chat_room_type"]
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_rooms_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_rooms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_rooms_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
          vat_number: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          vat_number?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          vat_number?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string
          deleted_at: string | null
          full_name: string
          id: string
          language: string
          last_login_at: string | null
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          deleted_at?: string | null
          full_name?: string
          id: string
          language?: string
          last_login_at?: string | null
          phone?: string | null
          role: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          deleted_at?: string | null
          full_name?: string
          id?: string
          language?: string
          last_login_at?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
          vat_number: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          vat_number?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          vat_number?: string | null
          zip?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role: "admin" | "vendor_admin" | "company_admin" | "employee"
      chat_room_type:
        | "admin_company"
        | "admin_vendor"
        | "company_vendor"
        | "custom_group"
      entity_status: "active" | "inactive"
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
  api: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "vendor_admin", "company_admin", "employee"],
      chat_room_type: [
        "admin_company",
        "admin_vendor",
        "company_vendor",
        "custom_group",
      ],
      entity_status: ["active", "inactive"],
    },
  },
} as const

