# 27F — TypeScript vs Go gRPC Benchmark POC

This directory is the first executable POC for the service-to-service runtime decision in Issue #1.

## Goal

Compare **TypeScript/Node.js + gRPC/Protobuf** and **Go + gRPC/Protobuf** using the same contract and Dawat-shaped workloads. Java is intentionally excluded from this evaluation.

The benchmark is designed to measure the complete RPC path rather than protobuf serialization alone.

## Initial scope

- Same `.proto` contract.
- Unary RPCs only in the first POC.
- Persistent HTTP/2 channel/connection reuse.
- TLS is the primary transport configuration.
- Warmup before measurement.
- No database, Kafka, external provider, or framework overhead in the core runtime benchmark.
- Business work is deliberately deterministic and equivalent across implementations.

## Workloads

| Scenario | Target payload |
|---|---:|
| AuthorizeRequest | 0.5–2 KB |
| GetOrderStatus | 1–3 KB |
| CreateOrder | 2–10 KB |
| GetMenuItem | 2–5 KB |
| GetOrderDetails | 5–20 KB |
| MediumMenu | 50–100 KB |
| LargeMenu | 500 KB–1 MB |

## Measurement phases

1. Serialization-only baseline.
2. Pure unary RPC with warm persistent channels and TLS.
3. Concurrency sweep.
4. Equivalent decode → validation → deterministic calculation → encode workload.
5. Failure tests: deadlines, cancellation, reconnect, overload and retry amplification.

## Primary metrics

- p50 / p90 / p95 / p99 / p99.9 latency
- successful RPS and sustained throughput
- CPU and RSS memory
- network bytes
- RPS/core and CPU/request
- Node event-loop utilization/delay and heap/GC
- Go goroutines and GC

Do not use a single “X% faster” threshold. The decision is based on SLO fit, tail latency, resource cost, saturation behaviour and operational complexity.

## Reproducibility

Record OS/container image, CPU and memory limits, Node/Go versions, dependency versions, proto revision, TLS configuration, payload size, concurrency, warmup duration and run count with every result.

Results belong under `benchmarks/27f/results/` and should contain raw measurements plus a generated summary; conclusions must not be hard-coded into the harness.

## Next implementation step

Add the shared protobuf contract and equivalent TS/Go servers/clients, then execute the matrix on a controlled environment.
