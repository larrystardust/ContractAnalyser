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
    PostgrestVersion: "13.0.4"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
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
      analysis_results: {
        Row: {
          compliance_score: number
          contract_id: string
          created_at: string
          data_protection_impact: string | null
          executive_summary: string
          id: string
          jurisdiction_summaries: Json | null
          report_file_path: string | null
          updated_at: string
        }
        Insert: {
          compliance_score: number
          contract_id: string
          created_at?: string
          data_protection_impact?: string | null
          executive_summary: string
          id?: string
          jurisdiction_summaries?: Json | null
          report_file_path?: string | null
          updated_at?: string
        }
        Update: {
          compliance_score?: number
          contract_id?: string
          created_at?: string
          data_protection_impact?: string | null
          executive_summary?: string
          id?: string
          jurisdiction_summaries?: Json | null
          report_file_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_contract_id"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          created_at: string
          default_jurisdictions: string[]
          default_theme: string
          global_email_reports_enabled: boolean
          id: string
          is_maintenance_mode: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_jurisdictions?: string[]
          default_theme?: string
          global_email_reports_enabled?: boolean
          id?: string
          is_maintenance_mode?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_jurisdictions?: string[]
          default_theme?: string
          global_email_reports_enabled?: boolean
          id?: string
          is_maintenance_mode?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          created_at: string
          description: string
          event_type: string
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description: string
          event_type: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          contract_content: string | null
          created_at: string
          file_path: string
          id: string
          jurisdictions: string[]
          marked_for_deletion_by_admin: boolean | null
          name: string
          original_file_type: string | null
          output_language: string
          processing_progress: number | null
          size: string
          status: string
          subscription_id: string | null
          translated_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          contract_content?: string | null
          created_at?: string
          file_path: string
          id?: string
          jurisdictions: string[]
          marked_for_deletion_by_admin?: boolean | null
          name: string
          original_file_type?: string | null
          output_language?: string
          processing_progress?: number | null
          size: string
          status?: string
          subscription_id?: string | null
          translated_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          contract_content?: string | null
          created_at?: string
          file_path?: string
          id?: string
          jurisdictions?: string[]
          marked_for_deletion_by_admin?: boolean | null
          name?: string
          original_file_type?: string | null
          output_language?: string
          processing_progress?: number | null
          size?: string
          status?: string
          subscription_id?: string | null
          translated_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "stripe_subscriptions"
            referencedColumns: ["subscription_id"]
          },
          {
            foreignKeyName: "contracts_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "stripe_user_subscriptions"
            referencedColumns: ["subscription_id"]
          },
          {
            foreignKeyName: "fk_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      email_otps: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          is_used: boolean
          otp_code: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          is_used?: boolean
          otp_code: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          is_used?: boolean
          otp_code?: string
        }
        Relationships: []
      }
      findings: {
        Row: {
          analysis_result_id: string
          category: string
          clause_reference: string | null
          created_at: string
          description: string
          id: string
          jurisdiction: string
          recommendations: string[]
          risk_level: string
          title: string
          updated_at: string
        }
        Insert: {
          analysis_result_id: string
          category: string
          clause_reference?: string | null
          created_at?: string
          description: string
          id?: string
          jurisdiction: string
          recommendations: string[]
          risk_level: string
          title: string
          updated_at?: string
        }
        Update: {
          analysis_result_id?: string
          category?: string
          clause_reference?: string | null
          created_at?: string
          description?: string
          id?: string
          jurisdiction?: string
          recommendations?: string[]
          risk_level?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_analysis_result_id"
            columns: ["analysis_result_id"]
            isOneToOne: false
            referencedRelation: "analysis_results"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiries: {
        Row: {
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          message: string
          recaptcha_token: string | null
          subject: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name: string
          id?: string
          last_name: string
          message: string
          recaptcha_token?: string | null
          subject: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          message?: string
          recaptcha_token?: string | null
          subject?: string
        }
        Relationships: []
      }
      inquiry_replies: {
        Row: {
          admin_user_id: string
          created_at: string
          id: string
          inquiry_id: string
          reply_message: string
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          id?: string
          inquiry_id: string
          reply_message: string
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          id?: string
          inquiry_id?: string
          reply_message?: string
        }
        Relationships: [
          {
            foreignKeyName: "inquiry_replies_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiry_replies_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auto_start_analysis_enabled: boolean
          business_name: string | null
          country_code: string | null
          created_at: string
          default_jurisdictions: string[] | null
          email_reports_enabled: boolean
          full_name: string | null
          id: string
          is_admin: boolean | null
          language_preference: string | null
          login_at: string | null
          mobile_phone_number: string | null
          notification_settings: Json | null
          theme_preference: string
        }
        Insert: {
          auto_start_analysis_enabled?: boolean
          business_name?: string | null
          country_code?: string | null
          created_at?: string
          default_jurisdictions?: string[] | null
          email_reports_enabled?: boolean
          full_name?: string | null
          id: string
          is_admin?: boolean | null
          language_preference?: string | null
          login_at?: string | null
          mobile_phone_number?: string | null
          notification_settings?: Json | null
          theme_preference?: string
        }
        Update: {
          auto_start_analysis_enabled?: boolean
          business_name?: string | null
          country_code?: string | null
          created_at?: string
          default_jurisdictions?: string[] | null
          email_reports_enabled?: boolean
          full_name?: string | null
          id?: string
          is_admin?: boolean | null
          language_preference?: string | null
          login_at?: string | null
          mobile_phone_number?: string | null
          notification_settings?: Json | null
          theme_preference?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_customers: {
        Row: {
          created_at: string | null
          customer_id: string
          deleted_at: string | null
          id: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          deleted_at?: string | null
          id?: never
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          deleted_at?: string | null
          id?: never
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_customers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_orders: {
        Row: {
          amount_subtotal: number
          amount_total: number
          checkout_session_id: string
          created_at: string | null
          credits_remaining: number
          currency: string
          customer_id: string
          deleted_at: string | null
          id: number
          payment_intent_id: string
          payment_status: string
          price_id: string | null
          status: Database["public"]["Enums"]["stripe_order_status"]
          updated_at: string | null
        }
        Insert: {
          amount_subtotal: number
          amount_total: number
          checkout_session_id: string
          created_at?: string | null
          credits_remaining?: number
          currency: string
          customer_id: string
          deleted_at?: string | null
          id?: never
          payment_intent_id: string
          payment_status: string
          price_id?: string | null
          status?: Database["public"]["Enums"]["stripe_order_status"]
          updated_at?: string | null
        }
        Update: {
          amount_subtotal?: number
          amount_total?: number
          checkout_session_id?: string
          created_at?: string | null
          credits_remaining?: number
          currency?: string
          customer_id?: string
          deleted_at?: string | null
          id?: never
          payment_intent_id?: string
          payment_status?: string
          price_id?: string | null
          status?: Database["public"]["Enums"]["stripe_order_status"]
          updated_at?: string | null
        }
        Relationships: []
      }
      stripe_product_metadata: {
        Row: {
          created_at: string
          credits: number | null
          max_files: number | null
          max_users: number | null
          price_id: string
          product_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credits?: number | null
          max_files?: number | null
          max_users?: number | null
          price_id: string
          product_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credits?: number | null
          max_files?: number | null
          max_users?: number | null
          price_id?: string
          product_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      stripe_subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: number | null
          current_period_start: number | null
          customer_id: string
          deleted_at: string | null
          id: number
          max_files: number | null
          max_users: number | null
          payment_method_brand: string | null
          payment_method_last4: string | null
          price_id: string | null
          status: Database["public"]["Enums"]["stripe_subscription_status"]
          subscription_id: string | null
          updated_at: string | null
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: number | null
          current_period_start?: number | null
          customer_id: string
          deleted_at?: string | null
          id?: never
          max_files?: number | null
          max_users?: number | null
          payment_method_brand?: string | null
          payment_method_last4?: string | null
          price_id?: string | null
          status: Database["public"]["Enums"]["stripe_subscription_status"]
          subscription_id?: string | null
          updated_at?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: number | null
          current_period_start?: number | null
          customer_id?: string
          deleted_at?: string | null
          id?: never
          max_files?: number | null
          max_users?: number | null
          payment_method_brand?: string | null
          payment_method_last4?: string | null
          price_id?: string | null
          status?: Database["public"]["Enums"]["stripe_subscription_status"]
          subscription_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      subscription_memberships: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          id: string
          invited_at: string | null
          invited_by: string | null
          invited_email_address: string | null
          role: string
          status: string
          subscription_id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          invited_email_address?: string | null
          role?: string
          status?: string
          subscription_id: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          invited_email_address?: string | null
          role?: string
          status?: string
          subscription_id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_memberships_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_memberships_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "stripe_subscriptions"
            referencedColumns: ["subscription_id"]
          },
          {
            foreignKeyName: "subscription_memberships_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "stripe_user_subscriptions"
            referencedColumns: ["subscription_id"]
          },
          {
            foreignKeyName: "subscription_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_replies: {
        Row: {
          admin_user_id: string
          created_at: string
          id: string
          reply_message: string
          ticket_id: string
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          id?: string
          reply_message: string
          ticket_id: string
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          id?: string
          reply_message?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_replies_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_replies_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          created_at: string
          description: string
          id: string
          priority: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          priority?: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          priority?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      stripe_user_orders: {
        Row: {
          amount_subtotal: number | null
          amount_total: number | null
          checkout_session_id: string | null
          currency: string | null
          customer_id: string | null
          order_date: string | null
          order_id: number | null
          order_status:
            | Database["public"]["Enums"]["stripe_order_status"]
            | null
          payment_intent_id: string | null
          payment_status: string | null
        }
        Relationships: []
      }
      stripe_user_subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          current_period_end: number | null
          current_period_start: number | null
          customer_id: string | null
          payment_method_brand: string | null
          payment_method_last4: string | null
          price_id: string | null
          subscription_id: string | null
          subscription_status:
            | Database["public"]["Enums"]["stripe_subscription_status"]
            | null
        }
        Relationships: []
      }
      users: {
        Row: {
          aud: string | null
          created_at: string | null
          email: string | null
          email_confirmed_at: string | null
          id: string | null
          is_sso_user: boolean | null
          last_sign_in_at: string | null
          phone: string | null
          phone_confirmed_at: string | null
          raw_app_meta_data: Json | null
          raw_user_meta_data: Json | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          aud?: string | null
          created_at?: string | null
          email?: string | null
          email_confirmed_at?: string | null
          id?: string | null
          is_sso_user?: boolean | null
          last_sign_in_at?: string | null
          phone?: string | null
          phone_confirmed_at?: string | null
          raw_app_meta_data?: Json | null
          raw_user_meta_data?: Json | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          aud?: string | null
          created_at?: string | null
          email?: string | null
          email_confirmed_at?: string | null
          id?: string | null
          is_sso_user?: boolean | null
          last_sign_in_at?: string | null
          phone?: string | null
          phone_confirmed_at?: string | null
          raw_app_meta_data?: Json | null
          raw_user_meta_data?: Json | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      is_subscription_owner: {
        Args: { p_subscription_id: string; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      stripe_order_status: "pending" | "completed" | "canceled"
      stripe_subscription_status:
        | "not_started"
        | "incomplete"
        | "incomplete_expired"
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "unpaid"
        | "paused"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      stripe_order_status: ["pending", "completed", "canceled"],
      stripe_subscription_status: [
        "not_started",
        "incomplete",
        "incomplete_expired",
        "trialing",
        "active",
        "past_due",
        "canceled",
        "unpaid",
        "paused",
      ],
    },
  },
} as const