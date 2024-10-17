// Note: npm install dotenv
require("dotenv").config();
const amqp = require("amqplib"); // RabbitMQ
const nodemailer = require("nodemailer");
const fs = require("fs");

// Send email with Excel file
async function sendEmail({ filePath, recipient }) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: recipient,
    subject: "Good Domains List",
    text: "Attached is the list of good domains",
    attachments: [{ filename: "good_domains.xlsx", path: filePath }],
  };

  try {
    const info = await transporter.sendMail(mailOptions); // Send email
    console.log("Email sent: " + info.response); // Log success

    fs.unlink(filePath, (err) => {
      if (err) console.error("Error deleting file:", err);
      else console.log("Temporary file deleted"); // Delete temp file
    });
  } catch (error) {
    console.error("Error sending email:", error); // Log error
  }
}

// RabbitMQ consumer to process email tasks
async function consumeEmailQueue() {
  const connection = await amqp.connect(process.env.RABBITMQ_URL); // Connect to RabbitMQ
  const channel = await connection.createChannel(); // Create a channel
  await channel.assertQueue("emailQueue"); // Ensure queue exists

  console.log("Waiting for messages in the email queue..."); // Log waiting status

  channel.consume("emailQueue", async (msg) => {
    if (msg) {
      const emailTask = JSON.parse(msg.content.toString()); // Parse message
      await sendEmail(emailTask); // Send email
      channel.ack(msg); // Acknowledge message after processing
    }
  });
}

consumeEmailQueue(); // Start the worker
