export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      analysis_results: {
        Row: {
          id: string
          contract_id: string
          executive_summary: string
          data_protection_impact: string | null
          compliance_score: number
          created_at: string
          updated_at: string
          jurisdiction_summaries: Json | null
          report_file_path: string | null
        }
        Insert: {
          id?: string
          contract_id: string
          executive_summary: string
          data_protection_impact?: string | null
          compliance_score: number
          created_at?: string
          updated_at?: string
          jurisdiction_summaries?: Json | null
          report_file_path?: string | null
        }
        Update: {
          id?: string
          contract_id?: string
          executive_summary?: string
          data_protection_impact?: string | null
          compliance_score?: number
          created_at?: string
          updated_at?: string
          jurisdiction_summaries?: Json | null
          report_file_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_contract_id"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          }
        ]
      }
      contracts: {
        Row: {
          id: string
          user_id: string
          name: string
          file_path: string
          size: string
          jurisdictions: string[]
          status: string
          processing_progress: number | null
          created_at: string
          updated_at: string
          subscription_id: string | null
          marked_for_deletion_by_admin: boolean | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          file_path: string
          size: string
          jurisdictions: string[]
          status?: string
          processing_progress?: number | null
          created_at?: string
          updated_at?: string
          subscription_id?: string | null
          marked_for_deletion_by_admin?: boolean | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          file_path?: string
          size?: string
          jurisdictions?: string[]
          status?: string
          processing_progress?: number | null
          created_at?: string
          updated_at?: string
          subscription_id?: string | null
          marked_for_deletion_by_admin?: boolean | null
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
            foreignKeyName: "fk_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      email_otps: {
        Row: {
          id: string
          email: string
          otp_code: string
          created_at: string
          expires_at: string
          is_used: boolean
        }
        Insert: {
          id?: string
          email: string
          otp_code: string
          created_at?: string
          expires_at: string
          is_used?: boolean
        }
        Update: {
          id?: string
          email?: string
          otp_code?: string
          created_at?: string
          expires_at?: string
          is_used?: boolean
        }
        Relationships: []
      }
      findings: {
        Row: {
          id: string
          analysis_result_id: string
          title: string
          description: string
          risk_level: string
          jurisdiction: string
          category: string
          recommendations: string[]
          clause_reference: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          analysis_result_id: string
          title: string
          description: string
          risk_level: string
          jurisdiction: string
          category: string
          recommendations: string[]
          clause_reference?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          analysis_result_id?: string
          title?: string
          description?: string
          risk_level?: string
          jurisdiction?: string
          category?: string
          recommendations?: string[]
          clause_reference?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_analysis_result_id"
            columns: ["analysis_result_id"]
            isOneToOne: false
            referencedRelation: "analysis_results"
            referencedColumns: ["id"]
          }
        ]
      }
      inquiries: {
        Row: {
          id: string
          first_name: string
          last_name: string
          email: string
          subject: string
          message: string
          recaptcha_token: string | null
          created_at: string
        }
        Insert: {
          id?: string
          first_name: string
          last_name: string
          email: string
          subject: string
          message: string
          recaptcha_token?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          first_name?: string
          last_name?: string
          email?: string
          subject?: string
          message?: string
          recaptcha_token?: string | null
          created_at?: string
        }
        Relationships: []
      }
      inquiry_replies: {
        Row: {
          id: string
          inquiry_id: string
          admin_user_id: string
          reply_message: string
          created_at: string
        }
        Insert: {
          id?: string
          inquiry_id: string
          admin_user_id: string
          reply_message: string
          created_at?: string
        }
        Update: {
          id?: string
          inquiry_id?: string
          admin_user_id?: string
          reply_message?: string
          created_at?: string
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
          }
        ]
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          title: string
          message: string
          type: string
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          message: string
          type?: string
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          message?: string
          type?: string
          is_read?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      profiles: {
        Row: {
          id: string
          full_name: string | null
          mobile_phone_number: string | null
          country_code: string | null
          created_at: string
          theme_preference: string
          email_reports_enabled: boolean
          default_jurisdictions: string[] | null
          notification_settings: Json | null
          is_admin: boolean | null
          login_at: string | null
          business_name: string | null
        }
        Insert: {
          id: string
          full_name?: string | null
          mobile_phone_number?: string | null
          country_code?: string | null
          created_at?: string
          theme_preference?: string
          email_reports_enabled?: boolean
          default_jurisdictions?: string[] | null
          notification_settings?: Json | null
          is_admin?: boolean | null
          login_at?: string | null
          business_name?: string | null
        }
        Update: {
          id?: string
          full_name?: string | null
          mobile_phone_number?: string | null
          country_code?: string | null
          created_at?: string
          theme_preference?: string
          email_reports_enabled?: boolean
          default_jurisdictions?: string[] | null
          notification_settings?: Json | null
          is_admin?: boolean | null
          login_at?: string | null
          business_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      stripe_customers: {
        Row: {
          id: number
          user_id: string
          customer_id: string
          created_at: string | null
          updated_at: string | null
          deleted_at: string | null
        }
        Insert: {
          id?: number
          user_id: string
          customer_id: string
          created_at?: string | null
          updated_at?: string | null
          deleted_at?: string | null
        }
        Update: {
          id?: number
          user_id?: string
          customer_id?: string
          created_at?: string | null
          updated_at?: string | null
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stripe_customers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      stripe_orders: {
        Row: {
          id: number
          checkout_session_id: string
          payment_intent_id: string
          customer_id: string
          amount_subtotal: number
          amount_total: number
          currency: string
          payment_status: string
          status: Database["public"]["Enums"]["stripe_order_status"]
          created_at: string | null
          updated_at: string | null
          deleted_at: string | null
          is_consumed: boolean
          price_id: string | null
        }
        Insert: {
          id?: number
          checkout_session_id: string
          payment_intent_id: string
          customer_id: string
          amount_subtotal: number
          amount_total: number
          currency: string
          payment_status: string
          status?: Database["public"]["Enums"]["stripe_order_status"]
          created_at?: string | null
          updated_at?: string | null
          deleted_at?: string | null
          is_consumed?: boolean
          price_id?: string | null
        }
        Update: {
          id?: number
          checkout_session_id?: string
          payment_intent_id?: string
          customer_id?: string
          amount_subtotal?: number
          amount_total?: number
          currency?: string
          payment_status?: string
          status?: Database["public"]["Enums"]["stripe_order_status"]
          created_at?: string | null
          updated_at?: string | null
          deleted_at?: string | null
          is_consumed?: boolean
          price_id?: string | null
        }
        Relationships: []
      }
      stripe_product_metadata: {
        Row: {
          price_id: string
          product_id: string
          max_users: number | null
          max_files: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          price_id: string
          product_id: string
          max_users?: number | null
          max_files?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          price_id?: string
          product_id?: string
          max_users?: number | null
          max_files?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      stripe_subscriptions: {
        Row: {
          id: number
          customer_id: string
          subscription_id: string | null
          price_id: string | null
          current_period_start: number | null
          current_period_end: number | null
          cancel_at_period_end: boolean | null
          payment_method_brand: string | null
          payment_method_last4: string | null
          status: Database["public"]["Enums"]["stripe_subscription_status"]
          created_at: string | null
          updated_at: string | null
          deleted_at: string | null
          max_users: number | null
          max_files: number | null
        }
        Insert: {
          id?: number
          customer_id: string
          subscription_id?: string | null
          price_id?: string | null
          current_period_start?: number | null
          current_period_end?: number | null
          cancel_at_period_end?: boolean | null
          payment_method_brand?: string | null
          payment_method_last4?: string | null
          status: Database["public"]["Enums"]["stripe_subscription_status"]
          created_at?: string | null
          updated_at?: string | null
          deleted_at?: string | null
          max_users?: number | null
          max_files?: number | null
        }
        Update: {
          id?: number
          customer_id?: string
          subscription_id?: string | null
          price_id?: string | null
          current_period_start?: number | null
          current_period_end?: number | null
          cancel_at_period_end?: boolean | null
          payment_method_brand?: string | null
          payment_method_last4?: string | null
          status?: Database["public"]["Enums"]["stripe_subscription_status"]
          created_at?: string | null
          updated_at?: string | null
          deleted_at?: string | null
          max_users?: number | null
          max_files?: number | null
        }
        Relationships: []
      }
      subscription_memberships: {
        Row: {
          id: string
          subscription_id: string
          user_id: string | null
          role: string
          status: string
          invited_by: string | null
          invited_at: string | null
          accepted_at: string | null
          created_at: string | null
          updated_at: string | null
          invited_email_address: string | null
        }
        Insert: {
          id?: string
          subscription_id: string
          user_id?: string | null
          role?: string
          status?: string
          invited_by?: string | null
          invited_at?: string | null
          accepted_at?: string | null
          created_at?: string | null
          updated_at?: string | null
          invited_email_address?: string | null
        }
        Update: {
          id?: string
          subscription_id?: string
          user_id?: string | null
          role?: string
          status?: string
          invited_by?: string | null
          invited_at?: string | null
          accepted_at?: string | null
          created_at?: string | null
          updated_at?: string | null
          invited_email_address?: string | null
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
            foreignKeyName: "subscription_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      support_tickets: {
        Row: {
          id: string
          user_id: string
          subject: string
          description: string
          status: string
          priority: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          subject: string
          description: string
          status?: string
          priority?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          subject?: string
          description?: string
          status?: string
          priority?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      support_ticket_replies: {
        Row: {
          id: string
          ticket_id: string
          admin_user_id: string
          reply_message: string
          created_at: string
        }
        Insert: {
          id?: string
          ticket_id: string
          admin_user_id: string
          reply_message: string
          created_at?: string
        }
        Update: {
          id?: string
          ticket_id?: string
          admin_user_id?: string
          reply_message?: string
          created_at?: string
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
          }
        ]
      }
    }
    Views: {
      stripe_user_orders: {
        Row: {
          customer_id: string | null
          order_id: number | null
          checkout_session_id: string | null
          payment_intent_id: string | null
          amount_subtotal: number | null
          amount_total: number | null
          currency: string | null
          payment_status: string | null
          order_status: Database["public"]["Enums"]["stripe_order_status"] | null
          order_date: string | null
        }
        Relationships: []
      }
      stripe_user_subscriptions: {
        Row: {
          customer_id: string | null
          subscription_id: string | null
          subscription_status: Database["public"]["Enums"]["stripe_subscription_status"] | null
          price_id: string | null
          current_period_start: number | null
          current_period_end: number | null
          cancel_at_period_end: boolean | null
          payment_method_brand: string | null
          payment_method_last4: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          id: string | null
          aud: string | null
          role: string | null
          email: string | null
          email_confirmed_at: string | null
          phone: string | null
          phone_confirmed_at: string | null
          last_sign_in_at: string | null
          raw_app_meta_data: Json | null
          raw_user_meta_data: Json | null
          is_sso_user: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string | null
          aud?: string | null
          role?: string | null
          email?: string | null
          email_confirmed_at?: string | null
          phone?: string | null
          phone_confirmed_at?: string | null
          last_sign_in_at?: string | null
          raw_app_meta_data?: Json | null
          raw_user_meta_data?: Json | null
          is_sso_user?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string | null
          aud?: string | null
          role?: string | null
          email?: string | null
          email_confirmed_at?: string | null
          phone?: string | null
          phone_confirmed_at?: string | null
          last_sign_in_at?: string | null
          raw_app_meta_data?: Json | null
          raw_user_meta_data?: Json | null
          is_sso_user?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      is_subscription_owner: {
        Args: {
          p_user_id: string
          p_subscription_id: string
        }
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

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never