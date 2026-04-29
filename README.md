# Vastra Order Service

## Overview
The **Order Service** is a Node.js/Express microservice responsible for order placement and management in the VastraCo e-commerce platform. It communicates with the Product Service internally for stock validation.

| Property | Value |
|----------|-------|
| **Runtime** | Node.js 20 (Alpine) |
| **Framework** | Express.js |
| **Port** | 3003 |
| **Database** | PostgreSQL (`orders_db` / `orders_db_main`) |
| **Auth** | JWT (verifies tokens issued by User Service) |
| **Inter-Service** | Calls Product Service via K8s DNS |
| **Docker Image** | `harshithasrinivas03/order-service` |

---

## Repository Structure
```
Vastra-order-service/
├── .github/workflows/
│   └── ci.yml                  # CI trigger — calls reusable template
├── src/
│   ├── server.js               # Express app entry point
│   ├── db/index.js             # PostgreSQL connection pool + schema init
│   ├── controllers/
│   │   └── orderController.js  # Order placement, listing handlers
│   ├── middleware/
│   │   └── authMiddleware.js   # JWT verification middleware
│   ├── models/
│   │   └── orderModel.js       # DB queries
│   ├── routes/
│   │   └── orderRoutes.js      # /api/orders/* route definitions
│   └── __tests__/              # Unit tests (Jest)
├── Dockerfile                  # Multi-stage Docker build
├── package.json
└── README.md
```

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/orders` | Bearer JWT | Place a new order |
| GET | `/api/orders` | Bearer JWT | List user's orders |
| GET | `/api/orders/:id` | Bearer JWT | Get order by ID |
| GET | `/health` | No | Liveness probe |
| GET | `/ready` | No | Readiness probe (checks DB) |

---

## Inter-Service Communication
The Order Service calls the **Product Service** internally to validate product availability:
```
Order Service → http://product-service.<namespace>.svc.cluster.local:3002/api/products/:id
```
This URL is configured via the `PRODUCT_SERVICE_URL` environment variable in the ConfigMap.

---

## Environment Variables

| Variable | Source | Description |
|----------|--------|-------------|
| `PORT` | Helm Deployment | Service port (3003) |
| `NODE_ENV` | ConfigMap | Environment (`dev` / `main`) |
| `ORDER_DB_HOST` | ConfigMap | PostgreSQL host (K8s DNS) |
| `ORDER_DB_PORT` | ConfigMap | PostgreSQL port (5432) |
| `ORDER_DB_NAME` | ConfigMap | Database name |
| `ORDER_DB_USER` | SealedSecret (`orders-db-secret`) | DB username |
| `ORDER_DB_PASSWORD` | SealedSecret (`orders-db-secret`) | DB password |
| `JWT_SECRET` | SealedSecret (`jwt-secret`) | JWT signing key (shared with User Service) |
| `PRODUCT_SERVICE_URL` | ConfigMap | Internal URL to Product Service |

---

## CI/CD Pipeline

### Trigger
```yaml
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
```

### Pipeline Flow
```
ci.yml (this repo) ──calls──► ci-template.yml (Reusable-template repo)

Prepare → Test → SonarQube → Snyk → Docker Build → Trivy → Docker Push → Update Helm → Release → Notify
```

### Branch-Based Deployment
| Branch | Values File | K8s Namespace | Environment |
|--------|-------------|---------------|-------------|
| `main` | `values-main.yaml` | `main` | Production |
| `develop` | `values-dev.yaml` | `dev` | Development |

---

## Dockerfile — Multi-Stage Build
```
Stage 1 (builder): node:20-alpine
  → Install build tools (python3, make, g++)
  → npm install --omit=dev
  → Patch vulnerabilities: cross-spawn@7.0.5, glob@10.5.0, minimatch@9.0.7

Stage 2 (runtime): node:20-alpine
  → Copy node_modules from builder
  → Copy source code
  → EXPOSE 3003
  → CMD ["node", "src/server.js"]
```

---

## Kubernetes Resources

| Resource | Name | Purpose |
|----------|------|---------|
| Deployment | `order-service` | Runs the service pods |
| Service | `order-service` | ClusterIP for internal routing |
| ConfigMap | `order-service-config` | Non-sensitive env vars |
| Secret | `order-service-secret` | App-level secrets |
| SealedSecret | `orders-db-secret` | Encrypted DB credentials |
| SealedSecret | `jwt-secret` | Encrypted JWT config |
| HPA | `order-service-hpa` | Auto-scaling (2–10 pods, 60% CPU) |

### Health Probes
- **Liveness**: `GET /health` — restart pod if unresponsive
- **Readiness**: `GET /ready` — checks DB connection before accepting traffic

---

## Connection Verification

```bash
# Check pods
kubectl get pods -n main -l app=order-service

# Check service
kubectl get svc order-service -n main

# Check logs
kubectl logs -l app=order-service -n main --tail=50

# Test health
kubectl run test --rm -it --image=curlimages/curl -- curl http://order-service.main.svc.cluster.local:3003/health

# Verify inter-service communication (order → product)
kubectl exec -it <order-pod> -n main -- wget -qO- http://product-service:3002/health
```

---

## Secret Management
All sensitive values managed via **Bitnami SealedSecrets**:
- `orders-db-secret` → `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- `jwt-secret` → `JWT_SECRET`, `JWT_EXPIRES_IN` (shared across User and Order services)
- Mapped in deployment: `POSTGRES_USER` → `ORDER_DB_USER`, `POSTGRES_PASSWORD` → `ORDER_DB_PASSWORD`

**No secrets are hardcoded in source code or CI workflows.**
