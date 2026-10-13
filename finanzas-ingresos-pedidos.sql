-- Suma a la caja el importe de cada pedido al marcarlo Entregado.
-- Ejecutar una sola vez en Supabase > SQL Editor, después de finanzas.sql.

ALTER TABLE public.finance_transactions
    ADD COLUMN IF NOT EXISTS source_order_id text;

CREATE UNIQUE INDEX IF NOT EXISTS finance_transactions_source_order_uidx
    ON public.finance_transactions (source_order_id)
    WHERE source_order_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.register_finance_income_on_order_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    IF NEW.status = 'entregado' AND OLD.status IS DISTINCT FROM 'entregado' THEN
        INSERT INTO public.finance_transactions (
            entry_type,
            entry_date,
            category,
            description,
            amount,
            source_order_id
        )
        VALUES (
            'income',
            CURRENT_DATE,
            'Pedido entregado',
            'Ingreso automático por pedido #' || LEFT(NEW.id::text, 8),
            NEW.total,
            NEW.id::text
        )
        ON CONFLICT (source_order_id) WHERE source_order_id IS NOT NULL DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'store_orders_finance_income'
          AND tgrelid = 'public.store_orders'::regclass
          AND NOT tgisinternal
    ) THEN
        EXECUTE 'CREATE TRIGGER store_orders_finance_income
            AFTER UPDATE OF status ON public.store_orders
            FOR EACH ROW
            EXECUTE FUNCTION public.register_finance_income_on_order_delivery()';
    END IF;
END;
$$;
