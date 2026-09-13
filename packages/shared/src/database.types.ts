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
      add_manual_line_item: {
        Args: {
          p_description: string
          p_invoice_id: string
          p_quantity: number
          p_unit_price: number
        }
        Returns: Database["public"]["Tables"]["invoice_line_items"]["Row"]
        SetofOptions: {
          from: "*"
          to: "invoice_line_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      archive_chat_room: {
        Args: { p_archived: boolean; p_room_id: string }
        Returns: undefined
      }
      cancel_daily_order: {
        Args: { p_note?: string; p_order_date: string; p_order_id: string }
        Returns: Database["public"]["Tables"]["daily_orders"]["Row"]
        SetofOptions: {
          from: "*"
          to: "daily_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_announcement: {
        Args: { p_body: string; p_expires_at?: string; p_title: string }
        Returns: Database["public"]["Tables"]["announcements"]["Row"]
        SetofOptions: {
          from: "*"
          to: "announcements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_company_holiday: {
        Args: {
          p_company_id: string
          p_holiday_date: string
          p_module_id?: number
        }
        Returns: Database["public"]["Tables"]["company_holidays"]["Row"]
        SetofOptions: {
          from: "*"
          to: "company_holidays"
          isOneToOne: true
          isSetofReturn: false
        }
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
      create_dish: {
        Args: { p_name: string }
        Returns: Database["public"]["Tables"]["dishes"]["Row"]
        SetofOptions: {
          from: "*"
          to: "dishes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_employee_absence: {
        Args: { p_absence_date: string; p_profile_id: string }
        Returns: Database["public"]["Tables"]["employee_absences"]["Row"]
        SetofOptions: {
          from: "*"
          to: "employee_absences"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_invoice: {
        Args: {
          p_counterparty_id: string
          p_from_date: string
          p_module_id?: number
          p_to_date: string
          p_type: Database["public"]["Enums"]["invoice_type"]
        }
        Returns: Database["public"]["Tables"]["invoices"]["Row"]
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_order: {
        Args: {
          p_company_id: string
          p_from_date: string
          p_module_id?: number
          p_to_date?: string
          p_vendor_id: string
        }
        Returns: Database["public"]["Tables"]["orders"]["Row"]
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_public_holiday: {
        Args: { p_holiday_date: string; p_module_id?: number; p_name: string }
        Returns: Database["public"]["Tables"]["public_holidays"]["Row"]
        SetofOptions: {
          from: "*"
          to: "public_holidays"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_announcement: { Args: { p_id: string }; Returns: undefined }
      delete_company_holiday: { Args: { p_id: string }; Returns: undefined }
      delete_employee_absence: { Args: { p_id: string }; Returns: undefined }
      delete_public_holiday: { Args: { p_id: string }; Returns: undefined }
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
      get_current_billing_rate: {
        Args: { p_order_id: string }
        Returns: Database["public"]["Tables"]["billing_rates"]["Row"]
        SetofOptions: {
          from: "*"
          to: "billing_rates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_invoice: {
        Args: { p_invoice_id: string }
        Returns: Database["public"]["Tables"]["invoices"]["Row"]
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_my_week: {
        Args: { p_order_id: string; p_week_start: string }
        Returns: {
          can_edit: boolean
          dish_id: string
          dish_name: string
          is_override: boolean
          order_date: string
          status: Database["public"]["Enums"]["daily_order_status"]
          weekday: Database["public"]["Enums"]["weekday"]
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
      get_vendor_headcount: {
        Args: { p_order_date: string; p_vendor_id: string }
        Returns: {
          company_id: string
          company_name: string
          daily_order_id: string
          dish_id: string
          dish_name: string
          heads: number
          order_id: string
          status: Database["public"]["Enums"]["daily_order_status"]
        }[]
      }
      list_announcements: {
        Args: never
        Returns: {
          body: string
          created_at: string
          expires_at: string
          id: string
          is_read: boolean
          title: string
        }[]
      }
      list_available_vendors: {
        Args: never
        Returns: {
          id: string
          name: string
        }[]
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
      mark_announcement_read: { Args: { p_id: string }; Returns: undefined }
      mark_chat_room_read: { Args: { p_room_id: string }; Returns: undefined }
      mark_chat_room_unread: { Args: { p_room_id: string }; Returns: undefined }
      mark_invoice_paid: {
        Args: { p_invoice_id: string }
        Returns: Database["public"]["Tables"]["invoices"]["Row"]
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_extra_heads: {
        Args: {
          p_daily_order_id: string
          p_dish_id: string
          p_extra_heads: number
          p_note?: string
        }
        Returns: Database["public"]["Tables"]["daily_order_dish_heads"]["Row"]
        SetofOptions: {
          from: "*"
          to: "daily_order_dish_heads"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reject_invoice: {
        Args: {
          p_credit_note_amount: number
          p_credit_note_reason: string
          p_invoice_id: string
          p_rejection_reason: string
        }
        Returns: Database["public"]["Tables"]["invoices"]["Row"]
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_order_dish_heads: {
        Args: { p_dish_id: string; p_order_id: string; p_weekday_heads: Json }
        Returns: undefined
      }
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
      set_billing_rate: {
        Args: {
          p_company_per_head_price: number
          p_from_date?: string
          p_kickback_percentage?: number
          p_order_id: string
          p_to_date?: string
          p_vendor_per_head_price: number
        }
        Returns: Database["public"]["Tables"]["billing_rates"]["Row"]
        SetofOptions: {
          from: "*"
          to: "billing_rates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_company_working_days: {
        Args: {
          p_company_id: string
          p_fri: boolean
          p_mon: boolean
          p_sat: boolean
          p_sun: boolean
          p_thu: boolean
          p_tue: boolean
          p_wed: boolean
        }
        Returns: Database["public"]["Tables"]["company_working_days"]["Row"]
        SetofOptions: {
          from: "*"
          to: "company_working_days"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_dish_status: {
        Args: {
          p_dish_id: string
          p_status: Database["public"]["Enums"]["entity_status"]
        }
        Returns: Database["public"]["Tables"]["dishes"]["Row"]
        SetofOptions: {
          from: "*"
          to: "dishes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_grace_period: {
        Args: {
          p_cancel_grace_period: boolean
          p_cancellation_days: number
          p_cancellation_time: string
          p_company_id: string
          p_major_update_days: number
          p_major_update_time: string
          p_minor_update_days: number
          p_minor_update_time: string
          p_module_id: number
          p_threshold: number
        }
        Returns: Database["public"]["Tables"]["grace_periods"]["Row"]
        SetofOptions: {
          from: "*"
          to: "grace_periods"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_my_daily_choice: {
        Args: { p_dish_id: string; p_order_date: string; p_order_id: string }
        Returns: Database["public"]["Tables"]["daily_orders"]["Row"]
        SetofOptions: {
          from: "*"
          to: "daily_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_my_weekly_preference: {
        Args: {
          p_dish_id: string
          p_order_id: string
          p_weekday: Database["public"]["Enums"]["weekday"]
        }
        Returns: undefined
      }
      submit_invoice: {
        Args: { p_invoice_id: string }
        Returns: Database["public"]["Tables"]["invoices"]["Row"]
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      uncancel_daily_order: {
        Args: { p_order_date: string; p_order_id: string }
        Returns: Database["public"]["Tables"]["daily_orders"]["Row"]
        SetofOptions: {
          from: "*"
          to: "daily_orders"
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
      announcement_reads: {
        Row: {
          announcement_id: string
          profile_id: string
          read_at: string
        }
        Insert: {
          announcement_id: string
          profile_id: string
          read_at?: string
        }
        Update: {
          announcement_id?: string
          profile_id?: string
          read_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_reads_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          body: string
          created_at: string
          created_by: string
          deleted_at: string | null
          expires_at: string | null
          id: string
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by: string
          deleted_at?: string | null
          expires_at?: string | null
          id?: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          expires_at?: string | null
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_rates: {
        Row: {
          company_per_head_price: number
          created_at: string
          created_by: string | null
          from_date: string
          id: string
          kickback_percentage: number
          order_id: string
          to_date: string | null
          vendor_per_head_price: number
        }
        Insert: {
          company_per_head_price: number
          created_at?: string
          created_by?: string | null
          from_date: string
          id?: string
          kickback_percentage?: number
          order_id: string
          to_date?: string | null
          vendor_per_head_price: number
        }
        Update: {
          company_per_head_price?: number
          created_at?: string
          created_by?: string | null
          from_date?: string
          id?: string
          kickback_percentage?: number
          order_id?: string
          to_date?: string | null
          vendor_per_head_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "billing_rates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_rates_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
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
          admin_managed_order: boolean
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
          admin_managed_order?: boolean
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
          admin_managed_order?: boolean
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
      company_holidays: {
        Row: {
          company_id: string
          holiday_date: string
          id: string
          module_id: number | null
        }
        Insert: {
          company_id: string
          holiday_date: string
          id?: string
          module_id?: number | null
        }
        Update: {
          company_id?: string
          holiday_date?: string
          id?: string
          module_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "company_holidays_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_holidays_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      company_working_days: {
        Row: {
          company_id: string
          fri: boolean
          mon: boolean
          sat: boolean
          sun: boolean
          thu: boolean
          tue: boolean
          wed: boolean
        }
        Insert: {
          company_id: string
          fri?: boolean
          mon?: boolean
          sat?: boolean
          sun?: boolean
          thu?: boolean
          tue?: boolean
          wed?: boolean
        }
        Update: {
          company_id?: string
          fri?: boolean
          mon?: boolean
          sat?: boolean
          sun?: boolean
          thu?: boolean
          tue?: boolean
          wed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "company_working_days_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_order_dish_heads: {
        Row: {
          daily_order_id: string
          dish_id: string
          heads: number
        }
        Insert: {
          daily_order_id: string
          dish_id: string
          heads?: number
        }
        Update: {
          daily_order_id?: string
          dish_id?: string
          heads?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_order_dish_heads_daily_order_id_fkey"
            columns: ["daily_order_id"]
            isOneToOne: false
            referencedRelation: "daily_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_order_dish_heads_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_order_events: {
        Row: {
          added_by: string
          created_at: string
          daily_order_id: string
          dish_id: string
          extra_heads: number
          id: string
          note: string | null
          original_heads: number
        }
        Insert: {
          added_by: string
          created_at?: string
          daily_order_id: string
          dish_id: string
          extra_heads: number
          id?: string
          note?: string | null
          original_heads: number
        }
        Update: {
          added_by?: string
          created_at?: string
          daily_order_id?: string
          dish_id?: string
          extra_heads?: number
          id?: string
          note?: string | null
          original_heads?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_order_events_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_order_events_daily_order_id_fkey"
            columns: ["daily_order_id"]
            isOneToOne: false
            referencedRelation: "daily_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_order_events_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_order_preferences: {
        Row: {
          daily_order_id: string
          dish_id: string | null
          id: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          daily_order_id: string
          dish_id?: string | null
          id?: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          daily_order_id?: string
          dish_id?: string | null
          id?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_order_preferences_daily_order_id_fkey"
            columns: ["daily_order_id"]
            isOneToOne: false
            referencedRelation: "daily_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_order_preferences_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_order_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_orders: {
        Row: {
          cancellation_note: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          company_id: string
          created_at: string
          employee_share: number | null
          id: string
          minimum_heads: number | null
          order_date: string
          order_id: string
          status: Database["public"]["Enums"]["daily_order_status"]
          total_heads: number
          updated_at: string
          vendor_id: string
          was_working_day: boolean | null
        }
        Insert: {
          cancellation_note?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          company_id: string
          created_at?: string
          employee_share?: number | null
          id?: string
          minimum_heads?: number | null
          order_date: string
          order_id: string
          status?: Database["public"]["Enums"]["daily_order_status"]
          total_heads?: number
          updated_at?: string
          vendor_id: string
          was_working_day?: boolean | null
        }
        Update: {
          cancellation_note?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          company_id?: string
          created_at?: string
          employee_share?: number | null
          id?: string
          minimum_heads?: number | null
          order_date?: string
          order_id?: string
          status?: Database["public"]["Enums"]["daily_order_status"]
          total_heads?: number
          updated_at?: string
          vendor_id?: string
          was_working_day?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_orders_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      dishes: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dishes_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_absences: {
        Row: {
          absence_date: string
          id: string
          profile_id: string
        }
        Insert: {
          absence_date: string
          id?: string
          profile_id: string
        }
        Update: {
          absence_date?: string
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_absences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      grace_periods: {
        Row: {
          cancel_grace_period: boolean
          cancellation_days: number
          cancellation_time: string
          company_id: string | null
          id: string
          major_update_days: number
          major_update_time: string
          minor_update_days: number
          minor_update_time: string
          module_id: number
          threshold: number
        }
        Insert: {
          cancel_grace_period?: boolean
          cancellation_days?: number
          cancellation_time?: string
          company_id?: string | null
          id?: string
          major_update_days?: number
          major_update_time?: string
          minor_update_days?: number
          minor_update_time?: string
          module_id: number
          threshold?: number
        }
        Update: {
          cancel_grace_period?: boolean
          cancellation_days?: number
          cancellation_time?: string
          company_id?: string | null
          id?: string
          major_update_days?: number
          major_update_time?: string
          minor_update_days?: number
          minor_update_time?: string
          module_id?: number
          threshold?: number
        }
        Relationships: [
          {
            foreignKeyName: "grace_periods_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grace_periods_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_credit_notes: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string
          reason: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id: string
          reason: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_credit_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_credit_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          description: string
          id: string
          invoice_id: string
          line_type: Database["public"]["Enums"]["invoice_line_type"]
          period_end: string | null
          period_start: string | null
          quantity: number
          unit_price: number
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          invoice_id: string
          line_type: Database["public"]["Enums"]["invoice_line_type"]
          period_end?: string | null
          period_start?: string | null
          quantity?: number
          unit_price: number
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          invoice_id?: string
          line_type?: Database["public"]["Enums"]["invoice_line_type"]
          period_end?: string | null
          period_start?: string | null
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          from_date: string
          id: string
          last_synced_at: string | null
          module_id: number
          paid_at: string | null
          payment_terms_days: number
          rejected_at: string | null
          rejection_reason: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          to_date: string
          total: number
          type: Database["public"]["Enums"]["invoice_type"]
          updated_at: string
          vat_amount: number
          vat_rate: number
          vendor_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          from_date: string
          id?: string
          last_synced_at?: string | null
          module_id?: number
          paid_at?: string | null
          payment_terms_days: number
          rejected_at?: string | null
          rejection_reason?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          to_date: string
          total?: number
          type: Database["public"]["Enums"]["invoice_type"]
          updated_at?: string
          vat_amount?: number
          vat_rate?: number
          vendor_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          from_date?: string
          id?: string
          last_synced_at?: string | null
          module_id?: number
          paid_at?: string | null
          payment_terms_days?: number
          rejected_at?: string | null
          rejection_reason?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          to_date?: string
          total?: number
          type?: Database["public"]["Enums"]["invoice_type"]
          updated_at?: string
          vat_amount?: number
          vat_rate?: number
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          id: number
          name: string
          slug: string
        }
        Insert: {
          id: number
          name: string
          slug: string
        }
        Update: {
          id?: number
          name?: string
          slug?: string
        }
        Relationships: []
      }
      order_dish_heads: {
        Row: {
          dish_id: string
          heads: number
          order_id: string
          weekday: Database["public"]["Enums"]["weekday"]
        }
        Insert: {
          dish_id: string
          heads?: number
          order_id: string
          weekday: Database["public"]["Enums"]["weekday"]
        }
        Update: {
          dish_id?: string
          heads?: number
          order_id?: string
          weekday?: Database["public"]["Enums"]["weekday"]
        }
        Relationships: [
          {
            foreignKeyName: "order_dish_heads_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_dish_heads_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          from_date: string
          id: string
          module_id: number
          to_date: string | null
          updated_at: string
          vendor_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          from_date: string
          id?: string
          module_id?: number
          to_date?: string | null
          updated_at?: string
          vendor_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          from_date?: string
          id?: string
          module_id?: number
          to_date?: string | null
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
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
      public_holiday_exclusions: {
        Row: {
          company_id: string
          holiday_id: string
        }
        Insert: {
          company_id: string
          holiday_id: string
        }
        Update: {
          company_id?: string
          holiday_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_holiday_exclusions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_holiday_exclusions_holiday_id_fkey"
            columns: ["holiday_id"]
            isOneToOne: false
            referencedRelation: "public_holidays"
            referencedColumns: ["id"]
          },
        ]
      }
      public_holidays: {
        Row: {
          holiday_date: string
          id: string
          module_id: number | null
          name: string
        }
        Insert: {
          holiday_date: string
          id?: string
          module_id?: number | null
          name: string
        }
        Update: {
          holiday_date?: string
          id?: string
          module_id?: number | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_holidays_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      user_dish_preferences: {
        Row: {
          dish_id: string | null
          id: string
          order_id: string
          profile_id: string
          updated_at: string
          weekday: Database["public"]["Enums"]["weekday"]
        }
        Insert: {
          dish_id?: string | null
          id?: string
          order_id: string
          profile_id: string
          updated_at?: string
          weekday: Database["public"]["Enums"]["weekday"]
        }
        Update: {
          dish_id?: string | null
          id?: string
          order_id?: string
          profile_id?: string
          updated_at?: string
          weekday?: Database["public"]["Enums"]["weekday"]
        }
        Relationships: [
          {
            foreignKeyName: "user_dish_preferences_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_dish_preferences_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_dish_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      daily_order_status: "active" | "locked" | "cancelled"
      entity_status: "active" | "inactive"
      invoice_line_type: "heads" | "kickback" | "manual"
      invoice_status: "draft" | "sent" | "paid" | "rejected"
      invoice_type: "vendor_to_wopla" | "wopla_to_customer"
      weekday: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"
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
      daily_order_status: ["active", "locked", "cancelled"],
      entity_status: ["active", "inactive"],
      invoice_line_type: ["heads", "kickback", "manual"],
      invoice_status: ["draft", "sent", "paid", "rejected"],
      invoice_type: ["vendor_to_wopla", "wopla_to_customer"],
      weekday: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    },
  },
} as const

