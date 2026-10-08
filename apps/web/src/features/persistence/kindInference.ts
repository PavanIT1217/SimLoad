import type { ComponentKind } from '@simload/engine';

/** Keyword → component kind, checked in order (first match wins). */
const RULES: [RegExp, ComponentKind][] = [
  [/\b(client|user|users|browser|mobile|app|frontend|web ?ui|customer|viewer)s?\b/i, 'client'],
  [/\b(cdn|cloudfront|akamai|fastly|edge)\b/i, 'cdn'],
  [
    /\b(load ?balancer|lb|alb|elb|nlb|gateway|ingress|nginx|haproxy|envoy|proxy)\b/i,
    'loadBalancer',
  ],
  [/\b(cache|redis|memcached?|varnish)\b/i, 'cache'],
  [/\b(queue|kafka|sqs|rabbit\w*|pub ?sub|stream|topic|kinesis|nats|bus)\b/i, 'queue'],
  [
    /\b(db|database|postgres\w*|mysql|sql|dynamo\w*|mongo\w*|cassandra|store|storage|s3|bucket|index|elastic\w*|warehouse)\b/i,
    'database',
  ],
  [
    /\b(external|third[- ]party|provider|stripe|paypal|twilio|sendgrid|vendor|partner|api\.)\b/i,
    'externalApi',
  ],
];

/** Guesses a component kind from a diagram label and (optionally) its shape. */
export function inferKind(label: string, shape = ''): ComponentKind {
  if (/cylinder|datastore|database/i.test(shape)) return 'database';
  if (/queue/i.test(shape)) return 'queue';
  for (const [pattern, kind] of RULES) if (pattern.test(label)) return kind;
  return 'service';
}
