/**
 * useBancos — React Query hooks para cuentas bancarias y sus movimientos.
 */

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import type { CuentaBancaria, MovimientoBancario } from '@/types/metalmac.types';
import type { CuentaBancariaInput, ActualizarCuentaBancariaInput, MovimientoBancarioInput } from '@/lib/validations/bancos.schema';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export type CuentaBancariaConSaldo = CuentaBancaria & { saldo: number };

export function useCuentasBancarias() {
  const { token } = useAuth();
  return useQuery<CuentaBancariaConSaldo[]>({
    queryKey: ['bancos', 'cuentas'],
    queryFn: async () => {
      const res = await fetch('/api/bancos/cuentas', { headers: authHeaders(token ?? '') });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al cargar cuentas bancarias');
      return json.data;
    },
    enabled: !!token,
  });
}

export function useCrearCuentaBancaria() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CuentaBancariaInput) => {
      const res = await fetch('/api/bancos/cuentas', {
        method: 'POST',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al crear la cuenta bancaria');
      return json.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bancos', 'cuentas'] }),
  });
}

export function useActualizarCuentaBancaria(id: string) {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: ActualizarCuentaBancariaInput) => {
      const res = await fetch(`/api/bancos/cuentas/${id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al actualizar la cuenta bancaria');
      return json.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bancos', 'cuentas'] }),
  });
}

export function useMovimientosBancarios(cuentaId: string) {
  const { token } = useAuth();
  return useQuery<MovimientoBancario[]>({
    queryKey: ['bancos', 'movimientos', cuentaId],
    queryFn: async () => {
      const res = await fetch(`/api/bancos/cuentas/${cuentaId}/movimientos`, { headers: authHeaders(token ?? '') });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al cargar movimientos');
      return json.data;
    },
    enabled: !!token && !!cuentaId,
  });
}

export function useCrearMovimientoBancario(cuentaId: string) {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: MovimientoBancarioInput) => {
      const res = await fetch(`/api/bancos/cuentas/${cuentaId}/movimientos`, {
        method: 'POST',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al registrar el movimiento');
      return json.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bancos', 'movimientos', cuentaId] });
      qc.invalidateQueries({ queryKey: ['bancos', 'cuentas'] });
    },
  });
}

export function useConciliarMovimiento(cuentaId: string) {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, conciliado }: { id: string; conciliado: boolean }) => {
      const res = await fetch(`/api/bancos/movimientos/${id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify({ conciliado }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al actualizar el movimiento');
      return json;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bancos', 'movimientos', cuentaId] }),
  });
}
