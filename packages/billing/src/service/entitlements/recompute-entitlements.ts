import { db } from "@crikket/db"
import { organizationBillingAccount } from "@crikket/db/schema/billing"
import { eq } from "drizzle-orm"

import {
  normalizeBillingPlan,
  normalizeBillingSubscriptionStatus,
} from "../../model"
import { upsertOrganizationBillingProjection } from "./projection"

export async function recomputeOrganizationEntitlements(
  organizationId: string
) {
  const billingRow = await db.query.organizationBillingAccount.findFirst({
    where: eq(organizationBillingAccount.organizationId, organizationId),
    columns: {
      plan: true,
      subscriptionStatus: true,
      polarCustomerId: true,
      polarSubscriptionId: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
    },
  })

  const plan = normalizeBillingPlan(billingRow?.plan)
  const subscriptionStatus = normalizeBillingSubscriptionStatus(
    billingRow?.subscriptionStatus
  )
  const entitlements = await upsertOrganizationBillingProjection({
    organizationId,
    plan,
    subscriptionStatus,
    polarCustomerId: billingRow?.polarCustomerId ?? undefined,
    polarSubscriptionId: billingRow?.polarSubscriptionId ?? undefined,
    currentPeriodStart: billingRow?.currentPeriodStart ?? undefined,
    currentPeriodEnd: billingRow?.currentPeriodEnd ?? undefined,
    cancelAtPeriodEnd: billingRow?.cancelAtPeriodEnd ?? false,
    source: "manual-recompute",
  })

  return {
    organizationId,
    plan,
    subscriptionStatus,
    entitlements,
  }
}
