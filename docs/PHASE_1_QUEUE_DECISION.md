# NEURON OS — PHASE 1 QUEUE DECISION
## Queue Technology Evaluation & Architecture Selection

> **Document Classification:** Engineering Decision Record (EDR)  
> **Status:** Approved Architecture Selection  
> **Decision Target:** Durable, decoupled background job queue for multi-tenant AI ingestion

---

## 1. Chosen Technology

**Primary Technology Selected:** **BullMQ (`bullmq`) + Redis (`ioredis`)** with a clean, strongly-typed queue abstraction layer.

---

## 2. Why BullMQ + Redis Was Selected

1. **Native Node.js / TypeScript First-Class Support:** BullMQ is built specifically for TypeScript and Node.js with native Promise APIs, strict typing, and zero native binary compilation issues across Windows and Linux.
2. **Durable Persistence & At-Least-Once Delivery:** Redis-backed persistence guarantees that jobs survive Next.js web server restarts, deployments, and temporary worker crashes.
3. **Advanced Flow & Concurrency Control:**
   - Worker concurrency is strictly bounded via `WORKER_CONCURRENCY` (e.g. 5 concurrent jobs per worker instance).
   - Built-in exponential backoff with jitter (`backoff: { type: 'exponential', delay: 5000 }`).
   - Deduplication through deterministic `jobId` keys (`study-pack:${userId}:${documentId}:${version}`).
4. **Decoupled Worker Runtime:** Workers can run as independent, standalone Node.js processes (`npm run worker` via `tsx`) in separate containers or VMs from the Next.js web application.
5. **Universal Deployment Flexibility:**
   - **Local Development:** Works out-of-the-box with local Redis (`redis://127.0.0.1:6379`) or Docker Redis.
   - **Production Cloud:** Compatible with Upstash Redis (serverless Redis with TLS), Redis Cloud, AWS ElastiCache, or GCP Memorystore.
6. **Graceful Shutdown & Observability:** Native events for `active`, `completed`, `failed`, `stalled`, and built-in graceful shutdown via `worker.close()`.

---

## 3. Why Alternatives Were Rejected

| Queue Alternative | Evaluation | Primary Reasons for Rejection |
| :--- | :--- | :--- |
| **Database-Only Polling (PostgreSQL `SKIP LOCKED`)** | Viable for low volume | Generates continuous database query load; lacks native event-driven dispatching; complex delayed retry mechanics; requires dedicated custom polling loops. |
| **AWS SQS / GCP Cloud Tasks** | Robust cloud queues | High vendor lock-in; requires complex local emulation for developer workstations; does not provide unified cross-cloud developer experience. |
| **RabbitMQ** | Enterprise message broker | Overly complex protocol (AMQP) for simple task queues; requires heavy operational overhead compared to lightweight Redis. |
| **Kafka** | Event stream processing | Designed for append-only streaming data, not stateful task tracking with individual job retries and completion leases. |

---

## 4. Production Requirements & Architecture

- **Queue Name:** `neuron-study-pack-queue`
- **Redis Connection:** Configured via `REDIS_URL` or `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` with TLS support (`rediss://`).
- **Job Payload Contract:**
  ```typescript
  export interface StudyPackJobPayload {
    jobId: string;
    userId: string;
    documentId: string;
    taskId: string;
    fileUrl: string;
    fileType: string;
    force?: boolean;
    preferences?: UserPreferences;
    enqueuedAt: string;
    generationVersion: number;
    tokens?: {
      accessToken: string;
      refreshToken: string;
    };
  }
  ```
- **Job Concurrency:** Default 5 concurrent jobs per worker container (configurable via `WORKER_CONCURRENCY`).
- **Failure Classification:**
  - **Retryable Errors:** Rate limits (`429`), network timeouts (`ETIMEDOUT`, `ECONNRESET`), transient 500/503 errors. Retried up to 3 times with exponential backoff (5s, 25s, 125s).
  - **Non-Retryable Errors:** Invalid/malformed documents, unsupported file formats, authentication/authorization failures. Failed immediately without retry storm.

---

## 5. Local Development Architecture

```text
Terminal 1: Next.js Web App
npm run dev (Runs on http://localhost:3000)

Terminal 2: Independent Worker Fleet
npm run worker (Consumes from Redis queue and executes existing AI pipeline)

Redis Instance:
Local Redis server or Upstash Redis URL in .env
```

---
