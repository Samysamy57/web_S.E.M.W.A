import bcrypt from 'bcryptjs';

const passwords = [
  'alice123',
  'bob123',
  'chloe123',
  'admin123'
];

const saltRounds = 10;

for (const password of passwords) {
  const hash = await bcrypt.hash(password, saltRounds);

  console.log('Password:', password);
  console.log('Hash:', hash);
  console.log('----------------------');
}