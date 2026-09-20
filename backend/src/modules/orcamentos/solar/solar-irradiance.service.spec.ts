import { Test } from '@nestjs/testing';
import { BadRequestException, RequestTimeoutException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { SolarIrradianceService, irradianceCacheKey, parseNasaPowerMonthly } from './solar-irradiance.service';
import { SolarIrradiance } from '../schemas/solar-irradiance.schema';

/**
 * Resposta da NASA POWER no formato real. O cast é proposital: parte dos testes alimenta
 * corpos deformados — mês faltando, valor de texto, -999 — que é justamente o que a função
 * precisa recusar, e o tipo correto impediria de escrevê-los.
 */
const nasaBody = (values: Record<string, unknown>) =>
  ({ properties: { parameter: { ALLSKY_SFC_SW_DWN: values } } }) as Parameters<typeof parseNasaPowerMonthly>[0];

const TWELVE_MONTHS = {
  JAN: 5.4,
  FEB: 5.1,
  MAR: 4.8,
  APR: 4.6,
  MAY: 5.0,
  JUN: 5.3,
  JUL: 5.6,
  AUG: 6.1,
  SEP: 6.3,
  OCT: 6.2,
  NOV: 6.0,
  DEC: 5.7,
};

describe('irradianceCacheKey', () => {
  it('rounds to two decimals so nearby addresses share one cache entry', () => {
    expect(irradianceCacheKey(-3.316806, -40.093)).toBe('-3.32,-40.09');
  });

  it('gives the same key to two points about a block apart', () => {
    expect(irradianceCacheKey(-3.3168, -40.0931)).toBe(irradianceCacheKey(-3.3172, -40.0934));
  });

  it('separates points that are genuinely far apart', () => {
    expect(irradianceCacheKey(-3.31, -40.09)).not.toBe(irradianceCacheKey(-23.55, -46.63));
  });
});

describe('parseNasaPowerMonthly', () => {
  it('returns the twelve months in calendar order', () => {
    expect(parseNasaPowerMonthly(nasaBody(TWELVE_MONTHS))).toEqual([
      5.4, 5.1, 4.8, 4.6, 5.0, 5.3, 5.6, 6.1, 6.3, 6.2, 6.0, 5.7,
    ]);
  });

  // A NASA devolve valores extras (ANN, por exemplo) que não podem virar um 13o mês.
  it('ignores extra keys beyond the twelve months', () => {
    expect(parseNasaPowerMonthly(nasaBody({ ...TWELVE_MONTHS, ANN: 5.5 }))).toHaveLength(12);
  });

  it('rejects the -999 fill value instead of treating it as irradiance', () => {
    expect(() => parseNasaPowerMonthly(nasaBody({ ...TWELVE_MONTHS, JUL: -999 }))).toThrow(BadRequestException);
  });

  it('rejects a month that is missing', () => {
    const { AUG, ...withoutAugust } = TWELVE_MONTHS;
    expect(() => parseNasaPowerMonthly(nasaBody(withoutAugust))).toThrow(/AUG/);
  });

  it('rejects a non-numeric month', () => {
    expect(() => parseNasaPowerMonthly(nasaBody({ ...TWELVE_MONTHS, MAR: 'n/a' }))).toThrow(BadRequestException);
  });

  it('rejects a response shaped differently than expected', () => {
    expect(() => parseNasaPowerMonthly({} as never)).toThrow(BadRequestException);
    expect(() => parseNasaPowerMonthly({ properties: {} } as never)).toThrow(BadRequestException);
  });
});

describe('SolarIrradianceService', () => {
  let service: SolarIrradianceService;
  let modelMock: { findOne: jest.Mock; findOneAndUpdate: jest.Mock };
  const fetchMock = jest.fn();

  const monthly = [5.4, 5.1, 4.8, 4.6, 5.0, 5.3, 5.6, 6.1, 6.3, 6.2, 6.0, 5.7];

  beforeEach(async () => {
    modelMock = {
      findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      findOneAndUpdate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
    };
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;

    const moduleRef = await Test.createTestingModule({
      providers: [
        SolarIrradianceService,
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(undefined) } },
        { provide: getModelToken(SolarIrradiance.name), useValue: modelMock },
      ],
    }).compile();

    service = moduleRef.get(SolarIrradianceService);
  });

  const okResponse = () => ({ ok: true, json: jest.fn().mockResolvedValue(nasaBody(TWELVE_MONTHS)) });

  it('fetches from NASA POWER and returns the twelve months', async () => {
    fetchMock.mockResolvedValue(okResponse());

    await expect(service.getMonthlyIrradiance(-3.32, -40.09)).resolves.toEqual(monthly);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('asks NASA for the climatology of the right point, with no API key', async () => {
    fetchMock.mockResolvedValue(okResponse());
    await service.getMonthlyIrradiance(-3.32, -40.09);

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('power.larc.nasa.gov');
    expect(url).toContain('climatology');
    expect(url).toContain('latitude=-3.32');
    expect(url).toContain('longitude=-40.09');
    expect(url).toContain('ALLSKY_SFC_SW_DWN');
  });

  it('caches the result so the second budget in the same place makes no request', async () => {
    modelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue({ monthly }) });

    await expect(service.getMonthlyIrradiance(-3.32, -40.09)).resolves.toEqual(monthly);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('writes the fetched value to the cache', async () => {
    fetchMock.mockResolvedValue(okResponse());
    await service.getMonthlyIrradiance(-3.32, -40.09);

    expect(modelMock.findOneAndUpdate).toHaveBeenCalledWith(
      { cacheKey: '-3.32,-40.09' },
      expect.objectContaining({ $setOnInsert: expect.objectContaining({ monthly }) }),
      expect.objectContaining({ upsert: true }),
    );
  });

  it('reports a timeout as such instead of a generic failure', async () => {
    const timeout = new Error('timed out');
    timeout.name = 'TimeoutError';
    fetchMock.mockRejectedValue(timeout);

    await expect(service.getMonthlyIrradiance(-3.32, -40.09)).rejects.toThrow(RequestTimeoutException);
  });

  it('fails clearly when NASA answers with an error status', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: jest.fn() });

    await expect(service.getMonthlyIrradiance(-3.32, -40.09)).rejects.toThrow(BadRequestException);
  });

  it('rejects coordinates outside the globe before making any request', async () => {
    await expect(service.getMonthlyIrradiance(91, 0)).rejects.toThrow(BadRequestException);
    await expect(service.getMonthlyIrradiance(0, 181)).rejects.toThrow(BadRequestException);
    await expect(service.getMonthlyIrradiance(NaN, 0)).rejects.toThrow(BadRequestException);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
