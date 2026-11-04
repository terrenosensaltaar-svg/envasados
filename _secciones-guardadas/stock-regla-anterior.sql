-- Regla de stock que estaba en Supabase hasta el 04/11/2026. Bloqueaba la entrega si no había fila o stock suficiente.
-- Para volver atrás: ejecutar en Supabase > SQL Editor.
CREATE OR REPLACE FUNCTION public.apply_production_stock_for_order_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
    v_line record;
    v_stock_name text;
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

            UPDATE public.production_stock
               SET quantity = quantity - v_line.quantity,
                   updated_at = now()
             WHERE product_id = v_line.product_id
               AND quantity >= v_line.quantity;

            IF NOT FOUND THEN
                SELECT product_name INTO v_stock_name
                  FROM public.production_stock
                 WHERE product_id = v_line.product_id;
                IF NOT FOUND THEN
                    RAISE EXCEPTION 'No hay stock inicial configurado para el producto %.', v_line.product_id;
                END IF;
                RAISE EXCEPTION 'Stock insuficiente para % (se necesitan %, disponibles %).',
                    v_stock_name, v_line.quantity,
                    (SELECT quantity FROM public.production_stock WHERE product_id = v_line.product_id);
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
            UPDATE public.production_stock
               SET quantity = quantity + v_line.quantity,
                   updated_at = now()
             WHERE product_id = v_line.product_id;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'No existe stock configurado para reponer el producto %.', v_line.product_id;
            END IF;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$function$;
