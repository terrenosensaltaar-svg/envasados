-- Base de leads comerciales (despensas y supermercados de zona norte).
-- Ya aplicada en Supabase. Solo los usuarios de panel_admins pueden ver y editar.
CREATE TABLE IF NOT EXISTS public.leads_comercios (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre text NOT NULL,
    rubro text,
    direccion text,
    zona text,
    telefono text,
    whatsapp text,
    wa_estado text NOT NULL DEFAULT 'verificar' CHECK (wa_estado IN ('probable','verificar','confirmado','sin_whatsapp')),
    lat double precision,
    lng double precision,
    rating numeric(2,1),
    resenas integer,
    estado text NOT NULL DEFAULT 'nuevo' CHECK (estado IN ('nuevo','contactado','interesado','muestra','cliente','no_interesado')),
    notas text,
    ultimo_contacto timestamptz,
    fuente text NOT NULL DEFAULT 'Google Maps',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (whatsapp)
);

ALTER TABLE public.leads_comercios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.leads_comercios FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads_comercios TO authenticated;

CREATE POLICY "Panel admins manage leads"
    ON public.leads_comercios FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.panel_admins pa WHERE pa.user_id = (SELECT auth.uid())))
    WITH CHECK (EXISTS (SELECT 1 FROM public.panel_admins pa WHERE pa.user_id = (SELECT auth.uid())));

CREATE OR REPLACE FUNCTION public.leads_set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER leads_comercios_updated_at BEFORE UPDATE ON public.leads_comercios
    FOR EACH ROW EXECUTE FUNCTION public.leads_set_updated_at();
