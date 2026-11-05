import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('Health and Readiness Endpoints', () => {
  it('GET /health should return 200 with liveness envelope', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: {
        status: 'UP',
      },
    });
    expect(typeof res.body.data.uptimeSeconds).toBe('number');
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('GET /ready should return 200 when MongoDB is connected', async () => {
    const res = await request(app).get('/ready');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: {
        status: 'UP',
        dependencies: {
          database: {
            status: 'CONNECTED',
          },
        },
      },
    });
    expect(typeof res.body.data.dependencies.database.latencyMs).toBe('number');
  });

  it('GET /api/v1/health should route through versioned API prefix', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('UP');
  });

  it('should echo client-provided X-Request-Id header', async () => {
    const customReqId = 'custom-tracing-uuid-12345';
    const res = await request(app).get('/health').set('X-Request-Id', customReqId);

    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBe(customReqId);
  });

  it('GET /non-existent-route should return 404 with standard error envelope', async () => {
    const res = await request(app).get('/api/v1/unknown-endpoint');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      success: false,
      error: {
        code: 'NOT_FOUND',
      },
    });
    expect(res.body.error.message).toContain('not found');
  });
});
