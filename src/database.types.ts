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
      calculos_precificacao: {
        Row: {
          cliente: string | null
          configuracao: Json
          created_at: string
          created_by: string
          descricao: string | null
          id: string
          material_id: string | null
          nome_projeto: string
          resultado: Json
          updated_at: string
        }
        Insert: {
          cliente?: string | null
          configuracao?: Json
          created_at?: string
          created_by?: string
          descricao?: string | null
          id?: string
          material_id?: string | null
          nome_projeto: string
          resultado?: Json
          updated_at?: string
        }
        Update: {
          cliente?: string | null
          configuracao?: Json
          created_at?: string
          created_by?: string
          descricao?: string | null
          id?: string
          material_id?: string | null
          nome_projeto?: string
          resultado?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calculos_precificacao_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiais"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogo_categorias: {
        Row: {
          ativa: boolean
          created_at: string
          id: string
          marketplace: boolean
          nome: string
          slug: string
        }
        Insert: {
          ativa?: boolean
          created_at?: string
          id?: string
          marketplace?: boolean
          nome: string
          slug: string
        }
        Update: {
          ativa?: boolean
          created_at?: string
          id?: string
          marketplace?: boolean
          nome?: string
          slug?: string
        }
        Relationships: []
      }
      catalogo_imagens: {
        Row: {
          alt: string
          arquivo: string
          caminho: string
          created_at: string
          estado: string
          id: string
          material_id: string
          miniatura: string
          ordem: number
          substitui: string | null
        }
        Insert: {
          alt?: string
          arquivo: string
          caminho: string
          created_at?: string
          estado?: string
          id?: string
          material_id: string
          miniatura: string
          ordem?: number
          substitui?: string | null
        }
        Update: {
          alt?: string
          arquivo?: string
          caminho?: string
          created_at?: string
          estado?: string
          id?: string
          material_id?: string
          miniatura?: string
          ordem?: number
          substitui?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalogo_imagens_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "catalogo_produtos"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "catalogo_imagens_substitui_fkey"
            columns: ["substitui"]
            isOneToOne: false
            referencedRelation: "catalogo_imagens"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogo_indicacoes: {
        Row: {
          categoria_id: string
          cores: string
          created_at: string
          descricao: string
          destaque: boolean
          dimensoes: string
          imagem_externa: string | null
          link_marketplace: string
          material: string
          material_id: string
          ordem: number
          personalizavel: boolean
          peso_gramas: number | null
          prazo: string
          preco_centavos: number
          promocional_centavos: number | null
          resumo: string
          slug: string
          status: string
          titulo: string
          updated_at: string
          versao: number
        }
        Insert: {
          categoria_id: string
          cores?: string
          created_at?: string
          descricao?: string
          destaque?: boolean
          dimensoes?: string
          imagem_externa?: string | null
          link_marketplace: string
          material?: string
          material_id?: string
          ordem?: number
          personalizavel?: boolean
          peso_gramas?: number | null
          prazo?: string
          preco_centavos?: number
          promocional_centavos?: number | null
          resumo?: string
          slug: string
          status?: string
          titulo: string
          updated_at?: string
          versao?: number
        }
        Update: {
          categoria_id?: string
          cores?: string
          created_at?: string
          descricao?: string
          destaque?: boolean
          dimensoes?: string
          imagem_externa?: string | null
          link_marketplace?: string
          material?: string
          material_id?: string
          ordem?: number
          personalizavel?: boolean
          peso_gramas?: number | null
          prazo?: string
          preco_centavos?: number
          promocional_centavos?: number | null
          resumo?: string
          slug?: string
          status?: string
          titulo?: string
          updated_at?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "catalogo_indicacoes_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "catalogo_categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogo_produtos: {
        Row: {
          categoria_id: string | null
          cores: string
          created_at: string
          descricao: string
          destaque: boolean
          dimensoes: string
          link_marketplace: string | null
          material: string
          material_id: string
          ordem: number
          personalizavel: boolean
          peso_gramas: number | null
          prazo: string
          preco_centavos: number
          promocional_centavos: number | null
          resumo: string
          slug: string
          status: string
          titulo: string
          updated_at: string
          versao: number
        }
        Insert: {
          categoria_id?: string | null
          cores?: string
          created_at?: string
          descricao?: string
          destaque?: boolean
          dimensoes?: string
          link_marketplace?: string | null
          material?: string
          material_id: string
          ordem?: number
          personalizavel?: boolean
          peso_gramas?: number | null
          prazo?: string
          preco_centavos?: number
          promocional_centavos?: number | null
          resumo?: string
          slug: string
          status?: string
          titulo?: string
          updated_at?: string
          versao?: number
        }
        Update: {
          categoria_id?: string | null
          cores?: string
          created_at?: string
          descricao?: string
          destaque?: boolean
          dimensoes?: string
          link_marketplace?: string | null
          material?: string
          material_id?: string
          ordem?: number
          personalizavel?: boolean
          peso_gramas?: number | null
          prazo?: string
          preco_centavos?: number
          promocional_centavos?: number | null
          resumo?: string
          slug?: string
          status?: string
          titulo?: string
          updated_at?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "catalogo_produtos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "catalogo_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalogo_produtos_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: true
            referencedRelation: "materiais"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogo_slugs: {
        Row: {
          material_id: string
          slug: string
        }
        Insert: {
          material_id: string
          slug: string
        }
        Update: {
          material_id?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalogo_slugs_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "catalogo_produtos"
            referencedColumns: ["material_id"]
          },
        ]
      }
      compras: {
        Row: {
          created_at: string
          custo_unitario: number
          data: string
          fornecedor: string | null
          id: string
          local_estoque_id: string
          material_id: string
          quantidade: number
        }
        Insert: {
          created_at?: string
          custo_unitario: number
          data?: string
          fornecedor?: string | null
          id?: string
          local_estoque_id: string
          material_id: string
          quantidade: number
        }
        Update: {
          created_at?: string
          custo_unitario?: number
          data?: string
          fornecedor?: string | null
          id?: string
          local_estoque_id?: string
          material_id?: string
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "compras_local_estoque_id_fkey"
            columns: ["local_estoque_id"]
            isOneToOne: false
            referencedRelation: "locais_estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiais"
            referencedColumns: ["id"]
          },
        ]
      }
      consignacao_movimentos: {
        Row: {
          created_at: string
          criado_por: string | null
          id: string
          local_id: string
          material_id: string
          observacoes: string | null
          quantidade: number
          saldo_apos: number
          tipo: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          id?: string
          local_id: string
          material_id: string
          observacoes?: string | null
          quantidade: number
          saldo_apos: number
          tipo: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          id?: string
          local_id?: string
          material_id?: string
          observacoes?: string | null
          quantidade?: number
          saldo_apos?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "consignacao_movimentos_local_id_fkey"
            columns: ["local_id"]
            isOneToOne: false
            referencedRelation: "locais_estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consignacao_movimentos_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiais"
            referencedColumns: ["id"]
          },
        ]
      }
      consignacao_pagamentos: {
        Row: {
          caixa: string | null
          created_at: string
          criado_por: string | null
          data_pagamento: string
          estornado_em: string | null
          id: string
          local_id: string
          observacoes: string | null
          valor_centavos: number
        }
        Insert: {
          caixa?: string | null
          created_at?: string
          criado_por?: string | null
          data_pagamento: string
          estornado_em?: string | null
          id?: string
          local_id: string
          observacoes?: string | null
          valor_centavos: number
        }
        Update: {
          caixa?: string | null
          created_at?: string
          criado_por?: string | null
          data_pagamento?: string
          estornado_em?: string | null
          id?: string
          local_id?: string
          observacoes?: string | null
          valor_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "consignacao_pagamentos_caixa_fkey"
            columns: ["caixa"]
            isOneToOne: false
            referencedRelation: "financeiro_caixas"
            referencedColumns: ["nome"]
          },
          {
            foreignKeyName: "consignacao_pagamentos_local_id_fkey"
            columns: ["local_id"]
            isOneToOne: false
            referencedRelation: "locais_estoque"
            referencedColumns: ["id"]
          },
        ]
      }
      consignacao_produtos: {
        Row: {
          created_at: string
          local_id: string
          material_id: string
          preco_centavos: number
          repasse_centavos: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          local_id: string
          material_id: string
          preco_centavos: number
          repasse_centavos: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          local_id?: string
          material_id?: string
          preco_centavos?: number
          repasse_centavos?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consignacao_produtos_local_id_fkey"
            columns: ["local_id"]
            isOneToOne: false
            referencedRelation: "locais_estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consignacao_produtos_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiais"
            referencedColumns: ["id"]
          },
        ]
      }
      consignacao_vendas: {
        Row: {
          acordo_registrado: boolean
          created_at: string
          data: string
          devolvida_em: string | null
          id: string
          local_id: string
          material_id: string
          pagamento_id: string | null
          preco_unitario_centavos: number
          quantidade: number
          repasse_total_centavos: number
          repasse_unitario_centavos: number
          total_centavos: number
        }
        Insert: {
          acordo_registrado?: boolean
          created_at?: string
          data: string
          devolvida_em?: string | null
          id: string
          local_id: string
          material_id: string
          pagamento_id?: string | null
          preco_unitario_centavos: number
          quantidade: number
          repasse_total_centavos: number
          repasse_unitario_centavos: number
          total_centavos: number
        }
        Update: {
          acordo_registrado?: boolean
          created_at?: string
          data?: string
          devolvida_em?: string | null
          id?: string
          local_id?: string
          material_id?: string
          pagamento_id?: string | null
          preco_unitario_centavos?: number
          quantidade?: number
          repasse_total_centavos?: number
          repasse_unitario_centavos?: number
          total_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "consignacao_vendas_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consignacao_vendas_local_id_fkey"
            columns: ["local_id"]
            isOneToOne: false
            referencedRelation: "locais_estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consignacao_vendas_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consignacao_vendas_pagamento_id_local_id_fkey"
            columns: ["pagamento_id", "local_id"]
            isOneToOne: false
            referencedRelation: "consignacao_pagamentos"
            referencedColumns: ["id", "local_id"]
          },
        ]
      }
      estoque_por_local: {
        Row: {
          local_id: string
          material_id: string
          quantidade: number
          updated_at: string
        }
        Insert: {
          local_id: string
          material_id: string
          quantidade?: number
          updated_at?: string
        }
        Update: {
          local_id?: string
          material_id?: string
          quantidade?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_por_local_local_id_fkey"
            columns: ["local_id"]
            isOneToOne: false
            referencedRelation: "locais_estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_por_local_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiais"
            referencedColumns: ["id"]
          },
        ]
      }
      filamento_estoque: {
        Row: {
          caixa: string
          categoria: string
          cor_hex: string
          cor_nome: string
          custo_medio_centavos: number
          id: string
          marca_id: string
          quantidade_gramas: number
          tipo: string
          updated_at: string
        }
        Insert: {
          caixa: string
          categoria: string
          cor_hex: string
          cor_nome: string
          custo_medio_centavos?: number
          id?: string
          marca_id: string
          quantidade_gramas?: number
          tipo: string
          updated_at?: string
        }
        Update: {
          caixa?: string
          categoria?: string
          cor_hex?: string
          cor_nome?: string
          custo_medio_centavos?: number
          id?: string
          marca_id?: string
          quantidade_gramas?: number
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "filamento_estoque_marca_id_fkey"
            columns: ["marca_id"]
            isOneToOne: false
            referencedRelation: "filamento_marcas"
            referencedColumns: ["id"]
          },
        ]
      }
      filamento_marcas: {
        Row: {
          created_at: string
          id: string
          nome: string
          valor_medio_centavos: number
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          valor_medio_centavos: number
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          valor_medio_centavos?: number
        }
        Relationships: []
      }
      filamento_movimentos: {
        Row: {
          created_at: string
          criado_por: string
          dados: Json
          data: string
          estoque_id: string
          estorno_de: string | null
          id: string
          observacao: string
          quantidade_gramas: number
          requisicao: string
          tipo: string
          valor_kg_centavos: number
        }
        Insert: {
          created_at?: string
          criado_por: string
          dados: Json
          data: string
          estoque_id: string
          estorno_de?: string | null
          id?: string
          observacao?: string
          quantidade_gramas: number
          requisicao: string
          tipo: string
          valor_kg_centavos: number
        }
        Update: {
          created_at?: string
          criado_por?: string
          dados?: Json
          data?: string
          estoque_id?: string
          estorno_de?: string | null
          id?: string
          observacao?: string
          quantidade_gramas?: number
          requisicao?: string
          tipo?: string
          valor_kg_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "filamento_movimentos_estoque_id_fkey"
            columns: ["estoque_id"]
            isOneToOne: false
            referencedRelation: "filamento_estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "filamento_movimentos_estorno_de_fkey"
            columns: ["estorno_de"]
            isOneToOne: true
            referencedRelation: "filamento_movimentos"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_abertura: {
        Row: {
          created_at: string
          criado_por: string | null
          data: string
          id: boolean
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          data: string
          id?: boolean
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          data?: string
          id?: boolean
        }
        Relationships: []
      }
      financeiro_caixas: {
        Row: {
          nome: string
        }
        Insert: {
          nome: string
        }
        Update: {
          nome?: string
        }
        Relationships: []
      }
      financeiro_cartoes: {
        Row: {
          ativo: boolean
          banco: string | null
          created_at: string
          dia_fechamento: number | null
          dia_vencimento: number
          id: string
          nome: string
          ultimos_quatro: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          banco?: string | null
          created_at?: string
          dia_fechamento?: number | null
          dia_vencimento: number
          id?: string
          nome: string
          ultimos_quatro?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          banco?: string | null
          created_at?: string
          dia_fechamento?: number | null
          dia_vencimento?: number
          id?: string
          nome?: string
          ultimos_quatro?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      financeiro_categorias: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      financeiro_despesas: {
        Row: {
          cartao_id: string | null
          categoria_id: string | null
          created_at: string
          data_compra: string
          descricao: string | null
          forma_pagamento: string
          fornecedor: string | null
          id: string
          nome: string
          numero_compra: string | null
          observacoes: string | null
          primeiro_vencimento: string
          quantidade_parcelas: number
          responsavel_empresa: boolean
          responsavel_socio_id: string | null
          updated_at: string
          valor_total_centavos: number
        }
        Insert: {
          cartao_id?: string | null
          categoria_id?: string | null
          created_at?: string
          data_compra?: string
          descricao?: string | null
          forma_pagamento: string
          fornecedor?: string | null
          id?: string
          nome: string
          numero_compra?: string | null
          observacoes?: string | null
          primeiro_vencimento: string
          quantidade_parcelas?: number
          responsavel_empresa?: boolean
          responsavel_socio_id?: string | null
          updated_at?: string
          valor_total_centavos: number
        }
        Update: {
          cartao_id?: string | null
          categoria_id?: string | null
          created_at?: string
          data_compra?: string
          descricao?: string | null
          forma_pagamento?: string
          fornecedor?: string | null
          id?: string
          nome?: string
          numero_compra?: string | null
          observacoes?: string | null
          primeiro_vencimento?: string
          quantidade_parcelas?: number
          responsavel_empresa?: boolean
          responsavel_socio_id?: string | null
          updated_at?: string
          valor_total_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_despesas_cartao_id_fkey"
            columns: ["cartao_id"]
            isOneToOne: false
            referencedRelation: "financeiro_cartoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_despesas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "financeiro_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_despesas_responsavel_socio_id_fkey"
            columns: ["responsavel_socio_id"]
            isOneToOne: false
            referencedRelation: "financeiro_socios"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_movimentos: {
        Row: {
          caixa: string
          created_at: string
          criado_por: string | null
          data: string
          descricao: string
          estorno_de: string | null
          id: string
          origem_id: string | null
          tipo: string
          valor_centavos: number
        }
        Insert: {
          caixa: string
          created_at?: string
          criado_por?: string | null
          data: string
          descricao: string
          estorno_de?: string | null
          id?: string
          origem_id?: string | null
          tipo: string
          valor_centavos: number
        }
        Update: {
          caixa?: string
          created_at?: string
          criado_por?: string | null
          data?: string
          descricao?: string
          estorno_de?: string | null
          id?: string
          origem_id?: string | null
          tipo?: string
          valor_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_movimentos_caixa_fkey"
            columns: ["caixa"]
            isOneToOne: false
            referencedRelation: "financeiro_caixas"
            referencedColumns: ["nome"]
          },
          {
            foreignKeyName: "financeiro_movimentos_estorno_de_fkey"
            columns: ["estorno_de"]
            isOneToOne: true
            referencedRelation: "financeiro_movimentos"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_pagamentos_parcela: {
        Row: {
          caixa: string | null
          created_at: string
          data_pagamento: string
          estornado_em: string | null
          id: string
          observacao: string | null
          pago_por_tipo: string
          parcela_id: string
          socio_id: string | null
          valor_centavos: number
        }
        Insert: {
          caixa?: string | null
          created_at?: string
          data_pagamento?: string
          estornado_em?: string | null
          id?: string
          observacao?: string | null
          pago_por_tipo: string
          parcela_id: string
          socio_id?: string | null
          valor_centavos: number
        }
        Update: {
          caixa?: string | null
          created_at?: string
          data_pagamento?: string
          estornado_em?: string | null
          id?: string
          observacao?: string | null
          pago_por_tipo?: string
          parcela_id?: string
          socio_id?: string | null
          valor_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_pagamentos_parcela_caixa_fkey"
            columns: ["caixa"]
            isOneToOne: false
            referencedRelation: "financeiro_caixas"
            referencedColumns: ["nome"]
          },
          {
            foreignKeyName: "financeiro_pagamentos_parcela_parcela_id_fkey"
            columns: ["parcela_id"]
            isOneToOne: false
            referencedRelation: "financeiro_parcelas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_pagamentos_parcela_socio_id_fkey"
            columns: ["socio_id"]
            isOneToOne: false
            referencedRelation: "financeiro_socios"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_parcelas: {
        Row: {
          created_at: string
          data_pagamento: string | null
          despesa_id: string
          id: string
          numero: number
          pago: boolean
          pago_por_observacao: string | null
          pago_por_socio_id: string | null
          pago_por_tipo: string | null
          total_parcelas: number
          updated_at: string
          valor_centavos: number
          vencimento: string
        }
        Insert: {
          created_at?: string
          data_pagamento?: string | null
          despesa_id: string
          id?: string
          numero: number
          pago?: boolean
          pago_por_observacao?: string | null
          pago_por_socio_id?: string | null
          pago_por_tipo?: string | null
          total_parcelas: number
          updated_at?: string
          valor_centavos: number
          vencimento: string
        }
        Update: {
          created_at?: string
          data_pagamento?: string | null
          despesa_id?: string
          id?: string
          numero?: number
          pago?: boolean
          pago_por_observacao?: string | null
          pago_por_socio_id?: string | null
          pago_por_tipo?: string | null
          total_parcelas?: number
          updated_at?: string
          valor_centavos?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_parcelas_despesa_id_fkey"
            columns: ["despesa_id"]
            isOneToOne: false
            referencedRelation: "financeiro_despesas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_parcelas_despesa_id_fkey"
            columns: ["despesa_id"]
            isOneToOne: false
            referencedRelation: "financeiro_despesas_resumo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_parcelas_pago_por_socio_id_fkey"
            columns: ["pago_por_socio_id"]
            isOneToOne: false
            referencedRelation: "financeiro_socios"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_reembolso_itens: {
        Row: {
          pagamento_id: string
          reembolso_id: string
          valor_centavos: number
        }
        Insert: {
          pagamento_id: string
          reembolso_id: string
          valor_centavos: number
        }
        Update: {
          pagamento_id?: string
          reembolso_id?: string
          valor_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_reembolso_itens_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "financeiro_pagamentos_parcela"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_reembolso_itens_reembolso_id_fkey"
            columns: ["reembolso_id"]
            isOneToOne: false
            referencedRelation: "financeiro_reembolsos"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_reembolsos: {
        Row: {
          data: string
          id: string
          movimento_id: string
          observacao: string | null
          socio_id: string
          valor_centavos: number
        }
        Insert: {
          data: string
          id?: string
          movimento_id: string
          observacao?: string | null
          socio_id: string
          valor_centavos: number
        }
        Update: {
          data?: string
          id?: string
          movimento_id?: string
          observacao?: string | null
          socio_id?: string
          valor_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_reembolsos_movimento_id_fkey"
            columns: ["movimento_id"]
            isOneToOne: true
            referencedRelation: "financeiro_movimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_reembolsos_socio_id_fkey"
            columns: ["socio_id"]
            isOneToOne: false
            referencedRelation: "financeiro_socios"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_requisicoes: {
        Row: {
          acao: string
          autor: string
          dados: Json
          id: string
          resultado: Json
        }
        Insert: {
          acao: string
          autor: string
          dados: Json
          id: string
          resultado: Json
        }
        Update: {
          acao?: string
          autor?: string
          dados?: Json
          id?: string
          resultado?: Json
        }
        Relationships: []
      }
      financeiro_socios: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          percentual_bp: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          percentual_bp: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          percentual_bp?: number
          updated_at?: string
        }
        Relationships: []
      }
      locais_estoque: {
        Row: {
          ativo: boolean
          created_at: string
          email: string | null
          endereco: string | null
          id: string
          nome: string
          observacoes: string | null
          responsavel: string | null
          telefone: string | null
          tipo: Database["public"]["Enums"]["tipo_local"]
          updated_at: string
          url: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          responsavel?: string | null
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["tipo_local"]
          updated_at?: string
          url?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          responsavel?: string | null
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["tipo_local"]
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      materiais: {
        Row: {
          categoria: string
          codigo: number
          created_at: string
          custo_medio: number
          filamento_gramas: number
          filamento_valor_kg: number
          id: string
          imagem_url: string | null
          nome: string
          quantidade_atual: number
          unidade: string
          updated_at: string
        }
        Insert: {
          categoria?: string
          codigo?: number
          created_at?: string
          custo_medio?: number
          filamento_gramas?: number
          filamento_valor_kg?: number
          id?: string
          imagem_url?: string | null
          nome: string
          quantidade_atual?: number
          unidade?: string
          updated_at?: string
        }
        Update: {
          categoria?: string
          codigo?: number
          created_at?: string
          custo_medio?: number
          filamento_gramas?: number
          filamento_valor_kg?: number
          id?: string
          imagem_url?: string | null
          nome?: string
          quantidade_atual?: number
          unidade?: string
          updated_at?: string
        }
        Relationships: []
      }
      pedido_itens: {
        Row: {
          caixa: string | null
          concluido: boolean
          created_at: string
          id: string
          local_estoque_id: string | null
          material_id: string
          pedido_id: string
          preco_unitario: number
          quantidade: number
          subtitulo: string | null
        }
        Insert: {
          caixa?: string | null
          concluido?: boolean
          created_at?: string
          id?: string
          local_estoque_id?: string | null
          material_id: string
          pedido_id: string
          preco_unitario: number
          quantidade: number
          subtitulo?: string | null
        }
        Update: {
          caixa?: string | null
          concluido?: boolean
          created_at?: string
          id?: string
          local_estoque_id?: string | null
          material_id?: string
          pedido_id?: string
          preco_unitario?: number
          quantidade?: number
          subtitulo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedido_itens_local_estoque_id_fkey"
            columns: ["local_estoque_id"]
            isOneToOne: false
            referencedRelation: "locais_estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos_financeiro"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_pagamentos: {
        Row: {
          caixa: string | null
          created_at: string
          data: string
          estornado_em: string | null
          id: string
          metodo: Database["public"]["Enums"]["metodo_pagamento"]
          observacao: string | null
          pedido_id: string
          valor: number
        }
        Insert: {
          caixa?: string | null
          created_at?: string
          data?: string
          estornado_em?: string | null
          id?: string
          metodo?: Database["public"]["Enums"]["metodo_pagamento"]
          observacao?: string | null
          pedido_id: string
          valor: number
        }
        Update: {
          caixa?: string | null
          created_at?: string
          data?: string
          estornado_em?: string | null
          id?: string
          metodo?: Database["public"]["Enums"]["metodo_pagamento"]
          observacao?: string | null
          pedido_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedido_pagamentos_caixa_fkey"
            columns: ["caixa"]
            isOneToOne: false
            referencedRelation: "financeiro_caixas"
            referencedColumns: ["nome"]
          },
          {
            foreignKeyName: "pedido_pagamentos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_pagamentos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos_financeiro"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_subtarefas: {
        Row: {
          concluido: boolean
          created_at: string
          id: string
          pedido_id: string
          titulo: string
          updated_at: string
        }
        Insert: {
          concluido?: boolean
          created_at?: string
          id?: string
          pedido_id: string
          titulo: string
          updated_at?: string
        }
        Update: {
          concluido?: boolean
          created_at?: string
          id?: string
          pedido_id?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedido_subtarefas_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_subtarefas_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos_financeiro"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          cliente: string
          created_at: string
          data_pedido: string
          desconto: number
          id: string
          links: string[]
          local_estoque_id: string | null
          observacao: string | null
          previsao_entrega: string | null
          prioridade: number | null
          situacao: string
          situacao_descricao: string
          status: Database["public"]["Enums"]["status_pedido"]
          updated_at: string
          valor_total: number
          vendedor_id: string | null
        }
        Insert: {
          cliente: string
          created_at?: string
          data_pedido?: string
          desconto?: number
          id?: string
          links?: string[]
          local_estoque_id?: string | null
          observacao?: string | null
          previsao_entrega?: string | null
          prioridade?: number | null
          situacao?: string
          situacao_descricao?: string
          status?: Database["public"]["Enums"]["status_pedido"]
          updated_at?: string
          valor_total?: number
          vendedor_id?: string | null
        }
        Update: {
          cliente?: string
          created_at?: string
          data_pedido?: string
          desconto?: number
          id?: string
          links?: string[]
          local_estoque_id?: string | null
          observacao?: string | null
          previsao_entrega?: string | null
          prioridade?: number | null
          situacao?: string
          situacao_descricao?: string
          status?: Database["public"]["Enums"]["status_pedido"]
          updated_at?: string
          valor_total?: number
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_local_estoque_id_fkey"
            columns: ["local_estoque_id"]
            isOneToOne: false
            referencedRelation: "locais_estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          perfil: Database["public"]["Enums"]["perfil_usuario"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id: string
          nome: string
          perfil?: Database["public"]["Enums"]["perfil_usuario"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          perfil?: Database["public"]["Enums"]["perfil_usuario"]
          updated_at?: string
        }
        Relationships: []
      }
      tarefas: {
        Row: {
          created_at: string
          descricao: string
          id: string
          pessoa_encarregada:
            | Database["public"]["Enums"]["pessoa_encarregada_tarefa"]
            | null
          previsao_entrega: string
          responsavel: string | null
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao: string
          id?: string
          pessoa_encarregada?:
            | Database["public"]["Enums"]["pessoa_encarregada_tarefa"]
            | null
          previsao_entrega: string
          responsavel?: string | null
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          pessoa_encarregada?:
            | Database["public"]["Enums"]["pessoa_encarregada_tarefa"]
            | null
          previsao_entrega?: string
          responsavel?: string | null
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      vendas: {
        Row: {
          caixa: string
          created_at: string
          custo_producao_venda: number | null
          data: string
          data_recebimento: string | null
          devolvida_em: string | null
          id: string
          local_estoque_id: string
          material_id: string
          motivo_alteracao: string | null
          pago: boolean
          pedido_id: string | null
          pedido_item_id: string | null
          preco_unitario: number
          quantidade: number
          retorno_local_id: string | null
          vendedor_id: string | null
          versao: number
        }
        Insert: {
          caixa?: string
          created_at?: string
          custo_producao_venda?: number | null
          data?: string
          data_recebimento?: string | null
          devolvida_em?: string | null
          id?: string
          local_estoque_id: string
          material_id: string
          motivo_alteracao?: string | null
          pago?: boolean
          pedido_id?: string | null
          pedido_item_id?: string | null
          preco_unitario: number
          quantidade: number
          retorno_local_id?: string | null
          vendedor_id?: string | null
          versao?: number
        }
        Update: {
          caixa?: string
          created_at?: string
          custo_producao_venda?: number | null
          data?: string
          data_recebimento?: string | null
          devolvida_em?: string | null
          id?: string
          local_estoque_id?: string
          material_id?: string
          motivo_alteracao?: string | null
          pago?: boolean
          pedido_id?: string | null
          pedido_item_id?: string | null
          preco_unitario?: number
          quantidade?: number
          retorno_local_id?: string | null
          vendedor_id?: string | null
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "vendas_local_estoque_id_fkey"
            columns: ["local_estoque_id"]
            isOneToOne: false
            referencedRelation: "locais_estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos_financeiro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_pedido_item_id_fkey"
            columns: ["pedido_item_id"]
            isOneToOne: true
            referencedRelation: "pedido_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_retorno_local_id_fkey"
            columns: ["retorno_local_id"]
            isOneToOne: false
            referencedRelation: "locais_estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      vendas_alteracoes: {
        Row: {
          antes: Json
          created_at: string
          criado_por: string | null
          depois: Json
          id: string
          motivo: string
          tipo: string
          venda_id: string
        }
        Insert: {
          antes: Json
          created_at?: string
          criado_por?: string | null
          depois: Json
          id?: string
          motivo: string
          tipo: string
          venda_id: string
        }
        Update: {
          antes?: Json
          created_at?: string
          criado_por?: string | null
          depois?: Json
          id?: string
          motivo?: string
          tipo?: string
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendas_alteracoes_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      vendedores: {
        Row: {
          ativo: boolean
          created_at: string
          endereco: string | null
          id: string
          local_estoque_id: string | null
          nome: string
          observacoes: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          endereco?: string | null
          id?: string
          local_estoque_id?: string | null
          nome: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          endereco?: string | null
          id?: string
          local_estoque_id?: string | null
          nome?: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendedores_local_estoque_id_fkey"
            columns: ["local_estoque_id"]
            isOneToOne: true
            referencedRelation: "locais_estoque"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      financeiro_despesas_resumo: {
        Row: {
          cartao_id: string | null
          categoria_id: string | null
          created_at: string | null
          data_compra: string | null
          descricao: string | null
          forma_pagamento: string | null
          fornecedor: string | null
          id: string | null
          nome: string | null
          numero_compra: string | null
          observacoes: string | null
          primeiro_vencimento: string | null
          quantidade_parcelas: number | null
          status: string | null
          total_pago_centavos: number | null
          total_pendente_centavos: number | null
          total_vencido_centavos: number | null
          updated_at: string | null
          valor_total_centavos: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_despesas_cartao_id_fkey"
            columns: ["cartao_id"]
            isOneToOne: false
            referencedRelation: "financeiro_cartoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_despesas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "financeiro_categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos_financeiro: {
        Row: {
          id: string | null
          saldo_pendente: number | null
          status_financeiro: string | null
          valor_pago: number | null
          valor_total: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      alterar_caixa_venda: {
        Args: { p_caixa: string; p_venda_id: string; p_versao: number }
        Returns: undefined
      }
      alterar_pagamento_venda:
        | {
            Args: { p_pago: boolean; p_venda_id: string; p_versao: number }
            Returns: undefined
          }
        | {
            Args: {
              p_data_recebimento: string
              p_pago: boolean
              p_venda_id: string
              p_versao: number
            }
            Returns: undefined
          }
      alterar_status_pedido:
        | {
            Args: {
              p_pedido_id: string
              p_status: Database["public"]["Enums"]["status_pedido"]
            }
            Returns: undefined
          }
        | {
            Args: {
              p_caixa: string
              p_pedido_id: string
              p_status: Database["public"]["Enums"]["status_pedido"]
            }
            Returns: undefined
          }
      catalogo_arquivo_permitido: {
        Args: { p_exclusao?: boolean; p_nome: string }
        Returns: boolean
      }
      catalogo_publico: {
        Args: {
          p_busca?: string
          p_categoria?: string
          p_offset?: number
          p_ordem?: string
          p_slug?: string
        }
        Returns: Json
      }
      corrigir_valor_item_pedido: {
        Args: {
          p_item_id: string
          p_motivo: string
          p_preco_anterior: number
          p_preco_unitario: number
        }
        Returns: undefined
      }
      devolver_venda: {
        Args: {
          p_local_id: string
          p_motivo: string
          p_venda_id: string
          p_versao: number
        }
        Returns: undefined
      }
      duplicar_catalogo: { Args: { p_produto: string }; Returns: string }
      editar_venda:
        | {
            Args: {
              p_data: string
              p_motivo: string
              p_preco_unitario: number
              p_venda_id: string
              p_vendedor_id: string
              p_versao: number
            }
            Returns: undefined
          }
        | {
            Args: {
              p_caixa: string
              p_data: string
              p_motivo: string
              p_preco_unitario: number
              p_venda_id: string
              p_vendedor_id: string
              p_versao: number
            }
            Returns: undefined
          }
      excluir_catalogo: { Args: { p_produto: string }; Returns: undefined }
      excluir_pagamentos_parcela: {
        Args: { p_parcela_id: string }
        Returns: undefined
      }
      financeiro_estornar_interno: {
        Args: { p_data: string; p_id: string; p_motivo: string }
        Returns: string
      }
      financeiro_extrato: {
        Args: {
          p_caixa?: string
          p_fim?: string
          p_inicio?: string
          p_offset?: number
          p_tipo?: string
        }
        Returns: Json
      }
      financeiro_lancar: {
        Args: {
          p_caixa: string
          p_data: string
          p_descricao: string
          p_estorno?: string
          p_origem: string
          p_tipo: string
          p_valor: number
        }
        Returns: string
      }
      financeiro_operar: {
        Args: { p_acao: string; p_dados: Json; p_requisicao: string }
        Returns: Json
      }
      financeiro_origem: {
        Args: { p_id: string; p_tipo: string }
        Returns: Json
      }
      financeiro_resumo: {
        Args: { p_fim?: string; p_inicio?: string }
        Returns: Json
      }
      financeiro_saldos_socios: {
        Args: never
        Returns: {
          adiantado_centavos: number
          id: string
          nome: string
          reembolsado_centavos: number
          saldo_centavos: number
        }[]
      }
      financeiro_travar: { Args: never; Returns: undefined }
      financeiro_validar_saldos: { Args: never; Returns: undefined }
      movimentar_consignacao: {
        Args: {
          p_local_id: string
          p_material_id: string
          p_observacoes?: string
          p_outro_local_id?: string
          p_preco_centavos?: number
          p_quantidade: number
          p_repasse_centavos?: number
          p_tipo: string
        }
        Returns: undefined
      }
      movimentar_filamento: {
        Args: { p_acao: string; p_dados: Json; p_requisicao: string }
        Returns: string
      }
      operar_imagem_catalogo: {
        Args: {
          p_acao: string
          p_dados?: Json
          p_imagem?: string
          p_produto: string
        }
        Returns: Json
      }
      ordenar_pedidos: {
        Args: {
          p_ids: string[]
          p_status: Database["public"]["Enums"]["status_pedido"]
        }
        Returns: undefined
      }
      pagar_repasses_consignacao:
        | {
            Args: {
              p_data: string
              p_local_id: string
              p_observacoes?: string
              p_vendas_ids: string[]
            }
            Returns: string
          }
        | {
            Args: {
              p_caixa: string
              p_data: string
              p_local_id: string
              p_observacoes: string
              p_vendas_ids: string[]
            }
            Returns: string
          }
      registrar_entrada: {
        Args: {
          p_custo_unitario: number
          p_data: string
          p_fornecedor: string
          p_local_id: string
          p_material_id: string
          p_quantidade: number
        }
        Returns: string
      }
      registrar_pagamento_parcela: {
        Args: {
          p_data_pagamento?: string
          p_observacao?: string
          p_pago: boolean
          p_pago_por_socio_id?: string
          p_pago_por_tipo?: string
          p_parcela_id: string
        }
        Returns: undefined
      }
      registrar_venda:
        | {
            Args: {
              p_data: string
              p_local_id: string
              p_material_id: string
              p_preco_unitario: number
              p_quantidade: number
              p_vendedor_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_caixa: string
              p_data: string
              p_local_id: string
              p_material_id: string
              p_preco_unitario: number
              p_quantidade: number
              p_vendedor_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_caixa: string
              p_data: string
              p_local_id: string
              p_material_id: string
              p_pago: boolean
              p_preco_unitario: number
              p_quantidade: number
              p_vendedor_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_caixa: string
              p_data: string
              p_data_recebimento: string
              p_local_id: string
              p_material_id: string
              p_pago: boolean
              p_preco_unitario: number
              p_quantidade: number
              p_vendedor_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_caixa: string
              p_data: string
              p_data_recebimento: string
              p_local_id: string
              p_material_id: string
              p_pago: boolean
              p_preco_unitario: number
              p_quantidade: number
              p_requisicao: string
              p_vendedor_id: string
            }
            Returns: string
          }
      remover_baixa_filamento: {
        Args: { p_movimento_id: string }
        Returns: string
      }
      salvar_acordo_consignacao: {
        Args: {
          p_local_id: string
          p_material_id: string
          p_preco_centavos: number
          p_repasse_centavos: number
        }
        Returns: undefined
      }
      salvar_catalogo: {
        Args: { p_dados: Json; p_material_id: string; p_versao?: number }
        Returns: {
          categoria_id: string | null
          cores: string
          created_at: string
          descricao: string
          destaque: boolean
          dimensoes: string
          link_marketplace: string | null
          material: string
          material_id: string
          ordem: number
          personalizavel: boolean
          peso_gramas: number | null
          prazo: string
          preco_centavos: number
          promocional_centavos: number | null
          resumo: string
          slug: string
          status: string
          titulo: string
          updated_at: string
          versao: number
        }
        SetofOptions: {
          from: "*"
          to: "catalogo_produtos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      salvar_despesa_financeira: {
        Args: { p_despesa: Json; p_despesa_id: string }
        Returns: string
      }
      salvar_material:
        | {
            Args: {
              p_custo_medio: number
              p_local_id: string
              p_material_id: string
              p_nome: string
              p_quantidade: number
            }
            Returns: string
          }
        | {
            Args: {
              p_categoria: string
              p_custo_medio: number
              p_local_id: string
              p_material_id: string
              p_nome: string
              p_quantidade: number
            }
            Returns: string
          }
        | {
            Args: {
              p_categoria: string
              p_custo_medio: number
              p_filamento_gramas: number
              p_filamento_valor_kg: number
              p_local_id: string
              p_material_id: string
              p_nome: string
              p_quantidade: number
            }
            Returns: string
          }
      salvar_pagamentos_parcela: {
        Args: { p_pagamentos: Json; p_parcela_id: string }
        Returns: undefined
      }
      salvar_pagamentos_parcelas: {
        Args: { p_itens: Json }
        Returns: undefined
      }
      salvar_pedido: {
        Args: { p_itens: Json; p_pedido: Json; p_pedido_id: string }
        Returns: string
      }
      transferir_estoque: {
        Args: {
          p_destino_id: string
          p_material_id: string
          p_origem_id: string
          p_quantidade: number
        }
        Returns: undefined
      }
      usuario_administrador: { Args: never; Returns: boolean }
      usuario_ativo: { Args: never; Returns: boolean }
      vender_consignacao:
        | {
            Args: {
              p_data: string
              p_local_id: string
              p_material_id: string
              p_preco_centavos: number
              p_quantidade: number
            }
            Returns: string
          }
        | {
            Args: {
              p_caixa: string
              p_data: string
              p_local_id: string
              p_material_id: string
              p_preco_centavos: number
              p_quantidade: number
            }
            Returns: string
          }
      vincular_local_vendedor: {
        Args: { p_local_id?: string; p_vendedor_id: string }
        Returns: string
      }
    }
    Enums: {
      metodo_pagamento:
        | "pix"
        | "dinheiro"
        | "cartao"
        | "transferencia"
        | "outro"
      perfil_usuario: "administrador" | "operador"
      pessoa_encarregada_tarefa: "Richard" | "Xandy" | "Ambos"
      status_pedido:
        | "recebido"
        | "em_preparacao"
        | "em_producao"
        | "embalagem"
        | "pronto"
        | "entregue"
      tipo_local: "principal" | "vendedor" | "estabelecimento" | "rua" | "outro"
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
      metodo_pagamento: ["pix", "dinheiro", "cartao", "transferencia", "outro"],
      perfil_usuario: ["administrador", "operador"],
      pessoa_encarregada_tarefa: ["Richard", "Xandy", "Ambos"],
      status_pedido: [
        "recebido",
        "em_preparacao",
        "em_producao",
        "embalagem",
        "pronto",
        "entregue",
      ],
      tipo_local: ["principal", "vendedor", "estabelecimento", "rua", "outro"],
    },
  },
} as const

