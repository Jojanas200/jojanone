#requires -Version 5.1
<#
.SYNOPSIS
  Create a Jojan One PLATFORM owner (the "management of Jojan One" - cross-tenant
  oversight at /admin).

.DESCRIPTION
  A platform owner is NOT a database role. Authority comes from two things:
    1. a Supabase auth account so they can sign in, and
    2. their email being present in the PLATFORM_ADMIN_EMAILS allowlist.
  A platform owner needs no workspace of their own - with none, they land on
  /admin. (For a normal workspace owner, use scripts/create-owner.ts instead.)

  This script:
    - reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local
    - creates (or reuses) a confirmed Supabase auth user for the email
    - adds the email to PLATFORM_ADMIN_EMAILS in .env.local (idempotent, backed up)

  The service-role key is only read from the env file and used for the API call;
  it is never printed.

.PARAMETER Email
  The platform owner's email address.

.PARAMETER Password
  Optional. If omitted, a strong password is generated and printed once.

.PARAMETER EnvFile
  Path to the env file (default: .env.local at the repo root).

.PARAMETER SkipEnvUpdate
  Create the auth account only; do not touch the allowlist (print the line instead).

.PARAMETER DryRun
  Show what would happen without calling the API or writing files.

.EXAMPLE
  .\scripts\create-platform-owner.ps1 -Email ops@jojan.one

.EXAMPLE
  .\scripts\create-platform-owner.ps1 -Email boss@jojan.one -Password 'S3cure-Pass!'
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Email,
  [string]$Password,
  [string]$EnvFile = ".env.local",
  [switch]$SkipEnvUpdate,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Fail([string]$msg) {
  Write-Host ""
  Write-Host "  x $msg" -ForegroundColor Red
  Write-Host ""
  exit 1
}

# --- Resolve the env file relative to the repo root -------------------------
if (-not [IO.Path]::IsPathRooted($EnvFile)) {
  $repoRoot = Split-Path -Parent $PSScriptRoot
  $EnvFile = Join-Path $repoRoot $EnvFile
}
if (-not (Test-Path -LiteralPath $EnvFile)) {
  Fail "Env file not found: $EnvFile"
}

# --- Parse the env file (values may be quoted) ------------------------------
function Read-DotEnv([string]$path) {
  $map = @{}
  foreach ($line in Get-Content -LiteralPath $path) {
    if ($line -match '^\s*#') { continue }
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
      $k = $Matches[1]
      $v = $Matches[2].Trim()
      if ($v.Length -ge 2) {
        $first = $v[0]; $last = $v[$v.Length - 1]
        if (($first -eq '"' -and $last -eq '"') -or ($first -eq "'" -and $last -eq "'")) {
          $v = $v.Substring(1, $v.Length - 2)
        }
      }
      $map[$k] = $v
    }
  }
  return $map
}

$env = Read-DotEnv $EnvFile
$url = $env['NEXT_PUBLIC_SUPABASE_URL']
$key = $env['SUPABASE_SERVICE_ROLE_KEY']
if ([string]::IsNullOrWhiteSpace($url)) { Fail "NEXT_PUBLIC_SUPABASE_URL missing in $EnvFile" }
if ([string]::IsNullOrWhiteSpace($key)) { Fail "SUPABASE_SERVICE_ROLE_KEY missing in $EnvFile" }
$url = $url.TrimEnd('/')

# --- Validate + normalise the email ----------------------------------------
$Email = $Email.Trim().ToLowerInvariant()
if ($Email -notmatch '^[^@\s]+@[^@\s]+\.[^@\s]+$') { Fail "Not a valid email: $Email" }

# --- Password (generate if not supplied) ------------------------------------
$generated = $false
if ([string]::IsNullOrWhiteSpace($Password)) {
  $lower = 'abcdefghijkmnpqrstuvwxyz'
  $upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  $digit = '23456789'
  $sym = '!@#$%^&*-_=+'
  $all = $lower + $upper + $digit + $sym
  $picks = @($lower, $upper, $digit, $sym | ForEach-Object { $_[(Get-Random -Maximum $_.Length)] })
  for ($i = 0; $i -lt 16; $i++) { $picks += $all[(Get-Random -Maximum $all.Length)] }
  $Password = -join ($picks | Sort-Object { Get-Random })
  $generated = $true
}

