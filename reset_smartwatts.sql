-- ATENÇÃO: exclui DEFINITIVAMENTE somente dados e tabelas do SmartWatts.
-- Execute no SQL Editor do projeto Supabase de testes APÓS conferir o nome do projeto.
-- Depois, execute database.sql para recriar a estrutura limpa.
begin;
drop table if exists public.sw_readings;
drop table if exists public.sw_locations;
drop table if exists public.sw_settings;
commit;
