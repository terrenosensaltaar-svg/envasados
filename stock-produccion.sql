-- Stock de producción para el catálogo y descuento automático al entregar pedidos.
-- Ejecutar una sola vez en Supabase > SQL Editor.

CREATE TABLE IF NOT EXISTS public.production_stock (
    product_id text PRIMARY KEY,
    product_name text NOT NULL,
    quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.production_stock ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.production_stock TO authenticated;

DROP POLICY IF EXISTS "Panel admins can read production stock" ON public.production_stock;
CREATE POLICY "Panel admins can read production stock"
    ON public.production_stock FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.panel_admins pa WHERE pa.user_id = (SELECT auth.uid())
    ));

DROP POLICY IF EXISTS "Panel admins can update production stock" ON public.production_stock;
CREATE POLICY "Panel admins can update production stock"
    ON public.production_stock FOR UPDATE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.panel_admins pa WHERE pa.user_id = (SELECT auth.uid())
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.panel_admins pa WHERE pa.user_id = (SELECT auth.uid())
    ));

DROP POLICY IF EXISTS "Panel admins can insert production stock" ON public.production_stock;
CREATE POLICY "Panel admins can insert production stock"
    ON public.production_stock FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.panel_admins pa WHERE pa.user_id = (SELECT auth.uid())
    ));

-- Quitar primero la marca para que un fallo posterior mantenga bloqueada la entrega.
DELETE FROM public.production_stock WHERE product_id = '__stock_trigger_v1__';

INSERT INTO public.production_stock (product_id, product_name, quantity)
VALUES
    ('pl-01', 'Patas Muslo Parrillera', 0),
    ('pl-02', 'Patas Muslo Honey', 0),
    ('pl-03', 'Patas Muslo Oriental Árabe', 0),
    ('pl-04', 'Patas Muslo Ahumada', 0),
    ('pl-05', 'Patas Muslo Barbacoa Smoky', 0),
    ('gm-01', 'Empanadas Árabes', 0),
    ('gm-02', 'Empanadas de Carne', 0),
    ('gm-03', 'Lazaña de Novillo', 0),
    ('gm-04', 'Pastel de Papa', 0),
    ('prod-01', 'Empanadas Árabes (Legacy prod-01)', 0),
    ('prod-02', 'Pollo al Horno con Papas', 0),
    ('prod-03', 'Puré de Papas con Solomillo a la Cerveza', 0),
    ('prod-04', 'Pollo Condimentado Pollita Lu (Legacy prod-04)', 0)
ON CONFLICT (product_id) DO UPDATE SET product_name = EXCLUDED.product_name;

CREATE OR REPLACE FUNCTION public.apply_production_stock_for_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_line record;
    v_stock_name text;
    v_target_id text;
BEGIN
    -- Restar una sola vez al entrar a entregado; reponer si el estado se revierte.
    IF NEW.status = 'entregado' AND OLD.status IS DISTINCT FROM 'entregado' THEN
        FOR v_line IN
            SELECT item->>'product_id' AS product_id,
                   SUM(GREATEST(COALESCE(NULLIF(item->>'quantity', '')::integer, 1), 1))::integer AS quantity
            FROM jsonb_array_elements(COALESCE(NEW.items, '[]'::jsonb)) AS item
            GROUP BY item->>'product_id'
            ORDER BY item->>'product_id'
        LOOP
            IF v_line.product_id IS NULL OR v_line.product_id = '' THEN
                RAISE EXCEPTION 'No se pudo descontar stock: el pedido contiene un producto sin identificador.';
            END IF;

            -- Mapeo retrocompatible si un pedido usó ID alternativo
            v_target_id := CASE v_line.product_id
                WHEN 'prod-01' THEN 'gm-01'
                WHEN 'prod-04' THEN 'pl-01'
                WHEN 'prod-19' THEN 'gm-02'
                WHEN 'prod-14' THEN 'gm-03'
                WHEN 'prod-18' THEN 'gm-04'
                ELSE v_line.product_id
            END;

            IF NOT EXISTS (SELECT 1 FROM public.production_stock WHERE product_id = v_target_id)
               AND EXISTS (SELECT 1 FROM public.production_stock WHERE product_id = v_line.product_id) THEN
                v_target_id := v_line.product_id;
            END IF;

            UPDATE public.production_stock
               SET quantity = quantity - v_line.quantity,
                   updated_at = now()
             WHERE product_id = v_target_id
               AND quantity >= v_line.quantity;

            IF NOT FOUND THEN
                SELECT product_name INTO v_stock_name
                  FROM public.production_stock
                 WHERE product_id = v_target_id;
                IF NOT FOUND THEN
                    RAISE EXCEPTION 'No hay stock inicial configurado para el producto %.', v_line.product_id;
                END IF;
                RAISE EXCEPTION 'Stock insuficiente para % (se necesitan %, disponibles %).',
                    v_stock_name, v_line.quantity,
                    (SELECT quantity FROM public.production_stock WHERE product_id = v_target_id);
            END IF;
        END LOOP;

    ELSIF OLD.status = 'entregado' AND NEW.status IS DISTINCT FROM 'entregado' THEN
        FOR v_line IN
            SELECT item->>'product_id' AS product_id,
                   SUM(GREATEST(COALESCE(NULLIF(item->>'quantity', '')::integer, 1), 1))::integer AS quantity
            FROM jsonb_array_elements(COALESCE(OLD.items, '[]'::jsonb)) AS item
            GROUP BY item->>'product_id'
            ORDER BY item->>'product_id'
        LOOP
            v_target_id := CASE v_line.product_id
                WHEN 'prod-01' THEN 'gm-01'
                WHEN 'prod-04' THEN 'pl-01'
                WHEN 'prod-19' THEN 'gm-02'
                WHEN 'prod-14' THEN 'gm-03'
                WHEN 'prod-18' THEN 'gm-04'
                ELSE v_line.product_id
            END;

            IF NOT EXISTS (SELECT 1 FROM public.production_stock WHERE product_id = v_target_id)
               AND EXISTS (SELECT 1 FROM public.production_stock WHERE product_id = v_line.product_id) THEN
                v_target_id := v_line.product_id;
            END IF;

            UPDATE public.production_stock
               SET quantity = quantity + v_line.quantity,
                   updated_at = now()
             WHERE product_id = v_target_id;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'No existe stock configurado para reponer el producto %.', v_line.product_id;
            END IF;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS store_orders_production_stock ON public.store_orders;
CREATE TRIGGER store_orders_production_stock
    BEFORE UPDATE OF status ON public.store_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.apply_production_stock_for_order_status();

-- La marca se escribe solo después de crear la rutina y el trigger.
INSERT INTO public.production_stock (product_id, product_name, quantity)
VALUES ('__stock_trigger_v1__', 'Configuración interna de stock', 0)
ON CONFLICT (product_id) DO UPDATE SET product_name = EXCLUDED.product_name;

-- Actualizar el esquema que usa la Data API para resolver la tabla recién creada.
NOTIFY pgrst, 'reload schema';
