import { sidebarAttachHrefCommonOptions } from "build-scripts"

// TODO check the order of items based on the Medusa Admin's sidebar

/** @type {import('types').RawSidebarItemType[]} */
export const sidebar = sidebarAttachHrefCommonOptions([
  {
    type: "link",
    path: "/",
    title: "Introduction",
  },
  {
    type: "separator",
  },
  {
    type: "category",
    title: "Tips",
    autogenerate_path: "/tips",
  },
  {
    type: "category",
    title: "Orders",
    children: [
      {
        type: "link",
        title: "Overview",
        path: "/orders",
      },
      {
        type: "link",
        title: "Manage Details",
        path: "/orders/manage",
      },
      {
        type: "link",
        title: "Manage Payments",
        path: "/orders/payments",
      },
      {
        type: "link",
        title: "Manage Fulfillments",
        path: "/orders/fulfillments",
      },
      {
        type: "link",
        title: "Edit Order Items",
        path: "/orders/edit",
      },
      {
        type: "link",
        title: "Manage Returns",
        path: "/orders/returns",
      },
      {
        type: "link",
        title: "Manage Exchanges",
        path: "/orders/exchanges",
      },
      {
        type: "link",
        title: "Manage Claims",
        path: "/orders/claims",
      },
    ],
  },
  {
    type: "category",
    title: "Products",
    children: [
      {
        type: "link",
        title: "Overview",
        path: "/products",
      },
      {
        type: "link",
        title: "Create Product",
        path: "/products/create",
        children: [
          {
            type: "link",
            title: "Multi-Part Product",
            path: "/products/create/multi-part",
          },
          {
            type: "link",
            title: "Bundle Product",
            path: "/products/create/bundle",
          },
        ],
      },
      {
        type: "link",
        title: "Edit Product",
        path: "/products/edit",
      },
      {
        type: "link",
        title: "Manage Variants",
        path: "/proucts/variants",
      },
      {
        type: "link",
        title: "Manage Collections",
        path: "/products/collections",
      },
      {
        type: "link",
        title: "Categories",
        path: "/products/categories",
      },
      {
        type: "link",
        title: "Import Products",
        path: "/products/import",
      },
      {
        type: "link",
        title: "Export Products",
        path: "/products/export",
      },
    ],
  },
  {
    type: "category",
    title: "Inventory",
    children: [
      {
        type: "link",
        title: "Overview",
        path: "/inventory",
      },
      {
        type: "link",
        title: "Manage Inventory",
        path: "/inventory/inventory",
      },
      {
        type: "link",
        title: "Manage Reservations",
        path: "/inventory/reservations",
      },
    ],
  },
  {
    type: "category",
    title: "Customers",
    children: [
      {
        type: "link",
        title: "Overview",
        path: "/customers",
      },
      {
        type: "link",
        title: "Manage Customers",
        path: "/customers/manage",
      },
      {
        type: "link",
        title: "Manage Groups",
        path: "/customers/groups",
      },
    ],
  },
  {
    type: "category",
    title: "Promotions",
    children: [
      {
        type: "link",
        title: "Overview",
        path: "/promotions",
      },
      {
        type: "link",
        title: "Create Promotion",
        path: "/promotions/create",
      },
      {
        type: "link",
        title: "Manage Promotion",
        path: "/promotions/manage",
      },
      {
        type: "link",
        title: "Manage Campaigns",
        path: "/promotions/campaigns",
      },
    ],
  },
  {
    type: "category",
    title: "Price Lists",
    children: [
      {
        type: "link",
        title: "Overview",
        path: "/price-lists",
      },
      {
        type: "link",
        title: "Create Price List",
        path: "/price-lists/create",
      },
      {
        type: "link",
        title: "Manage Price List",
        path: "/price-lists/manage",
      },
    ],
  },
  {
    type: "category",
    title: "Settings",
    children: [
      {
        type: "link",
        title: "Overview",
        path: "/settings",
      },
      {
        type: "link",
        title: "Store",
        path: "/settings/store",
      },
      {
        type: "link",
        title: "Users",
        path: "/settings/users",
        children: [
          {
            type: "link",
            title: "Invites",
            path: "/settings/users/invites",
          },
        ],
      },
      {
        type: "link",
        title: "Regions",
        path: "/settings/regions",
      },
      {
        type: "link",
        title: "Tax Regions",
        path: "#",
      },
      {
        type: "link",
        title: "Return Reasons",
        path: "/settings/return-reasons",
      },
      {
        type: "link",
        title: "Sales Channels",
        path: "/settings/sales-channels",
      },
      {
        type: "link",
        title: "Product Types",
        path: "#",
      },
      {
        type: "link",
        title: "Product Tags",
        path: "#",
      },
      {
        type: "link",
        title: "Location & Shipping",
        path: "/settings/locations",
      },
      {
        type: "category",
        title: "Developer Settings",
        children: [
          {
            type: "link",
            title: "Publishable API Keys",
            path: "#",
          },
          {
            type: "link",
            title: "Secret API Keys",
            path: "#",
          },
          {
            type: "link",
            title: "Workflows",
            path: "/settings/executions",
          },
        ],
      },
      {
        type: "link",
        title: "Profile",
        path: "/settings/profile",
      },
    ],
  },
])
