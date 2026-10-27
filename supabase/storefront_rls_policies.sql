-- =============================================================================
-- BERCALI STORE — POLÍTICAS RLS E FUNÇÃO TRANSACIONAL SEGURA PARA A LOJA ONLINE
-- =============================================================================
-- Projeto Supabase partilhado: dyhwbzyiuzrdmiogzwdg
--
-- Objetivo:
--   Permitir que a Loja Online pública (papel `anon`) funcione em total sincronia
--   com o Painel Administrativo (`authenticated`) sem desativar RLS, sem criar
--   tabelas duplicadas e sem expor dados privados de clientes, encomendas ou CRM.
--
-- Segurança garantida:
--   1. NÃO desativa RLS em nenhuma tabela.
--   2. Permite leitura pública (`SELECT TO anon`) apenas de:
--      - Categorias ativas (`categories`)
--      - Produtos publicados (`products`, ocultando `draft`/`rascunho`/`archived`/`inactive`)
--      - Multimédia de produtos publicados (`product_media`)
--      - Definições públicas comerciais e estado da loja (`store_settings`),
--        excluindo chaves sensíveis (`secret`, `token`, `pixel`, `private`, `crm`, `smtp`).
--   3. NÃO concede `SELECT`, `UPDATE` nem `DELETE` a `anon` em `customers`, `orders`,
--      `order_items`, `customer_notes`, `crm_tasks`, `activity_logs`, `profiles` ou
--      `marketing_settings` (Meta Pixel permanece desativado).
--   4. Regista encomendas públicas através da função transacional `create_storefront_order`
--      (`SECURITY DEFINER`) que:
--      - Verifica em tempo real na BD se a loja está ativa (`LOJA_ENCERRADA` se inativa);
--      - Impede duplicação por cliques repetidos (`order_number` idempotente);
--      - Recalcula preços unitários, subtotais e totais diretamente de `public.products`
--        (ignorando qualquer preço adulterado no navegador);
--      - Valida disponibilidade e stock (`STOCK_INSUFICIENTE`) e atualiza `stock_quantity`
--        quando `manage_stock = true`.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. LEITURA PÚBLICA DO CATÁLOGO E DEFINIÇÕES COMERCIAIS (`SELECT TO anon`)
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "bercali_storefront_select_active_categories" ON public.categories;
CREATE POLICY "bercali_storefront_select_active_categories"
  ON public.categories
  FOR SELECT
  TO anon
  USING (coalesce(is_active, true) = true);

DROP POLICY IF EXISTS "bercali_storefront_select_published_products" ON public.products;
CREATE POLICY "bercali_storefront_select_published_products"
  ON public.products
  FOR SELECT
  TO anon
  USING (
    coalesce(lower(trim(status)), '') NOT IN (
      'draft',
      'rascunho',
      'archived',
      'arquivado',
      'inactive',
      'inativo',
      'unpublished',
      'nao_publicado',
      'não_publicado',
      'hidden',
      'oculto',
      'deleted',
      'eliminado'
    )
  );

DROP POLICY IF EXISTS "bercali_storefront_select_published_product_media" ON public.product_media;
CREATE POLICY "bercali_storefront_select_published_product_media"
  ON public.product_media
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = product_media.product_id
        AND coalesce(lower(trim(p.status)), '') NOT IN (
          'draft',
          'rascunho',
          'archived',
          'arquivado',
          'inactive',
          'inativo',
          'unpublished',
          'nao_publicado',
          'não_publicado',
          'hidden',
          'oculto',
          'deleted',
          'eliminado'
        )
    )
  );

DROP POLICY IF EXISTS "bercali_storefront_select_public_store_settings" ON public.store_settings;
CREATE POLICY "bercali_storefront_select_public_store_settings"
  ON public.store_settings
  FOR SELECT
  TO anon
  USING (
    coalesce(lower(trim(setting_key)), '') <> ''
    AND lower(setting_key) NOT LIKE '%secret%'
    AND lower(setting_key) NOT LIKE '%token%'
    AND lower(setting_key) NOT LIKE '%pixel%'
    AND lower(setting_key) NOT LIKE '%private%'
    AND lower(setting_key) NOT LIKE '%internal%'
    AND lower(setting_key) NOT LIKE '%crm%'
    AND lower(setting_key) NOT LIKE '%smtp%'
    AND lower(setting_key) NOT LIKE '%password%'
    AND lower(setting_key) NOT LIKE '%api_key%'
  );

