import { db } from "@crikket/db"
import { billingWebhookEvent } from "@crikket/db/schema/billing"
import { eq, sql } from "drizzle-orm"
import { upsertOrganizationBillingProjection } from "../entitlements/projection"
import { extractProviderEventId } from "../polar-payload"
import type {
  PolarWebhookPayload,
  PolarWebhookProcessingResult,
} from "../types"
import { getErrorMessage } from "../utils"
import { resolveOrganizationIdFromWebhookPayload } from "./organization-resolution"
import {
  extractWebhookBillingProjection,
  hydrateBillingProjectionFromSubscription,
} from "./projection"

export async function processPolarWebhookPayload(
  payload: PolarWebhookPayload
): Promise<PolarWebhookProcessingResult> {
  const eventType =
    (typeof payload.type === "string" && payload.type.length > 0
      ? payload.type
      : "unknown") ?? "unknown"
  const providerEventId = extractProviderEventId(payload, eventType)

  const [existingWebhook] = await db
    .select({
      status: billingWebhookEvent.status,
    })
    .from(billingWebhookEvent)
    .where(eq(billingWebhookEvent.providerEventId, providerEventId))
    .limit(1)

  if (existingWebhook?.status === "processed") {
    return {
      eventType,
      ignored: true,
    }
  }

  if (existingWebhook) {
    await db
      .update(billingWebhookEvent)
      .set({
        status: "received",
        errorMessage: null,
        attemptCount: sql`${billingWebhookEvent.attemptCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(billingWebhookEvent.providerEventId, providerEventId))
  } else {
    await db.insert(billingWebhookEvent).values({
      id: crypto.randomUUID(),
      providerEventId,
      provider: "polar",
      eventType,
      status: "received",
      payload,
      attemptCount: 1,
    })
  }

  try {
    const organizationId =
      await resolveOrganizationIdFromWebhookPayload(payload)
    if (!organizationId) {
      await db
        .update(billingWebhookEvent)
        .set({
          status: "ignored",
          processedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(billingWebhookEvent.providerEventId, providerEventId))

      return {
        eventType,
        ignored: true,
      }
    }

    const extractedProjection = extractWebhookBillingProjection(payload)
    const projection = await hydrateBillingProjectionFromSubscription({
      projection: extractedProjection,
    })

    await upsertOrganizationBillingProjection({
      organizationId,
      plan: projection.plan,
      subscriptionStatus: projection.subscriptionStatus,
      polarCustomerId: projection.polarCustomerId,
      polarSubscriptionId: projection.polarSubscriptionId,
      currentPeriodStart: projection.currentPeriodStart,
      currentPeriodEnd: projection.currentPeriodEnd,
      cancelAtPeriodEnd: projection.cancelAtPeriodEnd,
      source: "webhook",
    })

    await db
      .update(billingWebhookEvent)
      .set({
        status: "processed",
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(billingWebhookEvent.providerEventId, providerEventId))

    return {
      eventType,
      ignored: false,
      organizationId,
    }
  } catch (error) {
    const message = getErrorMessage(error, "Unknown webhook processing error")

    await db
      .update(billingWebhookEvent)
      .set({
        status: "failed",
        errorMessage: message,
        updatedAt: new Date(),
      })
      .where(eq(billingWebhookEvent.providerEventId, providerEventId))

    throw error
  }
}
