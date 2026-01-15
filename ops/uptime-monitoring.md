# Uptime Monitoring Setup Guide

This document provides instructions for configuring uptime monitoring for StudyBuddy production environment.

## Health Check Endpoint

StudyBuddy provides a public health endpoint for uptime monitoring:

```
GET https://<supabase-project-ref>.supabase.co/functions/v1/healthz
```

### Response Format

```json
{
  "status": "healthy" | "degraded" | "unhealthy",
  "timestamp": "2026-01-15T10:30:00.000Z",
  "version": "1.0.0",
  "checks": {
    "database": { "status": "connected", "latency_ms": 45 },
    "ai_gateway": { "status": "operational", "latency_ms": 12 },
    "storage": { "status": "available" }
  },
  "uptime_seconds": 86400
}
```

### HTTP Status Codes

| Status Code | Meaning |
|-------------|---------|
| 200 | Healthy or Degraded (service operational) |
| 503 | Unhealthy (service down) |

## Recommended Monitoring Services

### Option 1: UptimeRobot (Free Tier Available)

1. Sign up at [uptimerobot.com](https://uptimerobot.com)
2. Create new monitor:
   - **Monitor Type**: HTTP(s)
   - **Friendly Name**: StudyBuddy Production
   - **URL**: `https://<project-ref>.supabase.co/functions/v1/healthz`
   - **Monitoring Interval**: 5 minutes
3. Configure alerts:
   - Email: ops team email
   - Slack: #alerts channel webhook
   - PagerDuty: if configured

### Option 2: Better Uptime

1. Sign up at [betteruptime.com](https://betteruptime.com)
2. Create new monitor:
   - **URL**: `https://<project-ref>.supabase.co/functions/v1/healthz`
   - **Check Period**: 3 minutes
   - **HTTP Method**: GET
   - **Expected Status Code**: 200
3. Set up on-call schedule
4. Configure escalation policies

### Option 3: Pingdom

1. Sign up at [pingdom.com](https://www.pingdom.com)
2. Create uptime check:
   - **Name**: StudyBuddy Health
   - **URL**: `https://<project-ref>.supabase.co/functions/v1/healthz`
   - **Resolution**: 1 minute
3. Configure integrations:
   - Slack
   - PagerDuty
   - Email

## Configuration Checklist

- [ ] Set up primary monitoring service (UptimeRobot/BetterUptime/Pingdom)
- [ ] Configure alert channels:
  - [ ] Email notifications to ops team
  - [ ] Slack integration to #alerts channel
  - [ ] SMS alerts for critical issues (optional)
  - [ ] PagerDuty integration (optional)
- [ ] Set appropriate check intervals:
  - Production: 1-3 minutes
  - Staging: 5 minutes
- [ ] Create status page (optional but recommended)
- [ ] Document on-call rotation

## Environment-Specific Endpoints

| Environment | Health Check URL |
|-------------|------------------|
| Production | `https://<prod-ref>.supabase.co/functions/v1/healthz` |
| Staging | `https://<staging-ref>.supabase.co/functions/v1/healthz` |

## Alert Configuration

### Recommended Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Response Time | > 2 seconds | > 5 seconds |
| Consecutive Failures | 2 | 3 |
| Status Code | Non-200 | 503 |

### Alert Escalation

1. **First alert**: Send to Slack #alerts channel
2. **After 5 minutes**: Email ops team
3. **After 15 minutes**: SMS to on-call engineer
4. **After 30 minutes**: Escalate to engineering lead

## Manual Health Check

You can manually verify the health endpoint:

```bash
# Simple check
curl -s https://<project-ref>.supabase.co/functions/v1/healthz | jq .

# Check with timing
time curl -s -o /dev/null -w "%{http_code}" \
  https://<project-ref>.supabase.co/functions/v1/healthz

# Full response with headers
curl -v https://<project-ref>.supabase.co/functions/v1/healthz
```

## Troubleshooting

### Health Check Returns 503

1. Check Supabase Dashboard for service status
2. Verify edge function is deployed: `supabase functions list`
3. Check function logs: `supabase functions logs healthz`
4. Verify environment variables are set

### High Latency

1. Check database query performance in Supabase Dashboard
2. Review AI job failure rates
3. Check for concurrent function invocations

### False Positives

1. Increase check interval if seeing flapping
2. Require multiple consecutive failures before alerting
3. Check network connectivity from monitoring service
