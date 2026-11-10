-- Bucket para las fotos de producto que se suben desde el ERP y se publican en
-- WooCommerce. A diferencia de certificados-firma (privado, solo el servidor lo
-- lee), este bucket es PÚBLICO a propósito: WooCommerce necesita poder descargar
-- la imagen desde su URL pública cuando el ERP publica el producto — no hay forma
-- de mandarle el archivo directo por la REST API de productos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'productos-imagenes',
  'productos-imagenes',
  true,
  5242880, -- 5MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- Sin policies de storage.objects para anon/authenticated en escritura: la subida
-- siempre pasa por la API route (service_role), igual criterio que
-- certificados-firma. La lectura es pública porque el bucket mismo es público
-- (Supabase sirve objetos de buckets públicos sin necesidad de policy de SELECT).
