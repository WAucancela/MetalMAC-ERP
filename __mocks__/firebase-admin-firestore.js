/**
 * Mock de firebase-admin/firestore para tests unitarios.
 * Los tests de servicios que usan adminDb deben proveer sus propios mocks
 * con jest.mock('../lib/firebase-admin').
 */

const Timestamp = {
  now: () => ({ seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }),
  fromDate: (d) => ({ seconds: Math.floor(d.getTime() / 1000), nanoseconds: 0 }),
  fromMillis: (ms) => ({ seconds: Math.floor(ms / 1000), nanoseconds: 0 }),
};

module.exports = { Timestamp };
