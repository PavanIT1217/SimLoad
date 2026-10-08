import type { ComponentKind } from '../model/types';

export type CloudProviderId = 'aws' | 'azure' | 'gcp';

/** A managed offering that one simulated instance (or request stream) maps to. */
export interface CloudSku {
  /** Product and size, e.g. "EC2 m7i.large". */
  sku: string;
  /** Price per billable instance per hour (USD). */
  perHour: number;
  /** Price per million requests or messages served (USD), including data transfer. */
  perMillion: number;
}

export interface CloudPriceList {
  id: CloudProviderId;
  name: string;
  region: string;
  /** Official pricing pages to verify against. */
  sources: string[];
  skus: Partial<Record<ComponentKind, CloudSku>>;
}

/** When the list prices below were last checked. */
export const CLOUD_PRICES_AS_OF = '2026-10';

/**
 * Traffic assumptions used to turn per-GB charges into per-request prices:
 * average size of an API request plus response (through a load balancer), of
 * an object served by a CDN, and of a queue message.
 */
export const PRICING_ASSUMPTIONS = { apiKb: 4, cdnObjectKb: 50, messageKb: 1 } as const;

const gbPerMillion = (kb: number): number => (kb * 1e6) / 1024 ** 2;
const TIB_PER_MILLION_MESSAGES = gbPerMillion(PRICING_ASSUMPTIONS.messageKb) / 1024;

/** Per-million price of API traffic processed at `perGb`. */
const processed = (perGb: number): number => gbPerMillion(PRICING_ASSUMPTIONS.apiKb) * perGb;
/** Per-million price of CDN objects delivered at `perGb`. */
const egress = (perGb: number): number => gbPerMillion(PRICING_ASSUMPTIONS.cdnObjectKb) * perGb;

/**
 * On-demand list prices (Linux, no reservations or committed-use discounts) for
 * comparable building blocks: a 2 vCPU / 8 GB VM per service instance, a
 * ~6 GB managed Redis node per cache instance, a 2 vCPU managed PostgreSQL
 * server per database instance (single zone), and pay-per-use LB, queue and CDN.
 */
export const CLOUD_PRICE_LISTS: readonly CloudPriceList[] = [
  {
    id: 'aws',
    name: 'AWS',
    region: 'us-east-1 (N. Virginia)',
    sources: [
      'https://aws.amazon.com/ec2/pricing/on-demand/',
      'https://aws.amazon.com/elasticloadbalancing/pricing/',
      'https://aws.amazon.com/elasticache/pricing/',
      'https://aws.amazon.com/rds/postgresql/pricing/',
      'https://aws.amazon.com/sqs/pricing/',
      'https://aws.amazon.com/cloudfront/pricing/',
    ],
    skus: {
      // CloudFront: $0.0075 per 10k HTTPS requests + $0.085/GB to the internet.
      cdn: { sku: 'CloudFront', perHour: 0, perMillion: 0.75 + egress(0.085) },
      // ALB: $0.0225/h + $0.008 per LCU-hour; 1 LCU = 1 GB/h processed.
      loadBalancer: { sku: 'Application LB', perHour: 0.0225, perMillion: processed(0.008) },
      service: { sku: 'EC2 m7i.large', perHour: 0.1008, perMillion: 0 },
      cache: { sku: 'ElastiCache cache.m7g.large', perHour: 0.158, perMillion: 0 },
      database: { sku: 'RDS PostgreSQL db.r7g.large', perHour: 0.239, perMillion: 0 },
      // Standard queue: $0.40 per million API requests.
      queue: { sku: 'SQS standard', perHour: 0, perMillion: 0.4 },
    },
  },
  {
    id: 'azure',
    name: 'Azure',
    region: 'East US',
    sources: [
      'https://azure.microsoft.com/pricing/details/virtual-machines/linux/',
      'https://azure.microsoft.com/pricing/details/load-balancer/',
      'https://azure.microsoft.com/pricing/details/cache/',
      'https://azure.microsoft.com/pricing/details/postgresql/flexible-server/',
      'https://azure.microsoft.com/pricing/details/service-bus/',
      'https://azure.microsoft.com/pricing/details/frontdoor/',
    ],
    skus: {
      // Front Door Standard: $35/month base + $0.009 per 10k requests + ~$0.083/GB egress.
      cdn: { sku: 'Front Door Standard', perHour: 35 / 730, perMillion: 0.9 + egress(0.083) },
      // Standard LB: $0.025/h for the first 5 rules + $0.005/GB processed.
      loadBalancer: { sku: 'Load Balancer Standard', perHour: 0.025, perMillion: processed(0.005) },
      service: { sku: 'VM D2s v5', perHour: 0.096, perMillion: 0 },
      cache: { sku: 'Azure Cache for Redis C3', perHour: 0.2, perMillion: 0 },
      database: { sku: 'PostgreSQL Flexible D2ds v5', perHour: 0.178, perMillion: 0 },
      // Standard tier: $10/month base + ~$0.80 per million operations.
      queue: { sku: 'Service Bus Standard', perHour: 10 / 730, perMillion: 0.8 },
    },
  },
  {
    id: 'gcp',
    name: 'Google Cloud',
    region: 'us-central1 (Iowa)',
    sources: [
      'https://cloud.google.com/compute/vm-instance-pricing',
      'https://cloud.google.com/load-balancing/pricing',
      'https://cloud.google.com/memorystore/docs/redis/pricing',
      'https://cloud.google.com/sql/pricing',
      'https://cloud.google.com/pubsub/pricing',
      'https://cloud.google.com/cdn/pricing',
    ],
    skus: {
      // Cloud CDN: $0.0075 per 10k requests + $0.08/GB cache egress (North America).
      cdn: { sku: 'Cloud CDN', perHour: 0, perMillion: 0.75 + egress(0.08) },
      // Forwarding rule $0.025/h + ~$0.008/GB data processed.
      loadBalancer: { sku: 'Cloud Load Balancing', perHour: 0.025, perMillion: processed(0.008) },
      service: { sku: 'GCE n2-standard-2', perHour: 0.0971, perMillion: 0 },
      // Basic tier, 6 GiB at $0.027 per GiB-hour.
      cache: { sku: 'Memorystore Redis 6 GiB', perHour: 6 * 0.027, perMillion: 0 },
      // Enterprise edition: 2 vCPU x $0.0413 + 8 GiB x $0.007 per hour.
      database: {
        sku: 'Cloud SQL PostgreSQL 2 vCPU',
        perHour: 2 * 0.0413 + 8 * 0.007,
        perMillion: 0,
      },
      // $40 per TiB of throughput, counting publish and delivery.
      queue: { sku: 'Pub/Sub', perHour: 0, perMillion: 2 * TIB_PER_MILLION_MESSAGES * 40 },
    },
  },
];
