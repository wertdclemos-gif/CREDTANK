# Rewards API (Cashback + Pontos)

Modulo de recompensas com ledger imutavel, idempotencia, caps, tiers, campanhas, expiracao e reversao.

## Endpoints

- `POST /api/rewards/earn` (ou `/api/rewards/earn.php`)
- `POST /api/rewards/confirm` (ou `/api/rewards/confirm.php`)
- `POST /api/rewards/redeem` (ou `/api/rewards/redeem.php`)
- `POST /api/rewards/reverse` (ou `/api/rewards/reverse.php`)
- `GET /api/rewards/balance?user_id=F-LOCAL`
- `GET /api/rewards/admin/ledger?page=1&page_size=50`
- `GET /api/rewards/admin/metrics`
- `POST /api/rewards/seed`

## Regras default

- Cashback base: `1.5%`
- Pontos base: `1 ponto por R$1`
- Conversao: `100 pontos = R$1`
- Minimo para gerar rewards: `R$5`
- Pending: `7 dias`
- Cap diario: `R$50 cashback`, `5000 pontos`
- Cap por transacao: `R$80 cashback`, `10000 pontos`
- Resgate minimo: `R$5`
- Resgate maximo por pedido: `30%`
- FIFO: pontos por expiracao primeiro, depois cashback
- Expiracao: pontos em `12 meses`, cashback em `6 meses`

## cURL rapido

```bash
curl -X POST http://localhost/api/rewards/seed
```

```bash
curl -X POST http://localhost/api/rewards/earn \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"F-LOCAL",
    "external_transaction_id":"ORDER-1001",
    "base_amount":"180.00",
    "eligible_amount":"180.00",
    "paid_at":"2026-02-12T12:30:00-03:00",
    "merchant_id":"P-LOCAL",
    "source":"portal",
    "created_by":"admin-local"
  }'
```

```bash
curl -X POST http://localhost/api/rewards/confirm \
  -H "Content-Type: application/json" \
  -d '{"external_transaction_id":"ORDER-1001"}'
```

```bash
curl -X POST http://localhost/api/rewards/redeem \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"F-LOCAL",
    "external_transaction_id":"CHECKOUT-2001",
    "purchase_amount":"120.00",
    "redeem_points":700,
    "redeem_cashback":"5.00"
  }'
```

```bash
curl -X POST http://localhost/api/rewards/reverse \
  -H "Content-Type: application/json" \
  -d '{"external_transaction_id":"ORDER-1001","reason":"chargeback"}'
```

```bash
curl "http://localhost/api/rewards/balance?user_id=F-LOCAL"
```

## Testes

Execute:

```bash
php public_html/api/rewards/tests/run.php
```

## Observacoes

- Ledger e imutavel: apenas creditos/debitos/expiracoes/reversoes.
- Idempotencia por `event_key` unico.
- Concurrencia protegida com `SELECT ... FOR UPDATE`.
- Regras sao configuraveis via `reward_settings.setting_key = rules_json`.
