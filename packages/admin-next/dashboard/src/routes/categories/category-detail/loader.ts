import { AdminProductCategoriesCategoryRes } from "@medusajs/medusa"
import { Response } from "@medusajs/medusa-js"
import { adminProductKeys } from "medusa-react"
import { LoaderFunctionArgs } from "react-router-dom"

import { medusa, queryClient } from "../../../lib/medusa"

const categoryDetailQuery = (id: string) => ({
  queryKey: adminProductKeys.detail(id),
  queryFn: async () => medusa.admin.productCategories.retrieve(id),
})

export const categoryLoader = async ({ params }: LoaderFunctionArgs) => {
  const id = params.id
  const query = categoryDetailQuery(id!)

  return (
    queryClient.getQueryData<Response<AdminProductCategoriesCategoryRes>>(
      query.queryKey
    ) ?? (await queryClient.fetchQuery(query))
  )
}