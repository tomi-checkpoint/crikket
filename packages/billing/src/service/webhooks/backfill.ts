import { db } from "@crikket/db"
import { billingWebhookEvent } from "@crikket/db/schema/billing"
import { sql } from "drizzle-orm"

import { extractReferenceId } from "../polar-payload"
import type { PolarWebhookPayload, WebhookBillingBackfill } from "../types"
import { asRecord } from "../utils"
import { extractWebhookBillingProjection } from "./projection"

export async function findWebhookBillingBackfill(
  organizationId: string
): Promise<WebhookBillingBackfill | null> {
  const recentWebhookEvents = await db
    .select({
      payload: billingWebhookEvent.payload,
    })
    .from(billingWebhookEvent)
    .orderBy(sql`${billingWebhookEvent.receivedAt} DESC`)
    .limit(500)

  for (const event of recentWebhookEvents) {
    const payloadRecord = asRecord(event.payload)
    if (!payloadRecord) {
      continue
    }

    const payload = payloadRecord as PolarWebhookPayload
    if (extractReferenceId(payload) !== organizationId) {
      continue
    }

    const projection = extractWebhookBillingProjection(payload)
    const hasProjectionData =
      projection.plan !== undefined ||
      projection.subscriptionStatus !== undefined ||
      projection.polarCustomerId !== undefined ||
      projection.polarSubscriptionId !== undefined ||
      projection.currentPeriodStart !== undefined ||
      projection.currentPeriodEnd !== undefined ||
      projection.cancelAtPeriodEnd !== undefined

    if (!hasProjectionData) {
      continue
    }

    return {
      plan: projection.plan,
      subscriptionStatus: projection.subscriptionStatus,
      polarCustomerId: projection.polarCustomerId,
      polarSubscriptionId: projection.polarSubscriptionId,
      currentPeriodStart: projection.currentPeriodStart,
      currentPeriodEnd: projection.currentPeriodEnd,
      cancelAtPeriodEnd: projection.cancelAtPeriodEnd,
    }
  }

  return null
}
