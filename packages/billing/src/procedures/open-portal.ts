import { createOrganizationPortalSession } from "../service/checkout/portal-session"
import { protectedProcedure } from "./context"
import {
  optionalOrganizationIdInputSchema,
  resolveOrganizationId,
} from "./organization-id"

export const openPortal = protectedProcedure
  .input(optionalOrganizationIdInputSchema)
  .handler(({ context, input }) => {
    const organizationId = resolveOrganizationId({
      organizationId: input.organizationId,
      activeOrganizationId: context.session.session.activeOrganizationId,
    })

    return createOrganizationPortalSession({
      organizationId,
      userId: context.session.user.id,
    })
  })
