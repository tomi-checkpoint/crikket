import { polarClient } from "../../lib/payments"
import { collectPaginatedPolarItems } from "../polar-pagination"
import { isPolarResourceNotFoundError } from "../utils"
import {
  type ActiveSubscriptionListFilter,
  EMPTY_BILLING_ACCOUNT_SNAPSHOT,
  isActivePaidSubscriptionStatus,
  isSubscriptionBoundToOrganization,
  type OrganizationBillingAccountSnapshot,
  type PolarSubscription,
} from "./types"

async function findCandidateSubscriptionById(input: {
  billingAccount: OrganizationBillingAccountSnapshot
  organizationId: string
}): Promise<PolarSubscription | null> {
  const { billingAccount, organizationId } = input
  const candidateSubscriptionId = billingAccount.polarSubscriptionId
  if (!candidateSubscriptionId) {
    return null
  }

  try {
    const subscription = await polarClient.subscriptions.get({
      id: candidateSubscriptionId,
    })
    if (!isActivePaidSubscriptionStatus(subscription.status)) {
      return null
    }

    if (isSubscriptionBoundToOrganization(subscription, organizationId)) {
      return subscription
    }

    return null
  } catch (error) {
    if (!isPolarResourceNotFoundError(error)) {
      throw error
    }

    return null
  }
}

async function listActiveSubscriptionsByFilters(
  listFilters: ActiveSubscriptionListFilter[]
): Promise<PolarSubscription[]> {
  const activeSubscriptions: PolarSubscription[] = []
  const seenSubscriptionIds = new Set<string>()

  for (const listFilter of listFilters) {
    const subscriptions = await collectPaginatedPolarItems({
      fetchPage: (page, limit) =>
        polarClient.subscriptions.list({
          ...listFilter,
          active: true,
          limit,
          page,
        }),
    })

    for (const subscription of subscriptions) {
      if (!isActivePaidSubscriptionStatus(subscription.status)) {
        continue
      }

      if (seenSubscriptionIds.has(subscription.id)) {
        continue
      }

      seenSubscriptionIds.add(subscription.id)
      activeSubscriptions.push(subscription)
    }
  }

  return activeSubscriptions
}

async function findOrganizationSubscriptionByMetadata(
  organizationId: string
): Promise<PolarSubscription | null> {
  const subscriptions = await listActiveSubscriptionsByFilters([
    { metadata: { referenceId: organizationId } },
  ])

  return subscriptions[0] ?? null
}

export async function findUpdatableSubscription(input: {
  organizationId: string
  billingAccount?: OrganizationBillingAccountSnapshot | null
}): Promise<PolarSubscription | null> {
  const organizationBillingAccountSnapshot =
    input.billingAccount ?? EMPTY_BILLING_ACCOUNT_SNAPSHOT

  const candidateSubscription = await findCandidateSubscriptionById({
    billingAccount: organizationBillingAccountSnapshot,
    organizationId: input.organizationId,
  })
  if (candidateSubscription) {
    return candidateSubscription
  }

  const metadataMatchedSubscription =
    await findOrganizationSubscriptionByMetadata(input.organizationId)
  if (metadataMatchedSubscription) {
    return metadataMatchedSubscription
  }

  const listFilters: ActiveSubscriptionListFilter[] = []
  if (organizationBillingAccountSnapshot.polarCustomerId) {
    listFilters.push({
      customerId: organizationBillingAccountSnapshot.polarCustomerId,
    })
  }
  listFilters.push({ externalCustomerId: input.organizationId })

  const activeSubscriptions =
    await listActiveSubscriptionsByFilters(listFilters)

  const organizationMatchedSubscription = activeSubscriptions.find(
    (subscription) =>
      isSubscriptionBoundToOrganization(subscription, input.organizationId)
  )

  return organizationMatchedSubscription ?? null
}
