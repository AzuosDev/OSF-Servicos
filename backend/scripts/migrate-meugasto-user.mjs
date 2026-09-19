/**
 * Migra UM usuário do banco de origem (MeuGasto/ContaCerta) para o banco do OSF Serviços.
 *
 * Segurança:
 *  - Por padrão roda em DRY-RUN: mostra exatamente o que faria e não grava nada.
 *  - Só grava com a flag --commit.
 *  - Idempotente: preserva os _id de origem e grava com upsert, então rodar duas vezes
 *    não duplica nada.
 *  - Aborta se o email já existir no destino (o schema tem email unique).
 *
 * Uso:
 *   node scripts/migrate-meugasto-user.mjs --email=alguem@exemplo.com
 *   node scripts/migrate-meugasto-user.mjs --email=alguem@exemplo.com --commit
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

// Origem usa formatos diferentes conforme a época do registro.
const TYPE_MAP = {
  INCOME: 'INCOME',
  EXPENSE: 'EXPENSE',
  TRANSFER: 'TRANSFER',
  entrada: 'INCOME',
  saida: 'EXPENSE',
  saída: 'EXPENSE',
  transferencia: 'TRANSFER',
  transferência: 'TRANSFER',
  receita: 'INCOME',
  despesa: 'EXPENSE',
};

function mapType(sourceType) {
  if (typeof sourceType !== 'string') return null;
  return TYPE_MAP[sourceType] ?? TYPE_MAP[sourceType.toLowerCase()] ?? null;
}

function arg(name) {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

async function main() {
  loadEnv();

  const email = arg('email')?.trim().toLowerCase();
  const commit = process.argv.includes('--commit');

  if (!email) {
    console.error('Erro: use --email=alguem@exemplo.com');
    process.exit(1);
  }

  const sourceUri = process.env.MEUGASTO_MONGO_URI || process.env.MEUGASTO_MONGODB_URI;
  const targetUri = process.env.MONGODB_URI;
  if (!sourceUri) {
    console.error('Erro: MEUGASTO_MONGO_URI não definida em backend/.env');
    process.exit(1);
  }
  if (!targetUri) {
    console.error('Erro: MONGODB_URI (destino) não definida em backend/.env');
    process.exit(1);
  }

  const sourceClient = new mongoose.mongo.MongoClient(sourceUri);
  const targetClient = new mongoose.mongo.MongoClient(targetUri);
  await sourceClient.connect();
  await targetClient.connect();

  try {
    const source = sourceClient.db();
    const target = targetClient.db();

    console.log(`\nModo:    ${commit ? 'COMMIT (grava no destino)' : 'DRY-RUN (não grava nada)'}`);
    console.log(`Origem:  ${source.databaseName}`);
    console.log(`Destino: ${target.databaseName}\n`);

    // ── Usuário de origem ──
    const user = await source.collection('users').findOne({ email });
    if (!user) {
      console.error(`Usuário "${email}" não existe na origem. Abortado.`);
      process.exit(1);
    }

    // ── Conflito no destino ──
    const existing = await target.collection('users').findOne({ email });
    if (existing && String(existing._id) !== String(user._id)) {
      console.error(
        `ABORTADO: já existe outro usuário com o email "${email}" no destino (_id ${existing._id}).\n` +
          'O schema tem email unique. Decida se quer importar para essa conta existente.',
      );
      process.exit(1);
    }

    const userDoc = {
      _id: user._id,
      email: user.email,
      password: user.password, // hash bcrypt, reaproveitado
      name: user.name ?? undefined,
      emailVerified: user.emailVerified ?? false,
      isLegacyFree: user.isLegacyFree ?? false,
      plan: user.plan ?? null,
      subscriptionStatus: user.subscriptionStatus ?? null,
      createdAt: user.createdAt ?? new Date(),
      updatedAt: new Date(),
    };
    for (const key of Object.keys(userDoc)) {
      if (userDoc[key] === undefined) delete userDoc[key];
    }

    console.log('── Usuário ────────────────────────────────────────');
    console.log(`  _id preservado: ${userDoc._id}`);
    console.log(`  email:          ${userDoc.email}`);
    console.log(`  nome:           ${userDoc.name ?? '(sem nome)'}`);
    console.log(`  senha:          hash bcrypt reaproveitado (mesma senha de antes)`);
    console.log(`  emailVerified:  ${userDoc.emailVerified}`);
    console.log(`  ${existing ? 'já existe no destino → será atualizado (upsert)' : 'não existe no destino → será criado'}`);

    // ── Transações ──
    const sourceTransactions = await source
      .collection('transactions')
      .find({ userId: { $in: [user._id, String(user._id)] } })
      .toArray();

    const mapped = [];
    const problems = [];
    for (const tx of sourceTransactions) {
      const type = mapType(tx.type);
      if (!type) {
        problems.push(`_id ${tx._id}: type "${tx.type}" não reconhecido`);
        continue;
      }
      if (typeof tx.value !== 'number' || !(tx.value >= 0.01)) {
        problems.push(`_id ${tx._id}: value inválido (${tx.value}); destino exige >= 0.01`);
        continue;
      }
      if (!tx.date) {
        problems.push(`_id ${tx._id}: sem date; destino exige date`);
        continue;
      }
      const doc = {
        _id: tx._id,
        userId: user._id,
        type,
        value: tx.value,
        date: tx.date instanceof Date ? tx.date : new Date(tx.date),
        createdAt: tx.createdAt ?? new Date(),
        updatedAt: new Date(),
      };
      if (tx.description) doc.description = String(tx.description).slice(0, 500);
      // categoryId da origem referencia categorias de OUTRO banco — não é migrado,
      // pois apontaria para um _id inexistente no destino.
      mapped.push({ doc, sourceType: tx.type });
    }

    console.log('\n── Transações ─────────────────────────────────────');
    console.log(`  encontradas na origem: ${sourceTransactions.length}`);
    console.log(`  migráveis:             ${mapped.length}`);
    if (problems.length) {
      console.log(`  com problema:          ${problems.length}`);
      for (const p of problems) console.log(`    ! ${p}`);
    }
    for (const { doc, sourceType } of mapped) {
      const date = new Date(doc.date).toISOString().slice(0, 10);
      console.log(
        `    ${date}  ${String(sourceType).padEnd(12)} → ${doc.type.padEnd(8)} ` +
          `valor ${doc.value.toFixed(2).padStart(10)}  ${doc.description ?? '(sem descrição)'}`,
      );
    }

    if (sourceTransactions.length > 0 && mapped.length === 0) {
      console.error('\nABORTADO: nenhuma transação pôde ser mapeada. Corrija os problemas acima.');
      process.exit(1);
    }

    // ── Escrita ──
    if (!commit) {
      console.log('\nDRY-RUN concluído. Nada foi gravado.');
      console.log('Para aplicar de verdade, rode o mesmo comando com --commit\n');
      return;
    }

    await target
      .collection('users')
      .updateOne({ _id: userDoc._id }, { $set: userDoc }, { upsert: true });
    console.log('\n  usuário gravado.');

    let written = 0;
    for (const { doc } of mapped) {
      await target.collection('transactions').updateOne({ _id: doc._id }, { $set: doc }, { upsert: true });
      written += 1;
    }
    console.log(`  ${written} transação(ões) gravada(s).`);

    // ── Verificação pós-escrita ──
    const checkUser = await target.collection('users').findOne({ email });
    const checkTx = await target
      .collection('transactions')
      .countDocuments({ userId: user._id });
    console.log('\n── Verificação no destino ─────────────────────────');
    console.log(`  usuário presente:  ${checkUser ? 'sim' : 'NÃO'}`);
    console.log(`  transações:        ${checkTx}`);
    console.log('\nMigração concluída.\n');
  } finally {
    await sourceClient.close();
    await targetClient.close();
  }
}

main().catch((err) => {
  console.error('Falha na migração:', err.message);
  process.exit(1);
});
