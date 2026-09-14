export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      agencies: {
        Row: {
          city: string | null
          created_at: string
          default_leeway_m: number
          default_radius_m: number
          digest_time: string
          half_day_ratio: number
          id: string
          late_threshold_min: number
          location_off_warn_min: number
          logo_path: string | null
          max_guards: number | null
          name: string
          notes: string | null
          outage_threshold_min: number
          plan: string
          selfie_retention_days: number
          slug: string
          staleness_min: number
          status: Database["public"]["Enums"]["agency_status"]
          suspended_at: string | null
          suspended_reason: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          default_leeway_m?: number
          default_radius_m?: number
          digest_time?: string
          half_day_ratio?: number
          id?: string
          late_threshold_min?: number
          location_off_warn_min?: number
          logo_path?: string | null
          max_guards?: number | null
          name: string
          notes?: string | null
          outage_threshold_min?: number
          plan?: string
          selfie_retention_days?: number
          slug: string
          staleness_min?: number
          status?: Database["public"]["Enums"]["agency_status"]
          suspended_at?: string | null
          suspended_reason?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          default_leeway_m?: number
          default_radius_m?: number
          digest_time?: string
          half_day_ratio?: number
          id?: string
          late_threshold_min?: number
          location_off_warn_min?: number
          logo_path?: string | null
          max_guards?: number | null
          name?: string
          notes?: string | null
          outage_threshold_min?: number
          plan?: string
          selfie_retention_days?: number
          slug?: string
          staleness_min?: number
          status?: Database["public"]["Enums"]["agency_status"]
          suspended_at?: string | null
          suspended_reason?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_config: {
        Row: {
          agency_id: string
          features: Json
          min_app_version: string
          ota_channel: string
          photo_max_kb: number
          ping_interval_moving_s: number
          ping_interval_stationary_s: number
          selfie_max_kb: number
          updated_at: string
        }
        Insert: {
          agency_id: string
          features?: Json
          min_app_version?: string
          ota_channel?: string
          photo_max_kb?: number
          ping_interval_moving_s?: number
          ping_interval_stationary_s?: number
          selfie_max_kb?: number
          updated_at?: string
        }
        Update: {
          agency_id?: string
          features?: Json
          min_app_version?: string
          ota_channel?: string
          photo_max_kb?: number
          ping_interval_moving_s?: number
          ping_interval_stationary_s?: number
          selfie_max_kb?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_config_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: true
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          agency_id: string
          before: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          platform_actor_id: string | null
          reason: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          agency_id: string
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: number
          platform_actor_id?: string | null
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          agency_id?: string
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: number
          platform_actor_id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_platform_actor_id_fkey"
            columns: ["platform_actor_id"]
            isOneToOne: false
            referencedRelation: "platform_admins"
            referencedColumns: ["user_id"]
          },
        ]
      }
      devices: {
        Row: {
          agency_id: string
          app_version: string | null
          bundle_version: string | null
          created_at: string
          device_model: string | null
          fcm_token: string | null
          guard_id: string | null
          id: string
          last_seen_at: string
          os_version: string | null
          platform: string
          profile_id: string | null
        }
        Insert: {
          agency_id: string
          app_version?: string | null
          bundle_version?: string | null
          created_at?: string
          device_model?: string | null
          fcm_token?: string | null
          guard_id?: string | null
          id?: string
          last_seen_at?: string
          os_version?: string | null
          platform?: string
          profile_id?: string | null
        }
        Update: {
          agency_id?: string
          app_version?: string | null
          bundle_version?: string | null
          created_at?: string
          device_model?: string | null
          fcm_token?: string | null
          guard_id?: string | null
          id?: string
          last_seen_at?: string
          os_version?: string | null
          platform?: string
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devices_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: false
            referencedRelation: "guards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_access_logs: {
        Row: {
          accessed_by: string | null
          agency_id: string
          created_at: string
          document_id: string
          id: number
          ip: string | null
          purpose: string | null
          share_id: string | null
        }
        Insert: {
          accessed_by?: string | null
          agency_id: string
          created_at?: string
          document_id: string
          id?: number
          ip?: string | null
          purpose?: string | null
          share_id?: string | null
        }
        Update: {
          accessed_by?: string | null
          agency_id?: string
          created_at?: string
          document_id?: string
          id?: number
          ip?: string | null
          purpose?: string | null
          share_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_access_logs_accessed_by_fkey"
            columns: ["accessed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_access_logs_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_access_logs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "guard_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          agency_id: string
          created_at: string
          guard_id: string | null
          id: string
          payload: Json
          severity: Database["public"]["Enums"]["event_severity"]
          shift_id: string | null
          site_id: string | null
          title: string
          type: Database["public"]["Enums"]["event_type"]
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          agency_id: string
          created_at?: string
          guard_id?: string | null
          id?: string
          payload?: Json
          severity?: Database["public"]["Enums"]["event_severity"]
          shift_id?: string | null
          site_id?: string | null
          title: string
          type: Database["public"]["Enums"]["event_type"]
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          agency_id?: string
          created_at?: string
          guard_id?: string | null
          id?: string
          payload?: Json
          severity?: Database["public"]["Enums"]["event_severity"]
          shift_id?: string | null
          site_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["event_type"]
        }
        Relationships: [
          {
            foreignKeyName: "events_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: false
            referencedRelation: "guards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      guard_documents: {
        Row: {
          agency_id: string
          created_at: string
          expires_on: string | null
          file_path: string | null
          guard_id: string
          id: string
          issued_on: string | null
          mime_type: string | null
          number_masked: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["document_status"]
          type: Database["public"]["Enums"]["document_type"]
          updated_at: string
          uploaded_by: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          agency_id: string
          created_at?: string
          expires_on?: string | null
          file_path?: string | null
          guard_id: string
          id?: string
          issued_on?: string | null
          mime_type?: string | null
          number_masked?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          type: Database["public"]["Enums"]["document_type"]
          updated_at?: string
          uploaded_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          agency_id?: string
          created_at?: string
          expires_on?: string | null
          file_path?: string | null
          guard_id?: string
          id?: string
          issued_on?: string | null
          mime_type?: string | null
          number_masked?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          type?: Database["public"]["Enums"]["document_type"]
          updated_at?: string
          uploaded_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guard_documents_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guard_documents_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: false
            referencedRelation: "guards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guard_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guard_documents_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guard_invites: {
        Row: {
          accepted_at: string | null
          agency_id: string
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          created_by: string | null
          expires_at: string
          guard_id: string
          id: string
          sent_at: string | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          agency_id: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          created_by?: string | null
          expires_at?: string
          guard_id: string
          id?: string
          sent_at?: string | null
          token?: string
        }
        Update: {
          accepted_at?: string | null
          agency_id?: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          created_by?: string | null
          expires_at?: string
          guard_id?: string
          id?: string
          sent_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "guard_invites_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guard_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guard_invites_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: false
            referencedRelation: "guards"
            referencedColumns: ["id"]
          },
        ]
      }
      guard_presence: {
        Row: {
          accuracy_m: number | null
          agency_id: string
          battery_pct: number | null
          guard_id: string
          in_fence: boolean | null
          is_mock: boolean
          last_seen_at: string | null
          lat: number | null
          lng: number | null
          location_enabled: boolean
          shift_id: string | null
          site_id: string | null
          updated_at: string
        }
        Insert: {
          accuracy_m?: number | null
          agency_id: string
          battery_pct?: number | null
          guard_id: string
          in_fence?: boolean | null
          is_mock?: boolean
          last_seen_at?: string | null
          lat?: number | null
          lng?: number | null
          location_enabled?: boolean
          shift_id?: string | null
          site_id?: string | null
          updated_at?: string
        }
        Update: {
          accuracy_m?: number | null
          agency_id?: string
          battery_pct?: number | null
          guard_id?: string
          in_fence?: boolean | null
          is_mock?: boolean
          last_seen_at?: string | null
          lat?: number | null
          lng?: number | null
          location_enabled?: boolean
          shift_id?: string | null
          site_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guard_presence_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guard_presence_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: true
            referencedRelation: "guards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guard_presence_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guard_presence_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      guards: {
        Row: {
          address: string | null
          agency_id: string
          created_at: string
          date_of_birth: string | null
          designation: string | null
          emergency_contact: string | null
          employee_code: string | null
          full_name: string
          id: string
          invited_at: string | null
          joined_at: string | null
          languages: string[]
          phone: string
          phone_verified_at: string | null
          pin_hash: string | null
          profile_id: string | null
          registration_selfie_path: string | null
          site_id: string | null
          status: Database["public"]["Enums"]["guard_status"]
          supervisor_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          agency_id: string
          created_at?: string
          date_of_birth?: string | null
          designation?: string | null
          emergency_contact?: string | null
          employee_code?: string | null
          full_name: string
          id?: string
          invited_at?: string | null
          joined_at?: string | null
          languages?: string[]
          phone: string
          phone_verified_at?: string | null
          pin_hash?: string | null
          profile_id?: string | null
          registration_selfie_path?: string | null
          site_id?: string | null
          status?: Database["public"]["Enums"]["guard_status"]
          supervisor_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          agency_id?: string
          created_at?: string
          date_of_birth?: string | null
          designation?: string | null
          emergency_contact?: string | null
          employee_code?: string | null
          full_name?: string
          id?: string
          invited_at?: string | null
          joined_at?: string | null
          languages?: string[]
          phone?: string
          phone_verified_at?: string | null
          pin_hash?: string | null
          profile_id?: string | null
          registration_selfie_path?: string | null
          site_id?: string | null
          status?: Database["public"]["Enums"]["guard_status"]
          supervisor_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guards_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guards_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guards_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guards_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_balances: {
        Row: {
          agency_id: string
          casual_total: number
          casual_used: number
          earned_total: number
          earned_used: number
          guard_id: string
          unpaid_used: number
          year: number
        }
        Insert: {
          agency_id: string
          casual_total?: number
          casual_used?: number
          earned_total?: number
          earned_used?: number
          guard_id: string
          unpaid_used?: number
          year: number
        }
        Update: {
          agency_id?: string
          casual_total?: number
          casual_used?: number
          earned_total?: number
          earned_used?: number
          guard_id?: string
          unpaid_used?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_balances_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: false
            referencedRelation: "guards"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          agency_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          end_date: string
          guard_id: string
          id: string
          reason: string | null
          site_id: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_status"]
          type: Database["public"]["Enums"]["leave_type"]
        }
        Insert: {
          agency_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          end_date: string
          guard_id: string
          id?: string
          reason?: string | null
          site_id?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["leave_status"]
          type?: Database["public"]["Enums"]["leave_type"]
        }
        Update: {
          agency_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          end_date?: string
          guard_id?: string
          id?: string
          reason?: string | null
          site_id?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["leave_status"]
          type?: Database["public"]["Enums"]["leave_type"]
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: false
            referencedRelation: "guards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      location_pings: {
        Row: {
          accuracy_m: number | null
          agency_id: string
          battery_pct: number | null
          distance_m: number | null
          guard_id: string
          id: number
          in_fence: boolean | null
          is_mock: boolean
          lat: number
          lng: number
          received_at: string
          recorded_at: string
          shift_id: string | null
          speed_mps: number | null
        }
        Insert: {
          accuracy_m?: number | null
          agency_id: string
          battery_pct?: number | null
          distance_m?: number | null
          guard_id: string
          id?: number
          in_fence?: boolean | null
          is_mock?: boolean
          lat: number
          lng: number
          received_at?: string
          recorded_at: string
          shift_id?: string | null
          speed_mps?: number | null
        }
        Update: {
          accuracy_m?: number | null
          agency_id?: string
          battery_pct?: number | null
          distance_m?: number | null
          guard_id?: string
          id?: number
          in_fence?: boolean | null
          is_mock?: boolean
          lat?: number
          lng?: number
          received_at?: string
          recorded_at?: string
          shift_id?: string | null
          speed_mps?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "location_pings_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_pings_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: false
            referencedRelation: "guards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_pings_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          agency_id: string
          daily_digest: boolean
          fence_exit: boolean
          late_start: boolean
          leave_requests: boolean
          location_off: boolean
          outage: boolean
          patrol_missed: boolean
          profile_id: string
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          agency_id: string
          daily_digest?: boolean
          fence_exit?: boolean
          late_start?: boolean
          leave_requests?: boolean
          location_off?: boolean
          outage?: boolean
          patrol_missed?: boolean
          profile_id: string
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          agency_id?: string
          daily_digest?: boolean
          fence_exit?: boolean
          late_start?: boolean
          leave_requests?: boolean
          location_off?: boolean
          outage?: boolean
          patrol_missed?: boolean
          profile_id?: string
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          agency_id: string
          body: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          event_id: string | null
          id: string
          payload: Json
          read_at: string | null
          recipient_guard_id: string | null
          recipient_profile_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          title: string
        }
        Insert: {
          agency_id: string
          body?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          event_id?: string | null
          id?: string
          payload?: Json
          read_at?: string | null
          recipient_guard_id?: string | null
          recipient_profile_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          title: string
        }
        Update: {
          agency_id?: string
          body?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          event_id?: string | null
          id?: string
          payload?: Json
          read_at?: string | null
          recipient_guard_id?: string | null
          recipient_profile_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_guard_id_fkey"
            columns: ["recipient_guard_id"]
            isOneToOne: false
            referencedRelation: "guards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_profile_id_fkey"
            columns: ["recipient_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patrol_photos: {
        Row: {
          agency_id: string
          caption: string | null
          file_path: string
          id: string
          lat: number | null
          lng: number | null
          patrol_id: string
          taken_at: string
        }
        Insert: {
          agency_id: string
          caption?: string | null
          file_path: string
          id?: string
          lat?: number | null
          lng?: number | null
          patrol_id: string
          taken_at?: string
        }
        Update: {
          agency_id?: string
          caption?: string | null
          file_path?: string
          id?: string
          lat?: number | null
          lng?: number | null
          patrol_id?: string
          taken_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patrol_photos_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patrol_photos_patrol_id_fkey"
            columns: ["patrol_id"]
            isOneToOne: false
            referencedRelation: "patrols"
            referencedColumns: ["id"]
          },
        ]
      }
      patrol_routes: {
        Row: {
          agency_id: string
          created_at: string
          created_by: string | null
          description: string | null
          frequency_min: number
          grace_min: number
          id: string
          is_active: boolean
          min_photos: number
          name: string
          shift_type_id: string | null
          site_id: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          frequency_min?: number
          grace_min?: number
          id?: string
          is_active?: boolean
          min_photos?: number
          name: string
          shift_type_id?: string | null
          site_id: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          frequency_min?: number
          grace_min?: number
          id?: string
          is_active?: boolean
          min_photos?: number
          name?: string
          shift_type_id?: string | null
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patrol_routes_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patrol_routes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patrol_routes_shift_type_id_fkey"
            columns: ["shift_type_id"]
            isOneToOne: false
            referencedRelation: "shift_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patrol_routes_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      patrols: {
        Row: {
          agency_id: string
          created_at: string
          distance_m: number | null
          duration_s: number | null
          ended_at: string | null
          expected_at: string | null
          guard_id: string
          id: string
          notes: string | null
          route_id: string | null
          shift_id: string | null
          site_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["patrol_status"]
          trail: Json | null
        }
        Insert: {
          agency_id: string
          created_at?: string
          distance_m?: number | null
          duration_s?: number | null
          ended_at?: string | null
          expected_at?: string | null
          guard_id: string
          id?: string
          notes?: string | null
          route_id?: string | null
          shift_id?: string | null
          site_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["patrol_status"]
          trail?: Json | null
        }
        Update: {
          agency_id?: string
          created_at?: string
          distance_m?: number | null
          duration_s?: number | null
          ended_at?: string | null
          expected_at?: string | null
          guard_id?: string
          id?: string
          notes?: string | null
          route_id?: string | null
          shift_id?: string | null
          site_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["patrol_status"]
          trail?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "patrols_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patrols_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: false
            referencedRelation: "guards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patrols_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "patrol_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patrols_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patrols_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_catalogue: {
        Row: {
          action: string
          description: string
          key: string
          label: string
          resource: string
          sort: number
        }
        Insert: {
          action: string
          description: string
          key: string
          label: string
          resource: string
          sort: number
        }
        Update: {
          action?: string
          description?: string
          key?: string
          label?: string
          resource?: string
          sort?: number
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          email: string
          full_name: string
          role: Database["public"]["Enums"]["platform_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          role?: Database["public"]["Enums"]["platform_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          role?: Database["public"]["Enums"]["platform_role"]
          user_id?: string
        }
        Relationships: []
      }
      profile_shares: {
        Row: {
          agency_id: string
          created_at: string
          created_by: string | null
          expires_at: string
          guard_id: string
          id: string
          include_documents: boolean
          label: string | null
          last_viewed_at: string | null
          revoked_at: string | null
          token: string
          view_count: number
        }
        Insert: {
          agency_id: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          guard_id: string
          id?: string
          include_documents?: boolean
          label?: string | null
          last_viewed_at?: string | null
          revoked_at?: string | null
          token?: string
          view_count?: number
        }
        Update: {
          agency_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          guard_id?: string
          id?: string
          include_documents?: boolean
          label?: string | null
          last_viewed_at?: string | null
          revoked_at?: string | null
          token?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "profile_shares_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_shares_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_shares_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: false
            referencedRelation: "guards"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          agency_id: string
          all_sites: boolean
          avatar_path: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          role_id: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          all_sites?: boolean
          avatar_path?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          role_id?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          all_sites?: boolean
          avatar_path?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          role_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          agency_id: string
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          name: string
          permissions: string[]
          system_key: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          permissions?: string[]
          system_key?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          permissions?: string[]
          system_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      roster_patterns: {
        Row: {
          agency_id: string
          created_at: string
          created_by: string | null
          ends_on: string | null
          guard_id: string
          id: string
          shift_type_id: string
          site_id: string
          starts_on: string
          weekdays: number[]
        }
        Insert: {
          agency_id: string
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          guard_id: string
          id?: string
          shift_type_id: string
          site_id: string
          starts_on?: string
          weekdays?: number[]
        }
        Update: {
          agency_id?: string
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          guard_id?: string
          id?: string
          shift_type_id?: string
          site_id?: string
          starts_on?: string
          weekdays?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "roster_patterns_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_patterns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_patterns_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: false
            referencedRelation: "guards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_patterns_shift_type_id_fkey"
            columns: ["shift_type_id"]
            isOneToOne: false
            referencedRelation: "shift_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_patterns_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_assignments: {
        Row: {
          agency_id: string
          created_at: string
          created_by: string | null
          guard_id: string
          id: string
          pattern_id: string | null
          scheduled_end: string
          scheduled_start: string
          shift_date: string
          shift_type_id: string
          site_id: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          created_by?: string | null
          guard_id: string
          id?: string
          pattern_id?: string | null
          scheduled_end: string
          scheduled_start: string
          shift_date: string
          shift_type_id: string
          site_id: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          created_by?: string | null
          guard_id?: string
          id?: string
          pattern_id?: string | null
          scheduled_end?: string
          scheduled_start?: string
          shift_date?: string
          shift_type_id?: string
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_assignments_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_assignments_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: false
            referencedRelation: "guards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_assignments_pattern_id_fkey"
            columns: ["pattern_id"]
            isOneToOne: false
            referencedRelation: "roster_patterns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_assignments_shift_type_id_fkey"
            columns: ["shift_type_id"]
            isOneToOne: false
            referencedRelation: "shift_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_assignments_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_exceptions: {
        Row: {
          agency_id: string
          category: string
          created_at: string
          id: string
          logged_by: string
          reason: string
          shift_id: string
        }
        Insert: {
          agency_id: string
          category?: string
          created_at?: string
          id?: string
          logged_by: string
          reason: string
          shift_id: string
        }
        Update: {
          agency_id?: string
          category?: string
          created_at?: string
          id?: string
          logged_by?: string
          reason?: string
          shift_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_exceptions_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_exceptions_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_exceptions_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_types: {
        Row: {
          agency_id: string
          created_at: string
          end_time: string
          guards_required: number
          id: string
          is_active: boolean
          name: string
          site_id: string
          start_time: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          end_time: string
          guards_required?: number
          id?: string
          is_active?: boolean
          name: string
          site_id: string
          start_time: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          end_time?: string
          guards_required?: number
          id?: string
          is_active?: boolean
          name?: string
          site_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_types_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_types_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          agency_id: string
          assignment_id: string | null
          attendance: Database["public"]["Enums"]["attendance_status"]
          away_seconds: number
          created_at: string
          device: Json
          end_accuracy_m: number | null
          end_captured_at: string | null
          end_in_fence: boolean | null
          end_lat: number | null
          end_lng: number | null
          end_selfie_path: string | null
          ended_at: string | null
          exception_id: string | null
          flags: string[]
          guard_id: string
          id: string
          last_warned_at: string | null
          late_by_min: number
          location_enabled: boolean
          location_off_seconds: number
          location_off_since: string | null
          override_at: string | null
          override_attendance:
            | Database["public"]["Enums"]["attendance_status"]
            | null
          override_by: string | null
          override_reason: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          shift_date: string
          shift_type_id: string | null
          site_id: string
          start_accuracy_m: number | null
          start_captured_at: string | null
          start_distance_m: number | null
          start_in_fence: boolean | null
          start_lat: number | null
          start_lng: number | null
          start_selfie_path: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["shift_status"]
          trust: Database["public"]["Enums"]["trust_level"] | null
          updated_at: string
          worked_minutes: number
        }
        Insert: {
          agency_id: string
          assignment_id?: string | null
          attendance?: Database["public"]["Enums"]["attendance_status"]
          away_seconds?: number
          created_at?: string
          device?: Json
          end_accuracy_m?: number | null
          end_captured_at?: string | null
          end_in_fence?: boolean | null
          end_lat?: number | null
          end_lng?: number | null
          end_selfie_path?: string | null
          ended_at?: string | null
          exception_id?: string | null
          flags?: string[]
          guard_id: string
          id?: string
          last_warned_at?: string | null
          late_by_min?: number
          location_enabled?: boolean
          location_off_seconds?: number
          location_off_since?: string | null
          override_at?: string | null
          override_attendance?:
            | Database["public"]["Enums"]["attendance_status"]
            | null
          override_by?: string | null
          override_reason?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          shift_date: string
          shift_type_id?: string | null
          site_id: string
          start_accuracy_m?: number | null
          start_captured_at?: string | null
          start_distance_m?: number | null
          start_in_fence?: boolean | null
          start_lat?: number | null
          start_lng?: number | null
          start_selfie_path?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["shift_status"]
          trust?: Database["public"]["Enums"]["trust_level"] | null
          updated_at?: string
          worked_minutes?: number
        }
        Update: {
          agency_id?: string
          assignment_id?: string | null
          attendance?: Database["public"]["Enums"]["attendance_status"]
          away_seconds?: number
          created_at?: string
          device?: Json
          end_accuracy_m?: number | null
          end_captured_at?: string | null
          end_in_fence?: boolean | null
          end_lat?: number | null
          end_lng?: number | null
          end_selfie_path?: string | null
          ended_at?: string | null
          exception_id?: string | null
          flags?: string[]
          guard_id?: string
          id?: string
          last_warned_at?: string | null
          late_by_min?: number
          location_enabled?: boolean
          location_off_seconds?: number
          location_off_since?: string | null
          override_at?: string | null
          override_attendance?:
            | Database["public"]["Enums"]["attendance_status"]
            | null
          override_by?: string | null
          override_reason?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          shift_date?: string
          shift_type_id?: string | null
          site_id?: string
          start_accuracy_m?: number | null
          start_captured_at?: string | null
          start_distance_m?: number | null
          start_in_fence?: boolean | null
          start_lat?: number | null
          start_lng?: number | null
          start_selfie_path?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["shift_status"]
          trust?: Database["public"]["Enums"]["trust_level"] | null
          updated_at?: string
          worked_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "shifts_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: true
            referencedRelation: "shift_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_exception_fk"
            columns: ["exception_id"]
            isOneToOne: false
            referencedRelation: "shift_exceptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: false
            referencedRelation: "guards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_override_by_fkey"
            columns: ["override_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_shift_type_id_fkey"
            columns: ["shift_type_id"]
            isOneToOne: false
            referencedRelation: "shift_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          address: string | null
          agency_id: string
          city: string | null
          client_name: string | null
          created_at: string
          fence_type: Database["public"]["Enums"]["fence_type"]
          geom: unknown
          guards_required: number
          id: string
          is_active: boolean
          lat: number
          leeway_m: number
          lng: number
          name: string
          notes: string | null
          patrol_photo_required: boolean
          polygon: Json | null
          radius_m: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          agency_id: string
          city?: string | null
          client_name?: string | null
          created_at?: string
          fence_type?: Database["public"]["Enums"]["fence_type"]
          geom?: unknown
          guards_required?: number
          id?: string
          is_active?: boolean
          lat: number
          leeway_m?: number
          lng: number
          name: string
          notes?: string | null
          patrol_photo_required?: boolean
          polygon?: Json | null
          radius_m?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          agency_id?: string
          city?: string | null
          client_name?: string | null
          created_at?: string
          fence_type?: Database["public"]["Enums"]["fence_type"]
          geom?: unknown
          guards_required?: number
          id?: string
          is_active?: boolean
          lat?: number
          leeway_m?: number
          lng?: number
          name?: string
          notes?: string | null
          patrol_photo_required?: boolean
          polygon?: Json | null
          radius_m?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sites_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      supervisor_sites: {
        Row: {
          agency_id: string
          profile_id: string
          site_id: string
        }
        Insert: {
          agency_id: string
          profile_id: string
          site_id: string
        }
        Update: {
          agency_id?: string
          profile_id?: string
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supervisor_sites_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisor_sites_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisor_sites_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      task_assignments: {
        Row: {
          agency_id: string
          completed_at: string | null
          guard_id: string
          lat: number | null
          lng: number | null
          note: string | null
          photo_path: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["task_status"]
          task_id: string
        }
        Insert: {
          agency_id: string
          completed_at?: string | null
          guard_id: string
          lat?: number | null
          lng?: number | null
          note?: string | null
          photo_path?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_id: string
        }
        Update: {
          agency_id?: string
          completed_at?: string | null
          guard_id?: string
          lat?: number | null
          lng?: number | null
          note?: string | null
          photo_path?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignments_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignments_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: false
            referencedRelation: "guards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_templates: {
        Row: {
          agency_id: string | null
          created_at: string
          description: string | null
          id: string
          key: string | null
          photo_required: boolean
          title: string
        }
        Insert: {
          agency_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          key?: string | null
          photo_required?: boolean
          title: string
        }
        Update: {
          agency_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          key?: string | null
          photo_required?: boolean
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_templates_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          agency_id: string
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string | null
          id: string
          photo_required: boolean
          site_id: string
          status: Database["public"]["Enums"]["task_status"]
          template_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          photo_required?: boolean
          site_id: string
          status?: Database["public"]["Enums"]["task_status"]
          template_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          photo_required?: boolean
          site_id?: string
          status?: Database["public"]["Enums"]["task_status"]
          template_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "task_templates"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accessible_site_ids: { Args: never; Returns: string[] }
      attendance_trend: {
        Args: {
          p_agency_id: string
          p_from: string
          p_site_id?: string
          p_to: string
        }
        Returns: {
          absent: number
          day: string
          flagged: number
          half_day: number
          on_leave: number
          present: number
          scheduled: number
        }[]
      }
      can_access_site: { Args: { p_site_id: string }; Returns: boolean }
      check_in: {
        Args: {
          p_accuracy_m: number
          p_captured_at?: string
          p_device?: Json
          p_guard_id: string
          p_lat: number
          p_lng: number
          p_selfie_path: string
          p_shift_id?: string
          p_site_id: string
        }
        Returns: {
          agency_id: string
          assignment_id: string | null
          attendance: Database["public"]["Enums"]["attendance_status"]
          away_seconds: number
          created_at: string
          device: Json
          end_accuracy_m: number | null
          end_captured_at: string | null
          end_in_fence: boolean | null
          end_lat: number | null
          end_lng: number | null
          end_selfie_path: string | null
          ended_at: string | null
          exception_id: string | null
          flags: string[]
          guard_id: string
          id: string
          last_warned_at: string | null
          late_by_min: number
          location_enabled: boolean
          location_off_seconds: number
          location_off_since: string | null
          override_at: string | null
          override_attendance:
            | Database["public"]["Enums"]["attendance_status"]
            | null
          override_by: string | null
          override_reason: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          shift_date: string
          shift_type_id: string | null
          site_id: string
          start_accuracy_m: number | null
          start_captured_at: string | null
          start_distance_m: number | null
          start_in_fence: boolean | null
          start_lat: number | null
          start_lng: number | null
          start_selfie_path: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["shift_status"]
          trust: Database["public"]["Enums"]["trust_level"] | null
          updated_at: string
          worked_minutes: number
        }
        SetofOptions: {
          from: "*"
          to: "shifts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      check_out: {
        Args: {
          p_accuracy_m: number
          p_captured_at?: string
          p_device?: Json
          p_lat: number
          p_lng: number
          p_selfie_path: string
          p_shift_id: string
        }
        Returns: {
          agency_id: string
          assignment_id: string | null
          attendance: Database["public"]["Enums"]["attendance_status"]
          away_seconds: number
          created_at: string
          device: Json
          end_accuracy_m: number | null
          end_captured_at: string | null
          end_in_fence: boolean | null
          end_lat: number | null
          end_lng: number | null
          end_selfie_path: string | null
          ended_at: string | null
          exception_id: string | null
          flags: string[]
          guard_id: string
          id: string
          last_warned_at: string | null
          late_by_min: number
          location_enabled: boolean
          location_off_seconds: number
          location_off_since: string | null
          override_at: string | null
          override_attendance:
            | Database["public"]["Enums"]["attendance_status"]
            | null
          override_by: string | null
          override_reason: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          shift_date: string
          shift_type_id: string | null
          site_id: string
          start_accuracy_m: number | null
          start_captured_at: string | null
          start_distance_m: number | null
          start_in_fence: boolean | null
          start_lat: number | null
          start_lng: number | null
          start_selfie_path: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["shift_status"]
          trust: Database["public"]["Enums"]["trust_level"] | null
          updated_at: string
          worked_minutes: number
        }
        SetofOptions: {
          from: "*"
          to: "shifts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_patrol: {
        Args: {
          p_at?: string
          p_notes?: string
          p_patrol_id: string
          p_photos?: Json
          p_trail: Json
        }
        Returns: {
          agency_id: string
          created_at: string
          distance_m: number | null
          duration_s: number | null
          ended_at: string | null
          expected_at: string | null
          guard_id: string
          id: string
          notes: string | null
          route_id: string | null
          shift_id: string | null
          site_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["patrol_status"]
          trail: Json | null
        }
        SetofOptions: {
          from: "*"
          to: "patrols"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      compute_attendance: {
        Args: { p_shift_id: string }
        Returns: Database["public"]["Enums"]["attendance_status"]
      }
      compute_trust: {
        Args: {
          p_accuracy: number
          p_battery: number
          p_flags: string[]
          p_mock: boolean
        }
        Returns: Database["public"]["Enums"]["trust_level"]
      }
      current_agency_id: { Args: never; Returns: string }
      current_guard_id: { Args: never; Returns: string }
      current_permissions: { Args: never; Returns: string[] }
      current_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      decide_leave: {
        Args: { p_approve: boolean; p_leave_id: string; p_note?: string }
        Returns: {
          agency_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          end_date: string
          guard_id: string
          id: string
          reason: string | null
          site_id: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_status"]
          type: Database["public"]["Enums"]["leave_type"]
        }
        SetofOptions: {
          from: "*"
          to: "leave_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      emit_event: {
        Args: {
          p_agency_id: string
          p_guard_id: string
          p_payload?: Json
          p_severity: Database["public"]["Enums"]["event_severity"]
          p_shift_id: string
          p_site_id: string
          p_title: string
          p_type: Database["public"]["Enums"]["event_type"]
        }
        Returns: string
      }
      guard_is_assigned_to_task: {
        Args: { p_task_id: string }
        Returns: boolean
      }
      guard_kyc_complete: { Args: { p_guard_id: string }; Returns: boolean }
      guard_kyc_missing: { Args: { p_guard_id: string }; Returns: string[] }
      guard_scorecard: {
        Args: { p_from: string; p_guard_id: string; p_to: string }
        Returns: Json
      }
      has_permission: { Args: { p_key: string }; Returns: boolean }
      ingest_pings: {
        Args: { p_pings: Json; p_shift_id: string }
        Returns: number
      }
      is_in_fence: {
        Args: { p_lat: number; p_lng: number; p_site_id: string }
        Returns: boolean
      }
      is_manager: { Args: never; Returns: boolean }
      is_owner: { Args: never; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      log_shift_exception: {
        Args: { p_category?: string; p_reason: string; p_shift_id: string }
        Returns: {
          agency_id: string
          assignment_id: string | null
          attendance: Database["public"]["Enums"]["attendance_status"]
          away_seconds: number
          created_at: string
          device: Json
          end_accuracy_m: number | null
          end_captured_at: string | null
          end_in_fence: boolean | null
          end_lat: number | null
          end_lng: number | null
          end_selfie_path: string | null
          ended_at: string | null
          exception_id: string | null
          flags: string[]
          guard_id: string
          id: string
          last_warned_at: string | null
          late_by_min: number
          location_enabled: boolean
          location_off_seconds: number
          location_off_since: string | null
          override_at: string | null
          override_attendance:
            | Database["public"]["Enums"]["attendance_status"]
            | null
          override_by: string | null
          override_reason: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          shift_date: string
          shift_type_id: string | null
          site_id: string
          start_accuracy_m: number | null
          start_captured_at: string | null
          start_distance_m: number | null
          start_in_fence: boolean | null
          start_lat: number | null
          start_lng: number | null
          start_selfie_path: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["shift_status"]
          trust: Database["public"]["Enums"]["trust_level"] | null
          updated_at: string
          worked_minutes: number
        }
        SetofOptions: {
          from: "*"
          to: "shifts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      materialize_roster: {
        Args: { p_agency_id: string; p_from: string; p_to: string }
        Returns: number
      }
      override_attendance: {
        Args: {
          p_attendance: Database["public"]["Enums"]["attendance_status"]
          p_reason: string
          p_shift_id: string
        }
        Returns: {
          agency_id: string
          assignment_id: string | null
          attendance: Database["public"]["Enums"]["attendance_status"]
          away_seconds: number
          created_at: string
          device: Json
          end_accuracy_m: number | null
          end_captured_at: string | null
          end_in_fence: boolean | null
          end_lat: number | null
          end_lng: number | null
          end_selfie_path: string | null
          ended_at: string | null
          exception_id: string | null
          flags: string[]
          guard_id: string
          id: string
          last_warned_at: string | null
          late_by_min: number
          location_enabled: boolean
          location_off_seconds: number
          location_off_since: string | null
          override_at: string | null
          override_attendance:
            | Database["public"]["Enums"]["attendance_status"]
            | null
          override_by: string | null
          override_reason: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          shift_date: string
          shift_type_id: string | null
          site_id: string
          start_accuracy_m: number | null
          start_captured_at: string | null
          start_distance_m: number | null
          start_in_fence: boolean | null
          start_lat: number | null
          start_lng: number | null
          start_selfie_path: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["shift_status"]
          trust: Database["public"]["Enums"]["trust_level"] | null
          updated_at: string
          worked_minutes: number
        }
        SetofOptions: {
          from: "*"
          to: "shifts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      recompute_away_time: { Args: { p_shift_id: string }; Returns: number }
      report_location_state: {
        Args: { p_at?: string; p_enabled: boolean; p_shift_id: string }
        Returns: undefined
      }
      report_tamper: {
        Args: {
          p_detail?: string
          p_guard_id: string
          p_lat?: number
          p_lng?: number
          p_site_id: string
        }
        Returns: string
      }
      resolve_profile_share: { Args: { p_token: string }; Returns: Json }
      run_monitors: { Args: { p_agency_id: string }; Returns: Json }
      seed_system_roles: { Args: { p_agency_id: string }; Returns: undefined }
      shift_window: {
        Args: { p_date: string; p_end: string; p_start: string; p_tz: string }
        Returns: {
          ends_at: string
          starts_at: string
        }[]
      }
      site_day_summary: {
        Args: { p_agency_id: string; p_date: string }
        Returns: {
          absent: number
          flagged: number
          guards_required: number
          half_day: number
          on_duty_now: number
          on_leave: number
          pending: number
          present: number
          scheduled: number
          site_id: string
          site_name: string
        }[]
      }
      site_distance_m: {
        Args: { p_lat: number; p_lng: number; p_site_id: string }
        Returns: number
      }
      start_patrol: {
        Args: { p_at?: string; p_patrol_id: string }
        Returns: {
          agency_id: string
          created_at: string
          distance_m: number | null
          duration_s: number | null
          ended_at: string | null
          expected_at: string | null
          guard_id: string
          id: string
          notes: string | null
          route_id: string | null
          shift_id: string | null
          site_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["patrol_status"]
          trail: Json | null
        }
        SetofOptions: {
          from: "*"
          to: "patrols"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      storage_agency_prefix: { Args: { p_name: string }; Returns: string }
      task_site_id: { Args: { p_task_id: string }; Returns: string }
    }
    Enums: {
      agency_status: "trial" | "active" | "suspended" | "churned"
      attendance_status:
        | "present"
        | "half_day"
        | "absent"
        | "on_leave"
        | "pending"
      document_status: "pending" | "verified" | "rejected"
      document_type:
        | "aadhaar"
        | "pan"
        | "police_verification"
        | "marksheet"
        | "guard_kyc"
        | "other"
      event_severity: "info" | "warn" | "critical"
      event_type:
        | "CHECK_IN"
        | "CHECK_OUT"
        | "OUTSIDE_FENCE"
        | "FENCE_EXIT"
        | "FENCE_ENTER"
        | "LATE_START"
        | "EARLY_CHECKOUT"
        | "LOCATION_OFF"
        | "LOCATION_ON"
        | "OUTAGE"
        | "TAMPER_SUSPECTED"
        | "SHIFT_VOID"
        | "EXCEPTION_LOGGED"
        | "PATROL_STARTED"
        | "PATROL_COMPLETED"
        | "PATROL_LATE"
        | "PATROL_MISSED"
        | "TASK_DONE"
        | "TASK_MISSED"
        | "LEAVE_REQUESTED"
        | "LEAVE_DECIDED"
        | "ATTENDANCE_OVERRIDE"
        | "STAFFING_GAP"
        | "SYNCED_LATE"
      fence_type: "radius" | "polygon"
      guard_status: "invited" | "active" | "inactive"
      leave_status: "pending" | "approved" | "declined" | "cancelled"
      leave_type: "casual" | "earned" | "unpaid"
      notification_channel: "push" | "whatsapp" | "sms" | "email" | "in_app"
      notification_status: "queued" | "sent" | "failed" | "read"
      patrol_status:
        | "scheduled"
        | "in_progress"
        | "completed"
        | "late"
        | "missed"
      platform_role: "platform_owner" | "platform_support"
      shift_status:
        | "scheduled"
        | "in_progress"
        | "completed"
        | "void_location_off"
        | "absent"
        | "cancelled"
      task_status: "pending" | "in_progress" | "done" | "missed"
      trust_level: "clean" | "flagged" | "suspicious"
      user_role: "owner" | "admin" | "supervisor" | "guard" | "staff"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      agency_status: ["trial", "active", "suspended", "churned"],
      attendance_status: [
        "present",
        "half_day",
        "absent",
        "on_leave",
        "pending",
      ],
      document_status: ["pending", "verified", "rejected"],
      document_type: [
        "aadhaar",
        "pan",
        "police_verification",
        "marksheet",
        "guard_kyc",
        "other",
      ],
      event_severity: ["info", "warn", "critical"],
      event_type: [
        "CHECK_IN",
        "CHECK_OUT",
        "OUTSIDE_FENCE",
        "FENCE_EXIT",
        "FENCE_ENTER",
        "LATE_START",
        "EARLY_CHECKOUT",
        "LOCATION_OFF",
        "LOCATION_ON",
        "OUTAGE",
        "TAMPER_SUSPECTED",
        "SHIFT_VOID",
        "EXCEPTION_LOGGED",
        "PATROL_STARTED",
        "PATROL_COMPLETED",
        "PATROL_LATE",
        "PATROL_MISSED",
        "TASK_DONE",
        "TASK_MISSED",
        "LEAVE_REQUESTED",
        "LEAVE_DECIDED",
        "ATTENDANCE_OVERRIDE",
        "STAFFING_GAP",
        "SYNCED_LATE",
      ],
      fence_type: ["radius", "polygon"],
      guard_status: ["invited", "active", "inactive"],
      leave_status: ["pending", "approved", "declined", "cancelled"],
      leave_type: ["casual", "earned", "unpaid"],
      notification_channel: ["push", "whatsapp", "sms", "email", "in_app"],
      notification_status: ["queued", "sent", "failed", "read"],
      patrol_status: [
        "scheduled",
        "in_progress",
        "completed",
        "late",
        "missed",
      ],
      platform_role: ["platform_owner", "platform_support"],
      shift_status: [
        "scheduled",
        "in_progress",
        "completed",
        "void_location_off",
        "absent",
        "cancelled",
      ],
      task_status: ["pending", "in_progress", "done", "missed"],
      trust_level: ["clean", "flagged", "suspicious"],
      user_role: ["owner", "admin", "supervisor", "guard", "staff"],
    },
  },
} as const

