CREATE OR REPLACE FUNCTION public.get_orders_policies_debug()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT json_agg(row_to_json(p)) 
  FROM (
    SELECT policyname, roles, cmd, qual, with_check 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'orders'
  ) p;
$$;

GRANT EXECUTE ON FUNCTION public.get_orders_policies_debug() TO anon, authenticated;
