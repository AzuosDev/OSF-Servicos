/**
 * Cria/atualiza o CompanySettings de um usuário direto no banco.
 *
 * Segurança:
 *  - DRY-RUN por padrão; só grava com --commit.
 *  - Upsert por userId (índice único), então é idempotente e nunca afeta outro usuário.
 *  - Valida os limites do schema antes de gravar.
 *
 * Uso:
 *   node scripts/set-company-settings.mjs --email=x@y.com --company="OSF Serviços" \
 *     --address="Sobral" --lat=-3.31673 --lng=-40.092974 [--commit]
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

function arg(name) {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

function number(name) {
  const raw = arg(name);
  if (raw === undefined || raw === '') return undefined;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    console.error(`Erro: --${name} não é um número válido ("${raw}")`);
    process.exit(1);
  }
  return parsed;
}

async function main() {
  loadEnv();

  const email = arg('email')?.trim().toLowerCase();
  const commit = process.argv.includes('--commit');
  if (!email) {
    console.error('Erro: use --email=alguem@exemplo.com');
    process.exit(1);
  }

  const companyName = arg('company')?.trim();
  const baseAddress = arg('address')?.trim();
  const originLat = number('lat');
  const originLng = number('lng');
  const pricePerKm = number('price-per-km') ?? 0;
  const minimumTravelFee = number('minimum-fee') ?? 0;
  const freeRadiusKm = number('free-radius') ?? 0;

  // ── Validações espelhando o schema ──
  const errors = [];
  if (!companyName) errors.push('--company é obrigatório (companyName é required no schema)');
  if (companyName && companyName.length > 150) errors.push('companyName excede 150 caracteres');
  if (baseAddress && baseAddress.length > 300) errors.push('baseAddress excede 300 caracteres');
  if (originLat !== undefined && (originLat < -90 || originLat > 90)) errors.push('lat fora de [-90, 90]');
  if (originLng !== undefined && (originLng < -180 || originLng > 180)) errors.push('lng fora de [-180, 180]');
  const hasCoords = originLat !== undefined && originLng !== undefined;
  if (!baseAddress && !hasCoords) {
    errors.push('informe --address ou (--lat e --lng): sem um dos dois o cálculo de deslocamento falha');
  }
  if ((originLat === undefined) !== (originLng === undefined)) {
    errors.push('lat e lng devem vir juntos (só uma das duas não serve como origem)');
  }
  for (const [label, value] of [
    ['price-per-km', pricePerKm],
    ['minimum-fee', minimumTravelFee],
    ['free-radius', freeRadiusKm],
  ]) {
    if (value < 0) errors.push(`--${label} não pode ser negativo`);
  }
  if (errors.length) {
    console.error('Validação falhou:');
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Erro: MONGODB_URI não definida em backend/.env');
    process.exit(1);
  }

  const client = new mongoose.mongo.MongoClient(uri);
  await client.connect();

  try {
    const db = client.db();
    console.log(`\nModo:    ${commit ? 'COMMIT (grava)' : 'DRY-RUN (não grava nada)'}`);
    console.log(`Destino: ${db.databaseName}\n`);

    const user = await db.collection('users').findOne({ email });
    if (!user) {
      console.error(`Usuário "${email}" não existe no destino. Abortado.`);
      process.exit(1);
    }

    const existing = await db.collection('companysettings').findOne({ userId: user._id });

    const doc = {
      userId: user._id,
      companyName,
      pricePerKm,
      minimumTravelFee,
      freeRadiusKm,
      updatedAt: new Date(),
    };
    if (baseAddress) doc.baseAddress = baseAddress;
    if (hasCoords) {
      doc.originLat = originLat;
      doc.originLng = originLng;
    }

    console.log('── Dados da empresa ───────────────────────────────');
    console.log(`  usuário:          ${user.email} (${user._id})`);
    console.log(`  companyName:      ${doc.companyName}`);
    console.log(`  baseAddress:      ${doc.baseAddress ?? '(não informado)'}`);
    console.log(`  originLat:        ${doc.originLat ?? '(não informado)'}`);
    console.log(`  originLng:        ${doc.originLng ?? '(não informado)'}`);
    console.log(`  pricePerKm:       ${doc.pricePerKm}`);
    console.log(`  minimumTravelFee: ${doc.minimumTravelFee}`);
    console.log(`  freeRadiusKm:     ${doc.freeRadiusKm}`);
    console.log(`  ${existing ? 'já existe → será atualizado' : 'não existe → será criado'}`);

    if (hasCoords) {
      console.log('\n  Origem do cálculo: COORDENADAS (têm prioridade sobre o endereço textual).');
    }
    if (pricePerKm === 0) {
      console.log('  Atenção: pricePerKm = 0 → nenhum custo de deslocamento será cobrado nos orçamentos.');
    }

    if (!commit) {
      console.log('\nDRY-RUN concluído. Nada foi gravado.');
      console.log('Para aplicar, repita o comando com --commit\n');
      return;
    }

    await db
      .collection('companysettings')
      .updateOne(
        { userId: user._id },
        { $set: doc, $setOnInsert: { createdAt: new Date() } },
        { upsert: true },
      );

    const check = await db.collection('companysettings').findOne({ userId: user._id });
    console.log('\n── Verificação ────────────────────────────────────');
    console.log(`  gravado: ${check ? 'sim' : 'NÃO'}`);
    if (check) {
      console.log(`  _id:     ${check._id}`);
      console.log(`  coords:  ${check.originLat}, ${check.originLng}`);
    }
    const total = await db.collection('companysettings').countDocuments();
    console.log(`  total de companysettings no banco: ${total}`);
    console.log('\nConcluído.\n');
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('Falha:', err.message);
  process.exit(1);
});
