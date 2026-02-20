import { db } from "@crikket/db"
import {
  organizationBillingAccount,
  organizationEntitlement,
} from "@crikket/db/schema/billing"
import { eq } from "drizzle-orm"

import {
  type EntitlementSnapshot,
  normalizeBillingPlan,
  normalizeBillingSubscriptionStatus,
  resolveEntitlements,
  serializeEntitlements,
} from "../../model"
import type { BillingProjectionInput } from "../types"
import { asRecord } from "../utils"

export function upsertOrganizationBillingProjection(
  input: BillingProjectionInput
): Promise<EntitlementSnapshot> {
  return db.transaction(async (tx) => {
    const [existingBillingAccount, existingEntitlementRow] = await Promise.all([
      tx.query.organizationBillingAccount.findFirst({
        where: eq(
          organizationBillingAccount.organizationId,
          input.organizationId
        ),
        columns: {
          plan: true,
          subscriptionStatus: true,
        },
      }),
      tx.query.organizationEntitlement.findFirst({
        where: eq(organizationEntitlement.organizationId, input.organizationId),
        columns: {
          entitlements: true,
        },
      }),
    ])

    const nextPlan = normalizeBillingPlan(
      input.plan ?? existingBillingAccount?.plan
    )
    const nextSubscriptionStatus = normalizeBillingSubscriptionStatus(
      input.subscriptionStatus ?? existingBillingAccount?.subscriptionStatus
    )
    const entitlements = resolveEntitlements({
      plan: nextPlan,
      subscriptionStatus: nextSubscriptionStatus,
    })
    const nextEntitlementsPayload = {
      ...(asRecord(existingEntitlementRow?.entitlements) ?? {}),
      ...serializeEntitlements(entitlements),
    }

    await tx
      .insert(organizationBillingAccount)
      .values({
        organizationId: input.organizationId,
        provider: "polar",
        polarCustomerId: input.polarCustomerId,
        polarSubscriptionId: input.polarSubscriptionId,
        plan: nextPlan,
        subscriptionStatus: nextSubscriptionStatus,
        currentPeriodStart: input.currentPeriodStart,
        currentPeriodEnd: input.currentPeriodEnd,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
        lastWebhookAt: new Date(),
      })
      .onConflictDoUpdate({
        target: organizationBillingAccount.organizationId,
        set: {
          polarCustomerId:
            input.polarCustomerId ?? organizationBillingAccount.polarCustomerId,
          polarSubscriptionId:
            input.polarSubscriptionId ??
            organizationBillingAccount.polarSubscriptionId,
          plan: nextPlan,
          subscriptionStatus: nextSubscriptionStatus,
          currentPeriodStart:
            input.currentPeriodStart ??
            organizationBillingAccount.currentPeriodStart,
          currentPeriodEnd:
            input.currentPeriodEnd ??
            organizationBillingAccount.currentPeriodEnd,
          cancelAtPeriodEnd:
            input.cancelAtPeriodEnd ??
            organizationBillingAccount.cancelAtPeriodEnd,
          lastWebhookAt: new Date(),
          updatedAt: new Date(),
        },
      })

    await tx
      .insert(organizationEntitlement)
      .values({
        organizationId: input.organizationId,
        plan: entitlements.plan,
        entitlements: nextEntitlementsPayload,
        lastComputedAt: new Date(),
        source: input.source ?? "reconciliation",
      })
      .onConflictDoUpdate({
        target: organizationEntitlement.organizationId,
        set: {
          plan: entitlements.plan,
          entitlements: nextEntitlementsPayload,
          lastComputedAt: new Date(),
          source: input.source ?? "reconciliation",
          updatedAt: new Date(),
        },
      })

    return entitlements
  })
}
