/**
 * Tests unitarios para productos-imagenes.service.ts (solo la parte sin I/O —
 * subirImagenProducto habla con Supabase Storage y no se testea acá).
 *
 * El mock de supabaseAdmin es solo para poder importar el módulo (lee las env vars
 * al crear el cliente apenas se importa) — agregarUrlImagen no lo usa.
 */
jest.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: {} }));

import { agregarUrlImagen } from '../lib/services/productos-imagenes.service';

describe('agregarUrlImagen', () => {
  it('agrega la URL al final cuando la lista está vacía', () => {
    expect(agregarUrlImagen('', 'https://a.com/1.jpg')).toBe('https://a.com/1.jpg');
  });

  it('agrega la URL al final de las que ya había', () => {
    expect(agregarUrlImagen('https://a.com/1.jpg', 'https://a.com/2.jpg')).toBe(
      'https://a.com/1.jpg\nhttps://a.com/2.jpg',
    );
  });

  it('no duplica una URL que ya estaba en la lista', () => {
    expect(agregarUrlImagen('https://a.com/1.jpg', 'https://a.com/1.jpg')).toBe('https://a.com/1.jpg');
  });

  it('ignora líneas en blanco de la lista actual', () => {
    expect(agregarUrlImagen('https://a.com/1.jpg\n\n', 'https://a.com/2.jpg')).toBe(
      'https://a.com/1.jpg\nhttps://a.com/2.jpg',
    );
  });
});
