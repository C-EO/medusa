import { FormattingOptionsType } from "types"
import baseSectionsOptions from "../base-section-options.js"

const fulfillmentProviderOptions: FormattingOptionsType = {
  "^fulfillment_provider/.*AbstractFulfillmentProviderService": {
    reflectionGroups: {
      Constructors: false,
    },
    reflectionDescription: `In this document, you’ll learn how to create a fulfillment provider module and the methods you must implement in its main service.`,
    frontmatterData: {
      slug: "/references/fulfillment/provider",
    },
    reflectionTitle: {
      fullReplacement: "How to Create a Fulfillment Provider Module",
    },
    shouldIncrementAfterStartSections: true,
    expandMembers: true,
    expandProperties: true,
    sections: {
      ...baseSectionsOptions,
      member_declaration_title: false,
      reflection_typeParameters: false,
    },
    startSections: [
      `## Understanding Fulfillment Provider Implementation

The Fulfillment Module Provider handles processing fulfillments and shipments with a third-party provirder. However, it's not responsible for managing fulfillment concepts within Medusa, such as creating a fulfillment or its shipments. The Fulfillment Module uses your fulfillment provider within core operations.

For example, when the merchant creates a fulfillment for an order, the Fulfillment Module uses your fulfillment provider to create the fulfillment in the third-party system, then creates the fulfillment in Medusa. So, you only have to implement the third-party fulfillment processing logic in your fulfillment provider.
`,
      `## 1. Create Module Provider Directory

Start by creating a new directory for your module provider.

If you're creating the module provider in a Medusa application, create it under the \`src/modules\` directory. For example, \`src/modules/my-fulfillment\`.
If you're creating the module provider in a plugin, create it under the \`src/providers\` directory. For example, \`src/providers/my-fulfillment\`.

<Note>

The rest of this guide always uses the \`src/modules/my-fulfillment\` directory as an example.

</Note>`,
      `## 2. Create the Fulfillment Provider Service

Create the file \`src/modules/my-fulfillment/service.ts\` that holds the module's main service. It must extend the \`AbstractFulfillmentProviderService\` class imported from \`@medusajs/framework/utils\`:

\`\`\`ts title="src/modules/my-fulfillment/service.ts"
import { AbstractFulfillmentProviderService } from "@medusajs/framework/utils"

class MyFulfillmentProviderService extends AbstractFulfillmentProviderService {
  // TODO implement methods
}

export default MyFulfillmentProviderService
\`\`\``,
    ],
    endSections: [
      `## 3. Create Module Definition File

Create the file \`src/modules/my-fulfillment/index.ts\` with the following content:

\`\`\`ts title="src/modules/my-fulfillment/index.ts"
import MyFulfillmentProviderService from "./service"
import { 
  ModuleProvider, 
  Modules
} from "@medusajs/framework/utils"

export default ModuleProvider(Modules.FULFILLMENT, {
  services: [MyFulfillmentProviderService],
})
\`\`\`

This exports the module's definition, indicating that the \`MyFulfillmentProviderService\` is the module's service.`,
      `## 4. Use Module

To use your Fulfillment Module Provider, add it to the \`providers\` array of the Fulfillment Module in \`medusa-config.ts\`:

\`\`\`ts title="medusa-config.ts"
module.exports = defineConfig({
  // ...
  modules: [
    {
      resolve: "@medusajs/medusa/fulfillment",
      options: {
        providers: [
          // default provider
          {
            resolve: "@medusajs/medusa/fulfillment-manual",
            id: "manual",
          },
          {
            // if module provider is in a plugin, use \`plugin-name/providers/my-fulfillment\`
            resolve: "./src/modules/my-fulfillment",
            id: "my-fulfillment",
            options: {
              // provider options...
            },
          },
        ],
      },
    },
  ]
})
\`\`\`
`,
      `## 5. Test it Out

Before you use your fulfillment provider, in the Medusa Admin:

1. Add the fulfillment provider to a location.
2. Add in the location a delivery shipping option that uses the provider.

Then, place an order, choosing the shipping option you created during checkout, and create a fulfillment in the Medusa Admin. The fulfillment is created using your provider.
`,
    ],
  },
}

export default fulfillmentProviderOptions
