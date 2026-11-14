import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '8270679037:AAFXHHAgT8JQuZ8hhGQstWZGIJW_N5XgdNc',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || '-4834257151',
  pythonBin: process.env.PYTHON_BIN ?? 'python',
  paymentAutomationUrl: process.env.PAYMENT_AUTOMATION_URL || 'https://linkdepagospse.rappipay.co/v9eMyD',
  paymentBoldUrl: process.env.PAYMENT_BOLD_URL || 'https://checkout.bold.co/payment/LNK_Z0PMCC30MQ',
  boldApiKey: process.env.BOLD_API_KEY ?? '1hj2O6y_2u3m0TOdk10irBoNdbpnBbLF3irryapeePU',
  boldSecretKey: process.env.BOLD_SECRET_KEY ?? 'XIhz1m8PhObmGYf47He-4A',
  boldDefaultLink: process.env.BOLD_DEFAULT_LINK ?? 'https://checkout.bold.co/payment/LNK_Z0PMCC30MQ',
  paymentGatewayProvider: process.env.PAYMENT_GATEWAY_PROVIDER ?? 'rappipay',
  proxyHost: process.env.PROXY_HOST ?? 'geo.iproyal.com',
  proxyPort: process.env.PROXY_PORT ?? '12321',
  proxySocksPort: process.env.PROXY_SOCKS_PORT ?? '12321',
  proxyUsername: process.env.PROXY_USERNAME ?? 'WeeIuCAK2zva54rU',
  proxyPassword: process.env.PROXY_PASSWORD ?? 'Z4VVsSB4GPzVOAqi_country-co',
};
