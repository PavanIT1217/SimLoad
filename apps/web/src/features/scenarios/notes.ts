/**
 * Hover descriptions for the built-in scenarios: what each component is for
 * and what flows over each connection. Keyed by scenario id, then by node or
 * edge id (edges are "source->target", with ":read"/":write" for class edges).
 */
export const SCENARIO_NOTES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'url-shortener': {
    client: 'People clicking short links (99% redirects) and a few creating new ones.',
    lb: 'Edge load balancer: terminates TLS and spreads requests across the redirect API fleet.',
    api: 'Stateless redirect API: resolves a short code to its long URL and answers 301/302; also creates new codes.',
    db: 'Source of truth for code → URL mappings. Every redirect currently reads from here, so it is the hot spot.',
    cache: 'In-memory cache of hot short codes, so most redirects never touch the database.',
    'lb->api': 'All redirect and create requests.',
    'api->db': 'Code lookups (reads) and new link inserts (writes).',
  },
  'video-cdn': {
    client: 'Video players fetching 2–6 s HLS/DASH segments; nearly every request is a read.',
    cdn: 'Edge cache close to viewers. Segments are immutable, so the hit ratio can be very high.',
    lb: 'Load balancer in front of the origin fleet.',
    origin:
      'Origin servers that package and serve segments; far from users and with a long latency tail.',
    store: 'Object store holding encoded video segments.',
  },
  'news-feed': {
    client:
      'Mobile apps pulling feeds (reads) and posting updates (writes), following a daily traffic wave.',
    cdn: 'Caches public assets and some anonymous feed responses at the edge.',
    lb: 'API gateway: auth, routing and rate limits for feed requests.',
    feed: 'Assembles a user feed from cached timelines and ranking scores.',
    cache: 'Precomputed timelines keyed by user; misses fall back to the posts database.',
    db: 'Posts and social graph storage with read replicas.',
    rank: 'Third-party style ranking service that scores feed items; slow and capacity-limited.',
    'feed->rank': 'Ranking calls for a quarter of feed requests.',
  },
  'chat-system': {
    client: 'Chat clients sending messages and loading recent history, 50/50.',
    gw: 'WebSocket/HTTP gateway that keeps client connections and forwards requests.',
    chat: 'Chat service: validates messages, fans them out and serves conversation history.',
    db: 'Message store. Holds every conversation; writes must scale out by sharding.',
    cache: 'Recent messages per conversation, so history loads skip the database.',
    mq: 'Durable message log. Acknowledges senders immediately and feeds writes to storage.',
    'chat->cache:read': 'History reads only.',
    'chat->mq:write': 'New messages only.',
  },
  typeahead: {
    client: 'Search box sending a lookup on every keystroke.',
    lb: 'Edge load balancer for suggestion requests.',
    svc: 'Suggest service: normalises the prefix and returns the top completions.',
    index:
      'Search index with a long latency tail (σ = 0.6). Any request that reaches it risks the p99.',
    cache:
      'Top suggestions per prefix. Prefixes repeat heavily, so hit ratios above 99% are realistic.',
  },
  'flash-sale': {
    client: 'Fans hitting "buy" the moment tickets go on sale; traffic spikes 10x in seconds.',
    lb: 'Load balancer in front of the booking service.',
    booking: 'Booking service: checks availability and reserves seats; autoscales, but slowly.',
    db: 'Inventory database. Seat reservations are writes, so they all land on the primary.',
    queue:
      'Reservation queue that absorbs the spike and drains at a rate the database can sustain.',
  },
  'rate-limiter': {
    client: 'API clients with aggressive retries (2 per request, no backoff).',
    gw: 'API gateway: the right place to enforce rate limits and shed excess load early.',
    api: 'Public API with a deep queue: overload turns into long waits, timeouts and retries.',
    db: 'Backing data store with plenty of headroom.',
  },
  payments: {
    client: 'Checkout pages: 40% charge requests, 60% payment-status checks.',
    lb: 'API load balancer.',
    pay: 'Payments service: creates charges with idempotency keys and answers status checks.',
    psp: 'External payment provider: slow (~300 ms), with a limited number of concurrent calls.',
    ledger: 'Internal ledger of payment states; serves status checks without calling the provider.',
    'pay->psp:write': 'Charge requests only. Retries must reuse the idempotency key.',
    'pay->ledger:read': 'Status checks served locally.',
  },
  'multi-region': {
    client: 'Users worldwide.',
    glb: 'Global load balancer with health checks: shifts traffic away from a region that goes dark.',
    'east-lb': 'Regional load balancer in us-east.',
    'east-svc': 'API fleet in us-east. Must be able to absorb all traffic if us-west fails.',
    'east-db': 'Regional database with read replicas in us-east.',
    'west-lb': 'Regional load balancer in us-west.',
    'west-svc': 'API fleet in us-west. Must be able to absorb all traffic if us-east fails.',
    'west-db': 'Regional database with read replicas in us-west.',
  },
};
