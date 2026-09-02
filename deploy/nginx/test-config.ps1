param(
  [switch]$SkipDocker
)

$ErrorActionPreference = 'Stop'

$main = Get-Content -Raw -LiteralPath 'deploy/nginx/nginx.conf'
$site = Get-Content -Raw -LiteralPath 'deploy/nginx/conf.d/site.conf.template'
$compose = Get-Content -Raw -LiteralPath 'compose.yaml'

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
if ($site -notmatch 'location ~\* \\\.\(\?:geojson\|topojson\)\$') { throw 'missing map asset cache route' }
if ($site -notmatch 'Cache-Control "public, max-age=3600"') { throw 'missing map asset cache policy' }
if ($site -notmatch 'location \^~ /api/') { throw 'missing API cache-control route' }
if ($site -notmatch 'proxy_cache off') { throw 'missing API proxy cache disablement' }
if ($site -notmatch 'Cache-Control "no-store"') { throw 'missing API no-store policy' }
if ($site -notmatch 'proxy_set_header X-Real-IP \$remote_addr') { throw 'missing direct-peer real IP header' }
if ($site -notmatch 'proxy_set_header X-Forwarded-For \$remote_addr') { throw 'missing direct-peer forwarding header' }
if ($compose -notmatch '(?ms)^  app:\r?\n.*?^    networks:\r?\n\s+- app_internal') { throw 'app is not isolated on the internal network' }
if ($compose -notmatch '(?ms)^  nginx:\r?\n.*?^    networks:\r?\n\s+- app_internal') { throw 'nginx cannot reach the internal app network' }
if ($compose -notmatch '(?ms)^networks:\r?\n  app_internal:\r?\n    internal: true') { throw 'missing internal app network' }

if ($SkipDocker) {
  Write-Output 'Static Nginx and Compose assertions passed; Docker parser intentionally skipped.'
  exit 0
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw 'Docker is unavailable; Nginx parser was NOT RUN.'
}

$nginxRoot = (Resolve-Path -LiteralPath 'deploy/nginx').Path
docker run --rm --entrypoint sh --mount "type=bind,src=$nginxRoot,dst=/work,readonly" nginx:alpine -ec @'
apk add --no-cache openssl >/dev/null
mkdir -p /tmp/tls
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=localhost -keyout /tmp/tls/privkey.pem -out /tmp/tls/fullchain.pem >/dev/null 2>&1
cp /work/nginx.conf /etc/nginx/nginx.conf
TLS_CERT_PATH=/tmp/tls/fullchain.pem TLS_KEY_PATH=/tmp/tls/privkey.pem envsubst '${TLS_CERT_PATH} ${TLS_KEY_PATH}' < /work/conf.d/site.conf.template > /etc/nginx/conf.d/default.conf
nginx -t
'@

if ($LASTEXITCODE -ne 0) { throw 'nginx parser rejected configuration' }
