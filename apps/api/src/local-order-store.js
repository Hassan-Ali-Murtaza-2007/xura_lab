import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const dataDirectory = process.env.ORDER_DATA_DIR
  ? resolve(process.env.ORDER_DATA_DIR)
  : resolve(moduleDirectory, "../data");
const ordersFile = resolve(dataDirectory, "custom-orders.json");

let writeQueue = Promise.resolve();

const initialSeedOrders = () => [];

async function readCustomOrders() {
  try {
    const content = await readFile(ordersFile, "utf8");
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed;
    const defaults = [];
    await persistCustomOrders(defaults);
    return defaults;
  } catch (error) {
    if (error.code === "ENOENT") {
      const defaults = [];
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
