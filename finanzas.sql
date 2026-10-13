-- Facturación: ingresos, gastos y comprobantes privados.
-- Ejecutar una vez en Supabase > SQL Editor.

CREATE TABLE IF NOT EXISTS public.finance_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_type text NOT NULL CHECK (entry_type IN ('income', 'expense')),
    entry_date date NOT NULL DEFAULT CURRENT_DATE,
    category text NOT NULL CHECK (length(btrim(category)) BETWEEN 1 AND 80),
    description text NOT NULL CHECK (length(btrim(description)) BETWEEN 1 AND 500),
    amount numeric(12, 2) NOT NULL CHECK (amount > 0),
    receipt_path text,
    receipt_name text,
    source_order_id text,
    created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.finance_transactions
    ADD COLUMN IF NOT EXISTS source_order_id text;

CREATE INDEX IF NOT EXISTS finance_transactions_entry_date_idx
    ON public.finance_transactions (entry_date, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS finance_transactions_source_order_uidx
    ON public.finance_transactions (source_order_id)
    WHERE source_order_id IS NOT NULL;

ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.finance_transactions FROM anon, authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT ON public.finance_transactions TO authenticated;

CREATE POLICY "Panel admins can read finance transactions"
    ON public.finance_transactions FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.panel_admins pa WHERE pa.user_id = (SELECT auth.uid())
    ));

CREATE POLICY "Panel admins can create finance transactions"
    ON public.finance_transactions FOR INSERT TO authenticated
    WITH CHECK (
        created_by = (SELECT auth.uid())
        AND EXISTS (
            SELECT 1 FROM public.panel_admins pa WHERE pa.user_id = (SELECT auth.uid())
        )
    );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'finance-receipts',
    'finance-receipts',
    false,
    6291456,
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 6291456,
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

CREATE POLICY "Panel admins can view finance receipts"
    ON storage.objects FOR SELECT TO authenticated
    USING (
        bucket_id = 'finance-receipts'
        AND EXISTS (SELECT 1 FROM public.panel_admins pa WHERE pa.user_id = (SELECT auth.uid()))
    );

CREATE POLICY "Panel admins can upload finance receipts"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'finance-receipts'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
        AND EXISTS (SELECT 1 FROM public.panel_admins pa WHERE pa.user_id = (SELECT auth.uid()))
    );

CREATE POLICY "Panel admins can remove finance receipts"
    ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id = 'finance-receipts'
        AND EXISTS (SELECT 1 FROM public.panel_admins pa WHERE pa.user_id = (SELECT auth.uid()))
    );

NOTIFY pgrst, 'reload schema';

CREATE OR REPLACE FUNCTION public.register_finance_income_on_order_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    IF NEW.status = 'entregado' AND OLD.status IS DISTINCT FROM 'entregado' THEN
        INSERT INTO public.finance_transactions (
            entry_type, entry_date, category, description, amount, source_order_id
        )
        VALUES (
            'income', CURRENT_DATE, 'Pedido entregado',
            'Ingreso automático por pedido #' || LEFT(NEW.id::text, 8),
            NEW.total, NEW.id::text
        )
        ON CONFLICT (source_order_id) WHERE source_order_id IS NOT NULL DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
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
