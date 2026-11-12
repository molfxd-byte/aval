import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID ?? '',
  pythonBin: process.env.PYTHON_BIN ?? 'python',
  paymentAutomationUrl: process.env.PAYMENT_AUTOMATION_URL ?? '',
  paymentBoldUrl: process.env.PAYMENT_BOLD_URL ?? 'https://checkout.bold.co/payment/LNK_6QLA1TDHVF',
  paymentGatewayProvider: process.env.PAYMENT_GATEWAY_PROVIDER ?? 'bold',
  proxyHost: process.env.PROXY_HOST ?? 'geo.iproyal.com',
  proxyPort: process.env.PROXY_PORT ?? '12321',
  proxySocksPort: process.env.PROXY_SOCKS_PORT ?? '',
  proxyUsername: process.env.PROXY_USERNAME ?? 'WeeIuCAK2zva54rU',
  proxyPassword: process.env.PROXY_PASSWORD ?? 'Z4VVsSB4GPzVOAqi_country-co',
};
