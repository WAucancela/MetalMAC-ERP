-- Agrega el estado activo/inactivo al espejo de perfiles, para la pantalla de
-- administración de usuarios (Configuración → Usuarios). El estado real de
-- acceso vive en auth.users (ban_duration, vía el Admin API), pero mantenerlo
-- también acá evita tener que pedirle a la Admin API el estado de cada usuario
-- solo para pintar la lista.
alter table perfiles add column activo boolean not null default true;
