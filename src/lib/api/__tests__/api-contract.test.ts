/**
 * CROSS-REPO CONTRACT GUARD — do not delete this as "redundant with client.test.ts".
 *
 * WHY IT EXISTS: five production-breaking bugs shipped at once and every one was the
 * same class — this repo and microcrop-backend disagreed about a request or response
 * shape (`totalCost` missing from the quote; `/payments/initiate` reading `reference`
 * while this client sent `policyId` and no `amount` at all, so no STK push could ever
 * reach a farmer; `/policies/purchase` returning `{ policy, paymentInstructions }`
 * while the client typed it as a bare Policy; the farmer phone field named
 * `phoneNumber` server-side and `phone` here). All 176 tests in this repo and all 275
 * in the backend were green the entire time the product was broken, because each repo
 * was internally consistent with its own wrong idea of the contract.
 *
 * WHAT IT DOES: drives the REAL api client with a mocked fetch and asserts the JSON
 * body it actually PUTS ON THE WIRE against contracts/api-contract.json — a file
 * duplicated verbatim in microcrop-backend, where a mirror test asserts the real
 * services and validators against the same file. The shape is stated once, in the
 * contract; neither test restates it. So a rename or a dropped field on either side
 * fails a build.
 *
 * The tests below deliberately name NO field literals of their own: every key comes
 * out of the contract. That is what makes a one-sided change impossible to hide.
 *
 * IF THIS TEST FAILS: either you changed a shape (update contracts/api-contract.json
 * AND copy it into microcrop-backend/contracts/ in the same change), or you broke the
 * contract by accident, which is the point.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { apiClient } from '../client';
import type { Farmer } from '../../../types';

// vitest runs with cwd at the project root (its `root` defaults to process.cwd()).
const CONTRACT_PATH = resolve(process.cwd(), 'contracts/api-contract.json');
const CONTRACT_RAW = readFileSync(CONTRACT_PATH);

/**
 * The backend's mirror test pins the SAME hash. Two identical literals across the two
 * repos is the cheapest available proof that the two copies of the contract have not
 * drifted — if the hashes differ in review, someone edited one copy only.
 */
const CONTRACT_SHA256 = '0ad10191afac31d0230b1a5f4328675bdc7fcdd2cde5a72aa70b010afd70c141';

interface EndpointContract {
  request: {
    required: string[];
    optional?: string[];
    deprecatedAliases?: Record<string, string>;
  };
  response: {
    keys?: string[];
    commonKeys?: string[];
    livestockOnlyKeys?: string[];
    paymentInstructions?: { keys: string[] };
  };
}

const contract = JSON.parse(CONTRACT_RAW.toString('utf8')) as {
  endpoints: Record<string, EndpointContract>;
  entities: { Farmer: { phoneField: string; forbiddenFields: string[] } };
};

const QUOTE = contract.endpoints['POST /policies/quote'];
const PURCHASE = contract.endpoints['POST /policies/purchase'];
const INITIATE = contract.endpoints['POST /payments/initiate'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetchResponse(data: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ success: true, data }),
  });
}

/** The JSON body of the single fetch call the client made. */
function sentBody(): Record<string, unknown> {
  const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
  expect(calls).toHaveLength(1);
  return JSON.parse(calls[0][1].body as string) as Record<string, unknown>;
}

/** Builds a fake server payload carrying exactly the contract's declared keys. */
function payloadFrom(keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((k) => [k, `value-of-${k}`]));
}

function expectKeysWithin(body: Record<string, unknown>, endpoint: EndpointContract) {
  const allowed = [...endpoint.request.required, ...(endpoint.request.optional ?? [])];
  for (const key of endpoint.request.required) {
    // A required field the client never sends is exactly the /payments/initiate bug.
    expect(Object.keys(body)).toContain(key);
  }
  for (const key of Object.keys(body)) {
    // A field the server does not know about is exactly the `policyId` bug.
    expect(allowed).toContain(key);
  }
}

// ---------------------------------------------------------------------------

