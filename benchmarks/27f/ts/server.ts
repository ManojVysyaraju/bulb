import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";

const root = dirname(fileURLToPath(import.meta.url));
const protoPath = join(root, "../proto/dawat_benchmark.proto");
const packageDefinition = protoLoader.loadSync(protoPath, { keepCase: false, longs: String, enums: String, defaults: true, oneofs: true });
const pkg = grpc.loadPackageDefinition(packageDefinition) as any;
const service = pkg.dawat.benchmark.v1.DawatBenchmark.service;

function money(amountMinor: number, currency = "INR") { return { amountMinor: String(amountMinor), currency }; }
function authorize(call: any, callback: any) {
  const req = call.request;
  const allowed = Boolean(req.subjectId && req.tenantId && req.branchId && req.operation);
  callback(null, { allowed, decisionId: `decision-${req.correlationId || "local"}`, reason: allowed ? "allowed" : "missing_context" });
}
function createOrder(call: any, callback: any) {
  const req = call.request;
  let subtotal = 0;
  for (const item of req.items ?? []) subtotal += Number(item.quantity || 0) * Number(item.unitPrice?.amountMinor || 0);
  const tax = Math.floor(subtotal * 0.05);
  callback(null, { orderId: req.orderId, status: "NEW", subtotal: money(subtotal, req.currency || "INR"), tax: money(tax, req.currency || "INR"), total: money(subtotal + tax, req.currency || "INR") });
}
function getOrderStatus(call: any, callback: any) { callback(null, { orderId: call.request.orderId, status: "PREPARING", updatedAt: new Date().toISOString() }); }
function getOrderDetails(call: any, callback: any) { callback(null, { orderId: call.request.orderId, status: "PREPARING", customerId: "customer-benchmark", items: [], subtotal: money(1000), tax: money(50), total: money(1050), attributes: { source: "benchmark" } }); }
function getMenuItem(call: any, callback: any) { callback(null, { itemId: call.request.itemId, name: "Benchmark Item", description: "Deterministic benchmark menu item", basePrice: money(250), available: true, tags: ["benchmark", "vegetarian"] }); }
function getMenu(call: any, callback: any) {
  const count = Math.max(1, Math.min(Number(call.request.itemCount || 10), 10000));
  const items = Array.from({ length: count }, (_, i) => ({ itemId: `item-${i}`, name: `Benchmark Item ${i}`, description: "Deterministic menu payload for RPC benchmarking", price: money(250 + (i % 20)), available: i % 17 !== 0, tags: ["benchmark", "menu"] }));
  callback(null, { items });
}

const server = new grpc.Server();
server.addService(service, { authorize, createOrder, getOrderStatus, getOrderDetails, getMenuItem, getMenu });

const port = process.env.PORT ?? "50051";
const certPath = process.env.TLS_CERT;
const keyPath = process.env.TLS_KEY;
const caPath = process.env.TLS_CA;
if (!certPath || !keyPath || !caPath) throw new Error("TLS_CERT, TLS_KEY and TLS_CA are required for the benchmark server");
const credentials = grpc.ServerCredentials.createSsl(readFileSync(caPath), [{ cert_chain: readFileSync(certPath), private_key: readFileSync(keyPath) }], false);
server.bindAsync(`0.0.0.0:${port}`, credentials, (err) => { if (err) throw err; server.start(); console.log(`dawat benchmark TS server listening with TLS on ${port}`); });
