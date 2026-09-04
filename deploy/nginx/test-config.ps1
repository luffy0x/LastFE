param(
  [switch]$SkipDocker
)

$ErrorActionPreference = 'Stop'

$main = Get-Content -Raw -LiteralPath 'deploy/nginx/nginx.conf'
$site = Get-Content -Raw -LiteralPath 'deploy/nginx/conf.d/site.conf.template'
$compose = Get-Content -Raw -LiteralPath 'compose.yaml'

function Get-ServiceBlock([string]$Name) {
  $match = [regex]::Match(
    $compose,
    "(?ms)^  $([regex]::Escape($Name)):\r?\n(.*?)(?=^  [A-Za-z0-9_-]+:\r?\n|^networks:|\z)"
  )
  if (-not $match.Success) { throw "missing $Name service" }
  return $match.Value
}

$appService = Get-ServiceBlock 'app'
$nginxService = Get-ServiceBlock 'nginx'
$maintenanceService = Get-ServiceBlock 'maintenance'
$expectedNginxImage = 'nginx:alpine@sha256:1f25fedd50aec27413031afb3a4f8ee4effcc9d843f6a76e81bfa92245ac5c06'

if ($appService -notmatch '(?m)^    image: \$\{APP_IMAGE:-knowledge-frontier-app:local\}$') { throw 'app image is not selectable by immutable deployment tag' }
if ($appService -notmatch '(?ms)^    build:\r?\n      context: \./web\r?\n      target: app$') { throw 'app image selection must preserve the app build target' }
if ($maintenanceService -notmatch '(?m)^    image: \$\{MAINTENANCE_IMAGE:-knowledge-frontier-maintenance:local\}$') { throw 'maintenance image is not selectable by immutable deployment tag' }
if ($maintenanceService -notmatch '(?ms)^    build:\r?\n      context: \./web\r?\n      target: maintenance$') { throw 'maintenance image selection must preserve the maintenance build target' }
if ($nginxService -notmatch "(?m)^    image: $([regex]::Escape($expectedNginxImage))$") { throw 'nginx image must use the reviewed linux/amd64 digest' }
if ($main -notmatch 'limit_req_zone\s+\$binary_remote_addr\s+zone=submissions:10m\s+rate=12r/m') { throw 'missing burst limit zone' }
if ($site -notmatch 'location = /api/submissions') { throw 'missing submission route' }
if ($site -notmatch 'limit_req\s+zone=submissions\s+burst=5\s+nodelay') { throw 'missing submission burst limit' }
if ($site -notmatch 'proxy_pass http://app:3000') { throw 'missing app upstream' }
if ($site -notmatch 'location = /api/github/webhook') { throw 'missing webhook route' }
if ($site -notmatch 'client_max_body_size 64k') { throw 'missing public body limit' }
if ($site -notmatch 'client_max_body_size 256k') { throw 'missing webhook body limit' }
if ($site -notmatch 'return 301 https://\$host\$request_uri') { throw 'missing HTTP-to-HTTPS redirect' }
if ($site -notmatch 'ssl_protocols TLSv1\.2 TLSv1\.3') { throw 'missing TLS 1.2/1.3 policy' }
if ($main -notmatch 'gzip on') { throw 'missing gzip compression' }
if ($site -notmatch 'location \^~ /_next/static/') { throw 'missing immutable static asset route' }
if ($site -notmatch 'Cache-Control "public, max-age=31536000, immutable"') { throw 'missing immutable static cache policy' }
if ($site -notmatch 'location \^~ /map/') { throw 'missing canonical map asset cache route' }
if ($site -notmatch 'Cache-Control "public, max-age=3600"') { throw 'missing map asset cache policy' }
if ($site -notmatch 'location \^~ /api/') { throw 'missing API cache-control route' }
if ($site -notmatch 'proxy_cache off') { throw 'missing API proxy cache disablement' }
if ($site -notmatch 'Cache-Control "no-store"') { throw 'missing API no-store policy' }
if ($site -notmatch 'proxy_set_header X-Real-IP \$remote_addr') { throw 'missing direct-peer real IP header' }
if ($site -notmatch 'proxy_set_header X-Forwarded-For \$remote_addr') { throw 'missing direct-peer forwarding header' }
if ($appService -notmatch '(?m)^      - app_internal$') { throw 'app cannot reach the internal application network' }
if ($appService -notmatch '(?m)^      - egress$') { throw 'app has no egress-capable network' }
if ($nginxService -notmatch '(?m)^      - app_internal$') { throw 'nginx cannot reach the internal app network' }
if ($maintenanceService -notmatch '(?m)^      - app_internal$') { throw 'maintenance cannot reach the application network' }
if ($maintenanceService -notmatch '(?m)^      - egress$') { throw 'maintenance has no egress-capable network' }
if ($nginxService -notmatch '(?m)^    ports:') { throw 'nginx is missing the only published service ports' }
if ($appService -match '(?m)^    ports:' -or $maintenanceService -match '(?m)^    ports:') { throw 'only nginx may publish host ports' }
if ($compose -notmatch '(?ms)^networks:\r?\n  app_internal:\r?\n    internal: true') { throw 'missing internal app network' }
if ($compose -notmatch '(?ms)^  egress:\r?\n    internal: false') { throw 'missing egress-capable network' }

if ($SkipDocker) {
  Write-Output 'Static Nginx and Compose assertions passed; Docker parser intentionally skipped.'
  exit 0
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw 'Docker is unavailable; Nginx parser was NOT RUN.'
}

$nginxRoot = (Resolve-Path -LiteralPath 'deploy/nginx').Path
docker run --rm --entrypoint sh --mount "type=bind,src=$nginxRoot,dst=/work,readonly" $expectedNginxImage -ec @'
apk add --no-cache openssl >/dev/null
mkdir -p /tmp/tls
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=localhost -keyout /tmp/tls/privkey.pem -out /tmp/tls/fullchain.pem >/dev/null 2>&1
cp /work/nginx.conf /etc/nginx/nginx.conf
sed 's/app:3000/127.0.0.1:3000/g' /work/conf.d/site.conf.template | TLS_CERT_PATH=/tmp/tls/fullchain.pem TLS_KEY_PATH=/tmp/tls/privkey.pem envsubst '${TLS_CERT_PATH} ${TLS_KEY_PATH}' > /etc/nginx/conf.d/default.conf
nginx -t
'@

if ($LASTEXITCODE -ne 0) { throw 'nginx parser rejected configuration' }