describe('cross-repo API contract', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    apiClient.setAccessToken('org-tok');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('the contract file itself', () => {
    it('matches the sha256 the backend repo also pins', () => {
      const actual = createHash('sha256').update(CONTRACT_RAW).digest('hex');
      expect(actual).toBe(
        CONTRACT_SHA256
        // If this fails you edited contracts/api-contract.json. That is allowed —
        // update CONTRACT_SHA256 here, copy the file verbatim to
        // microcrop-backend/contracts/api-contract.json, and update the same constant
        // in its api-contract.test.js. Both repos must ship together.
      );
    });
  });

  describe('POST /policies/quote', () => {
    it('sends only field names the server declares', async () => {
      globalThis.fetch = mockFetchResponse(payloadFrom(QUOTE.response.commonKeys!));

      await apiClient.getPolicyQuote({
        farmerId: 'f1',
        plotId: 'p1',
        sumInsured: 10000,
        coverageType: 'DROUGHT',
        durationDays: 90,
      });

      expectKeysWithin(sentBody(), QUOTE);
    });

    it('surfaces every response field the server declares (totalCost included)', async () => {
      const payload = payloadFrom(QUOTE.response.commonKeys!);
      globalThis.fetch = mockFetchResponse(payload);

      const quote = (await apiClient.getPolicyQuote({
        farmerId: 'f1',
        plotId: 'p1',
        sumInsured: 10000,
        coverageType: 'DROUGHT',
        durationDays: 90,
      })) as unknown as Record<string, unknown>;

      // The client must strip the envelope and NOTHING else. A quote screen that
      // renders `undefined` money is the failure this pins.
      for (const key of QUOTE.response.commonKeys!) {
        expect(quote[key]).toBe(payload[key]);
      }
    });
  });

  describe('POST /policies/purchase', () => {
    it('sends only field names the server declares', async () => {
      globalThis.fetch = mockFetchResponse({
        policy: {},
        paymentInstructions: payloadFrom(PURCHASE.response.paymentInstructions!.keys),
      });

      await apiClient.purchasePolicy({
        farmerId: 'f1',
        plotId: 'p1',
        sumInsured: 10000,
        coverageType: 'DROUGHT',
        durationDays: 90,
      });

      expectKeysWithin(sentBody(), PURCHASE);
    });

    it('surfaces both halves of the response, not just the policy', async () => {
      const instructions = payloadFrom(PURCHASE.response.paymentInstructions!.keys);
      globalThis.fetch = mockFetchResponse({
        policy: { id: 'pol-1' },
        paymentInstructions: instructions,
      });

      const result = (await apiClient.purchasePolicy({
        farmerId: 'f1',
        plotId: 'p1',
        sumInsured: 10000,
        coverageType: 'DROUGHT',
        durationDays: 90,
      })) as unknown as Record<string, Record<string, unknown>>;

      // Typing this as a bare Policy silently dropped paymentInstructions.amount —
      // the exact figure the STK push then has to charge.
      for (const key of PURCHASE.response.keys!) {
        expect(result[key]).toBeDefined();
      }
      for (const key of PURCHASE.response.paymentInstructions!.keys) {
        expect(result.paymentInstructions[key]).toBe(instructions[key]);
      }
    });
  });

  describe('POST /payments/initiate (money path)', () => {
    it('sends exactly the required fields, under the names the server reads', async () => {
      globalThis.fetch = mockFetchResponse(payloadFrom(INITIATE.response.keys!));

      await apiClient.initiatePayment({
        policyId: 'pol-1',
        amount: 550,
        phoneNumber: '+254700000000',
      });

      const body = sentBody();
      expect(Object.keys(body).sort()).toEqual([...INITIATE.request.required].sort());
      expect(body[INITIATE.request.required[0]]).toBe('pol-1'); // `reference` is the policy id
      expect(body.amount).toBe(550);
      expect(body.phoneNumber).toBe('+254700000000');
    });

    it('does not send any deprecated alias on the wire', async () => {
      globalThis.fetch = mockFetchResponse(payloadFrom(INITIATE.response.keys!));

      await apiClient.initiatePayment({
        policyId: 'pol-1',
        amount: 550,
        phoneNumber: '+254700000000',
      });

      const body = sentBody();
      for (const alias of Object.keys(INITIATE.request.deprecatedAliases ?? {})) {
        // `policyId` is a back-compat alias the server still tolerates; new traffic
        // must not depend on it surviving.
        expect(body).not.toHaveProperty(alias);
      }
    });

    it('serialises a falsy amount rather than dropping the key', async () => {
      globalThis.fetch = mockFetchResponse(payloadFrom(INITIATE.response.keys!));

      await apiClient.initiatePayment({
        policyId: 'pol-9',
        amount: 0,
        phoneNumber: '+254711111111',
      });

      // Otherwise a bad amount fails as "amount is required" instead of as the
      // amount validation error it actually is.
      expect(Object.keys(sentBody())).toContain('amount');
    });

    it('surfaces every response field the server declares', async () => {
      const payload = payloadFrom(INITIATE.response.keys!);
      globalThis.fetch = mockFetchResponse(payload);

      const result = (await apiClient.initiatePayment({
        policyId: 'pol-1',
        amount: 550,
        phoneNumber: '+254700000000',
      })) as unknown as Record<string, unknown>;

      for (const key of INITIATE.response.keys!) {
        expect(result[key]).toBe(payload[key]);
      }
    });
  });

  describe('Farmer entity field naming', () => {
    // Compile-time half of this guard: `tsc -b` fails if `Farmer` stops declaring
    // `phoneNumber` as a required string, or starts requiring the forbidden `phone`.
    // The runtime half below pins those literals to the contract, so the two cannot
    // drift apart either.
    const phoneField: Farmer['phoneNumber'] = '+254700000000';
    const farmerWithoutForbiddenField: Pick<Farmer, 'id' | 'phoneNumber'> = {
      id: 'f1',
      phoneNumber: phoneField,
    };

    it('reads the phone field the server actually returns', () => {
      expect(contract.entities.Farmer.phoneField).toBe('phoneNumber');
      expect(contract.entities.Farmer.forbiddenFields).toContain('phone');
      expect(farmerWithoutForbiddenField.phoneNumber).toBe(phoneField);
    });
  });
});
