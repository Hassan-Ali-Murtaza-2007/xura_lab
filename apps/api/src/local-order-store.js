import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const dataDirectory = process.env.ORDER_DATA_DIR
  ? resolve(process.env.ORDER_DATA_DIR)
  : resolve(moduleDirectory, "../data");
const ordersFile = resolve(dataDirectory, "custom-orders.json");

let writeQueue = Promise.resolve();

const initialSeedOrders = () => [
  {
    id: 1001,
    customerName: "Hamza Tariq",
    email: "hamza.tariq@gmail.com",
    phone: "03001234567",
    firstName: "Hamza",
    lastName: "Tariq",
    company: null,
    countryCode: "PK",
    addressLine1: "House 14, Street 5, Phase 5, DHA",
    addressLine2: null,
    city: "Lahore",
    province: "Punjab",
    postalCode: "54792",
    deliveryAddress: "House 14, Street 5, Phase 5, DHA, Lahore, Punjab, PK",
    shippingMethod: "standard",
    paymentMethod: "cash-on-delivery",
    billingSameAsShipping: true,
    billingAddress: null,
    marketingConsent: true,
    orderNote: "Please ring the bell twice upon arrival.",
    subtotal: 3500,
    deliveryFee: 370,
    total: 3870,
    status: "confirmed",
    createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    items: [
      {
        id: 1,
        productId: 1,
        productName: "Arven",
        concentrationPercent: 20,
        unitPrice: 3500,
        quantity: 1,
        lineTotal: 3500
      }
    ]
  },
  {
    id: 1002,
    customerName: "Sara Ahmed",
    email: "sara.ahmed@yahoo.com",
    phone: "03219876543",
    firstName: "Sara",
    lastName: "Ahmed",
    company: "Studio Bloom",
    countryCode: "PK",
    addressLine1: "Apartment 4B, Ocean Towers, Clifton Block 9",
    addressLine2: null,
    city: "Karachi",
    province: "Sindh",
    postalCode: "75600",
    deliveryAddress: "Studio Bloom, Apartment 4B, Ocean Towers, Clifton Block 9, Karachi, Sindh, PK",
    shippingMethod: "standard",
    paymentMethod: "bank-transfer",
    billingSameAsShipping: true,
    billingAddress: null,
    marketingConsent: false,
    orderNote: "Gift packaging preferred if available.",
    subtotal: 11000,
    deliveryFee: 370,
    total: 11370,
    status: "pending",
    createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    items: [
      {
        id: 2,
        productId: 2,
        productName: "Velor",
        concentrationPercent: 40,
        unitPrice: 5500,
        quantity: 2,
        lineTotal: 11000
      }
    ]
  },
  {
    id: 1003,
    customerName: "Bilal Khan",
    email: "bilal.khan@outlook.com",
    phone: "03335551234",
    firstName: "Bilal",
    lastName: "Khan",
    company: null,
    countryCode: "PK",
    addressLine1: "House 28, Street 19, Sector F-7/2",
    addressLine2: null,
    city: "Islamabad",
    province: "Islamabad Capital Territory",
    postalCode: "44000",
    deliveryAddress: "House 28, Street 19, Sector F-7/2, Islamabad, Islamabad Capital Territory, PK",
    shippingMethod: "standard",
    paymentMethod: "card",
    billingSameAsShipping: true,
    billingAddress: null,
    marketingConsent: true,
    orderNote: null,
    subtotal: 2500,
    deliveryFee: 370,
    total: 2870,
    status: "delivered",
    createdAt: new Date(Date.now() - 3600000 * 28).toISOString(),
    items: [
      {
        id: 3,
        productId: 3,
        productName: "Nyra",
        concentrationPercent: 10,
        unitPrice: 2500,
        quantity: 1,
        lineTotal: 2500
      }
    ]
  },
  {
    id: 1004,
    customerName: "Ayesha Malik",
    email: "ayesha.malik@gmail.com",
    phone: "03454448899",
    firstName: "Ayesha",
    lastName: "Malik",
    company: null,
    countryCode: "PK",
    addressLine1: "Villa 9, Safari Villas, Bahria Town",
    addressLine2: null,
    city: "Rawalpindi",
    province: "Punjab",
    postalCode: "46000",
    deliveryAddress: "Villa 9, Safari Villas, Bahria Town, Rawalpindi, Punjab, PK",
    shippingMethod: "standard",
    paymentMethod: "cash-on-delivery",
    billingSameAsShipping: true,
    billingAddress: null,
    marketingConsent: true,
    orderNote: "Please call before delivery.",
    subtotal: 9000,
    deliveryFee: 370,
    total: 9370,
    status: "shipped",
    createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    items: [
      {
        id: 4,
        productId: 1,
        productName: "Arven",
        concentrationPercent: 40,
        unitPrice: 5500,
        quantity: 1,
        lineTotal: 5500
      },
      {
        id: 5,
        productId: 3,
        productName: "Nyra",
        concentrationPercent: 20,
        unitPrice: 3500,
        quantity: 1,
        lineTotal: 3500
      }
    ]
  }
];

