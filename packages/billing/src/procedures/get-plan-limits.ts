import { getBillingPlanLimits } from "../service/entitlements/organization-entitlements"
import { protectedProcedure } from "./context"

export const getPlanLimits = protectedProcedure.handler(() => {
  return getBillingPlanLimits()
})
