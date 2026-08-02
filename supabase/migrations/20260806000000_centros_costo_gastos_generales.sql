-- Centro de costos + generalización de gastos_proyecto → gastos (ya no exige
-- un proyecto). Se renombra la tabla existente en vez de crear una paralela:
-- Postgres conserva FKs/índices/trigger/RLS/policies en un `rename`, así que
-- todo lo que ya depende de gastos_proyecto sigue funcionando sin tocarlo acá
-- (el código de la app se actualiza aparte, en el mismo commit).

create table centros_costo (
  id        uuid primary key default gen_random_uuid(),
  codigo    text not null unique,
  nombre    text not null,
  activo    boolean not null default true,
  creado_en timestamptz not null default now()
);
create index centros_costo_activo_nombre_idx on centros_costo(activo, nombre);

alter table gastos_proyecto rename to gastos;
alter table gastos alter column proyecto_id drop not null;
alter table gastos add column centro_costo_id uuid references centros_costo(id);
create index gastos_centro_costo_fecha_idx on gastos(centro_costo_id, fecha desc);

-- El trigger existente (trg_gastos_proyecto_costo_real, sigue apuntando a esta
-- función) asumía que proyecto_id siempre tenía valor. Se reemplaza el cuerpo
-- para no tocar proyectos.costo_real cuando no hay proyecto asociado, usando
-- `is distinct from`/`is not null` en vez de `<>` para manejar bien las
-- transiciones desde/hacia NULL (con `<>` una comparación contra NULL da NULL,
-- no true, y la rama nunca se ejecutaría).
create or replace function gastos_proyecto_aplicar_delta() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.proyecto_id is not null then
      update proyectos set costo_real = costo_real + new.monto, actualizado_en = now() where id = new.proyecto_id;
    end if;
  elsif tg_op = 'UPDATE' then
    if new.proyecto_id is distinct from old.proyecto_id then
      if old.proyecto_id is not null then
        update proyectos set costo_real = greatest(0, costo_real - old.monto), actualizado_en = now() where id = old.proyecto_id;
      end if;
      if new.proyecto_id is not null then
        update proyectos set costo_real = costo_real + new.monto, actualizado_en = now() where id = new.proyecto_id;
      end if;
    elsif new.monto <> old.monto and new.proyecto_id is not null then
      update proyectos set costo_real = greatest(0, costo_real + (new.monto - old.monto)), actualizado_en = now() where id = new.proyecto_id;
    end if;
  elsif tg_op = 'DELETE' then
    if old.proyecto_id is not null then
      update proyectos set costo_real = greatest(0, costo_real - old.monto), actualizado_en = now() where id = old.proyecto_id;
    end if;
  end if;
  return null;
end $$;

alter table centros_costo enable row level security;
create policy centros_costo_select on centros_costo for select using (auth.role() = 'authenticated');
grant select on centros_costo to authenticated;
grant select, insert, update, delete on centros_costo to service_role;
