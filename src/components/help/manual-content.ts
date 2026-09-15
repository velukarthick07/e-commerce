/**
 * The user manual, as data.
 *
 * Keeping the content out of the component lets one page search it, build its
 * own contents list, and grey out the parts the reader's role cannot use —
 * without any of that logic being repeated per section.
 *
 * Written for the people running the shop, not for developers: every section
 * answers "how do I do this", in the words the screen uses.
 */

export type ManualBlock =
  | { kind: "text"; text: string }
  | { kind: "steps"; items: string[] }
  | { kind: "list"; items: string[] }
  | { kind: "table"; head: string[]; rows: string[][] }
  | { kind: "note"; tone: "info" | "warning" | "success"; title?: string; text: string };

export interface ManualSection {
  id: string;
  title: string;
  /** One line, shown under the heading and in the contents list. */
  summary: string;
  /** `<resource>:read` needed to open the screen this section describes. */
  permission?: string;
  blocks: ManualBlock[];
}

export interface ManualChapter {
  title: string;
  sections: ManualSection[];
}

export const MANUAL: ManualChapter[] = [
  {
    title: "Getting started",
    sections: [
      {
        id: "signing-in",
        title: "Signing in",
        summary: "Getting into the admin panel, and what to do if you cannot.",
        blocks: [
          {
            kind: "steps",
            items: [
              "Open the store's web address and add */login* to the end.",
              "Enter the email address and password your manager gave you.",
              "Select *Sign in*. You land on the Dashboard, or on whichever page you were trying to reach.",
            ],
          },
          {
            kind: "text",
            text: "If you forget your password, select *Forgot password* on the sign-in screen and enter your email. A reset link is sent to you; it stops working after a short time, so use it straight away.",
          },
          {
            kind: "note",
            tone: "info",
            title: "Staying signed in",
            text: "Your session lasts a week by default, on the device and browser you used. Signing in from a phone does not sign you out on the counter computer.",
          },
          {
            kind: "note",
            tone: "warning",
            title: "Shared computers",
            text: "On a shared counter machine, use *Sign out* from the account menu at the end of your shift. Anyone who opens the browser afterwards would otherwise be working as you, and every order records who created it.",
          },
        ],
      },
      {
        id: "finding-your-way",
        title: "Finding your way around",
        summary: "The menu, the search box and the alert bell.",
        blocks: [
          {
            kind: "text",
            text: "Every screen has the same frame. Down the left is the menu; across the top are search, alerts and your account.",
          },
          {
            kind: "list",
            items: [
              "*The left menu* lists only the sections your role may open, so your menu may be shorter than a colleague's. On a phone, tap the ☰ button at the top left to open it.",
              "*Search* at the top finds products, orders and customers from anywhere. Type at least a couple of characters and press Enter.",
              "*The bell* counts stock that has run low or run out, plus batches that have expired or expire within seven days. If it shows a number, open Inventory.",
              "*Your name*, top right, opens your account menu: your profile, your password, and sign out.",
            ],
          },
          {
            kind: "note",
            tone: "info",
            text: "Lists throughout the application work the same way: a search box, filters above the table, and paging underneath. Filters combine — a search term and a status filter narrow the list together.",
          },
        ],
      },
      {
        id: "roles",
        title: "Who can do what",
        summary: "The four roles and the limits of each.",
        blocks: [
          {
            kind: "text",
            text: "Every account has one role. The role decides which menu entries appear and which buttons work. If a screen will not let you do something, this table is usually why.",
          },
          {
            kind: "table",
            head: ["", "Staff", "Manager", "Admin", "Super Admin"],
            rows: [
              ["Take orders at the counter", "Create", "Full", "Full", "Full"],
              ["Change an order's status", "View only", "Yes", "Yes", "Yes"],
              ["Record a payment", "Yes", "Yes", "Yes", "Yes"],
              ["Add and edit customers", "Yes", "Yes", "Full", "Full"],
              ["Products, categories, coupons", "View only", "Add and edit", "Full", "Full"],
              ["Stock, batches, write-offs", "View only", "Add and edit", "Full", "Full"],
              ["Reports", "—", "View", "View", "View"],
              ["Staff accounts", "—", "View only", "Add and edit", "Full"],
              ["Store settings", "—", "View only", "Edit", "Full"],
            ],
          },
          {
            kind: "text",
            text: "*Full* includes deleting. Managers and Staff cannot delete anything, which is deliberate — records stay in place so reports and stock history remain accurate.",
          },
          {
            kind: "note",
            tone: "info",
            text: "Roles are changed under Staff accounts by an Admin or Super Admin. A change takes effect the moment it is saved, without the person signing out and in again.",
          },
        ],
      },
    ],
  },

  {
    title: "Serving customers",
    sections: [
      {
        id: "local-orders",
        title: "Taking an order at the counter",
        summary: "Walk-ins, phone and WhatsApp orders, pickups and local deliveries.",
        permission: "local-orders:read",
        blocks: [
          {
            kind: "text",
            text: "*Local Orders* is the counter screen. It is for anything you enter yourself, as opposed to orders customers place on the website.",
          },
          {
            kind: "steps",
            items: [
              "Select *Local Orders*, then *New order*.",
              "Choose the *Order type*: Walk-in, Phone order, WhatsApp order, Local delivery or Store pickup.",
              "Find the customer by name or mobile number. If they are new, select *Add customer* and enter at least a name and mobile.",
              "Add products. Search by name, SKU or barcode, set the quantity for each, and they appear in the summary on the right with live totals.",
              "Apply a discount if one is due — either a *Coupon code* or a *Manual discount*.",
              "For a delivery, fill in the address. The delivery charge is worked out from your store settings.",
              "Choose how they are paying and whether it is *Paid* or still *Pending*.",
              "Add *Order notes* if anything needs recording, then place the order.",
            ],
          },
          {
            kind: "note",
            tone: "success",
            title: "Stock moves by itself",
            text: "Placing the order takes the goods out of stock immediately, using the batch that expires soonest first. You never adjust stock by hand for a sale.",
          },
          {
            kind: "note",
            tone: "warning",
            title: "If a product will not add",
            text: "The screen refuses a product when there is not enough stock, or when the only stock left is from an expired batch and your settings forbid selling those. Check the product under Inventory.",
          },
          {
            kind: "text",
            text: "A manual discount is capped by the *Maximum manual discount* in Settings, so nobody can discount an order beyond what the owner allows. Counter orders are confirmed automatically unless that has been switched off in Settings.",
          },
        ],
      },
      {
        id: "online-orders",
        title: "Orders from the website",
        summary: "Finding, checking and fulfilling what customers order themselves.",
        permission: "orders:read",
        blocks: [
          {
            kind: "text",
            text: "*Online Orders* shows only orders placed by customers on the storefront. *Orders* shows everything, counter and website together — use it when you are not sure where an order came from.",
          },
          {
            kind: "steps",
            items: [
              "Open *Online Orders*. New ones sit at the top.",
              "Select an order to see the items, the customer, the delivery address and the payment.",
              "Pick the goods, then move the order along using the status buttons.",
              "Record the payment when the money arrives — for cash on delivery that is after the customer has paid the driver.",
            ],
          },
          {
            kind: "text",
            text: "Order numbers tell you the source at a glance: *ORD-* is a website order and *LOC-* is one entered at the counter, each followed by the date and a number for that day — for example *ORD-20260915-0014*.",
          },
        ],
      },
      {
        id: "order-status",
        title: "Moving an order through to delivery",
        summary: "What each status means, and which changes are allowed.",
        permission: "orders:read",
        blocks: [
          {
            kind: "text",
            text: "An order moves forwards through a fixed set of steps. The screen offers only the changes that are allowed from where the order is now, so you cannot skip ahead by accident.",
          },
          {
            kind: "table",
            head: ["Status", "Means", "Can move to"],
            rows: [
              ["Pending", "Placed, not yet accepted", "Confirmed, Cancelled"],
              ["Confirmed", "Accepted, not yet picked", "Processing, Cancelled"],
              ["Processing", "Being picked and packed", "Packed, Cancelled"],
              ["Packed", "Ready to go", "Shipped, Out for delivery, Cancelled"],
              ["Shipped", "Handed to a courier", "Out for delivery, Delivered, Returned"],
              ["Out for delivery", "With your driver", "Delivered, Returned, Cancelled"],
              ["Delivered", "Customer has it", "Returned"],
              ["Cancelled", "Called off", "— final"],
              ["Returned", "Came back to you", "— final"],
            ],
          },
          {
            kind: "note",
            tone: "success",
            title: "Cancelling puts stock back",
            text: "Cancelling or returning an order returns the goods to stock and frees the coupon for reuse. Do not adjust stock by hand afterwards, or it will be counted twice.",
          },
          {
            kind: "note",
            tone: "info",
            text: "Every change is recorded with the time and who made it, and the customer sees the new status on the website straight away.",
          },
        ],
      },
      {
        id: "payments",
        title: "Recording payments",
        summary: "Taking money against an order, and handling refunds.",
        permission: "payments:read",
        blocks: [
          {
            kind: "text",
            text: "A payment always belongs to an order. Record it from the order itself, and it appears under *Payments* with everything else.",
          },
          {
            kind: "list",
            items: [
              "*Cash* — over the counter, or to your driver on delivery.",
              "*Card* — a card machine in the shop.",
              "*UPI* — a scan-and-pay transfer. Put the reference in the transaction field.",
              "*Cash on delivery* — the customer pays when the goods arrive.",
              "*Online payment* — paid on the website, where that is switched on.",
            ],
          },
          {
            kind: "text",
            text: "A payment is *Pending* until the money is actually in hand, then *Paid*. *Failed* is for an attempt that did not go through, and *Refunded* for money given back. An order can hold more than one payment, so part-payments are simply two records.",
          },
          {
            kind: "note",
            tone: "info",
            text: "The *Payments* screen is the one to use for a day's takings: filter by date and method, and the total is shown for the rows you have filtered to.",
          },
        ],
      },
      {
        id: "customers",
        title: "Customers",
        summary: "Customer records, their addresses and their order history.",
        permission: "customers:read",
        blocks: [
          {
            kind: "text",
            text: "A customer is identified by their mobile number, which is what ties a counter order to a website order for the same person.",
          },
          {
            kind: "steps",
            items: [
              "Open *Customers* and search by name, mobile or email.",
              "Select a customer to see their details, their saved addresses and every order they have placed.",
              "Use *Add customer* for someone new, or *Edit* to correct details.",
            ],
          },
          {
            kind: "text",
            text: "One customer can have several addresses — home and shop, say — with one marked as the default that is offered first at checkout. Customers manage these themselves on the website; you can also add one while taking a delivery order.",
          },
          {
            kind: "note",
            tone: "warning",
            text: "Take care when correcting a mobile number. It is how the customer signs in to the website and tracks their orders, so changing it means their old number no longer finds their history.",
          },
        ],
      },
    ],
  },

  {
    title: "The catalogue",
    sections: [
      {
        id: "products",
        title: "Products",
        summary: "Adding items, their prices, sizes and descriptions.",
        permission: "products:read",
        blocks: [
          {
            kind: "steps",
            items: [
              "Open *Products* and select *New product*.",
              "Fill in the name, category, brand and product type.",
              "Set the *MRP* and the *Selling price*. MRP is the printed price; the selling price is what you actually charge.",
              "Add the *GST / tax rate* and *HSN code* if you invoice with them.",
              "Add sizes under variants — a 500 ml and a 1 litre bottle are two variants of one product, each with its own price, SKU and barcode.",
              "Save, then add stock for each variant under Inventory.",
            ],
          },
          {
            kind: "text",
            text: "Food items have extra fields worth filling in, because customers read them on the website: ingredients, allergens, dietary information, storage and shelf life. Oils additionally record the extraction method — cold pressed, wood pressed, filtered or refined.",
          },
          {
            kind: "list",
            items: [
              "*Active* controls whether the item can be sold at all. Switch it off to retire a line without deleting its history.",
              "*Featured* puts the product on the front page of the website.",
              "*Min* and *Max* stock, set per variant, drive the low-stock alerts.",
            ],
          },
          {
            kind: "note",
            tone: "info",
            text: "A product that has ever been ordered cannot be deleted, because its orders would stop making sense. Switch off *Active* instead — it disappears from the shop and the counter, and the history stays intact.",
          },
        ],
      },
      {
        id: "product-images",
        title: "Product photos",
        summary: "Uploading pictures that customers see in the shop.",
        permission: "products:read",
        blocks: [
          {
            kind: "steps",
            items: [
              "Open the product and select *Edit*.",
              "Select the image area and pick one or more photos, up to 5 MB each.",
              "The first photo is the main one shown in listings. Remove any you do not want.",
              "Save the product.",
            ],
          },
          {
            kind: "text",
            text: "Photos are shrunk and converted automatically when you upload them, typically to a tenth of their original size with no visible loss of quality. You can upload straight from a phone camera without worrying about file size, and pictures taken sideways are turned the right way up for you.",
          },
          {
            kind: "note",
            tone: "info",
            text: "Plain, well-lit photographs of the product against a simple background work best. The picture is shown as a square in listings, so keep the product centred.",
          },
        ],
      },
      {
        id: "categories",
        title: "Categories",
        summary: "How products are grouped for customers.",
        permission: "categories:read",
        blocks: [
          {
            kind: "text",
            text: "Categories are how shoppers browse. They go two levels deep — a main category such as Oils, with subcategories such as Coconut and Groundnut beneath it.",
          },
          {
            kind: "steps",
            items: [
              "Open *Categories*.",
              "Select *New category* for a main one, or *Add subcategory* on an existing row.",
              "Give it a name and, if you like, a description and a sort order. Lower sort numbers come first.",
            ],
          },
          {
            kind: "note",
            tone: "warning",
            text: "A category that still has products or subcategories in it cannot be deleted. Move or retire those first, or simply mark the category inactive to hide it from the shop.",
          },
        ],
      },
      {
        id: "coupons",
        title: "Coupons",
        summary: "Discount codes, and the limits you can put on them.",
        permission: "coupons:read",
        blocks: [
          {
            kind: "steps",
            items: [
              "Open *Coupons* and select *Create coupon*.",
              "Enter the *Coupon code* customers will type — short and memorable, for example WELCOME10.",
              "Choose the *Discount type*: a percentage of the order, or a fixed amount off.",
              "Set the value, and for a percentage optionally a *Maximum discount* so a large order cannot take too much off.",
              "Set a *Minimum order value* if it should only apply above a certain spend.",
              "Set a *Usage limit* and the dates it runs between, then save.",
            ],
          },
          {
            kind: "text",
            text: "A coupon can be used at the counter and on the website. The same rules apply in both places, so a code that is out of date or over its limit is refused wherever it is typed.",
          },
          {
            kind: "table",
            head: ["Shown as", "Means"],
            rows: [
              ["Active", "Working now"],
              ["Inactive", "Switched off by hand"],
              ["Expired", "Past its end date"],
              ["Exhausted", "Used as many times as allowed"],
            ],
          },
          {
            kind: "note",
            tone: "info",
            text: "Cancelling an order that used a coupon gives the use back, so a one-per-customer code is not wasted by a cancelled order.",
          },
        ],
      },
    ],
  },

  {
    title: "Stock",
    sections: [
      {
        id: "stock-levels",
        title: "Stock levels",
        summary: "What is on the shelf, what is running out, and correcting counts.",
        permission: "inventory:read",
        blocks: [
          {
            kind: "text",
            text: "*Inventory › Stock Levels* lists every variant with what is available. Filter by *Low stock* or *Out of stock* to get your ordering list for the week.",
          },
          {
            kind: "list",
            items: [
              "*Available* is what you can actually sell.",
              "*Reserved* is set aside for orders that are placed but not yet delivered.",
              "*Low stock* means the figure has fallen to the *Min* set on that variant.",
            ],
          },
          {
            kind: "text",
            text: "To correct a count, use *Manual adjustment* and say why. The reasons available are stock added, stock removed, a customer return, a plain correction, and an expired-stock write-off. Every one of them is recorded against your name.",
          },
          {
            kind: "note",
            tone: "warning",
            text: "Never adjust stock to account for a sale, a cancellation or a return that went through an order — those move stock on their own, and adjusting as well counts the goods twice.",
          },
        ],
      },
      {
        id: "batches",
        title: "Batches",
        summary: "Recording deliveries with their expiry dates.",
        permission: "inventory:read",
        blocks: [
          {
            kind: "text",
            text: "Stock is held in batches, so the shop knows not just how many bottles there are but when each lot expires. Add a batch whenever a delivery arrives.",
          },
          {
            kind: "steps",
            items: [
              "Open *Inventory › Batches* and select to add one.",
              "Pick the product variant and enter the supplier's *Batch number*.",
              "Enter the *Quantity* received.",
              "Enter the *Manufacturing* and *Expiry* dates from the packaging.",
              "Optionally record what you paid, the MRP and the selling price for this lot, then save.",
            ],
          },
          {
            kind: "note",
            tone: "success",
            title: "Oldest stock sells first",
            text: "When something is sold, it comes out of the batch that expires soonest, automatically. That is what keeps old stock from being left at the back of the shelf.",
          },
        ],
      },
      {
        id: "expiry",
        title: "Expiry",
        summary: "Seeing what is about to go out of date, and writing it off.",
        permission: "inventory:read",
        blocks: [
          {
            kind: "text",
            text: "*Inventory › Expiry* groups batches by how long they have left: already expired, within seven days, and within thirty days. Check it weekly.",
          },
          {
            kind: "steps",
            items: [
              "Open *Inventory › Expiry*.",
              "Work through *Expired* first — that stock should not be sold.",
              "Use the write-off action to take it out of stock, which records it as an expired-stock loss rather than a mystery shortage.",
              "Then look at the seven- and thirty-day groups and plan a promotion, or move the stock to the front.",
            ],
          },
          {
            kind: "note",
            tone: "info",
            text: "If *Never sell expired batches* is on in Settings, expired stock is refused at the counter and on the website automatically. Writing it off still matters, so your stock figures and your losses are honest.",
          },
        ],
      },
      {
        id: "transactions",
        title: "Stock history",
        summary: "Every movement, and who caused it.",
        permission: "inventory:read",
        blocks: [
          {
            kind: "text",
            text: "*Inventory › Transactions* is the full record of every stock movement: sales, returns, deliveries, corrections and write-offs, each with the date, the quantity, the reason and the person responsible.",
          },
          {
            kind: "text",
            text: "This is where to look when a count does not match the shelf. Filter to the product and read down the movements until the figures part company with reality.",
          },
        ],
      },
    ],
  },

  {
    title: "Running the store",
    sections: [
      {
        id: "dashboard",
        title: "Dashboard",
        summary: "The daily overview.",
        permission: "dashboard:read",
        blocks: [
          {
            kind: "text",
            text: "The Dashboard is the first screen after signing in. It shows sales and order counts for the period, a split of website against counter orders, how orders are spread across the statuses, and what needs attention in stock and expiry.",
          },
          {
            kind: "text",
            text: "Use it as a morning check: anything sitting in *Pending* needs accepting, and any expiry warning needs walking to the shelf.",
          },
        ],
      },
      {
        id: "reports",
        title: "Reports and exports",
        summary: "Sales, products, customers and stock, with CSV download.",
        permission: "reports:read",
        blocks: [
          {
            kind: "text",
            text: "*Reports* answers the questions the Dashboard only hints at. Pick a report, then a period — today, yesterday, the last 7 or 30 days, this month, or dates you choose.",
          },
          {
            kind: "table",
            head: ["Report", "Tells you"],
            rows: [
              ["Sales", "Takings by day, week or month, with discounts and tax"],
              ["Orders", "How many orders, by type and status"],
              ["Products", "Best and worst sellers for the period"],
              ["Customers", "Who buys most, and who is new"],
              ["Inventory", "Stock value, and what is low or expiring"],
              ["Payments", "Money taken, split by method"],
              ["Local orders", "Counter trade on its own"],
            ],
          },
          {
            kind: "text",
            text: "Any report can be downloaded as a CSV file, which opens in Excel or Google Sheets — useful for your accountant, or for a stock order.",
          },
          {
            kind: "note",
            tone: "info",
            text: "Reports are read-only for every role, including Super Admin. Nothing on this screen can change your data.",
          },
        ],
      },
      {
        id: "users",
        title: "Staff accounts",
        summary: "Adding colleagues and setting what they may do.",
        permission: "users:read",
        blocks: [
          {
            kind: "steps",
            items: [
              "Open *Staff accounts* and select *Create user*.",
              "Enter their name, email and phone.",
              "Choose a *Role* — see *Who can do what* above if you are unsure.",
              "Set a first password of at least 8 characters including a letter and a number, and pass it on privately.",
              "Save. They can sign in immediately and should change the password themselves.",
            ],
          },
          {
            kind: "note",
            tone: "warning",
            title: "When someone leaves",
            text: "Switch their account to *Inactive* rather than deleting it. They cannot sign in any more, and the orders and stock movements they recorded keep their name against them. Deactivating takes effect immediately, even if they are signed in.",
          },
        ],
      },
      {
        id: "settings",
        title: "Store settings",
        summary: "Store details, delivery, payment, tax and the rules the shop enforces.",
        permission: "settings:read",
        blocks: [
          {
            kind: "text",
            text: "Settings holds the details that appear to customers and the rules the application enforces everywhere else. Changes apply straight away, at the counter and on the website.",
          },
          {
            kind: "table",
            head: ["Group", "What it controls"],
            rows: [
              ["Store information", "Name, address, contact, GST and FSSAI numbers, currency, timezone"],
              ["Delivery", "Whether you deliver or offer pickup, the charge, free-delivery threshold and radius"],
              ["Payments", "Which methods may be used — cash, card, UPI, cash on delivery, online"],
              ["Tax", "Whether tax is applied, whether prices already include it, and the default rate"],
              ["Order rules", "Never sell expired batches, auto-confirm counter orders, maximum manual discount, low-stock alerts"],
              ["Notifications", "Low-stock emails, expiry alerts, new-order alerts, daily summary"],
              ["Security", "How long a session lasts, and whether strong passwords are required"],
              ["Preferences", "Date format, rows per page, compact tables"],
            ],
          },
          {
            kind: "note",
            tone: "warning",
            text: "*Maximum manual discount* and *Never sell expired batches* are the two that most affect the counter. Loosening them loosens them for every member of staff, on every order.",
          },
        ],
      },
      {
        id: "your-account",
        title: "Your own account",
        summary: "Your details and your password.",
        blocks: [
          {
            kind: "text",
            text: "Open the account menu at the top right and choose your profile. You can change your own name, phone and email here whatever your role.",
          },
          {
            kind: "text",
            text: "To change your password you must enter your current one, then a new one of at least 8 characters including a letter and a number. If you have forgotten it, sign out and use *Forgot password* instead.",
          },
        ],
      },
    ],
  },

  {
    title: "The customer website",
    sections: [
      {
        id: "storefront",
        title: "What customers see",
        summary: "The shop your customers use, and how their orders reach you.",
        blocks: [
          {
            kind: "text",
            text: "The storefront is the public side of the same system, at */shop*. Everything on it comes from what you enter here: the products you mark active, their photos and prices, your delivery charges and payment methods.",
          },
          {
            kind: "list",
            items: [
              "Customers browse by category or search, and open a product to read its details.",
              "They add items to a basket and check out, choosing delivery or store pickup.",
              "They may order *without* creating an account — only a name, mobile and address are needed.",
              "The order appears in your *Online Orders* the moment it is placed, and stock is reserved immediately.",
            ],
          },
          {
            kind: "note",
            tone: "info",
            text: "A customer can follow their order at */shop/track* with their order number and the mobile number they used. It is worth reading that number back to them on the phone.",
          },
        ],
      },
      {
        id: "storefront-accounts",
        title: "Customer accounts and addresses",
        summary: "Signing in by mobile number, and saved addresses.",
        blocks: [
          {
            kind: "text",
            text: "Customers sign in with their mobile number and a code sent to it — there is no password to forget. Signing in is optional: it saves them retyping their details, and lets them see past orders.",
          },
          {
            kind: "list",
            items: [
              "A signed-in customer confirms their saved details at checkout rather than entering them again.",
              "They can keep several addresses and mark one as the default.",
              "Their website orders and the orders you take at the counter sit together under the same mobile number.",
            ],
          },
          {
            kind: "note",
            tone: "warning",
            text: "Details are only filled in automatically after the customer has signed in with a code. Typing someone's mobile number at checkout will not reveal their saved address, which is deliberate — otherwise anyone could look up a customer by guessing numbers.",
          },
        ],
      },
    ],
  },

  {
    title: "If something goes wrong",
    sections: [
      {
        id: "messages",
        title: "Messages you may see",
        summary: "What the common refusals mean, and what to do.",
        blocks: [
          {
            kind: "table",
            head: ["Message", "What it means"],
            rows: [
              [
                "Your role cannot perform this action",
                "Your account does not have that permission. Ask a manager — see Who can do what.",
              ],
              [
                "Not enough stock",
                "Fewer units are available than you asked for. Check Stock Levels; some may be reserved for other orders.",
              ],
              [
                "Coupon has expired / reached its usage limit",
                "The code is no longer valid. Check the coupon's dates and limit under Coupons.",
              ],
              [
                "Order is already …",
                "Somebody has already moved this order on. Refresh the page to see where it is now.",
              ],
              [
                "A record with this … already exists",
                "Something unique is duplicated — usually an SKU, a barcode, a coupon code or an email.",
              ],
              [
                "This record is referenced by other data",
                "It is used elsewhere and cannot be deleted. Mark it inactive instead.",
              ],
              [
                "Please sign in to continue",
                "Your session has ended. Sign in again; anything you had not saved is lost.",
              ],
            ],
          },
        ],
      },
      {
        id: "everyday-problems",
        title: "Everyday problems",
        summary: "The handful of things that come up most often.",
        blocks: [
          {
            kind: "list",
            items: [
              "*A product is missing from the counter or the shop.* Check it is marked *Active*, that it is in a category, and that it has stock.",
              "*The stock figure looks wrong.* Open Inventory › Transactions for that product and read down the movements. Remember that stock for placed-but-undelivered orders shows as reserved.",
              "*A customer says their order is not showing.* Ask for the order number and the mobile number they used — the two must match for tracking to work.",
              "*The totals are not what I expected.* Check whether prices include tax, and what the delivery charge and free-delivery threshold are set to in Settings.",
              "*A photo has not changed.* Save the product after uploading, then reload the page in the browser.",
            ],
          },
          {
            kind: "note",
            tone: "info",
            title: "Still stuck",
            text: "Note the exact wording on screen, what you were doing and the order or product number, and pass it to whoever looks after the system. That is usually enough to find the cause without any guesswork.",
          },
        ],
      },
    ],
  },
];

/** Flattened, for searching and for the contents list. */
export const ALL_SECTIONS: ManualSection[] = MANUAL.flatMap((c) => c.sections);
