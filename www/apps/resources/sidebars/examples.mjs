/** @type {import('types').RawSidebarItem[]} */
export const examplesSidebar = [
  {
    type: "link",
    path: "/examples",
    title: "Examples",
    isChildSidebar: true,
    children: [
      {
        type: "ref",
        path: "/examples",
        title: "Example Snippets",
      },
      {
        type: "ref",
        path: "/recipes",
        title: "Recipes",
      },
      {
        type: "ref",
        path: "/plugins",
        title: "Plugins",
      },
      {
        type: "ref",
        path: "/integrations",
        title: "Integrations",
      },
      {
        type: "category",
        title: "Server Examples",
        autogenerate_tags: "example+server",
        autogenerate_as_ref: true,
        children: [
          {
            type: "link",
            title: "Custom Item Price",
            path: "/examples/guides/custom-item-price",
          },
        ],
      },
      {
        type: "category",
        title: "Admin Examples",
        autogenerate_tags: "example+admin",
        autogenerate_as_ref: true,
        children: [],
      },
      {
        type: "category",
        title: "Storefront Examples",
        autogenerate_tags: "example+storefront",
        autogenerate_as_ref: true,
        children: [],
      },
    ],
  },
]
