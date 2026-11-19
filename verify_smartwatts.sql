-- Diagnóstico: executar no SQL Editor após database.sql
select table_name from information_schema.tables
where table_schema = 'public' and table_name in ('sw_settings', 'sw_locations', 'sw_readings')
order by table_name;
select schemaname, tablename, policyname, cmd from pg_policies
where schemaname = 'public' and tablename like 'sw_%'
order by tablename, policyname;
select relname, relrowsecurity from pg_class
where relname in ('sw_settings', 'sw_locations', 'sw_readings')
order by relname;
