const { execSync } = require('child_process');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const url = 'http://127.0.0.1:3000';
const email = `test${Date.now()}@contacerta.local`;
const password = 'Test1234';

(async () => {
  try {
    const register = execSync(
      `curl -sS -X POST ${url}/api/auth/register -H 'Content-Type: application/json' -d '${JSON.stringify({ email, password })}'`,
      { encoding: 'utf8' },
    );
    console.log('REGISTER', register);

    await mongoose.connect('mongodb://127.0.0.1:27017/contacerta');
    const UserSchema = new mongoose.Schema({}, { strict: false, collection: 'users' });
    const User = mongoose.model('UserTest', UserSchema);
    const user = await User.findOne({ email }).exec();
    if (!user) throw new Error('User not found in DB');
    await User.updateOne({ _id: user._id }, { $set: { emailVerified: true, emailVerificationToken: null } });
    console.log('VERIFIED USER', user._id.toString());
    await mongoose.disconnect();

    const login = execSync(
      `curl -sS -X POST ${url}/api/auth/login -H 'Content-Type: application/json' -d '${JSON.stringify({ email, password })}'`,
      { encoding: 'utf8' },
    );
    console.log('LOGIN', login);
    const loginObj = JSON.parse(login);
    const decoded = jwt.verify(loginObj.accessToken, 'dev');
    console.log('DECODED', decoded);

    const me = execSync(
      `curl -sS -X GET ${url}/api/auth/me -H 'Authorization: Bearer ${loginObj.accessToken}'`,
      { encoding: 'utf8' },
    );
    console.log('ME', me);

    const category = execSync(
      `curl -sS -X POST ${url}/api/categories -H 'Content-Type: application/json' -H 'Authorization: Bearer ${loginObj.accessToken}' -d '${JSON.stringify({ name: "Teste Categoria", icon: "Star", color: "#123ABC" })}'`,
      { encoding: 'utf8' },
    );
    console.log('CATEGORY_CREATE', category);

    const transaction = execSync(
      `curl -sS -X POST ${url}/api/transactions -H 'Content-Type: application/json' -H 'Authorization: Bearer ${loginObj.accessToken}' -d '${JSON.stringify({ type: "INCOME", value: 1000.5, date: "2026-06-03T12:00:00.000Z" })}'`,
      { encoding: 'utf8' },
    );
    console.log('TRANSACTION_INCOME', transaction);

    const pending = execSync(
      `curl -sS -X POST ${url}/api/pending -H 'Content-Type: application/json' -H 'Authorization: Bearer ${loginObj.accessToken}' -d '${JSON.stringify({ title: "Conta teste", value: 200.25, dueDate: "2026-06-30T00:00:00.000Z" })}'`,
      { encoding: 'utf8' },
    );
    console.log('PENDING_CREATE', pending);

    const goal = execSync(
      `curl -sS -X POST ${url}/api/goals -H 'Content-Type: application/json' -H 'Authorization: Bearer ${loginObj.accessToken}' -d '${JSON.stringify({ name: "Meta teste", targetValue: 500, currentValue: 250 })}'`,
      { encoding: 'utf8' },
    );
    console.log('GOAL_CREATE', goal);

    const cats = execSync(`curl -sS -X GET ${url}/api/categories -H 'Authorization: Bearer ${loginObj.accessToken}'`, { encoding: 'utf8' });
    console.log('CATEGORIES_LIST', cats);

    const txs = execSync(`curl -sS -X GET '${url}/api/transactions?page=1&limit=5' -H 'Authorization: Bearer ${loginObj.accessToken}'`, { encoding: 'utf8' });
    console.log('TRANSACTIONS_LIST', txs);

    const pend = execSync(`curl -sS -X GET '${url}/api/pending?paid=false' -H 'Authorization: Bearer ${loginObj.accessToken}'`, { encoding: 'utf8' });
    console.log('PENDING_LIST', pend);

    const goals = execSync(`curl -sS -X GET ${url}/api/goals -H 'Authorization: Bearer ${loginObj.accessToken}'`, { encoding: 'utf8' });
    console.log('GOALS_LIST', goals);

    const refresh = execSync(
      `curl -sS -X POST ${url}/api/auth/refresh -H 'Content-Type: application/json' -d '${JSON.stringify({ refreshToken: loginObj.refreshToken })}'`,
      { encoding: 'utf8' },
    );
    console.log('REFRESH', refresh);

    const logout = execSync(
      `curl -sS -X POST ${url}/api/auth/logout -H 'Content-Type: application/json' -H 'Authorization: Bearer ${loginObj.accessToken}' -d '${JSON.stringify({ refreshToken: loginObj.refreshToken })}'`,
      { encoding: 'utf8' },
    );
    console.log('LOGOUT', logout);
  } catch (err) {
    console.error('SCRIPT ERROR', err.message);
    if (err.stdout) console.error('STDOUT', err.stdout.toString());
    if (err.stderr) console.error('STDERR', err.stderr.toString());
  }
})();
