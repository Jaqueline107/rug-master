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
      costureiras: {
        Row: {
          ativa: boolean
          created_at: string
          endereco: string | null
          id: string
          nome: string
          observacoes: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          created_at?: string
          endereco?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          created_at?: string
          endereco?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      insumos: {
        Row: {
          created_at: string
          id: string
          nome: string
          observacoes: string | null
          unidade: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          observacoes?: string | null
          unidade?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          observacoes?: string | null
          unidade?: string
          updated_at?: string
        }
        Relationships: []
      }
      precos: {
        Row: {
          costureira_id: string
          created_at: string
          id: string
          servico_id: string
          tipo_tapete_id: string
          updated_at: string
          valor: number
        }
        Insert: {
          costureira_id: string
          created_at?: string
          id?: string
          servico_id: string
          tipo_tapete_id: string
          updated_at?: string
          valor?: number
        }
        Update: {
          costureira_id?: string
          created_at?: string
          id?: string
          servico_id?: string
          tipo_tapete_id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "precos_costureira_id_fkey"
            columns: ["costureira_id"]
            isOneToOne: false
            referencedRelation: "costureiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "precos_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "precos_tipo_tapete_id_fkey"
            columns: ["tipo_tapete_id"]
            isOneToOne: false
            referencedRelation: "tipos_tapete"
            referencedColumns: ["id"]
          },
        ]
      }
      remessa_itens: {
        Row: {
          created_at: string
          id: string
          preco_unitario: number
          quantidade_enviada: number
          quantidade_retornada: number
          remessa_id: string
          servico_id: string
          tapete_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          preco_unitario?: number
          quantidade_enviada?: number
          quantidade_retornada?: number
          remessa_id: string
          servico_id: string
          tapete_id: string
        }
        Update: {
          created_at?: string
          id?: string
          preco_unitario?: number
          quantidade_enviada?: number
          quantidade_retornada?: number
          remessa_id?: string
          servico_id?: string
          tapete_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "remessa_itens_remessa_id_fkey"
            columns: ["remessa_id"]
            isOneToOne: false
            referencedRelation: "remessas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remessa_itens_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remessa_itens_tapete_id_fkey"
            columns: ["tapete_id"]
            isOneToOne: false
            referencedRelation: "tapetes"
            referencedColumns: ["id"]
          },
        ]
      }
      remessas: {
        Row: {
          costureira_id: string
          created_at: string
          data_envio: string
          data_prevista_retorno: string | null
          id: string
          numero: number
          observacoes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          costureira_id: string
          created_at?: string
          data_envio?: string
          data_prevista_retorno?: string | null
          id?: string
          numero?: number
          observacoes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          costureira_id?: string
          created_at?: string
          data_envio?: string
          data_prevista_retorno?: string | null
          id?: string
          numero?: number
          observacoes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "remessas_costureira_id_fkey"
            columns: ["costureira_id"]
            isOneToOne: false
            referencedRelation: "costureiras"
            referencedColumns: ["id"]
          },
        ]
      }
      retorno_itens: {
        Row: {
          created_at: string
          id: string
          quantidade: number
          remessa_item_id: string
          retorno_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          quantidade?: number
          remessa_item_id: string
          retorno_id: string
        }
        Update: {
          created_at?: string
          id?: string
          quantidade?: number
          remessa_item_id?: string
          retorno_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "retorno_itens_remessa_item_id_fkey"
            columns: ["remessa_item_id"]
            isOneToOne: false
            referencedRelation: "remessa_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retorno_itens_retorno_id_fkey"
            columns: ["retorno_id"]
            isOneToOne: false
            referencedRelation: "retornos"
            referencedColumns: ["id"]
          },
        ]
      }
      retornos: {
        Row: {
          created_at: string
          data_retorno: string
          id: string
          observacoes: string | null
          remessa_id: string
        }
        Insert: {
          created_at?: string
          data_retorno?: string
          id?: string
          observacoes?: string | null
          remessa_id: string
        }
        Update: {
          created_at?: string
          data_retorno?: string
          id?: string
          observacoes?: string | null
          remessa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "retornos_remessa_id_fkey"
            columns: ["remessa_id"]
            isOneToOne: false
            referencedRelation: "remessas"
            referencedColumns: ["id"]
          },
        ]
      }
      servicos: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          insumo_id: string | null
          nome: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          insumo_id?: string | null
          nome: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          insumo_id?: string | null
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "servicos_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
        ]
      }
      tapetes: {
        Row: {
          codigo: string | null
          cor: string | null
          created_at: string
          id: string
          nome: string
          observacoes: string | null
          tipo_tapete_id: string
          updated_at: string
        }
        Insert: {
          codigo?: string | null
          cor?: string | null
          created_at?: string
          id?: string
          nome: string
          observacoes?: string | null
          tipo_tapete_id: string
          updated_at?: string
        }
        Update: {
          codigo?: string | null
          cor?: string | null
          created_at?: string
          id?: string
          nome?: string
          observacoes?: string | null
          tipo_tapete_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tapetes_tipo_tapete_id_fkey"
            columns: ["tipo_tapete_id"]
            isOneToOne: false
            referencedRelation: "tipos_tapete"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_tapete: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          nome: string
          numero_pecas: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          numero_pecas?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          numero_pecas?: number
          updated_at?: string
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
      [_ in never]: never
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
    Enums: {},
  },
} as const
