import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException, RequestTimeoutException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { DistanceService } from './distance.service';
import { DistanceCalculation } from './schemas/distance-calculation.schema';

const geocodeResponse = (lon: number, lat: number, label?: string) => ({
  features: [{ geometry: { coordinates: [lon, lat] }, ...(label && { properties: { label } }) }],
});

const directionsResponse = (distanceMeters: number, durationSeconds: number) => ({
  routes: [{ summary: { distance: distanceMeters, duration: durationSeconds } }],
});

// Entrada de cache completa — só um registro com o destino resolvido é reaproveitado.
const cachedDoc = (distanceKm: number, durationMin: number) => ({
  _id: new Types.ObjectId(),
  distanceKm,
  durationMin,
  resolvedDestinationLabel: 'Destino, Cidade, CE, Brasil',
  resolvedDestinationLat: -3.4,
  resolvedDestinationLon: -39.5,
});

describe('DistanceService', () => {
  const testUserId = new Types.ObjectId().toString();
  let service: DistanceService;
  let modelMock: { findOne: jest.Mock; create: jest.Mock; findByIdAndDelete: jest.Mock };
  let configGet: jest.Mock;
  let fetchSpy: jest.SpyInstance;

  const buildModule = async (orsApiKey: string | undefined) => {
    modelMock = {
      findOne: jest.fn(),
      create: jest.fn(),
      findByIdAndDelete: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
    };
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
      exec: jest.fn().mockResolvedValue(cachedDoc(100, 90)),
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
    expect(result.travelCost).toBe(600); // ida e volta: 100km * 2 * 3/km
  });

  it('applies freeRadiusKm: travelCost is 0 below the free radius', async () => {
    await buildModule('fake-key');
    modelMock.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(cachedDoc(3, 10)),
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
      exec: jest.fn().mockResolvedValue(cachedDoc(10, 15)),
    });

    const result = await service.calculate(testUserId, 'Origem', 'Destino', {
      pricePerKm: 1,
      minimumTravelFee: 50,
      freeRadiusKm: 5,
    });

    expect(result.travelCost).toBe(50);
  });

  it('charges for the round trip (ida e volta), not just the one-way ORS distance', async () => {
    await buildModule('fake-key');
    modelMock.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(cachedDoc(20, 25)),
    });

    const result = await service.calculate(testUserId, 'Origem', 'Destino', {
      pricePerKm: 1.5,
      minimumTravelFee: 10,
      freeRadiusKm: 5,
    });

    // 20km de ida => 40km ida+volta * R$1,50/km
    expect(result.travelCost).toBe(60);
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

  it('biases the destination geocoding to Brazil and to the origin point', async () => {
    await buildModule('fake-key');
    modelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
    modelMock.create.mockResolvedValue({ _id: new Types.ObjectId() });

    fetchSpy = jest.spyOn(global, 'fetch');
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify(geocodeResponse(-46.7, -23.6)), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(directionsResponse(20000, 1800)), { status: 200 }));

    await service.calculate(
      testUserId,
      { lat: -3.31673, lon: -40.092974 },
      'Praia da Baleia',
      { pricePerKm: 2, minimumTravelFee: 20, freeRadiusKm: 5 },
    );

    const geocodeUrl = String(fetchSpy.mock.calls[0][0]);
    expect(geocodeUrl).toContain('boundary.country=BRA');
    expect(geocodeUrl).toContain('focus.point.lat=-3.31673');
    expect(geocodeUrl).toContain('focus.point.lon=-40.092974');
  });

  it('sends a snapping radius so beach/rural points still reach a road', async () => {
    await buildModule('fake-key');
    modelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
    modelMock.create.mockResolvedValue({ _id: new Types.ObjectId() });

    fetchSpy = jest.spyOn(global, 'fetch');
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify(geocodeResponse(-46.7, -23.6)), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(directionsResponse(20000, 1800)), { status: 200 }));

    await service.calculate(testUserId, { lat: -3.31673, lon: -40.092974 }, 'Destino', {
      pricePerKm: 2,
      minimumTravelFee: 20,
      freeRadiusKm: 5,
    });

    const directionsBody = JSON.parse(String(fetchSpy.mock.calls[1][1].body));
    expect(directionsBody.radiuses).toEqual([5000, 5000]);
  });

  it('translates the ORS "unroutable point" error (2010) into a readable message', async () => {
    await buildModule('fake-key');
    modelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

    const orsError = JSON.stringify({
      error: { code: 2010, message: 'Could not find routable point within a radius of 350.0 meters' },
    });
    fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(geocodeResponse(-39.18333, -16.26667)), { status: 200 }))
      .mockResolvedValueOnce(new Response(orsError, { status: 404 }));

    await expect(
      service.calculate(testUserId, { lat: -3.31673, lon: -40.092974 }, 'Praia da Baleia', {
        pricePerKm: 2,
        minimumTravelFee: 20,
        freeRadiusKm: 5,
      }),
    ).rejects.toThrow(/não há via mapeada nas proximidades/);
  });

  it('throws NotFoundException when ORS answers 200 without any route', async () => {
    await buildModule('fake-key');
    modelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

    fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(geocodeResponse(-46.7, -23.6)), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ routes: [] }), { status: 200 }));

    await expect(
      service.calculate(testUserId, { lat: -3.31673, lon: -40.092974 }, 'Destino', {
        pricePerKm: 2,
        minimumTravelFee: 20,
        freeRadiusKm: 5,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns and persists the destination point the geocoder chose', async () => {
    await buildModule('fake-key');
    modelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
    modelMock.create.mockResolvedValue({ _id: new Types.ObjectId() });

    fetchSpy = jest.spyOn(global, 'fetch');
    fetchSpy
      .mockResolvedValueOnce(
        new Response(JSON.stringify(geocodeResponse(-39.5, -3.4, 'Praia da Baleia, Itapipoca, CE, Brasil')), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(directionsResponse(90000, 5400)), { status: 200 }));

    const result = await service.calculate(
      testUserId,
      { lat: -3.31673, lon: -40.092974 },
      'Praia da Baleia',
      { pricePerKm: 2, minimumTravelFee: 20, freeRadiusKm: 5 },
    );

    expect(result.resolvedDestination).toEqual({
      label: 'Praia da Baleia, Itapipoca, CE, Brasil',
      lat: -3.4,
      lon: -39.5,
    });
    expect(modelMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        resolvedDestinationLabel: 'Praia da Baleia, Itapipoca, CE, Brasil',
        resolvedDestinationLat: -3.4,
        resolvedDestinationLon: -39.5,
      }),
    );
  });

  it('falls back to the searched text when the geocoder returns no label', async () => {
    await buildModule('fake-key');
    modelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
    modelMock.create.mockResolvedValue({ _id: new Types.ObjectId() });

    fetchSpy = jest.spyOn(global, 'fetch');
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify(geocodeResponse(-39.5, -3.4)), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(directionsResponse(90000, 5400)), { status: 200 }));

    const result = await service.calculate(testUserId, { lat: -3.31673, lon: -40.092974 }, 'Praia da Baleia', {
      pricePerKm: 2,
      minimumTravelFee: 20,
      freeRadiusKm: 5,
    });

    expect(result.resolvedDestination?.label).toBe('Praia da Baleia');
  });

  it('returns the stored destination point on a cache hit', async () => {
    await buildModule('fake-key');
    modelMock.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(),
        distanceKm: 90,
        durationMin: 90,
        resolvedDestinationLabel: 'Praia da Baleia, Itapipoca, CE, Brasil',
        resolvedDestinationLat: -3.4,
        resolvedDestinationLon: -39.5,
      }),
    });

    const result = await service.calculate(testUserId, 'Origem', 'Praia da Baleia', {
      pricePerKm: 2,
      minimumTravelFee: 20,
      freeRadiusKm: 5,
    });

    expect(result.cached).toBe(true);
    expect(result.resolvedDestination).toEqual({
      label: 'Praia da Baleia, Itapipoca, CE, Brasil',
      lat: -3.4,
      lon: -39.5,
    });
  });

  it('discards and recalculates cache entries stored before the destination point existed', async () => {
    await buildModule('fake-key');
    const staleId = new Types.ObjectId();
    modelMock.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: staleId, distanceKm: 90, durationMin: 90 }),
    });
    modelMock.create.mockResolvedValue({ _id: new Types.ObjectId() });

    fetchSpy = jest.spyOn(global, 'fetch');
    fetchSpy
      .mockResolvedValueOnce(
        new Response(JSON.stringify(geocodeResponse(-39.5, -3.4, 'Destino, Cidade, CE, Brasil')), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(directionsResponse(90000, 5400)), { status: 200 }));

    const result = await service.calculate(testUserId, { lat: -3.31673, lon: -40.092974 }, 'Destino', {
      pricePerKm: 2,
      minimumTravelFee: 20,
      freeRadiusKm: 5,
    });

    expect(modelMock.findByIdAndDelete).toHaveBeenCalledWith(staleId);
    expect(result.cached).toBe(false);
    expect(result.resolvedDestination).toEqual({
      label: 'Destino, Cidade, CE, Brasil',
      lat: -3.4,
      lon: -39.5,
    });
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
