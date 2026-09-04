import Razorpay from "razorpay"
import "dotenv/config"

const KEY_ID = process.env.RAZORPAY_KEY_ID
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET

if (!KEY_ID || !KEY_SECRET) {
  console.error("Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET in environment.")
  process.exit(1)
}

const rzp = new Razorpay({
  key_id: KEY_ID,
  key_secret: KEY_SECRET,
})

const testOrdersToCreate = [
  {
    amount: 129900, // ₹1,299.00 in paise
    currency: "INR",
    receipt: `rcpt_unpaid_${Date.now().toString().slice(-5)}_01`,
    notes: {
      plan_name: "Starter Cloud Subscription",
      customer_name: "Aarav Patel",
      customer_email: "aarav.patel@example.com",
      customer_contact: "+919876501234",
      payment_status: "unpaid",
      created_via: "razorpay_agent_cli",
    },
  },
  {
    amount: 249900, // ₹2,499.00 in paise
    currency: "INR",
    receipt: `rcpt_unpaid_${Date.now().toString().slice(-5)}_02`,
    notes: {
      plan_name: "Pro Developer Suite (Annual)",
      customer_name: "Priya Sundaram",
      customer_email: "priya.s@example.com",
      customer_contact: "+919812345678",
      payment_status: "unpaid",
      created_via: "razorpay_agent_cli",
    },
  },
  {
    amount: 499900, // ₹4,999.00 in paise
    currency: "INR",
    receipt: `rcpt_unpaid_${Date.now().toString().slice(-5)}_03`,
    notes: {
      plan_name: "Enterprise Custom Tier",
      customer_name: "Vikram Malhotra",
      customer_email: "vikram.m@example.com",
      customer_contact: "+919988776655",
      payment_status: "unpaid",
      created_via: "razorpay_agent_cli",
    },
  },
]

async function run() {
  console.log("🚀 Creating live unpaid orders via Razorpay API...\n")
  const createdOrders = []

  for (const orderData of testOrdersToCreate) {
    try {
      const order = await rzp.orders.create(orderData)
      createdOrders.push(order)
      console.log(`✅ Order Created: ${order.id}`)
      console.log(`   Amount: ₹${(order.amount / 100).toFixed(2)} (${order.currency})`)
      console.log(`   Amount Due: ₹${(order.amount_due / 100).toFixed(2)} | Paid: ₹${(order.amount_paid / 100).toFixed(2)}`)
      console.log(`   Status: ${order.status} (UNPAID)`)
      console.log(`   Receipt: ${order.receipt}`)
      console.log(`   Item: ${order.notes?.plan_name}`)
      console.log(`   Customer: ${order.notes?.customer_name} <${order.notes?.customer_email}>`)
      console.log("--------------------------------------------------")
    } catch (err) {
      console.error(`❌ Failed to create order:`, err.message)
    }
  }

  console.log(`\n🎉 Successfully created ${createdOrders.length} unpaid orders on Razorpay!`)
  return createdOrders
}

run()
