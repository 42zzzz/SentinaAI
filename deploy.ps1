# SentinaAI — GCP Cloud Run Deployment Script
# Run from the repo root: .\deploy.ps1
# Prerequisites: gcloud CLI installed and authenticated

# CONFIG
$PROJECT  = "sentina-ai-486321"
$REGION   = "me-central1"
$REPO     = "me-central1-docker.pkg.dev/$PROJECT/sentinaai"
# ──────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "=== SentinaAI GCP Deployment ===" -ForegroundColor Cyan
Write-Host "Project : $PROJECT"
Write-Host "Region  : $REGION"
Write-Host ""

# ── One-time setup ────────────────────────────────────────────
Write-Host "--- [Setup] Configuring project..." -ForegroundColor Yellow
gcloud config set project $PROJECT

Write-Host "--- [Setup] Creating Artifact Registry repo (safe to re-run)..." -ForegroundColor Yellow
gcloud artifacts repositories create sentina `
    --repository-format=docker `
    --location=$REGION `
    --quiet 2>$null

# ── Wave 1: Independent services ─────────────────────────────
Write-Host ""
Write-Host "=== Wave 1: Independent Services ===" -ForegroundColor Cyan

Write-Host "--- [1/7] Building navigation-web..." -ForegroundColor Yellow
gcloud builds submit apps/navigation_web/ --tag "$REPO/navigation-web"
Write-Host "--- [1/7] Deploying navigation-web..." -ForegroundColor Yellow
$navUrl = (gcloud run deploy navigation-web `
    --image "$REPO/navigation-web" `
    --region $REGION `
    --allow-unauthenticated `
    --port 8080 `
    --format "value(status.url)" 2>&1 | Select-String "https://").Line.Trim()
Write-Host "    navigation-web URL: $navUrl" -ForegroundColor Green

Write-Host "--- [2/7] Building ai-detection..." -ForegroundColor Yellow
gcloud builds submit services/ai-detection/ --tag "$REPO/ai-detection"
Write-Host "--- [2/7] Deploying ai-detection..." -ForegroundColor Yellow
$aiUrl = (gcloud run deploy ai-detection `
    --image "$REPO/ai-detection" `
    --region $REGION `
    --allow-unauthenticated `
    --port 8080 `
    --format "value(status.url)" 2>&1 | Select-String "https://").Line.Trim()
Write-Host "    ai-detection URL: $aiUrl" -ForegroundColor Green

Write-Host "--- [3/7] Building exhibitor-ai..." -ForegroundColor Yellow
gcloud builds submit services/exhibitor-ai-pipeline/ --tag "$REPO/exhibitor-ai"
Write-Host "--- [3/7] Deploying exhibitor-ai..." -ForegroundColor Yellow
$exhibitorUrl = (gcloud run deploy exhibitor-ai `
    --image "$REPO/exhibitor-ai" `
    --region $REGION `
    --allow-unauthenticated `
    --port 8080 `
    --format "value(status.url)" 2>&1 | Select-String "https://").Line.Trim()
Write-Host "    exhibitor-ai URL: $exhibitorUrl" -ForegroundColor Green

Write-Host "--- [4/7] Building report-export..." -ForegroundColor Yellow
gcloud builds submit services/Report_export/ --tag "$REPO/report-export"
Write-Host "--- [4/7] Deploying report-export..." -ForegroundColor Yellow
gcloud run deploy report-export `
    --image "$REPO/report-export" `
    --region $REGION `
    --allow-unauthenticated `
    --port 8080
Write-Host "    report-export deployed." -ForegroundColor Green

# ── Wave 2: Dashboard backend (needs wave 1 URLs) ─────────────
Write-Host ""
Write-Host "=== Wave 2: Dashboard Backend ===" -ForegroundColor Cyan
Write-Host "--- [5/7] Building dashboard-backend..." -ForegroundColor Yellow

# Prompt for JWT secret if not set
$jwtSecret = $env:JWT_SECRET
if (-not $jwtSecret) {
    $jwtSecret = Read-Host "Enter JWT_SECRET value"
}

gcloud builds submit "apps/main dashboard/backend/" --tag "$REPO/dashboard-backend"
Write-Host "--- [5/7] Deploying dashboard-backend..." -ForegroundColor Yellow
$backendUrl = (gcloud run deploy dashboard-backend `
    --image "$REPO/dashboard-backend" `
    --region $REGION `
    --allow-unauthenticated `
    --port 8080 `
    --set-env-vars "NAVMESH_BASE_URL=$navUrl,AI_SERVICE_URL=$aiUrl,EXHIBITOR_AI_SERVICE_URL=$exhibitorUrl,JWT_SECRET=$jwtSecret" `
    --format "value(status.url)" 2>&1 | Select-String "https://").Line.Trim()
Write-Host "    dashboard-backend URL: $backendUrl" -ForegroundColor Green

# ── Wave 3: Frontends ─────────────────────────────────────────
Write-Host ""
Write-Host "=== Wave 3: Frontends ===" -ForegroundColor Cyan

Write-Host "--- [6/7] Building dashboard-frontend..." -ForegroundColor Yellow
gcloud builds submit "apps/main dashboard/frontend/" --tag "$REPO/dashboard-frontend"
Write-Host "--- [6/7] Deploying dashboard-frontend..." -ForegroundColor Yellow
$frontendUrl = (gcloud run deploy dashboard-frontend `
    --image "$REPO/dashboard-frontend" `
    --region $REGION `
    --allow-unauthenticated `
    --port 8080 `
    --format "value(status.url)" 2>&1 | Select-String "https://").Line.Trim()
Write-Host "    dashboard-frontend URL: $frontendUrl" -ForegroundColor Green

Write-Host "--- [7/7] Building digital-twin..." -ForegroundColor Yellow
gcloud builds submit apps/digital_twin_web/ --tag "$REPO/digital-twin"
Write-Host "--- [7/7] Deploying digital-twin..." -ForegroundColor Yellow
$twinUrl = (gcloud run deploy digital-twin `
    --image "$REPO/digital-twin" `
    --region $REGION `
    --allow-unauthenticated `
    --port 8080 `
    --format "value(status.url)" 2>&1 | Select-String "https://").Line.Trim()
Write-Host "    digital-twin URL: $twinUrl" -ForegroundColor Green

# ── Summary ───────────────────────────────────────────────────
Write-Host ""
Write-Host "=== Deployment Complete ===" -ForegroundColor Cyan
Write-Host "navigation-web    : $navUrl"
Write-Host "ai-detection      : $aiUrl"
Write-Host "exhibitor-ai      : $exhibitorUrl"
Write-Host "dashboard-backend : $backendUrl"
Write-Host "dashboard-frontend: $frontendUrl"
Write-Host "digital-twin      : $twinUrl"
Write-Host ""
Write-Host "now we have HTTPS lets goooooooo" -ForegroundColor Green