#!/usr/bin/env node
/**
 * Marca um usuário como "legacy free": acesso permanente ao app sem cobrança,
 * ignorando trial/assinatura (isLegacyFree = true no user.schema.ts).
 *
 * Uso:
 *   node scripts/set-legacy-free.js admin@exemplo.com
 *
 * Lê MONGODB_URI do .env (mesma variável usada pelo backend em app.module.ts).
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

const email = process.argv[2];

if (!email) {
  console.error('Uso: node scripts/set-legacy-free.js <email>');
  process.exit(1);
}

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI não encontrada no .env');
  process.exit(1);
}

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();

  const db = client.db();
  const result = await db.collection('users').updateOne(
    { email: email.toLowerCase().trim() },
    {
      $set: {
        isLegacyFree: true,
        subscriptionStatus: 'active',
        subscriptionExpiresAt: null,
        trialEndsAt: null,
      },
    },
  );

  if (result.matchedCount === 0) {
    console.error(`Nenhum usuário encontrado com o email: ${email}`);
  } else {
    console.log(`✔ Usuário ${email} marcado como isLegacyFree (acesso permanente, sem cobrança).`);
  }

  await client.close();
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
