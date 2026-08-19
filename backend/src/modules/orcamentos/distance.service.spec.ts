import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException, RequestTimeoutException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { DistanceService } from './distance.service';
import { DistanceCalculation } from './schemas/distance-calculation.schema';

const geocodeResponse = (lon: number, lat: number) => ({
  features: [{ geometry: { coordinates: [lon, lat] } }],
});

const directionsResponse = (distanceMeters: number, durationSeconds: number) => ({
  routes: [{ summary: { distance: distanceMeters, duration: durationSeconds } }],
});

describe('DistanceService', () => {
  const testUserId = new Types.ObjectId().toString();
  let service: DistanceService;
  let modelMock: { findOne: jest.Mock; create: jest.Mock };
  let configGet: jest.Mock;
  let fetchSpy: jest.SpyInstance;

  const buildModule = async (orsApiKey: string | undefined) => {
    modelMock = { findOne: jest.fn(), create: jest.fn() };
    configGet = jest.fn((key: string) => (key === 'ORS_API_KEY' ? orsApiKey : undefined));

    const moduleRef = await Test.createTestingModule({
      providers: [
        DistanceService,
        { provide: ConfigService, useValue: { get: configGet } },
        { provide: getModelToken(DistanceCalculation.name), useValue: modelMock },
      ],
    }).compile();

    service = moduleRef.get(DistanceService);
  };

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  it('throws without calling fetch when ORS_API_KEY is missing', async () => {
    await buildModule(undefined);
    modelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
    fetchSpy = jest.spyOn(global, 'fetch');

    await expect(
      service.calculate(testUserId, 'Origem', 'Destino', { pricePerKm: 2, minimumTravelFee: 20, freeRadiusKm: 5 }),
    ).rejects.toThrow(BadRequestException);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reuses a cached distance and recomputes travelCost with current pricing', async () => {
    await buildModule('fake-key');
    modelMock.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: new Types.ObjectId(), distanceKm: 100, durationMin: 90 }),
    });
    fetchSpy = jest.spyOn(global, 'fetch');

    const result = await service.calculate(testUserId, 'Origem', 'Destino', {
      pricePerKm: 3,
      minimumTravelFee: 20,
      freeRadiusKm: 5,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.cached).toBe(true);
    expect(result.distanceKm).toBe(100);
    expect(result.travelCost).toBe(300); // 100km * 3 > minimumTravelFee
  });

  it('applies freeRadiusKm: travelCost is 0 below the free radius', async () => {
    await buildModule('fake-key');
    modelMock.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: new Types.ObjectId(), distanceKm: 3, durationMin: 10 }),
    });

    const result = await service.calculate(testUserId, 'Origem', 'Destino', {
      pricePerKm: 3,
      minimumTravelFee: 20,
      freeRadiusKm: 5,
    });

    expect(result.travelCost).toBe(0);
  });

  it('applies minimumTravelFee when per-km cost is below it', async () => {
    await buildModule('fake-key');
    modelMock.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: new Types.ObjectId(), distanceKm: 10, durationMin: 15 }),
    });

    const result = await service.calculate(testUserId, 'Origem', 'Destino', {
      pricePerKm: 1,
      minimumTravelFee: 50,
      freeRadiusKm: 5,
    });

    expect(result.travelCost).toBe(50);
  });

  it('geocodes + calls directions on cache miss and persists the result', async () => {
    await buildModule('fake-key');
    modelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
    modelMock.create.mockResolvedValue({ _id: new Types.ObjectId() });

    fetchSpy = jest.spyOn(global, 'fetch');
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify(geocodeResponse(-46.6, -23.5)), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(geocodeResponse(-46.7, -23.6)), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(directionsResponse(20000, 1800)), { status: 200 }));

    const result = await service.calculate(testUserId, 'Origem', 'Destino', {
      pricePerKm: 2,
      minimumTravelFee: 20,
      freeRadiusKm: 5,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(result.distanceKm).toBe(20);
    expect(result.durationMin).toBe(30);
    expect(result.cached).toBe(false);
    expect(modelMock.create).toHaveBeenCalled();
  });

  it('throws NotFoundException when the address cannot be geocoded', async () => {
    await buildModule('fake-key');
    modelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ features: [] }), { status: 200 }));

    await expect(
      service.calculate(testUserId, 'Origem inexistente', 'Destino', { pricePerKm: 2, minimumTravelFee: 20, freeRadiusKm: 5 }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when ORS responds with a non-ok status', async () => {
    await buildModule('fake-key');
    modelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response('erro interno', { status: 500 }));

    await expect(
      service.calculate(testUserId, 'Origem', 'Destino', { pricePerKm: 2, minimumTravelFee: 20, freeRadiusKm: 5 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('translates a fetch timeout into RequestTimeoutException', async () => {
    await buildModule('fake-key');
    modelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
    const timeoutError = new Error('timeout');
    timeoutError.name = 'TimeoutError';
    fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValueOnce(timeoutError);

    await expect(
      service.calculate(testUserId, 'Origem', 'Destino', { pricePerKm: 2, minimumTravelFee: 20, freeRadiusKm: 5 }),
    ).rejects.toThrow(RequestTimeoutException);
  });
});
