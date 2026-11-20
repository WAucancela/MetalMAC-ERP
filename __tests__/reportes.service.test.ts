/**
 * Tests unitarios para reportes.service.ts — calcularResumenCotizacionesPorOrigen
 * NO requiere Supabase — el servicio no hace I/O.
 */
import { calcularResumenCotizacionesPorOrigen, type CotizacionParaResumen } from '../lib/services/reportes.service';

describe('calcularResumenCotizacionesPorOrigen', () => {
  it('devuelve ambos orígenes en cero cuando no hay cotizaciones', () => {
    const resumen = calcularResumenCotizacionesPorOrigen([]);
    expect(resumen).toHaveLength(2);
    expect(resumen.map((r) => r.origen).sort()).toEqual(['STAFF', 'WHATSAPP_BOT']);
    for (const r of resumen) {
      expect(r.totalCotizaciones).toBe(0);
      expect(r.montoTotal).toBe(0);
      expect(r.montoAprobado).toBe(0);
      expect(r.tasaAprobacion).toBeNull();
    }
  });

  it('separa correctamente por origen y suma los montos', () => {
    const cotizaciones: CotizacionParaResumen[] = [
      { origen: 'STAFF', estado: 'APROBADA', total: 100 },
      { origen: 'STAFF', estado: 'RECHAZADA', total: 50 },
      { origen: 'WHATSAPP_BOT', estado: 'APROBADA', total: 200 },
      { origen: 'WHATSAPP_BOT', estado: 'BORRADOR', total: 75 },
    ];
    const resumen = calcularResumenCotizacionesPorOrigen(cotizaciones);

    const staff = resumen.find((r) => r.origen === 'STAFF')!;
    expect(staff.totalCotizaciones).toBe(2);
    expect(staff.montoTotal).toBe(150);
    expect(staff.montoAprobado).toBe(100);
    expect(staff.tasaAprobacion).toBe(0.5); // 1 aprobada de 2 decididas (ninguna en BORRADOR)

    const bot = resumen.find((r) => r.origen === 'WHATSAPP_BOT')!;
    expect(bot.totalCotizaciones).toBe(2);
    expect(bot.montoTotal).toBe(275);
    expect(bot.montoAprobado).toBe(200);
    // 1 aprobada de 1 decidida — la de BORRADOR no cuenta como "decidida" todavía.
    expect(bot.tasaAprobacion).toBe(1);
  });

  it('tasaAprobacion es null si todas las cotizaciones del origen están en BORRADOR', () => {
    const cotizaciones: CotizacionParaResumen[] = [
      { origen: 'WHATSAPP_BOT', estado: 'BORRADOR', total: 10 },
      { origen: 'WHATSAPP_BOT', estado: 'BORRADOR', total: 20 },
    ];
    const resumen = calcularResumenCotizacionesPorOrigen(cotizaciones);
    const bot = resumen.find((r) => r.origen === 'WHATSAPP_BOT')!;
    expect(bot.totalCotizaciones).toBe(2);
    expect(bot.tasaAprobacion).toBeNull();
  });

  it('redondea los montos a 2 decimales', () => {
    const cotizaciones: CotizacionParaResumen[] = [
      { origen: 'STAFF', estado: 'APROBADA', total: 10.111 },
      { origen: 'STAFF', estado: 'APROBADA', total: 10.114 },
    ];
    const resumen = calcularResumenCotizacionesPorOrigen(cotizaciones);
    const staff = resumen.find((r) => r.origen === 'STAFF')!;
    expect(staff.montoTotal).toBe(20.23);
  });
});
