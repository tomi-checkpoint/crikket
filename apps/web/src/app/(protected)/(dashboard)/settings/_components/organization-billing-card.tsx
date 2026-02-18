"use client"

import { Badge } from "@crikket/ui/components/ui/badge"
import { Button } from "@crikket/ui/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@crikket/ui/components/ui/card"
import { useMutation } from "@tanstack/react-query"
import { useRouter } from "nextjs-toploader/app"
import { toast } from "sonner"

import { client } from "@/utils/orpc"

type BillingPlan = "free" | "pro" | "studio"

type BillingPlanLimits = Record<
  BillingPlan,
  {
    monthlyPriceUsd: number
    canUploadVideo: boolean
    maxVideoDurationMs: number | null
    memberCap: number | null
  }
>

interface OrganizationBillingCardProps {
  organizationId: string
  canManageBilling: boolean
  limits: BillingPlanLimits | null
  memberCap: number | null
  memberCount: number
  plan: BillingPlan
  subscriptionStatus: string
}

function formatPlanLabel(plan: BillingPlan): string {
  if (plan === "pro") return "Pro"
  if (plan === "studio") return "Studio"
  return "Free"
}

function formatSubscriptionStatus(status: string): string {
  if (!status || status === "none") return "Not subscribed"
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function planBadgeVariant(
  plan: BillingPlan
): "default" | "secondary" | "outline" {
  if (plan === "studio") return "default"
  if (plan === "pro") return "secondary"
  return "outline"
}

function getErrorMessage(
  error: { message?: string } | null | undefined,
  fallback = "Request failed"
): string {
  return error?.message ?? fallback
}

function extractRedirectUrl(data: unknown): string | null {
  if (!data || typeof data !== "object") {
    return null
  }

  const candidate = (data as { url?: unknown }).url
  return typeof candidate === "string" && candidate.length > 0
    ? candidate
    : null
}

function formatVideoDurationLabel(durationMs: number | null): string {
  if (durationMs === null) {
    return "Unlimited"
  }

  if (typeof durationMs !== "number" || durationMs <= 0) {
    return "Locked"
  }

  const minutes = Math.floor(durationMs / 60_000)
  if (minutes < 60) {
    return `${minutes} minutes per recording`
  }

  const hours = (durationMs / 3_600_000).toFixed(1)
  return `${hours} hours per recording`
}

function setCheckoutPendingGuard(): void {
  try {
    window.sessionStorage.setItem(
      "crikket:billing:checkout-pending",
      JSON.stringify({
        createdAt: Date.now(),
      })
    )
  } catch (_error) {
    // Ignore storage failures (e.g. privacy mode); checkout flow should proceed.
  }
}

export function OrganizationBillingCard({
  organizationId,
  canManageBilling,
  limits,
  memberCap,
  memberCount,
  plan,
  subscriptionStatus,
}: OrganizationBillingCardProps) {
  const router = useRouter()
  const proPrice = limits?.pro.monthlyPriceUsd ?? 25
  const studioPrice = limits?.studio.monthlyPriceUsd ?? 49
  const isBillingEnabled = proPrice > 0 || studioPrice > 0
  const currentPlanLimit = limits?.[plan] ?? null
  const proMemberCap = limits?.pro.memberCap ?? 15
  const exceedsProMemberCap =
    plan === "studio" &&
    typeof proMemberCap === "number" &&
    memberCount > proMemberCap

  const checkoutMutation = useMutation({
    mutationFn: async (slug: "pro" | "studio") => {
      const data = await client.billing.createCheckoutSession({
        organizationId,
        plan: slug,
      })

      const url = extractRedirectUrl(data)
      if (!url) {
        throw new Error("Checkout URL is missing from response.")
      }

      setCheckoutPendingGuard()
      window.location.assign(url)
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to start checkout"))
    },
  })

  const portalMutation = useMutation({
    mutationFn: async () => {
      const data = await client.billing.openPortal({ organizationId })
      const url = extractRedirectUrl(data)
      if (!url) {
        throw new Error("Portal URL is missing from response.")
      }

      window.location.assign(url)
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to open billing portal"))
    },
  })

  const changePlanMutation = useMutation({
    mutationFn: async (nextPlan: "pro" | "studio") => {
      const data = await client.billing.changePlan({
        organizationId,
        plan: nextPlan,
      })

      if (data.action === "checkout_required") {
        setCheckoutPendingGuard()
        window.location.assign(data.url)
        return
      }

      if (data.action === "updated") {
        toast.success(
          `Organization plan updated to ${nextPlan === "pro" ? "Pro" : "Studio"}.`
        )
      } else {
        toast.message("Organization is already on that plan.")
      }

      router.refresh()
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to change plan"))
    },
  })

  const isMutating =
    checkoutMutation.isPending ||
    portalMutation.isPending ||
    changePlanMutation.isPending
  const memberLimitLabel =
    memberCap === null ? "Unlimited" : `${memberCap.toLocaleString()} members`

  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing & Plan</CardTitle>
        <CardDescription>
          {isBillingEnabled
            ? "Organization billing is scoped to this workspace."
            : "Billing is disabled for this deployment. All features are unlocked."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={planBadgeVariant(plan)}>
            {formatPlanLabel(plan)}
          </Badge>
          <span className="text-muted-foreground text-sm">
            {formatSubscriptionStatus(subscriptionStatus)}
          </span>
        </div>

        <div className="space-y-1 text-sm">
          <p>
            Members: {memberCount.toLocaleString()} / {memberLimitLabel}
          </p>
          <p>
            Video limit:{" "}
            {currentPlanLimit?.canUploadVideo
              ? formatVideoDurationLabel(currentPlanLimit.maxVideoDurationMs)
              : "Locked"}
          </p>
        </div>
        {exceedsProMemberCap ? (
          <p className="text-muted-foreground text-sm">
            Downgrading to Pro keeps current members, but new invites are
            blocked while you are above {proMemberCap} members.
          </p>
        ) : null}

        {canManageBilling && isBillingEnabled ? (
          <div className="flex flex-wrap gap-2">
            {plan === "free" ? (
              <>
                <Button
                  disabled={isMutating}
                  onClick={() => checkoutMutation.mutate("pro")}
                  variant="outline"
                >
                  Choose Pro (${proPrice}/mo)
                </Button>
                <Button
                  disabled={isMutating}
                  onClick={() => checkoutMutation.mutate("studio")}
                >
                  Choose Studio (${studioPrice}/mo)
                </Button>
              </>
            ) : (
              <>
                {plan === "pro" ? (
                  <Button
                    disabled={isMutating}
                    onClick={() => changePlanMutation.mutate("studio")}
                    variant="outline"
                  >
                    Upgrade to Studio
                  </Button>
                ) : (
                  <Button
                    disabled={isMutating}
                    onClick={() => changePlanMutation.mutate("pro")}
                    variant="outline"
                  >
                    Switch to Pro
                  </Button>
                )}
                <Button
                  disabled={isMutating}
                  onClick={() => portalMutation.mutate()}
                  variant="outline"
                >
                  Open Billing Portal
                </Button>
              </>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            {isBillingEnabled
              ? "Only organization owners can manage billing."
              : "Payments are disabled in this deployment."}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
