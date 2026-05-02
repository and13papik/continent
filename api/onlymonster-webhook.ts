// api/onlymonster-webhook.js
import { Request, Response } from "express";

export default async function handler(req: Request, res: Response) {
  if (req.method === "POST") {
    // Check secret in headers
    const secret = req.headers['x-om-webhook-secret'];
    
    // Use the secret from environment
    const OM_WEBHOOK_SECRET = process.env.OM_WEBHOOK_SECRET || "om_webhook_99ff5707ade5e23dae520a663a8f9ac88272c761e4f2a130939c30160cd33222";
    
    if (secret !== OM_WEBHOOK_SECRET) {
      return res.status(403).json({ error: "Invalid webhook secret" });
    }

    console.log("OnlyMonster Webhook received:", req.body);

    return res.status(200).json({ received: true });
  }

  res.status(405).send("Method Not Allowed");
}
