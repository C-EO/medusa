import { Modules } from "@medusajs/utils"

export const defaultSchema = `
  type Product @Listeners(values: ["${Modules.PRODUCT}.product.created", "${Modules.PRODUCT}.product.updated", "${Modules.PRODUCT}.product.deleted"]) {
    id: String
    title: String
    handle: String
    status: String
    type_id: String
    collection_id: String
    is_giftcard: String
    external_id: String
    created_at: DateTime
    updated_at: DateTime

    variants: [ProductVariant]
    sales_channels: [SalesChannel]
  }

  type ProductVariant @Listeners(values: ["${Modules.PRODUCT}.product-variant.created", "${Modules.PRODUCT}.product-variant.updated", "${Modules.PRODUCT}.product-variant.deleted"]) {
    id: String
    product_id: String
    sku: String

    prices: [Price]
  }
  
  type Price @Listeners(values: ["${Modules.PRICING}.price.created", "${Modules.PRICING}.price.updated", "${Modules.PRICING}.price.deleted"]) {
    id: String
    amount: Float
    currency_code: String
  }

  type SalesChannel @Listeners(values: ["${Modules.SALES_CHANNEL}.sales_channel.created", "${Modules.SALES_CHANNEL}.sales_channel.updated", "${Modules.SALES_CHANNEL}.sales_channel.deleted"]) {
    id: String
    is_disabled: Boolean
  }
`
