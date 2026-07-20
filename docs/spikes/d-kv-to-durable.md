# Spike D — KV LWW → durable consistency

**Evidence:** `persist.ts` single blob; plan 012 LWW characterization test.

## Options
1. Versioned KV CAS (`if-match` / generation field)
2. Durable Object single writer
3. D1 transactional tables (migration exists, unused)

## Recommendation
Keep KV until LWW test fails in production ops; then prefer DO or CAS before full D1 cutover.
