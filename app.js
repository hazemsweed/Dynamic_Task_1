// Note: npm install dotenv
require("dotenv").config();

const MongoClient = require("mongodb").MongoClient;
const ExcelJS = require("exceljs");
const blacklist = ["bad.com", "spam.com", "banned.com"]; // Hardcoded blacklisted domains
const amqp = require("amqplib"); // RabbitMQ

const blacklistRegex = blacklist.map((domain) => new RegExp(domain, "i"));

// Setting DB name manually is useful when switching between multiple databases within the same app
// Note: "make the DB name static if application only interacts with a single database"

async function connectAndFetchDomains() {
  const client = await MongoClient.connect(process.env.DB_URL);
  try {
    const db = client.db(process.env.DB_NAME);
    const domains = await db
      .collection("domains")
      .find({ domain: { $not: { $in: blacklistRegex } } })
      .toArray(); // Direct filter
    return domains;
  } finally {
    await client.close(); // Ensures the client is closed even on errors to prevent Resource Leaks If many connections remain open
  }
}

// Generate Excel file
async function generateExcel(domains) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Good Domains");

  worksheet.columns = [{ header: "Domain", key: "domain", width: 30 }];
  domains.forEach((domain) => worksheet.addRow({ domain: domain.domain }));

  const filePath = "./good_domains.xlsx";
  await workbook.xlsx.writeFile(filePath);
  console.log("Excel file created successfully");
  return filePath;
}

// Publish email task to RabbitMQ
async function publishEmailTask(filePath) {
  const connection = await amqp.connect(process.env.RABBITMQ_URL); // Connect to RabbitMQ
  const channel = await connection.createChannel(); // Create a channel
  await channel.assertQueue("emailQueue"); // Ensure queue exists

  const message = { filePath, recipient: process.env.EMAIL_RECIPIENT }; // Message to publish
  channel.sendToQueue("emailQueue", Buffer.from(JSON.stringify(message))); // Publish to the queue

  console.log("Email task published to RabbitMQ"); // Log success
  await channel.close(); // Close the channel
  await connection.close(); // Close the connection
}

// Main Function
async function processDomains() {
  try {
    const domains = await connectAndFetchDomains(); // Fetch domains from MongoDB
    const filePath = await generateExcel(domains); // Generate Excel file

    await publishEmailTask(filePath); // Publish email task to RabbitMQ
  } catch (error) {
    console.log("Error processing domains:", error);
  }
}

processDomains();
