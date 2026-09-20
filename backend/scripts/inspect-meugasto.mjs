/**
 * Inspeção READ-ONLY do banco do MeuGasto, para planejar a migração de um usuário.
 *
 * NÃO escreve nada. NÃO imprime valores sensíveis (senha, tokens) — só nomes de campos,
 * contagens e o prefixo do hash, o suficiente para montar o mapeamento.
 *
 * Uso:
 *   node scripts/inspect-meugasto.mjs email-do-usuario@exemplo.com
 *
 * Requer no backend/.env:
 *   MEUGASTO_MONGODB_URI=mongodb+srv://...   (de preferência um usuário somente-leitura)
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

// Campos que nunca devem ser impressos, mesmo em amostras.
const SENSITIVE = new Set([
  'password',
  'emailVerificationToken',
  'passwordResetToken',
  'token',
  'refreshToken',
  'credentialPublicKey',
  'publicKey',
  'challenge',
  'secret',
]);

function describeValue(key, value) {
  if (SENSITIVE.has(key)) return '<omitido>';
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (value instanceof Date) return 'Date';
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (value?._bsontype === 'ObjectId') return 'ObjectId';
  const type = typeof value;
  if (type === 'string') return `string(${value.length})`;
  if (type === 'object') return `object{${Object.keys(value).slice(0, 8).join(',')}}`;
  return type;
}

function hashAlgorithm(hash) {
  if (typeof hash !== 'string') return 'ausente';
  if (/^\$2[aby]\$/.test(hash)) return `bcrypt (${hash.slice(0, 4)}) — compatível com este projeto`;
  if (hash.startsWith('$argon2')) return 'argon2 — INCOMPATÍVEL, exigirá redefinição de senha';
  if (hash.startsWith('pbkdf2')) return 'pbkdf2 — INCOMPATÍVEL, exigirá redefinição de senha';
  return `desconhecido (prefixo "${hash.slice(0, 6)}") — verificar antes de reaproveitar`;
}

async function main() {
  loadEnv();

  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error('Erro: informe o email do usuário.\n  node scripts/inspect-meugasto.mjs email@exemplo.com');
    process.exit(1);
  }

  const uri = process.env.MEUGASTO_MONGO_URI || process.env.MEUGASTO_MONGODB_URI;
  if (!uri) {
    console.error('Erro: defina MEUGASTO_MONGO_URI (ou MEUGASTO_MONGODB_URI) em backend/.env');
    process.exit(1);
  }

  const client = new mongoose.mongo.MongoClient(uri);
  await client.connect();

  try {
    const db = client.db();
    console.log(`\nBanco de origem: ${db.databaseName}\n`);

    const collections = (await db.listCollections().toArray())
      .map((c) => c.name)
      .sort();

    // 1) Localizar o usuário
    const usersCollection = collections.includes('users') ? 'users' : null;
    if (!usersCollection) {
      console.error('Não encontrei a coleção "users". Coleções disponíveis:', collections.join(', '));
      process.exit(1);
    }

    const user = await db.collection('users').findOne({ email });
    if (!user) {
      console.error(`Nenhum usuário com email "${email}" nesse banco.`);
      process.exit(1);
    }

    console.log('── Usuário encontrado ─────────────────────────────');
    console.log(`  _id:      ${user._id}`);
    console.log(`  email:    ${user.email}`);
    console.log(`  name:     ${user.name ?? '(sem nome)'}`);
    console.log(`  criado:   ${user.createdAt ?? '(sem createdAt)'}`);
    console.log(`  senha:    ${hashAlgorithm(user.password)}`);
    console.log(`  campos:   ${Object.keys(user).join(', ')}`);

    // 2) Volume por coleção, escopado ao usuário
    console.log('\n── Documentos deste usuário, por coleção ──────────');
    const userId = user._id;
    const idVariants = [userId, String(userId)];

    const report = [];
    for (const name of collections) {
      const collection = db.collection(name);
      const total = await collection.countDocuments();

      let owned = 0;
      let ownerField = null;
      for (const field of ['userId', 'user', 'ownerId']) {
        const count = await collection.countDocuments({ [field]: { $in: idVariants } });
        if (count > 0) {
          owned = count;
          ownerField = field;
          break;
        }
      }
      if (name === 'users') {
        owned = 1;
        ownerField = '_id';
      }

      report.push({ name, total, owned, ownerField });
    }

    const width = Math.max(...report.map((r) => r.name.length));
    for (const r of report) {
      const flag = r.owned > 0 ? '→' : ' ';
      console.log(
        `  ${flag} ${r.name.padEnd(width)}  do usuário: ${String(r.owned).padStart(6)}   total: ${String(r.total).padStart(7)}` +
          (r.ownerField && r.ownerField !== '_id' ? `   (por ${r.ownerField})` : ''),
      );
    }

    // 3) Formato dos documentos das coleções que têm dados do usuário
    console.log('\n── Formato dos documentos (só nomes/tipos) ────────');
    for (const r of report) {
      if (r.owned === 0 || r.name === 'users') continue;
      const sample = await db
        .collection(r.name)
        .findOne({ [r.ownerField]: { $in: idVariants } });
      if (!sample) continue;
      console.log(`\n  ${r.name}:`);
      for (const [key, value] of Object.entries(sample)) {
        console.log(`    ${key.padEnd(24)} ${describeValue(key, value)}`);
      }
    }

    console.log('\nInspeção concluída. Nada foi alterado no banco de origem.\n');
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('Falha na inspeção:', err.message);
  process.exit(1);
});