async function readCustomOrders() {
  try {
    const content = await readFile(ordersFile, "utf8");
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed) && parsed.length) return parsed;
    const defaults = initialSeedOrders();
    await persistCustomOrders(defaults);
    return defaults;
  } catch (error) {
    if (error.code === "ENOENT") {
      const defaults = initialSeedOrders();
      await persistCustomOrders(defaults);
      return defaults;
    }
    throw error;
  }
}

async function persistCustomOrders(orders) {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(ordersFile, `${JSON.stringify(orders, null, 2)}\n`, "utf8");
}

export async function getLocalOrders({ search = "", status = "", paymentMethod = "" } = {}) {
  const orders = await readCustomOrders();
  const searchNormalized = String(search || "").trim().toLowerCase();

  return orders
    .filter((order) => {
      if (status && status !== "all" && order.status !== status) return false;
      if (paymentMethod && paymentMethod !== "all" && order.paymentMethod !== paymentMethod) return false;
      if (!searchNormalized) return true;

      const searchableText = [
        String(order.id),
        `#${order.id}`,
        order.customerName,
        order.email,
        order.phone,
        order.city,
        ...(order.items || []).map((item) => item.productName)
      ].join(" ").toLowerCase();

      return searchableText.includes(searchNormalized);
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getLocalOrderById(id) {
  const numId = Number(id);
  const orders = await readCustomOrders();
  return orders.find((order) => Number(order.id) === numId) || null;
}

export async function updateLocalOrderStatus(id, newStatus) {
  const numId = Number(id);
  const validStatuses = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
  if (!validStatuses.includes(newStatus)) {
    throw Object.assign(new Error("Invalid order status value."), { statusCode: 400 });
  }

  let updatedOrder = null;
  writeQueue = writeQueue.catch(() => {}).then(async () => {
    const orders = await readCustomOrders();
    const index = orders.findIndex((order) => Number(order.id) === numId);
    if (index === -1) return;

    orders[index] = {
      ...orders[index],
      status: newStatus,
      updatedAt: new Date().toISOString()
    };
    updatedOrder = orders[index];
    await persistCustomOrders(orders);
  });
  await writeQueue;
  return updatedOrder;
}

export async function createLocalOrder(orderData) {
  let createdOrder = null;
  writeQueue = writeQueue.catch(() => {}).then(async () => {
    const orders = await readCustomOrders();
    const nextId = Math.max(1000, ...orders.map((o) => Number(o.id) || 0)) + 1;
    createdOrder = {
      ...orderData,
      id: nextId,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await persistCustomOrders([createdOrder, ...orders]);
  });
  await writeQueue;
  return createdOrder;
}
