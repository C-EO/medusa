import { useAdminOrder } from "medusa-react"
import { useParams } from "react-router-dom"

import { RouteFocusModal } from "../../../components/route-modal"
import { OrderCreateClaimForm } from "./components/order-create-claim-form/order-create-claim-form"

export function OrderCreateClaim() {
  const { id } = useParams()

  const { order, isLoading, isError, error } = useAdminOrder(id!, {
    expand:
      "items,items.variant,items.variant.product,returnable_items,shipping_address,region,region.countries",
  })

  if (isError) {
    throw error
  }

  if (isLoading || !order) {
    return null
  }

  return (
    <RouteFocusModal>
      <OrderCreateClaimForm order={order} />
    </RouteFocusModal>
  )
}