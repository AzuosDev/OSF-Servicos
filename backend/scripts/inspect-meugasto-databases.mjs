/**
 * Diagnóstico READ-ONLY complementar:
 *  1) lista todos os bancos do cluster e procura o email em cada um;
 *  2) mostra o campo de "dono" real de cada coleção (amostra de qualquer documento),
 *     para descartar a hipótese de o vínculo não ser por `userId`.
 *
 * Não escreve nada e não imprime valores — só nomes de campos e contagens.
 *
 * Uso: node scripts/inspect-meugasto-databases.mjs email@exemplo.com
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function describeType(value) {
  if (value === null) return 'null';
  if (value instanceof Date) return 'Date';
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (value?._bsontype === 'ObjectId') return 'ObjectId';
  return typeof value;
}

async function main() {
  loadEnv();

  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error('Informe o email. Ex: node scripts/inspect-meugasto-databases.mjs email@exemplo.com');
    process.exit(1);
  }

  const uri = process.env.MEUGASTO_MONGO_URI || process.env.MEUGASTO_MONGODB_URI;
  if (!uri) {
    console.error('Defina MEUGASTO_MONGO_URI em backend/.env');
    process.exit(1);
  }

  const client = new mongoose.mongo.MongoClient(uri);
  await client.connect();

  try {
    // ── 1) Onde esse email existe, em todo o cluster ──
    console.log('\n── Bancos do cluster e presença do email ──────────');
    let databases = [];
    try {
      const result = await client.db().admin().listDatabases();
      databases = result.databases.map((d) => d.name);
    } catch (err) {
      console.log(`  (sem permissão para listar bancos: ${err.message})`);
      databases = [client.db().databaseName];
    }

    for (const dbName of databases) {
      if (['admin', 'local', 'config'].includes(dbName)) continue;
      const db = client.db(dbName);
      let names = [];
      try {
        names = (await db.listCollections().toArray()).map((c) => c.name);
      } catch {
        console.log(`  ${dbName}: sem permissão de leitura`);
        continue;
      }
      if (!names.includes('users')) {
        console.log(`  ${dbName}: sem coleção "users" (${names.length} coleções)`);
        continue;
      }
      const total = await db.collection('users').countDocuments();
      const found = await db.collection('users').findOne({ email });
      console.log(
        `  ${dbName}: users=${total}` + (found ? `  ← EMAIL ENCONTRADO (_id ${found._id})` : '  (email não está aqui)'),
      );
    }

    // ── 2) Campo de dono real por coleção, no banco padrão da URI ──
    const db = client.db();
    console.log(`\n── Campos de cada coleção em "${db.databaseName}" ──`);
    const collections = (await db.listCollections().toArray()).map((c) => c.name).sort();

    for (const name of collections) {
      const sample = await db.collection(name).findOne({});
      if (!sample) {
        console.log(`\n  ${name}: (vazia)`);
        continue;
      }
      const fields = Object.entries(sample)
        .map(([k, v]) => `${k}:${describeType(v)}`)
        .join('  ');
      console.log(`\n  ${name}:\n    ${fields}`);
    }

    console.log('\nDiagnóstico concluído. Nada foi alterado.\n');
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('Falha:', err.message);
  process.exit(1);
});