-- Remover eventuais políticas antigas de INSERT direto sem validação de preços no servidor,
-- garantindo que as encomendas públicas passam sempre pela validação de `create_storefront_order`.
DROP POLICY IF EXISTS "bercali_storefront_insert_customers" ON public.customers;
DROP POLICY IF EXISTS "bercali_storefront_insert_orders" ON public.orders;
DROP POLICY IF EXISTS "bercali_storefront_insert_order_items" ON public.order_items;

-- -----------------------------------------------------------------------------
-- 2. FUNÇÃO TRANSACIONAL VALIDADA NO SERVIDOR: `public.create_storefront_order`
-- -----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.create_storefront_order(
  text, text, text, text, text, text, text, numeric, numeric, numeric, numeric, text, jsonb
);

DROP FUNCTION IF EXISTS public.create_storefront_order(
  text, text, text, text, text, text, text, numeric, numeric, numeric, numeric, text, jsonb, text
);

CREATE OR REPLACE FUNCTION public.create_storefront_order(
  p_order_number text,
  p_full_name text,
  p_phone text,
  p_city text,
  p_customer_notes text,
  p_delivery_address text,
  p_internal_notes text,
  p_subtotal numeric,
  p_delivery_fee numeric,
  p_discount_amount numeric,
  p_total_amount numeric,
  p_currency text,
  p_items jsonb,
  p_email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_order_id uuid;
  v_customer_id uuid;
  v_order_id uuid;
  v_item jsonb;
  v_product record;
  v_product_id uuid;
  v_qty integer;
  v_unit_price numeric(12, 2);
  v_line_total numeric(12, 2);
  v_calculated_subtotal numeric(12, 2) := 0;
  v_validated_delivery_fee numeric(12, 2) := greatest(0, coalesce(p_delivery_fee, 0));
  v_calculated_total numeric(12, 2) := 0;
  v_store_active boolean := true;
  v_closed_message text := 'A loja encontra-se temporariamente encerrada para novas encomendas.';
  v_setting record;
  v_val_text text;
  v_clean_email text;
  v_normalized_items jsonb := '[]'::jsonb;
BEGIN
  -- 2.1. Verificar estado ativo / inativo da loja em `public.store_settings`
  FOR v_setting IN
    SELECT lower(trim(setting_key)) AS k, setting_value AS v
    FROM public.store_settings
  LOOP
    IF v_setting.k IN (
      'is_active', 'store_active', 'is_store_active', 'is_open', 'store_open', 'store_status'
    ) THEN
      v_val_text := lower(trim(both '"' from coalesce(v_setting.v::text, '')));
      IF v_val_text IN ('false', '0', 'no', 'nao', 'não', 'closed', 'fechada', 'encerrada', 'inactive', 'inativa', 'paused', 'pausada', 'maintenance', 'manutencao', 'manutenção') THEN
        v_store_active := false;
      ELSIF v_val_text IN ('true', '1', 'yes', 'sim', 'open', 'aberta', 'active', 'ativa') THEN
        v_store_active := true;
      END IF;
    ELSIF v_setting.k = 'maintenance_mode' THEN
      v_val_text := lower(trim(both '"' from coalesce(v_setting.v::text, '')));
      IF v_val_text IN ('true', '1', 'yes', 'sim') THEN
        v_store_active := false;
      END IF;
    ELSIF v_setting.k IN ('closed_message', 'inactive_message', 'closure_message', 'maintenance_message') THEN
      v_val_text := trim(both '"' from coalesce(v_setting.v::text, ''));
      IF length(v_val_text) > 0 AND v_val_text <> 'null' THEN
        v_closed_message := v_val_text;
      END IF;
    ELSIF jsonb_typeof(v_setting.v) = 'object' AND v_setting.k IN ('general', 'store', 'store_info', 'store_status', 'status', 'availability') THEN
      IF coalesce((v_setting.v->>'maintenance_mode')::boolean, false) = true THEN
        v_store_active := false;
      ELSIF v_setting.v ? 'is_store_active' THEN
        v_store_active := coalesce((v_setting.v->>'is_store_active')::boolean, true);
      ELSIF v_setting.v ? 'store_active' THEN
        v_store_active := coalesce((v_setting.v->>'store_active')::boolean, true);
      ELSIF v_setting.v ? 'is_open' THEN
        v_store_active := coalesce((v_setting.v->>'is_open')::boolean, true);
      ELSIF v_setting.v ? 'is_active' THEN
        v_store_active := coalesce((v_setting.v->>'is_active')::boolean, true);
      END IF;

      IF coalesce(trim(v_setting.v->>'closed_message'), '') <> '' THEN
        v_closed_message := trim(v_setting.v->>'closed_message');
      ELSIF coalesce(trim(v_setting.v->>'inactive_message'), '') <> '' THEN
        v_closed_message := trim(v_setting.v->>'inactive_message');
      END IF;
    END IF;
  END LOOP;

  IF NOT v_store_active THEN
    RAISE EXCEPTION 'LOJA_ENCERRADA: %', v_closed_message;
  END IF;

  -- 2.2. Validar campos obrigatórios do cliente e número de pedido
  IF length(trim(coalesce(p_order_number, ''))) < 4 THEN
    RAISE EXCEPTION 'Número de encomenda inválido.';
  END IF;

  IF length(trim(coalesce(p_full_name, ''))) < 3 THEN
    RAISE EXCEPTION 'Nome do cliente inválido.';
  END IF;

  IF length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) < 9 THEN
    RAISE EXCEPTION 'Telefone do cliente inválido.';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'A encomenda deve conter pelo menos um artigo.';
  END IF;

  -- 2.3. Proteção idempotente contra cliques repetidos / submissões duplicadas
  SELECT o.id
    INTO v_existing_order_id
    FROM public.orders o
   WHERE o.order_number = trim(p_order_number)
   LIMIT 1;

  IF v_existing_order_id IS NOT NULL THEN
    RETURN v_existing_order_id;
  END IF;

  -- 2.4. Validar cada produto, stock e preço oficial diretamente em `public.products`
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    BEGIN
      v_product_id := NULLIF(trim(coalesce(v_item->>'product_id', '')), '')::uuid;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'PRODUTO_INDISPONIVEL: Identificador de artigo inválido na encomenda.';
    END;

    v_qty := coalesce((v_item->>'quantity')::integer, 0);
    IF v_product_id IS NULL OR v_qty < 1 OR v_qty > 999 THEN
      RAISE EXCEPTION 'PRODUTO_INDISPONIVEL: Quantidade inválida para um dos artigos.';
    END IF;

    SELECT
      p.id,
      p.name,
      p.sku,
      p.price,
      p.sale_price,
      p.stock_quantity,
      p.manage_stock,
      p.is_available,
      p.status
    INTO v_product
    FROM public.products p
    WHERE p.id = v_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'PRODUTO_INDISPONIVEL: Um dos artigos selecionados já não existe no catálogo.';
    END IF;

    IF coalesce(lower(trim(v_product.status)), '') IN (
      'draft', 'rascunho', 'archived', 'arquivado', 'inactive', 'inativo',
      'unpublished', 'nao_publicado', 'não_publicado', 'hidden', 'oculto', 'deleted', 'eliminado',
      'out_of_stock', 'esgotado', 'sem_stock', 'unavailable', 'indisponivel', 'indisponível'
    ) OR coalesce(v_product.is_available, true) = false THEN
      RAISE EXCEPTION 'PRODUTO_INDISPONIVEL: O artigo "%" não está disponível para encomenda.', v_product.name;
    END IF;

    IF coalesce(v_product.manage_stock, true) = true THEN
      IF coalesce(v_product.stock_quantity, 0) < v_qty THEN
        RAISE EXCEPTION 'STOCK_INSUFICIENTE: Stock insuficiente para "%" (disponível: % un.).',
          v_product.name, coalesce(v_product.stock_quantity, 0);
      END IF;
    END IF;

    -- Preço unitário oficial calculado exclusivamente na BD (nunca confia no cliente)
    IF v_product.sale_price IS NOT NULL
       AND v_product.sale_price > 0
       AND (v_product.price IS NULL OR v_product.price <= 0 OR v_product.sale_price < v_product.price) THEN
      v_unit_price := v_product.sale_price;
    ELSE
      v_unit_price := greatest(0, coalesce(v_product.price, 0));
    END IF;

    v_line_total := v_unit_price * v_qty;
    v_calculated_subtotal := v_calculated_subtotal + v_line_total;

    -- Atualizar stock gerido de forma atómica
    IF coalesce(v_product.manage_stock, true) = true THEN
      UPDATE public.products
         SET stock_quantity = greatest(0, coalesce(stock_quantity, 0) - v_qty),
             updated_at = now()
       WHERE id = v_product.id;
    END IF;

    v_normalized_items := v_normalized_items || jsonb_build_array(
      jsonb_build_object(
        'product_id', v_product.id,
        'product_name', v_product.name,
        'product_sku', v_product.sku,
        'quantity', v_qty,
        'unit_price', v_unit_price,
        'line_total', v_line_total
      )
    );
  END LOOP;

  v_calculated_total := v_calculated_subtotal + v_validated_delivery_fee;
  v_clean_email := nullif(trim(coalesce(p_email, '')), '');

  -- 2.5. Reutilizar ou criar registo de cliente em `public.customers`
  SELECT c.id
    INTO v_customer_id
    FROM public.customers c
   WHERE regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') =
         regexp_replace(trim(p_phone), '\D', '', 'g')
   ORDER BY c.created_at DESC NULLS LAST
   LIMIT 1;

  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (
      full_name,
      phone,
      email,
      city,
      notes,
      source
    )
    VALUES (
      trim(p_full_name),
      trim(p_phone),
      v_clean_email,
      nullif(trim(coalesce(p_city, '')), ''),
      nullif(trim(coalesce(p_customer_notes, '')), ''),
      'online_store'
    )
    RETURNING id INTO v_customer_id;
  ELSE
    UPDATE public.customers
       SET full_name = trim(p_full_name),
           email = coalesce(v_clean_email, email),
           city = coalesce(nullif(trim(coalesce(p_city, '')), ''), city),
           updated_at = now()
     WHERE id = v_customer_id;
  END IF;

  -- 2.6. Inserir encomenda em `public.orders` com valores validados no servidor
  INSERT INTO public.orders (
    order_number,
    customer_id,
    delivery_address,
    internal_notes,
    status,
    payment_status,
    source,
    subtotal,
    delivery_fee,
    discount_amount,
    total_amount,
    currency
  )
  VALUES (
    trim(p_order_number),
    v_customer_id,
    trim(coalesce(p_delivery_address, '')),
    nullif(trim(coalesce(p_internal_notes, '')), ''),
    'pending',
    'pending',
    'online_store',
    v_calculated_subtotal,
    v_validated_delivery_fee,
    0,
    v_calculated_total,
    coalesce(nullif(trim(coalesce(p_currency, '')), ''), 'AOA')
  )
  RETURNING id INTO v_order_id;

  -- 2.7. Inserir linhas em `public.order_items`
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_normalized_items)
  LOOP
    INSERT INTO public.order_items (
      order_id,
      product_id,
      product_name,
      product_sku,
      quantity,
      unit_price,
      line_total
    )
    VALUES (
      v_order_id,
      (v_item->>'product_id')::uuid,
      v_item->>'product_name',
      NULLIF(v_item->>'product_sku', ''),
      (v_item->>'quantity')::integer,
      (v_item->>'unit_price')::numeric,
      (v_item->>'line_total')::numeric
    );
  END LOOP;

  RETURN v_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_storefront_order(
  text, text, text, text, text, text, text, numeric, numeric, numeric, numeric, text, jsonb, text
) TO anon, authenticated;

COMMIT;
