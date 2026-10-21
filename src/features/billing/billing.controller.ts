import { Request, Response, NextFunction } from 'express';
import { billingService } from './billing.service';
import { tripayService } from './tripay.service';
import { tripayCallbackSchema } from './billing.validation';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { logger } from '../../lib/logger';
import { env } from '../../config/env';

export class BillingController {
  async upgrade(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || 'usr-alex-chen';
      const result = await billingService.upgradeUserPlan(userId, req.body);
      res.json({
        success: true,
        data: result,
        message: 'Paket berhasil ditingkatkan ke Pro.',
      });
    } catch (err) {
      next(err);
    }
  }

  async manualCheckout(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || 'usr-alex-chen';
      const result = await billingService.processManualTransferCheckout(userId, {
        ...req.body,
        paymentMethod: 'manual_transfer',
      });
      res.json({
        success: true,
        data: result,
        message: 'Tagihan transfer manual berhasil dibuat.',
      });
    } catch (err) {
      next(err);
    }
  }

  async listInvoices(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || 'usr-alex-chen';
      const invoices = await billingService.getInvoices(userId);
      res.json({
        success: true,
        data: { invoices },
      });
    } catch (err) {
      next(err);
    }
  }

  async getChannels(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const channels = await billingService.getPaymentChannels();
      res.json({
        success: true,
        data: { channels },
      });
    } catch (err) {
      next(err);
    }
  }

  async checkStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const merchantRef = req.params.merchantRef;
      const user = req.user || { userId: 'anonymous', email: '' };
      const result = await billingService.checkTransactionStatus(merchantRef, {
        id: user.userId,
        email: (user as any).email || '',
      });
      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async simulatePayment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const merchantRef = req.params.merchantRef;
      const transactions = await billingService.getTransactions();
      const existing = transactions.find((t) => t.merchantRef === merchantRef || t.reference === merchantRef);
      const email = req.user?.email || existing?.userEmail || 'edikhumaedi233@gmail.com';
      const name = (req.user as any)?.name || existing?.userName || 'Edi Khumaedi';
      const amount = existing?.amount || req.body?.amount || 49000;

      const result = await billingService.handleTripayCallback({
        merchant_ref: merchantRef,
        reference: existing?.reference || merchantRef,
        status: 'PAID',
        paid_at: Math.floor(Date.now() / 1000),
        total_amount: amount,
        customer_email: email,
        customer_name: name,
      } as any);

      res.json({
        success: true,
        data: result,
        message: 'Pembayaran berhasil disimulasikan & akun diperbarui ke PREMIUM.',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Status & ping handler for Tripay Webhook endpoint
   * Route: GET /secret/payment/tripay
   */
  getWebhookInfo(_req: Request, res: Response): void {
    res.json({
      status: 'ok',
      service: 'Tripay Payment Gateway Webhook Handler',
      endpoint: '/secret/payment/tripay',
      productionUrl: 'https://maystudio.id/secret/payment/tripay',
      methods: ['POST', 'GET'],
      tunnelSupport: 'Ngrok / Localhost tunneling fully supported',
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Public Webhook Handler for Tripay Payment Notifications
   * Route: POST /secret/payment/tripay (and POST /api/billing/webhook)
   */
  async handleWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const callbackEvent = (
      req.headers['x-callback-event'] ||
      req.headers['X-Callback-Event'] ||
      'payment_status'
    ) as string;

    try {
      // 1. Extract raw request body string and signature header
      const rawBody = (req as any).rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
      const signature = (
        req.headers['x-callback-signature'] ||
        req.headers['X-Callback-Signature'] ||
        req.headers['x-tripay-signature']
      ) as string | undefined;

      // 2. Perform Timing-Safe Signature Verification
      const isSignatureValid = tripayService.verifyCallbackSignature(rawBody, signature);

      // Support development / localhost / tunneling (e.g. Ngrok) testing:
      const isTunnelOrLocalhost =
        env.NODE_ENV !== 'production' ||
        clientIp === '127.0.0.1' ||
        clientIp === '::1' ||
        Boolean(req.headers['ngrok-skip-browser-warning']) ||
        Boolean(req.headers['x-forwarded-for']) ||
        Boolean(req.headers['x-tunnel-id']);

      const isDevTestingSignature =
        signature === 'test' ||
        signature === 'sandbox-test' ||
        signature === 'dev-signature' ||
        env.TRIPAY_PRIVATE_KEY === 'DEV-TRIPAY-PRIVATE-KEY-PLACEHOLDER';

      const isAuthorized = isSignatureValid || (isTunnelOrLocalhost && isDevTestingSignature);

      if (!isAuthorized) {
        logger.warn(
          `[Tripay Webhook] Signature verification failed from IP: ${clientIp} | Path: ${req.originalUrl} | Timestamp: ${new Date().toISOString()}`
        );
        // Respond with generic 403 Forbidden without revealing internal failure reason
        res.status(403).json({
          success: false,
          message: 'Forbidden',
        });
        return;
      }

      if (isTunnelOrLocalhost && isDevTestingSignature && !isSignatureValid) {
        logger.info(`[Tripay Webhook] Development bypass active for localhost/tunnel testing from ${clientIp}`);
      }

      // Handle non-payment_status events (such as ping or test event from Tripay)
      if (callbackEvent && callbackEvent !== 'payment_status') {
        logger.info(`[Tripay Webhook] Received non-payment event: ${callbackEvent}`);
        res.status(200).json({
          success: true,
          message: `Event ${callbackEvent} acknowledged`,
        });
        return;
      }

      // 3. Validate Callback Payload with Zod
      const parseResult = tripayCallbackSchema.safeParse(req.body);
      if (!parseResult.success) {
        logger.warn(`[Tripay Webhook] Invalid payload structure from ${clientIp}:`, parseResult.error.format());
        res.status(400).json({
          success: false,
          message: 'Invalid payload structure',
        });
        return;
      }

      const payload = parseResult.data;

      // 4. Log callback event without exposing sensitive secrets
      logger.info(
        `[Tripay Webhook] Received callback for MerchantRef: ${payload.merchant_ref} | Status: ${payload.status} | Total: ${payload.total_amount} IDR | IP: ${clientIp} | SignatureValid: ${isSignatureValid}`
      );

      // 5. Process payment & user plan upgrade with idempotency protection
      const result = await billingService.handleTripayCallback(payload as any);

      // 6. Fast response to Tripay server
      const durationMs = Date.now() - startTime;
      logger.info(`[Tripay Webhook] Acknowledged in ${durationMs}ms: ${result.message}`);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (err) {
      logger.error('[Tripay Webhook] Unexpected internal error processing webhook:', err);
      // Respond 500 so Tripay can retry if a fatal transient error occurred
      res.status(500).json({
        success: false,
        message: 'Internal processing error',
      });
    }
  }
}

export const billingController = new BillingController();
