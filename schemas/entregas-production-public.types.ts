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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      account_deletion_requests: {
        Row: {
          completed_at: string | null
          id: string
          requested_at: string
          resolution_note: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          requested_at?: string
          resolution_note?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          requested_at?: string
          resolution_note?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_audit_logs: {
        Row: {
          action: string
          admin_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          admin_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          admin_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: []
      }
      api_rate_limits: {
        Row: {
          request_count: number
          scope: string
          updated_at: string
          user_id: string
          window_started_at: string
        }
        Insert: {
          request_count?: number
          scope: string
          updated_at?: string
          user_id: string
          window_started_at: string
        }
        Update: {
          request_count?: number
          scope?: string
          updated_at?: string
          user_id?: string
          window_started_at?: string
        }
        Relationships: []
      }
      asaas_webhook_events: {
        Row: {
          created_at: string
          event_id: string
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          processing_error: string | null
          resource_id: string | null
          resource_type: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          event_type: string
          id?: string
          payload: Json
          processed_at?: string | null
          processing_error?: string | null
          resource_id?: string | null
          resource_type?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          processing_error?: string | null
          resource_id?: string | null
          resource_type?: string | null
        }
        Relationships: []
      }
      cities: {
        Row: {
          center_latitude: number | null
          center_longitude: number | null
          courier_dispatch_radius_km: number | null
          created_at: string
          default_delivery_radius_km: number
          id: string
          is_active: boolean
          name: string
          slug: string
          state: string
          timezone: string
          updated_at: string
        }
        Insert: {
          center_latitude?: number | null
          center_longitude?: number | null
          courier_dispatch_radius_km?: number | null
          created_at?: string
          default_delivery_radius_km?: number
          id?: string
          is_active?: boolean
          name: string
          slug: string
          state: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          center_latitude?: number | null
          center_longitude?: number | null
          courier_dispatch_radius_km?: number | null
          created_at?: string
          default_delivery_radius_km?: number
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          state?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      coupon_redemptions: {
        Row: {
          coupon_id: string
          created_at: string
          discount_amount: number
          id: string
          order_id: string
          user_id: string
        }
        Insert: {
          coupon_id: string
          created_at?: string
          discount_amount: number
          id?: string
          order_id: string
          user_id: string
        }
        Update: {
          coupon_id?: string
          created_at?: string
          discount_amount?: number
          id?: string
          order_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          ends_at: string | null
          id: string
          is_active: boolean
          max_discount: number | null
          merchant_id: string | null
          minimum_order: number
          starts_at: string | null
          updated_at: string
          usage_limit: number | null
          usage_limit_per_user: number | null
        }
        Insert: {
          code: string
          created_at?: string
          discount_type: string
          discount_value: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          max_discount?: number | null
          merchant_id?: string | null
          minimum_order?: number
          starts_at?: string | null
          updated_at?: string
          usage_limit?: number | null
          usage_limit_per_user?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          max_discount?: number | null
          merchant_id?: string | null
          minimum_order?: number
          starts_at?: string | null
          updated_at?: string
          usage_limit?: number | null
          usage_limit_per_user?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coupons_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_availability: {
        Row: {
          courier_id: string
          is_online: boolean
          last_seen_at: string
          online_since: string | null
          updated_at: string
        }
        Insert: {
          courier_id: string
          is_online?: boolean
          last_seen_at?: string
          online_since?: string | null
          updated_at?: string
        }
        Update: {
          courier_id?: string
          is_online?: boolean
          last_seen_at?: string
          online_since?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_availability_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: true
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_documents: {
        Row: {
          courier_id: string
          created_at: string
          document_type: string
          id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          storage_path: string
          updated_at: string
        }
        Insert: {
          courier_id: string
          created_at?: string
          document_type: string
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          storage_path: string
          updated_at?: string
        }
        Update: {
          courier_id?: string
          created_at?: string
          document_type?: string
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_documents_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_locations: {
        Row: {
          accuracy_meters: number | null
          courier_id: string
          heading: number | null
          latitude: number
          longitude: number
          recorded_at: string
          speed_mps: number | null
          updated_at: string
        }
        Insert: {
          accuracy_meters?: number | null
          courier_id: string
          heading?: number | null
          latitude: number
          longitude: number
          recorded_at?: string
          speed_mps?: number | null
          updated_at?: string
        }
        Update: {
          accuracy_meters?: number | null
          courier_id?: string
          heading?: number | null
          latitude?: number
          longitude?: number
          recorded_at?: string
          speed_mps?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_locations_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: true
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_online_sessions: {
        Row: {
          courier_id: string
          created_at: string
          ended_at: string | null
          id: string
          started_at: string
          updated_at: string
        }
        Insert: {
          courier_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          started_at?: string
          updated_at?: string
        }
        Update: {
          courier_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          started_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_online_sessions_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_settlement_deliveries: {
        Row: {
          amount: number
          created_at: string
          delivery_job_id: string
          id: string
          settlement_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          delivery_job_id: string
          id?: string
          settlement_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          delivery_job_id?: string
          id?: string
          settlement_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_settlement_deliveries_delivery_job_id_fkey"
            columns: ["delivery_job_id"]
            isOneToOne: true
            referencedRelation: "delivery_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_settlement_deliveries_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "courier_settlements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_settlement_deliveries_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "courier_settlements_view"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_settlements: {
        Row: {
          admin_resolution_outcome: string | null
          admin_resolution_reason: string | null
          admin_resolved_at: string | null
          admin_resolved_by: string | null
          courier_confirmed_at: string | null
          courier_id: string
          created_at: string
          delivery_count: number
          dispute_reason: string | null
          disputed_at: string | null
          due_at: string
          id: string
          merchant_id: string
          merchant_marked_paid_at: string | null
          proof_storage_path: string | null
          settlement_date: string
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          admin_resolution_outcome?: string | null
          admin_resolution_reason?: string | null
          admin_resolved_at?: string | null
          admin_resolved_by?: string | null
          courier_confirmed_at?: string | null
          courier_id: string
          created_at?: string
          delivery_count?: number
          dispute_reason?: string | null
          disputed_at?: string | null
          due_at: string
          id?: string
          merchant_id: string
          merchant_marked_paid_at?: string | null
          proof_storage_path?: string | null
          settlement_date?: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          admin_resolution_outcome?: string | null
          admin_resolution_reason?: string | null
          admin_resolved_at?: string | null
          admin_resolved_by?: string | null
          courier_confirmed_at?: string | null
          courier_id?: string
          created_at?: string
          delivery_count?: number
          dispute_reason?: string | null
          disputed_at?: string | null
          due_at?: string
          id?: string
          merchant_id?: string
          merchant_marked_paid_at?: string | null
          proof_storage_path?: string | null
          settlement_date?: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_settlements_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_settlements_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      couriers: {
        Row: {
          address: Json
          approved_at: string | null
          approved_by: string | null
          birth_date: string | null
          cnh_number: string | null
          cpf: string | null
          created_at: string
          id: string
          is_active: boolean
          photo_url: string | null
          pix_key: string | null
          rating: number
          rejection_reason: string | null
          review_count: number
          status: string
          updated_at: string
          user_id: string
          vehicle_model: string | null
          vehicle_plate: string | null
          vehicle_type: string | null
        }
        Insert: {
          address?: Json
          approved_at?: string | null
          approved_by?: string | null
          birth_date?: string | null
          cnh_number?: string | null
          cpf?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          photo_url?: string | null
          pix_key?: string | null
          rating?: number
          rejection_reason?: string | null
          review_count?: number
          status?: string
          updated_at?: string
          user_id: string
          vehicle_model?: string | null
          vehicle_plate?: string | null
          vehicle_type?: string | null
        }
        Update: {
          address?: Json
          approved_at?: string | null
          approved_by?: string | null
          birth_date?: string | null
          cnh_number?: string | null
          cpf?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          photo_url?: string | null
          pix_key?: string | null
          rating?: number
          rejection_reason?: string | null
          review_count?: number
          status?: string
          updated_at?: string
          user_id?: string
          vehicle_model?: string | null
          vehicle_plate?: string | null
          vehicle_type?: string | null
        }
        Relationships: []
      }
      customer_addresses: {
        Row: {
          city: string
          complement: string | null
          created_at: string
          id: string
          is_default: boolean
          label: string
          latitude: number | null
          longitude: number | null
          neighborhood: string
          number: string
          postal_code: string
          reference: string | null
          state: string
          street: string
          updated_at: string
          user_id: string
        }
        Insert: {
          city: string
          complement?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          latitude?: number | null
          longitude?: number | null
          neighborhood: string
          number: string
          postal_code: string
          reference?: string | null
          state: string
          street: string
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string
          complement?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          latitude?: number | null
          longitude?: number | null
          neighborhood?: string
          number?: string
          postal_code?: string
          reference?: string | null
          state?: string
          street?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      customer_favorites: {
        Row: {
          created_at: string
          customer_user_id: string
          merchant_id: string
        }
        Insert: {
          created_at?: string
          customer_user_id: string
          merchant_id: string
        }
        Update: {
          created_at?: string
          customer_user_id?: string
          merchant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_favorites_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_confirmation_secrets: {
        Row: {
          created_at: string
          failed_attempts: number
          locked_until: string | null
          order_id: string
          pin_code: string
        }
        Insert: {
          created_at?: string
          failed_attempts?: number
          locked_until?: string | null
          order_id: string
          pin_code: string
        }
        Update: {
          created_at?: string
          failed_attempts?: number
          locked_until?: string | null
          order_id?: string
          pin_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_confirmation_secrets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          delivery_job_id: string
          event_type: string
          from_status: string | null
          id: string
          metadata: Json
          to_status: string | null
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          delivery_job_id: string
          event_type: string
          from_status?: string | null
          id?: string
          metadata?: Json
          to_status?: string | null
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          delivery_job_id?: string
          event_type?: string
          from_status?: string | null
          id?: string
          metadata?: Json
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_events_delivery_job_id_fkey"
            columns: ["delivery_job_id"]
            isOneToOne: false
            referencedRelation: "delivery_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_jobs: {
        Row: {
          accepted_at: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          courier_id: string | null
          created_at: string
          delivered_at: string | null
          delivery_address: Json
          delivery_latitude: number | null
          delivery_longitude: number | null
          destination_arrived_at: string | null
          estimated_distance_meters: number | null
          estimated_duration_seconds: number | null
          estimated_earnings: number
          id: string
          merchant_id: string
          order_id: string
          picked_up_at: string | null
          pickup_address: Json
          pickup_arrived_at: string | null
          pickup_latitude: number | null
          pickup_longitude: number | null
          search_started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          courier_id?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_address: Json
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          destination_arrived_at?: string | null
          estimated_distance_meters?: number | null
          estimated_duration_seconds?: number | null
          estimated_earnings?: number
          id?: string
          merchant_id: string
          order_id: string
          picked_up_at?: string | null
          pickup_address: Json
          pickup_arrived_at?: string | null
          pickup_latitude?: number | null
          pickup_longitude?: number | null
          search_started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          courier_id?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_address?: Json
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          destination_arrived_at?: string | null
          estimated_distance_meters?: number | null
          estimated_duration_seconds?: number | null
          estimated_earnings?: number
          id?: string
          merchant_id?: string
          order_id?: string
          picked_up_at?: string | null
          pickup_address?: Json
          pickup_arrived_at?: string | null
          pickup_latitude?: number | null
          pickup_longitude?: number | null
          search_started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_jobs_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_jobs_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_jobs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_offers: {
        Row: {
          courier_id: string
          created_at: string
          delivery_job_id: string
          expires_at: string
          id: string
          offered_at: string
          responded_at: string | null
          status: string
        }
        Insert: {
          courier_id: string
          created_at?: string
          delivery_job_id: string
          expires_at: string
          id?: string
          offered_at?: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          courier_id?: string
          created_at?: string
          delivery_job_id?: string
          expires_at?: string
          id?: string
          offered_at?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_offers_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_offers_delivery_job_id_fkey"
            columns: ["delivery_job_id"]
            isOneToOne: false
            referencedRelation: "delivery_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_zones: {
        Row: {
          center_latitude: number | null
          center_longitude: number | null
          city_id: string
          created_at: string
          delivery_fee: number | null
          geojson: Json | null
          id: string
          is_active: boolean
          minimum_order: number | null
          name: string
          radius_km: number | null
          updated_at: string
        }
        Insert: {
          center_latitude?: number | null
          center_longitude?: number | null
          city_id: string
          created_at?: string
          delivery_fee?: number | null
          geojson?: Json | null
          id?: string
          is_active?: boolean
          minimum_order?: number | null
          name: string
          radius_km?: number | null
          updated_at?: string
        }
        Update: {
          center_latitude?: number | null
          center_longitude?: number | null
          city_id?: string
          created_at?: string
          delivery_fee?: number | null
          geojson?: Json | null
          id?: string
          is_active?: boolean
          minimum_order?: number | null
          name?: string
          radius_km?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_zones_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      external_account_deletion_requests: {
        Row: {
          email: string
          id: string
          requested_at: string
          resolution_note: string | null
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          email: string
          id?: string
          requested_at?: string
          resolution_note?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          email?: string
          id?: string
          requested_at?: string
          resolution_note?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      fee_rules: {
        Row: {
          city_id: string | null
          courier_base_fee: number
          courier_minimum_fee: number
          courier_per_km: number
          created_at: string
          customer_service_fee: number
          ends_at: string | null
          id: string
          is_active: boolean
          merchant_commission_percent: number
          merchant_id: string | null
          name: string
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          city_id?: string | null
          courier_base_fee?: number
          courier_minimum_fee?: number
          courier_per_km?: number
          created_at?: string
          customer_service_fee?: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          merchant_commission_percent?: number
          merchant_id?: string | null
          name: string
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          city_id?: string | null
          courier_base_fee?: number
          courier_minimum_fee?: number
          courier_per_km?: number
          created_at?: string
          customer_service_fee?: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          merchant_commission_percent?: number
          merchant_id?: string | null
          name?: string
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_rules_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_rules_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_acceptances: {
        Row: {
          accepted_at: string
          created_at: string
          id: string
          privacy_version: string
          source: string
          terms_version: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          created_at?: string
          id?: string
          privacy_version: string
          source?: string
          terms_version: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          created_at?: string
          id?: string
          privacy_version?: string
          source?: string
          terms_version?: string
          user_id?: string
        }
        Relationships: []
      }
      menu_categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          merchant_id: string
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          merchant_id: string
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          merchant_id?: string
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_asaas_accounts: {
        Row: {
          api_key_iv: string | null
          asaas_account_id: string | null
          asaas_wallet_id: string | null
          created_at: string
          encrypted_api_key: string | null
          holder_type: string
          id: string
          last_error: string | null
          merchant_id: string
          status: string
          updated_at: string
        }
        Insert: {
          api_key_iv?: string | null
          asaas_account_id?: string | null
          asaas_wallet_id?: string | null
          created_at?: string
          encrypted_api_key?: string | null
          holder_type?: string
          id?: string
          last_error?: string | null
          merchant_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          api_key_iv?: string | null
          asaas_account_id?: string | null
          asaas_wallet_id?: string | null
          created_at?: string
          encrypted_api_key?: string | null
          holder_type?: string
          id?: string
          last_error?: string | null
          merchant_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_asaas_accounts_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: true
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_categories: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      merchant_documents: {
        Row: {
          created_at: string
          document_type: string
          id: string
          merchant_id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          storage_path: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_type: string
          id?: string
          merchant_id: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          storage_path: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_type?: string
          id?: string
          merchant_id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_documents_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_financial_profiles: {
        Row: {
          address: string
          address_number: string
          birth_date: string | null
          company_type: string | null
          complement: string | null
          cpf_cnpj: string
          created_at: string
          email: string
          holder_type: string
          income_value: number
          legal_name: string
          merchant_id: string
          mobile_phone: string
          postal_code: string
          province: string
          updated_at: string
        }
        Insert: {
          address: string
          address_number: string
          birth_date?: string | null
          company_type?: string | null
          complement?: string | null
          cpf_cnpj: string
          created_at?: string
          email: string
          holder_type: string
          income_value: number
          legal_name: string
          merchant_id: string
          mobile_phone: string
          postal_code: string
          province: string
          updated_at?: string
        }
        Update: {
          address?: string
          address_number?: string
          birth_date?: string | null
          company_type?: string | null
          complement?: string | null
          cpf_cnpj?: string
          created_at?: string
          email?: string
          holder_type?: string
          income_value?: number
          legal_name?: string
          merchant_id?: string
          mobile_phone?: string
          postal_code?: string
          province?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_financial_profiles_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: true
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_hours: {
        Row: {
          closes_at: string | null
          created_at: string
          id: string
          is_closed: boolean
          merchant_id: string
          opens_at: string | null
          second_closes_at: string | null
          second_opens_at: string | null
          updated_at: string
          weekday: number
        }
        Insert: {
          closes_at?: string | null
          created_at?: string
          id?: string
          is_closed?: boolean
          merchant_id: string
          opens_at?: string | null
          second_closes_at?: string | null
          second_opens_at?: string | null
          updated_at?: string
          weekday: number
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          id?: string
          is_closed?: boolean
          merchant_id?: string
          opens_at?: string | null
          second_closes_at?: string | null
          second_opens_at?: string | null
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "merchant_hours_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_members: {
        Row: {
          created_at: string
          id: string
          merchant_id: string
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          merchant_id: string
          role?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          merchant_id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_members_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_mercadopago_accounts: {
        Row: {
          access_token_expires_at: string | null
          account_email: string | null
          connected_at: string
          created_at: string
          disconnected_at: string | null
          encrypted_access_token: string | null
          encrypted_refresh_token: string | null
          id: string
          last_error: string | null
          last_refreshed_at: string | null
          merchant_id: string
          metadata: Json
          orders_api_enabled: boolean
          provider_user_id: string | null
          refresh_token_iv: string | null
          scope: string | null
          status: string
          token_iv: string | null
          token_type: string
          updated_at: string
        }
        Insert: {
          access_token_expires_at?: string | null
          account_email?: string | null
          connected_at?: string
          created_at?: string
          disconnected_at?: string | null
          encrypted_access_token?: string | null
          encrypted_refresh_token?: string | null
          id?: string
          last_error?: string | null
          last_refreshed_at?: string | null
          merchant_id: string
          metadata?: Json
          orders_api_enabled?: boolean
          provider_user_id?: string | null
          refresh_token_iv?: string | null
          scope?: string | null
          status?: string
          token_iv?: string | null
          token_type?: string
          updated_at?: string
        }
        Update: {
          access_token_expires_at?: string | null
          account_email?: string | null
          connected_at?: string
          created_at?: string
          disconnected_at?: string | null
          encrypted_access_token?: string | null
          encrypted_refresh_token?: string | null
          id?: string
          last_error?: string | null
          last_refreshed_at?: string | null
          merchant_id?: string
          metadata?: Json
          orders_api_enabled?: boolean
          provider_user_id?: string | null
          refresh_token_iv?: string | null
          scope?: string | null
          status?: string
          token_iv?: string | null
          token_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_mercadopago_accounts_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: true
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_mercadopago_oauth_states: {
        Row: {
          code_verifier_encrypted: string | null
          code_verifier_iv: string | null
          created_at: string
          expires_at: string
          id: string
          merchant_id: string
          redirect_after: string | null
          state_hash: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_verifier_encrypted?: string | null
          code_verifier_iv?: string | null
          created_at?: string
          expires_at: string
          id?: string
          merchant_id: string
          redirect_after?: string | null
          state_hash: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_verifier_encrypted?: string | null
          code_verifier_iv?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          merchant_id?: string
          redirect_after?: string | null
          state_hash?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_mercadopago_oauth_states_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_safe2pay_accounts: {
        Row: {
          created_at: string
          environment: string
          expires_at: string | null
          last_error_code: string | null
          merchant_id: string
          pix_copy_paste: string | null
          pix_qr_code_base64: string | null
          provider_created_at: string | null
          provisioning_started_at: string | null
          request_fingerprint: string | null
          safe2pay_receiver_id: number | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          environment?: string
          expires_at?: string | null
          last_error_code?: string | null
          merchant_id: string
          pix_copy_paste?: string | null
          pix_qr_code_base64?: string | null
          provider_created_at?: string | null
          provisioning_started_at?: string | null
          request_fingerprint?: string | null
          safe2pay_receiver_id?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          environment?: string
          expires_at?: string | null
          last_error_code?: string | null
          merchant_id?: string
          pix_copy_paste?: string | null
          pix_qr_code_base64?: string | null
          provider_created_at?: string | null
          provisioning_started_at?: string | null
          request_fingerprint?: string | null
          safe2pay_receiver_id?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_safe2pay_accounts_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: true
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_special_hours: {
        Row: {
          closes_at: string | null
          created_at: string
          id: string
          is_closed: boolean
          merchant_id: string
          note: string | null
          opens_at: string | null
          second_closes_at: string | null
          second_opens_at: string | null
          service_date: string
          updated_at: string
        }
        Insert: {
          closes_at?: string | null
          created_at?: string
          id?: string
          is_closed?: boolean
          merchant_id: string
          note?: string | null
          opens_at?: string | null
          second_closes_at?: string | null
          second_opens_at?: string | null
          service_date: string
          updated_at?: string
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          id?: string
          is_closed?: boolean
          merchant_id?: string
          note?: string | null
          opens_at?: string | null
          second_closes_at?: string | null
          second_opens_at?: string | null
          service_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_special_hours_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_subscription_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          merchant_subscription_id: string | null
          payload: Json
          processed_at: string | null
          provider_event_id: string
          provider_resource_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          merchant_subscription_id?: string | null
          payload?: Json
          processed_at?: string | null
          provider_event_id: string
          provider_resource_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          merchant_subscription_id?: string | null
          payload?: Json
          processed_at?: string | null
          provider_event_id?: string
          provider_resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_subscription_events_merchant_subscription_id_fkey"
            columns: ["merchant_subscription_id"]
            isOneToOne: false
            referencedRelation: "merchant_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_subscription_payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          debit_date: string | null
          expires_at: string | null
          failure_reason: string | null
          id: string
          idempotency_key: string | null
          merchant_subscription_id: string
          method: string
          paid_at: string | null
          provider_authorized_payment_id: string
          provider_payload: Json
          provider_payment_id: string | null
          qr_code_image_url: string | null
          qr_code_text: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          debit_date?: string | null
          expires_at?: string | null
          failure_reason?: string | null
          id?: string
          idempotency_key?: string | null
          merchant_subscription_id: string
          method?: string
          paid_at?: string | null
          provider_authorized_payment_id: string
          provider_payload?: Json
          provider_payment_id?: string | null
          qr_code_image_url?: string | null
          qr_code_text?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          debit_date?: string | null
          expires_at?: string | null
          failure_reason?: string | null
          id?: string
          idempotency_key?: string | null
          merchant_subscription_id?: string
          method?: string
          paid_at?: string | null
          provider_authorized_payment_id?: string
          provider_payload?: Json
          provider_payment_id?: string | null
          qr_code_image_url?: string | null
          qr_code_text?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_subscription_payments_merchant_subscription_id_fkey"
            columns: ["merchant_subscription_id"]
            isOneToOne: false
            referencedRelation: "merchant_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_subscriptions: {
        Row: {
          amount: number
          billing_frequency: string
          checkout_url: string | null
          created_at: string
          currency: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          last_payment_at: string | null
          last_payment_status: string | null
          merchant_id: string
          metadata: Json
          next_payment_at: string | null
          provider: string
          provider_plan_id: string | null
          provider_preapproval_id: string | null
          provider_status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          billing_frequency?: string
          checkout_url?: string | null
          created_at?: string
          currency?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          last_payment_at?: string | null
          last_payment_status?: string | null
          merchant_id: string
          metadata?: Json
          next_payment_at?: string | null
          provider?: string
          provider_plan_id?: string | null
          provider_preapproval_id?: string | null
          provider_status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_frequency?: string
          checkout_url?: string | null
          created_at?: string
          currency?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          last_payment_at?: string | null
          last_payment_status?: string | null
          merchant_id?: string
          metadata?: Json
          next_payment_at?: string | null
          provider?: string
          provider_plan_id?: string | null
          provider_preapproval_id?: string | null
          provider_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_subscriptions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: true
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchants: {
        Row: {
          address_line: string | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          category_id: string
          city: string | null
          city_id: string | null
          closes_at: string | null
          contact_email: string | null
          contact_phone: string | null
          cover_url: string | null
          created_at: string
          delivery_enabled: boolean
          delivery_fee: number
          delivery_max_minutes: number | null
          delivery_min_minutes: number | null
          description: string | null
          document: string | null
          id: string
          is_active: boolean
          is_open: boolean
          latitude: number | null
          legal_name: string | null
          logo_url: string | null
          longitude: number | null
          minimum_order: number
          name: string
          neighborhood: string | null
          owner_user_id: string | null
          pickup_enabled: boolean
          rating: number
          rejection_reason: string | null
          review_count: number
          slug: string
          state: string | null
          tags: string[]
          temporarily_closed: boolean
          updated_at: string
        }
        Insert: {
          address_line?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          category_id: string
          city?: string | null
          city_id?: string | null
          closes_at?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          cover_url?: string | null
          created_at?: string
          delivery_enabled?: boolean
          delivery_fee?: number
          delivery_max_minutes?: number | null
          delivery_min_minutes?: number | null
          description?: string | null
          document?: string | null
          id?: string
          is_active?: boolean
          is_open?: boolean
          latitude?: number | null
          legal_name?: string | null
          logo_url?: string | null
          longitude?: number | null
          minimum_order?: number
          name: string
          neighborhood?: string | null
          owner_user_id?: string | null
          pickup_enabled?: boolean
          rating?: number
          rejection_reason?: string | null
          review_count?: number
          slug: string
          state?: string | null
          tags?: string[]
          temporarily_closed?: boolean
          updated_at?: string
        }
        Update: {
          address_line?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          category_id?: string
          city?: string | null
          city_id?: string | null
          closes_at?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          cover_url?: string | null
          created_at?: string
          delivery_enabled?: boolean
          delivery_fee?: number
          delivery_max_minutes?: number | null
          delivery_min_minutes?: number | null
          description?: string | null
          document?: string | null
          id?: string
          is_active?: boolean
          is_open?: boolean
          latitude?: number | null
          legal_name?: string | null
          logo_url?: string | null
          longitude?: number | null
          minimum_order?: number
          name?: string
          neighborhood?: string | null
          owner_user_id?: string | null
          pickup_enabled?: boolean
          rating?: number
          rejection_reason?: string | null
          review_count?: number
          slug?: string
          state?: string | null
          tags?: string[]
          temporarily_closed?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchants_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "merchant_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchants_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          account_alerts: boolean
          created_at: string
          order_updates: boolean
          product_news: boolean
          promotions: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          account_alerts?: boolean
          created_at?: string
          order_updates?: boolean
          product_news?: boolean
          promotions?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          account_alerts?: boolean
          created_at?: string
          order_updates?: boolean
          product_news?: boolean
          promotions?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_push_outbox: {
        Row: {
          attempt_count: number
          created_at: string
          id: string
          last_error: string | null
          next_attempt_at: string
          notification_id: string
          processed_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          notification_id: string
          processed_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          notification_id?: string
          processed_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_push_outbox_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: true
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          data: Json
          event_key: string | null
          id: string
          notification_type: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          data?: Json
          event_key?: string | null
          id?: string
          notification_type: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          data?: Json
          event_key?: string | null
          id?: string
          notification_type?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          base_price: number
          created_at: string
          id: string
          line_total: number
          order_id: string
          product_description: string | null
          product_id: string | null
          product_name: string
          quantity: number
          selected_options: Json
          unit_price: number
        }
        Insert: {
          base_price: number
          created_at?: string
          id?: string
          line_total: number
          order_id: string
          product_description?: string | null
          product_id?: string | null
          product_name: string
          quantity: number
          selected_options?: Json
          unit_price: number
        }
        Update: {
          base_price?: number
          created_at?: string
          id?: string
          line_total?: number
          order_id?: string
          product_description?: string | null
          product_id?: string | null
          product_name?: string
          quantity?: number
          selected_options?: Json
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_by_user_id: string | null
          created_at: string
          id: string
          order_id: string
          status: string
        }
        Insert: {
          changed_by_user_id?: string | null
          created_at?: string
          id?: string
          order_id: string
          status: string
        }
        Update: {
          changed_by_user_id?: string | null
          created_at?: string
          id?: string
          order_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          accepted_at: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          checkout_intent_key: string | null
          coupon_id: string | null
          courier_earnings: number | null
          created_at: string
          customer_user_id: string | null
          delivered_at: string | null
          delivery_address: Json
          delivery_fee: number
          discount: number
          fulfillment_type: string
          id: string
          merchant_id: string
          merchant_net: number | null
          observation: string | null
          order_number: number
          payment_method: string
          payment_status: string
          platform_fee: number
          ready_at: string | null
          request_key: string
          service_fee: number
          status: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          checkout_intent_key?: string | null
          coupon_id?: string | null
          courier_earnings?: number | null
          created_at?: string
          customer_user_id?: string | null
          delivered_at?: string | null
          delivery_address: Json
          delivery_fee?: number
          discount?: number
          fulfillment_type?: string
          id?: string
          merchant_id: string
          merchant_net?: number | null
          observation?: string | null
          order_number?: never
          payment_method: string
          payment_status?: string
          platform_fee?: number
          ready_at?: string | null
          request_key: string
          service_fee?: number
          status?: string
          subtotal: number
          total: number
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          checkout_intent_key?: string | null
          coupon_id?: string | null
          courier_earnings?: number | null
          created_at?: string
          customer_user_id?: string | null
          delivered_at?: string | null
          delivery_address?: Json
          delivery_fee?: number
          discount?: number
          fulfillment_type?: string
          id?: string
          merchant_id?: string
          merchant_net?: number | null
          observation?: string | null
          order_number?: never
          payment_method?: string
          payment_status?: string
          platform_fee?: number
          ready_at?: string | null
          request_key?: string
          service_fee?: number
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: string | null
          id: string
          payload: Json
          payment_id: string | null
          processed_at: string | null
          provider: string
          provider_event_id: string
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type?: string | null
          id?: string
          payload: Json
          payment_id?: string | null
          processed_at?: string | null
          provider: string
          provider_event_id: string
          status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: string | null
          id?: string
          payload?: Json
          payment_id?: string | null
          processed_at?: string | null
          provider?: string
          provider_event_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          payment_id: string
          processed_at: string | null
          provider_transaction_id: string | null
          status: string
          transaction_type: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          payment_id: string
          processed_at?: string | null
          provider_transaction_id?: string | null
          status: string
          transaction_type: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          payment_id?: string
          processed_at?: string | null
          provider_transaction_id?: string | null
          status?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          expires_at: string | null
          failed_at: string | null
          failure_reason: string | null
          id: string
          idempotency_key: string
          merchant_mercadopago_account_id: string | null
          method: string
          order_id: string
          paid_at: string | null
          provider: string
          provider_charge_id: string | null
          provider_seller_id: string | null
          qr_code_image_url: string | null
          qr_code_text: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          expires_at?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          idempotency_key: string
          merchant_mercadopago_account_id?: string | null
          method: string
          order_id: string
          paid_at?: string | null
          provider: string
          provider_charge_id?: string | null
          provider_seller_id?: string | null
          qr_code_image_url?: string | null
          qr_code_text?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          expires_at?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          idempotency_key?: string
          merchant_mercadopago_account_id?: string | null
          method?: string
          order_id?: string
          paid_at?: string | null
          provider?: string
          provider_charge_id?: string | null
          provider_seller_id?: string | null
          qr_code_image_url?: string | null
          qr_code_text?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_merchant_mercadopago_account_id_fkey"
            columns: ["merchant_mercadopago_account_id"]
            isOneToOne: false
            referencedRelation: "merchant_mercadopago_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_accounts: {
        Row: {
          account_type: string
          created_at: string
          document: string | null
          holder_name: string | null
          id: string
          is_active: boolean
          pix_key: string
          pix_key_type: string | null
          updated_at: string
          wallet_id: string
        }
        Insert: {
          account_type?: string
          created_at?: string
          document?: string | null
          holder_name?: string | null
          id?: string
          is_active?: boolean
          pix_key: string
          pix_key_type?: string | null
          updated_at?: string
          wallet_id: string
        }
        Update: {
          account_type?: string
          created_at?: string
          document?: string | null
          holder_name?: string | null
          id?: string
          is_active?: boolean
          pix_key?: string
          pix_key_type?: string | null
          updated_at?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_accounts_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: true
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount: number
          dispatch_attempts: number
          dispatch_last_error: string | null
          dispatch_locked_at: string | null
          failure_reason: string | null
          id: string
          idempotency_key: string
          next_dispatch_at: string
          payout_account_id: string
          pix_key_snapshot: string
          pix_key_type_snapshot: string | null
          processed_at: string | null
          provider: string | null
          provider_payout_id: string | null
          requested_at: string
          requested_by: string | null
          status: string
          updated_at: string
          wallet_id: string
        }
        Insert: {
          amount: number
          dispatch_attempts?: number
          dispatch_last_error?: string | null
          dispatch_locked_at?: string | null
          failure_reason?: string | null
          id?: string
          idempotency_key: string
          next_dispatch_at?: string
          payout_account_id: string
          pix_key_snapshot: string
          pix_key_type_snapshot?: string | null
          processed_at?: string | null
          provider?: string | null
          provider_payout_id?: string | null
          requested_at?: string
          requested_by?: string | null
          status?: string
          updated_at?: string
          wallet_id: string
        }
        Update: {
          amount?: number
          dispatch_attempts?: number
          dispatch_last_error?: string | null
          dispatch_locked_at?: string | null
          failure_reason?: string | null
          id?: string
          idempotency_key?: string
          next_dispatch_at?: string
          payout_account_id?: string
          pix_key_snapshot?: string
          pix_key_type_snapshot?: string | null
          processed_at?: string | null
          provider?: string | null
          provider_payout_id?: string | null
          requested_at?: string
          requested_by?: string | null
          status?: string
          updated_at?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_payout_account_id_fkey"
            columns: ["payout_account_id"]
            isOneToOne: false
            referencedRelation: "payout_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          created_at: string
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      product_option_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          max_selections: number
          min_selections: number
          name: string
          product_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_selections?: number
          min_selections?: number
          name: string
          product_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_selections?: number
          min_selections?: number
          name?: string
          product_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_option_groups_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_options: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_available: boolean
          name: string
          option_group_id: string
          price_delta: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_available?: boolean
          name: string
          option_group_id: string
          price_delta?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_available?: boolean
          name?: string
          option_group_id?: string
          price_delta?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_options_option_group_id_fkey"
            columns: ["option_group_id"]
            isOneToOne: false
            referencedRelation: "product_option_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      product_order_reviews: {
        Row: {
          comment: string | null
          created_at: string
          customer_user_id: string
          id: string
          order_id: string
          order_item_id: string
          rating: number
        }
        Insert: {
          comment?: string | null
          created_at?: string
          customer_user_id: string
          id?: string
          order_id: string
          order_item_id: string
          rating: number
        }
        Update: {
          comment?: string | null
          created_at?: string
          customer_user_id?: string
          id?: string
          order_id?: string
          order_item_id?: string
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_order_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_order_reviews_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: true
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean
          is_featured: boolean
          menu_category_id: string | null
          merchant_id: string
          name: string
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_featured?: boolean
          menu_category_id?: string | null
          merchant_id: string
          name: string
          price: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_featured?: boolean
          menu_category_id?: string | null
          merchant_id?: string
          name?: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_menu_category_id_fkey"
            columns: ["menu_category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          birth_date: string | null
          blocked_reason: string | null
          cpf: string | null
          created_at: string
          full_name: string | null
          id: string
          is_active: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          birth_date?: string | null
          blocked_reason?: string | null
          cpf?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          birth_date?: string | null
          blocked_reason?: string | null
          cpf?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      promotions: {
        Row: {
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          ends_at: string
          id: string
          is_active: boolean
          menu_category_id: string | null
          merchant_id: string
          minimum_order: number
          name: string
          product_id: string | null
          starts_at: string
          updated_at: string
          usage_limit: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_type: string
          discount_value: number
          ends_at: string
          id?: string
          is_active?: boolean
          menu_category_id?: string | null
          merchant_id: string
          minimum_order?: number
          name: string
          product_id?: string | null
          starts_at: string
          updated_at?: string
          usage_limit?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          ends_at?: string
          id?: string
          is_active?: boolean
          menu_category_id?: string | null
          merchant_id?: string
          minimum_order?: number
          name?: string
          product_id?: string | null
          starts_at?: string
          updated_at?: string
          usage_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "promotions_menu_category_id_fkey"
            columns: ["menu_category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      push_devices: {
        Row: {
          app_package: string
          app_product: string
          created_at: string
          id: string
          is_active: boolean
          last_seen_at: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          app_package?: string
          app_product?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          app_package?: string
          app_product?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      refunds: {
        Row: {
          amount: number
          created_at: string
          id: string
          order_id: string
          payment_id: string
          processed_at: string | null
          provider_refund_id: string | null
          reason: string
          requested_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          order_id: string
          payment_id: string
          processed_at?: string | null
          provider_refund_id?: string | null
          reason: string
          requested_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          order_id?: string
          payment_id?: string
          processed_at?: string | null
          provider_refund_id?: string | null
          reason?: string
          requested_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          courier_id: string | null
          courier_rating: number | null
          created_at: string
          customer_user_id: string
          id: string
          merchant_id: string
          merchant_rating: number | null
          order_id: string
          updated_at: string
        }
        Insert: {
          comment?: string | null
          courier_id?: string | null
          courier_rating?: number | null
          created_at?: string
          customer_user_id: string
          id?: string
          merchant_id: string
          merchant_rating?: number | null
          order_id: string
          updated_at?: string
        }
        Update: {
          comment?: string | null
          courier_id?: string | null
          courier_rating?: number | null
          created_at?: string
          customer_user_id?: string
          id?: string
          merchant_id?: string
          merchant_rating?: number | null
          order_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      safe2pay_order_transactions: {
        Row: {
          amount: number
          authorized_at: string | null
          created_at: string
          environment: string
          expires_at: string | null
          id: string
          merchant_amount: number
          order_id: string
          pix_copy_paste: string | null
          pix_qr_code_base64: string | null
          provider_transaction_id: number | null
          reference: string
          refunded_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          authorized_at?: string | null
          created_at?: string
          environment?: string
          expires_at?: string | null
          id?: string
          merchant_amount: number
          order_id: string
          pix_copy_paste?: string | null
          pix_qr_code_base64?: string | null
          provider_transaction_id?: number | null
          reference: string
          refunded_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          authorized_at?: string | null
          created_at?: string
          environment?: string
          expires_at?: string | null
          id?: string
          merchant_amount?: number
          order_id?: string
          pix_copy_paste?: string | null
          pix_qr_code_base64?: string | null
          provider_transaction_id?: number | null
          reference?: string
          refunded_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "safe2pay_order_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      safe2pay_webhook_events: {
        Row: {
          created_at: string
          event_key: string | null
          id: string
          payload_hash: string
          processed_at: string | null
          processing_error: string | null
          provider_transaction_id: number
          transaction_status_code: string
        }
        Insert: {
          created_at?: string
          event_key?: string | null
          id?: string
          payload_hash: string
          processed_at?: string | null
          processing_error?: string | null
          provider_transaction_id: number
          transaction_status_code: string
        }
        Update: {
          created_at?: string
          event_key?: string | null
          id?: string
          payload_hash?: string
          processed_at?: string | null
          processing_error?: string | null
          provider_transaction_id?: number
          transaction_status_code?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          attachment_paths: Json
          created_at: string
          id: string
          is_internal: boolean
          message: string
          sender_user_id: string
          ticket_id: string
        }
        Insert: {
          attachment_paths?: Json
          created_at?: string
          id?: string
          is_internal?: boolean
          message: string
          sender_user_id: string
          ticket_id: string
        }
        Update: {
          attachment_paths?: Json
          created_at?: string
          id?: string
          is_internal?: boolean
          message?: string
          sender_user_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_admin_id: string | null
          category: string
          closed_at: string | null
          created_at: string
          delivery_job_id: string | null
          description: string
          id: string
          order_id: string | null
          priority: string
          requester_user_id: string
          resolved_at: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          assigned_admin_id?: string | null
          category: string
          closed_at?: string | null
          created_at?: string
          delivery_job_id?: string | null
          description: string
          id?: string
          order_id?: string | null
          priority?: string
          requester_user_id: string
          resolved_at?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          assigned_admin_id?: string | null
          category?: string
          closed_at?: string | null
          created_at?: string
          delivery_job_id?: string | null
          description?: string
          id?: string
          order_id?: string | null
          priority?: string
          requester_user_id?: string
          resolved_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_delivery_job_id_fkey"
            columns: ["delivery_job_id"]
            isOneToOne: false
            referencedRelation: "delivery_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          available_after: number
          available_delta: number
          balance_after: number
          balance_delta: number
          created_at: string
          description: string | null
          id: string
          idempotency_key: string
          reference_id: string | null
          reference_type: string | null
          reserved_after: number
          reserved_delta: number
          status: string
          transaction_type: string
          wallet_id: string
        }
        Insert: {
          available_after: number
          available_delta?: number
          balance_after: number
          balance_delta?: number
          created_at?: string
          description?: string | null
          id?: string
          idempotency_key: string
          reference_id?: string | null
          reference_type?: string | null
          reserved_after: number
          reserved_delta?: number
          status?: string
          transaction_type: string
          wallet_id: string
        }
        Update: {
          available_after?: number
          available_delta?: number
          balance_after?: number
          balance_delta?: number
          created_at?: string
          description?: string | null
          id?: string
          idempotency_key?: string
          reference_id?: string | null
          reference_type?: string | null
          reserved_after?: number
          reserved_delta?: number
          status?: string
          transaction_type?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          available_balance: number
          balance: number
          blocked_reason: string | null
          courier_id: string | null
          created_at: string
          customer_user_id: string | null
          id: string
          is_blocked: boolean
          merchant_id: string | null
          owner_type: string
          reserved_balance: number
          updated_at: string
        }
        Insert: {
          available_balance?: number
          balance?: number
          blocked_reason?: string | null
          courier_id?: string | null
          created_at?: string
          customer_user_id?: string | null
          id?: string
          is_blocked?: boolean
          merchant_id?: string | null
          owner_type: string
          reserved_balance?: number
          updated_at?: string
        }
        Update: {
          available_balance?: number
          balance?: number
          blocked_reason?: string | null
          courier_id?: string | null
          created_at?: string
          customer_user_id?: string | null
          id?: string
          is_blocked?: boolean
          merchant_id?: string | null
          owner_type?: string
          reserved_balance?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallets_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      courier_settlements_view: {
        Row: {
          admin_resolution_outcome: string | null
          admin_resolution_reason: string | null
          admin_resolved_at: string | null
          admin_resolved_by: string | null
          courier_confirmed_at: string | null
          courier_id: string | null
          created_at: string | null
          delivery_count: number | null
          dispute_reason: string | null
          disputed_at: string | null
          due_at: string | null
          effective_status: string | null
          id: string | null
          merchant_id: string | null
          merchant_marked_paid_at: string | null
          proof_storage_path: string | null
          settlement_date: string | null
          status: string | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          admin_resolution_outcome?: string | null
          admin_resolution_reason?: string | null
          admin_resolved_at?: string | null
          admin_resolved_by?: string | null
          courier_confirmed_at?: string | null
          courier_id?: string | null
          created_at?: string | null
          delivery_count?: number | null
          dispute_reason?: string | null
          disputed_at?: string | null
          due_at?: string | null
          effective_status?: never
          id?: string | null
          merchant_id?: string | null
          merchant_marked_paid_at?: string | null
          proof_storage_path?: string | null
          settlement_date?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          admin_resolution_outcome?: string | null
          admin_resolution_reason?: string | null
          admin_resolved_at?: string | null
          admin_resolved_by?: string | null
          courier_confirmed_at?: string | null
          courier_id?: string | null
          created_at?: string | null
          delivery_count?: number | null
          dispute_reason?: string | null
          disputed_at?: string | null
          due_at?: string | null
          effective_status?: never
          id?: string | null
          merchant_id?: string | null
          merchant_marked_paid_at?: string | null
          proof_storage_path?: string | null
          settlement_date?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courier_settlements_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_settlements_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_delivery_offer: { Args: { _offer_id: string }; Returns: string }
      ack_courier_offer_seen: {
        Args: { _channel?: string; _offer_id: string }
        Returns: boolean
      }
      add_support_message: {
        Args: {
          _attachment_paths?: Json
          _is_internal?: boolean
          _message: string
          _ticket_id: string
        }
        Returns: string
      }
      admin_create_city: {
        Args: {
          _courier_dispatch_radius_km?: number
          _default_delivery_radius_km?: number
          _is_active?: boolean
          _name: string
          _state: string
          _timezone?: string
        }
        Returns: string
      }
      admin_create_fee_rule: {
        Args: {
          _city_id: string
          _courier_base_fee: number
          _courier_minimum_fee: number
          _courier_per_km: number
          _customer_service_fee: number
          _merchant_commission_percent: number
          _merchant_id: string
          _name: string
        }
        Returns: string
      }
      admin_create_merchant: {
        Args: {
          _address_line: string
          _approve?: boolean
          _category_id: string
          _city: string
          _contact_email: string
          _contact_phone: string
          _document: string
          _latitude?: number
          _legal_name: string
          _longitude?: number
          _name: string
          _neighborhood: string
          _owner_user_id: string
          _state: string
        }
        Returns: string
      }
      admin_delete_delivery_zone: {
        Args: { _zone_id: string }
        Returns: undefined
      }
      admin_delete_merchant: {
        Args: { _merchant_id: string }
        Returns: undefined
      }
      admin_reply_support_ticket: {
        Args: {
          _is_internal?: boolean
          _message: string
          _set_in_progress?: boolean
          _ticket_id: string
        }
        Returns: string
      }
      admin_resolve_courier_settlement_dispute: {
        Args: { _outcome: string; _reason: string; _settlement_id: string }
        Returns: {
          admin_resolution_outcome: string | null
          admin_resolution_reason: string | null
          admin_resolved_at: string | null
          admin_resolved_by: string | null
          courier_confirmed_at: string | null
          courier_id: string
          created_at: string
          delivery_count: number
          dispute_reason: string | null
          disputed_at: string | null
          due_at: string
          id: string
          merchant_id: string
          merchant_marked_paid_at: string | null
          proof_storage_path: string | null
          settlement_date: string
          status: string
          total_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "courier_settlements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_review_courier: {
        Args: { _courier_id: string; _reason?: string; _status: string }
        Returns: undefined
      }
      admin_review_document: {
        Args: {
          _document_id: string
          _kind: string
          _reason?: string
          _status: string
        }
        Returns: undefined
      }
      admin_review_merchant: {
        Args: { _merchant_id: string; _reason?: string; _status: string }
        Returns: undefined
      }
      admin_set_city_active: {
        Args: { _city_id: string; _is_active: boolean }
        Returns: undefined
      }
      admin_set_fee_rule_active: {
        Args: { _fee_rule_id: string; _is_active: boolean }
        Returns: undefined
      }
      admin_set_user_active: {
        Args: { _is_active: boolean; _reason?: string; _user_id: string }
        Returns: undefined
      }
      admin_settle_payout: {
        Args: {
          _failure_reason?: string
          _new_status: string
          _payout_id: string
          _provider?: string
          _provider_payout_id?: string
        }
        Returns: undefined
      }
      admin_suspend_merchant: {
        Args: { _merchant_id: string; _reason?: string; _suspended: boolean }
        Returns: undefined
      }
      admin_update_city: {
        Args: {
          _city_id: string
          _courier_dispatch_radius_km?: number
          _default_delivery_radius_km: number
          _is_active: boolean
          _name: string
          _state: string
          _timezone: string
        }
        Returns: undefined
      }
      admin_update_fee_rule: {
        Args: {
          _courier_base_fee: number
          _courier_minimum_fee: number
          _courier_per_km: number
          _customer_service_fee: number
          _fee_rule_id: string
          _merchant_commission_percent: number
        }
        Returns: undefined
      }
      admin_update_platform_setting: {
        Args: { _key: string; _value: Json }
        Returns: undefined
      }
      admin_update_support_ticket: {
        Args: {
          _assigned_admin_id?: string
          _priority?: string
          _status?: string
          _ticket_id: string
        }
        Returns: undefined
      }
      admin_upsert_delivery_zone: {
        Args: {
          _center_latitude: number
          _center_longitude: number
          _city_id: string
          _delivery_fee: number
          _geojson: Json
          _is_active: boolean
          _minimum_order: number
          _name: string
          _radius_km: number
          _zone_id: string
        }
        Returns: string
      }
      apois_can_upload_own_courier_avatar: { Args: never; Returns: boolean }
      apois_check_test_cash_access: {
        Args: { _customer_id: string; _merchant_id: string }
        Returns: boolean
      }
      apois_claim_available_delivery_call: {
        Args: { _job_id: string }
        Returns: string
      }
      apois_is_test_cash_order_for_merchant: {
        Args: { _order_id: string }
        Returns: boolean
      }
      apois_list_available_delivery_calls: { Args: never; Returns: Json }
      apois_qa_read_allowed: {
        Args: { _merchant_id: string }
        Returns: boolean
      }
      apois_visible_merchant_order_status: {
        Args: { p_merchant_ids: string[] }
        Returns: {
          accepting_orders: boolean
          merchant_id: string
        }[]
      }
      bootstrap_courier_location: {
        Args: {
          _accuracy_meters?: number
          _heading?: number
          _latitude: number
          _longitude: number
          _speed_mps?: number
        }
        Returns: undefined
      }
      claim_notification_push_batch: {
        Args: { _limit?: number }
        Returns: {
          attempt_count: number
          body: string
          data: Json
          devices: Json
          notification_id: string
          notification_type: string
          outbox_id: string
          title: string
          user_id: string
        }[]
      }
      claim_notification_push_batch_v2: {
        Args: { _limit?: number }
        Returns: {
          attempt_count: number
          body: string
          data: Json
          devices: Json
          notification_id: string
          notification_type: string
          outbox_id: string
          title: string
          user_id: string
        }[]
      }
      close_courier_settlements: {
        Args: { _merchant_id: string }
        Returns: {
          admin_resolution_outcome: string | null
          admin_resolution_reason: string | null
          admin_resolved_at: string | null
          admin_resolved_by: string | null
          courier_confirmed_at: string | null
          courier_id: string
          created_at: string
          delivery_count: number
          dispute_reason: string | null
          disputed_at: string | null
          due_at: string
          id: string
          merchant_id: string
          merchant_marked_paid_at: string | null
          proof_storage_path: string | null
          settlement_date: string
          status: string
          total_amount: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "courier_settlements"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      complete_delivery_with_pin: {
        Args: { _delivery_job_id: string; _pin: string }
        Returns: boolean
      }
      complete_pickup_with_pin: {
        Args: { _order_id: string; _pin: string }
        Returns: boolean
      }
      confirm_merchant_mapped_address: {
        Args: {
          _address_line: string
          _city: string
          _latitude: number
          _longitude: number
          _neighborhood?: string
          _state: string
        }
        Returns: string
      }
      consume_google_maps_lookup_quota: { Args: never; Returns: boolean }
      courier_confirm_courier_settlement: {
        Args: { _settlement_id: string }
        Returns: {
          admin_resolution_outcome: string | null
          admin_resolution_reason: string | null
          admin_resolved_at: string | null
          admin_resolved_by: string | null
          courier_confirmed_at: string | null
          courier_id: string
          created_at: string
          delivery_count: number
          dispute_reason: string | null
          disputed_at: string | null
          due_at: string
          id: string
          merchant_id: string
          merchant_marked_paid_at: string | null
          proof_storage_path: string | null
          settlement_date: string
          status: string
          total_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "courier_settlements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      courier_dispute_courier_settlement: {
        Args: { _reason?: string; _settlement_id: string }
        Returns: {
          admin_resolution_outcome: string | null
          admin_resolution_reason: string | null
          admin_resolved_at: string | null
          admin_resolved_by: string | null
          courier_confirmed_at: string | null
          courier_id: string
          created_at: string
          delivery_count: number
          dispute_reason: string | null
          disputed_at: string | null
          due_at: string
          id: string
          merchant_id: string
          merchant_marked_paid_at: string | null
          proof_storage_path: string | null
          settlement_date: string
          status: string
          total_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "courier_settlements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      courier_transition_delivery: {
        Args: { _delivery_job_id: string; _new_status: string }
        Returns: undefined
      }
      create_couple_invite: {
        Args: never
        Returns: {
          code: string
          expires_at: string
        }[]
      }
      create_delivery_offer: {
        Args: {
          _courier_id: string
          _delivery_job_id: string
          _expires_at: string
        }
        Returns: string
      }
      create_merchant_application: {
        Args: {
          _address_line: string
          _category_id: string
          _city: string
          _contact_email: string
          _contact_phone: string
          _document: string
          _latitude?: number
          _legal_name: string
          _longitude?: number
          _name: string
          _neighborhood: string
          _state: string
        }
        Returns: string
      }
      create_order_atomic: {
        Args: {
          p_customer_user_id: string
          p_delivery_address: Json
          p_items: Json
          p_merchant_id: string
          p_observation?: string
          p_payment_method: string
          p_request_key: string
        }
        Returns: {
          order_id: string
          order_number: number
        }[]
      }
      create_order_atomic_v2: {
        Args: {
          p_coupon_code?: string
          p_customer_user_id: string
          p_delivery_address: Json
          p_fulfillment_type?: string
          p_items: Json
          p_merchant_id: string
          p_observation?: string
          p_payment_method: string
          p_request_key: string
        }
        Returns: {
          order_id: string
          order_number: number
        }[]
      }
      create_order_for_checkout_intent: {
        Args: {
          p_checkout_intent_key: string
          p_customer_user_id: string
          p_delivery_address: Json
          p_items: Json
          p_merchant_id: string
          p_observation?: string
          p_payment_method: string
          p_request_key: string
        }
        Returns: {
          order_id: string
          order_number: number
        }[]
      }
      create_order_for_checkout_intent_v2: {
        Args: {
          p_checkout_intent_key: string
          p_coupon_code?: string
          p_customer_user_id: string
          p_delivery_address: Json
          p_fulfillment_type?: string
          p_items: Json
          p_merchant_id: string
          p_observation?: string
          p_payment_method: string
          p_request_key: string
        }
        Returns: {
          order_id: string
          order_number: number
        }[]
      }
      create_support_ticket: {
        Args: {
          _category: string
          _delivery_job_id?: string
          _description: string
          _order_id?: string
          _subject: string
        }
        Returns: string
      }
      current_user_courier_id: { Args: never; Returns: string }
      current_user_is_active: { Args: never; Returns: boolean }
      current_user_is_admin: { Args: never; Returns: boolean }
      current_user_is_assigned_courier: {
        Args: { _order_id: string }
        Returns: boolean
      }
      current_user_is_merchant_manager: {
        Args: { _merchant_id: string }
        Returns: boolean
      }
      current_user_is_merchant_member: {
        Args: { _merchant_id: string }
        Returns: boolean
      }
      current_user_is_merchant_owner: {
        Args: { _merchant_id: string }
        Returns: boolean
      }
      current_user_owns_wallet: {
        Args: { _wallet_id: string }
        Returns: boolean
      }
      customer_cancel_order: {
        Args: { _order_id: string; _reason: string }
        Returns: Json
      }
      deactivate_own_account: { Args: never; Returns: undefined }
      delivery_zone_contains_point: {
        Args: { p_lat: number; p_lon: number; p_zone_id: string }
        Returns: boolean
      }
      dispatch_delivery_job_offers: {
        Args: { _delivery_job_id: string }
        Returns: number
      }
      enqueue_notification: {
        Args: {
          _body: string
          _data?: Json
          _event_key?: string
          _notification_type: string
          _title: string
          _user_id: string
        }
        Returns: string
      }
      ensure_cancelled_paid_order_refund: {
        Args: { _payment_id: string }
        Returns: string
      }
      ensure_delivery_job: { Args: { _order_id: string }; Returns: string }
      ensure_pickup_confirmation_secret: {
        Args: { _order_id: string }
        Returns: string
      }
      get_authorized_merchant_private_data: {
        Args: { _merchant_id?: string }
        Returns: {
          approved_at: string
          approved_by: string
          contact_email: string
          contact_phone: string
          document: string
          legal_name: string
          merchant_id: string
          owner_user_id: string
          rejection_reason: string
        }[]
      }
      get_courier_incoming_offers: { Args: never; Returns: Json }
      get_courier_metrics: { Args: { _timezone?: string }; Returns: Json }
      get_courier_payout_readiness: { Args: never; Returns: Json }
      get_delivery_checkout_readiness: { Args: never; Returns: Json }
      get_my_notification_feed: { Args: { _limit?: number }; Returns: Json }
      get_order_payment_provider: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      haversine_km: {
        Args: { p_lat1: number; p_lat2: number; p_lon1: number; p_lon2: number }
        Returns: number
      }
      is_valid_cpf: { Args: { _cpf: string }; Returns: boolean }
      manage_merchant_member: {
        Args: {
          _merchant_id: string
          _role: string
          _status?: string
          _user_id: string
        }
        Returns: undefined
      }
      mark_notification_read: {
        Args: { _notification_id: string }
        Returns: boolean
      }
      merchant_accepting_orders: {
        Args: { p_at?: string; p_merchant_id: string }
        Returns: boolean
      }
      merchant_mark_courier_settlement_paid: {
        Args: { _proof_storage_path?: string; _settlement_id: string }
        Returns: {
          admin_resolution_outcome: string | null
          admin_resolution_reason: string | null
          admin_resolved_at: string | null
          admin_resolved_by: string | null
          courier_confirmed_at: string | null
          courier_id: string
          created_at: string
          delivery_count: number
          dispute_reason: string | null
          disputed_at: string | null
          due_at: string
          id: string
          merchant_id: string
          merchant_marked_paid_at: string | null
          proof_storage_path: string | null
          settlement_date: string
          status: string
          total_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "courier_settlements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      merchant_reject_order: {
        Args: { _order_id: string; _reason: string }
        Returns: Json
      }
      merchant_request_courier: { Args: { _order_id: string }; Returns: string }
      merchant_subscription_in_good_standing: {
        Args: { _merchant_id: string }
        Returns: boolean
      }
      merchant_transition_order: {
        Args: { _new_status: string; _order_id: string }
        Returns: undefined
      }
      point_in_geojson_polygon: {
        Args: { p_lat: number; p_lon: number; p_polygon: Json }
        Returns: boolean
      }
      point_in_geojson_ring: {
        Args: { p_lat: number; p_lon: number; p_ring: Json }
        Returns: boolean
      }
      post_wallet_transaction: {
        Args: {
          _available_delta: number
          _balance_delta: number
          _description?: string
          _idempotency_key: string
          _reference_id?: string
          _reference_type?: string
          _reserved_delta: number
          _status?: string
          _transaction_type: string
          _wallet_id: string
        }
        Returns: string
      }
      preview_checkout_fee: { Args: { p_merchant_id: string }; Returns: number }
      preview_coupon: {
        Args: { p_code: string; p_merchant_id: string; p_subtotal: number }
        Returns: {
          code: string
          coupon_id: string
          discount_amount: number
          discount_type: string
          discount_value: number
        }[]
      }
      preview_delivery_quote: {
        Args: { p_delivery_address: Json; p_merchant_id: string }
        Returns: {
          delivery_fee: number
          distance_km: number
          eligible: boolean
          minimum_order: number
          reason: string
          zone_id: string
        }[]
      }
      read_all_my_notifications: { Args: never; Returns: number }
      read_my_notification: {
        Args: { _notification_id: string }
        Returns: undefined
      }
      register_courier_push_device: {
        Args: { _platform?: string; _token: string }
        Returns: string
      }
      register_courier_push_device_v2: {
        Args: { _app_package?: string; _platform?: string; _token: string }
        Returns: string
      }
      register_customer_push_device: {
        Args: { _platform?: string; _token: string }
        Returns: string
      }
      register_superapp_customer_push_device: {
        Args: { _app_package?: string; _platform?: string; _token: string }
        Returns: string
      }
      reject_delivery_offer: { Args: { _offer_id: string }; Returns: undefined }
      reject_order: {
        Args: { _order_id: string; _reason: string }
        Returns: undefined
      }
      remove_courier_push_devices: { Args: never; Returns: undefined }
      remove_customer_push_devices: { Args: never; Returns: undefined }
      remove_superapp_customer_push_devices: {
        Args: { _app_package?: string }
        Returns: undefined
      }
      request_own_account_deletion: { Args: never; Returns: string }
      request_payout: {
        Args: { _amount: number; _idempotency_key: string; _wallet_id: string }
        Returns: string
      }
      reserve_paid_order_merchant_net: {
        Args: { _order_id: string }
        Returns: number
      }
      resolve_delivery_quote: {
        Args: { p_delivery_address: Json; p_merchant_id: string }
        Returns: {
          delivery_fee: number
          distance_km: number
          eligible: boolean
          minimum_order: number
          reason: string
          zone_id: string
        }[]
      }
      resubmit_merchant_application: {
        Args: { _merchant_id: string }
        Returns: undefined
      }
      reverse_paid_order_merchant_reserve: {
        Args: { _order_id: string }
        Returns: undefined
      }
      set_courier_online: {
        Args: { _is_online: boolean }
        Returns: {
          courier_id: string
          is_online: boolean
          last_seen_at: string
          online_since: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "courier_availability"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_default_customer_address: {
        Args: { _address_id: string }
        Returns: undefined
      }
      set_merchant_mapped_location: {
        Args: { _latitude: number; _longitude: number }
        Returns: string
      }
      settle_delivered_order_financials: {
        Args: { _order_id: string }
        Returns: undefined
      }
      settle_payout: {
        Args: {
          _failure_reason?: string
          _new_status: string
          _payout_id: string
          _provider?: string
          _provider_payout_id?: string
        }
        Returns: undefined
      }
      submit_courier_application: { Args: { _payload: Json }; Returns: string }
      submit_order_product_reviews: {
        Args: { _order_id: string; _products: Json }
        Returns: number
      }
      submit_order_review: {
        Args: {
          _comment?: string
          _courier_rating?: number
          _merchant_rating: number
          _order_id: string
        }
        Returns: string
      }
      submit_order_review_with_products: {
        Args: {
          _comment: string
          _courier_rating: number
          _merchant_rating: number
          _order_id: string
          _products: Json
        }
        Returns: string
      }
      update_courier_delivery_route_metrics: {
        Args: {
          _delivery_job_id: string
          _distance_meters: number
          _duration_seconds: number
        }
        Returns: boolean
      }
      update_courier_location: {
        Args: {
          _accuracy_meters?: number
          _heading?: number
          _latitude: number
          _longitude: number
          _speed_mps?: number
        }
        Returns: undefined
      }
      uuid_or_null: { Args: { _value: string }; Returns: string }
      verify_payout_dispatch_runtime_key: {
        Args: { _candidate: string }
        Returns: boolean
      }
      verify_push_dispatch_key: {
        Args: { _candidate: string }
        Returns: boolean
      }
      verify_push_dispatch_runtime_key: {
        Args: { _candidate: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "customer" | "driver" | "merchant"
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
      app_role: ["admin", "customer", "driver", "merchant"],
    },
  },
} as const
