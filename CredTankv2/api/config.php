<?php
declare(strict_types=1);

const DB_HOST = 'localhost';
const DB_NAME = 'u154372890_Credtank';
const DB_USER = 'u154372890_Lucas';
const DB_PASS = '3=HY1vWz';
// Opcional: sobrescreva com variaveis de ambiente no servidor:
// DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS, DB_CHARSET, DB_HOST_FALLBACK, DB_SOCKET

// Preencha os dados abaixo no servidor para habilitar recuperacao por email/telefone.
const APP_SMTP_HOST = 'smtp.umbler.com';
const APP_SMTP_PORT = '587';
const APP_SMTP_SECURE = 'tls'; // tls|ssl|none
const APP_SMTP_USER = 'suporte@credtank.com'; // ex: noreply@seudominio.com
const APP_SMTP_PASS = '08138487Jesus@'; // senha SMTP da caixa de email
const APP_MAIL_FROM = 'suporte@credtank.com'; // ex: noreply@seudominio.com
const APP_PORTAL_RESET_URL = 'https://credtank.dimivigmonitoramento.com/portal/app.html';
const APP_SMS_WEBHOOK_URL = ''; // URL do gateway SMS/WhatsApp
const APP_SMS_WEBHOOK_TOKEN = ''; // token Bearer opcional do gateway
// Opcional: remetente real do dominio para melhorar a entrega de email.
// Exemplo: const APP_MAIL_FROM = 'noreply@seudominio.com';
// Opcional: webhook para envio de codigo por telefone (SMS/WhatsApp).
// Exemplo: const APP_SMS_WEBHOOK_URL = 'https://seu-gateway.com/send';
// Opcional: token Bearer para autenticar no webhook de telefone.
// Exemplo: const APP_SMS_WEBHOOK_TOKEN = 'seu_token';
// Opcional: URL publica do app usada no link de redefinicao por email.
// Exemplo: const APP_PORTAL_RESET_URL = 'https://seu-dominio.com/portal/app.html';
// Opcional: SMTP autenticado (recomendado no Hostinger quando mail() nao envia).
// Exemplo:
// const APP_SMTP_HOST = 'smtp.hostinger.com';
// const APP_SMTP_PORT = '587';
// const APP_SMTP_USER = 'noreply@seudominio.com';
// const APP_SMTP_PASS = 'sua_senha_smtp';
// const APP_SMTP_SECURE = 'tls'; // tls|ssl|none
