const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  construirCuotasContrato,
  construirOperacionesCuotas,
} = require('../../../src/utils/cuotasContrato');

describe('cuotasContrato', () => {
  it('genera depósito al inicio y rentas en cada vencimiento entre inicio y fin', () => {
    const cuotas = construirCuotasContrato({
      _id: 'contrato-id',
      fecha_inicio: new Date('2026-01-15T00:00:00.000Z'),
      fecha_fin: new Date('2026-03-31T00:00:00.000Z'),
      monto_mensual: 250000,
      dia_vencimiento: 10,
    }, new Date('2025-01-01T00:00:00.000Z'));

    assert.equal(cuotas.length, 3);
    assert.deepEqual(cuotas.map(({ mes_correspondiente }) => mes_correspondiente), [
      'DEPOSITO',
      '202602',
      '202603',
    ]);
    assert.equal(cuotas[0].monto_total, 250000);
    assert.equal(cuotas[0].fecha_vencimiento.toISOString(), '2026-01-15T00:00:00.000Z');
    assert.equal(cuotas[1].fecha_vencimiento.toISOString(), '2026-02-10T12:00:00.000Z');
  });

  it('incluye una cuota con vencimiento en la fecha final e identifica cuotas vencidas', () => {
    const cuotas = construirCuotasContrato({
      _id: 'contrato-id',
      fecha_inicio: new Date('2026-01-01T00:00:00.000Z'),
      fecha_fin: new Date('2026-02-10T00:00:00.000Z'),
      monto_mensual: 100,
      dia_vencimiento: 10,
    }, new Date('2026-04-01T00:00:00.000Z'));

    assert.equal(cuotas.length, 3);
    assert.ok(cuotas.every((cuota) => cuota.estado === 'ATRASADO'));
  });

  it('produce upserts idempotentes y distingue depósito de alquiler del mismo mes', () => {
    const operaciones = construirOperacionesCuotas({
      _id: 'contrato-id',
      fecha_inicio: new Date('2026-01-01T00:00:00.000Z'),
      fecha_fin: new Date('2026-01-31T00:00:00.000Z'),
      monto_mensual: 100,
      dia_vencimiento: 10,
    }, new Date('2025-01-01T00:00:00.000Z'));

    assert.equal(operaciones.length, 2);
    assert.equal(operaciones[0].updateOne.upsert, true);
    assert.notEqual(
      operaciones[0].updateOne.filter.mes_correspondiente,
      operaciones[1].updateOne.filter.mes_correspondiente,
    );
    assert.deepEqual(operaciones[0].updateOne.filter.mes_correspondiente, { $in: ['DEPOSITO'] });
    assert.deepEqual(operaciones[1].updateOne.filter.mes_correspondiente, { $in: ['202601', '2026-01'] });
  });

  it('rechaza contratos que no tengan fechas y datos de cuota válidos', () => {
    assert.throws(
      () => construirCuotasContrato({
        _id: 'contrato-id',
        fecha_inicio: new Date('2026-01-01'),
        monto_mensual: 100,
        dia_vencimiento: 10,
      }),
      /fechas, monto mensual y día/,
    );
  });
});
