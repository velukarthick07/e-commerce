import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import PointOfSaleOutlinedIcon from "@mui/icons-material/PointOfSaleOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import WarehouseOutlinedIcon from "@mui/icons-material/WarehouseOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import ManageAccountsOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import type { SvgIconComponent } from "@mui/icons-material";

export interface NavItem {
  label: string;
  href: string;
  icon: SvgIconComponent;
  /** `<resource>:read` required to see this entry; null means everyone. */
  permission: string | null;
  children?: { label: string; href: string }[];
  highlight?: boolean;
}

/**
 * Navigation order follows the spec's module priority — Local Orders sits
 * directly under Dashboard because counter staff use it constantly.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: DashboardOutlinedIcon, permission: "dashboard:read" },
  { label: "Local Orders", href: "/local-orders", icon: PointOfSaleOutlinedIcon, permission: "local-orders:read", highlight: true },
  { label: "Online Orders", href: "/online-orders", icon: ShoppingBagOutlinedIcon, permission: "orders:read" },
  { label: "Orders", href: "/orders", icon: ReceiptLongOutlinedIcon, permission: "orders:read" },
  { label: "Products", href: "/products", icon: Inventory2OutlinedIcon, permission: "products:read" },
  { label: "Categories", href: "/categories", icon: CategoryOutlinedIcon, permission: "categories:read" },
  { label: "Customers", href: "/customers", icon: PeopleAltOutlinedIcon, permission: "customers:read" },
  {
    label: "Inventory",
    href: "/inventory",
    icon: WarehouseOutlinedIcon,
    permission: "inventory:read",
    children: [
      { label: "Stock Levels", href: "/inventory" },
      { label: "Batches", href: "/inventory/batches" },
      { label: "Expiry", href: "/inventory/expiry" },
      { label: "Transactions", href: "/inventory/transactions" },
    ],
  },
  { label: "Payments", href: "/payments", icon: PaymentsOutlinedIcon, permission: "payments:read" },
  { label: "Coupons", href: "/coupons", icon: LocalOfferOutlinedIcon, permission: "coupons:read" },
  { label: "Reports", href: "/reports", icon: InsightsOutlinedIcon, permission: "reports:read" },
  { label: "Users", href: "/users", icon: ManageAccountsOutlinedIcon, permission: "users:read" },
  { label: "Settings", href: "/settings", icon: SettingsOutlinedIcon, permission: "settings:read" },
  // Everyone gets the manual — it is the one screen whose whole purpose is to
  // explain the screens a reader cannot open.
  { label: "User manual", href: "/help", icon: MenuBookOutlinedIcon, permission: null },
];

export const SIDEBAR_WIDTH = 256;
