import bcrypt from 'bcryptjs';

const password = '1234';

const hash = await bcrypt.hash(password, 10);
console.log('HASH =', hash);

const ok = await bcrypt.compare('1234', hash);
console.log('COMPARE 1234 =', ok);