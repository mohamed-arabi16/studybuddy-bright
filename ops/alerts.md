# Alert Thresholds Definition

This document defines alert thresholds for StudyBuddy production monitoring. These thresholds align with non-functional requirements and SLO targets.

## Service Level Objectives (SLOs)

| Metric | Target | Measurement Period |
|--------|--------|-------------------|
| Uptime | 99.5% | Monthly |
| API Response Time (p95) | < 2 seconds | Daily |
| AI Job Success Rate | > 95% | Daily |
| Error Rate | < 1% | Daily |

---

## 1. Error Rate Thresholds (Sentry)

### Frontend Errors

| Level | Threshold | Action |
|-------|-----------|--------|
| **Warning** | > 10 errors/hour | Slack notification |
| **Critical** | > 50 errors/hour | Email + Slack |
| **Emergency** | > 200 errors/hour | PagerDuty + immediate investigation |

### Backend/Edge Function Errors

| Level | Threshold | Action |
|-------|-----------|--------|
| **Warning** | > 5 errors/hour per function | Slack notification |
| **Critical** | > 20 errors/hour per function | Email + Slack |
| **Emergency** | > 50 errors/hour per function | PagerDuty + rollback consideration |

### Sentry Alert Configuration

```yaml
# Recommended Sentry alert rules
alerts:
  - name: "High Frontend Error Rate"
    conditions:
      - type: event_frequency
        value: 50
        interval: 1h
    filters:
      - platform: javascript
    actions:
      - type: slack
        channel: "#alerts"
      - type: email
        recipients: ["ops@company.com"]

  - name: "Edge Function Failure Spike"
    conditions:
      - type: event_frequency
        value: 20
        interval: 1h
    filters:
      - tags:
          runtime: deno
    actions:
      - type: slack
        channel: "#alerts"
```

---

## 2. Edge Function 5xx Rate

### Thresholds by Function

| Function | Warning (5min) | Critical (5min) | Emergency |
|----------|----------------|-----------------|-----------|
| `extract-topics` | > 3 errors | > 10 errors | > 25 errors |
| `generate-unified-plan` | > 3 errors | > 10 errors | > 25 errors |
| `parse-pdf` | > 5 errors | > 15 errors | > 30 errors |
| `healthz` | > 1 error | > 3 errors | > 5 errors |

### Response Time Thresholds

| Function | Warning | Critical |
|----------|---------|----------|
| `extract-topics` | > 30 seconds | > 60 seconds |
| `generate-unified-plan` | > 15 seconds | > 30 seconds |
| `parse-pdf` | > 45 seconds | > 90 seconds |
| `healthz` | > 2 seconds | > 5 seconds |

### Monitoring Query (Supabase Logs)

```sql
-- 5xx error rate by function (last hour)
SELECT 
  function_name,
  COUNT(*) FILTER (WHERE status >= 500) as error_count,
  COUNT(*) as total_requests,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status >= 500) / NULLIF(COUNT(*), 0), 2) as error_rate_pct
FROM edge_function_logs
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY function_name
ORDER BY error_count DESC;
```

---

## 3. AI Endpoint Thresholds

### Failure Rate (Lovable AI Gateway)

| Level | Threshold | Measurement | Action |
|-------|-----------|-------------|--------|
| **Warning** | > 5% failure rate | Last 100 requests | Slack notification |
| **Critical** | > 15% failure rate | Last 100 requests | Email + Slack |
| **Emergency** | > 30% failure rate | Last 50 requests | Disable AI features |

### Latency Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Average latency | > 5 seconds | > 10 seconds |
| p95 latency | > 15 seconds | > 30 seconds |
| p99 latency | > 30 seconds | > 60 seconds |

### Credit/Cost Alerts

| Metric | Warning | Critical |
|--------|---------|----------|
| Daily AI spend | > $50 | > $100 |
| Per-user credit consumption | > 500 credits/day | > 1000 credits/day |
| Free tier abuse (single user) | > 45 credits/day | > 50 credits/day |

### Monitoring Query (ai_jobs table)

```sql
-- AI job success rate and latency (last 24h)
SELECT 
  job_type,
  COUNT(*) as total_jobs,
  COUNT(*) FILTER (WHERE status = 'completed') as successful,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'completed') / NULLIF(COUNT(*), 0), 1) as success_rate,
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_duration_sec
FROM ai_jobs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY job_type;

-- Token usage monitoring
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  SUM(tokens_in) as total_tokens_in,
  SUM(tokens_out) as total_tokens_out,
  SUM(computed_cost_usd) as total_cost
FROM credit_usage_events
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;
```

---

## 4. Database Thresholds

### Connection Pool

| Metric | Warning | Critical |
|--------|---------|----------|
| Active connections | > 80% of pool | > 95% of pool |
| Connection wait time | > 500ms | > 2 seconds |

### Query Performance

| Metric | Warning | Critical |
|--------|---------|----------|
| Slow queries (> 1s) | > 10/hour | > 50/hour |
| Lock wait time | > 100ms avg | > 500ms avg |
| Dead tuples ratio | > 10% | > 25% |

### Storage

| Metric | Warning | Critical |
|--------|---------|----------|
| Database size growth | > 10% daily | > 25% daily |
| Table bloat | > 30% | > 50% |

---

## 5. Rate Limiting Alerts

### Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Rate limit hits (per hour) | > 100 | > 500 |
| Unique users rate limited | > 10 | > 50 |
| Suspected abuse (single IP) | > 50 requests/min | > 100 requests/min |

---

## 6. Business Metrics Alerts

### User Activity

| Metric | Warning | Critical | Measurement |
|--------|---------|----------|-------------|
| DAU drop | > 20% vs 7-day avg | > 40% vs 7-day avg | Daily |
| New signups | < 50% of avg | < 25% of avg | Daily |
| Plan generation failures | > 10% | > 25% | Hourly |

### Revenue/Subscription

| Metric | Warning | Critical |
|--------|---------|----------|
| Failed payments | > 5% | > 15% |
| Churn spike | > 2x normal rate | > 3x normal rate |
| Trial conversion drop | < 5% | < 2% |

---

## Alert Channel Configuration

### Severity Routing

| Severity | Channels |
|----------|----------|
| Info | Slack #monitoring |
| Warning | Slack #alerts |
| Critical | Slack #alerts + Email |
| Emergency | Slack #alerts + Email + PagerDuty |

### On-Call Escalation

```
1. Warning: Slack notification (no ack required)
2. Critical: 
   - Immediate: Slack #alerts
   - +5 min: Email to on-call
   - +15 min: SMS to on-call
3. Emergency:
   - Immediate: All channels + PagerDuty
   - +10 min: Escalate to engineering lead
   - +30 min: Escalate to CTO
```

---

## Implementation Checklist

- [ ] Configure Sentry alert rules per specification
- [ ] Set up Supabase log-based alerts
- [ ] Configure uptime monitor thresholds (see ops/uptime-monitoring.md)
- [ ] Set up cost alerts in AI gateway dashboard
- [ ] Configure Slack webhooks for all channels
- [ ] Set up PagerDuty escalation policy
- [ ] Create Grafana/dashboard for visual monitoring
- [ ] Document runbook references for each alert type
- [ ] Test alert delivery to all channels
- [ ] Schedule monthly threshold review

---

## Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-15 | 1.0.0 | Initial threshold definitions |
