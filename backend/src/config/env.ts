import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID ?? '',
  pythonBin: process.env.PYTHON_BIN ?? 'python',
  paymentAutomationUrl: process.env.PAYMENT_AUTOMATION_URL ?? '',
  paymentBoldUrl: process.env.PAYMENT_BOLD_URL ?? 'https://checkout.bold.co/payment/LNK_Z0PMCC30MQ',
  paymentGatewayProvider: process.env.PAYMENT_GATEWAY_PROVIDER ?? 'bold',
  proxyHost: process.env.PROXY_HOST ?? '',
  proxyPort: process.env.PROXY_PORT ?? '',
  proxySocksPort: process.env.PROXY_SOCKS_PORT ?? '',
  proxyUsername: process.env.PROXY_USERNAME ?? '',
  proxyPassword: process.env.PROXY_PASSWORD ?? '',
};
