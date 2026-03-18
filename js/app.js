const express = require('express');
const fetch = require('node-fetch');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

const BARION_POSKEY = 'XXX';  // sandbox POSKey
const BARION_MERCHANT = 'XXX';
const SIMPLEPAY_MERCHANT = 'XXX';
const SIMPLEPAY_SECRET = 'XXX';
const BASE_URL = 'http://localhost:3000';

app.post('/create-payment/barion', async (req, res) => {
  const { items, total } = req.body;
  const paymentRequest = {
    PaymentType: 'Immediate',
    FundingSources: ['All'],
    GuestCheckOut: true,
    PaymentRequestId: `p-${Date.now()}`,
    PayerHint: '',
    Currency: 'HUF',
    Transactions: [{
      POSTransactionId: `t-${Date.now()}`,
      Payee: BARION_MERCHANT,
      Total: total,
      Items: items.map(i => ({
        Name: i.name,
        Description: i.desc || i.name,
        Quantity: i.quantity,
        Unit: 'db',
        UnitPrice: i.price,
        Kind: 'Product'
      })),
    }],
    RedirectUrl: `${BASE_URL}/payment/result/barion`,
    CallbackUrl: `${BASE_URL}/payment/callback/barion`,
  };

  const response = await fetch('https://api.barion.com/v2/Payment/Start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': BARION_POSKEY
    },
    body: JSON.stringify(paymentRequest),
  });
  const data = await response.json();
  if (data?.PaymentRequestId && data.GatewayUrl) {
    return res.json({ url: data.GatewayUrl });
  }
  res.status(500).json({ error: data });
});

app.post('/payment/callback/barion', async (req, res) => {
  const { PaymentId } = req.body;
  const state = await fetch('https://api.barion.com/v2/Payment/GetPaymentState', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': BARION_POSKEY
    },
    body: JSON.stringify({ PaymentId, POSKey: BARION_POSKEY })
  }).then(r => r.json());

  console.log('Barion callback:', state);
  res.json({ received: true });
});

app.get('/payment/result/barion', (req, res) => {
  // user redirected here
  res.send(`<h1>Barion eredmény</h1><pre>${JSON.stringify(req.query)}</pre>`);
});

const crypto = require('crypto');

function simplepaySign(data) {
  const ss = Object.keys(data).sort().map(k => `${k}=${data[k]}`).join('|');
  return crypto.createHash('sha256').update(ss + SIMPLEPAY_SECRET).digest('hex');
}

app.post('/create-payment/simplepay', (req, res) => {
  const { items, total } = req.body;
  const orderRef = `order-${Date.now()}`;
  const dto = {
    merchant: SIMPLEPAY_MERCHANT,
    orderRef,
    currency: 'HUF',
    amount: total,
    orderDate: String(Date.now()),
    timeout: '1800',
    backRef: `${BASE_URL}/payment/result/simplepay`,
    url: '',
    items: items.map((it, i) => `${i}:${it.name}:${it.quantity}:${it.price}`).join('|'),
  };
  dto.sign = simplepaySign(dto);
  // SimplePay ez esetben POST/redirect; itt fizetési URL-re lépünk
  res.json({ gatewayUrl: `https://www.simplepay.hu/payment/` /* alap? sandbox specifikus */ });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server listening ${PORT}`));