Write-Host ""
Write-Host "Platform owner: $Email" -ForegroundColor Cyan
Write-Host "Supabase:       $url"
Write-Host "Env file:       $EnvFile"
if ($DryRun) { Write-Host "Mode:           DRY RUN (no changes)" -ForegroundColor Yellow }
Write-Host ""

# --- 1. Create (or reuse) the auth account ----------------------------------
function Get-ErrorBody($err) {
  try {
    $resp = $err.Exception.Response
    if ($null -eq $resp) { return "" }
    $stream = $resp.GetResponseStream()
    $reader = New-Object IO.StreamReader($stream)
    return $reader.ReadToEnd()
  } catch { return "" }
}

if ($DryRun) {
  Write-Host "  would POST $url/auth/v1/admin/users (email_confirm=true)" -ForegroundColor Yellow
} else {
  $headers = @{ apikey = $key; Authorization = "Bearer $key" }
  $body = @{ email = $Email; password = $Password; email_confirm = $true } | ConvertTo-Json
  try {
    Invoke-RestMethod -Method Post -Uri "$url/auth/v1/admin/users" `
      -Headers $headers -ContentType 'application/json' -Body $body | Out-Null
    Write-Host "  + auth account created (email confirmed)" -ForegroundColor Green
  } catch {
    $errBody = Get-ErrorBody $_
    if ($errBody -match 'registered|already|exists') {
      Write-Host "  = auth account already exists - reusing it" -ForegroundColor Yellow
      if ($generated) {
        Write-Host "    (the generated password below was NOT applied to the existing account)" -ForegroundColor Yellow
      }
    } else {
      Fail "Could not create the auth account: $errBody"
    }
  }
}

# --- 2. Add the email to the PLATFORM_ADMIN_EMAILS allowlist -----------------
function Split-Emails([string]$value) {
  if ([string]::IsNullOrWhiteSpace($value)) { return @() }
  return @($value -split ',' | ForEach-Object { $_.Trim().ToLowerInvariant() } | Where-Object { $_ -ne '' })
}

$current = Split-Emails $env['PLATFORM_ADMIN_EMAILS']
$already = $current -contains $Email
$updated = @($current)
if (-not $already) { $updated += $Email }
$newLine = "PLATFORM_ADMIN_EMAILS=" + ($updated -join ',')

if ($SkipEnvUpdate) {
  Write-Host "  ~ allowlist not modified (-SkipEnvUpdate). Ensure this line is set:" -ForegroundColor Yellow
  Write-Host "      $newLine"
} elseif ($already) {
  Write-Host "  = already on the PLATFORM_ADMIN_EMAILS allowlist" -ForegroundColor Yellow
} elseif ($DryRun) {
  Write-Host "  would set: $newLine" -ForegroundColor Yellow
} else {
  # Rewrite the file: replace the existing line or append one. Preserve every
  # other line verbatim and write UTF-8 without a BOM (so bash `source` is happy).
  $lines = @(Get-Content -LiteralPath $EnvFile)
  $found = $false
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match '^\s*PLATFORM_ADMIN_EMAILS\s*=') {
      $lines[$i] = $newLine
      $found = $true
      break
    }
  }
  if (-not $found) { $lines += $newLine }

  Copy-Item -LiteralPath $EnvFile -Destination "$EnvFile.bak" -Force
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllLines($EnvFile, $lines, $utf8NoBom)
  Write-Host "  + added to PLATFORM_ADMIN_EMAILS (backup: $EnvFile.bak)" -ForegroundColor Green
}

# --- Summary ----------------------------------------------------------------
Write-Host ""
Write-Host "Done." -ForegroundColor Green
if ($generated -and -not $DryRun) {
  Write-Host ""
  Write-Host "  Sign-in password (shown once - store it now):" -ForegroundColor Cyan
  Write-Host "      $Password"
}
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Restart the dev server so it reloads .env.local (env is read at boot)."
Write-Host "  2. In production, set PLATFORM_ADMIN_EMAILS in the deployment secret store"
Write-Host "     (do not rely on .env.local in prod)."
Write-Host "  3. Sign in at /login as $Email - with no workspace you land on /admin."
Write-Host ""
